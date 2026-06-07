import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { play } from "@/lib/sound-engine";

/**
 * Cinematic shutter wipe: two horizontal black bands slam in from top/bottom,
 * meet in the middle (covering the screen), hold the title for a beat with
 * film grain + a thin gold seam, then snap open to reveal the next scene.
 *
 * Total runtime ≈ closeMs + holdMs + openMs (default 500 + 1100 + 600 = 2200).
 *
 * Used by RoundSplash (round changes) and QuestionStage intro badge.
 */
type Props = {
  visible: boolean;
  /** Big number / title to display while the shutter is closed. */
  title: React.ReactNode;
  /** Small eyebrow label above the title. */
  eyebrow?: string;
  closeMs?: number;
  holdMs?: number;
  openMs?: number;
  /** Stacking position. */
  zIndex?: number;
  /** Container — fixed (default, full viewport) or absolute (inside a parent). */
  position?: "fixed" | "absolute";
};

const NOISE_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>` +
      `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>` +
      `<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter>` +
      `<rect width='100%' height='100%' filter='url(#n)'/></svg>`,
  );

export function ShutterTransition({
  visible,
  title,
  eyebrow,
  closeMs = 500,
  holdMs = 1100,
  openMs = 600,
  zIndex = 50,
  position = "fixed",
}: Props) {
  // Sound: thump on close, shink on open.
  useEffect(() => {
    if (!visible) return;
    play("shutterClose");
    const id = window.setTimeout(() => play("shutterOpen"), closeMs + holdMs);
    return () => window.clearTimeout(id);
  }, [visible, closeMs, holdMs]);

  const closeSec = closeMs / 1000;
  const openSec = openMs / 1000;
  const holdSec = holdMs / 1000;
  const titleHoldEnd = (closeMs + holdMs) / 1000;

  const containerCls =
    position === "fixed"
      ? "pointer-events-none fixed inset-0 overflow-hidden"
      : "pointer-events-none absolute inset-0 overflow-hidden";

  // Curtain easing — heavy on the way in, snappy on the way out.
  const closeEase = [0.6, 0, 0.2, 1] as const;
  const openEase = [0.85, 0, 0.15, 1] as const;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={containerCls}
          style={{ zIndex }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.05 } }}
        >
          {/* Top band */}
          <motion.div
            className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black via-black to-black/95"
            initial={{ y: "-100%" }}
            animate={{ y: ["-100%", "0%", "0%", "-100%"] }}
            transition={{
              duration: closeSec + holdSec + openSec,
              times: [
                0,
                closeSec / (closeSec + holdSec + openSec),
                (closeSec + holdSec) / (closeSec + holdSec + openSec),
                1,
              ],
              ease: [closeEase, "linear", openEase] as never,
            }}
          />
          {/* Bottom band */}
          <motion.div
            className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black to-black/95"
            initial={{ y: "100%" }}
            animate={{ y: ["100%", "0%", "0%", "100%"] }}
            transition={{
              duration: closeSec + holdSec + openSec,
              times: [
                0,
                closeSec / (closeSec + holdSec + openSec),
                (closeSec + holdSec) / (closeSec + holdSec + openSec),
                1,
              ],
              ease: [closeEase, "linear", openEase] as never,
            }}
          />

          {/* Gold seam flash at the moment bands meet, and again as they open */}
          <motion.div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1, 0.6, 0, 0.8, 0] }}
            transition={{
              duration: closeSec + holdSec + openSec,
              times: [
                0,
                Math.max(0, (closeSec - 0.08) / (closeSec + holdSec + openSec)),
                closeSec / (closeSec + holdSec + openSec),
                Math.min(1, (closeSec + 0.12) / (closeSec + holdSec + openSec)),
                (closeSec + holdSec * 0.6) / (closeSec + holdSec + openSec),
                (closeSec + holdSec + 0.02) / (closeSec + holdSec + openSec),
                Math.min(1, (closeSec + holdSec + 0.25) / (closeSec + holdSec + openSec)),
              ],
            }}
          >
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_30px_8px_rgba(251,191,36,0.55)]" />
          </motion.div>

          {/* Title block (visible only while bands are closed) */}
          <motion.div
            className="absolute inset-0 grid place-items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1, 1, 0] }}
            transition={{
              duration: closeSec + holdSec + openSec,
              times: [
                0,
                (closeSec - 0.05) / (closeSec + holdSec + openSec),
                (closeSec + 0.05) / (closeSec + holdSec + openSec),
                (titleHoldEnd - 0.1) / (closeSec + holdSec + openSec),
                titleHoldEnd / (closeSec + holdSec + openSec),
              ],
            }}
          >
            <motion.div
              className="text-center px-6"
              initial={{ scale: 0.92, y: 14 }}
              animate={{ scale: [0.92, 1.02, 1, 1], y: [14, -4, 0, 0] }}
              transition={{
                duration: closeSec + holdSec * 0.4,
                times: [0, closeSec / (closeSec + holdSec * 0.4), 0.8, 1],
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {eyebrow && (
                <div className="text-[11px] font-bold uppercase tracking-[0.7em] text-amber-300/80 sm:text-xs">
                  {eyebrow}
                </div>
              )}
              <div className="mt-3 bg-gradient-to-b from-white via-amber-100 to-amber-400 bg-clip-text font-display text-[16vw] font-black uppercase leading-[0.85] tracking-tight text-transparent drop-shadow-[0_10px_40px_rgba(251,191,36,0.35)] sm:text-[12vw] lg:text-[10vw]">
                {title}
              </div>
              <div className="mx-auto mt-4 h-[2px] w-24 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
            </motion.div>
          </motion.div>

          {/* Film grain overlay across the whole transition */}
          <motion.div
            className="absolute inset-0 mix-blend-overlay"
            style={{
              backgroundImage: `url("${NOISE_SVG}")`,
              backgroundSize: "180px 180px",
              opacity: 0.35,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.35, 0.4, 0.35, 0] }}
            transition={{
              duration: closeSec + holdSec + openSec,
              times: [0, closeSec / (closeSec + holdSec + openSec), 0.5, titleHoldEnd / (closeSec + holdSec + openSec), 1],
            }}
          />

          {/* Subtle vignette pulse during the hold */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.5) 100%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 0.6, 0.4, 0] }}
            transition={{
              duration: closeSec + holdSec + openSec,
              times: [0, closeSec / (closeSec + holdSec + openSec), (closeSec + holdSec * 0.5) / (closeSec + holdSec + openSec), titleHoldEnd / (closeSec + holdSec + openSec), 1],
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
