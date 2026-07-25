You have the biggest unused ElevenLabs opportunity sitting in the 6k questions/explanations, plus a few smaller audio packs that will burn credits and improve the show.

## Ranked opportunities

### 1. Narrate every question + explanation (highest ROI, biggest credit burn)
- Your `/admin/sounds` page already has panels for **Question voiceovers** and **Explanation voiceovers**.
- Each question is ~50-120 chars; 6,000 questions = ~300k-500k characters of TTS.
- Explanations add another ~200-300k characters.
- This instantly turns the show into a real game-show experience: the host voice reads the question while the timer runs, then reads the "Did you know?" after the reveal.
- The baker is already resumable and cached, so one long click will finish it.

### 2. Generate a full music pack (not just lobby)
- Currently only the lobby music loop is generated via ElevenLabs Music.
- Could add: round tension loop, final countdown loop, victory fanfare, game-over sting, wrong-answer bass drop, correct-answer chime.
- Each 30s loop burns music credits and fills the sound event slots.

### 3. Add a second announcer persona (adult/party mode)
- The codebase already has `host-persona.adult.ts` and adult-mode hooks.
- Could clone the full ~1,700 line persona into a second "Adult Donnie" voice and generate it with a different ElevenLabs voice ID, then switch personas when adult mode is on.
- Doubles the baked pool and gives a real reason to use adult mode.

### 4. Player-name roasts + category intros
- Live TTS templates already exist for winner/welcome/first-blood.
- Could expand to: category intros ("Movies: where trivia meets regret"), personalized name-based roasts for the final 3, and audience call-and-response chants.
- These are dynamic, so the server caches them after first use, but seeding the cache by running a batch bake would burn credits upfront.

### 5. Sound effects via ElevenLabs (smaller, optional)
- Generate custom drop sounds, buzzer variants, or audience reaction stings using TTS/effects prompts, and upload them into the soundboard folders.

## Recommended plan

If you want the most production value and credit burn with the least new code, do **#1 + #2**: bake all 6k question and explanation voiceovers, then generate 4-5 additional music loops. The UI and backend already support both; it's mostly a "click bake and wait" operation.

If you want to burn even more and add a real feature, add **#3** (a second adult persona) on top.

## Technical details
- Question/explanation bakers: `src/routes/_authenticated/admin-sounds.tsx` calls `bakeAllQuestionTTS` / `bakeAllExplanationTTS` in `src/lib/announcer.functions.ts`.
- Music generator: `generateMusic()` in `src/lib/announcer.functions.ts` uses the ElevenLabs Music API.
- Voice/persona pool: `LINES` in `src/lib/host-persona.ts` + `EXTRA_LINES` in `src/lib/host-persona.extra.ts`.
- Second persona: create a new voice preset, duplicate the line pools, and add a new server function similar to `generatePersonaPack`.

## Decision needed
Which of these do you want to do first? Pick one or more and I'll implement it.

- A) Narrate all 6k questions + explanations (biggest burn, best ROI)
- B) Generate a full music pack (round/final/victory/game-over loops)
- C) Build a second adult-mode announcer persona (full 1,700 lines)
- D) Add category intros + name-based roasts
- E) All of the above
- F) Something else