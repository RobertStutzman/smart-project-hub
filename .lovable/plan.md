
# Category picker cleanup + adult-content hard gate

Three changes, all lobby-facing.

---

## 1. Make "All / None" obviously clickable

Current state (`src/routes/host.tsx:1376-1397`): "All" and "None" are tiny `text-white/60` text links next to the "Categories" heading — easy to miss.

Change:
- Convert them into two proper pill buttons above the category grid, full width row, amber outline + hover fill, matching the visual weight of the category chips themselves.
- Label them `✓ Select all` and `✕ Clear all` with a small count indicator like `(24 categories)`.
- Keep placement (right above the grid) so the mental model stays the same.

No behavior change — same `persistEnabled(...)` calls.

---

## 2. Hard-gate Adults Only questions behind MA rating

The Vox line pools are already correctly gated (audit confirmed every `isAdultMode()` call defaults to the safe pool when rating is `pg`/`pg13`/unset). **But the question pool itself is not gated** — both "Adults Only" categories have `off_by_default = false` in `category_meta`, so on a fresh room they're checked by default and R-rated questions can be drawn even when the host picked PG.

Fix:
- In the host lobby, when the effective rating is `pg` or `pg13` (or unset), the Adults Only category chip is:
  - forced OFF,
  - visually locked (lock icon, muted styling, disabled),
  - tooltip: "Requires MA 18+ rating".
- When the host switches to MA (after the age/terms modal), the chip unlocks and can be toggled.
- Belt-and-suspenders in `src/lib/category-utils.ts` (or the fetch layer): filter Adults Only out of the enabled set at question-draw time whenever `effectiveRating() !== "ma"`, so a stale sessionStorage or race can't leak an adult question.
- Set `off_by_default = true` on both Adults Only rows in `category_meta` via migration so the default state is opt-in.

---

## 3. Consolidate 49 categories → 15

Current live counts (49 distinct values, several duplicates and micro-categories):

Proposed consolidation mapping (destructive `UPDATE questions SET category = ...` in a single migration, plus rebuild of `category_meta`):

| Final category (emoji)          | Merged from                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 🧠 General Knowledge            | General Knowledge, Funny Facts, Gross facts, Bar Trivia                                                        |
| 🧒 Kids                         | Kids, 80's kids                                                                                                 |
| 💸 Adulting                     | Adulting                                                                                                        |
| 🎬 Movies                       | Movies, Movie Sci-Fi, All things Hollywood, Famous Hollywood Movies, Popular Movies, Comedy Classics, Bad Movies / So Bad It's Good, Twilight Saga |
| 🎵 Music                        | Music, 80's Music, Song Lyrics, Broadway & Musicals, Movies & Music (music half)                                |
| 📺 TV & Pop Culture             | Pop Culture, 2000s Pop Culture, 90s Nostalgia, Celebrity Gossip, Internet & Memes, TV Shows                     |
| 🏟️ Sports                      | Sports, Pittsburgh Sports, MLB & NHL                                                                            |
| 🌍 Geography & Travel           | Geography, Travel & Landmarks                                                                                   |
| 📜 History                      | History, World History                                                                                          |
| 🔬 Science & Nature             | Science, Science & Nature, Animals & Nature                                                                     |
| 💻 Tech & Games                 | Technology, Video Games                                                                                          |
| 🍔 Food & Drink                 | Food & Drink, Fast Food & Junk Food, Booze & Cocktails                                                          |
| 🎨 Arts & Literature            | Art & Culture, Literature                                                                                        |
| 🎉 Lifestyle & Holidays         | Holidays & Traditions, Cars & Transportation, True Crime                                                        |
| 📖 Chapter & Verse              | Chapter & Verse                                                                                                  |
| 😈 Adults Only *(MA gated)*     | Adults Only, adults Only                                                                                        |

Migration steps:
1. `UPDATE questions SET category = <target>` per group above (case-insensitive match on "adults only").
2. Wipe `category_meta` and re-seed with the 16 rows, with `off_by_default = true` only on `Adults Only`.
3. `list_question_categories()` RPC continues to work unchanged (still groups by column).

Note on `Movies & Music`: only 49 rows — I'd spot-check whether each row leans movie or music and split, but that's a manual review. Default is to fold the whole thing into Movies (safer for now); tell me if you want me to spot-split instead.

---

## Confirmations needed before I build

1. **Consolidation mapping** above OK, or want me to change any groupings? (This is destructive — question rows get relabeled permanently.)
2. **Movies & Music (49 rows)**: fold into Movies (default), fold into Music, or leave standalone?
3. **`off_by_default` on the new set**: only Adults Only defaults off? Or also default-off `Chapter & Verse` (religious)?

Say "go" with any tweaks and I'll execute all three changes in one pass.
