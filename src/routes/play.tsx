import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { heartbeatPlayer, setAudienceMode } from "@/lib/rooms.functions";
import { lockAnswer, activate2x, triggerGlitch, submitWager, lockFinalAnswer } from "@/lib/game.functions";
import { loadPlayerSession, clearPlayerSession } from "@/lib/player-session";
import { supabase } from "@/integrations/supabase/client";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { AnswerGrid } from "@/components/AnswerGrid";
import { HeartbeatBackground } from "@/components/HeartbeatBackground";
import { AudienceSoundboard } from "@/components/AudienceSoundboard";
import { MemeScorecard, computeBadge } from "@/components/MemeScorecard";
import { Haptics } from "@/hooks/use-haptics";
import { play, startMusic, stopMusic } from "@/lib/sound-engine";
import { AccessibilityToggle } from "@/components/AccessibilityToggle";
import { t } from "@/lib/i18n";

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
  current_explanation: string | null;
  question_started_at: string | null;
  question_duration_ms: number;
  dropped_indexes: number[];
  is_paused: boolean;
  host_last_seen_at: string;
  wildcard: string | null;
  saboteur_session_id: string | null;
  glitch_active_until: string | null;
  glitch_used: boolean;
  round_number: number;
};

type Me = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  score: number;
  streak_count: number;
  is_audience: boolean;
  current_answer: number | null;
  current_round_score: number;
  last_answer_correct: boolean | null;
  used_2x: boolean;
  pending_2x: boolean;
  correct_count: number;
  wrong_count: number;
  fastest_count: number;
  best_streak: number;
  total_response_ms: number;
  answered_count: number;
  final_wager: number;
  final_answer: number | null;
  final_locked_at: string | null;
};

function PlayPage() {
  const navigate = useNavigate();
  const heartbeatFn = useServerFn(heartbeatPlayer);
  const setAudienceFn = useServerFn(setAudienceMode);
  const lockFn = useServerFn(lockAnswer);
  const activate2xFn = useServerFn(activate2x);
  const triggerGlitchFn = useServerFn(triggerGlitch);
  const submitWagerFn = useServerFn(submitWager);
  const lockFinalFn = useServerFn(lockFinalAnswer);
  const [allPlayers, setAllPlayers] = useState<{ session_id: string; score: number }[]>([]);
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
          "id, status, phase, current_category, current_question_text, current_answers, current_correct_index, current_explanation, question_started_at, question_duration_ms, dropped_indexes, is_paused, host_last_seen_at, wildcard, saboteur_session_id, glitch_active_until, glitch_used, round_number",
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
          "id, nickname, avatar_url, score, streak_count, is_audience, current_answer, current_round_score, last_answer_correct, used_2x, pending_2x, correct_count, wrong_count, fastest_count, best_streak, total_response_ms, answered_count, final_wager, final_answer, final_locked_at",
        )
        .eq("room_id", r.id)
        .eq("session_id", session.sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (p) setMe(p as Me);
    };

    void fetchAll();

    const loadAllPlayers = async () => {
      const { data: r2 } = await supabase
        .from("rooms")
        .select("id")
        .eq("room_code", session.roomCode)
        .maybeSingle();
      if (!r2) return;
      const { data: rows } = await supabase
        .from("players")
        .select("session_id, score")
        .eq("room_id", r2.id)
        .eq("is_audience", false)
        .order("score", { ascending: true });
      if (!cancelled && rows) setAllPlayers(rows);
    };
    void loadAllPlayers();

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
        { event: "*", schema: "public", table: "players" },
        (payload) => {
          const next = payload.new as Me & { session_id: string };
          if (next?.session_id === session.sessionId) setMe(next);
          void loadAllPlayers();
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
  const readSecondsLeft = room.question_started_at
    ? Math.max(0, (startMs - now) / 1000)
    : 0;
  const reading = readSecondsLeft > 0 && room.phase === "question";
  const remainingS = room.question_started_at
    ? Math.max(0, room.question_duration_ms / 1000 - Math.max(0, (now - startMs) / 1000))
    : null;

  // Wildcard derived state
  const iAmSaboteur =
    room.wildcard === "saboteur" &&
    !!room.saboteur_session_id &&
    session?.sessionId === room.saboteur_session_id;
  const rankedAsc = allPlayers; // ascending by score
  const myRankFromBottom = rankedAsc.findIndex((p) => p.session_id === session?.sessionId);
  const iAmLast = myRankFromBottom === 0 && rankedAsc.length > 1;
  const leaderSessionId = rankedAsc.length ? rankedAsc[rankedAsc.length - 1].session_id : null;
  const iAmLeader = leaderSessionId === session?.sessionId;
  const glitchActive =
    !!room.glitch_active_until && new Date(room.glitch_active_until).getTime() > now;
  const buttonsScrambled = iAmLeader && glitchActive;

  const toggleAudience = async () => {
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
  };

  const glitchLeader = async () => {
    if (!session) return;
    Haptics.wrong();
    try {
      await triggerGlitchFn({
        data: { roomCode: session.roomCode, sessionId: session.sessionId },
      });
    } catch {
      /* ignore */
    }
  };

  const pick = async (i: 0 | 1 | 2 | 3) => {
    if (!session) return;
    try {
      await lockFn({
        data: { roomCode: session.roomCode, sessionId: session.sessionId, answerIndex: i },
      });
    } catch {
      /* ignore */
    }
  };

  const activatePowerUp = async () => {
    if (!session) return;
    Haptics.correct();
    try {
      await activate2xFn({
        data: { roomCode: session.roomCode, sessionId: session.sessionId },
      });
    } catch {
      /* ignore */
    }
  };

  const [wagerDraft, setWagerDraft] = useState<number>(0);
  useEffect(() => {
    if (room?.phase === "final_wager" && !me?.final_locked_at) {
      setWagerDraft((w) => Math.min(w, me?.score ?? 0));
    }
  }, [room?.phase, me?.score, me?.final_locked_at]);

  const sendWager = async () => {
    if (!session) return;
    Haptics.tap();
    try {
      await submitWagerFn({
        data: { roomCode: session.roomCode, sessionId: session.sessionId, wager: wagerDraft },
      });
    } catch { /* ignore */ }
  };

  const pickFinal = async (i: 0 | 1 | 2 | 3) => {
    if (!session) return;
    Haptics.tap();
    try {
      await lockFinalFn({
        data: { roomCode: session.roomCode, sessionId: session.sessionId, answerIndex: i },
      });
    } catch { /* ignore */ }
  };



  return (
    <main className="relative h-screen overflow-hidden bg-background text-foreground">
      <HeartbeatBackground secondsLeft={room.phase === "question" ? remainingS : null} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(0.45_0.25_295/0.3),transparent_60%)]" />

      <div className="relative mx-auto flex h-screen max-w-md flex-col gap-4 p-4">
        <header className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">
          <span>Room {session.roomCode}</span>
          <AccessibilityToggle />
          <button
            onClick={() => {
              stopMusic();
              clearPlayerSession();
              navigate({ to: "/" });
            }}
            className="hover:text-foreground"
          >
            {t("leave")}
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
        ) : room.phase === "ended" ? (
          <div className="flex flex-1 items-center justify-center overflow-auto py-2">
            {me && (
              <MemeScorecard
                stats={{
                  nickname: me.nickname,
                  avatar_url: me.avatar_url,
                  score: me.score,
                  rank:
                    rankedAsc.length > 0
                      ? rankedAsc.length - rankedAsc.findIndex((p) => p.session_id === session.sessionId)
                      : 1,
                  totalPlayers: rankedAsc.length || 1,
                  correct: me.correct_count,
                  wrong: me.wrong_count,
                  bestStreak: me.best_streak,
                  fastestCount: me.fastest_count,
                  avgResponseMs:
                    me.answered_count > 0 ? Math.round(me.total_response_ms / me.answered_count) : 0,
                  badge: computeBadge({
                    rank:
                      rankedAsc.length > 0
                        ? rankedAsc.length - rankedAsc.findIndex((p) => p.session_id === session.sessionId)
                        : 1,
                    fastestCount: me.fastest_count,
                    wrong: me.wrong_count,
                    correct: me.correct_count,
                    bestStreak: me.best_streak,
                  }),
                  roomCode: session.roomCode,
                }}
              />
            )}
          </div>
        ) : (
          <>
            {/* Saboteur secret hint */}
            {iAmSaboteur &&
              room.phase === "question" &&
              room.current_correct_index !== null &&
              room.current_answers && (
                <div className="rounded-2xl border-2 border-amber-300/80 bg-amber-300/15 p-3 text-center">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200">
                    🕵 You are the Saboteur
                  </div>
                  <div className="mt-1 text-sm text-amber-100">
                    Trick the room! Earn double points for every wrong answer your friends pick.
                  </div>
                  <div className="mt-2 font-mono text-base font-black text-amber-300">
                    ✓ {room.current_answers[room.current_correct_index]}
                  </div>
                </div>
              )}

            {/* Glitch button — last place, round 10 */}
            {room.wildcard === "glitch" &&
              room.phase === "question" &&
              iAmLast &&
              !room.glitch_used && (
                <button
                  onClick={() => void glitchLeader()}
                  className="rounded-2xl border-2 border-fuchsia-400/70 bg-fuchsia-500/25 px-4 py-3 text-sm font-black uppercase tracking-widest text-fuchsia-100 active:scale-[0.98]"
                >
                  ⚡ Glitch the leader (5s)
                </button>
              )}

            {/* 2x power-up shown only between rounds */}
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

            {room.phase === "final_intro" ? (
              <div className="grid flex-1 place-items-center rounded-3xl border-2 border-amber-300/60 bg-gradient-to-br from-amber-500/20 via-black to-black p-6 text-center">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.5em] text-amber-300">One question. All on the line.</div>
                  <div className="mt-3 font-display text-5xl font-black text-amber-200 [animation:scale-in_0.5s_ease-out]">Final Round</div>
                </div>
              </div>
            ) : room.phase === "final_wager" ? (
              <div className="flex flex-1 flex-col gap-4 rounded-3xl border-2 border-amber-300/60 bg-gradient-to-br from-amber-500/15 via-card/40 to-black p-5">
                <div className="text-center">
                  <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-300">Place your wager</div>
                  <div className="mt-1 text-sm text-muted-foreground">0 to {me?.score ?? 0}</div>
                </div>
                {me?.final_locked_at ? (
                  <div className="grid flex-1 place-items-center">
                    <div className="text-center">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Wager locked</div>
                      <div className="mt-2 font-mono text-6xl font-black text-amber-300">{me?.final_wager ?? 0}</div>
                      <div className="mt-3 text-xs text-muted-foreground">Waiting for the question…</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-1 flex-col items-center justify-center gap-3">
                      <div className="font-mono text-6xl font-black text-amber-200">{wagerDraft}</div>
                      <input
                        type="range"
                        min={0}
                        max={me?.score ?? 0}
                        value={wagerDraft}
                        onChange={(e) => setWagerDraft(Number(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setWagerDraft(0)} className="rounded-full border border-border px-3 py-1 text-xs">0</button>
                        <button onClick={() => setWagerDraft(Math.floor((me?.score ?? 0) / 2))} className="rounded-full border border-border px-3 py-1 text-xs">½</button>
                        <button onClick={() => setWagerDraft(me?.score ?? 0)} className="rounded-full border border-border px-3 py-1 text-xs">All in</button>
                      </div>
                    </div>
                    <button
                      onClick={() => void sendWager()}
                      className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-4 font-display text-lg font-black uppercase tracking-wider text-amber-950 active:scale-[0.98]"
                    >
                      Lock wager
                    </button>
                  </>
                )}
              </div>
            ) : room.phase === "final_question" ? (
              <>
                <div className="rounded-2xl border-2 border-amber-300/60 bg-amber-500/10 p-3 text-center backdrop-blur">
                  <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-300">★ Final question · wagered {me?.final_wager ?? 0}</div>
                  <div className="line-clamp-3 text-sm font-semibold">{room.current_question_text}</div>
                  {remainingS !== null && (
                    <div className="mt-1 font-mono text-xl font-black">{Math.ceil(remainingS)}s</div>
                  )}
                </div>
                <div className="min-h-0 flex-1">
                  <AnswerGrid
                    disabled={false}
                    labels={(room.current_answers ?? ["", "", "", ""]) as [string, string, string, string]}
                    droppedIndexes={[]}
                    selectedIndex={me?.final_answer ?? null}
                    onPick={(i) => void pickFinal(i)}
                  />
                </div>
              </>
            ) : room.phase === "final_reveal" ? (
              <div className="grid flex-1 place-items-center rounded-3xl border-2 border-amber-300/60 bg-gradient-to-br from-amber-500/15 via-black to-black p-6 text-center">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.4em] text-amber-300">
                    {me?.last_answer_correct ? "Correct!" : "Wrong"}
                  </div>
                  <div className={`mt-2 font-mono text-5xl font-black ${(me?.current_round_score ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {(me?.current_round_score ?? 0) > 0 ? "+" : ""}{me?.current_round_score ?? 0}
                  </div>
                  <div className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">Final score</div>
                  <div className="font-mono text-4xl font-black text-amber-200">{me?.score ?? 0}</div>
                  {room.current_explanation && room.current_explanation.trim().length > 0 && (
                    <div className="mt-5 rounded-3xl border-2 border-amber-300/60 bg-gradient-to-br from-amber-400/20 to-amber-600/10 p-5 text-left shadow-[0_10px_40px_-15px_rgba(251,191,36,0.5)] animate-scale-in">
                      <div className="text-xs font-bold uppercase tracking-[0.35em] text-amber-300">
                        💡 Did you know?
                      </div>
                      <div className="mt-2 text-lg font-semibold leading-relaxed text-amber-50">
                        {room.current_explanation}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : room.phase === "question" || room.phase === "reveal" ? (
              <>
                <div className="rounded-2xl border border-border bg-card/30 p-3 text-center backdrop-blur">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {room.wildcard === "roast" ? "Roast vote" : "Question"}
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
                <div
                  className={`min-h-0 flex-1 transition ${
                    buttonsScrambled ? "rotate-1 scale-[1.02] blur-sm" : ""
                  }`}
                  style={
                    buttonsScrambled
                      ? { filter: "blur(8px) hue-rotate(80deg)" }
                      : undefined
                  }
                >
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
                {buttonsScrambled && (
                  <div className="absolute inset-x-0 top-1/2 z-30 -translate-y-1/2 text-center font-display text-3xl font-black tracking-widest text-fuchsia-300 drop-shadow">
                    G̷L̷I̷T̷C̷H̷E̷D̷
                  </div>
                )}
                {room.phase === "reveal" &&
                  room.current_explanation &&
                  room.current_explanation.trim().length > 0 && (
                    <div className="rounded-3xl border-2 border-amber-300/60 bg-gradient-to-br from-amber-400/20 to-amber-600/10 p-5 text-center shadow-[0_10px_40px_-15px_rgba(251,191,36,0.5)] animate-scale-in">
                      <div className="text-xs font-bold uppercase tracking-[0.35em] text-amber-300">
                        💡 Did you know?
                      </div>
                      <div className="mt-2 text-lg font-semibold leading-relaxed text-amber-50">
                        {room.current_explanation}
                      </div>
                    </div>
                  )}
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
