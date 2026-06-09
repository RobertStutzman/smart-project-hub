## Current category counts (live from DB)

Canonical categories (from `src/lib/categories.ts`):

| Category | Have | Need to reach ~200 |
| --- | --- | --- |
| General Knowledge | 207 | ✅ done |
| Movies | 27 | +173 |
| Movie Sci-Fi | 314 | ✅ done |
| TV Shows | 20 | +180 |
| Music | 27 | +173 |
| 80's Music | 140 | +60 |
| Sports | 20 | +180 |
| Science | 20 | +180 |
| Geography | 20 | +180 |
| History | 20 | +180 |
| Chapter & Verse | 140 | +60 |

Non-canonical categories also in DB (not in the picker — flag for cleanup or merge): `All things Hollywood (95)`, `Comedy Classics (40)`, `Famous Hollywood Movies (40)`, `Popular Movies (40)`, `Twilight Saga (20)`. Likely candidates to merge into `Movies` rather than top up.

## What I'll deliver
No code changes. Just a single, paste-ready Gemini prompt that:
- Targets one category at a time (so you can run it 8x for the eight that need topping up).
- Asks for exactly the count needed per run, American-audience tuned.
- Outputs strict JSON matching your `questions` table columns so you can bulk-insert.
- Enforces difficulty mix, no duplicates, plausible wrong answers, short explanation, no media.

## The prompt (use with `google/gemini-2.5-pro`, temperature ~0.8)

```
You are writing trivia questions for an American pub-style trivia app.

CATEGORY: <<<CATEGORY_NAME>>>
COUNT: <<<N>>>          // e.g. 180

Audience: U.S. general adult audience. Use American spelling, American sports
(NFL/MLB/NBA/NHL/NCAA over soccer/cricket), U.S. pop culture, U.S. history
weighting, Fahrenheit/miles where natural. Avoid UK-only references.

Write COUNT multiple-choice questions for CATEGORY. Output ONLY a valid JSON
array — no prose, no markdown fences. Each item must match this schema EXACTLY:

{
  "category": "<<<CATEGORY_NAME>>>",
  "subcategory": "short tag, e.g. 'NFL', '1990s', 'Astronomy'",
  "question_text": "Single sentence question, <= 140 chars.",
  "correct_answer": "Short answer, <= 60 chars.",
  "wrong_1": "Plausible distractor, same type/length as correct_answer.",
  "wrong_2": "Plausible distractor.",
  "wrong_3": "Plausible distractor.",
  "explanation": "1 sentence, <= 180 chars, factual flavor.",
  "difficulty": "easy" | "medium" | "hard"
}

Hard rules:
1. Exactly COUNT items.
2. Difficulty mix: 35% easy, 45% medium, 20% hard.
3. No duplicate questions and no near-duplicates (same answer phrased differently).
4. The correct answer must be unambiguous and verifiable as of 2024.
5. All four options must be the same kind of thing (all years, all people, all
   films, etc.) and similar length. No "all of the above" / "none".
6. No questions that depend on images, audio, or video.
7. No politics-of-the-day, no living-person controversies, no NSFW.
8. Spread subcategories — don't cluster 50 questions on one franchise/decade.
9. Keep answers concise; never put the answer inside the question.
10. Return ONLY the JSON array. No commentary, no trailing text.

Begin.
```

## How to run it
- Replace `<<<CATEGORY_NAME>>>` and `<<<N>>>` per category from the table above.
- Run once per category that needs topping up (8 runs).
- For very large counts (180) Gemini may truncate — if so, ask for two halves (e.g. "first 90, easy+medium" then "next 90, medium+hard") and concatenate.
- Save each response as `questions-<category>.json`, then bulk-insert into `public.questions`.

Want me to also wire up an admin "Generate with AI" button that calls Lovable AI with this prompt and inserts straight into the DB? Say the word and I'll plan that next.