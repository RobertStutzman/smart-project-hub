import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { emojiForCategory } from "@/lib/categories";
import { play } from "@/lib/sound-engine";

type Props = {
  /** Category name e.g. "Movies". When null/empty, renders nothing. */
  category: string | null | undefined;
  /** Show/hide the card. Driven by parent's intro-phase logic. */
  visible: boolean;
  /** Optional sub-label e.g. "Round 2" */
  subline?: string | null;
  /** Stacking layer — sits above shutter (z 30) but under fullscreen reveal (z 50). */
  zIndex?: number;
};

/**
 * Broadcast-style category reveal card. Flips in from behind the shutter, holds
 * for ~900ms, then animates out. Plays a soft whoosh on entry.
 */
export function CategoryReveal({ category, visible, subline, zIndex = 35 }: Props) {
  const [shown, setShown] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShown(true);
      // Soft whoosh on entry — sits under the read VO without competing
      play("whoosh", 0.45);
      return;
    }
    // Let the exit animation play
    const t = window.setTimeout(() => setShown(false), 420);
    return () => window.clearTimeout(t);
  }, [visible]);

  if (!category || !shown) return null;
  const emoji = emojiForCategory(category);
  const label = category.toUpperCase();

  return (
    <div
      className="pointer-events-none absolute inset-0 grid place-items-center"
      style={{ zIndex }}
      aria-hidden
    >
      <motion.div
        initial={{ rotateX: -90, opacity: 0, y: -24 }}
        animate={
          visible
            ? { rotateX: 0, opacity: 1, y: 0 }
            : { rotateX: 90, opacity: 0, y: 24 }
        }
        transition={{
          duration: 0.55,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          transformPerspective: 1200,
          transformOrigin: "center top",
        }}
        className="relative flex min-w-[280px] flex-col items-center gap-3 rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-500/15 via-black/70 to-black/90 px-8 py-6 shadow-[0_30px_80px_-20px_rgba(252,200,90,0.45)] backdrop-blur-xl sm:min-w-[360px] sm:px-10 sm:py-7"
      >
        {/* Sweeping spotlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        >
          <div
            className="absolute -inset-y-8 left-[-30%] w-[40%] bg-gradient-to-r from-transparent via-white/15 to-transparent"
            style={{ animation: "categorySweep 1.4s ease-out 0.15s forwards" }}
          />
        </div>

        <div className="text-[11px] font-black uppercase tracking-[0.5em] text-amber-300/90">
          Category
        </div>
        <div className="text-6xl drop-shadow-[0_4px_18px_rgba(252,200,90,0.55)] sm:text-7xl">
          {emoji}
        </div>
        <div
          className="font-display text-2xl font-black leading-none text-white sm:text-3xl"
          style={{ letterSpacing: "0.04em" }}
        >
          {label}
        </div>
        {subline && (
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-white/60">
            {subline}
          </div>
        )}

        {/* Underline accent */}
        <div className="mt-1 h-[2px] w-24 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
      </motion.div>
    </div>
  );
}
