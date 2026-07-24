// Anti-repetition helper for voice/callout pools.
//
// Keeps an in-memory ring buffer of recently-picked lines per pool key so
// the same string doesn't fire twice in quick succession, and — with the
// dynamic window sized to the pool — doesn't cycle back for a long while.
//
// Also mirrors the buffer into sessionStorage so a mid-session refresh
// (host reload, tab restore) doesn't dump us back to line #1 every time.
//
// Keys should identify the *pool*, not the moment context. Good keys:
//   "host-persona:first_blood"       (per Moment)
//   "lobby:opener"                   (single pool)
//   "round-callouts:mid:7"           (per question slot)
//   "persona-live:leader_changed"    (per LiveMoment)
//
// Callers pass the candidate pool as-is; the helper returns an item that
// isn't in the recent window (or, if every item is recent, returns the
// oldest one and rotates it out).
//
// Reset semantics:
//   resetNoRepeat()             clears everything (new game / new room)
//   resetNoRepeat("prefix:")    clears any key starting with the prefix

const MAX_KEYS = 256;
const STORAGE_KEY = "btd-no-repeat-v1";

type State = Record<string, string[]>;

let state: State = load();

function load(): State {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as State;
  } catch { /* ignore */ }
  return {};
}

let saveScheduled = false;
function save(): void {
  if (typeof window === "undefined") return;
  if (saveScheduled) return;
  saveScheduled = true;
  // Debounce writes; sessionStorage sync is cheap but not free.
  Promise.resolve().then(() => {
    saveScheduled = false;
    try {
      // Prune oldest keys if we've ballooned.
      const keys = Object.keys(state);
      if (keys.length > MAX_KEYS) {
        const drop = keys.slice(0, keys.length - MAX_KEYS);
        for (const k of drop) delete state[k];
      }
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* quota / private mode: ignore */ }
  });
}

/**
 * Size of the "recent" window. Grows with the pool so bigger pools get
 * meaningfully longer memories, but never so large that every candidate is
 * blocked. For a pool of N, remember up to min(N-1, ceil(N*0.6), cap).
 */
function windowSize(poolLen: number, cap = 40): number {
  if (poolLen <= 1) return 0;
  return Math.min(poolLen - 1, Math.ceil(poolLen * 0.6), cap);
}

/**
 * Return an item from `pool` that hasn't been used recently for `key`.
 * If a `seed` is supplied, the choice among fresh candidates is
 * deterministic on that seed; otherwise it's random.
 */
export function pickFresh<T extends string>(
  key: string,
  pool: readonly T[],
  opts?: { seed?: number | string; cap?: number },
): T {
  if (pool.length === 0) throw new Error(`pickFresh: empty pool for ${key}`);
  if (pool.length === 1) return pool[0];

  const recent = state[key] ?? [];
  const win = windowSize(pool.length, opts?.cap);
  const blocked = new Set(recent.slice(-win));
  const fresh = pool.filter((l) => !blocked.has(l));
  const candidates: readonly T[] = fresh.length > 0 ? fresh : pool;

  let idx: number;
  if (opts?.seed !== undefined) {
    const s = typeof opts.seed === "string" ? hashString(opts.seed) : Math.floor(opts.seed);
    idx = Math.abs(s) % candidates.length;
  } else {
    idx = Math.floor(Math.random() * candidates.length);
  }
  const chosen = candidates[idx];
  markUsed(key, chosen, win);
  return chosen;
}

/** Manually record that a line was spoken (for callers with bespoke picking). */
export function markUsed(key: string, line: string, cap = 40): void {
  const cur = state[key] ?? [];
  cur.push(line);
  const max = Math.max(cap, 8);
  if (cur.length > max) cur.splice(0, cur.length - max);
  state[key] = cur;
  save();
}

/** Clear all keys, or every key starting with `prefix`. */
export function resetNoRepeat(prefix?: string): void {
  if (!prefix) {
    state = {};
  } else {
    for (const k of Object.keys(state)) {
      if (k.startsWith(prefix)) delete state[k];
    }
  }
  save();
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}
