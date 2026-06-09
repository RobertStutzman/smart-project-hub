import { useEffect, useMemo, useRef, useState } from "react";
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
import { QuestionStage, DROP_FALL_MS } from "./QuestionStage";
import { getRoundCallout, type WildcardKind } from "@/lib/round-callouts";
import { Leaderboard } from "./Leaderboard";
import { TwitchPanel } from "./TwitchPanel";
import { AIRoast } from "./AIRoast";
import { IntroStage } from "./IntroStage";
import { CreditsStage } from "./CreditsStage";
import { pickLine, speakPersona } from "@/lib/host-persona";
import { playVoiceUrl } from "@/lib/elf-voice";
import { speakAboutPlayer, setLiveRoomId, resetLiveCap } from "@/lib/persona-live";
import { play, playEvent, playRandomDrop, startMusic, stopMusic, duckMusic } from "@/lib/sound-engine";
import { playFunnySoundById, preloadFunnyBank } from "@/lib/funny-sounds";
import { FinalWagerStage, FinalRevealStage } from "./FinalStages";
import { WinnerSpotlight } from "./WinnerSpotlight";
import { RoundRecapReel } from "./RoundRecapReel";
import { RoundSplash } from "./RoundSplash";
import { WildcardBanner } from "./WildcardBanner";
import { QRCodeSVG } from "qrcode.react";

type RoomState = {
  id: string;
  room_code: string;
  phase: string;
  current_question_id: string | null;
  current_question_text: string | null;
  current_question_tts_url: string | null;
  current_explanation_tts_url: string | null;
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
  funny_sound_id: string | null;
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

// Stable empty fallbacks — avoid handing children a fresh [] on every tick
// (the timer ticks 4×/sec, and every prop identity change cascades into
// child memo invalidations).
const EMPTY_ANSWERS: string[] = ["", "", "", ""];
const EMPTY_DROPS: number[] = [];

export function HostGameStage({ room }: Props) {
  const [state, setState] = useState<RoomState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const droppedRef = useRef<Set<number>>(new Set());
  const dropSfxTimersRef = useRef<number[]>([]);
  const endedRef = useRef(false);
  const announcedJoinsRef = useRef<Set<string>>(new Set());
  const [recapDoneForRound, setRecapDoneForRound] = useState<number>(-1);
  const leaderboardAutoAdvanceRef = useRef<string>("");

  // Preload the funny-sound bank once so the first wrong drop is instant.
  useEffect(() => {
    preloadFunnyBank();
  }, []);

  // When new (non-audience) players join, queue an announcer line that names
  // them, drops a quip, then plays each player's assigned funny noise.
  // Batches 1–3 names; 4+ collapses to "and N more".
  const joinQueueRef = useRef<Array<{ name: string; sound: string | null; key: string }>>([]);
  const joinDrainingRef = useRef(false);
  useEffect(() => {
    for (const p of players) {
      if (p.is_audience) continue;
      const key = p.session_id ?? p.id;
      if (!key || announcedJoinsRef.current.has(key)) continue;
      announcedJoinsRef.current.add(key);
      joinQueueRef.current.push({ name: p.nickname, sound: p.funny_sound_id, key });
    }
    if (joinQueueRef.current.length === 0 || joinDrainingRef.current) return;
    joinDrainingRef.current = true;
    void (async () => {
      const { speakAsElf } = await import("@/lib/elf-voice");
      const { pickQuip } = await import("@/lib/join-banter");
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
        duckMusic(true);
        try {
          await speakAsElf(line, { preset: "hype", interrupt: false });
        } catch {
          /* silent */
        }
        duckMusic(false);
        // Play each named player's signature noise back-to-back
        for (const m of named) {
          playFunnySoundById(m.sound, m.key);
          await new Promise((r) => setTimeout(r, 550));
        }
      }
      joinDrainingRef.current = false;
    })();
  }, [players]);


  const nextQuestionFn = useServerFn(nextQuestion);
  const dropWrongFn = useServerFn(dropWrongAnswer);
  const endQuestionFn = useServerFn(endQuestion);
  const setPhaseFn = useServerFn(setPhase);
  const endGameFn = useServerFn(endGame);
  const startFinalRoundFn = useServerFn(startFinalRound);
  const startFinalQuestionFn = useServerFn(startFinalQuestion);
  const startSuddenDeathFn = useServerFn(startSuddenDeath);
  const resolveSuddenDeathFn = useServerFn(resolveSuddenDeath);
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
        setLiveRoomId(room.id);
        resetLiveCap(room.id);
        const res = await getPersonaCacheMap();
        if (!cancelled && res?.map) initPersonaCache(res.map);
      } catch {
        /* silent — falls back to live TTS */
      }
    })();
    return () => {
      cancelled = true;
      setLiveRoomId(null);
      void import("@/lib/elf-voice").then(({ setActiveRoomId }) => setActiveRoomId(null));
    };
  }, [room.id]);


  // Fetch room + players, subscribe to realtime
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: r } = await supabase
        .from("rooms")
        .select(
          "id, room_code, phase, current_question_id, current_question_text, current_question_tts_url, current_explanation_tts_url, current_answers, current_correct_index, current_explanation, question_started_at, question_duration_ms, dropped_indexes, wildcard, round_number, sudden_death_session_ids",
        )
        .eq("id", room.id)
        .maybeSingle();
      if (!cancelled && r) setState(r as RoomState);
      const { data: ps } = await supabase
        .from("players")
        .select(
          "id, session_id, nickname, score, avatar_url, current_answer, current_answer_locked_at, current_round_score, current_round_fastest, streak_count, is_audience, final_wager, final_answer, final_locked_at, best_streak, fastest_count, correct_count, wrong_count, comeback_bonus, funny_sound_id",
        )
        .eq("room_id", room.id)
        .order("created_at", { ascending: true });
      if (!cancelled && ps) {
        // Mark pre-existing players as already-announced so the host page
        // doesn't honk for every player on a refresh / mid-game open.
        for (const p of ps as Player[]) {
          const key = (p as Player).session_id ?? (p as Player).id;
          if (key) announcedJoinsRef.current.add(key);
        }
        setPlayers(ps as Player[]);
      }
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

    // 250ms is enough granularity for timer/drop orchestration and avoids
    // re-rendering this large component 10x/sec.
    const tick = window.setInterval(() => setNow(Date.now()), 250);

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
    for (const t of dropSfxTimersRef.current) window.clearTimeout(t);
    dropSfxTimersRef.current = [];
  }, [state?.question_started_at]);
  useEffect(() => {
    return () => {
      for (const t of dropSfxTimersRef.current) window.clearTimeout(t);
      dropSfxTimersRef.current = [];
    };
  }, []);

  // Play The Elf reading the question whenever a new one lands
  const questionTtsAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedQuestionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const qid = state?.current_question_id ?? null;
    const url = state?.current_question_tts_url ?? null;
    const phase = state?.phase;
    const startedAt = state?.question_started_at ?? null;
    // Only play during actual question phases, and only once per question
    if (!qid || !url || (phase !== "question" && phase !== "final_question")) {
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
      // Route through the shared voice queue with interrupt — question prompt
      // is the main event and should jump any in-flight persona line.
      void playVoiceUrl(url, {
        interrupt: true,
        onStart: () => duckMusic(true),
        onEnd: () => duckMusic(false),
      });
      // Keep ref non-null so the cleanup path below still no-ops safely.
      questionTtsAudioRef.current = null;
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

  // Play The Elf reading the "Did you know?" explanation once the full-screen
  // reveal card appears (~2.2s after reveal phase starts, matching QuestionStage).
  const explanationTtsAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedExplanationIdRef = useRef<string | null>(null);
  useEffect(() => {
    const qid = state?.current_question_id ?? null;
    const url = state?.current_explanation_tts_url ?? null;
    const phase = state?.phase;
    if (!qid || !url || phase !== "reveal") return;
    if (lastPlayedExplanationIdRef.current === qid) return;
    lastPlayedExplanationIdRef.current = qid;

    // Stop any previous explanation read
    if (explanationTtsAudioRef.current) {
      try {
        explanationTtsAudioRef.current.pause();
      } catch {
        /* ignore */
      }
      explanationTtsAudioRef.current = null;
    }

    // Match QuestionStage's tiles→fullscreen flip (~2200ms).
    const timer = window.setTimeout(() => {
      // Queue behind any in-flight persona reaction so they don't overlap.
      void playVoiceUrl(url, {
        onStart: () => duckMusic(true),
        onEnd: () => duckMusic(false),
      });
      explanationTtsAudioRef.current = null;
    }, 3800);

    return () => window.clearTimeout(timer);
  }, [state?.current_question_id, state?.current_explanation_tts_url, state?.phase]);

  // Reset the "played explanation" gate when we leave reveal so the next
  // question's explanation can play.
  useEffect(() => {
    if (state?.phase !== "reveal") {
      lastPlayedExplanationIdRef.current = null;
      if (explanationTtsAudioRef.current) {
        try {
          explanationTtsAudioRef.current.pause();
        } catch {
          /* ignore */
        }
        explanationTtsAudioRef.current = null;
      }
    }
  }, [state?.phase]);

  // Stop any lingering explanation read on unmount
  useEffect(() => {
    return () => {
      if (explanationTtsAudioRef.current) {
        try {
          explanationTtsAudioRef.current.pause();
        } catch {
          /* ignore */
        }
        explanationTtsAudioRef.current = null;
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
        dropWrongFn({
          data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
        })
          .then((res) => {
            const droppedIndex = res?.dropped;
            if (droppedIndex == null) return;
            // Identify guilty players for this tile.
            const guilty = players.filter(
              (p) => !p.is_audience && p.current_answer === droppedIndex,
            );
            if (guilty.length === 0) {
              // No one picked this — play the generic environmental drop.
              const sfxId = window.setTimeout(() => playRandomDrop(), DROP_FALL_MS);
              dropSfxTimersRef.current.push(sfxId);
              return;
            }
            // Each guilty player's signature funny noise IS the drop sound.
            // Stagger slightly so multiple players overlap into chaotic
            // comedy instead of one wall of sound. No generic SFX layered
            // on top — players' assigned sounds stay distinct and stable.
            guilty.forEach((p, i) => {
              const tid = window.setTimeout(
                () => playFunnySoundById(p.funny_sound_id, p.session_id ?? p.id),
                DROP_FALL_MS + i * 120,
              );
              dropSfxTimersRef.current.push(tid);
            });
          })
          .catch(() => {
            // If the server call fails, still play a generic drop so the
            // moment doesn't go silent.
            const sfxId = window.setTimeout(() => playRandomDrop(), DROP_FALL_MS);
            dropSfxTimersRef.current.push(sfxId);
          });
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

  // Tense music during question, lobby during lobby
  const ambienceHandedRef = useRef(false);
  useEffect(() => {
    if (!state) return;
    // On first transition out of "lobby", climax the crowd ambience
    // and hand off to the existing game-show music.
    if (state.phase !== "lobby" && !ambienceHandedRef.current) {
      ambienceHandedRef.current = true;
      void import("@/lib/ambience-engine").then((m) => m.climaxAndHandoff());
    } else if (state.phase === "lobby" && ambienceHandedRef.current) {
      // Returning to lobby (play again) — re-arm ambience for next start.
      ambienceHandedRef.current = false;
      void import("@/lib/ambience-engine").then((m) => {
        m.resetAmbience();
        m.startCrowd();
      });
    }
    if (state.phase === "question" || state.phase === "final_question")
      startMusic("tense", 380);
    else if (state.phase === "intro" || state.phase === "credits")
      startMusic("lobby", 600);
    else if (state.phase === "lobby") {
      // Lobby plays the trivia bed under the crowd ambience.
      startMusic("lobby", 600);
    } else if (state.phase === "final_intro" || state.phase === "final_wager")
      startMusic("tense", 520);
    else stopMusic();

    // Pause ember particles during active question phases — the screen is
    // already busy with tile animations + timer, and particles aren't visible
    // anyway. Frees up paint budget on low-end phones.
    const heavyPhase =
      state.phase === "question" || state.phase === "final_question";
    void import("@/components/ThemeParticles").then(({ setThemeParticlesEnabled }) =>
      setThemeParticlesEnabled(!heavyPhase),
    );
  }, [state?.phase]); // eslint-disable-line react-hooks/exhaustive-deps


  // Round intro sting + voice — only when transitioning INTO question phase
  // from a non-question phase. Announces "Round N!" only at the start of a
  // new round (Q1/6/11/16); other questions get neutral hype lines.
  const lastRoundStingRef = useRef<number>(0);
  const prevPhaseRef = useRef<string>("");
  useEffect(() => {
    if (!state) return;
    const q = state.round_number ?? 0;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;
    const enteringFromBreak =
      prev === "lobby" || prev === "leaderboard" || prev === "reveal" || prev === "";
    if (
      state.phase === "question" &&
      q > 0 &&
      q !== lastRoundStingRef.current &&
      enteringFromBreak
    ) {
      lastRoundStingRef.current = q;
      playEvent("round_intro");
      play("whoosh");
      const text = getRoundCallout({
        questionNumber: q,
        wildcard: (state.wildcard ?? null) as WildcardKind | null,
      });
      if (text) {
        duckMusic(true);
        import("@/lib/elf-voice").then(({ speakAsElf }) => {
          speakAsElf(text, { interrupt: true, preset: "hype" }).finally(() => duckMusic(false));
        }).catch(() => duckMusic(false));
      }

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
      // Let the cinematic sting breathe (~3s) before the persona line,
      // so the announcer doesn't talk over itself.
      const t = window.setTimeout(() => {
        duckMusic(true);
        Promise.resolve(speakPersona(pickLine("final_hype", state.round_number)))
          .finally(() => duckMusic(false));
      }, 3000);
      return () => window.clearTimeout(t);
    }
    else if (state.phase === "ended") playEvent("victory");
  }, [state?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaderboard is a TV-only interstitial: show it briefly, then continue.
  useEffect(() => {
    if (!state || state.phase !== "leaderboard") return;
    const completedQuestionNumber = state.round_number ?? 0;
    if (completedQuestionNumber <= 0 || recapDoneForRound !== completedQuestionNumber) return;

    const key = `${state.id}-${completedQuestionNumber}`;
    const id = window.setTimeout(() => {
      if (leaderboardAutoAdvanceRef.current === key) return;
      leaderboardAutoAdvanceRef.current = key;
      play("whoosh");
      if (completedQuestionNumber >= FINAL_ROUND_NUMBER) {
        startFinalRoundFn({
          data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
        }).catch(() => {});
      } else {
        nextQuestionFn({
          data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
        }).catch(() => {});
      }
    }, 4500);
    return () => window.clearTimeout(id);
  }, [state?.id, state?.phase, state?.round_number, recapDoneForRound, nextQuestionFn, startFinalRoundFn, room.roomCode, room.hostSessionId]);

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
    // Streak hype takes priority over the generic reaction when someone is on ≥3.
    const topStreaker = [...players]
      .filter((p) => !p.is_audience && p.current_answer === correctIdx)
      .sort((a, b) => (b.streak_count ?? 0) - (a.streak_count ?? 0))[0];
    const hasStreak = topStreaker && (topStreaker.streak_count ?? 0) >= 3;
    // Small delay so the line lands after the reveal sting, not on top of it.
    const id = window.setTimeout(() => {
      if (hasStreak && topStreaker) {
        void speakAboutPlayer({
          nickname: topStreaker.nickname,
          moment: "streak",
          streak: topStreaker.streak_count ?? 3,
        });
      } else {
        void speakPersona(pickLine(moment, qid));
      }
    }, 900);
    return () => window.clearTimeout(id);
  }, [state?.phase, state?.current_question_id, state?.current_correct_index, players]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-round name rotation so we don't just shout the fastest finger every Q
  const SLOTS = ["first_blood", "last_to_lock", "first_blood", "random_jab", "last_to_lock"] as const;
  type Slot = (typeof SLOTS)[number];
  const rotationSlot = (q: number): Slot => SLOTS[((q - 1) % 5 + 5) % 5];

  // Tracks which sessions already got a personalized line this round (clears
  // each new round) and all-game (preference signal for random_jab).
  const mentionedThisRoundRef = useRef<{ round: number; ids: Set<string> }>({ round: 0, ids: new Set() });
  const mentionedThisGameRef = useRef<Set<string>>(new Set());
  const markMentioned = (sessionId: string, q: number) => {
    const roundIdx = Math.ceil(Math.max(1, q) / 5);
    if (mentionedThisRoundRef.current.round !== roundIdx) {
      mentionedThisRoundRef.current = { round: roundIdx, ids: new Set() };
    }
    mentionedThisRoundRef.current.ids.add(sessionId);
    mentionedThisGameRef.current.add(sessionId);
  };

  // First-blood: fastest correct lock — only when the rotation slot calls for it.
  const firstBloodFiredRef = useRef<string>("");
  useEffect(() => {
    if (!state || state.phase !== "question") return;
    const qid = state.current_question_id;
    const correctIdx = state.current_correct_index;
    const q = state.round_number ?? 0;
    if (!qid || correctIdx === null) return;
    if (firstBloodFiredRef.current === qid) return;
    if (rotationSlot(q) !== "first_blood") return;
    const firstCorrect = players
      .filter((p) => !p.is_audience && p.current_answer === correctIdx && p.current_answer_locked_at)
      .sort((a, b) => {
        const ta = new Date(a.current_answer_locked_at!).getTime();
        const tb = new Date(b.current_answer_locked_at!).getTime();
        return ta - tb;
      })[0];
    if (!firstCorrect) return;
    firstBloodFiredRef.current = qid;
    markMentioned(firstCorrect.session_id, q);
    void speakAboutPlayer({ nickname: firstCorrect.nickname, moment: "first_blood" });
  }, [state?.phase, state?.current_question_id, state?.current_correct_index, state?.round_number, players]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reveal-time personalized callouts: elimination (priority), last_to_lock, random_jab.
  // Fires AFTER the reveal-reaction line so they sequence cleanly through the shared voice queue.
  const revealCalloutFiredRef = useRef<string>("");
  useEffect(() => {
    if (!state || state.phase !== "reveal") return;
    const qid = state.current_question_id;
    const correctIdx = state.current_correct_index;
    const q = state.round_number ?? 0;
    if (!qid || correctIdx === null) return;
    if (revealCalloutFiredRef.current === qid) return;
    const live = players.filter((p) => !p.is_audience);
    if (live.length === 0) return;

    // 1) Elimination override: a player who was on a 2+ streak just locked wrong.
    const brokenStreaker = live
      .filter(
        (p) =>
          p.current_answer !== null &&
          p.current_answer !== correctIdx &&
          (p.streak_count ?? 0) >= 2,
      )
      .sort((a, b) => (b.streak_count ?? 0) - (a.streak_count ?? 0))[0];

    let pick: { nickname: string; sessionId: string; moment: "elimination" | "last_to_lock" | "random_jab" } | null = null;

    if (brokenStreaker) {
      pick = {
        nickname: brokenStreaker.nickname,
        sessionId: brokenStreaker.session_id,
        moment: "elimination",
      };
    } else if (rotationSlot(q) === "last_to_lock") {
      // Latest lock among everyone who actually answered (correct or wrong).
      const answered = live.filter((p) => p.current_answer_locked_at);
      const lastP = [...answered].sort((a, b) => {
        const ta = new Date(a.current_answer_locked_at!).getTime();
        const tb = new Date(b.current_answer_locked_at!).getTime();
        return tb - ta;
      })[0];
      if (lastP) {
        pick = { nickname: lastP.nickname, sessionId: lastP.session_id, moment: "last_to_lock" };
      }
    } else if (rotationSlot(q) === "random_jab") {
      // Prefer a player NOT yet mentioned this game; fall back to this-round set.
      const game = mentionedThisGameRef.current;
      const roundSet = mentionedThisRoundRef.current.ids;
      const candidates = live.filter((p) => !game.has(p.session_id));
      const pool = candidates.length > 0
        ? candidates
        : live.filter((p) => !roundSet.has(p.session_id));
      const finalPool = pool.length > 0 ? pool : live;
      const seed = (qid.length * 17 + q * 31) >>> 0;
      const chosen = finalPool[seed % finalPool.length];
      if (chosen) {
        pick = { nickname: chosen.nickname, sessionId: chosen.session_id, moment: "random_jab" };
      }
    }

    if (!pick) return;
    revealCalloutFiredRef.current = qid;
    markMentioned(pick.sessionId, q);
    // 1800ms — lands after the 900ms reaction line and its ~0.8s playback.
    const id = window.setTimeout(() => {
      void speakAboutPlayer({ nickname: pick!.nickname, moment: pick!.moment });
    }, 1800);
    return () => window.clearTimeout(id);
  }, [state?.phase, state?.current_question_id, state?.current_correct_index, state?.round_number, players]); // eslint-disable-line react-hooks/exhaustive-deps



  // Leader-changed: when leaderboard phase opens, compare top scorer to prior round.
  const lastLeaderRef = useRef<string | null>(null);
  const leaderAnnouncedForRoundRef = useRef<number>(0);
  // Track per-player rank from prior leaderboard for comeback detection.
  const prevRankBySessionRef = useRef<Map<string, number>>(new Map());
  const comebackFiredForRoundRef = useRef<number>(0);
  // Track round-recap MVP firing per round number.
  const roundRecapFiredForRoundRef = useRef<number>(0);

  useEffect(() => {
    if (!state || state.phase !== "leaderboard") return;
    const round = state.round_number ?? 0;
    if (leaderAnnouncedForRoundRef.current === round) return;

    const ranked = [...players]
      .filter((p) => !p.is_audience)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const top = ranked[0];
    if (!top) return;
    leaderAnnouncedForRoundRef.current = round;

    // ── Leader change announcement (skip round 1) ──
    if (round >= 2) {
      const prev = lastLeaderRef.current;
      if (prev && prev !== top.session_id) {
        const id = window.setTimeout(() => {
          void speakAboutPlayer({
            nickname: top.nickname,
            moment: "leader_changed",
            roundNumber: round,
          });
        }, 1200);
        // best-effort, no cleanup needed beyond setting refs
        void id;
      }
    }
    lastLeaderRef.current = top.session_id;

    // ── Round MVP voice is owned by the RoundRecapReel (synced with beats). ──
    if (round >= 1 && roundRecapFiredForRoundRef.current !== round) {
      roundRecapFiredForRoundRef.current = round;
    }


    // ── Comeback: player who climbed 3+ ranks and is now top 3 ──
    if (round >= 2 && comebackFiredForRoundRef.current !== round) {
      comebackFiredForRoundRef.current = round;
      const prevMap = prevRankBySessionRef.current;
      type ComebackCandidate = { nickname: string; ranksClimbed: number };
      const candidates: ComebackCandidate[] = [];
      ranked.slice(0, 3).forEach((p, idx) => {
        const newRank = idx + 1;
        const prevRank = prevMap.get(p.session_id);
        if (prevRank && prevRank - newRank >= 3) {
          candidates.push({ nickname: p.nickname, ranksClimbed: prevRank - newRank });
        }
      });
      candidates.sort((a, b) => b.ranksClimbed - a.ranksClimbed);
      const cb = candidates[0];
      if (cb) {
        const id = window.setTimeout(() => {
          void speakAboutPlayer({
            nickname: cb.nickname,
            moment: "comeback",
            ranksClimbed: cb.ranksClimbed,
          });
        }, 5400);
        void id;
      }
    }

    // Snapshot ranks for next round's comeback comparison
    const nextMap = new Map<string, number>();
    ranked.forEach((p, idx) => nextMap.set(p.session_id, idx + 1));
    prevRankBySessionRef.current = nextMap;
  }, [state?.phase, state?.round_number, players]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Welcome roll call: fires once on first transition lobby → question ──
  const welcomeFiredRef = useRef(false);
  useEffect(() => {
    if (!state || welcomeFiredRef.current) return;
    if (state.phase !== "question") return;
    if ((state.round_number ?? 0) !== 1) return;
    welcomeFiredRef.current = true;
    const live = players.filter((p) => !p.is_audience && p.nickname);
    if (live.length === 0) return;
    // Pick up to 3 random nicknames
    const shuffled = [...live].sort(() => Math.random() - 0.5).slice(0, 3);
    const [first, ...rest] = shuffled.map((p) => p.nickname);
    // Land it during the question splash, before the question read.
    const id = window.setTimeout(() => {
      void speakAboutPlayer({
        nickname: first,
        extraNames: rest,
        moment: "welcome",
      });
    }, 400);
    return () => window.clearTimeout(id);
  }, [state?.phase, state?.round_number, players]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Final showdown: name the top 3 entering final_intro ──
  const finalShowdownFiredRef = useRef(false);
  useEffect(() => {
    if (!state || finalShowdownFiredRef.current) return;
    if (state.phase !== "final_intro") return;
    const top3 = [...players]
      .filter((p) => !p.is_audience)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 3);
    if (top3.length === 0) return;
    finalShowdownFiredRef.current = true;
    const [first, ...rest] = top3.map((p) => p.nickname);
    // Delay so it lands after the existing final hype sting.
    const id = window.setTimeout(() => {
      void speakAboutPlayer({
        nickname: first,
        extraNames: rest,
        moment: "final_showdown",
      });
    }, 2000);
    return () => window.clearTimeout(id);
  }, [state?.phase, players]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Winner crowning: fires once on phase → ended ──
  const winnerFiredRef = useRef(false);
  useEffect(() => {
    if (!state || winnerFiredRef.current) return;
    if (state.phase !== "ended") return;
    const winner = [...players]
      .filter((p) => !p.is_audience)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    if (!winner) return;
    winnerFiredRef.current = true;
    const id = window.setTimeout(() => {
      void speakAboutPlayer({ nickname: winner.nickname, moment: "winner" });
    }, 1500);
    return () => window.clearTimeout(id);
  }, [state?.phase, players]); // eslint-disable-line react-hooks/exhaustive-deps




  // ─── Final round orchestrator ─────────────────────────────────────────
  // Split into two effects: timer-driven phases (no `now` dep, so setTimeouts
  // aren't cancelled 4x/sec by the heartbeat) and poll-driven phases (need
  // `now` to detect when the question/sudden-death timer expires).
  const finalAdvancedRef = useRef<string>("");

  // Stable signatures so the timer effect doesn't re-run on every `players`
  // identity change. Locked-count flips wager → final_question fast.
  const phase = state?.phase;
  const stateId = state?.id;
  const suddenDeathKey = state?.sudden_death_session_ids?.join(",") ?? "";
  const finalLockedCount = useMemo(
    () => players.filter((p) => !p.is_audience && !!p.final_locked_at).length,
    [players],
  );
  const livePlayers = useMemo(
    () => players.filter((p) => !p.is_audience),
    [players],
  );
  const liveCount = livePlayers.length;
  const topScoreTied = useMemo(() => {
    if (phase !== "final_reveal") return false;
    const top = livePlayers.reduce((m, p) => Math.max(m, p.score), 0);
    return livePlayers.filter((p) => p.score === top).length > 1;
  }, [phase, livePlayers]);

  // Effect A — timer-based phase advances. NO `now` in deps.
  useEffect(() => {
    if (!state) return;

    // Intro splash → flip to wager after the dramatic beat plays
    if (phase === "final_intro") {
      const key = `intro-${stateId}`;
      if (finalAdvancedRef.current === key) return;
      const id = window.setTimeout(() => {
        finalAdvancedRef.current = key;
        setPhaseFn({
          data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId, phase: "final_wager" },
        }).catch(() => {});
      }, 4500);
      return () => window.clearTimeout(id);
    }

    // Wager → start question after 30s OR 1.5s after all live players locked
    if (phase === "final_wager") {
      const allLocked = liveCount > 0 && finalLockedCount >= liveCount;
      const key = `wager-${stateId}`;
      const fire = () => {
        if (finalAdvancedRef.current === key) return;
        finalAdvancedRef.current = key;
        startFinalQuestionFn({
          data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
        }).catch(() => {});
      };
      const delay = allLocked ? 1500 : 30000;
      const id = window.setTimeout(fire, delay);
      return () => window.clearTimeout(id);
    }

    // Reveal → end after 7s (skip when top score is tied; host triggers sudden death)
    if (phase === "final_reveal") {
      if (topScoreTied) return;
      const key = `reveal-${stateId}-${suddenDeathKey}`;
      if (finalAdvancedRef.current === key) return;
      const id = window.setTimeout(() => {
        finalAdvancedRef.current = key;
        endGameFn({
          data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
        }).catch(() => {});
      }, 7000);
      return () => window.clearTimeout(id);
    }

    // Ended → auto-roll credits after 20s
    if (phase === "ended") {
      const key = `ended-${stateId}`;
      if (finalAdvancedRef.current === key) return;
      const id = window.setTimeout(() => {
        finalAdvancedRef.current = key;
        play("whoosh");
        setPhaseFn({
          data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId, phase: "credits" },
        }).catch(() => {});
      }, 20000);
      return () => window.clearTimeout(id);
    }
  }, [phase, stateId, suddenDeathKey, finalLockedCount, liveCount, topScoreTied, setPhaseFn, startFinalQuestionFn, endGameFn, room.roomCode, room.hostSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect B — poll-based phase advances. Reads `now` to detect timer expiry.
  useEffect(() => {
    if (!state) return;

    // Final question → score when timer runs out
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

    // Sudden death → resolve when timer ends OR all cohort have locked
    if (phase === "sudden_death" && state.question_started_at) {
      const cohort = state.sudden_death_session_ids ?? [];
      const startMs = new Date(state.question_started_at).getTime();
      const remainingMs = state.question_duration_ms - (now - startMs);
      const cohortPlayers = players.filter((p) => cohort.includes(p.session_id));
      const allLocked =
        cohortPlayers.length > 0 &&
        cohortPlayers.every((p) => p.current_answer_locked_at !== null);
      if (remainingMs <= 0 || allLocked) {
        const key = `sd-${state.question_started_at}`;
        if (finalAdvancedRef.current === key) return;
        finalAdvancedRef.current = key;
        play("whoosh");
        resolveSuddenDeathFn({
          data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
        }).catch(() => {});
      }
    }
  }, [state, now, players, scoreFinalRoundFn, resolveSuddenDeathFn, room.roomCode, room.hostSessionId]);



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
        {state.phase === "question" && (
          <WildcardBanner
            wildcard={state.wildcard}
            triggerKey={state.question_started_at ?? state.current_question_text}
          />
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
          answers={state.current_answers ?? EMPTY_ANSWERS}
          droppedIndexes={state.dropped_indexes ?? EMPTY_DROPS}
          correctIndex={state.phase === "reveal" ? state.current_correct_index : null}
          secondsLeft={remainingS}
          totalS={state.question_duration_ms / 1000}
          readSecondsLeft={state.phase === "question" ? readSecondsLeft : 0}
          phase={state.phase as "question" | "reveal"}
          players={livePlayers}
          explanation={state.phase === "reveal" ? state.current_explanation : null}
          mediaUrl={(state as { current_media_url?: string | null }).current_media_url ?? null}
          mediaType={(state as { current_media_type?: string | null }).current_media_type ?? null}
          questionNumber={state.round_number ?? 1}
        />
        <RoundSplash round={Math.min(4, Math.ceil((state.round_number ?? 1) / 5))} />

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
    const resultsUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/results/${room.id}`
        : "";
    return (
      <WinnerSpotlight players={players}>
        <div className="flex flex-col items-center gap-4">
          {resultsUrl && (
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
              <div className="rounded-xl bg-white p-2">
                <QRCodeSVG value={resultsUrl} size={96} level="M" includeMargin={false} />
              </div>
              <div className="text-left">
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/80">
                  Scan to share results
                </div>
                <div className="mt-1 font-mono text-xs text-white/60">
                  {resultsUrl.replace(/^https?:\/\//, "")}
                </div>
              </div>
            </div>
          )}
          <AIRoast roomCode={room.roomCode} hostSessionId={room.hostSessionId} />
          <button
            data-host-primary="true"
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
        </div>
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
          answers={state.current_answers ?? EMPTY_ANSWERS}
          droppedIndexes={EMPTY_DROPS}
          correctIndex={null}
          secondsLeft={remainingS}
          totalS={totalS}
          phase="question"
          players={livePlayers}
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
    const live = players.filter((p) => !p.is_audience);
    const topScore = live.reduce((m, p) => Math.max(m, p.score), 0);
    const tied = live.filter((p) => p.score === topScore);
    const isTie = tied.length > 1;
    return (
      <div className="relative h-full">
        <FinalRevealStage
          correctText={correctText}
          explanation={state.current_explanation}
          players={players}
          revealKey={revealKey}
          prevLeaderId={prevLeaderId}
        />
        {isTie && (
          <div className="pointer-events-auto absolute inset-x-0 bottom-8 z-40 flex flex-col items-center gap-3">
            <div className="rounded-full bg-rose-500/90 px-5 py-1.5 text-xs font-black uppercase tracking-[0.3em] text-white shadow-[0_10px_30px_-10px_rgba(244,63,94,0.7)] animate-pulse">
              ⚔ Tied at {topScore} — {tied.map((p) => p.nickname).join(" & ")}
            </div>
            <button
              data-host-primary="true"
              onClick={() => {
                play("whoosh");
                startSuddenDeathFn({
                  data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
                }).catch(() => {});
              }}
              className="rounded-full bg-gradient-to-b from-rose-400 to-rose-600 px-8 py-3 font-display text-lg font-black uppercase tracking-wider text-white shadow-[0_0_50px_oklch(0.65_0.25_25/0.6)] transition hover:scale-[1.03]"
            >
              ⚡ Sudden Death
            </button>
          </div>
        )}
      </div>
    );
  }

  if (state.phase === "sudden_death") {
    const cohort = state.sudden_death_session_ids ?? [];
    const cohortPlayers = players.filter((p) => cohort.includes(p.session_id));
    return (
      <div
        className="relative h-full"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 30%, oklch(0.25 0.18 25 / 0.95), oklch(0.06 0.05 25) 80%)",
        }}
      >
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-rose-500/95 px-5 py-1.5 text-xs font-black uppercase tracking-[0.3em] text-white shadow animate-pulse">
          ⚔ Sudden Death · {cohortPlayers.map((p) => p.nickname).join(" vs ")}
        </div>
        <QuestionStage
          questionText={state.current_question_text ?? ""}
          answers={state.current_answers ?? ["", "", "", ""]}
          droppedIndexes={[]}
          correctIndex={null}
          secondsLeft={remainingS}
          totalS={state.question_duration_ms / 1000}
          phase="question"
          players={cohortPlayers}
          mediaUrl={null}
          mediaType={null}
        />
      </div>
    );
  }




  if (state.phase === "leaderboard") {
    const completedQuestionNumber = state.round_number ?? 0;
    const isFinal = completedQuestionNumber >= FINAL_ROUND_NUMBER;
    // Reuse the memoized livePlayers from the top of the component (stable identity).
    const recapNeeded = recapDoneForRound !== completedQuestionNumber;
    const recapRoundDisplay = getCompletedRoundNumber(completedQuestionNumber);
    if (recapNeeded) {
      return (
        <RoundRecapReel
          players={livePlayers}
          roundNumber={recapRoundDisplay}
          triggerKey={completedQuestionNumber}
          onDone={() => setRecapDoneForRound(completedQuestionNumber)}
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
            Round {recapRoundDisplay} {isFinal ? "— Final" : ""}
          </div>
          <h2 className="mt-2 font-display text-5xl font-black text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)] sm:text-6xl">
            Standings
          </h2>
          <div className="mx-auto mt-3 h-[2px] w-24 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
        </div>

        <div className="relative flex-1">
          <Leaderboard players={livePlayers} />
        </div>

        <div className="relative mt-auto flex flex-col items-center gap-3">
          <div className="rounded-full border border-amber-300/35 bg-white/5 px-6 py-2.5 text-center font-display text-sm font-bold uppercase tracking-[0.25em] text-amber-200 backdrop-blur">
            {isFinal ? "Final round incoming…" : `Round ${recapRoundDisplay + 1} incoming…`}
          </div>
          <div className="h-1 w-64 overflow-hidden rounded-full bg-white/10">
            <div
              key={`bar-${completedQuestionNumber}`}
              className="h-full bg-gradient-to-r from-amber-300 to-amber-500"
              style={{ animation: "recap-bar 4500ms linear forwards" }}
            />
          </div>
        </div>
      </div>
    );
  }

  // lobby — show start button overlay
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="flex flex-col items-center gap-4">
        <button
          data-host-primary="true"
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
const FINAL_ROUND_NUMBER = 21;

function getCompletedRoundNumber(completedQuestionNumber: number) {
  return Math.max(1, Math.floor(Math.max(1, completedQuestionNumber) / QUESTIONS_PER_ROUND));
}

export function useRevealAutoAdvance(
  roomCode: string,
  hostSessionId: string,
  phase: string | undefined,
  roundNumber: number,
  hasExplanationTts: boolean = true,
) {
  const setPhaseFn = useServerFn(setPhase);
  const nextQuestionFn = useServerFn(nextQuestion);
  useEffect(() => {
    if (phase !== "reveal") return;
    const endOfRound =
      roundNumber > 0 &&
      (roundNumber % QUESTIONS_PER_ROUND === 0 || roundNumber >= FINAL_ROUND_NUMBER);

    // Reveal card animates in over ~3.8s before "Did you know?" starts playing.
    // Give it that much plus a small margin to actually start speaking.
    const SPEECH_START_DEADLINE_MS = hasExplanationTts ? 7000 : 4500;
    const SAFETY_CAP_MS = 45000; // only catches stuck/never-ending audio
    const POLL_MS = 200;
    const start = Date.now();

    let pollId: number | null = null;
    let advanced = false;
    let cancelled = false;
    let sawSpeech = false;

    const advance = () => {
      if (advanced || cancelled) return;
      advanced = true;
      if (endOfRound) {
        setPhaseFn({
          data: { roomCode, hostSessionId, phase: "leaderboard" },
        }).catch(() => {});
      } else {
        nextQuestionFn({
          data: { roomCode, hostSessionId },
        }).catch(() => {});
      }
    };

    void import("@/lib/elf-voice").then(({ isElfSpeaking }) => {
      if (advanced || cancelled) return;
      pollId = window.setInterval(() => {
        if (cancelled) {
          if (pollId !== null) window.clearInterval(pollId);
          pollId = null;
          return;
        }
        const elapsed = Date.now() - start;
        const speaking = isElfSpeaking();
        if (speaking) {
          sawSpeech = true;
          if (elapsed >= SAFETY_CAP_MS) {
            if (pollId !== null) window.clearInterval(pollId);
            pollId = null;
            advance();
          }
          return;
        }
        // Not currently speaking.
        if (sawSpeech) {
          // She started and finished — go now.
          if (pollId !== null) window.clearInterval(pollId);
          pollId = null;
          advance();
          return;
        }
        // She never started. If we've waited long enough for the read to
        // kick in and it didn't, there's no narration — advance.
        if (elapsed >= SPEECH_START_DEADLINE_MS) {
          if (pollId !== null) window.clearInterval(pollId);
          pollId = null;
          advance();
        }
      }, POLL_MS);
    });

    return () => {
      cancelled = true;
      if (pollId !== null) {
        window.clearInterval(pollId);
        pollId = null;
      }
    };
  }, [phase, roundNumber, roomCode, hostSessionId, setPhaseFn, nextQuestionFn, hasExplanationTts]);
}
