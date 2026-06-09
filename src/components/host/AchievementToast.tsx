import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { onAchievement, type AchievementEvent, type AchievementTone } from "@/lib/achievement-bus";
import { play } from "@/lib/sound-engine";

const TONE: Record<AchievementTone, { ring: string; bg: string; kicker: string; glow: string }> = {
  gold: {
    ring: "ring-amber-300/60",
    bg: "from-amber-300/15 via-amber-400/10 to-amber-500/15",
    kicker: "text-amber-300",
    glow: "oklch(0.85 0.22 80 / 0.55)",
  },
  rose: {
    ring: "ring-rose-400/60",
    bg: "from-rose-400/15 via-rose-500/10 to-rose-600/15",
    kicker: "text-rose-300",
    glow: "oklch(0.75 0.22 18 / 0.55)",
  },
  violet: {
    ring: "ring-violet-400/60",
    bg: "from-violet-400/15 via-violet-500/10 to-violet-600/15",
    kicker: "text-violet-300",
    glow: "oklch(0.72 0.20 295 / 0.55)",
  },
  emerald: {
    ring: "ring-emerald-400/60",
    bg: "from-emerald-400/15 via-emerald-500/10 to-emerald-600/15",
    kicker: "text-emerald-300",
    glow: "oklch(0.78 0.18 155 / 0.55)",
  },
  sky: {
    ring: "ring-sky-400/60",
    bg: "from-sky-400/15 via-sky-500/10 to-sky-600/15",
    kicker: "text-sky-300",
    glow: "oklch(0.78 0.16 235 / 0.55)",
  },
};

const DEFAULT_TTL = 2800;

type Active = AchievementEvent & { expiresAt: number };

/**
 * Big center-stage achievement banner. Coexists with the lower-third Chyron;
 * reserved for "perfect round", "comeback", and other peak moments.
 */
export function AchievementToast() {
  const [current, setCurrent] = useState<Active | null>(null);

  useEffect(() => {
    const off = onAchievement((evt) => {
      const ttl = evt.ttl ?? DEFAULT_TTL;
      setCurrent({ ...evt, expiresAt: Date.now() + ttl });
      try {
        play("airhorn", 0.35);
      } catch {
        /* noop */
      }
    });
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    const ms = Math.max(80, current.expiresAt - Date.now());
    const id = window.setTimeout(() => setCurrent(null), ms);
    return () => window.clearTimeout(id);
  }, [current]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[18%] z-[65] flex justify-center px-6">
      <AnimatePresence>
        {current && (() => {
          const tone = TONE[current.tone ?? "gold"];
          return (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: -30, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.94, transition: { duration: 0.28 } }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className={`relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-black/75 px-8 py-6 text-center shadow-[0_30px_100px_-20px_rgba(0,0,0,0.85)] backdrop-blur-md ring-2 ring-inset ${tone.ring}`}
              style={{
                boxShadow: `0 30px 100px -20px rgba(0,0,0,0.85), 0 0 60px ${tone.glow}`,
              }}
            >
              {/* Background bloom */}
              <div
                aria-hidden
                className={`absolute inset-0 bg-gradient-to-br ${tone.bg}`}
              />
              {/* Top sweep shimmer */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
                style={{ animation: "achievementSweep 1.6s ease-out forwards" }}
              />
              <div className="relative flex items-center justify-center gap-5">
                {current.icon && (
                  <motion.div
                    initial={{ rotate: -12, scale: 0.6 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.08 }}
                    className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-4xl ring-1 ring-white/10"
                  >
                    {current.icon}
                  </motion.div>
                )}
                <div className="min-w-0 text-left">
                  <div className={`text-[11px] font-black uppercase tracking-[0.5em] ${tone.kicker}`}>
                    {current.kicker}
                  </div>
                  <div className="mt-1 font-display text-3xl font-black uppercase leading-tight text-white sm:text-4xl">
                    {current.title}
                  </div>
                  {current.subtitle && (
                    <div className="mt-1 font-mono text-sm font-bold tabular-nums text-white/70">
                      {current.subtitle}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
