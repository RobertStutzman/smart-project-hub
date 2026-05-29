import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createRoom, heartbeatHost, setCategory } from "@/lib/rooms.functions";
import {
  loadHostSession,
  saveHostSession,
  newId,
} from "@/lib/player-session";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type Category } from "@/lib/categories";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/host")({
  head: () => ({
    meta: [
      { title: "Host — Beat the Drop Trivia" },
      { name: "description", content: "Display the game room code on your TV and start the round." },
      { property: "og:title", content: "Host — Beat the Drop Trivia" },
      { property: "og:description", content: "Run trivia night from the big screen." },
    ],
  }),
  component: HostPage,
});

type Player = {
  id: string;
  nickname: string;
  score: number;
  avatar_url: string | null;
};

function HostPage() {
  const navigate = useNavigate();
  const createRoomFn = useServerFn(createRoom);
  const heartbeatFn = useServerFn(heartbeatHost);
  const setCategoryFn = useServerFn(setCategory);

  const [room, setRoom] = useState<{ id: string; roomCode: string; hostSessionId: string } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState<Category | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const initRef = useRef(false);

  // Auto-create or resume room on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void (async () => {
      const existing = loadHostSession();
      try {
        setCreating(true);
        const hostSessionId = existing?.sessionId ?? newId();
        const res = await createRoomFn({ data: { hostSessionId } });
        saveHostSession({ sessionId: hostSessionId, roomCode: res.roomCode });
        setRoom({ ...res, hostSessionId });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setCreating(false);
      }
    })();
  }, [createRoomFn]);

  // Realtime players + host heartbeat
  useEffect(() => {
    if (!room) return;
    void loadPlayers(room.id).then(setPlayers);

    const channel = supabase
      .channel(`room-${room.id}-players`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` },
        () => {
          void loadPlayers(room.id).then(setPlayers);
        },
      )
      .subscribe();

    const interval = setInterval(() => {
      heartbeatFn({ data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId } }).catch(
        () => {},
      );
    }, 5000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [room, heartbeatFn]);

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined" || !room) return "";
    return `${window.location.origin}/join?code=${room.roomCode}`;
  }, [room]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 p-8">
        <header className="flex items-center justify-between">
          <button
            onClick={() => navigate({ to: "/" })}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Home
          </button>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Host view</div>
        </header>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
            {error}
          </div>
        )}

        <section className="grid flex-1 gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card/40 p-10 text-center backdrop-blur">
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Room code</div>
            <div className="mt-4 font-mono text-[clamp(4rem,15vw,12rem)] font-black leading-none tracking-[0.1em]">
              {creating || !room ? "····" : room.roomCode}
            </div>
            <div className="mt-6 text-sm text-muted-foreground">
              Go to <span className="font-mono text-foreground">{typeof window !== "undefined" ? window.location.host : ""}/join</span>
            </div>
            {joinUrl && (
              <img
                alt="Join QR"
                className="mt-6 rounded-xl bg-white p-2"
                width={180}
                height={180}
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(joinUrl)}`}
              />
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-xl font-bold">Players</h2>
                <span className="text-sm text-muted-foreground">{players.length} in lobby</span>
              </div>
              {players.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                  Waiting for players to join…
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-2">
                  {players.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm"
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400 text-xs font-bold text-background">
                        {p.nickname.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="truncate font-medium">{p.nickname}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
              <h2 className="mb-4 text-xl font-bold">Pick a category</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIES.map((c) => {
                  const isActive = c.name === activeCategory;
                  return (
                    <button
                      key={c.name}
                      onClick={() => {
                        if (c.isPremium) {
                          setShowPaywall(c);
                          return;
                        }
                        if (!room) return;
                        setActiveCategory(c.name);
                        setCategoryFn({
                          data: {
                            roomCode: room.roomCode,
                            hostSessionId: room.hostSessionId,
                            category: c.name,
                          },
                        }).catch((e) => setError((e as Error).message));
                      }}
                      className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                        isActive
                          ? "border-foreground bg-foreground/10"
                          : "border-border bg-background/40 hover:bg-background/70"
                      }`}
                    >
                      <span className="text-2xl">{c.emoji}</span>
                      <span className="text-sm font-semibold">{c.name}</span>
                      {c.isPremium && (
                        <Lock className="absolute right-2 top-2 h-3.5 w-3.5 text-amber-300" />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Gameplay rolls out in Phase 2. Pick a category to broadcast it to all players.
              </p>
            </div>
          </div>
        </section>
      </div>

      {showPaywall && (
        <PaywallModal category={showPaywall} onClose={() => setShowPaywall(null)} />
      )}
    </main>
  );
}

async function loadPlayers(roomId: string): Promise<Player[]> {
  const { data } = await supabase
    .from("players")
    .select("id, nickname, score, avatar_url")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

function PaywallModal({ category, onClose }: { category: Category; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center"
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-300/20 text-3xl">
          {category.emoji}
        </div>
        <h3 className="mt-4 text-2xl font-bold">{category.name} is premium</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Premium categories unlock in Phase 3. For now, try Music, Movies, or General Knowledge.
        </p>
        <button
          onClick={onClose}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
