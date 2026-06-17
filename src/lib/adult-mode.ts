// Per-tab "Adult Mode" toggle. R-rated + crude announcer line pools.
// Stored in sessionStorage so it AUTOMATICALLY clears when the tab/game
// closes — a kid opening the browser the next day will not inherit it.
// Never tied to an account, never sent to the server.
//
// All line pickers (lobby, host-persona, persona-live, player-highlights)
// branch on isAdultMode() so toggling takes effect at the next callout.

const KEY = "btd-adult-mode";
const EVENT = "btd-adult-mode-change";

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    // sessionStorage is primary. Fall back to localStorage purely so we can
    // proactively wipe any value left behind by older builds.
    const ss = window.sessionStorage.getItem(KEY);
    if (ss !== null) return ss;
    const ls = window.localStorage.getItem(KEY);
    if (ls !== null) {
      try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
    }
    return null;
  } catch {
    return null;
  }
}

export function isAdultMode(): boolean {
  return readRaw() === "1";
}

export function setAdultMode(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) {
      window.sessionStorage.setItem(KEY, "1");
    } else {
      window.sessionStorage.removeItem(KEY);
    }
    try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
  } catch {
    /* swallow */
  }
}

/** Force-disable. Call from game-end / leave-lobby paths. */
export function clearAdultMode() {
  setAdultMode(false);
}

/** Subscribe to changes (same-tab via CustomEvent + cross-tab via storage). */
export function subscribeAdultMode(cb: (on: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = (e: Event) => cb(Boolean((e as CustomEvent).detail));
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb(e.newValue === "1");
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
