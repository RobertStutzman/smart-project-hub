import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { HOST_NAME, pickLine, speakPersona } from "@/lib/host-persona";
import { play } from "@/lib/sound-engine";

type Player = {
  id: string;
  nickname: string;
  score: number;
  avatar_url: string | null;
  best_streak?: number;
  fastest_count?: number;
  correct_count?: number;
  wrong_count?: number;
  is_audience: boolean;
};

type Props = {
  players: Player[];
  onPlayAgain: () => void;
};

type Moment = { label: string; player: Player; detail?: string };

function deriveMoments(live: Player[]): Moment[] {
  if (live.length === 0) return [];
  const out: Moment[] = [];
  const byStreak = [...live].sort((a, b) => (b.best_streak ?? 0) - (a.best_streak ?? 0))[0];
  if (byStreak && (byStreak.best_streak ?? 0) >= 3) {
    out.push({ label: "Longest Streak", player: byStreak, detail: `${byStreak.best_streak} in a row 🔥` });
  }
  const byFast = [...live].sort((a, b) => (b.fastest_count ?? 0) - (a.fastest_count ?? 0))[0];
  if (byFast && (byFast.fastest_count ?? 0) >= 1) {
    out.push({ label: "Fastest Finger", player: byFast, detail: `${byFast.fastest_count}× first to lock ⚡` });
  }
  const byCorrect = [...live].sort((a, b) => (b.correct_count ?? 0) - (a.correct_count ?? 0))[0];
  if (byCorrect && (byCorrect.correct_count ?? 0) >= 1) {
    out.push({ label: "Brain of the Night", player: byCorrect, detail: `${byCorrect.correct_count} correct 🧠` });
  }
  const byWrong = [...live].sort((a, b) => (b.wrong_count ?? 0) - (a.wrong_count ?? 0))[0];
  if (byWrong && (byWrong.wrong_count ?? 0) >= 2) {
    out.push({ label: "Most Confident Wrong", player: byWrong, detail: `${byWrong.wrong_count} wrong with conviction 💥` });
  }
  return out;
}

export function CreditsStage({ players, onPlayAgain }: Props) {
  const live = useMemo(() => players.filter((p) => !p.is_audience), [players]);
  const ranked = useMemo(() => [...live].sort((a, b) => b.score - a.score), [live]);
  const winner = ranked[0];
  const moments = useMemo(() => deriveMoments(live), [live]);

  useEffect(() => {
    play("whoosh");
    speakPersona(pickLine("credits_open", live.length));
  }, [live.length]);

  return (
    <div
      className="relative h-full overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(ellipse 100% 80% at 50% 30%, oklch(0.18 0.08 280 / 0.95), oklch(0.04 0.02 270) 75%)",
      }}
    >
      {/* film grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Scrolling credits column */}
      <motion.div
        initial={{ y: "30%" }}
        animate={{ y: "-100%" }}
        transition={{ duration: 32, ease: "linear" }}
        className="absolute left-0 right-0 mx-auto flex w-full max-w-2xl flex-col items-center gap-12 px-8 pb-32 pt-32 text-center"
      >
        {/* Winner card */}
        {winner && (
          <div className="flex flex-col items-center gap-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.6em] text-amber-300/80">
              Tonight's Champion
            </div>
            <div className="rounded-full p-1 ring-2 ring-amber-300/80 shadow-[0_0_60px_oklch(0.85_0.18_85/0.6)]">
              {winner.avatar_url ? (
                <img src={winner.avatar_url} alt={winner.nickname} className="h-32 w-32 rounded-full object-cover" />
              ) : (
                <div className="grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 font-display text-5xl font-black text-amber-950">
                  {winner.nickname.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div
              className="mt-2 font-display text-5xl font-black uppercase tracking-tight text-transparent"
              style={{
                backgroundImage: "linear-gradient(180deg, oklch(0.97 0.12 90), oklch(0.75 0.20 60))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
              }}
            >
              {winner.nickname}
            </div>
            <div className="font-mono text-2xl font-black text-amber-200">{winner.score} pts</div>
          </div>
        )}

        {/* Cast */}
        <div className="w-full">
          <div className="text-[11px] font-bold uppercase tracking-[0.6em] text-amber-300/80">Cast</div>
          <div className="mx-auto mt-2 h-px w-24 bg-amber-300/40" />
          <div className="mt-6 flex flex-col gap-3">
            {ranked.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between gap-4 text-lg">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-right font-mono text-white/40">{i + 1}.</span>
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs font-black">
                      {p.nickname.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="font-display font-bold">{p.nickname}</span>
                </div>
                <span className="font-mono text-white/70">{p.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Funniest moments */}
        {moments.length > 0 && (
          <div className="w-full">
            <div className="text-[11px] font-bold uppercase tracking-[0.6em] text-amber-300/80">
              Funniest Moments
            </div>
            <div className="mx-auto mt-2 h-px w-24 bg-amber-300/40" />
            <div className="mt-6 flex flex-col gap-4">
              {moments.map((m) => (
                <div key={m.label + m.player.id} className="text-center">
                  <div className="text-xs uppercase tracking-[0.3em] text-white/50">{m.label}</div>
                  <div className="mt-1 font-display text-2xl font-black text-white">{m.player.nickname}</div>
                  {m.detail && <div className="text-sm text-white/60">{m.detail}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Producer credit */}
        <div className="pt-8 text-center">
          <div className="text-[11px] uppercase tracking-[0.5em] text-white/40">Directed by</div>
          <div className="mt-2 font-display text-3xl font-black text-amber-200">{HOST_NAME}</div>
          <div className="mt-6 text-[10px] uppercase tracking-[0.4em] text-white/30">
            Beat the Drop · A trivia bloodsport
          </div>
        </div>
      </motion.div>

      {/* Play again CTA — pinned bottom, fades in at the end */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 18, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <button
          onClick={() => {
            play("whoosh");
            onPlayAgain();
          }}
          className="rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-8 py-3 font-display font-bold uppercase tracking-wider text-amber-950 shadow-[0_0_40px_oklch(0.85_0.18_85/0.5)] transition hover:scale-[1.03]"
        >
          ↻ Play again
        </button>
      </motion.div>
    </div>
  );
}
