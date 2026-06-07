import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * Brief between-round splash. Shows "Round N" overlay for ~1.6s
 * whenever round_number increments past 1.
 */
export function RoundSplash({ round }: { round: number }) {
  const [visible, setVisible] = useState(false);
  const lastRef = useRef<number>(round);

  useEffect(() => {
    if (round > 1 && round !== lastRef.current) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 1600);
      lastRef.current = round;
      return () => clearTimeout(t);
    }
    lastRef.current = round;
  }, [round]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.6, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{ type: "spring", damping: 14, stiffness: 220 }}
            className="text-center"
          >
            <div className="text-xs font-bold uppercase tracking-[0.6em] text-amber-300/80">
              Next up
            </div>
            <div className="mt-2 bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text font-display text-[18vw] font-black uppercase leading-none tracking-tight text-transparent drop-shadow-[0_8px_30px_rgba(251,191,36,0.4)]">
              Round {round}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
