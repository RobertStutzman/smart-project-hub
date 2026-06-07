export type Category = {
  name: string;
  emoji: string;
  isPremium: boolean;
};

export const CATEGORIES: Category[] = [
  { name: "Movie Sci-Fi", emoji: "🚀", isPremium: false },
  { name: "Sports", emoji: "⚽", isPremium: false },
  { name: "80's Music", emoji: "🎸", isPremium: false },
  { name: "Bible", emoji: "📖", isPremium: false },
];
