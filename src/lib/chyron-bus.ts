// Lightweight pub/sub for broadcast-style "lower-third" chyrons that pop
// over the host stage during a game (streaks, fastest, rank changes, etc).
// Decoupled from React so any module (Leaderboard, HostGameStage, etc.)
// can emit without prop-drilling.

export type ChyronTone = "gold" | "rose" | "sky" | "emerald" | "violet";

export type ChyronEvent = {
  id: string;
  /** Tiny upper label e.g. "STREAK" / "FASTEST" / "BIG MOVER" */
  kicker: string;
  /** Big bold line e.g. "Alice — 3 in a row" */
  title: string;
  /** Optional small detail e.g. "+450 → 2,310 pts" */
  detail?: string;
  /** Optional emoji rendered in the badge area */
  icon?: string;
  /** Color theme. Defaults to gold. */
  tone?: ChyronTone;
  /** Lifetime in ms before auto-dismiss. Default 2800. */
  ttl?: number;
  /** Dedupe key — if a chyron with the same key is already queued/visible, drop the new one. */
  dedupe?: string;
};

type Listener = (e: ChyronEvent) => void;
const listeners = new Set<Listener>();
const recent = new Map<string, number>(); // dedupe key → expiry ms

let counter = 0;
const DEDUPE_WINDOW_MS = 5_000;

export function emitChyron(input: Omit<ChyronEvent, "id">): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (input.dedupe) {
    const until = recent.get(input.dedupe);
    if (until && until > now) return;
    recent.set(input.dedupe, now + DEDUPE_WINDOW_MS);
    // Lazy cleanup
    if (recent.size > 64) {
      for (const [k, t] of recent) if (t < now) recent.delete(k);
    }
  }
  const evt: ChyronEvent = { id: `chy-${++counter}-${now}`, ...input };
  for (const l of listeners) {
    try {
      l(evt);
    } catch {
      /* ignore */
    }
  }
}

export function onChyron(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
