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
  tap: () => vibrate(15),
  correct: () => vibrate([20, 40, 60]),
  wrong: () => vibrate([80, 40, 80]),
  drop: () => vibrate([200, 80, 200]),
};
