import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { FUNNY_SOUND_IDS } from "@/lib/funny-sound-ids";
import { computeTeamStandings } from "@/lib/team-standings";

async function assignFunnySoundId(roomId: string): Promise<string> {
  const { data: used } = await supabaseAdmin
    .from("players")
    .select("funny_sound_id")
    .eq("room_id", roomId)
    .not("funny_sound_id", "is", null);
  const usedSet = new Set(
    (used ?? [])
      .map((r) => (r as { funny_sound_id: string | null }).funny_sound_id)
      .filter((v): v is string => Boolean(v)),
  );
  const remaining = FUNNY_SOUND_IDS.filter((id) => !usedSet.has(id));
  const pool = remaining.length > 0 ? remaining : FUNNY_SOUND_IDS;
  return pool[Math.floor(Math.random() * pool.length)];
}


const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O for legibility

function generateRoomCode() {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      hostSessionId: z.string().min(8).max(128),
      customPackCode: z.string().trim().min(4).max(12).optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    // Resolve a custom pack, if a code was supplied. Custom rooms always
    // create fresh — they never resume a previous lobby — because the pack
    // binding is fixed at room creation.
    let customPack: { id: string; category_tag: string; title: string } | null = null;
    if (data.customPackCode) {
      const code = data.customPackCode.toUpperCase();
      const { data: p } = await supabaseAdmin
        .from("custom_packs")
        .select("id, category_tag, title, is_active, single_use, used_at, expires_at")
        .eq("pack_code", code)
        .maybeSingle();
      const pp = p as
        | {
            id: string;
            category_tag: string;
            title: string;
            is_active: boolean;
            single_use: boolean;
            used_at: string | null;
            expires_at: string | null;
          }
        | null;
      if (!pp) throw new Error("Custom code not found");
      if (!pp.is_active) throw new Error("This custom code is not active.");
      if (pp.expires_at && new Date(pp.expires_at) < new Date()) throw new Error("This custom code has expired.");
      if (pp.single_use && pp.used_at) throw new Error("This custom code has already been used.");
      customPack = { id: pp.id, category_tag: pp.category_tag, title: pp.title };
    }

    if (!customPack) {
      // Resume an existing non-ended room for this host session, if any.
      const { data: existing } = await supabaseAdmin
        .from("rooms")
        .select("id, room_code")
        .eq("host_session_id", data.hostSessionId)
        .neq("status", "ended")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        await supabaseAdmin
          .from("rooms")
          .update({ host_last_seen_at: new Date().toISOString() })
          .eq("id", existing.id);
        return { id: existing.id, roomCode: existing.room_code, resumed: true, customPack: null };
      }
    }

    // Try up to 5 times to avoid rare code collisions
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateRoomCode();
      const insertPayload: {
        room_code: string;
        host_session_id: string;
        status: string;
        custom_pack_id?: string;
        enabled_categories?: string[];
        difficulty_mode?: string | null;
        current_category?: string;
      } = {
        room_code: code,
        host_session_id: data.hostSessionId,
        status: customPack ? "playing" : "lobby",
      };
      if (customPack) {
        insertPayload.custom_pack_id = customPack.id;
        insertPayload.enabled_categories = [customPack.category_tag];
        insertPayload.difficulty_mode = null;
        insertPayload.current_category = customPack.title;
      }
      const { data: row, error } = await supabaseAdmin
        .from("rooms")
        .insert(insertPayload)
        .select("id, room_code")
        .single();
      if (!error && row) {
        if (customPack) {
          // Mark single-use pack as used so a second code attempt fails.
          await supabaseAdmin
            .from("custom_packs")
            .update({ used_at: new Date().toISOString() })
            .eq("id", customPack.id)
            .is("used_at", null)
            .eq("single_use", true);
        }
        return {
          id: row.id,
          roomCode: row.room_code,
          resumed: false,
          customPack: customPack ? { title: customPack.title } : null,
        };
      }
      if (error && !error.message.toLowerCase().includes("duplicate")) {
        throw new Error(error.message);
      }
    }
    throw new Error("Could not allocate a unique room code, please retry.");
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4).regex(/^[A-Z]+$/),
      nickname: z.string().min(1).max(20),
      sessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: room, error: roomErr } = await supabaseAdmin
      .from("rooms")
      .select("id, status, is_paused, allow_late_joiners")
      .eq("room_code", data.roomCode)
      .maybeSingle();
    if (roomErr) throw new Error(roomErr.message);
    if (!room) throw new Error("Room not found");
    if (room.status === "ended") throw new Error("This game has ended.");

    const { data: existing } = await supabaseAdmin
      .from("players")
      .select("id, score, streak_count, funny_sound_id")
      .eq("room_id", room.id)
      .eq("session_id", data.sessionId)
      .maybeSingle();

    if (existing) {
      // Reconnect: refresh nickname + heartbeat; backfill funny sound if missing.
      let funnySoundId = (existing as { funny_sound_id: string | null }).funny_sound_id;
      if (!funnySoundId) {
        funnySoundId = await assignFunnySoundId(room.id);
        await supabaseAdmin
          .from("players")
          .update({
            nickname: data.nickname,
            last_seen_at: new Date().toISOString(),
            funny_sound_id: funnySoundId,
          })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("players")
          .update({ nickname: data.nickname, last_seen_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
      return { roomId: room.id, playerId: existing.id, resumed: true, funnySoundId };
    }


    if (!room.allow_late_joiners && room.status !== "lobby") {
      throw new Error("This room is no longer accepting new players.");
    }

    // Determine team assignment if team mode is on (balance counts)
    let team: "red" | "blue" | null = null;
    const { data: roomFull } = await supabaseAdmin
      .from("rooms")
      .select("team_mode")
      .eq("id", room.id)
      .maybeSingle();
    if ((roomFull as { team_mode?: boolean } | null)?.team_mode) {
      const { data: existingPlayers } = await supabaseAdmin
        .from("players")
        .select("team")
        .eq("room_id", room.id)
        .eq("is_audience", false);
      const red = (existingPlayers ?? []).filter((p) => (p as { team?: string }).team === "red").length;
      const blue = (existingPlayers ?? []).filter((p) => (p as { team?: string }).team === "blue").length;
      team = red <= blue ? "red" : "blue";
    }

    const funnySoundId = await assignFunnySoundId(room.id);

    const { data: player, error: playerErr } = await supabaseAdmin
      .from("players")
      .insert({
        room_id: room.id,
        nickname: data.nickname,
        session_id: data.sessionId,
        team,
        funny_sound_id: funnySoundId,
      })
      .select("id")
      .single();
    if (playerErr) throw new Error(playerErr.message);
    return { roomId: room.id, playerId: player.id, resumed: false, funnySoundId };

  });

export const toggleTeamMode = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
      enabled: z.boolean(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id")
      .eq("room_code", data.roomCode)
      .eq("host_session_id", data.hostSessionId)
      .maybeSingle();
    if (!room) throw new Error("Room not found");

    await supabaseAdmin
      .from("rooms")
      .update({ team_mode: data.enabled })
      .eq("id", room.id);

    if (data.enabled) {
      // Auto-assign existing non-audience players alternating red/blue.
      // Batched into two `.in()` writes (one per team) instead of one update
      // per player so a large lobby doesn't fan out into N round-trips.
      const { data: players } = await supabaseAdmin
        .from("players")
        .select("id")
        .eq("room_id", room.id)
        .eq("is_audience", false)
        .order("created_at", { ascending: true });
      const list = players ?? [];
      const redIds = list.filter((_, i) => i % 2 === 0).map((p) => p.id);
      const blueIds = list.filter((_, i) => i % 2 === 1).map((p) => p.id);
      if (redIds.length > 0) {
        await supabaseAdmin.from("players").update({ team: "red" }).in("id", redIds);
      }
      if (blueIds.length > 0) {
        await supabaseAdmin.from("players").update({ team: "blue" }).in("id", blueIds);
      }
    } else {
      await supabaseAdmin
        .from("players")
        .update({ team: null })
        .eq("room_id", room.id);
    }
    return { ok: true };
  });


/**
 * Authoritative team standings for a room. The results screen computes these
 * client-side for display, but the host live view and any announcer callout
 * ("Red team pulls ahead!") should read this so everyone agrees on the winner.
 * Winner is decided by average points per player (see team-standings.ts).
 */
export const getTeamStandings = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, team_mode")
      .eq("room_code", data.roomCode)
      .maybeSingle();
    if (!room) throw new Error("Room not found");
    if (!(room as { team_mode?: boolean }).team_mode) {
      return { teamMode: false as const, standings: null };
    }
    const { data: players } = await supabaseAdmin
      .from("players")
      .select("team, score, is_audience")
      .eq("room_id", room.id);
    const standings = computeTeamStandings(
      (players ?? []) as { team: "red" | "blue" | null; score: number; is_audience: boolean }[],
    );
    return { teamMode: true as const, standings };
  });

export const heartbeatPlayer = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      sessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id")
      .eq("room_code", data.roomCode)
      .maybeSingle();
    if (!room) return { ok: false };
    await supabaseAdmin
      .from("players")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("room_id", room.id)
      .eq("session_id", data.sessionId);
    return { ok: true };
  });

export const heartbeatHost = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("rooms")
      .update({
        host_last_seen_at: new Date().toISOString(),
        is_paused: false,
      })
      .eq("room_code", data.roomCode)
      .eq("host_session_id", data.hostSessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const pauseRoom = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    await supabaseAdmin
      .from("rooms")
      .update({ is_paused: true })
      .eq("room_code", data.roomCode)
      .eq("host_session_id", data.hostSessionId);
    return { ok: true };
  });

export const endRoom = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("rooms")
      .update({ status: "ended", phase: "ended" })
      .eq("room_code", data.roomCode)
      .eq("host_session_id", data.hostSessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setCategory = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
      category: z.string().min(1).max(60),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("rooms")
      .update({
        current_category: data.category,
        status: "playing",
        tts_calls_count: 0,
        tts_cap_started_at: new Date().toISOString(),
      })
      .eq("room_code", data.roomCode)
      .eq("host_session_id", data.hostSessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setRoomConfig = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
      theme: z.string().min(1).max(40).optional(),
      allowLateJoiners: z.boolean().optional(),
      isPaused: z.boolean().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const patch: {
      theme?: string;
      allow_late_joiners?: boolean;
      is_paused?: boolean;
    } = {};
    if (data.theme !== undefined) patch.theme = data.theme;
    if (data.allowLateJoiners !== undefined) patch.allow_late_joiners = data.allowLateJoiners;
    if (data.isPaused !== undefined) patch.is_paused = data.isPaused;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("rooms")
      .update(patch)
      .eq("room_code", data.roomCode)
      .eq("host_session_id", data.hostSessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePlayerAvatar = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      sessionId: z.string().min(8).max(128),
      avatarUrl: z.string().url().max(500),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id")
      .eq("room_code", data.roomCode)
      .maybeSingle();
    if (!room) throw new Error("Room not found");
    const { error } = await supabaseAdmin
      .from("players")
      .update({ avatar_url: data.avatarUrl })
      .eq("room_id", room.id)
      .eq("session_id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAudienceMode = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      sessionId: z.string().min(8).max(128),
      isAudience: z.boolean(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id")
      .eq("room_code", data.roomCode)
      .maybeSingle();
    if (!room) throw new Error("Room not found");
    const { error } = await supabaseAdmin
      .from("players")
      .update({ is_audience: data.isAudience })
      .eq("room_id", room.id)
      .eq("session_id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Return all distinct categories that have questions in the DB, with counts.
// Drives the "Surprise Mix" picker in the host lobby.
export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin.rpc("list_question_categories");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ name: string; count: number | string }>;
  return {
    categories: rows
      .map((r) => ({ name: r.name, count: Number(r.count) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
});

// Persist the host's enabled category set onto the room. Pass null/empty to
// mean "all categories" (true Surprise Mix).
export const setEnabledCategories = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
      categories: z.array(z.string().min(1).max(60)).max(64).nullable(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const value = data.categories && data.categories.length > 0 ? data.categories : null;
    const { error } = await supabaseAdmin
      .from("rooms")
      .update({ enabled_categories: value })
      .eq("room_code", data.roomCode)
      .eq("host_session_id", data.hostSessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Lock the whole game to a single difficulty bucket (or null for mixed).
export const setDifficultyMode = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
      mode: z.enum(["easy", "medium", "hard", "impossible"]).nullable(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("rooms")
      .update({ difficulty_mode: data.mode })
      .eq("room_code", data.roomCode)
      .eq("host_session_id", data.hostSessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Persist the host's chosen content rating onto the room so the server
// question fetcher can hard-gate the pool. Defaults to PG-13 on the row.
export const setRoomContentRating = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      roomCode: z.string().length(4),
      hostSessionId: z.string().min(8).max(128),
      rating: z.enum(["pg", "pg13", "ma"]),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("rooms")
      .update({ content_rating: data.rating })
      .eq("room_code", data.roomCode)
      .eq("host_session_id", data.hostSessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


