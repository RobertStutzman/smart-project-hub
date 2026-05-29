import { useEffect, useState } from "react";

// Pulses red faster as `secondsLeft` drops below 5.
export function HeartbeatBackground({ secondsLeft }: { secondsLeft: number | null }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (secondsLeft === null || secondsLeft > 5) {
      setOn(false);
      return;
    }
    // tempo: from ~700ms at 5s left → ~140ms at 0
    const tempo = Math.max(140, 140 + secondsLeft * 110);
    const id = window.setInterval(() => setOn((p) => !p), tempo);
    return () => window.clearInterval(id);
  }, [secondsLeft]);

  const active = secondsLeft !== null && secondsLeft <= 5;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-150"
      style={{
        background:
          "radial-gradient(ellipse at center, oklch(0.55 0.25 25 / 0.55), transparent 70%)",
        opacity: active && on ? 1 : 0,
      }}
    />
  );
}
