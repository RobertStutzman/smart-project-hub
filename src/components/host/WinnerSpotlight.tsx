import { motion } from "framer-motion";
import { Confetti } from "./Confetti";

type Player = {
  id: string;
  nickname: string;
  score: number;
  avatar_url: string | null;
  best_streak: number;
  fastest_count: number;
  correct_count: number;
  wrong_count: number;
  is_audience: boolean;
};

type Props = {
  players: Player[];
  children?: React.ReactNode; // CTA area (roast + roll credits)
};

function Avatar({ p, size }: { p: Player; size: string }) {
  if (p.avatar_url) {
    return (
      <img
        src={p.avatar_url}
        alt={p.nickname}
        className={`${size} rounded-full border-2 border-amber-300/70 object-cover shadow-[0_0_80px_oklch(0.85_0.18_85/0.7)]`}
      />
    );
  }
  return (
    <div
      className={`${size} grid place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 font-display font-black text-amber-950 shadow-[0_0_80px_oklch(0.85_0.18_85/0.7)]`}
    >
      {p.nickname.slice(0, 1).toUpperCase()}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
      <div className={`font-mono text-3xl font-black ${accent ?? "text-white"}`}>{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
        {label}
      </div>
    </div>
  );
}

export function WinnerSpotlight({ players, children }: Props) {
  const live = players.filter((p) => !p.is_audience).sort((a, b) => b.score - a.score);
  const winner = live[0];
  const runners = live.slice(1, 3);
  const accuracy =
    winner && winner.correct_count + winner.wrong_count > 0
      ? Math.round(
          (winner.correct_count / (winner.correct_count + winner.wrong_count)) * 100,
        )
      : 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black text-white">
      {/* radial spotlight */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.35_0.18_85/0.4),oklch(0.05_0.02_270)_70%)]" />
      <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_40%,oklch(0.85_0.18_85/0.18),transparent_55%)]" />
      {/* stage light beams */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-2/3 opacity-60"
        style={{
          background:
            "conic-gradient(from 270deg at 50% 0%, transparent 70deg, oklch(0.85 0.18 85 / 0.18) 90deg, transparent 110deg, transparent 250deg, oklch(0.85 0.18 85 / 0.18) 270deg, transparent 290deg)",
          maskImage: "radial-gradient(ellipse at top, black, transparent 70%)",
        }}
      />
      <Confetti triggerKey={winner?.id ?? "none"} continuous count={260} />

      <div className="relative z-30 grid h-full place-items-center p-6">
        <div className="flex flex-col items-center gap-8 text-center">
          <motion.div
            initial={{ opacity: 0, letterSpacing: "0.1em" }}
            animate={{ opacity: 1, letterSpacing: "0.6em" }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="text-[11px] font-black uppercase text-amber-300/90"
          >
            Champion
          </motion.div>

          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.2 }}
            className="text-7xl"
          >
            🏆
          </motion.div>

          {winner ? (
            <>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.4 }}
              >
                <Avatar p={winner} size="h-36 w-36 sm:h-44 sm:w-44" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.6 }}
                className="font-display text-6xl font-black uppercase leading-none tracking-tight text-transparent sm:text-7xl"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, oklch(0.98 0.10 90) 0%, oklch(0.75 0.20 60) 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 8px 40px oklch(0.85 0.20 70 / 0.55))",
                }}
              >
                {winner.nickname}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9, duration: 0.5 }}
                className="font-mono text-3xl font-black text-amber-200"
              >
                {winner.score} pts
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 0.5 }}
                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
              >
                <Stat label="Accuracy" value={`${accuracy}%`} accent="text-emerald-300" />
                <Stat label="Best streak" value={winner.best_streak ?? 0} accent="text-rose-300" />
                <Stat label="Fastest" value={winner.fastest_count ?? 0} accent="text-amber-300" />
                <Stat label="Correct" value={winner.correct_count ?? 0} accent="text-white" />
              </motion.div>

              {runners.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.4, duration: 0.6 }}
                  className="mt-2 flex items-center gap-6"
                >
                  {runners.map((p, i) => (
                    <div key={p.id} className="flex flex-col items-center gap-1">
                      <div className="relative">
                        <Avatar p={p} size="h-14 w-14" />
                        <div
                          className={`absolute -bottom-1 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full font-display text-[11px] font-black ${
                            i === 0
                              ? "bg-zinc-200 text-zinc-900"
                              : "bg-orange-400 text-orange-950"
                          }`}
                        >
                          {i + 2}
                        </div>
                      </div>
                      <div className="mt-2 font-display text-xs font-bold uppercase tracking-wider text-white/80">
                        {p.nickname}
                      </div>
                      <div className="font-mono text-[11px] text-white/50">{p.score} pts</div>
                    </div>
                  ))}
                </motion.div>
              )}
            </>
          ) : (
            <div className="text-2xl text-white/60">No players</div>
          )}

          {children && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.7, duration: 0.5 }}
              className="mt-2 flex flex-col items-center gap-3"
            >
              {children}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
