import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { heartbeatPlayer, setAudienceMode } from "@/lib/rooms.functions";
import { lockAnswer, activate2x, triggerGlitch } from "@/lib/game.functions";
import { loadPlayerSession, clearPlayerSession } from "@/lib/player-session";
import { supabase } from "@/integrations/supabase/client";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { AnswerGrid } from "@/components/AnswerGrid";
import { HeartbeatBackground } from "@/components/HeartbeatBackground";
import { AudienceSoundboard } from "@/components/AudienceSoundboard";
import { MemeScorecard, computeBadge } from "@/components/MemeScorecard";
import { Haptics } from "@/hooks/use-haptics";
import { play, startMusic, stopMusic } from "@/lib/sound-engine";

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
  phase: string;
  current_category: string | null;
  current_question_text: string | null;
  current_answers: string[] | null;
  current_correct_index: number | null;
  question_started_at: string | null;
  question_duration_ms: number;
  dropped_indexes: number[];
  is_paused: boolean;
  host_last_seen_at: string;
};

type Me = {
  id: string;
  nickname: string;
  score: number;
  streak_count: number;
  is_audience: boolean;
  current_answer: number | null;
  current_round_score: number;
  last_answer_correct: boolean | null;
  used_2x: boolean;
  pending_2x: boolean;
};

function PlayPage() {
  const navigate = useNavigate();
  const heartbeatFn = useServerFn(heartbeatPlayer);
  const setAudienceFn = useServerFn(setAudienceMode);
  const lockFn = useServerFn(lockAnswer);
  const activate2xFn = useServerFn(activate2x);
  useWakeLock(true);

  const [session, setSession] = useState<ReturnType<typeof loadPlayerSession>>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [eliminatedFlash, setEliminatedFlash] = useState(false);
  const lastDroppedSig = useRef("");

  useEffect(() => {
    const s = loadPlayerSession();
    if (!s) {
      navigate({ to: "/join" });
      return;
    }
    setSession(s);
  }, [navigate]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const fetchAll = async () => {
      const { data: r } = await supabase
        .from("rooms")
        .select(
          "id, status, phase, current_category, current_question_text, current_answers, current_correct_index, question_started_at, question_duration_ms, dropped_indexes, is_paused, host_last_seen_at",
        )
        .eq("room_code", session.roomCode)
        .maybeSingle();
      if (cancelled) return;
      if (!r) {
        clearPlayerSession();
        navigate({ to: "/join" });
        return;
      }
      setRoom(r as RoomState);
      const { data: p } = await supabase
        .from("players")
        .select(
          "id, nickname, score, streak_count, is_audience, current_answer, current_round_score, last_answer_correct, used_2x, pending_2x",
        )
        .eq("room_id", r.id)
        .eq("session_id", session.sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (p) setMe(p as Me);
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

    const tick = setInterval(() => setNow(Date.now()), 200);

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      clearInterval(heartbeat);
      clearInterval(tick);
    };
  }, [session, heartbeatFn, navigate]);

  // Music
  useEffect(() => {
    if (!room) return;
    if (room.phase === "question") startMusic("tense", 380);
    else if (room.phase === "lobby") startMusic("lobby", 540);
    else stopMusic();
    return () => stopMusic();
  }, [room?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect when MY selected answer just got dropped
  useEffect(() => {
    if (!room || !me) return;
    const sig = `${room.current_question_text}|${(room.dropped_indexes ?? []).join(",")}`;
    if (sig === lastDroppedSig.current) return;
    lastDroppedSig.current = sig;
    if (
      me.current_answer !== null &&
      (room.dropped_indexes ?? []).includes(me.current_answer)
    ) {
      Haptics.wrong();
      play("wrong");
      setEliminatedFlash(true);
      window.setTimeout(() => setEliminatedFlash(false), 1400);
    }
  }, [room?.dropped_indexes, room?.current_question_text, me?.current_answer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reveal feedback haptics
  useEffect(() => {
    if (room?.phase !== "reveal" || me?.last_answer_correct === null) return;
    if (me?.last_answer_correct) {
      Haptics.correct();
    } else if (me?.last_answer_correct === false) {
      Haptics.wrong();
    }
  }, [room?.phase, me?.last_answer_correct]);

  if (!session || !room) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        Loading…
      </main>
    );
  }

  const hostStale = now - new Date(room.host_last_seen_at).getTime() > 15000;
  const paused = room.is_paused || hostStale;
  const isAudience = me?.is_audience ?? false;

  const startMs = room.question_started_at
    ? new Date(room.question_started_at).getTime()
    : 0;
  const remainingS = room.question_started_at
    ? Math.max(0, room.question_duration_ms / 1000 - (now - startMs) / 1000)
    : null;

  async function toggleAudience() {
    if (!session) return;
    Haptics.tap();
    try {
      await setAudienceFn({
        data: {
          roomCode: session.roomCode,
          sessionId: session.sessionId,
          isAudience: !isAudience,
        },
      });
    } catch {
      /* ignore */
    }
  }

  async function pick(i: 0 | 1 | 2 | 3) {
    if (!session) return;
    try {
      await lockFn({
        data: { roomCode: session.roomCode, sessionId: session.sessionId, answerIndex: i },
      });
    } catch {
      /* ignore */
    }
  }

  async function activatePowerUp() {
    if (!session) return;
    Haptics.correct();
    try {
      await activate2xFn({
        data: { roomCode: session.roomCode, sessionId: session.sessionId },
      });
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="relative h-screen overflow-hidden bg-background text-foreground">
      <HeartbeatBackground secondsLeft={room.phase === "question" ? remainingS : null} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(0.45_0.25_295/0.3),transparent_60%)]" />

      <div className="relative mx-auto flex h-screen max-w-md flex-col gap-4 p-4">
        <header className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-muted-foreground">
          <span>Room {session.roomCode}</span>
          <button
            onClick={() => {
              stopMusic();
              clearPlayerSession();
              navigate({ to: "/" });
            }}
            className="hover:text-foreground"
          >
            Leave
          </button>
        </header>

        <div className="rounded-2xl border border-border bg-card/50 p-4 backdrop-blur">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {isAudience ? "Audience" : "Player"}
              </div>
              <div className="text-xl font-bold">{me?.nickname ?? session.nickname}</div>
            </div>
            {!isAudience && (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Score
                </div>
                <div className="font-mono text-2xl font-black">{me?.score ?? 0}</div>
              </div>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {!isAudience && (me?.streak_count ?? 0) >= 3 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                🔥 {me?.streak_count} streak · 1.1×
              </span>
            )}
            {!isAudience && me?.pending_2x && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-400/20 px-2.5 py-0.5 text-xs font-semibold text-violet-300">
                2× armed
              </span>
            )}
          </div>
          <button
            onClick={() => void toggleAudience()}
            className="mt-3 w-full rounded-lg border border-dashed border-border/70 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            Switch to {isAudience ? "player" : "audience"} mode
          </button>
        </div>

        {isAudience ? (
          <AudienceSoundboard roomCode={session.roomCode} />
        ) : (
          <>
            {/* 2x power-up shown only between rounds (lobby / leaderboard / reveal) */}
            {!me?.used_2x &&
              !me?.pending_2x &&
              (room.phase === "lobby" ||
                room.phase === "leaderboard" ||
                room.phase === "reveal") && (
                <button
                  onClick={() => void activatePowerUp()}
                  className="rounded-2xl border-2 border-violet-400/60 bg-violet-500/20 px-4 py-3 text-sm font-bold text-violet-100 active:scale-[0.98]"
                >
                  ⚡ Arm Blind 2× for next question
                </button>
              )}

            {room.phase === "question" || room.phase === "reveal" ? (
              <>
                <div className="rounded-2xl border border-border bg-card/30 p-3 text-center backdrop-blur">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Question
                  </div>
                  <div className="line-clamp-2 text-sm font-semibold">
                    {room.current_question_text}
                  </div>
                  {remainingS !== null && room.phase === "question" && (
                    <div className="mt-1 font-mono text-xl font-black">
                      {Math.ceil(remainingS)}s
                    </div>
                  )}
                </div>
                <div className="min-h-0 flex-1">
                  <AnswerGrid
                    disabled={room.phase !== "question"}
                    labels={
                      (room.current_answers ?? ["", "", "", ""]) as [
                        string,
                        string,
                        string,
                        string,
                      ]
                    }
                    droppedIndexes={room.dropped_indexes ?? []}
                    selectedIndex={me?.current_answer ?? null}
                    onPick={(i) => void pick(i)}
                  />
                </div>
              </>
            ) : (
              <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                {room.phase === "leaderboard"
                  ? "See the TV for standings — next round soon."
                  : "Waiting for the host to start…"}
              </div>
            )}
          </>
        )}
      </div>

      {/* Eliminated-answer flash */}
      {eliminatedFlash && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-rose-600/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-4xl font-black">ANSWER ELIMINATED!</div>
            <div className="mt-2 text-lg font-semibold">CHOOSE AGAIN</div>
          </div>
        </div>
      )}

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
