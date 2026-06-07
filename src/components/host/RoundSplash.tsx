import { useEffect, useRef, useState } from "react";
import { ShutterTransition } from "./ShutterTransition";

/**
 * Cinematic between-round splash. Shutter wipe with grain + bass thump.
 * Fires whenever round_number increments past 1.
 */
export function RoundSplash({ round }: { round: number }) {
  const [visible, setVisible] = useState(false);
  const lastRef = useRef<number>(round);

  // Match ShutterTransition runtime: 500 + 1100 + 600 = 2200ms.
  const TOTAL_MS = 2200;

  useEffect(() => {
    if (round > 1 && round !== lastRef.current) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), TOTAL_MS);
      lastRef.current = round;
      return () => clearTimeout(t);
    }
    lastRef.current = round;
  }, [round]);

  return (
    <ShutterTransition
      visible={visible}
      eyebrow="Next up"
      title={`Round ${round}`}
      closeMs={500}
      holdMs={1100}
      openMs={600}
      zIndex={50}
    />
  );
}
