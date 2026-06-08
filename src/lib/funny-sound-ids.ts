// Single source of truth for the funny-sound bank id list.
// Imported by both the client bank (src/lib/funny-sounds.ts) and the join
// server function, so per-room shuffle assignment never drifts from the
// playable clips.

export const FUNNY_SOUND_IDS = [
  "fart",
  "scream",
  "sadhorn",
  "boing",
  "slipwhistle",
  "goofyyell",
  "cuckoo",
  "buzzer",
  "kazoo",
  "baby",
  "duckquack",
  "goatscream",
  "recordscratch",
  "partyhorn",
  "evillaugh",
  "donkeybray",
  "sneeze",
  "burp",
  "catmeow",
  "dogbark",
  "sheepbaa",
  "wahwah",
  "nooo",
  "snore",
  "vineboom",
] as const;

export type FunnySoundId = (typeof FUNNY_SOUND_IDS)[number];
