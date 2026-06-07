import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  dropWrongAnswer,
  endGame,
  endQuestion,
  nextQuestion,
  setPhase,
  startFinalRound,
  startFinalQuestion,
  scoreFinalRound,
  startSuddenDeath,
  resolveSuddenDeath,
} from "@/lib/game.functions";
import { QuestionStage } from "./QuestionStage";
import { Leaderboard } from "./Leaderboard";
import { ShatteredFaces } from "./ShatteredFaces";
import { TwitchPanel } from "./TwitchPanel";
import { AIRoast } from "./AIRoast";
import { IntroStage } from "./IntroStage";
import { CreditsStage } from "./CreditsStage";
import { pickLine, speakPersona } from "@/lib/host-persona";
import { play, playEvent, startMusic, stopMusic, duckMusic } from "@/lib/sound-engine";
import { FinalWagerStage, FinalRevealStage } from "./FinalStages";
import { WinnerSpotlight } from "./WinnerSpotlight";
import { RoundRecapReel } from "./RoundRecapReel";

type RoomState = {
  id: string;
  room_code: string;
  phase: string;
  current_question_id: string | null;
  current_question_text: string | null;
  current_question_tts_url: string | null;
  current_answers: string[] | null;
  current_correct_index: number | null;
  current_explanation: string | null;
  question_started_at: string | null;
  question_duration_ms: number;
  dropped_indexes: number[];
  wildcard: string | null;
  round_number: number;
  sudden_death_session_ids: string[] | null;
};

type Player = {
  id: string;
  session_id: string;
  nickname: string;
  score: number;
  avatar_url: string | null;
  current_answer: number | null;
  current_answer_locked_at: string | null;
  current_round_score: number;
  current_round_fastest: boolean;
  streak_count: number;
  is_audience: boolean;
  final_wager: number;
  final_answer: number | null;
  final_locked_at: string | null;
  best_streak: number;
  fastest_count: number;
  correct_count: number;
  wrong_count: number;
  comeback_bonus: boolean;
};

type Props = {
  room: { id: string; roomCode: string; hostSessionId: string };
};

// Elapsed seconds (from question_started_at) at which each wrong answer drops.
// Driven off elapsed time so the elimination sequence ALWAYS plays out,
// even when every player locks in immediately.
const DROP_AT_ELAPSED_S = [9, 15, 20];
// After the final wrong answer drops, hold on the lone correct answer
// for this long before triggering endQuestion / reveal.
const FINAL_HOLD_MS = 2500;

export function HostGameStage({ room }: Props) {
  const [state, setState] = useState<RoomState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const droppedRef = useRef<Set<number>>(new Set());
  const endedRef = useRef(false);
  const [recapDoneForRound, setRecapDoneForRound] = useState<number>(-1);

  const nextQuestionFn = useServerFn(nextQuestion);
  const dropWrongFn = useServerFn(dropWrongAnswer);
  const endQuestionFn = useServerFn(endQuestion);
  const setPhaseFn = useServerFn(setPhase);
  const endGameFn = useServerFn(endGame);
  const startFinalRoundFn = useServerFn(startFinalRound);
  const startFinalQuestionFn = useServerFn(startFinalQuestion);
  const scoreFinalRoundFn = useServerFn(scoreFinalRound);

  // Load pre-baked persona pack URLs into the Elf voice cache once on mount,
  // and register this room so the server-side per-game ElevenLabs cap counter
  // charges the right game.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ getPersonaCacheMap }, { initPersonaCache, setActiveRoomId }] = await Promise.all([
          import("@/lib/announcer.functions"),
          import("@/lib/elf-voice"),
        ]);
        setActiveRoomId(room.id);
        const res = await getPersonaCacheMap();
        if (!cancelled && res?.map) initPersonaCache(res.map);
      } catch {
        /* silent — falls back to live TTS */
      }
    })();
    return () => {
      cancelled = true;
      void import("@/lib/elf-voice").then(({ setActiveRoomId }) => setActiveRoomId(null));
    };
  }, [room.id]);


  // Shatter trigger: increments per drop event so ShatteredFaces re-fires
  const [shatterKey, setShatterKey] = useState("");
  const [shatterVictims, setShatterVictims] = useState<
    { id: string; nickname: string; avatar_url: string | null }[]
  >([]);
  const lastDroppedRef = useRef<number[]>([]);

  // Fetch room + players, subscribe to realtime
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: r } = await supabase
        .from("rooms")
        .select(
          "id, room_code, phase, current_question_id, current_question_text, current_question_tts_url, current_answers, current_correct_index, current_explanation, question_started_at, question_duration_ms, dropped_indexes, wildcard, round_number, sudden_death_session_ids",
        )
        .eq("id", room.id)
        .maybeSingle();
      if (!cancelled && r) setState(r as RoomState);
      const { data: ps } = await supabase
        .from("players")
        .select(
          "id, session_id, nickname, score, avatar_url, current_answer, current_answer_locked_at, current_round_score, current_round_fastest, streak_count, is_audience, final_wager, final_answer, final_locked_at, best_streak, fastest_count, correct_count, wrong_count, comeback_bonus",
        )
        .eq("room_id", room.id)
        .order("created_at", { ascending: true });
      if (!cancelled && ps) setPlayers(ps as Player[]);
    };
    void load();

    const channel = supabase
      .channel(`host-game-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          if (payload.new) setState(payload.new as RoomState);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` },
        () => void load(),
      )
      .subscribe();

    const tick = window.setInterval(() => setNow(Date.now()), 100);

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      window.clearInterval(tick);
    };
  }, [room.id]);

  // Reset orchestrator refs on each new question
  useEffect(() => {
    droppedRef.current = new Set();
    endedRef.current = false;
  }, [state?.question_started_at]);

  // Play The Elf reading the question whenever a new one lands
  const questionTtsAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedQuestionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const qid = state?.current_question_id ?? null;
    const url = state?.current_question_tts_url ?? null;
    const phase = state?.phase;
    const startedAt = state?.question_started_at ?? null;
    // Only play during actual question phases, and only once per question
    if (!qid || !url || (phase !== "question" && phase !== "final_intro" && phase !== "final_question")) {
      return;
    }
    if (lastPlayedQuestionIdRef.current === qid) return;
    lastPlayedQuestionIdRef.current = qid;

    // Stop any previous question read
    if (questionTtsAudioRef.current) {
      try {
        questionTtsAudioRef.current.pause();
      } catch {
        /* ignore */
      }
      questionTtsAudioRef.current = null;
    }

    // Wait until the 3-2-1 countdown is finished (question_started_at)
    // so the "next question!" announcement doesn't overlap the read.
    const startMs = startedAt ? new Date(startedAt).getTime() : Date.now();
    const delay = Math.max(0, startMs - Date.now());

    const timer = window.setTimeout(() => {
      // Also wait for any in-flight speech synthesis to finish
      const speak = () => {
        const audio = new Audio(url);
        audio.volume = 1.0;
        questionTtsAudioRef.current = audio;
        duckMusic(true);
        const undock = () => duckMusic(false);
        audio.addEventListener("ended", undock);
        audio.addEventListener("pause", undock);
        audio.play().catch(() => {
          duckMusic(false);
        });
      };
      speak();

    }, delay);

    return () => window.clearTimeout(timer);
  }, [state?.current_question_id, state?.current_question_tts_url, state?.phase, state?.question_started_at]);


  // Stop any lingering question read when leaving question phases
  useEffect(() => {
    return () => {
      if (questionTtsAudioRef.current) {
        try {
          questionTtsAudioRef.current.pause();
        } catch {
          /* ignore */
        }
        questionTtsAudioRef.current = null;
      }
    };
  }, []);


  // Orchestrator: schedule drops and end based on elapsed
  useEffect(() => {
    if (!state || state.phase !== "question" || !state.question_started_at) return;
    const startMs = new Date(state.question_started_at).getTime();
    const durationMs = state.question_duration_ms;
    const elapsedS = (now - startMs) / 1000;
    const remainingS = Math.max(0, durationMs / 1000 - elapsedS);

    // tick sfx in last 5s
    if (remainingS <= 5 && remainingS > 0 && Math.floor(remainingS) !== Math.floor(remainingS + 0.1)) {
      play("tick");
    }

    // schedule drops based on ELAPSED time so the elimination sequence
    // always plays out, regardless of how fast players lock in
    DROP_AT_ELAPSED_S.forEach((thresholdElapsed, idx) => {
      if (elapsedS >= thresholdElapsed && !droppedRef.current.has(idx)) {
        droppedRef.current.add(idx);
        play("drop");
        dropWrongFn({
          data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
        }).catch(() => {});
      }
    });

    // End the question only AFTER all wrong answers have dropped + a hold.
    // No early fast-forward — the elimination IS the show.
    const allDropsScheduled = droppedRef.current.size >= DROP_AT_ELAPSED_S.length;
    const lastDropElapsed = DROP_AT_ELAPSED_S[DROP_AT_ELAPSED_S.length - 1];
    const elapsedSinceLastDropMs = (elapsedS - lastDropElapsed) * 1000;
    const finalHoldDone = allDropsScheduled && elapsedSinceLastDropMs >= FINAL_HOLD_MS;
    const livePlayers = players.filter((p) => !p.is_audience);

    if ((remainingS <= 0 || finalHoldDone) && !endedRef.current) {
      endedRef.current = true;
      endQuestionFn({
        data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
      })
        .then(() => {
          const correct = livePlayers.some(
            (p) => p.current_answer === state.current_correct_index,
          );
          playEvent(correct ? "correct" : "wrong");
        })
        .catch(() => {});
    }
  }, [state, now, players, dropWrongFn, endQuestionFn, room.roomCode, room.hostSessionId]);

  // Detect new drops → fire Shattered Faces overlay
  useEffect(() => {
    if (!state) return;
    const cur = state.dropped_indexes ?? [];
    const prev = lastDroppedRef.current;
    const added = cur.filter((i) => !prev.includes(i));
    lastDroppedRef.current = cur;
    if (added.length === 0) return;
    const victims = players
      .filter((p) => !p.is_audience && p.current_answer !== null && added.includes(p.current_answer))
      .map((p) => ({ id: p.id, nickname: p.nickname, avatar_url: p.avatar_url }));
    if (victims.length === 0) return;
    setShatterVictims(victims);
    setShatterKey(`${state.question_started_at}-${cur.join(",")}`);
  }, [state?.dropped_indexes, state?.question_started_at, players]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tense music during question, lobby during lobby
  useEffect(() => {
    if (!state) return;
    if (state.phase === "question" || state.phase === "final_question")
      startMusic("tense", 380);
    else if (state.phase === "lobby" || state.phase === "intro" || state.phase === "credits")
      startMusic("lobby", 600);
    else if (state.phase === "final_intro" || state.phase === "final_wager")
      startMusic("tense", 520);
    else stopMusic();
  }, [state?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Round intro sting + "Next question!" voice — only when transitioning INTO
  // question phase from a non-question phase
  const lastRoundStingRef = useRef<number>(0);
  const prevPhaseRef = useRef<string>("");
  useEffect(() => {
    if (!state) return;
    const r = state.round_number ?? 0;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;
    const enteringFromBreak =
      prev === "lobby" || prev === "leaderboard" || prev === "reveal" || prev === "";
    if (
      state.phase === "question" &&
      r > 0 &&
      r !== lastRoundStingRef.current &&
      enteringFromBreak
    ) {
      lastRoundStingRef.current = r;
      playEvent("round_intro");
      // Whoosh sting at the very start of the transition
      play("whoosh");
      // Snappy voice announcement before the question reveals.
      const phrases = ["Next!", "Here we go!", "Lock in!", "Round " + r + "!"];
      const text = r === 1 ? "First question!" : phrases[r % phrases.length];
      duckMusic(true);
      import("@/lib/elf-voice").then(({ speakAsElf }) => {
        speakAsElf(text, { interrupt: true, preset: "hype" }).finally(() => duckMusic(false));
      }).catch(() => duckMusic(false));

    }
  }, [state?.phase, state?.round_number]);


  // Phase-driven event stings
  const lastPhaseStingRef = useRef<string>("");
  useEffect(() => {
    if (!state) return;
    const key = `${state.phase}`;
    if (lastPhaseStingRef.current === key) return;
    lastPhaseStingRef.current = key;
    if (state.phase === "leaderboard") playEvent("leaderboard");
    else if (state.phase === "final_intro") {
      playEvent("final");
      speakPersona(pickLine("final_hype", state.round_number));
    }
    else if (state.phase === "ended") playEvent("victory");
  }, [state?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persona reactions on reveal — keyed off question id so a new line fires
  // every reveal (the phase-sting ref above only fires on phase transitions).
  const lastRevealReactionRef = useRef<string>("");
  useEffect(() => {
    if (!state || state.phase !== "reveal") return;
    const qid = state.current_question_id;
    if (!qid || lastRevealReactionRef.current === qid) return;
    lastRevealReactionRef.current = qid;
    const correctIdx = state.current_correct_index;
    if (correctIdx === null) return;
    const live = players.filter((p) => !p.is_audience && p.current_answer !== null);
    if (live.length === 0) return;
    const right = live.filter((p) => p.current_answer === correctIdx).length;
    const wrong = live.length - right;
    let moment: "all_correct" | "all_wrong" | "split_correct";
    if (right === live.length) moment = "all_correct";
    else if (wrong === live.length) moment = "all_wrong";
    else moment = "split_correct";
    // Small delay so the line lands after the reveal sting, not on top of it.
    const id = window.setTimeout(() => {
      speakPersona(pickLine(moment, qid));
    }, 900);
    return () => window.clearTimeout(id);
  }, [state?.phase, state?.current_question_id, state?.current_correct_index, players]); // eslint-disable-line react-hooks/exhaustive-deps


  // ─── Final round orchestrator ─────────────────────────────────────────
  const finalAdvancedRef = useRef<string>("");
  useEffect(() => {
    if (!state) return;
    const phase = state.phase;

    // Wager → start question after 30s OR when all live players locked
    if (phase === "final_wager") {
      const live = players.filter((p) => !p.is_audience);
      const allLocked = live.length > 0 && live.every((p) => !!p.final_locked_at);
      const key = `wager-${state.id}`;
      const fire = () => {
        if (finalAdvancedRef.current === key) return;
        finalAdvancedRef.current = key;
        startFinalQuestionFn({
          data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
        }).catch(() => {});
      };
      if (allLocked) {
        const id = window.setTimeout(fire, 1500);
        return () => window.clearTimeout(id);
      }
      const id = window.setTimeout(fire, 30000);
      return () => window.clearTimeout(id);
    }

    // Question → score when timer runs out
    if (phase === "final_question" && state.question_started_at) {
      const startMs = new Date(state.question_started_at).getTime();
      const remainingMs = state.question_duration_ms - (now - startMs);
      if (remainingMs <= 0) {
        const key = `score-${state.question_started_at}`;
        if (finalAdvancedRef.current === key) return;
        finalAdvancedRef.current = key;
        play("whoosh");
        scoreFinalRoundFn({
          data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
        }).catch(() => {});
      }
    }

    // Reveal → ended after 7s
    if (phase === "final_reveal") {
      const key = `reveal-${state.id}`;
      if (finalAdvancedRef.current === key) return;
      const id = window.setTimeout(() => {
        finalAdvancedRef.current = key;
        endGameFn({
          data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
        }).catch(() => {});
      }, 7000);
      return () => window.clearTimeout(id);
    }
  }, [state, now, players, setPhaseFn, startFinalQuestionFn, scoreFinalRoundFn, endGameFn, room.roomCode, room.hostSessionId]);

  // Wager lock-in thud — fires when a new player locks
  const lastWagerLockedCountRef = useRef(0);
  useEffect(() => {
    if (state?.phase !== "final_wager") {
      lastWagerLockedCountRef.current = 0;
      return;
    }
    const locked = players.filter((p) => !p.is_audience && !!p.final_locked_at).length;
    if (locked > lastWagerLockedCountRef.current) {
      lastWagerLockedCountRef.current = locked;
      play("drop");
    }
  }, [state?.phase, players]);

  // Extra ticks under 3s during final question (heart-pound)
  const lastFinalTickRef = useRef(0);
  useEffect(() => {
    if (state?.phase !== "final_question" || !state.question_started_at) return;
    const startMs = new Date(state.question_started_at).getTime();
    const remaining = state.question_duration_ms / 1000 - (now - startMs) / 1000;
    if (remaining > 0 && remaining <= 3) {
      const slot = Math.floor(remaining * 4); // 4 ticks/sec under 3s
      if (slot !== lastFinalTickRef.current) {
        lastFinalTickRef.current = slot;
        play("tick");
      }
    }
  }, [state?.phase, state?.question_started_at, state?.question_duration_ms, now]);



  if (!state) return null;

  const startMs = state.question_started_at
    ? new Date(state.question_started_at).getTime()
    : 0;
  const readSecondsLeft = state.question_started_at
    ? Math.max(0, (startMs - now) / 1000)
    : 0;
  const remainingS = state.question_started_at
    ? Math.max(0, state.question_duration_ms / 1000 - Math.max(0, (now - startMs) / 1000))
    : state.question_duration_ms / 1000;

  if (state.phase === "question" || state.phase === "reveal") {
    return (
      <>
        {state.wildcard && state.phase === "question" && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-amber-400/95 px-4 py-1 text-xs font-black uppercase tracking-[0.25em] text-amber-950 shadow">
            {state.wildcard === "saboteur" && "🕵 Saboteur round"}
            {state.wildcard === "glitch" && "⚡ Glitch round"}
            {state.wildcard === "roast" && "🔥 Roast vote"}
            {state.wildcard === "lightning" && "⚡ LIGHTNING · 2× points · 8s"}
          </div>
        )}
        {state.wildcard === "lightning" && state.phase === "question" && (
          <div
            className="pointer-events-none absolute inset-0 z-10 animate-fade-in"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 40%, oklch(0.65 0.25 25 / 0.18) 100%)",
              boxShadow: "inset 0 0 120px 20px oklch(0.65 0.25 25 / 0.35)",
            }}
          />
        )}
        {typeof window !== "undefined" && window.localStorage.getItem("btd-twitch-enabled") === "1" && (
          <div className="absolute right-4 top-4 z-30 w-72">
            <TwitchPanel
              questionKey={state.question_started_at ?? state.current_question_text ?? ""}
              answers={state.current_answers ?? ["", "", "", ""]}
              droppedIndexes={state.dropped_indexes ?? []}
            />
          </div>
        )}
        <QuestionStage
          questionText={state.current_question_text ?? ""}
          answers={state.current_answers ?? ["", "", "", ""]}
          droppedIndexes={state.dropped_indexes ?? []}
          correctIndex={state.phase === "reveal" ? state.current_correct_index : null}
          secondsLeft={remainingS}
          totalS={state.question_duration_ms / 1000}
          readSecondsLeft={state.phase === "question" ? readSecondsLeft : 0}
          phase={state.phase as "question" | "reveal"}
          players={players.filter((p) => !p.is_audience)}
          explanation={state.phase === "reveal" ? state.current_explanation : null}
          mediaUrl={(state as { current_media_url?: string | null }).current_media_url ?? null}
          mediaType={(state as { current_media_type?: string | null }).current_media_type ?? null}
          questionNumber={state.round_number ?? 1}
        />

        <ShatteredFaces victims={shatterVictims} triggerKey={shatterKey} />
      </>
    );
  }

  if (state.phase === "intro") {
    return (
      <IntroStage
        players={players.filter((p) => !p.is_audience).map((p) => ({
          id: p.id,
          nickname: p.nickname,
          avatar_url: p.avatar_url,
        }))}
        onDone={() => {
          nextQuestionFn({
            data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
          }).catch(() => {});
        }}
      />
    );
  }

  if (state.phase === "credits") {
    return (
      <CreditsStage
        players={players}
        onPlayAgain={() => {
          setPhaseFn({
            data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId, phase: "lobby" },
          }).catch(() => {});
        }}
      />
    );
  }

  if (state.phase === "ended") {
    return (
      <WinnerSpotlight players={players}>
        <div className="text-[11px] uppercase tracking-[0.3em] text-white/50">
          Players can tap "Export to socials" on their phones
        </div>
        <AIRoast roomCode={room.roomCode} hostSessionId={room.hostSessionId} />
        <button
          onClick={() => {
            play("whoosh");
            setPhaseFn({
              data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId, phase: "credits" },
            }).catch(() => {});
          }}
          className="mt-2 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-8 py-3 font-display font-bold uppercase tracking-wider text-amber-950 shadow-[0_0_40px_oklch(0.85_0.18_85/0.5)] transition hover:scale-[1.03]"
        >
          🎬 Roll credits
        </button>
      </WinnerSpotlight>
    );
  }

  // ─── FINAL ROUND PHASES ──────────────────────────────────────────────
  if (state.phase === "final_intro") {
    return (
      <div className="relative grid h-full place-items-center overflow-hidden bg-black text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.35_0.18_85/0.35),oklch(0.05_0.02_270)_70%)]" />
        <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_50%,oklch(0.85_0.18_85/0.15),transparent_60%)]" />
        <div className="relative text-center">
          <div className="animate-fade-in text-xs font-bold uppercase tracking-[0.6em] text-amber-300/90">
            One question. All on the line.
          </div>
          <h1
            className="mt-4 font-display text-[12vw] font-black uppercase leading-none tracking-tight text-transparent [animation:scale-in_0.6s_ease-out]"
            style={{
              backgroundImage:
                "linear-gradient(180deg, oklch(0.97 0.12 90) 0%, oklch(0.75 0.20 60) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              filter: "drop-shadow(0 8px 40px oklch(0.85 0.20 70 / 0.55))",
            }}
          >
            Final Round
          </h1>
          <div className="mx-auto mt-6 h-[3px] w-48 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
        </div>
      </div>
    );
  }

  if (state.phase === "final_wager") {
    return <FinalWagerStage players={players} />;
  }

  if (state.phase === "final_question") {
    const totalS = state.question_duration_ms / 1000;
    const danger = remainingS <= 10 && remainingS > 0;
    const critical = remainingS <= 5 && remainingS > 0;
    const ringDur = critical ? 0.45 : danger ? 0.9 : 1.6;
    // Vignette intensifies as remaining drops; from 0 → 0.55 opacity
    const vignetteAlpha = 0.55 * (1 - Math.max(0, Math.min(1, remainingS / totalS)));
    return (
      <div className="relative h-full">
        <div
          className={`pointer-events-none absolute inset-3 z-20 rounded-3xl ${
            critical
              ? "final-q-ring-danger ring-4 ring-rose-400/70"
              : danger
                ? "final-q-ring-danger ring-4 ring-amber-300/80"
                : "final-q-ring ring-4 ring-amber-300/60"
          }`}
          style={{ ["--rd" as string]: `${ringDur}s` }}
        />
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            background: `radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,${vignetteAlpha.toFixed(2)}) 100%)`,
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-amber-400/95 px-4 py-1 text-xs font-black uppercase tracking-[0.25em] text-amber-950 shadow">
          ★ Final question
        </div>
        <QuestionStage
          questionText={state.current_question_text ?? ""}
          answers={state.current_answers ?? ["", "", "", ""]}
          droppedIndexes={[]}
          correctIndex={null}
          secondsLeft={remainingS}
          totalS={totalS}
          phase="question"
          players={players.filter((p) => !p.is_audience)}
          mediaUrl={(state as { current_media_url?: string | null }).current_media_url ?? null}
          mediaType={(state as { current_media_type?: string | null }).current_media_type ?? null}
        />
      </div>
    );
  }

  if (state.phase === "final_reveal") {
    const correctIdx = state.current_correct_index;
    const correctText =
      correctIdx !== null && state.current_answers
        ? state.current_answers[correctIdx]
        : "—";
    // Leader BEFORE the reveal applied = top by (score - current_round_score)
    const prevRanked = [...players]
      .filter((p) => !p.is_audience)
      .sort(
        (a, b) =>
          (b.score - (b.current_round_score ?? 0)) -
          (a.score - (a.current_round_score ?? 0)),
      );
    const prevLeaderId = prevRanked[0]?.id ?? null;
    const revealKey = `${state.id}-${state.current_question_id ?? "x"}`;
    return (
      <FinalRevealStage
        correctText={correctText}
        explanation={state.current_explanation}
        players={players}
        revealKey={revealKey}
        prevLeaderId={prevLeaderId}
      />
    );
  }




  if (state.phase === "leaderboard") {
    const isFinal = (state.round_number ?? 0) >= 15;
    const livePlayers = players.filter((p) => !p.is_audience);
    const recapNeeded = recapDoneForRound !== (state.round_number ?? 0);
    if (recapNeeded) {
      return (
        <RoundRecapReel
          players={livePlayers}
          roundNumber={state.round_number ?? 0}
          triggerKey={state.round_number ?? 0}
          onDone={() => setRecapDoneForRound(state.round_number ?? 0)}
        />
      );
    }
    return (
      <div
        className="relative flex h-full flex-col gap-8 overflow-hidden p-8 text-white"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% 30%, oklch(0.22 0.04 270 / 0.95), oklch(0.08 0.02 270) 75%)",
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
        <div className="relative text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-300/80">
            Round {state.round_number ?? 0} {isFinal ? "— Final" : ""}
          </div>
          <h2 className="mt-2 font-display text-5xl font-black text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)] sm:text-6xl">
            Standings
          </h2>
          <div className="mx-auto mt-3 h-[2px] w-24 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
        </div>

        <div className="relative flex-1">
          <Leaderboard players={livePlayers} />
        </div>

        <div className="relative mt-auto flex justify-center gap-2">
          {isFinal ? (
            <button
              onClick={() => {
                play("whoosh");
                startFinalRoundFn({
                  data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
                }).catch(() => {});
              }}
              className="rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-8 py-3 font-display font-bold uppercase tracking-wider text-amber-950 shadow-[0_0_40px_oklch(0.85_0.18_85/0.5)] transition hover:scale-[1.03]"
            >
              ★ Start Final Round
            </button>
          ) : (
            <button
              onClick={() =>
                nextQuestionFn({
                  data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
                }).catch(() => {})
              }
              className="rounded-full border border-amber-300/50 bg-white/5 px-8 py-3 font-display font-bold uppercase tracking-wider text-amber-200 backdrop-blur transition hover:bg-white/10"
            >
              Next question →
            </button>
          )}
        </div>
      </div>
    );
  }

  // lobby — show start button overlay
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => {
            play("whoosh");
            setPhaseFn({
              data: {
                roomCode: room.roomCode,
                hostSessionId: room.hostSessionId,
                phase: "intro",
              },
            }).catch(() => {});
          }}
          className="rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-10 py-5 font-display text-xl font-black uppercase tracking-wider text-amber-950 shadow-[0_0_50px_oklch(0.85_0.18_85/0.55)] transition hover:scale-[1.03]"
        >
          🎬 Start the show
        </button>
        <button
          onClick={() => {
            play("whoosh");
            nextQuestionFn({
              data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
            }).catch(() => {});
          }}
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          Skip intro · jump straight to question
        </button>
        <button
          onClick={() =>
            setPhaseFn({
              data: {
                roomCode: room.roomCode,
                hostSessionId: room.hostSessionId,
                phase: "leaderboard",
              },
            }).catch(() => {})
          }
          className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          Show leaderboard
        </button>
      </div>
    </div>
  );
}

// Rounds: show leaderboard only at end of each round (every QUESTIONS_PER_ROUND),
// or at the final question. Between questions within a round, auto-advance to
// the next question after the reveal.
const QUESTIONS_PER_ROUND = 5;
const FINAL_ROUND_NUMBER = 15;

export function useRevealAutoAdvance(
  roomCode: string,
  hostSessionId: string,
  phase: string | undefined,
  roundNumber: number,
) {
  const setPhaseFn = useServerFn(setPhase);
  const nextQuestionFn = useServerFn(nextQuestion);
  useEffect(() => {
    if (phase !== "reveal") return;
    const endOfRound =
      roundNumber > 0 &&
      (roundNumber % QUESTIONS_PER_ROUND === 0 || roundNumber >= FINAL_ROUND_NUMBER);
    const id = window.setTimeout(() => {
      if (endOfRound) {
        setPhaseFn({
          data: { roomCode, hostSessionId, phase: "leaderboard" },
        }).catch(() => {});
      } else {
        nextQuestionFn({
          data: { roomCode, hostSessionId },
        }).catch(() => {});
      }
    }, 6000);
    return () => window.clearTimeout(id);
  }, [phase, roundNumber, roomCode, hostSessionId, setPhaseFn, nextQuestionFn]);
}
