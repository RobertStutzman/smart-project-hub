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
} from "@/lib/game.functions";
import { QuestionStage } from "./QuestionStage";
import { Leaderboard } from "./Leaderboard";
import { ShatteredFaces } from "./ShatteredFaces";
import { TwitchPanel } from "./TwitchPanel";
import { AIRoast } from "./AIRoast";
import { play, startMusic, stopMusic } from "@/lib/sound-engine";

type RoomState = {
  id: string;
  room_code: string;
  phase: string;
  current_question_text: string | null;
  current_answers: string[] | null;
  current_correct_index: number | null;
  current_explanation: string | null;
  question_started_at: string | null;
  question_duration_ms: number;
  dropped_indexes: number[];
  wildcard: string | null;
  round_number: number;
};

type Player = {
  id: string;
  nickname: string;
  score: number;
  avatar_url: string | null;
  current_answer: number | null;
  current_round_score: number;
  current_round_fastest: boolean;
  streak_count: number;
  is_audience: boolean;
  final_wager: number;
  final_answer: number | null;
  final_locked_at: string | null;
};

type Props = {
  room: { id: string; roomCode: string; hostSessionId: string };
};

// Elapsed seconds (from question_started_at) at which each wrong answer drops.
// Driven off elapsed time so the elimination sequence ALWAYS plays out,
// even when every player locks in immediately.
const DROP_AT_ELAPSED_S = [4, 8, 11];
// After the final wrong answer drops, hold on the lone correct answer
// for this long before triggering endQuestion / reveal.
const FINAL_HOLD_MS = 1500;

export function HostGameStage({ room }: Props) {
  const [state, setState] = useState<RoomState | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const droppedRef = useRef<Set<number>>(new Set());
  const endedRef = useRef(false);

  const nextQuestionFn = useServerFn(nextQuestion);
  const dropWrongFn = useServerFn(dropWrongAnswer);
  const endQuestionFn = useServerFn(endQuestion);
  const setPhaseFn = useServerFn(setPhase);
  const endGameFn = useServerFn(endGame);
  const startFinalRoundFn = useServerFn(startFinalRound);
  const startFinalQuestionFn = useServerFn(startFinalQuestion);
  const scoreFinalRoundFn = useServerFn(scoreFinalRound);

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
          "id, room_code, phase, current_question_text, current_answers, current_correct_index, current_explanation, question_started_at, question_duration_ms, dropped_indexes, wildcard, round_number",
        )
        .eq("id", room.id)
        .maybeSingle();
      if (!cancelled && r) setState(r as RoomState);
      const { data: ps } = await supabase
        .from("players")
        .select(
          "id, nickname, score, avatar_url, current_answer, current_round_score, current_round_fastest, streak_count, is_audience, final_wager, final_answer, final_locked_at",
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
      play("whoosh");
      endQuestionFn({
        data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
      })
        .then(() => {
          const correct = livePlayers.some(
            (p) => p.current_answer === state.current_correct_index,
          );
          play(correct ? "correct" : "wrong");
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
    else if (state.phase === "lobby") startMusic("lobby", 600);
    else if (state.phase === "final_intro" || state.phase === "final_wager")
      startMusic("tense", 520);
    else stopMusic();
  }, [state?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Final round orchestrator ─────────────────────────────────────────
  const finalAdvancedRef = useRef<string>("");
  useEffect(() => {
    if (!state) return;
    const phase = state.phase;

    // Intro → wager after 5s
    if (phase === "final_intro") {
      const key = `intro-${state.id}`;
      if (finalAdvancedRef.current === key) return;
      const id = window.setTimeout(() => {
        finalAdvancedRef.current = key;
        setPhaseFn({
          data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId, phase: "final_wager" },
        }).catch(() => {});
      }, 5000);
      return () => window.clearTimeout(id);
    }

    // Wager → start question after 20s OR when all live players locked
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
        const id = window.setTimeout(fire, 800);
        return () => window.clearTimeout(id);
      }
      const id = window.setTimeout(fire, 20000);
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
          </div>
        )}
        <div className="absolute right-4 top-4 z-30 w-72">
          <TwitchPanel
            questionKey={state.question_started_at ?? state.current_question_text ?? ""}
            answers={state.current_answers ?? ["", "", "", ""]}
            droppedIndexes={state.dropped_indexes ?? []}
          />
        </div>
        <QuestionStage
          questionText={state.current_question_text ?? ""}
          answers={state.current_answers ?? ["", "", "", ""]}
          droppedIndexes={state.dropped_indexes ?? []}
          correctIndex={state.phase === "reveal" ? state.current_correct_index : null}
          secondsLeft={remainingS}
          readSecondsLeft={state.phase === "question" ? readSecondsLeft : 0}
          phase={state.phase as "question" | "reveal"}
          players={players.filter((p) => !p.is_audience)}
          explanation={state.phase === "reveal" ? state.current_explanation : null}
          mediaUrl={(state as { current_media_url?: string | null }).current_media_url ?? null}
          mediaType={(state as { current_media_type?: string | null }).current_media_type ?? null}
        />
        <ShatteredFaces victims={shatterVictims} triggerKey={shatterKey} />
      </>
    );
  }

  if (state.phase === "ended") {
    const live = players.filter((p) => !p.is_audience).sort((a, b) => b.score - a.score);
    const winner = live[0];
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Game over</div>
          <div className="mt-2 font-display text-6xl font-black">🏆 {winner?.nickname ?? "—"}</div>
          <div className="mt-1 font-mono text-2xl">{winner?.score ?? 0} pts</div>
          <div className="mt-6 text-sm text-muted-foreground">
            Players can tap "Export to socials" on their phones.
          </div>
          <AIRoast roomCode={room.roomCode} hostSessionId={room.hostSessionId} />
        </div>
      </div>
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
    const live = players.filter((p) => !p.is_audience);
    const locked = live.filter((p) => !!p.final_locked_at).length;
    const top3 = [...live].sort((a, b) => b.score - a.score).slice(0, 3);
    return (
      <div className="relative grid h-full grid-cols-2 gap-8 overflow-hidden bg-gradient-to-br from-black via-[oklch(0.12_0.05_280)] to-black p-10 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.85_0.18_85/0.18),transparent_60%)]" />
        <div className="relative">
          <div className="text-[10px] font-bold uppercase tracking-[0.5em] text-amber-300/90">
            Standings
          </div>
          <div className="mt-4 space-y-3">
            {top3.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-2xl border border-amber-300/20 bg-white/5 px-4 py-3 backdrop-blur"
              >
                <div className="flex items-center gap-3">
                  <span className="font-display text-2xl font-black text-amber-300">
                    {["①", "②", "③"][i]}
                  </span>
                  <span className="text-lg font-bold">{p.nickname}</span>
                </div>
                <span className="font-mono text-xl font-black">{p.score}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex flex-col items-center justify-center text-center">
          <div className="text-xs font-bold uppercase tracking-[0.5em] text-amber-300/90">
            Place your wager
          </div>
          <div className="mt-3 font-display text-5xl font-black leading-tight">
            All players are betting…
          </div>
          <div className="mt-8 font-mono text-7xl font-black text-amber-300">
            {locked}
            <span className="text-3xl text-amber-300/50"> / {live.length}</span>
          </div>
          <div className="mt-2 text-sm uppercase tracking-[0.3em] text-amber-200/70">
            wagers locked
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === "final_question") {
    return (
      <div className="relative h-full">
        <div className="pointer-events-none absolute inset-3 z-20 rounded-3xl ring-4 ring-amber-300/60 shadow-[inset_0_0_80px_oklch(0.85_0.18_85/0.25)]" />
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-amber-400/95 px-4 py-1 text-xs font-black uppercase tracking-[0.25em] text-amber-950 shadow">
          ★ Final question
        </div>
        <QuestionStage
          questionText={state.current_question_text ?? ""}
          answers={state.current_answers ?? ["", "", "", ""]}
          droppedIndexes={[]}
          correctIndex={null}
          secondsLeft={remainingS}
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
    const ranked = [...players]
      .filter((p) => !p.is_audience)
      .sort((a, b) => b.score - a.score);
    return (
      <div className="relative grid h-full place-items-center overflow-hidden bg-gradient-to-br from-black via-[oklch(0.10_0.05_280)] to-black p-8 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.85_0.18_85/0.18),transparent_60%)]" />
        <div className="relative w-full max-w-3xl">
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-[0.5em] text-amber-300/90">
              The answer was
            </div>
            <div
              className="mt-3 font-display text-5xl font-black text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, oklch(0.97 0.12 90), oklch(0.75 0.20 60))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
              }}
            >
              {correctText}
            </div>
          </div>
          {state.current_explanation && state.current_explanation.trim().length > 0 && (
            <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-amber-300/40 bg-amber-400/10 px-5 py-4 text-center backdrop-blur">
              <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-300/90">
                💡 Did you know?
              </div>
              <div className="mt-1 text-base font-medium leading-snug text-white/90 sm:text-lg">
                {state.current_explanation}
              </div>
            </div>
          )}
          <div className="mt-8 space-y-2">
            {ranked.map((p) => {
              const delta = p.current_round_score ?? 0;
              const correct = delta > 0;
              const noBet = (p.final_wager ?? 0) === 0;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 backdrop-blur ${
                    correct
                      ? "border-emerald-400/40 bg-emerald-400/10"
                      : noBet
                        ? "border-white/10 bg-white/5"
                        : "border-rose-400/40 bg-rose-400/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">{p.nickname}</span>
                    <span className="text-xs uppercase tracking-widest text-white/60">
                      wagered {p.final_wager ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`font-mono text-lg font-black ${
                        correct
                          ? "text-emerald-300"
                          : noBet
                            ? "text-white/40"
                            : "text-rose-300"
                      }`}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                    <span className="font-mono text-2xl font-black text-amber-300">
                      {p.score}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }


  if (state.phase === "leaderboard") {
    const isFinal = (state.round_number ?? 0) >= 15;
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
          <Leaderboard players={players.filter((p) => !p.is_audience)} />
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
            nextQuestionFn({
              data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
            }).catch(() => {});
          }}
          className="rounded-full bg-primary px-10 py-5 text-xl font-bold text-primary-foreground shadow-lg"
        >
          Start round
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
    }, 8000);
    return () => window.clearTimeout(id);
  }, [phase, roundNumber, roomCode, hostSessionId, setPhaseFn, nextQuestionFn]);
}
