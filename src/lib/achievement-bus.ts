// Pub/sub for the "big moment" achievement toast layer — the center-stage
// counterpart to the lower-third Chyron. Reserved for the loudest beats:
// perfect rounds, comebacks, clutch saves.

export type AchievementTone = "gold" | "rose" | "violet" | "emerald" | "sky";

export type AchievementEvent = {
  id: string;
  /** Tiny label above title, e.g. "PERFECT ROUND" */
  kicker: string;
  /** Big bold title, e.g. "Everyone nailed it" */
  title: string;
  /** Optional subtitle. */
  subtitle?: string;
  /** Optional emoji shown in the badge. */
  icon?: string;
  tone?: AchievementTone;
  /** Lifetime in ms before auto-dismiss. Default 2800. */
  ttl?: number;
  /** Dedupe key (5s window). */
  dedupe?: string;
};

type Listener = (e: AchievementEvent) => void;
const listeners = new Set<Listener>();
const recent = new Map<string, number>();
let counter = 0;
const DEDUPE_MS = 5_000;

export function emitAchievement(input: Omit<AchievementEvent, "id">): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (input.dedupe) {
    const until = recent.get(input.dedupe);
    if (until && until > now) return;
    recent.set(input.dedupe, now + DEDUPE_MS);
    if (recent.size > 64) {
      for (const [k, t] of recent) if (t < now) recent.delete(k);
    }
  }
  const evt: AchievementEvent = { id: `ach-${++counter}-${now}`, ...input };
  for (const l of listeners) {
    try {
      l(evt);
    } catch {
      /* ignore */
    }
  }
}

export function onAchievement(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
