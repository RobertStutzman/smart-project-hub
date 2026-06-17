export type Category = {
  name: string;
  emoji: string;
  isPremium: boolean;
};

export const MIX_CATEGORY = "Mystery Mix";

// Hardcoded seed list used by the admin question form. The host "Surprise Mix"
// picker also merges in any extra categories discovered in the DB.
export const CATEGORIES: Category[] = [
  { name: "General Knowledge", emoji: "🧠", isPremium: false },
  { name: "Movies", emoji: "🎬", isPremium: false },
  { name: "Movie Sci-Fi", emoji: "🚀", isPremium: false },
  { name: "TV Shows", emoji: "📺", isPremium: false },
  { name: "Music", emoji: "🎵", isPremium: false },
  { name: "80's Music", emoji: "🎸", isPremium: false },
  { name: "Sports", emoji: "⚽", isPremium: false },
  { name: "Science", emoji: "🔬", isPremium: false },
  { name: "Geography", emoji: "🌍", isPremium: false },
  { name: "History", emoji: "📜", isPremium: false },
  { name: "Chapter & Verse", emoji: "📖", isPremium: false },
  { name: "Kids", emoji: "🧒", isPremium: false },
  { name: MIX_CATEGORY, emoji: "🎲", isPremium: false },
];

// Emoji used for any category not in the hardcoded list above AND missing from
// the live category_meta cache.
export const DEFAULT_CATEGORY_EMOJI = "❓";

// Hardcoded off-by-default categories. Merged with the live category_meta
// cache at runtime via `mergedDefaultOffCategories()`.
export const DEFAULT_OFF_CATEGORIES: string[] = ["Kids"];

// ---------------------------------------------------------------------------
// Runtime cache for DB-backed category metadata.
//
// The app calls `listCategoryMeta()` on mount and feeds the result into
// `setCategoryMetaCache()`. After that, `emojiForCategory()` and
// `mergedDefaultOffCategories()` reflect any auto-registered categories
// (e.g. ones added by a Gemini paste) without a code change.
// ---------------------------------------------------------------------------

type CategoryMetaEntry = { emoji: string; off_by_default: boolean };

let CATEGORY_META_CACHE: Map<string, CategoryMetaEntry> = new Map();
const META_LISTENERS: Set<() => void> = new Set();

export function setCategoryMetaCache(
  entries: Array<{ name: string; emoji: string; off_by_default: boolean }>,
): void {
  const next = new Map<string, CategoryMetaEntry>();
  for (const e of entries) {
    next.set(e.name, { emoji: e.emoji, off_by_default: e.off_by_default });
  }
  CATEGORY_META_CACHE = next;
  for (const cb of META_LISTENERS) {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeCategoryMeta(cb: () => void): () => void {
  META_LISTENERS.add(cb);
  return () => {
    META_LISTENERS.delete(cb);
  };
}

export function emojiForCategory(name: string): string {
  const cached = CATEGORY_META_CACHE.get(name);
  if (cached?.emoji) return cached.emoji;
  return CATEGORIES.find((c) => c.name === name)?.emoji ?? DEFAULT_CATEGORY_EMOJI;
}

export function mergedDefaultOffCategories(): Set<string> {
  const out = new Set<string>(DEFAULT_OFF_CATEGORIES);
  for (const [name, meta] of CATEGORY_META_CACHE) {
    if (meta.off_by_default) out.add(name);
  }
  return out;
}
