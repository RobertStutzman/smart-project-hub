import { useEffect, useRef, useState } from "react";

/** Tweens a number from `from` to `to` over `durMs`. Restarts when `to` changes. */
export function useCountUp(to: number, durMs = 500, from = 0): number {
  const [value, setValue] = useState(from);
  const fromRef = useRef(from);
  useEffect(() => {
    const start = performance.now();
    const startVal = fromRef.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = startVal + (to - startVal) * eased;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durMs]);
  return value;
}

/**
 * Returns the count of items considered "revealed" so far based on a stagger.
 * Resets when `key` changes.
 */
export function useStaggeredReveal(
  total: number,
  delayMs: number,
  startDelayMs = 0,
  key: string | number = "default",
): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (total <= 0) return;
    const timers: number[] = [];
    for (let i = 1; i <= total; i++) {
      timers.push(
        window.setTimeout(() => setCount((c) => Math.max(c, i)), startDelayMs + i * delayMs),
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [total, delayMs, startDelayMs, key]);
  return count;
}

/** Stage progression for a multi-beat reveal. Returns 0..stages-1, advancing per `beats` array (ms). */
export function useRevealStages(beats: number[], key: string | number): number {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    setStage(0);
    const timers: number[] = [];
    let acc = 0;
    beats.forEach((b, i) => {
      acc += b;
      timers.push(window.setTimeout(() => setStage(i + 1), acc));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return stage;
}
