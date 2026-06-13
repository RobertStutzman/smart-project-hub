import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { heartbeatPlayer, setAudienceMode } from "@/lib/rooms.functions";
import { lockAnswer, activate2x, triggerGlitch, submitWager, lockFinalAnswer } from "@/lib/game.functions";
import { loadPlayerSession, clearPlayerSession } from "@/lib/player-session";
import { supabase } from "@/integrations/supabase/client";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { AnswerGrid } from "@/components/AnswerGrid";
import { mirrorLetters } from "@/lib/wildcards";
import { HeartbeatBackground } from "@/components/HeartbeatBackground";
import { AudienceSoundboard } from "@/components/AudienceSoundboard";

import { Haptics } from "@/hooks/use-haptics";
import { play, stopMusic } from "@/lib/sound-engine";
import { AccessibilityToggle } from "@/components/AccessibilityToggle";
import { PlayerWagerStage } from "@/components/play/PlayerWagerStage";
import { PlayerVictoryScreen } from "@/components/play/PlayerVictoryScreen";
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
  sudden_death_session_ids: string[] | null;
};

type Me = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  score: number;
  streak_count: number;
  is_audience: boolean;
  current_answer: number | null;
  current_answer_locked_at: string | null;
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
  comeback_bonus: boolean;
  team: "red" | "blue" | null;
  session_id: string;
};

type LobbyPlayer = {
  id: string;
  session_id: string;
  nickname: string;
  avatar_url: string | null;
  score: number;
  current_answer: number | null;
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
  const [allPlayers, setAllPlayers] = useState<LobbyPlayer[]>([]);
  useWakeLock(true);

  const [session, setSession] = useState<ReturnType<typeof loadPlayerSession>>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [eliminatedFlash, setEliminatedFlash] = useState(false);
  const [wagerDraft, setWagerDraft] = useState<number>(0);
  const lastDroppedSig = useRef("");
  const [wrongPicks, setWrongPicks] = useState<number[]>([]);
  const wrongPicksQuestionRef = useRef<string | null>(null);

  // Compute and apply a server-clock offset from a freshly-received row's
  // host_last_seen_at (server-written ISO). Guards against device clock skew
  // which would otherwise leave the "reading" lead-in stuck on and the
  // answer tiles greyed out / disabled.
  const applyServerOffset = (hostLastSeenAt?: string | null) => {
    if (!hostLastSeenAt) return;
    const serverMs = Date.parse(hostLastSeenAt);
    if (!Number.isFinite(serverMs)) return;
    const localMs = Date.now();
    // Only trust recent heartbeats (host alive within ~30s by local clock).
    if (Math.abs(localMs - serverMs) > 5 * 60 * 1000) return;
    setServerOffsetMs(serverMs - localMs);
  };

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
          "id, status, phase, current_category, current_question_text, current_answers, current_correct_index, current_explanation, question_started_at, question_duration_ms, dropped_indexes, is_paused, host_last_seen_at, wildcard, saboteur_session_id, glitch_active_until, glitch_used, round_number, sudden_death_session_ids",
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
      applyServerOffset((r as RoomState).host_last_seen_at);
      const { data: p } = await supabase
        .from("players")
        .select(
          "id, session_id, nickname, avatar_url, score, streak_count, is_audience, current_answer, current_answer_locked_at, current_round_score, last_answer_correct, used_2x, pending_2x, correct_count, wrong_count, fastest_count, best_streak, total_response_ms, answered_count, final_wager, final_answer, final_locked_at, comeback_bonus, team",
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
        .select("id, session_id, nickname, avatar_url, score, current_answer")
        .eq("room_id", r2.id)
        .eq("is_audience", false)
        .order("score", { ascending: true });
      if (!cancelled && rows) setAllPlayers(rows as LobbyPlayer[]);
    };

    void loadAllPlayers();

    const channel = supabase
      .channel(`play-${session.roomCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `room_code=eq.${session.roomCode}` },
        (payload) => {
          if (payload.new) {
            const next = payload.new as RoomState;
            setRoom(next);
            applyServerOffset(next.host_last_seen_at);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        (payload) => {
          const next = payload.new as (Me & { session_id: string; is_audience?: boolean }) | null;
          if (!next) return;
          if (next.session_id === session.sessionId) setMe(next);
          // Apply incremental update to allPlayers instead of refetching the whole list
          if (!next.is_audience) {
            setAllPlayers((prev) => {
              const idx = prev.findIndex((p) => p.id === next.id);
              if (idx === -1) {
                // New player joined — fall back to a full refresh
                void loadAllPlayers();
                return prev;
              }
              const copy = prev.slice();
              copy[idx] = { ...copy[idx], ...next } as LobbyPlayer;
              return copy.sort((a, b) => a.score - b.score);
            });
          }
        },

      )
      .subscribe();

    const heartbeat = setInterval(() => {
      heartbeatFn({
        data: { roomCode: session.roomCode, sessionId: session.sessionId },
      }).catch(() => {});
    }, 15000);

    // Stable clock — always ticks while mounted. Used by the question read /
    // countdown logic; phone never plays background music.
    const tick = setInterval(() => setNow(Date.now()), 250);


    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      clearInterval(heartbeat);
      clearInterval(tick);
    };
  }, [session, heartbeatFn, navigate]);

  // Stop any music that might have been started by an older build when leaving.
  useEffect(() => {
    return () => stopMusic();
  }, []);

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
      window.setTimeout(() => setEliminatedFlash(false), 700);
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

  // Reset local wrong-pick memory whenever the question changes or we leave question phase.
  useEffect(() => {
    const qid = room?.current_question_text ?? null;
    if (wrongPicksQuestionRef.current !== qid) {
      wrongPicksQuestionRef.current = qid;
      setWrongPicks([]);
    }
  }, [room?.current_question_text]);
  useEffect(() => {
    if (room?.phase !== "question" && wrongPicks.length > 0) setWrongPicks([]);
  }, [room?.phase, wrongPicks.length]);

  useEffect(() => {
    if (room?.phase === "final_wager" && !me?.final_locked_at) {
      setWagerDraft((w) => Math.min(w, me?.score ?? 0));
    }
  }, [room?.phase, me?.score, me?.final_locked_at]);

  if (!session || !room) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-white/75">
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
  // Use server-adjusted clock so device clock skew can't lock the tiles.
  const serverNow = now + serverOffsetMs;
  const rawReadSecondsLeft = room.question_started_at
    ? Math.max(0, (startMs - serverNow) / 1000)
    : 0;
  // Belt-and-suspenders: lead-in is at most ~6s. If we think it's > 10s,
  // assume our offset is wrong and unlock the tiles.
  const readSecondsLeft = rawReadSecondsLeft > 10 ? 0 : rawReadSecondsLeft;
  const reading = readSecondsLeft > 0 && room.phase === "question";
  const remainingS = room.question_started_at
    ? Math.max(0, room.question_duration_ms / 1000 - Math.max(0, (serverNow - startMs) / 1000))
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
    Haptics.tap();
    try {
      await lockFn({
        data: { roomCode: session.roomCode, sessionId: session.sessionId, answerIndex: i },
      });
      Haptics.lock();
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
    <main className="relative h-[100dvh] overflow-hidden bg-gradient-to-b from-[oklch(0.32_0.07_275)] via-[oklch(0.28_0.06_280)] to-[oklch(0.32_0.07_275)] text-white">
      <HeartbeatBackground secondsLeft={room.phase === "question" ? remainingS : null} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(0.7_0.18_295/0.25),transparent_65%)]" />

      <div className="relative mx-auto flex h-[100dvh] min-h-0 max-w-md flex-col gap-3 p-4">

        <header className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.25em] text-white/75">
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

        <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/75">
                {isAudience ? "Audience" : "Player"}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xl font-bold">{me?.nickname ?? session.nickname}</div>
                {me?.team === "red" && (
                  <span className="rounded-full border border-rose-400/50 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-200">
                    🔴 Red Team
                  </span>
                )}
                {me?.team === "blue" && (
                  <span className="rounded-full border border-sky-400/50 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-200">
                    🔵 Blue Team
                  </span>
                )}
              </div>
            </div>
            {!isAudience && (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/75">
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
            className="mt-3 w-full rounded-lg border border-dashed border-white/25 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/75 hover:text-foreground"
          >
            Switch to {isAudience ? "player" : "audience"} mode
          </button>
        </div>

        {isAudience ? (
          <AudienceSoundboard roomCode={session.roomCode} nickname={session.nickname} sessionId={session.sessionId} />
        ) : room.phase === "ended" ? (
          me ? (
            <PlayerVictoryScreen
              me={me}
              rank={
                rankedAsc.length > 0
                  ? rankedAsc.length - rankedAsc.findIndex((p) => p.session_id === session.sessionId)
                  : 1
              }
              totalPlayers={rankedAsc.length || 1}
              roomCode={session.roomCode}
            />
          ) : null
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
                  className="flex w-full flex-col items-stretch gap-1 rounded-2xl border-2 border-violet-400/60 bg-violet-500/20 px-4 py-3 text-left active:scale-[0.98]"
                >
                  <span className="text-sm font-black uppercase tracking-wider text-violet-100">
                    ⚡ Blind 2× — risk it
                  </span>
                  <span className="text-[11px] leading-snug text-violet-100/75">
                    Double your points next question — but the answers stay hidden until you lock one in. One use per game.
                  </span>
                </button>
              )}
            {me?.pending_2x && (
              <div className="rounded-2xl border-2 border-violet-400/70 bg-violet-500/15 px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-violet-100">
                ⚡ Blind 2× armed — next question is blind
              </div>
            )}

            {room.phase === "final_intro" ? (
              <div className="grid flex-1 place-items-center rounded-3xl border-2 border-amber-300/60 bg-gradient-to-br from-amber-500/15 via-black to-black p-8 text-center">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.5em] text-amber-300/90">
                    One question. All on the line.
                  </div>
                  <div
                    className="mt-3 font-display text-5xl font-black uppercase tracking-tight text-transparent [animation:scale-in_0.5s_ease-out]"
                    style={{
                      backgroundImage:
                        "linear-gradient(180deg, oklch(0.97 0.12 90), oklch(0.75 0.20 60))",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      filter: "drop-shadow(0 6px 30px oklch(0.85 0.20 70 / 0.55))",
                    }}
                  >
                    ★ Final Round
                  </div>
                  <div className="mt-6 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-200/70">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-300" />
                    Get ready to wager…
                  </div>
                </div>
              </div>
            ) : room.phase === "final_wager" ? (
              <>
                {me?.comeback_bonus && (
                  <div className="rounded-2xl border-2 border-emerald-400/70 bg-gradient-to-br from-emerald-500/25 to-teal-500/15 p-3 text-center shadow-[0_10px_30px_-10px_rgba(16,185,129,0.6)] animate-scale-in">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-200">
                      🚀 Comeback Bonus
                    </div>
                    <div className="mt-1 text-sm font-semibold text-emerald-50">
                      1.5× on your wager if you nail this. No pressure.
                    </div>
                  </div>
                )}
                <PlayerWagerStage
                  score={me?.score ?? 0}
                  wagerDraft={wagerDraft}
                  setWagerDraft={setWagerDraft}
                  locked={!!me?.final_locked_at}
                  lockedWager={me?.final_wager ?? 0}
                  onLock={() => void sendWager()}
                />
              </>
            ) : room.phase === "sudden_death" ? (
              (() => {
                const cohort = room.sudden_death_session_ids ?? [];
                const amIn = cohort.includes(session.sessionId);
                if (!amIn) {
                  return (
                    <div className="grid flex-1 place-items-center rounded-3xl border-2 border-rose-400/60 bg-gradient-to-br from-rose-500/15 via-black to-black p-8 text-center">
                      <div>
                        <div className="text-3xl">⚔</div>
                        <div className="mt-3 text-[10px] uppercase tracking-[0.4em] text-rose-200">
                          Sudden Death
                        </div>
                        <div className="mt-2 text-lg font-bold text-white/90">
                          Watch the screen — first correct answer wins.
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <>
                    <div className="flex items-center justify-between rounded-2xl border-2 border-rose-400/70 bg-rose-500/15 px-4 py-2 backdrop-blur animate-pulse">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-100">
                        ⚔ Sudden Death · First correct wins
                      </div>
                      {remainingS !== null && (
                        <div className="font-mono text-xl font-black text-rose-100">
                          {Math.ceil(remainingS)}s
                        </div>
                      )}
                    </div>
                    <div className="min-h-0 flex-1">
                      <AnswerGrid
                        disabled={!!me?.current_answer_locked_at}
                        labels={(room.current_answers ?? ["", "", "", ""]) as [string, string, string, string]}
                        droppedIndexes={[]}
                        selectedIndex={me?.current_answer ?? null}
                        onPick={(i) => void pick(i)}
                        letterOverrides={room.wildcard === "mirror" ? mirrorLetters(room.current_question_text) : undefined}
                      />
                    </div>
                  </>
                );
              })()
            ) : room.phase === "final_question" ? (
              <>
                <div className="flex items-center justify-between rounded-2xl border-2 border-amber-300/60 bg-amber-500/10 px-4 py-2 backdrop-blur">
                  <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300">★ Final · wagered {me?.final_wager ?? 0}</div>
                  {remainingS !== null && (
                    <div className="font-mono text-xl font-black text-amber-200">{Math.ceil(remainingS)}s</div>
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
                  <div className="mt-4 text-xs uppercase tracking-widest text-white/75">Final score</div>
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
                {(() => {
                  const WILDCARD_TOP: Record<
                    string,
                    { label: string; border: string; bg: string; text: string; pulse?: boolean }
                  > = {
                    lightning: {
                      label: "⚡ Lightning · 2× pts · 8s",
                      border: "border-rose-400/60",
                      bg: "bg-rose-500/15",
                      text: "text-rose-200",
                      pulse: true,
                    },
                    double_or_nothing: {
                      label: "💀 Double or Nothing · 2× / −150",
                      border: "border-rose-400/60",
                      bg: "bg-rose-500/15",
                      text: "text-rose-200",
                    },
                    first_blood: {
                      label: "🩸 First Blood · fastest only",
                      border: "border-red-400/60",
                      bg: "bg-red-500/15",
                      text: "text-red-200",
                    },
                    underdog: {
                      label: "🐢 Underdog · last place 2×",
                      border: "border-emerald-400/60",
                      bg: "bg-emerald-500/15",
                      text: "text-emerald-200",
                    },
                    roast: {
                      label: "Roast vote · check TV",
                      border: "border-white/20",
                      bg: "bg-white/8",
                      text: "text-white/75",
                    },
                    sudden_drop: {
                      label: "⚠️ Sudden Drop · 1.5× · 12s",
                      border: "border-cyan-400/60",
                      bg: "bg-cyan-500/15",
                      text: "text-cyan-200",
                    },
                    mirror: {
                      label: "🪞 Mirror · letters scrambled",
                      border: "border-indigo-400/60",
                      bg: "bg-indigo-500/15",
                      text: "text-indigo-200",
                    },
                    heist: {
                      label: "💰 Heist · steal 50 from leader",
                      border: "border-yellow-400/60",
                      bg: "bg-yellow-500/15",
                      text: "text-yellow-200",
                    },
                    blackout: {
                      label: "🌑 Blackout · listen, then lock",
                      border: "border-slate-400/60",
                      bg: "bg-slate-700/30",
                      text: "text-slate-200",
                    },
                  };
                  const wc = room.wildcard ? WILDCARD_TOP[room.wildcard] : null;
                  const label =
                    wc?.label ??
                    `Q${((room.round_number - 1) % 5) + 1} · Round ${Math.min(4, Math.ceil(room.round_number / 5))}`;
                  return (
                    <div
                      className={`flex items-center justify-between rounded-2xl border px-4 py-2 backdrop-blur ${
                        wc ? `${wc.border} ${wc.bg}` : "border-white/20 bg-white/8"
                      } ${wc?.pulse ? "animate-pulse" : ""}`}
                    >
                      <div
                        className={`text-[10px] uppercase tracking-[0.25em] ${
                          wc ? `font-black ${wc.text}` : "text-white/75"
                        }`}
                      >
                        {label}
                      </div>

                  {reading ? (
                    <div className="font-mono text-xl font-black text-amber-300">
                      {Math.ceil(readSecondsLeft)}
                    </div>
                  ) : remainingS !== null && room.phase === "question" ? (
                    <div className="flex items-center gap-3">
                      <PlayerPointsTicker
                        remainingS={remainingS}
                        totalS={room.question_duration_ms / 1000}
                        lockedAt={me?.current_answer_locked_at ?? null}
                        questionStartedAt={room.question_started_at}
                        hasAnswer={me?.current_answer !== null && me?.current_answer !== undefined}
                      />
                      <div className="font-mono text-xl font-black text-white/75">
                        {Math.ceil(remainingS)}s
                      </div>
                    </div>
                  ) : null}
                </div>
                  );
                })()}


                {/* Question text on phone — scroll internally if very long
                    so it never steals height from the answer tiles below. */}
                {room.current_question_text && room.wildcard !== "roast" && (
                  <div className="max-h-[18vh] shrink-0 overflow-y-auto rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-center backdrop-blur">
                    {room.wildcard === "blackout" && remainingS !== null && remainingS > Math.max(0, (room.question_duration_ms ?? 25000) / 1000 - 5) ? (
                      <div className="text-sm font-black uppercase tracking-[0.3em] text-slate-200 animate-pulse">
                        🌑 Blackout · Listen
                      </div>
                    ) : (
                      <div className="text-sm font-bold leading-snug text-foreground sm:text-base">
                        {room.current_question_text}
                      </div>
                    )}
                  </div>
                )}


                {/* LOCKED IN confirmation */}
                {room.phase === "question" &&
                  me?.current_answer !== null &&
                  me?.current_answer !== undefined && (
                    <div className="flex items-center justify-center gap-2 rounded-full border-2 border-emerald-400/70 bg-emerald-500/20 px-4 py-2 text-center font-bold text-emerald-100 shadow-[0_0_30px_oklch(0.7_0.2_150/0.4)] animate-scale-in">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-400 font-display text-sm font-black text-emerald-950">
                        {["A", "B", "C", "D"][me.current_answer]}
                      </span>
                      <span className="text-sm uppercase tracking-[0.2em]">
                        ✓ Locked · {me?.nickname ?? session.nickname}
                      </span>
                    </div>
                  )}

                <div
                  className={`min-h-[42vh] flex-1 transition ${
                    buttonsScrambled ? "rotate-1 scale-[1.02] blur-sm" : ""
                  } ${reading ? "pointer-events-none opacity-50" : ""}`}
                  style={
                    buttonsScrambled
                      ? { filter: "blur(8px) hue-rotate(80deg)" }
                      : undefined
                  }
                >

                  <AnswerGrid
                    disabled={room.phase !== "question" || reading}
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
                    letterOverrides={room.wildcard === "mirror" ? mirrorLetters(room.current_question_text) : undefined}
                  />
                </div>

                {buttonsScrambled && (
                  <div className="absolute inset-x-0 top-1/2 z-30 -translate-y-1/2 text-center font-display text-3xl font-black tracking-widest text-fuchsia-300 drop-shadow">
                    G̷L̷I̷T̷C̷H̷E̷D̷
                  </div>
                )}
                {room.phase === "reveal" && me && me.last_answer_correct !== null && me.last_answer_correct !== undefined && (
                  <div
                    className={`flex shrink-0 items-center justify-between gap-3 rounded-2xl border-2 px-3 py-2 backdrop-blur animate-scale-in ${
                      me.last_answer_correct
                        ? "border-emerald-400/70 bg-emerald-500/15 shadow-[0_0_30px_oklch(0.7_0.2_150/0.4)]"
                        : "border-rose-400/70 bg-rose-500/15"
                    }`}
                  >
                    <div>
                      <div className={`text-[10px] font-black uppercase tracking-[0.35em] ${me.last_answer_correct ? "text-emerald-200" : "text-rose-200"}`}>
                        {me.last_answer_correct ? "✓ Correct" : "✗ Wrong"}
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-foreground/85">
                        {me.last_answer_correct ? "Nice lock-in." : "Shake it off."}
                      </div>
                    </div>
                    <div className="text-right leading-none">
                      <div className={`font-mono text-2xl font-black ${(me.current_round_score ?? 0) > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {(me.current_round_score ?? 0) > 0 ? "+" : ""}{me.current_round_score ?? 0}
                      </div>
                      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.25em] text-white/75">
                        score {me.score}
                      </div>
                    </div>
                  </div>
                )}
                {/* "Next question incoming…" — only show when there's NO
                    explanation, otherwise the Did-you-know box already
                    covers the gap and the extra line wastes height. */}
                {room.phase === "reveal" &&
                  !(room.current_explanation && room.current_explanation.trim().length > 0) && (
                    <div className="text-center text-xs uppercase tracking-[0.25em] text-white/75 animate-pulse">
                      Next question incoming…
                    </div>
                  )}
                {room.phase === "reveal" &&
                  room.current_explanation &&
                  room.current_explanation.trim().length > 0 && (
                    <div className="max-h-[28vh] shrink-0 overflow-y-auto rounded-3xl border-2 border-amber-300/60 bg-gradient-to-br from-amber-400/20 to-amber-600/10 p-3 text-center shadow-[0_10px_40px_-15px_rgba(251,191,36,0.5)] animate-scale-in">
                      <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-amber-300">
                        💡 Did you know?
                      </div>
                      <div className="mt-1.5 text-sm font-semibold leading-relaxed text-amber-50 sm:text-base">
                        {room.current_explanation}
                      </div>
                    </div>
                  )}

              </>
            ) : room.phase === "leaderboard" ? (
              <div className="grid flex-1 place-items-center rounded-3xl border border-white/20 bg-white/10 p-6 text-center backdrop-blur animate-scale-in">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-amber-300/80">
                    Standings on TV
                  </div>
                  <div className="mt-3 font-mono text-6xl font-black text-foreground">{me?.score ?? 0}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-white/75">your score</div>
                  {(me?.streak_count ?? 0) >= 2 && (
                    <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-3 py-1 text-sm font-bold text-amber-300">
                      🔥 {me?.streak_count} in a row
                    </div>
                  )}
                  <div className="mt-5 text-xs uppercase tracking-[0.25em] text-white/75 animate-pulse">
                    Next round incoming…
                  </div>
                </div>
              </div>
            ) : (
              <LobbyWaitingCard nickname={me?.nickname ?? ""} avatarUrl={me?.avatar_url ?? null} playerCount={allPlayers.length} />
            )}
          </>
        )}
      </div>

      {/* Eliminated-answer flash */}
      {eliminatedFlash && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4 animate-scale-in">
          <div className="rounded-full border-2 border-rose-300 bg-rose-600/95 px-4 py-2 text-center shadow-[0_10px_30px_-10px_oklch(0.55_0.22_25/0.7)]">
            <div className="text-sm font-black uppercase tracking-[0.25em] text-white">Answer eliminated</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-100/90">Pick again — fast!</div>
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
            <p className="mt-2 text-sm text-white/75">
              Waiting to resume… your score and place are saved.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

function PlayerPointsTicker({
  remainingS,
  totalS,
  lockedAt,
  questionStartedAt,
  hasAnswer,
}: {
  remainingS: number;
  totalS: number;
  lockedAt: string | null;
  questionStartedAt: string | null;
  hasAnswer: boolean;
}) {
  // Mirror server-side POINTS_GRACE_MS — first 1.5s of question yields max.
  const GRACE_S = 1.5;
  let points: number;
  if (hasAnswer && lockedAt && questionStartedAt) {
    const elapsed = Math.max(
      0,
      (new Date(lockedAt).getTime() - new Date(questionStartedAt).getTime()) / 1000 - GRACE_S,
    );
    const remainingAtLock = Math.max(0, totalS - elapsed);
    points = Math.max(0, Math.round((remainingAtLock / totalS) * 1000));
  } else {
    const effectiveRemaining = Math.min(totalS, Math.max(0, remainingS) + GRACE_S);
    points = Math.max(0, Math.round((effectiveRemaining / totalS) * 1000));
  }

  const color =
    points >= 500
      ? "text-amber-300"
      : points >= 150
        ? "text-amber-400"
        : "text-rose-400";
  return (
    <div className="flex flex-col items-end leading-none">
      <div className="text-[8px] font-bold uppercase tracking-[0.3em] text-white/75">
        {hasAnswer ? "Locked" : "Lock now"}
      </div>
      <div className={`font-mono text-2xl font-black tabular-nums ${color}`}>
        {points}
      </div>
    </div>
  );
}

const LOBBY_TIPS = [
  "You're in. Phone on loud — the host announces every round.",
  "Faster locks = more points. Don't camp.",
  "Streaks stack. Three in a row and the room hears about it.",
  "Pick wrong, lose the streak. Pick fast, lose nothing.",
  "Don't overthink. Trust your first guess.",
];

function LobbyWaitingCard({ nickname, avatarUrl, playerCount }: { nickname: string; avatarUrl: string | null; playerCount: number }) {
  const [tipIdx, setTipIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTipIdx((i) => (i + 1) % LOBBY_TIPS.length), 3800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="grid flex-1 place-items-center rounded-3xl border border-amber-300/20 bg-gradient-to-b from-amber-300/[0.06] to-transparent p-6 text-center backdrop-blur animate-scale-in">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute -inset-2 rounded-full bg-amber-300/20 blur-xl animate-pulse" />
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="relative h-20 w-20 rounded-full object-cover ring-2 ring-amber-300/60" />
          ) : (
            <div className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-2xl font-black text-black ring-2 ring-amber-300/60">
              {(nickname || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-300">You're in</div>
          <div className="mt-1 text-2xl font-black text-foreground">{nickname || "Player"}</div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-card/60 px-3 py-1 text-xs font-semibold text-white/75">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {playerCount} {playerCount === 1 ? "player" : "players"} in the room
        </div>
        <div className="min-h-[2.5rem] max-w-xs px-2 text-sm text-white/75 transition-opacity">
          <span key={tipIdx} className="inline-block animate-fade-in italic">"{LOBBY_TIPS[tipIdx]}"</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300/70 animate-pulse">
          Waiting for host…
        </div>
      </div>
    </div>
  );
}

