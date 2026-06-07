import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type Player = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  score: number;
  current_round_score?: number;
  current_round_fastest?: boolean;
  streak_count?: number;
  best_streak?: number;
};

type Props = {
  players: Player[];
  roundNumber: number;
  /** Re-mounts the reel when this changes (e.g. round_number). */
  triggerKey: string | number;
  onDone: () => void;
};

// Total ~4.2s
const BEAT_MS = 1400;
const TOTAL_BEATS = 3;

function Avatar({ p, size = "h-28 w-28" }: { p: Player; size?: string }) {
  if (p.avatar_url) {
    return (
      <img
        src={p.avatar_url}
        alt={p.nickname}
        className={`${size} rounded-full border-2 border-amber-300/70 object-cover shadow-[0_0_60px_oklch(0.85_0.18_85/0.55)]`}
      />
    );
  }
  return (
    <div
      className={`${size} grid place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 font-display text-4xl font-black text-amber-950 shadow-[0_0_60px_oklch(0.85_0.18_85/0.55)]`}
    >
      {p.nickname.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function RoundRecapReel({ players, roundNumber, triggerKey, onDone }: Props) {
  const [beat, setBeat] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    setBeat(0);
    const timers: number[] = [];
    for (let i = 1; i < TOTAL_BEATS; i++) {
      timers.push(window.setTimeout(() => setBeat(i), i * BEAT_MS));
    }
    timers.push(window.setTimeout(() => onDoneRef.current(), TOTAL_BEATS * BEAT_MS));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [triggerKey]);

  // Compute highlights
  const ranked = [...players].sort(
    (a, b) => (b.current_round_score ?? 0) - (a.current_round_score ?? 0),
  );
  const mvp = ranked[0];
  const fastest =
    players.find((p) => p.current_round_fastest) ??
    ranked.find((p) => (p.current_round_score ?? 0) > 0) ??
    null;
  const streakKing = [...players].sort(
    (a, b) => (b.streak_count ?? 0) - (a.streak_count ?? 0),
  )[0];
  const hasStreak = (streakKing?.streak_count ?? 0) >= 2;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.22_0.04_270/0.95),oklch(0.05_0.02_270)_75%)]" />
      {/* sweeping light bar */}
      <motion.div
        key={`sweep-${triggerKey}`}
        initial={{ x: "-30%", opacity: 0 }}
        animate={{ x: "120%", opacity: [0, 0.5, 0] }}
        transition={{ duration: TOTAL_BEATS * (BEAT_MS / 1000), ease: "easeInOut" }}
        className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-amber-300/15 to-transparent"
      />
      {/* film grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative grid h-full place-items-center p-8">
        <AnimatePresence mode="wait">
          {beat === 0 && (
            <motion.div
              key="b0"
              initial={{ opacity: 0, scale: 1.25, letterSpacing: "0.05em" }}
              animate={{ opacity: 1, scale: 1, letterSpacing: "0.15em" }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="text-center"
            >
              <div className="text-[11px] font-black uppercase tracking-[0.6em] text-amber-300/80">
                Recap
              </div>
              <div
                className="mt-2 font-display text-[18vw] font-black uppercase leading-none text-transparent sm:text-[14vw]"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, oklch(0.98 0.10 90) 0%, oklch(0.75 0.20 60) 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 8px 40px oklch(0.85 0.20 70 / 0.55))",
                }}
              >
                Round {roundNumber}
              </div>
              <div className="mx-auto mt-3 h-[3px] w-40 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
            </motion.div>
          )}

          {beat === 1 && fastest && (
            <motion.div
              key="b1"
              initial={{ opacity: 0, x: -120 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 120 }}
              transition={{ type: "spring", stiffness: 160, damping: 18 }}
              className="flex items-center gap-6 text-left"
            >
              <Avatar p={fastest} />
              <div>
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.4em] text-rose-300">
                  ⚡ Fastest finger
                </div>
                <div className="mt-1 font-display text-6xl font-black text-white">
                  {fastest.nickname}
                </div>
                {(fastest.current_round_score ?? 0) > 0 && (
                  <div className="mt-1 font-mono text-2xl font-black text-emerald-300">
                    +{fastest.current_round_score}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {beat === 2 && mvp && (
            <motion.div
              key="b2"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 180, damping: 16 }}
              className="flex items-center gap-6 text-left"
            >
              <Avatar p={mvp} size="h-32 w-32" />
              <div>
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.4em] text-amber-300">
                  ★ Round MVP
                </div>
                <div className="mt-1 font-display text-6xl font-black text-amber-200">
                  {mvp.nickname}
                </div>
                <div className="mt-1 font-mono text-3xl font-black text-emerald-300">
                  +{mvp.current_round_score ?? 0}
                </div>
                {hasStreak && streakKing && (
                  <div className="mt-2 text-xs font-bold uppercase tracking-widest text-rose-300/90">
                    🔥 {streakKing.nickname} on a {streakKing.streak_count} streak
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* progress pips */}
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
        {Array.from({ length: TOTAL_BEATS }).map((_, i) => (
          <div
            key={i}
            className={`h-1 w-12 rounded-full transition-all ${
              i <= beat ? "bg-amber-300" : "bg-white/15"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
