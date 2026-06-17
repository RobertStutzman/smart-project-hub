// Per-device "Adult Mode" toggle. R-rated + crude announcer line pools.
// Stored in localStorage, never on the server, never tied to an account.
// All line pickers (lobby, host-persona, persona-live, player-highlights)
// branch on isAdultMode() so toggling takes effect at the next callout.

const KEY = "btd-adult-mode";
const EVENT = "btd-adult-mode-change";

export function isAdultMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdultMode(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0");
    window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
  } catch {
    /* swallow */
  }
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
