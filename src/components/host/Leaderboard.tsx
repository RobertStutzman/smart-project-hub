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

const PODIUM_TONE = [
  // 1st — gold
  {
    ring: "ring-amber-300/70",
    glow: "shadow-[0_0_80px_oklch(0.85_0.18_85/0.6)]",
    badgeBg: "bg-amber-300 text-amber-950",
    label: "text-amber-300",
    height: "h-44 sm:h-52",
  },
  // 2nd — silver
  {
    ring: "ring-zinc-300/60",
    glow: "shadow-[0_0_60px_oklch(0.85_0.02_250/0.35)]",
    badgeBg: "bg-zinc-200 text-zinc-900",
    label: "text-zinc-200",
    height: "h-36 sm:h-44",
  },
  // 3rd — bronze
  {
    ring: "ring-orange-400/60",
    glow: "shadow-[0_0_60px_oklch(0.65_0.15_45/0.4)]",
    badgeBg: "bg-orange-400 text-orange-950",
    label: "text-orange-300",
    height: "h-32 sm:h-40",
  },
];

function Avatar({ p, size = "h-16 w-16" }: { p: Player; size?: string }) {
  if (p.avatar_url) {
    return (
      <img
        src={p.avatar_url}
        alt={p.nickname}
        className={`${size} rounded-full border border-white/15 object-cover`}
      />
    );
  }
  return (
    <div
      className={`${size} grid place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 font-display font-black text-amber-950`}
    >
      {p.nickname.slice(0, 1).toUpperCase()}
    </div>
  );
}

function Podium({ players }: { players: Player[] }) {
  // Render order: 2nd, 1st, 3rd
  const order = [players[1], players[0], players[2]];
  const positions = [1, 0, 2];
  return (
    <div className="mx-auto flex w-full max-w-3xl items-end justify-center gap-3 sm:gap-6">
      {order.map((p, idx) => {
        if (!p) return <div key={idx} className="w-1/3" />;
        const rank = positions[idx];
        const tone = PODIUM_TONE[rank];
        return (
          <motion.div
            key={p.id}
            layout
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 * (idx + 1), type: "spring", stiffness: 220, damping: 24 }}
            className="flex w-1/3 flex-col items-center"
          >
            <div className="relative mb-3">
              <div className={`rounded-full p-1 ring-2 ${tone.ring} ${tone.glow}`}>
                <Avatar p={p} size="h-20 w-20 sm:h-24 sm:w-24" />
              </div>
              <div
                className={`absolute -bottom-2 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full font-display text-sm font-black ${tone.badgeBg}`}
              >
                {rank + 1}
              </div>
            </div>
            <div className={`font-display text-base font-bold uppercase tracking-wider ${tone.label}`}>
              {p.nickname}
            </div>
            <div className="font-mono text-xs text-white/50">{p.score} pts</div>
            <div
              className={`mt-3 w-full rounded-t-xl border border-white/10 border-b-0 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur ${tone.height}`}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

export const Leaderboard = memo(function Leaderboard({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {top3.length > 0 && <Podium players={top3} />}

      {rest.length > 0 && (
        <ol className="flex w-full flex-col gap-2">
          <AnimatePresence initial={false}>
            {rest.map((p, i) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur"
              >
                <div className="w-8 text-center font-mono text-xl font-black text-white/40">
                  {i + 4}
                </div>
                <Avatar p={p} size="h-11 w-11" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 truncate font-display text-base font-semibold text-white">
                    {p.nickname}
                    {p.current_round_fastest && <span title="Fastest">⚡</span>}
                    {(p.streak_count ?? 0) >= 3 && <span title="On fire">🔥</span>}
                  </div>
                  {p.current_round_score !== undefined && p.current_round_score !== 0 && (
                    <div
                      className={`text-xs font-bold ${
                        p.current_round_score > 0 ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {p.current_round_score > 0 ? "+" : ""}
                      {p.current_round_score}
                    </div>
                  )}
                </div>
                <div className="font-mono text-2xl font-black text-white">{p.score}</div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
});
