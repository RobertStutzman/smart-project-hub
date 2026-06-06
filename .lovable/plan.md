# Longer, game-explaining welcome intros

## Goal
Rewrite the 10 Elf welcome lines so each one actually introduces **Beat the Drop** — explains the format in a sentence, hypes the **Final Drop** (the round where no one is eliminated because anyone can wager it all and steal the win), and keeps the unhinged Elf energy.

## What changes
Only one file: `src/lib/announcer.functions.ts` — replace the `WELCOME_LINES` array with 10 longer scripts (~3-5 sentences each, ~25-45 words). Everything else (preview UI, generator, playback on host load) already works and stays as-is.

## Draft of the new lines
Each line follows roughly: **Welcome hook → what the game is → Final Drop tease → sign-off jab.**

1. "Welcoooome to BEAT! THE! DROP! Trivia, buzzers, and bad decisions — that's the whole show. Survive the rounds, and you'll hit the Final Drop, where NOBODY is safe and ANYONE can wager it all to steal the W. Let's ruin some friendships!"

2. "Ohhh strap in, gamers — it's BEAT THE DROP! Answer fast, score big, talk trash. And don't get cocky, because in the Final Drop, even last place can bet the farm and walk out a CHAMPION. Painful, isn't it?"

3. "Ladies, gentlemen, and chaos goblins — welcome to BEAT THE DROP, the trivia bloodsport where speed pays and silence costs. Stick around for the Final Drop: no eliminations, all-in wagers, ONE winner. Try not to cry on camera!"

4. "Welcome to BEAT THE DROP! Here's the deal: questions drop, you buzz in, points pile up. Easy, right? WRONG — because the Final Drop lets ANYONE bet it ALL and yoink the trophy. Leaders beware. Underdogs… get weird."

5. "It's the show your therapist warned you about — BEAT! THE! DROOOOP! Trivia rounds, leaderboard drama, and a Final Drop where no one's eliminated and everyone can risk EVERYTHING. The smartest player rarely wins. The boldest one does."

6. "Welcome contestants — or as I call you, FUTURE LOSERS! Beat the Drop is simple: outscore your friends round after round. Then comes the Final Drop, where every player wagers as much as they DARE. Big brain, big balls, big trophy. Let's go!"

7. "Buckle up buttercups, it's BEAT THE DROP! You'll get trivia, you'll get taunts, you'll get a leaderboard that JUDGES you. And in the Final Drop? No safety net — bet small, play safe; bet it all, become a LEGEND. Choose wisely."

8. "Welcome to BEAT THE DROP! Tonight, one of you becomes a legend — the rest become CONTENT. Race through the rounds, then face the Final Drop: nobody's out, anyone can wager it all, and the standings can flip in ONE question. Spicy!"

9. "Heyyyy players! Beat the Drop is the trivia showdown where speed = points and hesitation = pain. Hang on till the Final Drop — that's where the meek inherit NOTHING, because the brave bet it all and steal the crown. Buzzers up!"

10. "Welcome to BEAT THE DROP, where trivia goes to DIE! Three things to know: answer fast, climb the board, and pray you survive to the Final Drop — the round where nobody's eliminated and ANYONE can wager their whole score. May the boldest goblin win!"

## Out of scope
- Preview UI, generator, and host-side playback are unchanged.
- No DB/storage migration needed — the slots (`vo_welcome_1`..`vo_welcome_10`) stay the same; re-running **Generate AI announcer pack** in Admin → Soundboard re-bakes the new MP3s into the existing slots.

## After shipping
1. Open Admin → Soundboard → **Welcome intros** to preview any line with The Elf.
2. Tweak inline if a specific one flops.
3. Click **Generate AI announcer pack** to bake the new versions into storage.
