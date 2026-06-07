import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "framer-motion";
import { Settings as SettingsIcon, Shuffle, X } from "lucide-react";
import { toast } from "sonner";
import {
  createRoom,
  endRoom,
  heartbeatHost,
  listCategories,
  setEnabledCategories,
  setRoomConfig,
  toggleTeamMode,
} from "@/lib/rooms.functions";
import { setPhase } from "@/lib/game.functions";
import {
  loadHostSession,
  saveHostSession,
  newId,
} from "@/lib/player-session";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, DEFAULT_OFF_CATEGORIES, MIX_CATEGORY, emojiForCategory } from "@/lib/categories";
import { useTheme } from "@/components/ThemeProvider";
import { play, setMuted as setSoundMuted, startMusic, stopMusic, type Sfx } from "@/lib/sound-engine";
import { HostGameStage, useRevealAutoAdvance } from "@/components/host/HostGameStage";
import { useHostStageMode } from "@/hooks/useHostStageMode";
import { useHostHotkeys } from "@/hooks/useHostHotkeys";
import { HowToPlay } from "@/components/HowToPlay";


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
  team: "red" | "blue" | null;
  is_audience: boolean;
};

const HOWTO_KEY = "btd:howto-shown";

const MUTE_KEY = "btd:muted";

const CATEGORIES_KEY = "btd:enabled-categories";

function HostPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { isFullscreen, toggleFullscreen } = useHostStageMode();
  useHostHotkeys(toggleFullscreen);

  const createRoomFn = useServerFn(createRoom);
  const endRoomFn = useServerFn(endRoom);
  const heartbeatFn = useServerFn(heartbeatHost);
  const listCategoriesFn = useServerFn(listCategories);
  const setEnabledCategoriesFn = useServerFn(setEnabledCategories);
  const setConfigFn = useServerFn(setRoomConfig);
  const toggleTeamModeFn = useServerFn(toggleTeamMode);
  const setPhaseFn = useServerFn(setPhase);

  const [room, setRoom] = useState<{ id: string; roomCode: string; hostSessionId: string } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<{ name: string; count: number }[]>([]);
  const [enabledCats, setEnabledCats] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  const [allowLate, setAllowLate] = useState(true);
  const [teamMode, setTeamMode] = useState(false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [origin, setOrigin] = useState("");
  const [roomPhase, setRoomPhase] = useState<string>("lobby");
  const [roundNumber, setRoundNumber] = useState<number>(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
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
          const next = payload.new as {
            phase?: string;
            round_number?: number;
            team_mode?: boolean;
            current_category?: string | null;
          } | undefined;
          if (next?.phase) setRoomPhase(next.phase);
          if (typeof next?.round_number === "number") setRoundNumber(next.round_number);
          if (typeof next?.team_mode === "boolean") setTeamMode(next.team_mode);
          if (next && "current_category" in next) setActiveCategory(next.current_category ?? null);
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

  // Load the master category list once. Hydrate the host's saved enabled set
  // from localStorage (or fall back to "everything except niche defaults").
  // Then push that selection to the freshly-created room so the question
  // picker server-side sees the right filter on the very first round.
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await listCategoriesFn();
        if (cancelled) return;
        // Merge DB categories with hardcoded ones so placeholders (count=0) show.
        const dbMap = new Map(res.categories.map((c) => [c.name, c.count]));
        for (const c of CATEGORIES) {
          if (c.name === MIX_CATEGORY) continue;
          if (!dbMap.has(c.name)) dbMap.set(c.name, 0);
        }
        const merged = Array.from(dbMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const names = merged.filter((c) => c.count > 0).map((c) => c.name);
        setAllCategories(merged);
        let initial: Set<string>;
        try {
          const raw = window.localStorage.getItem(CATEGORIES_KEY);
          if (raw) {
            const arr = JSON.parse(raw) as string[];
            initial = new Set(arr.filter((n) => names.includes(n)));
          } else {
            initial = new Set(names.filter((n) => !DEFAULT_OFF_CATEGORIES.includes(n)));
          }
        } catch {
          initial = new Set(names.filter((n) => !DEFAULT_OFF_CATEGORIES.includes(n)));
        }
        setEnabledCats(initial);
        const all = initial.size === names.length;
        setEnabledCategoriesFn({
          data: {
            roomCode: room.roomCode,
            hostSessionId: room.hostSessionId,
            categories: all ? null : Array.from(initial),
          },
        }).catch(() => {});
      } catch {
        /* ignore — server fn will fall back to "all categories" */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [room?.id]); // eslint-disable-line react-hooks/exhaustive-deps


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
        // Play a random welcome intro once
        const welcomes = res.welcomes ?? [];
        if (welcomes.length > 0) {
          const pick = welcomes[Math.floor(Math.random() * welcomes.length)];
          const audio = new Audio(pick.url);
          audio.volume = Math.min(pick.volume, 0.9);
          audio.play().catch(() => {});
        }
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
      <main className="fixed inset-0 overflow-hidden">
        <HostGameStage room={room} />
        <div className="fixed right-4 top-4 z-50 flex gap-2">
          {!isFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white shadow-lg backdrop-blur transition hover:bg-black/80"
              title="Fullscreen (F)"
            >
              ⛶ Fullscreen
            </button>
          )}
          <button
            onClick={endAndStartNewRoom}
            className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white shadow-lg backdrop-blur transition hover:bg-black/80"
          >
            End · new room
          </button>
        </div>
      </main>
    );
  }



  const livePlayers = players.filter((p) => !p.is_audience);
  const audienceMembers = players.filter((p) => p.is_audience);
  const canStart = !!room && livePlayers.length > 0;
  const availableCategories = allCategories.filter((c) => c.count > 0);
  const mixLabel = enabledCats.size === 0 || enabledCats.size === availableCategories.length
    ? `🎲 Surprise Mix · all ${availableCategories.length || ""} categories`.trim()
    : `🎲 Surprise Mix · ${enabledCats.size} of ${availableCategories.length} on`;

  function persistEnabled(next: Set<string>) {
    setEnabledCats(next);
    try {
      window.localStorage.setItem(CATEGORIES_KEY, JSON.stringify(Array.from(next)));
    } catch {}
    if (room) {
      const all = availableCategories.length > 0 && next.size === availableCategories.length;
      setEnabledCategoriesFn({
        data: {
          roomCode: room.roomCode,
          hostSessionId: room.hostSessionId,
          categories: all ? null : Array.from(next),
        },
      }).catch((e) => toast.error((e as Error).message));
    }
  }

  function toggleCategory(name: string) {
    const next = new Set(enabledCats);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    persistEnabled(next);
  }

  function actuallyStart() {
    if (!room) return;
    play("whoosh");
    setPhaseFn({
      data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId, phase: "intro" },
    }).catch((e) => setError((e as Error).message));
  }

  function handleStartClick() {
    if (!canStart) {
      setSettingsOpen(true);
      return;
    }
    const shown = typeof window !== "undefined" && window.sessionStorage.getItem(HOWTO_KEY) === "1";
    if (shown) {
      actuallyStart();
      return;
    }
    setShowHowTo(true);
  }

  function finishHowTo() {
    setShowHowTo(false);
    try {
      window.sessionStorage.setItem(HOWTO_KEY, "1");
    } catch {}
    actuallyStart();
  }


  return (
    <main
      className="relative h-[100svh] w-full overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(ellipse 90% 60% at 50% 30%, oklch(0.22 0.04 270 / 0.95), oklch(0.06 0.02 270) 80%)",
      }}
    >
      {/* film grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      {/* warm rim glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 110%, oklch(0.55 0.18 60 / 0.35), transparent 60%)",
        }}
      />

      {/* TV-safe wrapper: 3% inset on all sides for overscan + safe areas */}
      <div
        className="relative flex h-full flex-col"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 3svh)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 3svh)",
          paddingLeft: "calc(env(safe-area-inset-left, 0px) + 3vw)",
          paddingRight: "calc(env(safe-area-inset-right, 0px) + 3vw)",
        }}
      >
        {/* TOP BAR */}
        <header className="flex flex-none items-center justify-between gap-3">
          <button
            onClick={() => navigate({ to: "/" })}
            className="text-xs text-white/60 hover:text-white"
          >
            ← Home
          </button>
          <div className="font-display text-base font-black tracking-tight text-white/90">
            Beat the{" "}
            <span className="bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
              Drop
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isFullscreen && (
              <button
                onClick={toggleFullscreen}
                className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-widest text-white/70 backdrop-blur hover:bg-white/10"
                title="Fullscreen (F)"
              >
                ⛶
              </button>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-widest text-white/70 backdrop-blur hover:bg-white/10"
              title="Settings"
            >
              <SettingsIcon className="h-3 w-3" /> Settings
            </button>
            <Link to="/admin" className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-widest text-white/70 backdrop-blur hover:bg-white/10">
              Admin
            </Link>
          </div>
        </header>

        {error && (
          <div className="mt-3 flex-none rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {/* HERO — join + room code + QR (fills the middle, no scroll) */}
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[2svh] text-center">
          <div className="text-[clamp(0.7rem,1.6svh,1rem)] font-bold uppercase tracking-[0.5em] text-amber-200/80">
            Game PIN
          </div>


          <div className="bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text font-mono text-[clamp(4rem,22svh,12rem)] font-black leading-none tracking-[0.12em] text-transparent drop-shadow-[0_8px_30px_rgba(251,191,36,0.35)]">
            {creating || !room ? "····" : room.roomCode}
          </div>

          {joinUrl && (
            <div
              className="inline-block rounded-xl bg-white p-[1svh] shadow-[0_0_40px_oklch(0.85_0.18_85/0.32)] ring-1 ring-white/20"
              style={{ width: "clamp(140px, 28svh, 240px)", height: "clamp(140px, 28svh, 240px)" }}
            >
              <QRCodeSVG value={joinUrl} size={256} level="M" includeMargin={false} style={{ width: "100%", height: "100%" }} />
            </div>
          )}

          {activeCategory && (
            <div className="text-[clamp(0.7rem,1.4svh,0.95rem)] text-white/60">
              Category: <span className="font-semibold text-amber-200">{activeCategory}</span>
            </div>
          )}
        </section>

        {/* PLAYER ROW */}
        <section className="flex flex-none flex-col items-center gap-[1.5svh]">
          <div className="flex items-center gap-4 text-[clamp(0.65rem,1.3svh,0.85rem)] font-bold uppercase tracking-[0.35em] text-white/60">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              {livePlayers.length} {livePlayers.length === 1 ? "player" : "players"}
            </span>
            {audienceMembers.length > 0 && (
              <span className="flex items-center gap-2 text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {audienceMembers.length} audience
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2" style={{ maxHeight: "12svh", overflow: "hidden" }}>
            <AnimatePresence>
              {livePlayers.length === 0 ? (
                <div className="text-[clamp(0.75rem,1.6svh,1rem)] text-white/50">
                  Waiting for players…
                </div>
              ) : (
                livePlayers.map((p) => {
                  const ring =
                    p.team === "red"
                      ? "ring-rose-400/60"
                      : p.team === "blue"
                        ? "ring-sky-400/60"
                        : "ring-white/20";
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.25 }}
                      className={`flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] py-1 pl-1 pr-3 backdrop-blur ring-1 ${ring}`}
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
                        {p.nickname.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="text-[clamp(0.75rem,1.5svh,0.95rem)] font-medium text-white">
                        {p.nickname}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>

          <motion.button
            data-host-primary={canStart ? "true" : undefined}
            animate={canStart ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={
              canStart
                ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.2 }
            }
            onClick={handleStartClick}
            className={`rounded-2xl px-[clamp(1.5rem,4vw,3rem)] py-[clamp(0.6rem,1.8svh,1rem)] text-[clamp(1rem,2.4svh,1.5rem)] font-black uppercase tracking-wider shadow-lg transition ${
              canStart
                ? "bg-gradient-to-b from-amber-300 to-amber-500 text-black shadow-[0_0_60px_oklch(0.85_0.18_85/0.45)] hover:brightness-110"
                : "border border-white/15 bg-white/[0.06] text-white/70 hover:bg-white/10"
            }`}
          >
            {canStart
              ? "▶ Press OK to start the show"
              : "Waiting for players…"}
          </motion.button>

          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-[clamp(0.65rem,1.2svh,0.8rem)] font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur transition hover:bg-white/10 hover:text-amber-200"
          >
            <Shuffle className="h-3.5 w-3.5" />
            {mixLabel}
          </button>



          <div className="text-[clamp(0.55rem,1.1svh,0.7rem)] uppercase tracking-[0.3em] text-white/30">
            <kbd className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 font-mono normal-case tracking-normal">F</kbd> fullscreen ·{" "}
            <kbd className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 font-mono normal-case tracking-normal">Enter</kbd> start ·{" "}
            <kbd className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 font-mono normal-case tracking-normal">Space</kbd> pause
          </div>
          <LobbyTipCarousel />
        </section>
      </div>

      {/* SETTINGS SHEET — slide-in from right */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettingsOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 z-50 flex h-[100svh] w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-[oklch(0.10_0.02_270)] p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Settings</h2>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
                  aria-label="Close settings"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-amber-200/80">
                    Categories
                  </h3>
                  <div className="flex gap-2 text-[10px] uppercase tracking-widest">
                    <button
                      onClick={() => persistEnabled(new Set(availableCategories.map((c) => c.name)))}
                      className="text-white/60 hover:text-amber-200"
                    >
                      All
                    </button>
                    <span className="text-white/20">·</span>
                    <button
                      onClick={() => persistEnabled(new Set())}
                      className="text-white/60 hover:text-amber-200"
                    >
                      None
                    </button>
                  </div>
                </div>
                <p className="mb-2 text-[11px] leading-snug text-white/50">
                  Questions are pulled at random from whatever's checked. Leave them all on for the full Surprise Mix.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {allCategories.length === 0 ? (
                    <div className="col-span-2 rounded-lg border border-dashed border-white/10 p-3 text-xs text-white/40">
                      Loading categories…
                    </div>
                  ) : (
                    allCategories.map((c) => {
                      const checked = enabledCats.has(c.name);
                      const empty = c.count === 0;
                      return (
                        <button
                          key={c.name}
                          onClick={() => { if (!empty) toggleCategory(c.name); }}
                          disabled={empty}
                          title={empty ? "No questions in this category yet. Add some on /admin." : undefined}
                          className={`relative flex items-center gap-2 rounded-lg border p-2 text-left transition ${
                            empty
                              ? "cursor-not-allowed border-white/5 bg-white/[0.02] text-white/30"
                              : checked
                                ? "border-amber-300/60 bg-amber-300/15 text-amber-100"
                                : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10"
                          }`}
                        >
                          <span className="text-lg leading-none">{emojiForCategory(c.name)}</span>
                          <span className="flex-1 text-xs font-semibold leading-tight">{c.name}</span>
                          <span className="text-[10px] text-white/40">{empty ? "empty" : c.count}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>


              <div className="mb-5">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-200/80">
                  Game options
                </h3>
                <div className="flex flex-col gap-2 text-sm text-white/80">
                  <Toggle label="Allow late joiners" on={allowLate} onChange={setAllowLate} />
                  <Toggle
                    label="Team mode (red vs blue)"
                    on={teamMode}
                    onChange={(next) => {
                      setTeamMode(next);
                      if (room) {
                        toggleTeamModeFn({
                          data: {
                            roomCode: room.roomCode,
                            hostSessionId: room.hostSessionId,
                            enabled: next,
                          },
                        }).catch((e) => toast.error((e as Error).message));
                      }
                    }}
                  />
                  <Toggle label="Mute audio" on={muted} onChange={toggleMute} />
                </div>
              </div>


              <div className="mt-auto rounded-lg border border-dashed border-white/15 p-3 text-xs text-white/60">
                Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/80">Space</kbd> to {paused ? "resume" : "pause"} · <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/80">Enter</kbd> to start
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>



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

      {showHowTo && <HowToPlay onComplete={finishHowTo} />}


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
    .select("id, nickname, score, avatar_url, team, is_audience")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Player[];
}




const LOBBY_HOST_TIPS = [
  "Phones out. Thumbs warm.",
  "Lock fast. Points decay every tick.",
  "Streaks pay. Three in a row and the room hears it.",
  "Wrong is loud. Right is louder.",
  "The final round can flip the whole game.",
  "No phones in your pocket. Trust your gut.",
];

function LobbyTipCarousel() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % LOBBY_HOST_TIPS.length), 4200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="mt-[1svh] h-[3svh] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
          className="text-center text-[clamp(0.75rem,1.5svh,1rem)] italic text-white/50"
        >
          "{LOBBY_HOST_TIPS[idx]}"
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

