// Per-tab content rating. Drives which announcer line pools play.
//
// Ratings:
//   'pg'   → default. Standard Elf pool, family-safe. No profanity.
//   'pg13' → same standard pool as PG (identical behavior today). Reserved
//            so we can later strip spicier-but-clean burns from PG.
//   'ma'   → 18+. Enables adult male pool + Sasha (female) interjections.
//
// The rating is stored in sessionStorage so it AUTOMATICALLY clears when
// the tab/game closes — a kid opening the browser the next day cannot
// inherit MA. It is never tied to an account and never sent to the server.
//
// Every announcer line picker calls isAdultMode() (or getContentRating())
// and defaults to the family pool when unset, so a fresh game that hasn't
// picked a rating yet stays PG.

export type ContentRating = "pg" | "pg13" | "ma";

const RATING_KEY = "btd-content-rating";
const RATING_VERSION_KEY = "btd-content-rating-version";
const RATING_VERSION = "v1";
const RATING_EVENT = "btd-content-rating-change";

// Legacy keys from the old boolean adult-mode toggle. Read-then-purge on
// startup so a stale "1" from a previous build can never auto-promote to MA.
const LEGACY_KEY = "btd-adult-mode";
const LEGACY_VERSION_KEY = "btd-adult-mode-version";
const LEGACY_EVENT = "btd-adult-mode-change";

function purgeLegacy() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(LEGACY_KEY);
    window.sessionStorage.removeItem(LEGACY_VERSION_KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch { /* ignore */ }
}

function readRating(): ContentRating | null {
  if (typeof window === "undefined") return null;
  try {
    purgeLegacy();
    if (window.sessionStorage.getItem(RATING_VERSION_KEY) !== RATING_VERSION) {
      window.sessionStorage.removeItem(RATING_KEY);
      window.sessionStorage.removeItem(RATING_VERSION_KEY);
      return null;
    }
    const raw = window.sessionStorage.getItem(RATING_KEY);
    if (raw === "pg" || raw === "pg13" || raw === "ma") return raw;
    return null;
  } catch {
    return null;
  }
}

/** Current rating, or null if the user hasn't picked one yet this session. */
export function getContentRating(): ContentRating | null {
  return readRating();
}

/** True once the host has explicitly picked a rating this session. */
export function hasPickedRating(): boolean {
  return readRating() !== null;
}

/** Effective rating for line pickers — defaults to PG when unpicked. */
export function effectiveRating(): ContentRating {
  return readRating() ?? "pg";
}

export function setContentRating(rating: ContentRating | null) {
  if (typeof window === "undefined") return;
  try {
    if (rating === null) {
      window.sessionStorage.removeItem(RATING_KEY);
      window.sessionStorage.removeItem(RATING_VERSION_KEY);
    } else {
      window.sessionStorage.setItem(RATING_KEY, rating);
      window.sessionStorage.setItem(RATING_VERSION_KEY, RATING_VERSION);
    }
    purgeLegacy();
    window.dispatchEvent(new CustomEvent(RATING_EVENT, { detail: rating }));
    // Keep legacy subscribers working during the migration window.
    window.dispatchEvent(new CustomEvent(LEGACY_EVENT, { detail: rating === "ma" }));
  } catch { /* swallow */ }
}

/** True when the effective rating is MA (18+). This is the single source
 *  of truth every adult-content branch reads. */
export function isAdultMode(): boolean {
  return readRating() === "ma";
}

/** Legacy shim: old callers still flip a boolean. Maps to pg / ma. */
export function setAdultMode(on: boolean) {
  setContentRating(on ? "ma" : "pg");
}

/** Force-reset rating (call on game-end, leave-lobby, or on lobby mount
 *  so a stale MA can't leak into a fresh game). */
export function clearAdultMode() {
  setContentRating(null);
}

/** Subscribe to rating changes in the same tab. */
export function subscribeContentRating(
  cb: (rating: ContentRating | null) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail === null || detail === "pg" || detail === "pg13" || detail === "ma") {
      cb(detail);
    }
  };
  window.addEventListener(RATING_EVENT, onCustom);
  return () => window.removeEventListener(RATING_EVENT, onCustom);
}

/** Legacy boolean subscribe — kept for existing callers. */
export function subscribeAdultMode(cb: (on: boolean) => void): () => void {
  return subscribeContentRating((r) => cb(r === "ma"));
}
