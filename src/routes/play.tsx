import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { heartbeatPlayer } from "@/lib/rooms.functions";
import { loadPlayerSession, clearPlayerSession } from "@/lib/player-session";
import { supabase } from "@/integrations/supabase/client";
import { useWakeLock } from "@/hooks/use-wake-lock";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Playing — Beat the Drop Trivia" },
      { name: "description", content: "Your mobile controller for the trivia round." },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
  component: PlayPage,
});

type RoomState = {
  id: string;
  status: string;
  current_category: string | null;
  is_paused: boolean;
  host_last_seen_at: string;
};

type Me = {
  id: string;
  nickname: string;
  score: number;
  streak_count: number;
};

function PlayPage() {
  const navigate = useNavigate();
  const heartbeatFn = useServerFn(heartbeatPlayer);
  useWakeLock(true);

  const [session, setSession] = useState<ReturnType<typeof loadPlayerSession>>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Load session
  useEffect(() => {
    const s = loadPlayerSession();
    if (!s) {
      navigate({ to: "/join" });
      return;
    }
    setSession(s);
  }, [navigate]);

  // Subscribe to room + me
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const fetchAll = async () => {
      const { data: r } = await supabase
        .from("rooms")
        .select("id, status, current_category, is_paused, host_last_seen_at")
        .eq("room_code", session.roomCode)
        .maybeSingle();
      if (cancelled) return;
      if (!r) {
        clearPlayerSession();
        navigate({ to: "/join" });
        return;
      }
      setRoom(r);
      const { data: p } = await supabase
        .from("players")
        .select("id, nickname, score, streak_count")
        .eq("room_id", r.id)
        .eq("session_id", session.sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (p) setMe(p);
    };

    void fetchAll();

    const channel = supabase
      .channel(`play-${session.roomCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `room_code=eq.${session.roomCode}` },
        (payload) => {
          if (payload.new) setRoom(payload.new as RoomState);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "players" },
        (payload) => {
          const next = payload.new as Me & { session_id: string };
          if (next.session_id === session.sessionId) setMe(next);
        },
      )
      .subscribe();

    const heartbeat = setInterval(() => {
      heartbeatFn({
        data: { roomCode: session.roomCode, sessionId: session.sessionId },
      }).catch(() => {});
    }, 15000);

    const tick = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      clearInterval(heartbeat);
      clearInterval(tick);
    };
  }, [session, heartbeatFn, navigate]);

  if (!session || !room) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        Loading…
      </main>
    );
  }

  const hostStale = now - new Date(room.host_last_seen_at).getTime() > 15000;
  const paused = room.is_paused || hostStale;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(0.45_0.25_295/0.3),transparent_60%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
        <header className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-muted-foreground">
          <span>Room {session.roomCode}</span>
          <button
            onClick={() => {
              clearPlayerSession();
              navigate({ to: "/" });
            }}
            className="hover:text-foreground"
          >
            Leave
          </button>
        </header>

        <div className="rounded-3xl border border-border bg-card/50 p-5 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">You</div>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div className="text-2xl font-bold">{me?.nickname ?? session.nickname}</div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Score</div>
              <div className="font-mono text-3xl font-black">{me?.score ?? 0}</div>
            </div>
          </div>
          {(me?.streak_count ?? 0) > 1 && (
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-300">
              🔥 {me?.streak_count} streak
            </div>
          )}
        </div>

        <div className="flex-1 rounded-3xl border border-border bg-card/30 p-6 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Category</div>
          <div className="mt-2 text-xl font-semibold">
            {room.current_category ?? "Waiting for the host…"}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Gameplay arrives in Phase 2. Keep this screen open — your phone is staying awake.
          </p>
        </div>
      </div>

      {paused && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/90 p-6 backdrop-blur">
          <div className="max-w-sm text-center">
            <div className="mx-auto grid h-14 w-14 animate-pulse place-items-center rounded-2xl bg-destructive/15 text-2xl">
              ⏸
            </div>
            <h3 className="mt-4 text-2xl font-bold">Host disconnected</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Waiting to resume… your score and place are saved.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
