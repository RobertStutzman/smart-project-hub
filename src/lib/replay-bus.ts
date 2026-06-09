// Pub/sub for the instant-replay lower-third graphic. Triggered manually via
// hotkey "R" or automatically on dramatic moments (leader change late game).

export type ReplayEvent = {
  id: string;
  /** Optional caption shown under the "INSTANT REPLAY" wordmark. */
  caption?: string;
  /** Lifetime in ms. Default 2200. */
  ttl?: number;
  dedupe?: string;
};

type Listener = (e: ReplayEvent) => void;
const listeners = new Set<Listener>();
const recent = new Map<string, number>();
let counter = 0;
const DEDUPE_MS = 4_000;

export function triggerReplay(input: Omit<ReplayEvent, "id"> = {}): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (input.dedupe) {
    const until = recent.get(input.dedupe);
    if (until && until > now) return;
    recent.set(input.dedupe, now + DEDUPE_MS);
  }
  const evt: ReplayEvent = { id: `rep-${++counter}-${now}`, ...input };
  for (const l of listeners) {
    try {
      l(evt);
    } catch {
      /* ignore */
    }
  }
}

export function onReplay(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
