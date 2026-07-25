import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  setDifficultyMode,
  setEnabledCategories,
  setRoomConfig,
  toggleTeamMode,
} from "@/lib/rooms.functions";

import { restartGame, setPhase } from "@/lib/game.functions";
import {
  loadHostSession,
  saveHostSession,
  newId,
} from "@/lib/player-session";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, MIX_CATEGORY, emojiForCategory, mergedDefaultOffCategories } from "@/lib/categories";
import { useTheme } from "@/components/ThemeProvider";
import { play, setMuted as setSoundMuted, startMusic, stopMusic, type Sfx } from "@/lib/sound-engine";
import { HostGameStage, useRevealAutoAdvance } from "@/components/host/HostGameStage";
import { Chyron } from "@/components/host/Chyron";
import { AchievementToast } from "@/components/host/AchievementToast";
import { InstantReplay } from "@/components/host/InstantReplay";


import { AudienceFeed } from "@/components/host/AudienceFeed";
import { useHostStageMode } from "@/hooks/useHostStageMode";
import { useHostHotkeys } from "@/hooks/useHostHotkeys";

import { useWakeLock } from "@/hooks/use-wake-lock";
import {
  isAdultMode,
  getContentRating,
  setContentRating,
  subscribeContentRating,
  clearAdultMode,
  type ContentRating,
} from "@/lib/adult-mode";


export const Route = createFileRoute("/host")({
  validateSearch: (s: Record<string, unknown>) => ({
    code: typeof s.code === "string" ? s.code.trim().toUpperCase().slice(0, 12) : undefined,
  }),
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



const MUTE_KEY = "btd:muted";

const CATEGORIES_KEY = "btd:enabled-categories:v2";

const PUBLIC_PLAYER_ORIGIN = "https://droptrivia.app";

function getPlayerJoinOrigin() {
  if (typeof window === "undefined") return PUBLIC_PLAYER_ORIGIN;
  const { hostname, origin } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return origin;
  if (hostname === "droptrivia.app" || hostname === "www.droptrivia.app") return origin;
  return PUBLIC_PLAYER_ORIGIN;
}


function HostPage() {
  const navigate = useNavigate();
  const { code: customPackCode } = Route.useSearch();
  const { theme } = useTheme();
  const { isFullscreen, toggleFullscreen } = useHostStageMode();
  useHostHotkeys(toggleFullscreen);
  useWakeLock(true);

  const createRoomFn = useServerFn(createRoom);
  const endRoomFn = useServerFn(endRoom);
  const heartbeatFn = useServerFn(heartbeatHost);
  const listCategoriesFn = useServerFn(listCategories);
  const setEnabledCategoriesFn = useServerFn(setEnabledCategories);
  const setDifficultyModeFn = useServerFn(setDifficultyMode);

  const setConfigFn = useServerFn(setRoomConfig);
  const toggleTeamModeFn = useServerFn(toggleTeamMode);
  const setPhaseFn = useServerFn(setPhase);
  const restartGameFn = useServerFn(restartGame);

  const [room, setRoom] = useState<{ id: string; roomCode: string; hostSessionId: string } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<{ name: string; count: number }[]>([]);
  const [enabledCats, setEnabledCats] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  type DifficultyMode = "easy" | "medium" | "hard" | "impossible" | null;
  const [difficultyMode, setDifficultyModeState] = useState<DifficultyMode>(null);

  
  const [allowLate, setAllowLate] = useState(true);
  const [teamMode, setTeamMode] = useState(false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [origin, setOrigin] = useState("");
  const [roomPhase, setRoomPhase] = useState<string>("lobby");
  const [roundNumber, setRoundNumber] = useState<number>(0);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [hasExplanationTts, setHasExplanationTts] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customPackTitle, setCustomPackTitle] = useState<string | null>(null);
  const [rating, setRatingState] = useState<ContentRating | null>(null);
  const [maConfirmOpen, setMaConfirmOpen] = useState(false);
  const [maAgeOk, setMaAgeOk] = useState(false);
  const [maTosOk, setMaTosOk] = useState(false);

  // On lobby mount, force-clear any stale MA rating from a previous game.
  // Every new game requires an explicit rating pick so adult content can
  // never leak into a family session that inherited a flag.
  useEffect(() => {
    clearAdultMode();
    setRatingState(null);
    const unsub = subscribeContentRating((r) => setRatingState(r));
    return () => { unsub(); };
  }, []);
  
  
  
  const initRef = useRef(false);
  const playersRef = useRef<Player[]>([]);
  const pausedRef = useRef(false);
  useEffect(() => {
    playersRef.current = players;
  }, [players]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Hydration-safe origin + persisted mute pref
  useEffect(() => {
    setOrigin(window.location.host);
    setMuted(window.localStorage.getItem(MUTE_KEY) === "1");
  }, []);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  // Auto-create or resume room on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void (async () => {
      const existing = loadHostSession();
      try {
        setCreating(true);
        // Custom pack code: always start a fresh host session so we don't
        // accidentally resume an unrelated lobby.
        const hostSessionId = customPackCode ? newId() : (existing?.sessionId ?? newId());
        const res = await createRoomFn({
          data: customPackCode
            ? { hostSessionId, customPackCode }
            : { hostSessionId },
        });
        saveHostSession({ sessionId: hostSessionId, roomCode: res.roomCode });
        setRoom({ id: res.id, roomCode: res.roomCode, hostSessionId });
        if (res.customPack?.title) {
          setCustomPackTitle(res.customPack.title);
          toast.success(`Loaded custom pack: ${res.customPack.title}`);
        } else if (res.resumed) {
          toast.success(`Resumed room ${res.roomCode}`);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setCreating(false);
      }
    })();
  }, [createRoomFn, customPackCode]);

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
            current_question_id?: string | null;
            current_explanation_tts_url?: string | null;
            difficulty_mode?: string | null;
          } | undefined;
          if (next?.phase) {
            setRoomPhase(next.phase);
            void import("@/lib/debug-bus").then(({ emitDebug }) =>
              emitDebug({ type: "phase.change", phase: next.phase!, roundNumber: next.round_number }),
            );
          }
          if (typeof next?.round_number === "number") setRoundNumber(next.round_number);
          if (typeof next?.team_mode === "boolean") setTeamMode(next.team_mode);
          if (next && "current_category" in next) setActiveCategory(next.current_category ?? null);
          if (next && "current_question_id" in next) setCurrentQuestionId(next.current_question_id ?? null);
          if (next && "current_explanation_tts_url" in next) {
            setHasExplanationTts(Boolean(next.current_explanation_tts_url));
          }
          if (next && "difficulty_mode" in next) {
            const m = next.difficulty_mode;
            setDifficultyModeState(
              m === "easy" || m === "medium" || m === "hard" || m === "impossible" ? m : null,
            );
          }

        },
      )
      .subscribe();

    const interval = setInterval(() => {
      if (pausedRef.current) return;
      heartbeatFn({ data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId } }).catch(
        () => {},
      );
    }, 5000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [room, heartbeatFn]);

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
    // Custom-pack rooms have their own private category — never overwrite it.
    if (customPackTitle) return;
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
        const offSet = mergedDefaultOffCategories();
        try {
          const raw = window.localStorage.getItem(CATEGORIES_KEY);
          if (raw) {
            const arr = JSON.parse(raw) as string[];
            initial = new Set(arr.filter((n) => names.includes(n)));
          } else {
            initial = new Set(names.filter((n) => !offSet.has(n)));
          }
        } catch {
          initial = new Set(names.filter((n) => !offSet.has(n)));
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

  // Listen for control messages from the parent (dev playground / QA runner)
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const data = e.data as { type?: string } | null;
      if (data?.type === "parent:new-room") {
        // Same hard-kill order as endAndStartNewRoom: flip local UI first,
        // then silence audio (with a short silence window), then end + create.
        setRoomPhase("lobby");
        setPlayers([]);
        const killAudio = async () => {
          const { silenceFor } = await import("@/lib/elf-voice");
          silenceFor(1500);
          const { silenceAllAudio } = await import("@/lib/sound-engine");
          silenceAllAudio();
          const ambience = await import("@/lib/ambience-engine");
          ambience.stopAllAmbience();
          ambience.resetAmbience();
        };
        void killAudio();
        window.setTimeout(() => void killAudio(), 250);
        window.setTimeout(() => void killAudio(), 700);
        void (async () => {
          try {
            setCreating(true);
            const hostSessionId = newId();
            const res = await createRoomFn({ data: { hostSessionId } });
            saveHostSession({ sessionId: hostSessionId, roomCode: res.roomCode });
            setRoom({ id: res.id, roomCode: res.roomCode, hostSessionId });
            toast.success(`New room ${res.roomCode}`);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setCreating(false);
          }
        })();
        return;
      }
      if (data?.type === "parent:start-game") {
        // QA-runner shortcut — same code path as clicking the Start button.
        // Dispatch through a ref so we always call the latest closure
        // (this effect registers once; a stale closure would see room=null).
        try {
          window.parent?.postMessage({ type: "host:start-ack" }, "*");
        } catch {}
        actuallyStartRef.current();
        return;
      }

    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [createRoomFn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!room) return;
    if (roomPhase !== "lobby") return;
    // Load soundboard clips once (idempotent), then (re)start the seamless
    // crowd ambience. Runs on first mount, new-room, and any return-to-lobby
    // (e.g. Play Again) so the handoff latch from a previous game is cleared.
    let cancelled = false;
    let detachGesture: (() => void) | undefined;

    void (async () => {
      try {
        const { getActiveSounds } = await import("@/lib/sounds.functions");
        const res = await getActiveSounds();
        if (cancelled) return;
        const { loadCustomEvents } = await import("@/lib/sound-engine");
        loadCustomEvents(res.events as never);
      } catch {
        /* ignore — fall back to synth */
      }
      if (cancelled) return;

      const ambience = await import("@/lib/ambience-engine");
      ambience.resetAmbience();
      const ok = await ambience.startCrowd();
      if (cancelled || ok) return;

      // Autoplay blocked (Samsung Tizen, Amazon Silk, iPad mirroring, etc.)
      // Retry on ANY user gesture until playback succeeds.
      const events = ["pointerdown", "keydown", "touchstart"] as const;
      const retry = () => {
        ambience.resumeAmbienceContext();
        ambience.resetAmbience();
        void ambience.startCrowd().then((played) => {
          if (played) detachGesture?.();
        });
      };
      const detach = () => {
        events.forEach((e) =>
          window.removeEventListener(e, retry, { capture: true } as EventListenerOptions),
        );
        detachGesture = undefined;
      };
      events.forEach((e) =>
        window.addEventListener(e, retry, { capture: true, passive: true }),
      );
      detachGesture = detach;
    })();

    return () => {
      cancelled = true;
      detachGesture?.();
      // Only stop lobby buildup when we're actually leaving the lobby
      // (game start / unmount). If just room.id changed between lobbies,
      // keep 'crowd' in `wanted` so gesture retries stay effective.
      if (roomPhase !== "lobby") {
        stopMusic();
        void import("@/lib/ambience-engine").then((m) => m.stopLobbyBuildup());
      }
    };
  }, [room?.id, roomPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize the Elf voice for the QR-code lobby. HostGameStage does this
  // once the game starts, but lobby quips fire before that component mounts —
  // without this, lobby lines would call live TTS without a room id (so the
  // per-game cap can't charge the right room) and skip the pre-baked URL
  // cache entirely. Mirrors the same wiring HostGameStage does on mount.
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    void (async () => {
      try {
        const [
          { getPersonaCacheMap, getPersonaCacheMapAdult, getPersonaCacheMapAdultFemale },
          { initPersonaCache, initPersonaCacheAdult, initPersonaCacheAdultFemale, setActiveRoomId },
        ] = await Promise.all([
          import("@/lib/announcer.functions"),
          import("@/lib/elf-voice"),
        ]);
        setActiveRoomId(room.id);
        // Adult caches are only fetched when the user has opted into Adult
        // Mode via /settings/adult. Standard game stays fast and untouched.
        const adultOn = isAdultMode();
        const [res, resAdult, resAdultF] = await Promise.all([
          getPersonaCacheMap().catch(() => null),
          adultOn ? getPersonaCacheMapAdult().catch(() => null) : Promise.resolve(null),
          adultOn ? getPersonaCacheMapAdultFemale().catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (res?.map) initPersonaCache(res.map);
        if (resAdult?.map) initPersonaCacheAdult(resAdult.map);
        if (resAdultF?.map) initPersonaCacheAdultFemale(resAdultF.map);
      } catch {
        /* silent — falls back to live TTS */
      }
    })();
    return () => {
      cancelled = true;
      void import("@/lib/elf-voice").then(({ setActiveRoomId }) => setActiveRoomId(null));
    };
  }, [room?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lobby announcer banter — opener + rotating quips every 10s while waiting.
  // On a replay lobby (host hit Play Again), stay quiet: no opener and a
  // much longer cadence so the announcer doesn't re-pitch the join steps.
  useEffect(() => {
    if (!room) return;
    if (roomPhase !== "lobby") return;
    let cancelled = false;
    const history: string[] = [];
    const code = room.roomCode;

    // Gated debug logging: window.localStorage.setItem('btd:voice-debug','1')
    const debug = (() => {
      try {
        return window.localStorage.getItem("btd:voice-debug") === "1";
      } catch {
        return false;
      }
    })();
    const dlog = (...args: unknown[]) => {
      if (debug) console.debug("[lobby-quip]", ...args);
    };

    const win = window as unknown as { __btdReplayLobby?: boolean };
    const isReplayLobby = win.__btdReplayLobby === true;
    if (isReplayLobby) {
      win.__btdReplayLobby = false;
      // Drain anything still queued from credits/persona.
      void import("@/lib/elf-voice").then((m) => m.cancelElfSpeech());
    }

    // Welcome intro + join-instructions opener. Both go through the single
    // Elf-voice queue (FIFO), so the opener is guaranteed to play *after*
    // the welcome finishes — no interrupt, no cut-off. Skipped on replay.
    // Module-scoped guard prevents StrictMode double-mount or transient
    // re-renders (auth load, phase flicker) from playing the welcome twice
    // — that's what caused "Grab your phone" to repeat.
    const win2 = window as unknown as { __btdWelcomedRooms?: Set<string> };
    if (!win2.__btdWelcomedRooms) win2.__btdWelcomedRooms = new Set();
    const welcomedRooms = win2.__btdWelcomedRooms;
    const roomKey = room?.id ?? "";
    const alreadyWelcomed = roomKey ? welcomedRooms.has(roomKey) : false;

    const speakWelcomeAndOpener = async () => {
      if (alreadyWelcomed) return;
      if (roomKey) welcomedRooms.add(roomKey);
      const [{ speakAsElf }, { pickOpener, pickWelcomeIntro }] = await Promise.all([
        import("@/lib/elf-voice"),
        import("@/lib/lobby-banter"),
      ]);
      if (cancelled) return;
      dlog("welcome");
      void speakAsElf(pickWelcomeIntro(), { preset: "hype", interrupt: false });
      if (playersRef.current.length === 0) {
        dlog("opener queued");
        void speakAsElf(pickOpener(), { preset: "hype", interrupt: false });
      } else {
        dlog("opener skipped: players present");
      }
    };
    const openerTimer = isReplayLobby || alreadyWelcomed
      ? null
      : window.setTimeout(() => {
          void speakWelcomeAndOpener();
        }, 600);

    // Pending-quip counter prevents pile-up if cadence ever outpaces playback.
    // Also skip if the shared voice queue is busy with a welcome intro, join
    // callout, or any other line — avoids quips queueing up behind unrelated
    // audio and arriving stale.
    let pendingQuips = 0;
    const tick = async () => {
      if (cancelled) return;
      if (pendingQuips >= 1) {
        dlog("skip: pending");
        return;
      }
      const [{ speakAsElf }, { pickLobbyLine }] = await Promise.all([
        import("@/lib/elf-voice"),
        import("@/lib/lobby-banter"),
      ]);
      if (cancelled) return;
      // Note: we intentionally do NOT gate on isElfSpeaking() here. The elf
      // voice queue is FIFO, so queueing a quip behind a still-draining
      // welcome/opener is fine — it'll play right after. Gating on busy
      // ate every quip on a fresh lobby because welcome+opener takes
      // ~12-15s and ticks at +10/+20s both saw busy.
      const { spoken, raw } = pickLobbyLine(history, playersRef.current.length, code);
      history.push(raw);
      if (history.length > 6) history.shift();
      pendingQuips++;
      dlog("queued:", spoken);
      try {
        // speakAsElf returns the real queued playback promise, so this await
        // only resolves once the line actually finishes (or fails silently).
        await speakAsElf(spoken, { preset: "hype", interrupt: false });
        dlog("finished");
      } finally {
        pendingQuips = Math.max(0, pendingQuips - 1);
      }
    };
    // Replay lobby: wait 12s before first quip, then every 25s. Fresh lobby:
    // 18s first delay (so welcome+opener TTS clears first), then 12s cadence.
    const firstQuipDelay = isReplayLobby ? 12_000 : 18_000;
    const quipCadence = isReplayLobby ? 25_000 : 12_000;
    let interval: number | null = null;
    const firstQuipTimer = window.setTimeout(() => {
      if (cancelled) return;
      void tick();
      interval = window.setInterval(() => void tick(), quipCadence);
    }, firstQuipDelay);


    return () => {
      cancelled = true;
      if (openerTimer !== null) window.clearTimeout(openerTimer);
      window.clearTimeout(firstQuipTimer);
      if (interval !== null) window.clearInterval(interval);
    };
  }, [room?.id, roomPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lobby player-join welcome callouts. The in-game welcome lives in
  // HostGameStage; while we're on the QR-code lobby that component isn't
  // mounted, so we mirror the same batching/quip logic here. A shared
  // window-scoped Set keyed by room id prevents double-welcoming when the
  // game starts.
  const joinQueueRef = useRef<Array<{ name: string; key: string }>>([]);
  const joinDrainingRef = useRef(false);
  useEffect(() => {
    if (!room) return;
    if (roomPhase !== "lobby") return;
    const win = window as unknown as {
      __btdReplayLobby?: boolean;
      __btdAnnouncedJoins?: Record<string, Set<string>>;
    };
    if (!win.__btdAnnouncedJoins) win.__btdAnnouncedJoins = {};
    if (!win.__btdAnnouncedJoins[room.id]) win.__btdAnnouncedJoins[room.id] = new Set();
    const announced = win.__btdAnnouncedJoins[room.id];
    // On a replay lobby everyone was already welcomed last game — seed the
    // set silently so we don't flood the room with welcomes.
    const isReplaySeed = win.__btdReplayLobby === true && announced.size === 0;

    for (const p of players) {
      if (p.is_audience) continue;
      const key = p.id;
      if (!key || announced.has(key)) continue;
      announced.add(key);
      if (isReplaySeed) continue;
      joinQueueRef.current.push({ name: p.nickname, key });
    }
    if (joinQueueRef.current.length === 0 || joinDrainingRef.current) return;
    joinDrainingRef.current = true;
    void (async () => {
      const [{ speakAsElf }, { pickQuip }] = await Promise.all([
        import("@/lib/elf-voice"),
        import("@/lib/join-banter"),
      ]);
      // small debounce so simultaneous joins batch
      await new Promise((r) => setTimeout(r, 600));
      while (joinQueueRef.current.length > 0) {
        const batch = joinQueueRef.current.splice(0, Math.min(joinQueueRef.current.length, 8));
        const named = batch.slice(0, 3);
        const overflow = batch.length - named.length;
        let line: string;
        if (named.length === 1) {
          line = `Welcome, ${named[0].name}! ${pickQuip(named[0].key)}`;
        } else if (named.length === 2) {
          line = `Welcome ${named[0].name} and ${named[1].name}!`;
        } else {
          line = `Welcome ${named[0].name}, ${named[1].name}, and ${named[2].name}${
            overflow > 0 ? ` — and ${overflow} more!` : "!"
          }`;
        }
        try {
          await speakAsElf(line, { preset: "hype", interrupt: false });
        } catch {
          /* silent */
        }
      }
      joinDrainingRef.current = false;
    })();
  }, [players, room?.id, roomPhase]);







  // Subscribe to audience soundboard broadcasts → play SFX from TV speakers
  // Capped to a low volume so they sit under music/announcer, and mirrored to
  // the bottom-left audience feed so players can see who triggered them.
  useEffect(() => {
    if (!room) return;
    const AUDIENCE_MAX_VOLUME = 0.3;
    const channel = supabase
      .channel(`sfx-${room.roomCode}`)
      .on("broadcast", { event: "sfx" }, (msg) => {
        const p = msg.payload as
          | { sfx?: Sfx; nickname?: string; sessionId?: string }
          | undefined;
        if (p?.sfx) {
          play(p.sfx, 0.4);
          void import("@/lib/audience-feed").then(({ emitAudienceFeed }) =>
            emitAudienceFeed({
              kind: "sfx",
              nickname: p.nickname || "Audience",
              label: p.sfx,
            }),
          );
        }
      })
      .on("broadcast", { event: "sfx_url" }, (msg) => {
        const p = msg.payload as
          | {
              padId?: string;
              url?: string;
              volume?: number;
              nickname?: string;
              sessionId?: string;
              label?: string;
              emoji?: string;
            }
          | undefined;
        if (p?.url) {
          const vol = Math.min(AUDIENCE_MAX_VOLUME, (p.volume ?? 0.9) * 0.35);
          void import("@/lib/sound-engine").then(({ playClipUrl }) =>
            playClipUrl(p.url!, vol, p.padId),
          );
          void import("@/lib/audience-feed").then(({ emitAudienceFeed }) =>
            emitAudienceFeed({
              kind: "pad",
              nickname: p.nickname || "Audience",
              emoji: p.emoji,
              label: p.label,
            }),
          );
        }
      })
      .on("broadcast", { event: "react" }, (msg) => {
        const p = msg.payload as
          | { emoji?: string; nickname?: string; sessionId?: string }
          | undefined;
        if (p?.emoji) {
          void import("@/lib/audience-feed").then(({ emitAudienceFeed }) =>
            emitAudienceFeed({
              kind: "react",
              nickname: p.nickname || "Audience",
              emoji: p.emoji,
            }),
          );
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room]);


  const joinUrl = useMemo(() => {
    if (!origin || !room) return "";
    return `${getPlayerJoinOrigin()}/join?code=${room.roomCode}`;
  }, [room, origin]);

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      toast.success(next ? "Audio muted" : "Audio enabled");
      return next;
    });
  }

  useRevealAutoAdvance(
    room?.roomCode ?? "",
    room?.hostSessionId ?? "",
    roomPhase,
    roundNumber,
    currentQuestionId,
    hasExplanationTts,
  );

  async function endAndStartNewRoom() {
    if (!room) return;
    if (!window.confirm("End this game and start a fresh room?")) return;
    // 1. Snap local UI back to lobby FIRST so HostGameStage unmounts and
    //    all its end-game timers / audio-scheduling effects tear down
    //    before they can queue another line.
    setRoomPhase("lobby");
    setPlayers([]);
    setRoundNumber(0);
    setActiveCategory(null);

    // 2. Hard-kill all audio and arm a silence window so any callouts
    //    fired during the server round-trip are no-ops.
    const killAudio = async () => {
      const { silenceFor } = await import("@/lib/elf-voice");
      silenceFor(1500);
      const { silenceAllAudio } = await import("@/lib/sound-engine");
      silenceAllAudio();
      const ambience = await import("@/lib/ambience-engine");
      ambience.stopAllAmbience();
      ambience.resetAmbience();
    };
    void killAudio();
    window.setTimeout(() => void killAudio(), 250);
    window.setTimeout(() => void killAudio(), 700);

    try {
      setCreating(true);
      await endRoomFn({
        data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
      }).catch(() => undefined);
      const hostSessionId = newId();
      const res = await createRoomFn({ data: { hostSessionId } });
      saveHostSession({ sessionId: hostSessionId, roomCode: res.roomCode });
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
        <AudienceFeed />
        <Chyron />
        <AchievementToast />
        <InstantReplay />



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
  const canStart = !!room && livePlayers.length > 0 && rating !== null;
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

  // Ref so the message-listener effect (registered once) always dispatches
  // to the latest actuallyStart closure — otherwise it sees room=null forever.
  const actuallyStartRef = useRef<() => void>(() => {});
  useEffect(() => {
    actuallyStartRef.current = () => { void actuallyStart(); };
  });

  async function actuallyStart() {

    if (!room) return;
    play("whoosh");
    // Hard-stop every lobby audio source before flipping the phase, so a
    // mid-flight "still waiting" / join callout can't leak into IntroStage.
    try {
      const { cancelElfSpeech } = await import("@/lib/elf-voice");
      cancelElfSpeech();
    } catch {}
    stopMusic();
    joinQueueRef.current = [];
    try {
      const win = window as unknown as { __btdWelcomedRooms?: Set<string> };
      win.__btdWelcomedRooms?.delete(room.id);
    } catch {}
    try {
      // Always reset per-game state before launching, so a stale row from a
      // previous ended game can't bump round_number into the final-round range.
      await restartGameFn({
        data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
      });
      await setPhaseFn({
        data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId, phase: "intro" },
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }



  function handleStartClick() {
    if (!canStart) {
      setSettingsOpen(true);
      return;
    }
    actuallyStart();
  }



  return (
    <main
      className="relative h-[100vh] w-full overflow-hidden text-white"
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
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 3vh)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 3vh)",
          paddingLeft: "calc(env(safe-area-inset-left, 0px) + 3vw)",
          paddingRight: "calc(env(safe-area-inset-right, 0px) + 3vw)",
        }}
      >
        {/* TOP BAR */}
        <header className="grid flex-none grid-cols-[1fr_auto_1fr] items-center gap-3 pb-[1vh]">
          <button
            onClick={() => navigate({ to: "/" })}
            className="justify-self-start text-xs text-white/60 hover:text-white"
          >
            ← Home
          </button>
          <div className="justify-self-center font-display text-base font-black tracking-tight text-white/90">
            Beat the{" "}
            <span className="bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
              Drop
            </span>
          </div>
          <div className="flex items-center gap-2 justify-self-end">
            {!isFullscreen && (
              <button
                onClick={toggleFullscreen}
                className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-widest text-white/70 backdrop-blur hover:bg-white/10"
                title="Fullscreen"
              >
                ⛶
              </button>
            )}
            <button
              onClick={openSettings}
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-widest text-white/70 backdrop-blur hover:bg-white/10"
              title="Settings"
            >
              <SettingsIcon className="h-3 w-3" /> Settings
            </button>
            {/* Admin link intentionally hidden from the UI. Type /admin in the URL bar to reach it. */}
          </div>
        </header>

        {error && (
          <div className="mt-3 flex-none rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {/* HERO — join + room code + QR (fills the middle, no scroll) */}
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[1.2vh] overflow-hidden text-center">
          <div className="text-[clamp(0.65rem,1.3vh,0.85rem)] font-bold uppercase tracking-[0.45em] text-amber-200/80">
            Game PIN
          </div>


          <div className="bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text font-mono text-[clamp(3rem,16vh,8rem)] font-black leading-none tracking-[0.12em] text-transparent drop-shadow-[0_8px_30px_rgba(251,191,36,0.35)]">
            {creating || !room ? "····" : room.roomCode}
          </div>

          {joinUrl && (
            <div className="flex flex-col items-center gap-2">
              <div
                className="inline-block rounded-xl bg-white p-[1vh] shadow-[0_0_40px_oklch(0.85_0.18_85/0.32)] ring-1 ring-white/20"
                style={{ width: "clamp(120px, 22vh, 200px)", height: "clamp(120px, 22vh, 200px)" }}
              >
                <QRCodeSVG value={joinUrl} size={256} level="M" includeMargin={false} style={{ width: "100%", height: "100%" }} />
              </div>
              <div className="font-mono text-[clamp(0.55rem,1.05vh,0.75rem)] tracking-wide text-white/55">
                droptrivia.app/join
              </div>
            </div>
          )}

          {customPackTitle ? (
            <div className="text-[clamp(0.7rem,1.4vh,0.95rem)] text-white/80">
              <span className="rounded-full bg-amber-400/20 px-3 py-1 font-bold uppercase tracking-widest text-amber-200">Custom Pack</span>
              <span className="ml-2 font-semibold text-amber-100">{customPackTitle}</span>
            </div>
          ) : activeCategory && (
            <div className="text-[clamp(0.7rem,1.4vh,0.95rem)] text-white/60">
              Category: <span className="font-semibold text-amber-200">{activeCategory}</span>
            </div>
          )}
        </section>

        {/* PLAYER ROW */}
        <section className="flex flex-none flex-col items-center gap-[1.5vh]">
          <div className="flex items-center gap-4 text-[clamp(0.65rem,1.3vh,0.85rem)] font-bold uppercase tracking-[0.35em] text-white/60">
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
          <div className="flex flex-wrap items-center justify-center gap-2" style={{ maxHeight: "12vh", overflow: "hidden" }}>
            <AnimatePresence>
              {livePlayers.length === 0 ? (
                <div key="lobby-empty" className="text-[clamp(0.75rem,1.6vh,1rem)] text-white/50">
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
                      <span className="text-[clamp(0.75rem,1.5vh,0.95rem)] font-medium text-white">
                        {p.nickname}
                      </span>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>

          {/* Content rating — REQUIRED per game so adult content can never
              leak into a fresh session that inherited a stale flag. */}
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">
              <span>Content Rating</span>
              {rating === null && livePlayers.length > 0 && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] text-amber-200">
                  Pick one to start
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {([
                { id: "pg" as const,   emoji: "👨‍👩‍👧", label: "PG",    sub: "Family" },
                { id: "pg13" as const, emoji: "🎓",       label: "PG-13", sub: "Teens+" },
                { id: "ma" as const,   emoji: "🔞",       label: "MA 18+", sub: "Adults only" },
              ]).map((opt) => {
                const active = rating === opt.id;
                const isMA = opt.id === "ma";
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      if (opt.id === "ma") {
                        setMaAgeOk(false);
                        setMaTosOk(false);
                        setMaConfirmOpen(true);
                      } else {
                        setContentRating(opt.id);
                      }
                    }}
                    className={`flex min-w-[92px] flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      active
                        ? isMA
                          ? "border-rose-400/70 bg-rose-500/20 text-rose-100 shadow-[0_0_20px_oklch(0.65_0.2_15/0.4)]"
                          : "border-amber-300/70 bg-amber-300/15 text-amber-100 shadow-[0_0_20px_oklch(0.85_0.18_85/0.35)]"
                        : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                    }`}
                  >
                    <span className="text-lg leading-none" aria-hidden>{opt.emoji}</span>
                    <span className="tracking-wider">{opt.label}</span>
                    <span className="text-[9px] font-normal uppercase tracking-widest opacity-70">
                      {opt.sub}
                    </span>
                  </button>
                );
              })}
            </div>
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
            className={`rounded-2xl px-[clamp(1.5rem,4vw,3rem)] py-[clamp(0.6rem,1.8vh,1rem)] text-[clamp(1rem,2.4vh,1.5rem)] font-black uppercase tracking-wider shadow-lg transition ${
              canStart
                ? "bg-gradient-to-b from-amber-300 to-amber-500 text-black shadow-[0_0_60px_oklch(0.85_0.18_85/0.45)] hover:brightness-110"
                : "border border-white/15 bg-white/[0.06] text-white/70 hover:bg-white/10"
            }`}
          >
            {canStart
              ? "▶ Press OK to start the show"
              : "Waiting for players…"}
          </motion.button>

          <div className="relative flex items-center justify-center">
            <button
              onClick={openSettings}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-[clamp(0.65rem,1.2vh,0.8rem)] font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur transition hover:bg-white/10 hover:text-amber-200"
            >
              <Shuffle className="h-3.5 w-3.5" />
              {mixLabel}
            </button>
            <AnimatePresence>
              {true && (
                <motion.div
                  key="cat-nudge"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: [0, 6, 0] }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{
                    opacity: { duration: 0.4 },
                    x: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
                  }}
                  className="pointer-events-none absolute left-full top-1/2 ml-2 flex -translate-y-1/2 items-center gap-1.5 max-sm:left-auto max-sm:right-full max-sm:ml-0 max-sm:mr-2"
                  style={{ filter: "drop-shadow(0 0 10px oklch(0.85 0.18 85 / 0.45))" }}
                >
                  <svg
                    width="34"
                    height="18"
                    viewBox="0 0 34 18"
                    fill="none"
                    className="text-amber-300 max-sm:order-2 max-sm:rotate-180"
                    aria-hidden
                  >
                    <path
                      d="M30 9 C 22 9, 14 4, 4 9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <path
                      d="M10 4 L4 9 L10 14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  <span
                    className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.25em] text-amber-200 max-sm:order-1"
                  >
                    pick your categories!
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>



          <LobbyTipCarousel />

          {!customPackTitle && (
            <CustomCodeEntry
              onSubmit={(code) => {
                if (!code) return;
                navigate({ to: "/host", search: { code } });
              }}
            />
          )}
        </section>
      </div>

      {/* SETTINGS SHEET — slide-in from right */}
      <AnimatePresence>
        {settingsOpen && (
          <Fragment key="settings-sheet">
            <motion.div
              key="settings-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettingsOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              key="settings-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 z-50 flex h-[100vh] w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-[oklch(0.10_0.02_270)] p-5 shadow-2xl"
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

              <Link
                to="/settings/adult"
                className="mb-5 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm font-bold text-rose-200 transition hover:border-rose-400/60 hover:bg-rose-900/40"
              >
                <span>🔞 Adult Mode</span>
                <span className="text-[10px] font-normal uppercase tracking-widest text-rose-300/70">
                  R-rated host →
                </span>
              </Link>



              <div className="mb-5">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-200/80">
                  Mode
                </h3>
                <p className="mb-2 text-[11px] leading-snug text-white/50">
                  Pick a vibe. Locks every question this game to one difficulty bucket.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { mode: null,         emoji: "🎲", label: "Surprise Me",  sub: "All difficulties" },
                    { mode: "easy",       emoji: "🍦", label: "Chill Mode",   sub: "Easy only" },
                    { mode: "medium",     emoji: "🚗", label: "Cruise Mode",  sub: "Medium only" },
                    { mode: "hard",       emoji: "🔥", label: "Sweat Mode",   sub: "Hard only" },
                    { mode: "impossible", emoji: "🧠", label: "Galaxy Brain", sub: "Impossible only" },
                  ] as { mode: DifficultyMode; emoji: string; label: string; sub: string }[]).map((m) => {
                    const selected = difficultyMode === m.mode;
                    return (
                      <button
                        key={m.label}
                        onClick={() => {
                          setDifficultyModeState(m.mode);
                          if (room) {
                            setDifficultyModeFn({
                              data: {
                                roomCode: room.roomCode,
                                hostSessionId: room.hostSessionId,
                                mode: m.mode,
                              },
                            }).catch((e) => toast.error((e as Error).message));
                          }
                        }}
                        className={`flex items-center gap-2 rounded-lg border p-2 text-left transition ${
                          selected
                            ? "border-amber-300/60 bg-amber-300/15 text-amber-100 shadow-[0_0_0_1px_oklch(0.78_0.16_85/0.3)_inset]"
                            : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10"
                        }`}
                      >
                        <span className="text-lg leading-none">{m.emoji}</span>
                        <span className="flex-1 leading-tight">
                          <span className="block text-xs font-semibold">{m.label}</span>
                          <span className="block text-[10px] text-white/50">{m.sub}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
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


              {/* Keyboard hints hidden — players don't need them. Spacebar pause still works. */}
            </motion.aside>
          </Fragment>
        )}
      </AnimatePresence>




      <AnimatePresence>
        {paused && (
          <motion.div
            key="pause-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 grid place-items-center bg-background/85 backdrop-blur"
          >

            <div className="text-center">
              <div className="font-display text-7xl font-black">Paused</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      


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
    <div className="mt-[1vh] h-[3vh] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
          className="text-center text-[clamp(0.75rem,1.5vh,1rem)] italic text-white/50"
        >
          "{LOBBY_HOST_TIPS[idx]}"
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function CustomCodeEntry({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-[1vh] text-[clamp(0.65rem,1.2vh,0.8rem)] text-white/40 underline-offset-2 hover:text-amber-200 hover:underline"
      >
        Have a custom pack code?
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const code = value.trim().toUpperCase();
        if (code.length < 4) return;
        onSubmit(code);
      }}
      className="mt-[1vh] flex items-center gap-2"
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        placeholder="PACK CODE"
        maxLength={12}
        className="w-36 rounded-lg border border-amber-400/40 bg-black/40 px-3 py-1.5 text-center font-mono text-sm font-bold uppercase tracking-widest text-amber-200 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300"
      >
        Load
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-white/40 hover:text-white">
        ✕
      </button>
    </form>
  );
}

