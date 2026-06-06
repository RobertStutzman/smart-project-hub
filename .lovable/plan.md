# Unlock premium + seed more questions

## Problem
- Only 3 categories (Music, Movies, General Knowledge) have questions, 7 each → rounds run dry by question 8.
- 5 categories (Sports, History, TV Shows, Geography, Science) are flagged `isPremium: true` and hidden behind the paywall.

## Changes

### 1. `src/lib/categories.ts`
Flip every category to `isPremium: false` so the host can pick any category without the paywall. (Premium flag stays in the type for later — just no category uses it right now.)

### 2. New migration: seed ~20 questions per category
Insert ~20 trivia questions for each of the 8 categories (Music, Movies, General Knowledge, Sports, History, TV Shows, Geography, Science) into `public.questions`. Each row: `question_text`, `correct_answer`, `wrong_1/2/3`, `category`, `is_premium = false`. That gives ~160 questions total — enough for the full 15-round game in any single category, plus headroom for repeats across sessions.

No schema changes; just data inserts via the migration tool.

## Out of scope
- Real premium gating / billing logic (the `is_premium` column + paywall code stay in place, just inert).
- Admin UI changes — admins can still add more questions later via `/admin`.
- Resetting `room_questions` for old rooms — start a new room to see the new pool.
