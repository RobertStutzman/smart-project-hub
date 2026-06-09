import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { onReplay, type ReplayEvent } from "@/lib/replay-bus";
import { play } from "@/lib/sound-engine";

type Active = ReplayEvent & { expiresAt: number };

const DEFAULT_TTL = 2200;

/**
 * Broadcast "INSTANT REPLAY" lower-third graphic + tape-rewind synth sting.
 * Triggered by hotkey "R" or programmatically via triggerReplay().
 */
export function InstantReplay() {
  const [current, setCurrent] = useState<Active | null>(null);

  useEffect(() => {
    const off = onReplay((evt) => {
      const ttl = evt.ttl ?? DEFAULT_TTL;
      setCurrent({ ...evt, expiresAt: Date.now() + ttl });
      // Tape-rewind-ish: descending whoosh + crickets-style chitter
      try {
        play("whoosh", 0.6);
        window.setTimeout(() => play("crickets", 0.4), 120);
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
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[64] flex justify-center px-6">
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: -20, scaleX: 0.5 }}
            animate={{ opacity: 1, y: 0, scaleX: 1 }}
            exit={{ opacity: 0, y: -16, scaleX: 0.6, transition: { duration: 0.25 } }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="relative overflow-hidden rounded-xl border border-rose-400/40 bg-black/85 px-6 py-2.5 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.85)] backdrop-blur-md ring-2 ring-inset ring-rose-400/40"
            style={{ transformOrigin: "center" }}
          >
            {/* Tape-scan stripes */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-30"
              style={{
                background:
                  "repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 6px)",
                animation: "replayScan 1.4s linear infinite",
              }}
            />
            <div className="relative flex items-center gap-3">
              <motion.span
                aria-hidden
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                className="grid h-7 w-7 place-items-center rounded-full bg-rose-500 font-mono text-xs font-black text-white"
              >
                ●
              </motion.span>
              <div className="font-display text-base font-black uppercase tracking-[0.4em] text-rose-200 sm:text-lg">
                Instant&nbsp;Replay
              </div>
              {current.caption && (
                <div className="ml-2 hidden font-mono text-xs font-bold uppercase tracking-widest text-white/70 sm:block">
                  {current.caption}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
