export type Category = {
  name: string;
  emoji: string;
  isPremium: boolean;
};

export const CATEGORIES: Category[] = [
  { name: "Music", emoji: "🎵", isPremium: false },
  { name: "Movies", emoji: "🎬", isPremium: false },
  { name: "General Knowledge", emoji: "🧠", isPremium: false },
  { name: "Sports", emoji: "⚽", isPremium: false },
  { name: "History", emoji: "🏛️", isPremium: false },
  { name: "TV Shows", emoji: "📺", isPremium: false },
  { name: "Geography", emoji: "🌍", isPremium: false },
  { name: "Science", emoji: "🔬", isPremium: false },
];
