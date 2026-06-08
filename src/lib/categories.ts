export type Category = {
  name: string;
  emoji: string;
  isPremium: boolean;
};

export const MIX_CATEGORY = "Mystery Mix";

// Used by the admin question form. The host "Surprise Mix" picker reads the
// real list from the DB via listCategories().
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
  { name: MIX_CATEGORY, emoji: "🎲", isPremium: false },
];

// Emoji used for any category not in the hardcoded list above.
export const DEFAULT_CATEGORY_EMOJI = "❓";

// Categories that are OFF by default for new hosts. Hosts can opt in from the
// lobby settings sheet. Keeps niche / opinionated packs out of Surprise Mix
// unless explicitly enabled.
export const DEFAULT_OFF_CATEGORIES: string[] = ["Chapter & Verse"];

export function emojiForCategory(name: string): string {
  return CATEGORIES.find((c) => c.name === name)?.emoji ?? DEFAULT_CATEGORY_EMOJI;
}
