// Live personalized Vox callouts with a tiered fallback per game.
//
// Tier 1 (calls 1-15):  full custom sentence with name + flavor, live TTS.
// Tier 2 (calls 16-30): "Name!" (short live TTS, often cached) + baked catchphrase.
// Tier 3 (calls 31+):   baked catchphrase only, no name. Free.
//
// All output is funneled through the shared voice queue in `elf-voice.ts`
// so personalized lines never overlap question reads, DYK, or each other.

import { pickLine, speakPersona } from "@/lib/host-persona";
import { speakAsElf, playVoiceUrl } from "@/lib/elf-voice";
import { speakPersonaLine } from "@/lib/announcer.functions";
import { pickTemplateAdult } from "@/lib/persona-live.adult";

export type LiveMoment =
  | "first_blood"
  | "leader_changed"
  | "streak"
  | "elimination"
  | "comeback"
  | "round_recap"
  | "wooden_spoon"
  | "goose_egg"
  | "welcome"
  | "final_showdown"
  | "winner"
  | "last_to_lock"
  | "random_jab"
  | "bandwagon"
  | "lone_wolf"
  | "buzzer_beater"
  | "sunk_cost";

export interface PersonaContext {
  /** Primary player nickname. */
  nickname: string;
  /** Used for multi-name moments (welcome, final_showdown). */
  extraNames?: string[];
  moment: LiveMoment;
  // Optional flavor data the live tier weaves in:
  streak?: number;
  rank?: number;
  pointsBehind?: number;
  roundNumber?: number;
  ranksClimbed?: number;
}

// --- Tier cap state -------------------------------------------------------

const TIER_FULL_LIVE_MAX = 15;
const TIER_NAME_PREFIX_MAX = 30;

const callCountByRoom = new Map<string, number>();
let activeRoomId: string | null = null;

export function setLiveRoomId(roomId: string | null) {
  activeRoomId = roomId;
}

export function resetLiveCap(roomId: string) {
  callCountByRoom.set(roomId, 0);
}

function currentTier(): 1 | 2 | 3 {
  if (!activeRoomId) return 3;
  const n = callCountByRoom.get(activeRoomId) ?? 0;
  if (n < TIER_FULL_LIVE_MAX) return 1;
  if (n < TIER_NAME_PREFIX_MAX) return 2;
  return 3;
}

function bumpCounter() {
  if (!activeRoomId) return;
  callCountByRoom.set(activeRoomId, (callCountByRoom.get(activeRoomId) ?? 0) + 1);
}

// --- Sentence templates (Tier 1: full custom live) ------------------------

type Template = (ctx: PersonaContext) => string;

const TEMPLATES: Record<LiveMoment, Template[]> = {
  first_blood: [
    (c) => `${c.nickname} — first in, dead on. Showoff.`,
    (c) => `That's ${c.nickname}, locked and loaded.`,
    (c) => `${c.nickname} snipes it. Reflexes of a goblin.`,
    (c) => `Fastest finger goes to ${c.nickname}. Annoying.`,
    (c) => `${c.nickname} didn't even read the answers. Disgusting.`,
    (c) => `Out of the gate first — ${c.nickname}.`,
    (c) => `${c.nickname} called it. The rest of you, catch up.`,
    (c) => `${c.nickname} beat the buzzer and your egos.`,
    (c) => `First blood: ${c.nickname}. Try to keep up.`,
    (c) => `${c.nickname} locked it before you blinked.`,
  ],
  leader_changed: [
    (c) => `${c.nickname} takes the lead. The throne wobbles.`,
    (c) => `New number one — ${c.nickname}. Watch your back.`,
    (c) => `Coup successful. ${c.nickname} runs the board now.`,
    (c) => `${c.nickname} just stole first place. Drama, drama.`,
    (c) => `${c.nickname} climbs to the top. For now.`,
    (c) => `Big move from ${c.nickname}. They're in first.`,
    (c) => `${c.nickname} just dethroned the room.`,
    (c) => `Top spot belongs to ${c.nickname}. Briefly?`,
    (c) => `${c.nickname} grabbed the crown. No bloodshed.`,
    (c) => `Fresh face on top: ${c.nickname}. Welcome.`,
  ],
  streak: [
    (c) => `${c.nickname} is on a ${c.streak ?? 3}-streak. Somebody stop them.`,
    (c) => `${c.streak ?? 3} in a row for ${c.nickname}. Heater alert.`,
    (c) => `${c.nickname} won't miss. ${c.streak ?? 3} straight.`,
    (c) => `Hot hand: ${c.nickname}. ${c.streak ?? 3} consecutive.`,
    (c) => `${c.nickname} is showing off now. ${c.streak ?? 3} in a row.`,
    (c) => `Streak of ${c.streak ?? 3} for ${c.nickname}. Bring the ice bath.`,
    (c) => `${c.nickname} is cooking. ${c.streak ?? 3} clean.`,
    (c) => `${c.streak ?? 3}-streak for ${c.nickname}. Call a doctor.`,
    (c) => `${c.nickname} won't quit. ${c.streak ?? 3} and counting.`,
    (c) => `${c.streak ?? 3} on the trot for ${c.nickname}. Rude.`,
  ],
  elimination: [
    (c) => `${c.nickname}. Out. Cold.`,
    (c) => `Goodbye, ${c.nickname}. We hardly knew you.`,
    (c) => `${c.nickname} just took the L. Painful.`,
    (c) => `That's a wrong from ${c.nickname}. Yikes.`,
    (c) => `${c.nickname} — wrong button, wrong day.`,
    (c) => `Press F for ${c.nickname}.`,
    (c) => `${c.nickname} swung. ${c.nickname} missed.`,
    (c) => `Misfire from ${c.nickname}. Logged.`,
    (c) => `${c.nickname} just got escorted out.`,
    (c) => `Down goes ${c.nickname}. Catalog it.`,
  ],
  comeback: [
    (c) => `${c.nickname} just clawed back. Threat level rising.`,
    (c) => `Wait — ${c.nickname} climbed ${c.ranksClimbed ?? 3} spots. Sneaky.`,
    (c) => `${c.nickname} is back from the dead. Don't blink.`,
    (c) => `Comeback alert: ${c.nickname}. The rest of you, sweat.`,
    (c) => `${c.nickname} just made a move. Big one.`,
    (c) => `${c.nickname} climbed ${c.ranksClimbed ?? 3} ranks. Quietly. Rudely.`,
    (c) => `Don't look now — ${c.nickname} is back in it.`,
    (c) => `${c.nickname} just resurrected on the leaderboard.`,
    (c) => `Sneak attack from ${c.nickname}. Mark them.`,
    (c) => `${c.nickname} climbing fast. Reassess.`,
  ],
  round_recap: [
    (c) => `Round ${c.roundNumber ?? "this"} belonged to ${c.nickname}. The rest of you — adjust.`,
    (c) => `${c.nickname} ran round ${c.roundNumber ?? "that"}. Take notes.`,
    (c) => `MVP of the round: ${c.nickname}. No contest.`,
    (c) => `${c.nickname} dominated that round. Smug allowed.`,
    (c) => `${c.nickname} crushed round ${c.roundNumber ?? "that"}. Onto the next.`,
    (c) => `Round ${c.roundNumber ?? "that"} goes to ${c.nickname}. Loudly.`,
    (c) => `${c.nickname} owned the round. Pay rent.`,
    (c) => `Top of round ${c.roundNumber ?? "that"}: ${c.nickname}. Watch them.`,
    (c) => `${c.nickname} ran away with it. Catch up.`,
    (c) => `Round ${c.roundNumber ?? "that"} MVP — ${c.nickname}. Annoying.`,
  ],
  wooden_spoon: [
    (c) => `Wooden spoon goes to ${c.nickname}. Try harder.`,
    (c) => `${c.nickname}, the floor called. It misses you.`,
    (c) => `Last place: ${c.nickname}. Somebody had to.`,
    (c) => `${c.nickname} found a way. The wrong way.`,
    (c) => `${c.nickname} — that round was a hate crime against trivia.`,
    (c) => `Anchor of the round: ${c.nickname}. We salute you.`,
    (c) => `${c.nickname} polished the floor that round. Slippery work.`,
    (c) => `Dead last, big confidence — that's ${c.nickname}.`,
    (c) => `${c.nickname}, the basement called. You moved in.`,
    (c) => `${c.nickname} took the L with style. Barely.`,
  ],
  goose_egg: [
    (c) => `Big zero for ${c.nickname}. Reflect on that.`,
    (c) => `${c.nickname} brought a knife to a knowledge fight.`,
    (c) => `Goose egg, ${c.nickname}. Lay another one.`,
    (c) => `${c.nickname} scored nothing. Made memories.`,
    (c) => `${c.nickname} — zero points, full commitment.`,
    (c) => `${c.nickname} hung a donut. Cold.`,
    (c) => `Stat line for ${c.nickname}: a perfect circle.`,
    (c) => `${c.nickname} did nothing. Looked great doing it.`,
    (c) => `Empty round from ${c.nickname}. Vibes intact.`,
    (c) => `${c.nickname} contributed pure atmosphere.`,
  ],
  welcome: [
    (c) => `Tonight we've got ${listNames(c)}. May the best brain win.`,
    (c) => `In the house: ${listNames(c)}. And friends. Let's go.`,
    (c) => `${listNames(c)} — welcome to the arena. Try to survive.`,
    (c) => `Looking at ${listNames(c)} tonight. This will be fun.`,
    (c) => `Roll call: ${listNames(c)}. Buzzers up.`,
    (c) => `Spotted: ${listNames(c)}. Game on.`,
    (c) => `${listNames(c)} — welcome in. Shoes off.`,
    (c) => `Tonight's victims: ${listNames(c)}. Et al.`,
    (c) => `${listNames(c)} are in the building. Lock the doors.`,
    (c) => `${listNames(c)} — try to embarrass yourselves quietly.`,
  ],
  final_showdown: [
    (c) => `${listNames(c)} — one question between you and the crown. Don't blow it.`,
    (c) => `It comes down to ${listNames(c)}. Final question. Make it count.`,
    (c) => `Last call for ${listNames(c)}. Bet brave or bet broke.`,
    (c) => `${listNames(c)} — this is the one they'll remember. Send it.`,
    (c) => `${listNames(c)}. Final answer territory. Breathe.`,
    (c) => `It's ${listNames(c)} for the crown. Aim true.`,
    (c) => `${listNames(c)} — end boss energy. Activate.`,
    (c) => `Last frame for ${listNames(c)}. Don't blink.`,
    (c) => `${listNames(c)} — final swing. Make it pretty.`,
    (c) => `${listNames(c)}. One question. Infinite regret.`,
  ],
  winner: [
    (c) => `Your winner: ${c.nickname}. Tonight, the brain reigned supreme.`,
    (c) => `${c.nickname} takes the crown. The rest of you, see you next time.`,
    (c) => `Champion: ${c.nickname}. Soak it in.`,
    (c) => `${c.nickname} wins. Frame it. Print it. Whatever.`,
    (c) => `It's ${c.nickname}. Champion of the chaos.`,
    (c) => `${c.nickname} on top. Mark the day.`,
    (c) => `Winner, winner — ${c.nickname}.`,
    (c) => `${c.nickname} just rewrote the night.`,
    (c) => `The crown belongs to ${c.nickname}. Earned.`,
    (c) => `${c.nickname} — undefeated for the evening.`,
  ],
  last_to_lock: [
    (c) => `${c.nickname} squeaked it in at the buzzer.`,
    (c) => `Cutting it close, ${c.nickname}.`,
    (c) => `${c.nickname} — last in. Living dangerously.`,
    (c) => `${c.nickname} locked with milliseconds to spare.`,
    (c) => `Buzzer-beater from ${c.nickname}. Heart attack scheduled.`,
    (c) => `${c.nickname} waited until the last second. Theatrical.`,
    (c) => `Final answer, final second — ${c.nickname}.`,
    (c) => `${c.nickname} made us wait. Rude.`,
    (c) => `${c.nickname} just barely made the cut.`,
    (c) => `${c.nickname} — locked in like they meant to wait that long.`,
  ],
  random_jab: [
    (c) => `${c.nickname} — we see you back there.`,
    (c) => `Don't forget ${c.nickname} exists.`,
    (c) => `${c.nickname} is plotting something. Probably.`,
    (c) => `Quiet from ${c.nickname}. Suspicious.`,
    (c) => `${c.nickname}, vibes are immaculate. Score, less so.`,
    (c) => `Spotted: ${c.nickname}. Still in this. Technically.`,
    (c) => `${c.nickname} is here. That counts for something.`,
    (c) => `Big silent energy from ${c.nickname}.`,
    (c) => `${c.nickname}, showing up is half the battle. The other half is points.`,
    (c) => `${c.nickname} lurking. Calculating. Mid.`,
  ],
};

function listNames(c: PersonaContext): string {
  const all = [c.nickname, ...(c.extraNames ?? [])].filter(Boolean);
  if (all.length === 0) return "you legends";
  if (all.length === 1) return all[0];
  if (all.length === 2) return `${all[0]} and ${all[1]}`;
  return `${all.slice(0, -1).join(", ")}, and ${all[all.length - 1]}`;
}

// Map our live moments to a baked-fallback moment from host-persona.ts
const FALLBACK_MOMENT: Record<LiveMoment, Parameters<typeof pickLine>[0]> = {
  first_blood: "first_blood",
  leader_changed: "leader_changed",
  streak: "streak_milestone",
  elimination: "elimination",
  comeback: "comeback",
  round_recap: "round_recap",
  wooden_spoon: "wooden_spoon",
  goose_egg: "goose_egg",
  welcome: "intro_hype",
  final_showdown: "final_hype",
  winner: "credits_open",
  last_to_lock: "last_to_lock",
  random_jab: "random_jab",
};

function pickTemplate(ctx: PersonaContext): string {
  if (typeof window !== "undefined") {
    try {
      if (window.sessionStorage.getItem("btd-adult-mode") === "1") {
        return pickTemplateAdult(ctx);
      }
    } catch { /* fall back */ }
  }
  const pool = TEMPLATES[ctx.moment];
  const seed = (ctx.nickname.length * 31 + (ctx.roundNumber ?? 0) * 7 + (ctx.streak ?? 0)) >>> 0;
  return pool[seed % pool.length](ctx);
}

// --- Main entrypoint ------------------------------------------------------

/**
 * Speak about a player. Picks the appropriate tier based on the per-game
 * counter and plays through the shared voice queue.
 */
export async function speakAboutPlayer(ctx: PersonaContext): Promise<void> {
  if (typeof window === "undefined") return;
  const tier = currentTier();
  bumpCounter();

  try {
    if (tier === 1) {
      // Full live custom sentence
      const text = pickTemplate(ctx);
      const res = await speakPersonaLine({
        data: {
          text,
          preset: "hype",
          roomId: activeRoomId ?? undefined,
        },
      });
      if (res && "skipped" in res && res.skipped) {
        // Server-side cap hit — fall back to tier 3
        await speakPersona(pickLine(FALLBACK_MOMENT[ctx.moment], ctx.nickname));
        return;
      }
      if (res && "audioUrl" in res && res.audioUrl) {
        await playVoiceUrl(res.audioUrl, { volume: 1.0 });
        return;
      }
      if (res && "audioBase64" in res && res.audioBase64) {
        // Rare fallback path — play as data URI through the queue
        await playVoiceUrl(`data:audio/mpeg;base64,${res.audioBase64}`, { volume: 1.0 });
        return;
      }
      // No audio came back — degrade gracefully
      await speakPersona(pickLine(FALLBACK_MOMENT[ctx.moment], ctx.nickname));
      return;
    }

    if (tier === 2) {
      // Name prefix + baked catchphrase. The name TTS will hit the per-text
      // server cache, so repeats of the same nickname are free after the
      // first call.
      const namePrefix = `${ctx.nickname}!`;
      const baked = pickLine(FALLBACK_MOMENT[ctx.moment], ctx.nickname);
      // Speak as two queued lines so they play back-to-back without overlap.
      await speakAsElf(namePrefix, { preset: "hype" });
      await speakAsElf(baked, { preset: "hype" });
      return;
    }

    // Tier 3: 100% baked, no name
    await speakPersona(pickLine(FALLBACK_MOMENT[ctx.moment], ctx.nickname));
  } catch {
    // Never crash the game on a voice line failure
    try {
      await speakPersona(pickLine(FALLBACK_MOMENT[ctx.moment], ctx.nickname));
    } catch {
      /* swallow */
    }
  }
}
