export type Category = {
  name: string;
  emoji: string;
  isPremium: boolean;
};

export const CATEGORIES: Category[] = [
  { name: "Music", emoji: "🎵", isPremium: false },
  { name: "Movies", emoji: "🎬", isPremium: false },
  { name: "General Knowledge", emoji: "🧠", isPremium: false },
  { name: "Sports", emoji: "⚽", isPremium: true },
  { name: "History", emoji: "🏛️", isPremium: true },
  { name: "TV Shows", emoji: "📺", isPremium: true },
  { name: "Geography", emoji: "🌍", isPremium: true },
  { name: "Science", emoji: "🔬", isPremium: true },
];
