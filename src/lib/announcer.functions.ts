import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Brian — deep, energetic hype-man (Jackbox-style host)
const VOICE_ID = "e79twtVS2278lVZZQiAD";
const FOLDER = "Announcer";

type ScriptLine = {
  slot: string;
  label: string;
  text: string;
  /** If set, auto-assign to this game event after upload. */
  assignTo?: "lobby_music" | "round_intro" | "reveal" | "final" | "victory";
  volume?: number;
  loop?: boolean;
  audienceVisible?: boolean;
};

export const WELCOME_LINES: string[] = [
  "Welcoooome to BEAT! THE! DROP! Trivia, buzzers, and bad decisions — that's the whole show. Survive the rounds, and you'll hit the Final Drop, where NOBODY is safe and ANYONE can wager it all to steal the W. Let's ruin some friendships!",
  "Ohhh strap in, gamers — it's BEAT THE DROP! Answer fast, score big, talk trash. And don't get cocky, because in the Final Drop, even last place can bet the farm and walk out a CHAMPION. Painful, isn't it?",
  "Ladies, gentlemen, and chaos goblins — welcome to BEAT THE DROP, the trivia bloodsport where speed pays and silence costs. Stick around for the Final Drop: no eliminations, all-in wagers, ONE winner. Try not to cry on camera!",
  "Welcome to BEAT THE DROP! Here's the deal: questions drop, you buzz in, points pile up. Easy, right? WRONG — because the Final Drop lets ANYONE bet it ALL and yoink the trophy. Leaders beware. Underdogs… get weird.",
  "It's the show your therapist warned you about — BEAT! THE! DROOOOP! Trivia rounds, leaderboard drama, and a Final Drop where no one's eliminated and everyone can risk EVERYTHING. The smartest player rarely wins. The boldest one does.",
  "Welcome contestants — or as I call you, FUTURE LOSERS! Beat the Drop is simple: outscore your friends round after round. Then comes the Final Drop, where every player wagers as much as they DARE. Big brain, big guts, big trophy. Let's go!",
  "Buckle up buttercups, it's BEAT THE DROP! You'll get trivia, you'll get taunts, you'll get a leaderboard that JUDGES you. And in the Final Drop? No safety net — bet small, play safe; bet it all, become a LEGEND. Choose wisely.",
  "Welcome to BEAT THE DROP! Tonight, one of you becomes a legend — the rest become CONTENT. Race through the rounds, then face the Final Drop: nobody's out, anyone can wager it all, and the standings can flip in ONE question. Spicy!",
  "Heyyyy players! Beat the Drop is the trivia showdown where speed equals points and hesitation equals pain. Hang on till the Final Drop — that's where the meek inherit NOTHING, because the brave bet it all and steal the crown. Buzzers up!",
  "Welcome to BEAT THE DROP, where trivia goes to DIE! Three things to know: answer fast, climb the board, and pray you survive to the Final Drop — the round where nobody's eliminated and ANYONE can wager their whole score. May the boldest goblin win!",
];

const VO_LINES: ScriptLine[] = [
  ...WELCOME_LINES.map((text, i) => ({
    slot: `vo_welcome_${i + 1}`,
    label: `Welcome ${i + 1}`,
    text,
    audienceVisible: true,
  })),
  {
    slot: "vo_round_intro",
    label: "Round intro",
    text: "New round. Fingers on buzzers.",
    assignTo: "round_intro",
    volume: 0.85,
  },
  {
    slot: "vo_lock_in",
    label: "Lock it in!",
    text: "Lock it in!",
    audienceVisible: true,
  },
  {
    slot: "vo_time_up",
    label: "Time's up",
    text: "Time's up!",
    assignTo: "reveal",
    volume: 0.85,
  },
  {
    slot: "vo_final",
    label: "Final drop",
    text: "This... is the FINAL DROP. Wager it all.",
    assignTo: "final",
    volume: 0.9,
  },
  {
    slot: "vo_game_over",
    label: "Game over",
    text: "And that's the drop! Let's see who survived.",
    assignTo: "victory",
    volume: 0.9,
  },
  {
    slot: "vo_taunt_1",
    label: "Taunt: leave a mark",
    text: "Oof. That's gonna leave a mark.",
    audienceVisible: true,
  },
  {
    slot: "vo_taunt_2",
    label: "Taunt: call a doctor",
    text: "Somebody call a doctor, that one was painful.",
    audienceVisible: true,
  },
  {
    slot: "vo_taunt_3",
    label: "Taunt: not your thing",
    text: "Yikes. Maybe trivia isn't your thing.",
    audienceVisible: true,
  },
  {
    slot: "vo_on_fire",
    label: "On fire",
    text: "On fire!",
    audienceVisible: true,
  },
  {
    slot: "vo_new_challenger",
    label: "New challenger",
    text: "A new challenger appears!",
    audienceVisible: true,
  },
  {
    slot: "vo_streak_3",
    label: "Three in a row",
    text: "Three in a row!",
    audienceVisible: true,
  },
  {
    slot: "vo_unstoppable",
    label: "Unstoppable",
    text: "Unstoppable!",
    audienceVisible: true,
  },
  {
    slot: "vo_neck_and_neck",
    label: "Neck and neck",
    text: "It's neck and neck!",
    audienceVisible: true,
  },
  {
    slot: "vo_blowout",
    label: "Blowout",
    text: "It's not even close.",
    audienceVisible: true,
  },
];

const LOBBY_MUSIC: {
  slot: string;
  label: string;
  prompt: string;
  assignTo: "lobby_music";
  volume: number;
  loop: boolean;
} = {
  slot: "lobby_loop",
  label: "Lobby music loop",
  prompt:
    "Loud, high-energy TV game show theme, big brass stabs, funky bass, hand claps, retro synth hits, crowd hype, anticipation building, 120 BPM, loopable, instrumental, no vocals, prime-time television production",
  assignTo: "lobby_music",
  volume: 0.7,
  loop: true,
};

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

async function generateTTS(
  text: string,
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
    speed?: number;
  },
): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: voiceSettings?.stability ?? 0.2,
          similarity_boost: voiceSettings?.similarity_boost ?? 0.75,
          style: voiceSettings?.style ?? 0.9,
          use_speaker_boost: voiceSettings?.use_speaker_boost ?? true,
          speed: voiceSettings?.speed ?? 1.0,
        },
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${err.slice(0, 200)}`);
  }
  return res.arrayBuffer();
}

async function generateMusic(prompt: string, durationMs = 30000): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");
  const res = await fetch(`https://api.elevenlabs.io/v1/music`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      music_length_ms: durationMs,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs Music failed (${res.status}): ${err.slice(0, 200)}`);
  }
  return res.arrayBuffer();
}

async function ensureFolder() {
  const { data } = await supabaseAdmin
    .from("sound_folders")
    .select("id")
    .eq("name", FOLDER)
    .maybeSingle();
  if (!data) {
    await supabaseAdmin
      .from("sound_folders")
      .insert({ name: FOLDER, sort_order: 0 });
  }
}

async function upsertClip(args: {
  slot: string;
  label: string;
  audio: ArrayBuffer;
  volume: number;
  loop: boolean;
  audienceVisible: boolean;
  assignTo?: "lobby_music" | "round_intro" | "reveal" | "final" | "victory";
}) {
  const path = `announcer/${args.slot}.mp3`;
  const bytes = new Uint8Array(args.audio);

  // Upload (upsert)
  const { error: upErr } = await supabaseAdmin.storage
    .from("question-media")
    .upload(path, bytes, {
      contentType: "audio/mpeg",
      upsert: true,
    });
  if (upErr) throw new Error(`Upload failed for ${args.slot}: ${upErr.message}`);

  // Delete existing clip with same storage_path, then insert fresh
  await supabaseAdmin.from("sound_clips").delete().eq("storage_path", path);
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("sound_clips")
    .insert({
      slot: FOLDER,
      category: FOLDER,
      label: args.label,
      storage_path: path,
      original_filename: `${args.slot}.mp3`,
      is_active: true,
      audience_visible: args.audienceVisible,
      volume: args.volume,
      loop: args.loop,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(`Insert failed for ${args.slot}: ${insErr.message}`);

  if (args.assignTo && inserted) {
    // Upsert assignment row
    const { data: existing } = await supabaseAdmin
      .from("sound_event_assignments")
      .select("event")
      .eq("event", args.assignTo)
      .maybeSingle();
    const patch = {
      clip_id: inserted.id,
      volume: args.volume,
      loop: args.loop,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await supabaseAdmin
        .from("sound_event_assignments")
        .update(patch)
        .eq("event", args.assignTo);
    } else {
      await supabaseAdmin
        .from("sound_event_assignments")
        .insert({ event: args.assignTo, ...patch });
    }
  }
}

export const generateAnnouncerPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    await ensureFolder();

    const generated: string[] = [];
    const errors: string[] = [];

    // Voice lines
    for (const line of VO_LINES) {
      try {
        const audio = await generateTTS(line.text);
        await upsertClip({
          slot: line.slot,
          label: line.label,
          audio,
          volume: line.volume ?? 0.85,
          loop: line.loop ?? false,
          audienceVisible: line.audienceVisible ?? false,
          assignTo: line.assignTo,
        });
        generated.push(line.slot);
      } catch (e) {
        errors.push(`${line.slot}: ${(e as Error).message}`);
      }
    }

    // Lobby music
    try {
      const audio = await generateMusic(LOBBY_MUSIC.prompt, 45000);
      await upsertClip({
        slot: LOBBY_MUSIC.slot,
        label: LOBBY_MUSIC.label,
        audio,
        volume: LOBBY_MUSIC.volume,
        loop: LOBBY_MUSIC.loop,
        audienceVisible: false,
        assignTo: LOBBY_MUSIC.assignTo,
      });
      generated.push(LOBBY_MUSIC.slot);
    } catch (e) {
      errors.push(`${LOBBY_MUSIC.slot}: ${(e as Error).message}`);
    }

    return {
      generated,
      errors,
      total: VO_LINES.length + 1,
    };
  });

export const previewAnnouncerLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ text: z.string().min(1).max(500) }).parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const audio = await generateTTS(data.text);
    const audioBase64 = Buffer.from(audio).toString("base64");
    return { audioBase64 };
  });


// ──────────────────────────────────────────────────────────────────────────
// Question voiceovers — pre-bake The Elf reading each question's prompt
// ──────────────────────────────────────────────────────────────────────────

const QUESTION_TTS_PREFIX = "question-tts";
// Calmer, more intelligible settings for question reads (vs. unhinged welcome lines)
const QUESTION_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.4,
  use_speaker_boost: true,
  speed: 1.0,
};

function hashText(text: string): string {
  // Tiny non-cryptographic hash; we only need change-detection.
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

async function bakeOneQuestion(
  q: { id: string; question_text: string; tts_text_hash?: string | null; tts_path?: string | null },
  force = false,
): Promise<"baked" | "skipped"> {
  const hash = hashText(q.question_text);
  if (!force && q.tts_path && q.tts_text_hash === hash) return "skipped";

  const audio = await generateTTS(q.question_text, QUESTION_VOICE_SETTINGS);
  const path = `${QUESTION_TTS_PREFIX}/${q.id}.mp3`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("question-media")
    .upload(path, new Uint8Array(audio), {
      contentType: "audio/mpeg",
      upsert: true,
    });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  const { error: dbErr } = await supabaseAdmin
    .from("questions")
    .update({ tts_path: path, tts_text_hash: hash })
    .eq("id", q.id);
  if (dbErr) throw new Error(`DB update failed: ${dbErr.message}`);
  return "baked";
}

export const bakeQuestionTTS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ questionId: z.string().uuid(), force: z.boolean().optional() }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: q, error } = await supabaseAdmin
      .from("questions")
      .select("id, question_text, tts_path, tts_text_hash")
      .eq("id", data.questionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!q) throw new Error("Question not found");
    const result = await bakeOneQuestion(q, data.force ?? false);
    return { result };
  });

export const bakeAllQuestionTTS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ force: z.boolean().optional(), limit: z.number().int().min(1).max(500).optional() }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let query = supabaseAdmin
      .from("questions")
      .select("id, question_text, tts_path, tts_text_hash");
    if (!data.force) query = query.is("tts_path", null);
    const { data: rows, error } = await query.limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    const list = rows ?? [];

    let baked = 0;
    let skipped = 0;
    const errors: { id: string; message: string }[] = [];
    for (const q of list) {
      try {
        const r = await bakeOneQuestion(q, data.force ?? false);
        if (r === "baked") baked += 1;
        else skipped += 1;
      } catch (e) {
        errors.push({ id: q.id, message: (e as Error).message });
      }
      // Small delay so we don't hammer the ElevenLabs rate limiter
      await new Promise((r) => setTimeout(r, 250));
    }
    return { baked, skipped, errors, total: list.length };
  });

export const getQuestionTTSStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { count: total } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true });
    const { count: baked } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .not("tts_path", "is", null);
    return { total: total ?? 0, baked: baked ?? 0 };
  });
