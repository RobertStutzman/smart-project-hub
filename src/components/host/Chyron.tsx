import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { onChyron, type ChyronEvent, type ChyronTone } from "@/lib/chyron-bus";

const TONE: Record<ChyronTone, { ring: string; accent: string; kicker: string }> = {
  gold: {
    ring: "ring-amber-300/50",
    accent: "from-amber-300 via-amber-400 to-amber-500",
    kicker: "text-amber-300",
  },
  rose: {
    ring: "ring-rose-400/50",
    accent: "from-rose-400 via-rose-500 to-rose-600",
    kicker: "text-rose-300",
  },
  sky: {
    ring: "ring-sky-400/50",
    accent: "from-sky-300 via-sky-400 to-sky-500",
    kicker: "text-sky-300",
  },
  emerald: {
    ring: "ring-emerald-400/50",
    accent: "from-emerald-300 via-emerald-400 to-emerald-500",
    kicker: "text-emerald-300",
  },
  violet: {
    ring: "ring-violet-400/50",
    accent: "from-violet-300 via-violet-400 to-violet-500",
    kicker: "text-violet-300",
  },
};

const DEFAULT_TTL = 2800;
const MAX_STACK = 3;

type Active = ChyronEvent & { expiresAt: number };

/**
 * Broadcast-style lower-third overlay. Listens to chyron-bus and renders a
 * stack of up to 3 cards in the bottom-left. Pure presentation; no game state.
 */
export function Chyron() {
  const [items, setItems] = useState<Active[]>([]);

  useEffect(() => {
    const off = onChyron((evt) => {
      const ttl = evt.ttl ?? DEFAULT_TTL;
      const next: Active = { ...evt, expiresAt: Date.now() + ttl };
      setItems((prev) => {
        const merged = [...prev, next];
        // Trim oldest if stack exceeds max
        if (merged.length > MAX_STACK) merged.splice(0, merged.length - MAX_STACK);
        return merged;
      });
    });
    return () => {
      off();
    };
  }, []);

  // Sweep expired items 4x/sec — cheap and avoids per-item timers
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setItems((prev) => (prev.some((x) => x.expiresAt <= now) ? prev.filter((x) => x.expiresAt > now) : prev));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-[60] flex w-[min(420px,92vw)] flex-col gap-2 sm:bottom-10 sm:left-10">
      <AnimatePresence initial={false}>
        {items.map((evt) => {
          const tone = TONE[evt.tone ?? "gold"];
          return (
            <motion.div
              key={evt.id}
              layout
              initial={{ x: -60, opacity: 0, scaleX: 0.92 }}
              animate={{ x: 0, opacity: 1, scaleX: 1 }}
              exit={{ x: -40, opacity: 0, transition: { duration: 0.22 } }}
              transition={{ type: "spring", stiffness: 360, damping: 30 }}
              className={`relative overflow-hidden rounded-r-xl rounded-l-sm border border-white/10 bg-black/70 px-4 py-2.5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] backdrop-blur-md ring-1 ring-inset ${tone.ring}`}
              style={{ transformOrigin: "left center" }}
            >
              {/* Left accent bar */}
              <div
                className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${tone.accent}`}
                aria-hidden
              />
              {/* Sweeping underline shimmer */}
              <div
                aria-hidden
                className={`absolute bottom-0 left-1.5 right-0 h-[2px] bg-gradient-to-r ${tone.accent} opacity-80`}
                style={{
                  animation: "chyronSweep 2.4s ease-out forwards",
                  transformOrigin: "left center",
                }}
              />
              <div className="flex items-center gap-3 pl-2">
                {evt.icon && (
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xl ring-1 ring-white/10">
                    {evt.icon}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[10px] font-black uppercase tracking-[0.32em] ${tone.kicker}`}
                  >
                    {evt.kicker}
                  </div>
                  <div className="truncate font-display text-base font-black leading-tight text-white sm:text-lg">
                    {evt.title}
                  </div>
                  {evt.detail && (
                    <div className="truncate font-mono text-[11px] font-bold tabular-nums text-white/70">
                      {evt.detail}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
