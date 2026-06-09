import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Player = {
  id: string;
  nickname: string;
  score: number;
  avatar_url: string | null;
  current_round_score?: number;
  current_round_fastest?: boolean;
  streak_count?: number;
};

type RankTone = {
  bar: string;
  badge: string;
  rowRing: string;
  name: string;
};

const RANK_TONE: Record<number, RankTone> = {
  1: {
    bar: "bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500",
    badge: "bg-amber-300 text-amber-950",
    rowRing: "ring-amber-300/40",
    name: "text-amber-100",
  },
  2: {
    bar: "bg-gradient-to-r from-zinc-200 via-zinc-300 to-zinc-400",
    badge: "bg-zinc-200 text-zinc-900",
    rowRing: "ring-zinc-200/30",
    name: "text-zinc-100",
  },
  3: {
    bar: "bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600",
    badge: "bg-orange-400 text-orange-950",
    rowRing: "ring-orange-400/30",
    name: "text-orange-100",
  },
};

const DEFAULT_TONE: RankTone = {
  bar: "bg-gradient-to-r from-white/30 to-white/15",
  badge: "bg-white/10 text-white/80",
  rowRing: "ring-white/10",
  name: "text-white",
};

function Avatar({ p, size = "h-11 w-11" }: { p: Player; size?: string }) {
  if (p.avatar_url) {
    return (
      <img
        src={p.avatar_url}
        alt={p.nickname}
        className={`${size} shrink-0 rounded-full border border-white/15 object-cover`}
      />
    );
  }
  return (
    <div
      className={`${size} shrink-0 grid place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 font-display font-black text-amber-950`}
    >
      {p.nickname.slice(0, 1).toUpperCase()}
    </div>
  );
}

export const Leaderboard = memo(function Leaderboard({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(1, sorted[0]?.score ?? 1);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <ol className="flex w-full flex-col divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur">
        <AnimatePresence initial={false}>
          {sorted.map((p, i) => {
            const rank = i + 1;
            const tone = RANK_TONE[rank] ?? DEFAULT_TONE;
            const pct = Math.max(2, Math.round((p.score / maxScore) * 100));
            const delta = p.current_round_score ?? 0;
            return (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  layout: { type: "spring", stiffness: 280, damping: 28 },
                  delay: Math.min(i, 8) * 0.05,
                  duration: 0.35,
                }}
                className={`flex items-center gap-4 px-5 py-3 ring-1 ring-inset ${tone.rowRing}`}
              >
                {/* Rank */}
                <div
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-base font-black ${tone.badge}`}
                >
                  {rank}
                </div>

                {/* Avatar */}
                <Avatar p={p} />

                {/* Name + bar */}
                <div className="min-w-0 flex-1">
                  <div className={`flex items-center gap-2 truncate font-display text-lg font-bold uppercase tracking-wide ${tone.name}`}>
                    <span className="truncate">{p.nickname}</span>
                    {p.current_round_fastest && <span title="Fastest" className="text-sm">⚡</span>}
                    {(p.streak_count ?? 0) >= 3 && <span title="On fire" className="text-sm">🔥</span>}
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06] shadow-inner">
                    <motion.div
                      key={`${p.id}-${p.score}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 + Math.min(i, 8) * 0.05 }}
                      className={`h-full rounded-full ${tone.bar} shadow-[0_0_18px_rgba(255,255,255,0.12)_inset]`}
                    />
                  </div>
                </div>

                {/* Score + delta */}
                <div className="flex w-20 shrink-0 flex-col items-end">
                  <div className="font-mono text-2xl font-black leading-none text-white tabular-nums">
                    {p.score}
                  </div>
                  {delta !== 0 && (
                    <div
                      className={`mt-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-black tabular-nums ${
                        delta > 0
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-rose-500/15 text-rose-300"
                      }`}
                    >
                      {delta > 0 ? `+${delta}` : `${delta}`}
                    </div>
                  )}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </div>
  );
});
