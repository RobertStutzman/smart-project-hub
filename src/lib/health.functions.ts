import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

export const getCapacityHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Active lobbies = rooms not ended and host pinged in last 10 min
    const { data: activeRooms, error: roomsErr } = await supabaseAdmin
      .from("rooms")
      .select("id")
      .neq("status", "ended")
      .gte("host_last_seen_at", tenMinAgo);
    if (roomsErr) throw new Error(roomsErr.message);

    const activeLobbies = activeRooms?.length ?? 0;
    const roomIds = (activeRooms ?? []).map((r) => r.id);

    let livePlayers = 0;
    if (roomIds.length > 0) {
      const { count, error: playersErr } = await supabaseAdmin
        .from("players")
        .select("id", { count: "exact", head: true })
        .in("room_id", roomIds)
        .eq("is_audience", false);
      if (playersErr) throw new Error(playersErr.message);
      livePlayers = count ?? 0;
    }

    const { count: totalQuestions } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true });

    return {
      timestamp: new Date().toISOString(),
      activeLobbies,
      livePlayers,
      totalQuestions: totalQuestions ?? 0,
    };
  });
