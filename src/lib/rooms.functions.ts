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
      if (!error && row) return { id: row.id, roomCode: row.room_code };
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
      .select("id, status, is_paused")
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

    const { data: player, error: playerErr } = await supabaseAdmin
      .from("players")
      .insert({
        room_id: room.id,
        nickname: data.nickname,
        session_id: data.sessionId,
      })
      .select("id")
      .single();
    if (playerErr) throw new Error(playerErr.message);
    return { roomId: room.id, playerId: player.id, resumed: false };
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
      .update({ current_category: data.category, status: "playing" })
      .eq("room_code", data.roomCode)
      .eq("host_session_id", data.hostSessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
