import { useEffect, useState } from "react";

type Props = {
  activeUntil: string | null | undefined;
  leaderName: string | null;
};

/**
 * Big-screen glitch FX whenever room.glitch_active_until is in the future.
 * Renders a screen-tear flash with chromatic bands plus a fuchsia chyron
 * naming the leader whose phone is currently scrambled.
 */
export function GlitchOverlay({ activeUntil, leaderName }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeUntil) return;
    const id = window.setInterval(() => setNow(Date.now()), 80);
    return () => window.clearInterval(id);
  }, [activeUntil]);

  if (!activeUntil) return null;
  const untilMs = new Date(activeUntil).getTime();
  if (!Number.isFinite(untilMs) || untilMs <= now) return null;

  // Random per-tick offsets for chromatic jitter
  const jx = (Math.random() - 0.5) * 6;
  const jy = (Math.random() - 0.5) * 3;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
      style={{ mixBlendMode: "screen", transform: `translate(${jx}px, ${jy}px)` }}
    >
      {/* Three chromatic tear bands sliding at different speeds */}
      <div
        className="absolute left-0 right-0"
        style={{
          top: `${(now / 7) % 100}%`,
          height: "8%",
          background:
            "linear-gradient(90deg, oklch(0.85 0.28 320 / 0.55), oklch(0.85 0.28 200 / 0.55))",
          filter: "blur(2px)",
          mixBlendMode: "screen",
        }}
      />
      <div
        className="absolute left-0 right-0"
        style={{
          top: `${(now / 4) % 100}%`,
          height: "3%",
          background: "oklch(0.95 0.25 30 / 0.55)",
          mixBlendMode: "screen",
        }}
      />
      <div
        className="absolute left-0 right-0"
        style={{
          top: `${(now / 11) % 100}%`,
          height: "12%",
          background:
            "linear-gradient(90deg, oklch(0.85 0.28 200 / 0.4), oklch(0.85 0.28 320 / 0.4))",
          filter: "blur(4px)",
          mixBlendMode: "screen",
        }}
      />
      {/* Scanlines */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0, transparent 2px, oklch(0 0 0 / 0.6) 2px, oklch(0 0 0 / 0.6) 4px)",
        }}
      />
      {/* Fuchsia chyron */}
      <div
        className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full border-2 border-fuchsia-300/80 bg-fuchsia-900/80 px-5 py-2 font-display text-base font-black uppercase tracking-[0.3em] text-fuchsia-100 shadow-[0_0_60px_oklch(0.7_0.3_320/0.7)] animate-pulse"
        style={{ mixBlendMode: "normal" }}
      >
        ⚡ Glitch fired — {leaderName ?? "the leader"}'s screen scrambled
      </div>
    </div>
  );
}
