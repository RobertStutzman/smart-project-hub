import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
    }).parse,
  )
  .handler(async ({ data }) => {
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
      // Refresh heartbeat so the room isn't considered abandoned.
      await supabaseAdmin
        .from("rooms")
        .update({ host_last_seen_at: new Date().toISOString() })
        .eq("id", existing.id);
      return { id: existing.id, roomCode: existing.room_code, resumed: true };
    }

    // Try up to 5 times to avoid rare code collisions
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateRoomCode();
      const { data: row, error } = await supabaseAdmin
        .from("rooms")
        .insert({
          room_code: code,
          host_session_id: data.hostSessionId,
          status: "lobby",
        })
        .select("id, room_code")
        .single();
      if (!error && row) return { id: row.id, roomCode: row.room_code, resumed: false };
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
      .select("id, score, streak_count")
      .eq("room_id", room.id)
      .eq("session_id", data.sessionId)
      .maybeSingle();

    if (existing) {
      // Reconnect: just refresh nickname + heartbeat
      await supabaseAdmin
        .from("players")
        .update({ nickname: data.nickname, last_seen_at: new Date().toISOString() })
        .eq("id", existing.id);
      return { roomId: room.id, playerId: existing.id, resumed: true };
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

    const { data: player, error: playerErr } = await supabaseAdmin
      .from("players")
      .insert({
        room_id: room.id,
        nickname: data.nickname,
        session_id: data.sessionId,
        team,
      })
      .select("id")
      .single();
    if (playerErr) throw new Error(playerErr.message);
    return { roomId: room.id, playerId: player.id, resumed: false };
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
      // Auto-assign existing non-audience players alternating red/blue
      const { data: players } = await supabaseAdmin
        .from("players")
        .select("id")
        .eq("room_id", room.id)
        .eq("is_audience", false)
        .order("created_at", { ascending: true });
      for (let i = 0; i < (players ?? []).length; i++) {
        await supabaseAdmin
          .from("players")
          .update({ team: i % 2 === 0 ? "red" : "blue" })
          .eq("id", (players ?? [])[i].id);
      }
    } else {
      await supabaseAdmin
        .from("players")
        .update({ team: null })
        .eq("room_id", room.id);
    }
    return { ok: true };
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
