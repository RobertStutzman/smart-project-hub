// Wraps navigator.vibrate with safe fallback.
export function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof nav.vibrate === "function") {
    try {
      nav.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}

export const Haptics = {
  tap: () => vibrate(18),
  lock: () => vibrate([40, 30, 90]),
  correct: () => vibrate([30, 50, 80, 50, 120]),
  wrong: () => vibrate([120, 60, 120, 60, 200]),
  drop: () => vibrate([250, 80, 250, 80, 350]),
};
