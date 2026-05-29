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

export function Leaderboard({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <ol className="mx-auto flex w-full max-w-2xl flex-col gap-2">
      <AnimatePresence initial={false}>
        {sorted.map((p, i) => (
          <motion.li
            key={p.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={`flex items-center gap-4 rounded-2xl border px-4 py-3 backdrop-blur ${
              i === 0
                ? "border-amber-400/50 bg-amber-400/10"
                : "border-border bg-card/40"
            }`}
          >
            <div className="w-8 text-center font-mono text-2xl font-black text-muted-foreground">
              {i + 1}
            </div>
            {p.avatar_url ? (
              <img
                src={p.avatar_url}
                alt={p.nickname}
                className="h-12 w-12 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-primary to-accent font-bold text-primary-foreground">
                {p.nickname.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 text-lg font-semibold">
                {p.nickname}
                {p.current_round_fastest && <span title="Fastest">⚡</span>}
                {(p.streak_count ?? 0) >= 3 && <span title="On fire">🔥</span>}
              </div>
              {p.current_round_score !== undefined && p.current_round_score !== 0 && (
                <div
                  className={`text-xs font-medium ${
                    p.current_round_score > 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {p.current_round_score > 0 ? "+" : ""}
                  {p.current_round_score}
                </div>
              )}
            </div>
            <div className="font-mono text-3xl font-black">{p.score}</div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
