export type Category = {
  name: string;
  emoji: string;
  isPremium: boolean;
};

export const MIX_CATEGORY = "Mystery Mix";

export const CATEGORIES: Category[] = [
  { name: "Movie Sci-Fi", emoji: "🚀", isPremium: false },
  { name: "Sports", emoji: "⚽", isPremium: false },
  { name: "80's Music", emoji: "🎸", isPremium: false },
  { name: "Chapter & Verse", emoji: "📖", isPremium: false },
  { name: MIX_CATEGORY, emoji: "🎲", isPremium: false },
];
