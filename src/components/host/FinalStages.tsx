import { useEffect, useMemo, useRef, useState } from "react";
import { play, playEvent, playWagerBed, stopWagerBed } from "@/lib/sound-engine";

import { useStaggeredReveal, useRevealStages, useCountUp } from "@/hooks/useFinalRoundFx";

const WAGER_DURATION_S = 30;

type Player = {
  id: string;
  nickname: string;
  score: number;
  avatar_url: string | null;
  is_audience: boolean;
  final_wager: number;
  final_answer: number | null;
  final_locked_at: string | null;
  current_round_score: number;
};

// ─── Wager stage ────────────────────────────────────────────────────────
export function FinalWagerStage({ players }: { players: Player[] }) {
  const live = useMemo(() => players.filter((p) => !p.is_audience), [players]);
  const locked = useMemo(() => live.filter((p) => !!p.final_locked_at).length, [live]);
  const total = live.length;
  const top3 = useMemo(() => [...live].sort((a, b) => b.score - a.score).slice(0, 3), [live]);


  // Spectacular FINAL ROUND slam on mount + wager bed loop while wagering.
  const [slamPhase, setSlamPhase] = useState<"hidden" | "slam" | "linger" | "done">("hidden");
  useEffect(() => {
    playEvent("final");
    setSlamPhase("slam");
    const t1 = window.setTimeout(() => setSlamPhase("linger"), 900);
    const t2 = window.setTimeout(() => setSlamPhase("done"), 2200);
    const t3 = window.setTimeout(() => playWagerBed(0.32), 2400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      stopWagerBed(500);
      // Flush queued Vox so it doesn't bleed into the next stage.
      void import("@/lib/elf-voice").then((m) => m.cancelElfSpeech());
    };
  }, []);

  // Heartbeat removed — final round no longer shows a countdown/pulse.

  // All-in callouts: any top-3 player who wagered their entire score.
  const allIn = top3.filter((p) => p.final_wager > 0 && p.final_wager === p.score);

  return (
    <div className={`relative grid h-full grid-cols-2 gap-8 overflow-hidden bg-gradient-to-br from-black via-[oklch(0.12_0.05_280)] to-black p-10 text-white ${slamPhase === "slam" ? "final-slam-shake" : ""}`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.85_0.18_85/0.18),transparent_60%)]" />

      {/* FINAL ROUND slam overlay */}
      {slamPhase !== "done" && (
        <div className={`pointer-events-none absolute inset-0 z-40 grid place-items-center ${slamPhase === "linger" ? "final-slam-fadeout" : ""}`}>
          <div className={`absolute inset-0 ${slamPhase === "slam" ? "final-slam-flash" : ""} bg-amber-200/30`} />
          <div className="relative text-center">
            <div className="font-display text-[clamp(5rem,18vw,14rem)] font-black uppercase leading-none tracking-tight text-transparent final-slam-title"
              style={{
                backgroundImage: "linear-gradient(180deg, oklch(0.98 0.12 90), oklch(0.7 0.25 40))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                filter: "drop-shadow(0 12px 60px oklch(0.85 0.25 60 / 0.85))",
              }}>
              Final<br/>Round
            </div>
          </div>
        </div>
      )}


      {/* Static ring (no heartbeat in final round) */}
      <div className="pointer-events-none absolute inset-4 rounded-3xl ring-2 ring-amber-300/30" />

      {/* All-in ribbon */}
      {allIn.length > 0 && (
        <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2">
          <div className="final-allin-pulse rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 px-5 py-1.5 text-xs font-black uppercase tracking-[0.35em] text-black shadow-[0_0_30px_oklch(0.7_0.2_30/0.6)]">
            ⚠ All in — {allIn.map((p) => p.nickname).join(" · ")}
          </div>
        </div>
      )}

      {/* Standings */}
      <div className="relative">
        <div className="text-[10px] font-bold uppercase tracking-[0.5em] text-amber-300/90">
          Standings
        </div>
        <div className="mt-4 space-y-3">
          {top3.map((p, i) => (
            <div
              key={p.id}
              className="final-row-reveal flex items-center justify-between rounded-2xl border border-amber-300/20 bg-white/5 px-4 py-3 backdrop-blur"
              style={{ animationDelay: `${i * 90}ms` }}
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

      {/* Status */}
      <div className="relative flex flex-col items-center justify-center text-center">
        <div className="text-xs font-bold uppercase tracking-[0.5em] text-amber-300/90">
          Place your wager
        </div>
        <div className="mt-3 font-display text-5xl font-black leading-tight">
          All players are betting…
        </div>
        <div className="mt-6 text-sm uppercase tracking-[0.3em] text-amber-200/60">
          {locked === total ? "All wagers locked" : "Waiting on wagers…"}
        </div>
      </div>
    </div>
  );
}

// ─── Reveal stage ───────────────────────────────────────────────────────
type RevealProps = {
  correctText: string;
  explanation: string | null;
  players: Player[];
  revealKey: string;
  prevLeaderId: string | null;
};

export function FinalRevealStage({
  correctText,
  explanation,
  players,
  revealKey,
  prevLeaderId,
}: RevealProps) {
  const ranked = useMemo(
    () =>
      [...players]
        .filter((p) => !p.is_audience)
        .sort((a, b) => b.score - a.score),
    [players],
  );

  // Beats: pause → answer slam → small hold → start rollout
  const stage = useRevealStages([1200, 600, 400], revealKey);
  const answerVisible = stage >= 1;
  const rolloutKey = stage >= 3 ? `roll-${revealKey}` : "idle";
  const rolloutTotal = stage >= 3 ? ranked.length : 0;
  const revealedCount = useStaggeredReveal(rolloutTotal, 450, 0, rolloutKey);

  // SFX on each new row
  const lastSfxRef = useRef(0);
  useEffect(() => {
    if (revealedCount === 0 || revealedCount === lastSfxRef.current) return;
    lastSfxRef.current = revealedCount;
    const idx = revealedCount - 1; // bottom-up index
    const player = ranked[ranked.length - 1 - idx];
    if (!player) return;
    const delta = player.current_round_score ?? 0;
    const wager = player.final_wager ?? 0;
    if (delta > 0) play("correct");
    else if (wager > 0) play("wrong");
  }, [revealedCount, ranked]);

  // Reset SFX counter when reveal key changes
  useEffect(() => {
    lastSfxRef.current = 0;
  }, [revealKey]);

  // Answer slam sfx + sweep
  useEffect(() => {
    if (stage === 0) play("whoosh");
    if (stage === 1) play("drop");
  }, [stage]);

  // Winner crown cue once all rows are revealed AND leader changed
  const allRevealed = revealedCount >= ranked.length && ranked.length > 0;
  const newLeader = allRevealed && ranked[0] && ranked[0].id !== prevLeaderId;
  const crownFiredRef = useRef(false);
  useEffect(() => {
    if (newLeader && !crownFiredRef.current) {
      crownFiredRef.current = true;
      playEvent("victory");
    }
  }, [newLeader]);
  useEffect(() => {
    crownFiredRef.current = false;
  }, [revealKey]);

  return (
    <div className="relative grid h-full place-items-center overflow-hidden bg-gradient-to-br from-black via-[oklch(0.10_0.05_280)] to-black p-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.85_0.18_85/0.18),transparent_60%)]" />
      <div className="relative w-full max-w-3xl">
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-[0.5em] text-amber-300/90">
            The answer was
          </div>
          {/* Sweep bar during pause */}
          <div className="mx-auto mt-4 h-1 w-64 overflow-hidden rounded-full bg-amber-300/10">
            <div
              key={`bar-${revealKey}`}
              className="h-full w-full final-bar-fill bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200"
            />
          </div>
          <div className="mt-4 min-h-[4.5rem]">
            {answerVisible && (
              <div
                key={`ans-${revealKey}`}
                className="final-slam font-display text-6xl font-black text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, oklch(0.97 0.12 90), oklch(0.75 0.20 60))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 8px 40px oklch(0.85 0.20 70 / 0.55))",
                }}
              >
                {correctText}
              </div>
            )}
          </div>
        </div>

        {explanation && explanation.trim().length > 0 && stage >= 2 && (
          <div className="mx-auto mt-6 max-w-2xl animate-fade-in rounded-2xl border border-amber-300/40 bg-amber-400/10 px-5 py-4 text-center backdrop-blur">
            <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-300/90">
              💡 Did you know?
            </div>
            <div className="mt-1 text-base font-medium leading-snug text-white/90 sm:text-lg">
              {explanation}
            </div>
          </div>
        )}

        <div className="mt-8 space-y-2">
          {ranked.map((p, rankIdx) => {
            const revealOrder = ranked.length - 1 - rankIdx;
            const visible = revealedCount > revealOrder;
            const delta = p.current_round_score ?? 0;
            const correct = delta > 0;
            const noBet = (p.final_wager ?? 0) === 0;
            const prevScore = p.score - delta;
            const isLeader = rankIdx === 0 && allRevealed;
            return (
              <FinalRevealRow
                key={p.id}
                visible={visible}
                correct={correct}
                noBet={noBet}
                player={p}
                delta={delta}
                prevScore={prevScore}
                showCrown={isLeader && newLeader}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FinalRevealRow({
  visible,
  correct,
  noBet,
  player,
  delta,
  prevScore,
  showCrown,
}: {
  visible: boolean;
  correct: boolean;
  noBet: boolean;
  player: Player;
  delta: number;
  prevScore: number;
  showCrown: boolean;
}) {
  const displayScore = visible ? player.score : prevScore;
  if (!visible) {
    return <div className="h-[68px]" aria-hidden />;
  }
  const flash = correct
    ? "final-row-flash border-emerald-400/40"
    : noBet
      ? "border-white/10"
      : "final-row-flash final-shake border-rose-400/40";
  const flashFrom = correct
    ? "oklch(0.85 0.18 145 / 0.55)"
    : "oklch(0.6 0.25 25 / 0.55)";
  const flashTo = correct
    ? "oklch(0.25 0.08 145 / 0.15)"
    : "oklch(0.25 0.08 25 / 0.15)";
  return (
    <div
      className={`final-row-reveal relative flex items-center justify-between rounded-2xl border px-4 py-3 backdrop-blur ${flash} ${
        correct ? "bg-emerald-400/10" : noBet ? "bg-white/5" : "bg-rose-400/10"
      }`}
      style={
        {
          ["--flash-from" as string]: flashFrom,
          ["--flash-to" as string]: flashTo,
        } as React.CSSProperties
      }
    >
      {showCrown && (
        <div className="crown-drop pointer-events-none absolute -top-5 left-3 text-3xl drop-shadow-[0_4px_12px_oklch(0.85_0.20_85/0.7)]">
          👑
        </div>
      )}
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold">{player.nickname}</span>
        <span className="text-xs uppercase tracking-widest text-white/60">
          wagered {player.final_wager ?? 0}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span
          className={`font-mono text-lg font-black ${
            correct ? "text-emerald-300" : noBet ? "text-white/40" : "text-rose-300"
          }`}
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
        <span className="font-mono text-2xl font-black text-amber-300">
          {displayScore}
        </span>
      </div>
    </div>
  );
}
