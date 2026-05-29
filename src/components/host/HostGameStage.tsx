import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  dropWrongAnswer,
  endGame,
  endQuestion,
  nextQuestion,
  setPhase,
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
};

type Props = {
  room: { id: string; roomCode: string; hostSessionId: string };
};

const DROP_AT_S = [11, 7, 3]; // remaining seconds when each wrong answer drops

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
          "id, room_code, phase, current_question_text, current_answers, current_correct_index, question_started_at, question_duration_ms, dropped_indexes, wildcard, round_number",
        )
        .eq("id", room.id)
        .maybeSingle();
      if (!cancelled && r) setState(r as RoomState);
      const { data: ps } = await supabase
        .from("players")
        .select(
          "id, nickname, score, avatar_url, current_answer, current_round_score, current_round_fastest, streak_count, is_audience",
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

    // schedule drops
    DROP_AT_S.forEach((thresholdRemaining, idx) => {
      if (remainingS <= thresholdRemaining && !droppedRef.current.has(idx)) {
        droppedRef.current.add(idx);
        play("drop");
        dropWrongFn({
          data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
        }).catch(() => {});
      }
    });

    // Fast-forward when all non-audience players have locked
    const livePlayers = players.filter((p) => !p.is_audience);
    const allLocked =
      livePlayers.length > 0 && livePlayers.every((p) => p.current_answer !== null);
    const ffTriggerRemaining = 3;
    const shouldFastForwardEnd = allLocked && remainingS > ffTriggerRemaining && !endedRef.current;

    if ((remainingS <= 0 || shouldFastForwardEnd) && !endedRef.current) {
      endedRef.current = true;
      const delay = shouldFastForwardEnd ? ffTriggerRemaining * 1000 : 0;
      window.setTimeout(() => {
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
      }, delay);
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
    if (state.phase === "question") startMusic("tense", 380);
    else if (state.phase === "lobby") startMusic("lobby", 600);
    else stopMusic();
  }, [state?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null;

  const startMs = state.question_started_at
    ? new Date(state.question_started_at).getTime()
    : 0;
  const remainingS = state.question_started_at
    ? Math.max(0, state.question_duration_ms / 1000 - (now - startMs) / 1000)
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
        <QuestionStage
          questionText={state.current_question_text ?? ""}
          answers={state.current_answers ?? ["", "", "", ""]}
          droppedIndexes={state.dropped_indexes ?? []}
          correctIndex={state.phase === "reveal" ? state.current_correct_index : null}
          secondsLeft={remainingS}
          phase={state.phase as "question" | "reveal"}
          players={players.filter((p) => !p.is_audience)}
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
        </div>
      </div>
    );
  }

  if (state.phase === "leaderboard") {
    const isFinal = (state.round_number ?? 0) >= 15;
    return (
      <div className="flex h-full flex-col gap-6 p-8">
        <h2 className="text-center font-display text-4xl font-black">Standings</h2>
        <Leaderboard players={players.filter((p) => !p.is_audience)} />
        <div className="mt-auto flex justify-center gap-2">
          {isFinal ? (
            <button
              onClick={() =>
                endGameFn({
                  data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
                }).catch(() => {})
              }
              className="rounded-full bg-amber-400 px-6 py-3 font-semibold text-amber-950"
            >
              End game 🏁
            </button>
          ) : (
            <button
              onClick={() =>
                nextQuestionFn({
                  data: { roomCode: room.roomCode, hostSessionId: room.hostSessionId },
                }).catch(() => {})
              }
              className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground"
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

// Auto-advance from reveal → leaderboard after a delay
export function useRevealAutoAdvance(
  roomCode: string,
  hostSessionId: string,
  phase: string | undefined,
) {
  const setPhaseFn = useServerFn(setPhase);
  useEffect(() => {
    if (phase !== "reveal") return;
    const id = window.setTimeout(() => {
      setPhaseFn({
        data: { roomCode, hostSessionId, phase: "leaderboard" },
      }).catch(() => {});
    }, 3500);
    return () => window.clearTimeout(id);
  }, [phase, roomCode, hostSessionId, setPhaseFn]);
}
