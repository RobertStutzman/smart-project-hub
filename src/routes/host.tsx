import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { createRoom, endRoom, heartbeatHost, setCategory, setRoomConfig } from "@/lib/rooms.functions";
import { nextQuestion } from "@/lib/game.functions";
import {
  loadHostSession,
  saveHostSession,
  newId,
} from "@/lib/player-session";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type Category } from "@/lib/categories";
import { THEMES, THEME_META, type ThemeName } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";
import { play, setMuted as setSoundMuted, startMusic, stopMusic, type Sfx } from "@/lib/sound-engine";
import { HostGameStage, useRevealAutoAdvance } from "@/components/host/HostGameStage";

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

const MUTE_KEY = "btd:muted";

function HostPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const createRoomFn = useServerFn(createRoom);
  const endRoomFn = useServerFn(endRoom);
  const heartbeatFn = useServerFn(heartbeatHost);
  const setCategoryFn = useServerFn(setCategory);
  const setConfigFn = useServerFn(setRoomConfig);
  const nextQuestionFn = useServerFn(nextQuestion);

  const [room, setRoom] = useState<{ id: string; roomCode: string; hostSessionId: string } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState<Category | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [allowLate, setAllowLate] = useState(true);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [origin, setOrigin] = useState("");
  const [roomPhase, setRoomPhase] = useState<string>("lobby");
  const [roundNumber, setRoundNumber] = useState<number>(0);
  const initRef = useRef(false);

  // Hydration-safe origin + persisted mute pref
  useEffect(() => {
    setOrigin(window.location.host);
    setMuted(window.localStorage.getItem(MUTE_KEY) === "1");
  }, []);

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
        setRoom({ id: res.id, roomCode: res.roomCode, hostSessionId });
        if (res.resumed) toast.success(`Resumed room ${res.roomCode}`);
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          const next = payload.new as { phase?: string; round_number?: number } | undefined;
          if (next?.phase) setRoomPhase(next.phase);
          if (typeof next?.round_number === "number") setRoundNumber(next.round_number);
        },
      )
      .subscribe();

    const interval = setInterval(() => {
      if (paused) return;
      heartbeatFn({ data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId } }).catch(
        () => {},
      );
    }, 5000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [room, heartbeatFn, paused]);

  // Spacebar pause toggle
  useEffect(() => {
    if (!room) return;
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      e.preventDefault();
      setPaused((p) => {
        const next = !p;
        const r = room;
        if (r) {
          setConfigFn({
            data: {
              roomCode: r.roomCode,
              hostSessionId: r.hostSessionId,
              isPaused: next,
            },
          }).catch(() => {});
        }
        return next;
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [room, setConfigFn]);

  // Push theme/late-joiner config to room
  useEffect(() => {
    if (!room) return;
    setConfigFn({
      data: {
        roomCode: room.roomCode,
        hostSessionId: room.hostSessionId,
        theme,
        allowLateJoiners: allowLate,
      },
    }).catch(() => {});
  }, [theme, allowLate, room, setConfigFn]);

  // Apply mute to sound engine + drive lobby music on host TV
  useEffect(() => {
    setSoundMuted(muted);
  }, [muted]);

  // Notify parent window (dev playground) of the room code.
  useEffect(() => {
    if (!room) return;
    try {
      window.parent?.postMessage(
        { type: "host:room", code: room.roomCode, id: room.id },
        "*",
      );
    } catch {}
  }, [room?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for "new room" reset request from parent (dev playground)
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const data = e.data as { type?: string } | null;
      if (data?.type !== "parent:new-room") return;
      void (async () => {
        try {
          setCreating(true);
          const hostSessionId = newId();
          const res = await createRoomFn({ data: { hostSessionId } });
          saveHostSession({ sessionId: hostSessionId, roomCode: res.roomCode });
          setPlayers([]);
          setRoom({ id: res.id, roomCode: res.roomCode, hostSessionId });
          toast.success(`New room ${res.roomCode}`);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setCreating(false);
        }
      })();
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [createRoomFn]);

  useEffect(() => {
    if (!room) return;
    // Load soundboard clips once, then start lobby music.
    let cancelled = false;
    void (async () => {
      try {
        const { getActiveSounds } = await import("@/lib/sounds.functions");
        const res = await getActiveSounds();
        if (cancelled) return;
        const { loadCustomEvents } = await import("@/lib/sound-engine");
        loadCustomEvents(res.events as never);
      } catch {
        /* ignore — fall back to synth */
      } finally {
        if (!cancelled) startMusic("lobby", 600);
      }
    })();
    return () => {
      cancelled = true;
      stopMusic();
    };
  }, [room?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to audience soundboard broadcasts → play SFX from TV speakers
  useEffect(() => {
    if (!room) return;
    const channel = supabase
      .channel(`sfx-${room.roomCode}`)
      .on("broadcast", { event: "sfx" }, (msg) => {
        const sfx = (msg.payload as { sfx?: Sfx } | undefined)?.sfx;
        if (sfx) play(sfx);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room]);

  const joinUrl = useMemo(() => {
    if (!origin || !room) return "";
    return `${window.location.origin}/join?code=${room.roomCode}`;
  }, [room, origin]);

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      toast.success(next ? "Audio muted" : "Audio enabled");
      return next;
    });
  }

  useRevealAutoAdvance(room?.roomCode ?? "", room?.hostSessionId ?? "", roomPhase, roundNumber);

  async function endAndStartNewRoom() {
    if (!room) return;
    if (!window.confirm("End this game and start a fresh room?")) return;
    try {
      setCreating(true);
      await endRoomFn({
        data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
      }).catch(() => undefined);
      const hostSessionId = newId();
      const res = await createRoomFn({ data: { hostSessionId } });
      saveHostSession({ sessionId: hostSessionId, roomCode: res.roomCode });
      setPlayers([]);
      setRoomPhase("lobby");
      setRoundNumber(0);
      setActiveCategory(null);
      setRoom({ id: res.id, roomCode: res.roomCode, hostSessionId });
      toast.success(`New room ${res.roomCode}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (room && roomPhase !== "lobby") {
    return (
      <main className="relative min-h-screen">
        <HostGameStage room={room} />
        <button
          onClick={endAndStartNewRoom}
          className="fixed right-4 top-4 z-50 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white shadow-lg backdrop-blur transition hover:bg-black/80"
        >
          End game · new room
        </button>
      </main>
    );
  }


  return (
    <main className="relative min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-6 lg:p-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => navigate({ to: "/" })}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Home
          </button>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            <span>Host view</span>
            <Link to="/admin" className="rounded-full border border-border px-3 py-1 text-[10px] hover:bg-card/60">
              Admin
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            {error}
          </div>
        )}

        <section className="grid flex-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
          {/* LEFT — brand + room code + QR */}
          <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card/40 p-8 text-center backdrop-blur">
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Beat the Drop
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Join from your phone — winner takes all.
            </p>

            <div className="mt-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Room code
            </div>
            <div className="mt-2 font-mono text-[clamp(4rem,14vw,10rem)] font-black leading-none tracking-[0.15em]">
              {creating || !room ? "····" : room.roomCode}
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              Go to{" "}
              <span className="font-mono text-foreground">
                {origin ? `${origin}/join` : "/join"}
              </span>
            </div>

            {joinUrl && (
              <div className="mt-5 rounded-2xl bg-white p-3">
                <QRCodeSVG value={joinUrl} size={180} level="M" includeMargin={false} />
              </div>
            )}
          </div>

          {/* RIGHT — players + controls */}
          <div className="flex flex-col gap-5">
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
                  <AnimatePresence>
                    {players.map((p) => (
                      <motion.li
                        key={p.id}
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
                          {p.nickname.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="truncate font-medium">{p.nickname}</span>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            <div className="rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
              <h2 className="mb-3 text-lg font-bold">Host controls</h2>
              <div className="flex flex-col gap-3 text-sm">
                <Toggle
                  label="Allow late joiners"
                  on={allowLate}
                  onChange={setAllowLate}
                />
                <Toggle label="Mute audio" on={muted} onChange={toggleMute} />
                <div className="flex items-center justify-between">
                  <span>Theme</span>
                  <div className="flex gap-1">
                    {THEMES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTheme(t as ThemeName)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          theme === t
                            ? "border-foreground bg-foreground/10"
                            : "border-border hover:bg-background/60"
                        }`}
                      >
                        {THEME_META[t as ThemeName].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between rounded-xl border border-dashed border-border/60 p-2 text-xs text-muted-foreground">
                  Press <kbd className="rounded bg-background/60 px-2 py-0.5 font-mono">Space</kbd> to {paused ? "resume" : "pause"}
                  {paused ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
              <h2 className="mb-3 text-lg font-bold">Pick a category</h2>
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
                        <Lock className="absolute right-2 top-2 h-3.5 w-3.5 text-accent" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => {
                if (!room || !activeCategory || players.length === 0) return;
                play("whoosh");
                nextQuestionFn({
                  data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
                }).catch((e) => setError((e as Error).message));
              }}
              disabled={!room || !activeCategory || players.length === 0}
              className="rounded-2xl bg-primary px-6 py-5 text-xl font-bold text-primary-foreground shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ▶ Start game
            </button>
            {(!activeCategory || players.length === 0) && (
              <div className="text-center text-xs text-muted-foreground">
                {players.length === 0 && "Waiting for at least one player. "}
                {!activeCategory && "Pick a category to begin."}
              </div>
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {paused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 grid place-items-center bg-background/85 backdrop-blur"
          >
            <div className="text-center">
              <div className="font-display text-7xl font-black">Paused</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Press <kbd className="rounded bg-background/60 px-2 py-0.5 font-mono">Space</kbd> to resume
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showPaywall && (
        <PaywallModal category={showPaywall} onClose={() => setShowPaywall(null)} />
      )}
    </main>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2"
    >
      <span>{label}</span>
      <span
        className={`relative inline-block h-5 w-9 rounded-full transition ${
          on ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all ${
            on ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
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
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent/20 text-3xl">
          {category.emoji}
        </div>
        <h3 className="mt-4 text-2xl font-bold">{category.name} is premium</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Premium categories unlock in Phase 3. For now, try Music, Movies, or General Knowledge.
        </p>
        <button
          onClick={onClose}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
