import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LINES as PERSONA_LINES } from "@/lib/host-persona";
import { LINES_ADULT as PERSONA_LINES_ADULT, ADULT_FLIRT_NAMES } from "@/lib/host-persona.adult";

// The Elf — deep, energetic hype-man (Jackbox-style host)
const VOICE_ID = "e79twtVS2278lVZZQiAD";
// Bill — gravelly older-man voice for the adult/party mode announcer
const ADULT_VOICE_ID = "pqHfZKP75CvOlQylNhV4";
const FOLDER = "Announcer";
const PERSONA_FOLDER = "Persona";
const PERSONA_CATEGORY = "Persona";
const PERSONA_FOLDER_ADULT = "Persona Adult";
const PERSONA_CATEGORY_ADULT = "Persona Adult";

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

const MUSIC_FOLDER = "Music";

const MUSIC_PACK: {
  slot: string;
  label: string;
  event: "lobby_music" | "round_intro" | "correct" | "wrong" | "reveal" | "leaderboard" | "final" | "victory";
  prompt: string;
  durationMs: number;
  volume: number;
  loop: boolean;
}[] = [
  {
    slot: "lobby_music_loop",
    label: "Lobby music loop",
    event: "lobby_music",
    prompt:
      "Loud, high-energy TV game show theme, big brass stabs, funky bass, hand claps, retro synth hits, crowd hype, anticipation building, 120 BPM, loopable, instrumental, no vocals, prime-time television production",
    durationMs: 45000,
    volume: 0.7,
    loop: true,
  },
  {
    slot: "round_intro_sting",
    label: "Round intro sting",
    event: "round_intro",
    prompt:
      "Dramatic game show round intro sting, orchestral brass swell, building tension, clock ticking, bright cymbal crash, instrumental, no vocals, 6 seconds",
    durationMs: 6000,
    volume: 0.85,
    loop: false,
  },
  {
    slot: "correct_answer_sting",
    label: "Correct answer sting",
    event: "correct",
    prompt:
      "Bright, celebratory game show correct answer sting, major key brass fanfare, sparkling synth, triumphant, short, instrumental, no vocals, 4 seconds",
    durationMs: 4000,
    volume: 0.85,
    loop: false,
  },
  {
    slot: "wrong_answer_sting",
    label: "Wrong answer sting",
    event: "wrong",
    prompt:
      "Dramatic game show wrong answer sting, low brass descending, tense strings, sudden stop, comedic disappointment, instrumental, no vocals, 4 seconds",
    durationMs: 4000,
    volume: 0.85,
    loop: false,
  },
  {
    slot: "reveal_sting",
    label: "Answer reveal sting",
    event: "reveal",
    prompt:
      "Suspenseful answer reveal sting, tight drum roll, orchestral hit, bright resolution, instrumental, no vocals, 5 seconds",
    durationMs: 5000,
    volume: 0.85,
    loop: false,
  },
  {
    slot: "leaderboard_sting",
    label: "Leaderboard sting",
    event: "leaderboard",
    prompt:
      "Upbeat game show leaderboard reveal sting, funky bass, confident brass, crowd cheers, instrumental, no vocals, 6 seconds",
    durationMs: 6000,
    volume: 0.85,
    loop: false,
  },
  {
    slot: "final_round_sting",
    label: "Final round intro",
    event: "final",
    prompt:
      "Epic game show final round intro, dark cinematic orchestra, rising tension, big impact, high stakes, instrumental, no vocals, 10 seconds",
    durationMs: 10000,
    volume: 0.9,
    loop: false,
  },
  {
    slot: "victory_fanfare",
    label: "Victory fanfare",
    event: "victory",
    prompt:
      "Triumphant game show victory fanfare, soaring brass, confetti, cheering crowd, loopable celebration, instrumental, no vocals, 20 seconds",
    durationMs: 20000,
    volume: 0.9,
    loop: true,
  },
];

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
  voiceId: string = VOICE_ID,
): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not configured");
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
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

async function ensureMusicFolder() {
  const { data } = await supabaseAdmin
    .from("sound_folders")
    .select("id")
    .eq("name", MUSIC_FOLDER)
    .maybeSingle();
  if (!data) {
    await supabaseAdmin
      .from("sound_folders")
      .insert({ name: MUSIC_FOLDER, sort_order: 2 });
  }
}

async function upsertMusicClip(args: {
  slot: string;
  label: string;
  audio: ArrayBuffer;
  volume: number;
  loop: boolean;
  event: "lobby_music" | "round_intro" | "correct" | "wrong" | "reveal" | "leaderboard" | "final" | "victory";
}) {
  const path = `music/${args.slot}.mp3`;
  const bytes = new Uint8Array(args.audio);

  const { error: upErr } = await supabaseAdmin.storage
    .from("question-media")
    .upload(path, bytes, {
      contentType: "audio/mpeg",
      upsert: true,
    });
  if (upErr) throw new Error(`Upload failed for ${args.slot}: ${upErr.message}`);

  await supabaseAdmin.from("sound_clips").delete().eq("storage_path", path);
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("sound_clips")
    .insert({
      slot: MUSIC_FOLDER,
      category: MUSIC_FOLDER,
      label: args.label,
      storage_path: path,
      original_filename: `${args.slot}.mp3`,
      is_active: true,
      audience_visible: false,
      volume: args.volume,
      loop: args.loop,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(`Insert failed for ${args.slot}: ${insErr.message}`);

  if (inserted) {
    const patch = {
      clip_id: inserted.id,
      volume: args.volume,
      loop: args.loop,
      updated_at: new Date().toISOString(),
    };
    await supabaseAdmin
      .from("sound_event_assignments")
      .upsert({ event: args.event, ...patch }, { onConflict: "event" });
  }
}

export const generateMusicPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    await ensureMusicFolder();

    const generated: string[] = [];
    const errors: string[] = [];

    for (const track of MUSIC_PACK) {
      try {
        const audio = await generateMusic(track.prompt, track.durationMs);
        await upsertMusicClip({
          slot: track.slot,
          label: track.label,
          audio,
          volume: track.volume,
          loop: track.loop,
          event: track.event,
        });
        generated.push(track.slot);
      } catch (e) {
        errors.push(`${track.slot}: ${(e as Error).message}`);
      }
    }

    return {
      generated,
      errors,
      total: MUSIC_PACK.length,
    };
  });

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

// Persona voice — live Vox catchphrases, intro/credits narration, dynamic roasts.
// No admin gate; any authenticated host can call during a game.
const PERSONA_PRESETS = {
  hype: { stability: 0.15, similarity_boost: 0.8, style: 1.0, use_speaker_boost: true, speed: 1.05 },
  calm: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true, speed: 1.0 },
} as const;

import { createHash } from "crypto";

const TTS_CACHE_BUCKET = "question-media";
const TTS_CACHE_PREFIX = "tts-cache";
const TTS_DEFAULT_CAP = 50;

function getTtsCap(): number {
  const raw = process.env.TTS_CAP_PER_GAME;
  if (!raw) return TTS_DEFAULT_CAP;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : TTS_DEFAULT_CAP;
}

function hashTtsKey(preset: string, text: string, voice: "standard" | "adult" = "standard"): string {
  // Keep the standard-voice hash byte-identical so existing cache entries still resolve.
  const seed = voice === "adult" ? `adult::${preset}::${text}` : `${preset}::${text}`;
  return createHash("sha256").update(seed).digest("hex");
}

async function logTtsCall(row: {
  room_id?: string | null;
  preset: string;
  text_hash: string;
  char_count: number;
  outcome: "cache_hit" | "generated" | "cap_skipped" | "error";
}) {
  try {
    await supabaseAdmin.from("tts_call_log").insert({
      room_id: row.room_id ?? null,
      preset: row.preset,
      text_hash: row.text_hash,
      char_count: row.char_count,
      outcome: row.outcome,
    });
  } catch {
    /* best-effort logging — never break a voice line */
  }
}

export const speakPersonaLine = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      text: z.string().min(1).max(600),
      preset: z.enum(["hype", "calm"]).optional(),
      voice: z.enum(["standard", "adult"]).optional(),
      roomId: z.string().uuid().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const preset = data.preset ?? "hype";
    const voice = data.voice ?? "standard";
    const text = data.text;
    const hash = hashTtsKey(preset, text, voice);
    const charCount = text.length;
    const roomId = data.roomId ?? null;

    // 1. Cache hit?
    const { data: cached } = await supabaseAdmin
      .from("tts_cache")
      .select("storage_path, hit_count")
      .eq("text_hash", hash)
      .maybeSingle();

    if (cached) {
      // Bump usage stats (fire-and-forget)
      void supabaseAdmin
        .from("tts_cache")
        .update({
          hit_count: (cached.hit_count ?? 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("text_hash", hash);

      const { data: signed } = await supabaseAdmin.storage
        .from(TTS_CACHE_BUCKET)
        .createSignedUrl(cached.storage_path, 60 * 60 * 24 * 7);
      if (signed?.signedUrl) {
        void logTtsCall({ room_id: roomId, preset, text_hash: hash, char_count: charCount, outcome: "cache_hit" });
        return { audioUrl: signed.signedUrl, cached: true };
      }
    }

    // 2. Cache miss — check per-game cap before generating
    if (data.roomId) {
      const { data: room } = await supabaseAdmin
        .from("rooms")
        .select("tts_calls_count")
        .eq("id", data.roomId)
        .maybeSingle();
      const cap = getTtsCap();
      const count = room?.tts_calls_count ?? 0;
      if (count >= cap) {
        void logTtsCall({ room_id: roomId, preset, text_hash: hash, char_count: charCount, outcome: "cap_skipped" });
        return { skipped: true as const, reason: "cap" as const, count, cap };
      }
      // Reserve a slot up front so concurrent calls don't all squeak through
      await supabaseAdmin
        .from("rooms")
        .update({ tts_calls_count: count + 1 })
        .eq("id", data.roomId);
    }

    // 3. Generate via ElevenLabs
    let audio: ArrayBuffer;
    try {
      const settings = PERSONA_PRESETS[preset];
      audio = await generateTTS(text, settings, voice === "adult" ? ADULT_VOICE_ID : VOICE_ID);
    } catch (err) {
      void logTtsCall({ room_id: roomId, preset, text_hash: hash, char_count: charCount, outcome: "error" });
      throw err;
    }

    // 4. Upload to storage
    const path = `${TTS_CACHE_PREFIX}/${hash}.mp3`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(TTS_CACHE_BUCKET)
      .upload(path, new Uint8Array(audio), {
        contentType: "audio/mpeg",
        upsert: true,
      });
    if (upErr) {
      // Fall back to base64 if storage upload fails
      void logTtsCall({ room_id: roomId, preset, text_hash: hash, char_count: charCount, outcome: "generated" });
      return { audioBase64: Buffer.from(audio).toString("base64") };
    }

    // 5. Record in cache table (idempotent)
    await supabaseAdmin
      .from("tts_cache")
      .upsert(
        {
          text_hash: hash,
          preset,
          text,
          storage_path: path,
          last_used_at: new Date().toISOString(),
          hit_count: 0,
        },
        { onConflict: "text_hash" },
      );

    const { data: signed } = await supabaseAdmin.storage
      .from(TTS_CACHE_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    void logTtsCall({ room_id: roomId, preset, text_hash: hash, char_count: charCount, outcome: "generated" });
    if (signed?.signedUrl) {
      return { audioUrl: signed.signedUrl, cached: false };
    }
    return { audioBase64: Buffer.from(audio).toString("base64") };
  });


export const getTTSCacheStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { count: total } = await supabaseAdmin
      .from("tts_cache")
      .select("text_hash", { count: "exact", head: true });
    const { data: top } = await supabaseAdmin
      .from("tts_cache")
      .select("text, preset, hit_count, last_used_at")
      .order("hit_count", { ascending: false })
      .limit(10);
    const { data: hits } = await supabaseAdmin
      .from("tts_cache")
      .select("hit_count");
    const totalHits = (hits ?? []).reduce(
      (acc, r) => acc + (r.hit_count ?? 0),
      0,
    );
    return {
      total: total ?? 0,
      totalHits,
      cap: getTtsCap(),
      top: top ?? [],
    };
  });

// ──────────────────────────────────────────────────────────────────────────
// TTS observability — time series, top games, summary
// ──────────────────────────────────────────────────────────────────────────

export const TTS_COST_PER_MILLION_CHARS = 30; // ElevenLabs Starter ≈ $30/1M chars

type LogRow = {
  room_id: string | null;
  outcome: string;
  char_count: number;
  created_at: string;
};

export const getTtsSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ days: z.number().int().min(1).max(90).default(7) }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("tts_call_log")
      .select("room_id, outcome, char_count, created_at")
      .gte("created_at", since);
    const list = (rows ?? []) as LogRow[];
    const total = list.length;
    const cacheHits = list.filter((r) => r.outcome === "cache_hit").length;
    const generated = list.filter((r) => r.outcome === "generated").length;
    const capSkipped = list.filter((r) => r.outcome === "cap_skipped").length;
    const errors = list.filter((r) => r.outcome === "error").length;
    const generatedChars = list
      .filter((r) => r.outcome === "generated")
      .reduce((a, r) => a + (r.char_count ?? 0), 0);
    const uniqueGames = new Set(list.map((r) => r.room_id).filter(Boolean)).size;
    return {
      days: data.days,
      total,
      cacheHits,
      generated,
      capSkipped,
      errors,
      generatedChars,
      uniqueGames,
      cacheHitRate: total > 0 ? cacheHits / total : 0,
      capSkipRate: total > 0 ? capSkipped / total : 0,
      avgCallsPerGame: uniqueGames > 0 ? total / uniqueGames : 0,
      estCostUsd: (generatedChars / 1_000_000) * TTS_COST_PER_MILLION_CHARS,
      costPerMillion: TTS_COST_PER_MILLION_CHARS,
    };
  });

export const getTtsTimeSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ days: z.number().int().min(1).max(90).default(14) }).parse)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sinceMs = Date.now() - data.days * 86400000;
    const since = new Date(sinceMs).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("tts_call_log")
      .select("outcome, char_count, created_at")
      .gte("created_at", since);
    const list = (rows ?? []) as Pick<LogRow, "outcome" | "char_count" | "created_at">[];
    // bucket by UTC day
    type Bucket = {
      day: string;
      cache_hits: number;
      generated: number;
      cap_skipped: number;
      errors: number;
      generated_chars: number;
    };
    const buckets = new Map<string, Bucket>();
    for (let i = 0; i < data.days; i++) {
      const d = new Date(sinceMs + i * 86400000);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, {
        day: key,
        cache_hits: 0,
        generated: 0,
        cap_skipped: 0,
        errors: 0,
        generated_chars: 0,
      });
    }
    for (const r of list) {
      const key = r.created_at.slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      if (r.outcome === "cache_hit") b.cache_hits++;
      else if (r.outcome === "generated") {
        b.generated++;
        b.generated_chars += r.char_count ?? 0;
      } else if (r.outcome === "cap_skipped") b.cap_skipped++;
      else if (r.outcome === "error") b.errors++;
    }
    return { days: data.days, buckets: Array.from(buckets.values()) };
  });

export const getTtsTopGames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      days: z.number().int().min(1).max(90).default(7),
      limit: z.number().int().min(1).max(100).default(20),
    }).parse,
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("tts_call_log")
      .select("room_id, outcome, char_count")
      .gte("created_at", since)
      .not("room_id", "is", null);
    const list = (rows ?? []) as LogRow[];
    type Agg = {
      room_id: string;
      total: number;
      generated: number;
      cache_hits: number;
      cap_skipped: number;
      generated_chars: number;
    };
    const agg = new Map<string, Agg>();
    for (const r of list) {
      if (!r.room_id) continue;
      let a = agg.get(r.room_id);
      if (!a) {
        a = { room_id: r.room_id, total: 0, generated: 0, cache_hits: 0, cap_skipped: 0, generated_chars: 0 };
        agg.set(r.room_id, a);
      }
      a.total++;
      if (r.outcome === "cache_hit") a.cache_hits++;
      else if (r.outcome === "generated") {
        a.generated++;
        a.generated_chars += r.char_count ?? 0;
      } else if (r.outcome === "cap_skipped") a.cap_skipped++;
    }
    const sorted = Array.from(agg.values())
      .sort((a, b) => b.generated_chars - a.generated_chars)
      .slice(0, data.limit);
    const ids = sorted.map((a) => a.room_id);
    let codeMap = new Map<string, { room_code: string; created_at: string }>();
    if (ids.length > 0) {
      const { data: rooms } = await supabaseAdmin
        .from("rooms")
        .select("id, room_code, created_at")
        .in("id", ids);
      for (const r of rooms ?? []) {
        codeMap.set(r.id as string, {
          room_code: (r.room_code as string) ?? "—",
          created_at: (r.created_at as string) ?? "",
        });
      }
    }
    return {
      days: data.days,
      cap: getTtsCap(),
      costPerMillion: TTS_COST_PER_MILLION_CHARS,
      rows: sorted.map((a) => ({
        ...a,
        room_code: codeMap.get(a.room_id)?.room_code ?? "—",
        room_created_at: codeMap.get(a.room_id)?.created_at ?? null,
        est_cost_usd: (a.generated_chars / 1_000_000) * TTS_COST_PER_MILLION_CHARS,
      })),
    };
  });



// ──────────────────────────────────────────────────────────────────────────
// Persona pack — pre-bake static Vox catchphrases to storage so gameplay
// doesn't hit ElevenLabs for the hot lines.
// ──────────────────────────────────────────────────────────────────────────

async function ensurePersonaFolder() {
  const { data } = await supabaseAdmin
    .from("sound_folders")
    .select("id")
    .eq("name", PERSONA_FOLDER)
    .maybeSingle();
  if (!data) {
    await supabaseAdmin
      .from("sound_folders")
      .insert({ name: PERSONA_FOLDER, sort_order: 1 });
  }
}

function personaSlot(moment: string, idx: number) {
  return `persona_${moment}_${idx}`;
}

// Round/question callouts the host speaks via speakAsElf. Baking these
// means each one becomes a free URL hit instead of an ElevenLabs call.
// The canonical list lives in round-callouts.ts so the speaker and the
// baker can never drift apart.
import { ALL_ROUND_CALLOUTS } from "./round-callouts";
export const ROUND_CALLOUTS: string[] = ALL_ROUND_CALLOUTS;

async function getExistingPersonaLabels(): Promise<Set<string>> {
  const labels = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("sound_clips")
      .select("label")
      .eq("category", PERSONA_CATEGORY)
      .eq("is_active", true)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) labels.add((row.label as string) ?? "");
    if (!data || data.length < pageSize) break;
  }
  return labels;
}

export const generatePersonaPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) => z.object({
      force: z.boolean().optional(),
      limit: z.number().int().min(1).max(50).optional(),
      excludeSlots: z.array(z.string()).max(500).optional(),
    }).optional().parse(input) ?? {},
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await ensurePersonaFolder();
    const force = data?.force ?? false;
    const limit = data?.limit ?? 20;
    const excludedSlots = new Set(data?.excludeSlots ?? []);

    const generated: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];
    const failedSlots: string[] = [];
    const flat: { slot: string; text: string }[] = [];
    for (const [moment, lines] of Object.entries(PERSONA_LINES)) {
      lines.forEach((text, idx) => {
        flat.push({ slot: personaSlot(moment, idx), text });
      });
    }
    ROUND_CALLOUTS.forEach((text, idx) => {
      flat.push({ slot: personaSlot("round", idx), text });
    });

    // Skip lines already baked unless forced.
    const existingLabels = force ? new Set<string>() : await getExistingPersonaLabels();
    const pending = (force ? flat : flat.filter((item) => !existingLabels.has(item.text))).filter(
      (item) => !excludedSlots.has(item.slot),
    );
    const batch = pending.slice(0, limit);

    for (const item of batch) {
      try {
        const audio = await generateTTS(item.text, {
          stability: 0.2,
          similarity_boost: 0.75,
          style: 0.9,
          use_speaker_boost: true,
          speed: 1.0,
        });
        const path = `persona/${item.slot}.mp3`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("question-media")
          .upload(path, new Uint8Array(audio), {
            contentType: "audio/mpeg",
            upsert: true,
          });
        if (upErr) throw new Error(upErr.message);

        await supabaseAdmin.from("sound_clips").delete().eq("storage_path", path);
        const { error: insErr } = await supabaseAdmin.from("sound_clips").insert({
          slot: PERSONA_FOLDER,
          category: PERSONA_CATEGORY,
          label: item.text,
          storage_path: path,
          original_filename: `${item.slot}.mp3`,
          is_active: true,
          audience_visible: false,
          volume: 1.0,
          loop: false,
        });
        if (insErr) throw new Error(insErr.message);
        generated.push(item.slot);
        await new Promise((r) => setTimeout(r, 200));
      } catch (e) {
        errors.push(`${item.slot}: ${(e as Error).message}`);
        failedSlots.push(item.slot);
      }
    }

    if (!force) skipped.push(...flat.filter((item) => existingLabels.has(item.text)).map((item) => item.slot));

    return {
      generated: generated.length,
      skipped: skipped.length,
      errors,
      total: flat.length,
      processed: batch.length,
      remaining: Math.max(0, pending.length - generated.length),
      failedSlots,
    };
  });

export const getPersonaPackStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    let total = 0;
    for (const lines of Object.values(PERSONA_LINES)) total += lines.length;
    total += ROUND_CALLOUTS.length;
    const { count: baked } = await supabaseAdmin
      .from("sound_clips")
      .select("id", { count: "exact", head: true })
      .eq("category", PERSONA_CATEGORY)
      .eq("is_active", true);
    return { total, baked: baked ?? 0 };
  });

export const getPersonaCacheMap = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("sound_clips")
      .select("label, storage_path")
      .eq("category", PERSONA_CATEGORY)
      .eq("is_active", true);
    if (error) return { map: {} as Record<string, string> };

    const map: Record<string, string> = {};
    for (const row of data ?? []) {
      const { data: signed } = await supabaseAdmin.storage
        .from("question-media")
        .createSignedUrl(row.storage_path, 60 * 60 * 24 * 7); // 7 days
      if (signed?.signedUrl) {
        map[row.label] = signed.signedUrl;
      }
    }
    return { map };
  });


// ──────────────────────────────────────────────────────────────────────────
// Adult / party-mode persona pack — mirrors the Vox pack but with a distinct
// ElevenLabs voice (Bill) and the adult catchphrase pool.
// ──────────────────────────────────────────────────────────────────────────

async function ensurePersonaFolderAdult() {
  const { data } = await supabaseAdmin
    .from("sound_folders")
    .select("id")
    .eq("name", PERSONA_FOLDER_ADULT)
    .maybeSingle();
  if (!data) {
    await supabaseAdmin
      .from("sound_folders")
      .insert({ name: PERSONA_FOLDER_ADULT, sort_order: 3 });
  }
}

async function getExistingPersonaLabelsAdult(): Promise<Set<string>> {
  const labels = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("sound_clips")
      .select("label")
      .eq("category", PERSONA_CATEGORY_ADULT)
      .eq("is_active", true)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) labels.add((row.label as string) ?? "");
    if (!data || data.length < pageSize) break;
  }
  return labels;
}

export const generatePersonaPackAdult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) => z.object({
      force: z.boolean().optional(),
      limit: z.number().int().min(1).max(50).optional(),
      excludeSlots: z.array(z.string()).max(2000).optional(),
    }).optional().parse(input) ?? {},
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await ensurePersonaFolderAdult();
    const force = data?.force ?? false;
    const limit = data?.limit ?? 20;
    const excludedSlots = new Set(data?.excludeSlots ?? []);

    const generated: string[] = [];
    const errors: string[] = [];
    const failedSlots: string[] = [];
    const flat: { slot: string; text: string }[] = [];
    for (const [moment, lines] of Object.entries(PERSONA_LINES_ADULT)) {
      lines.forEach((text, idx) => {
        if (text.includes("{flirtName}")) {
          // Expand across the flirt-name list — one baked file per (line × name)
          // so runtime substitution always resolves to a pre-baked entry.
          ADULT_FLIRT_NAMES.forEach((name, nIdx) => {
            const resolved = text.replace(/\{flirtName\}/g, name);
            flat.push({ slot: `persona_adult_${moment}_${idx}_n${nIdx}`, text: resolved });
          });
        } else {
          flat.push({ slot: `persona_adult_${moment}_${idx}`, text });
        }
      });
    }

    const existingLabels = force ? new Set<string>() : await getExistingPersonaLabelsAdult();
    const pending = (force ? flat : flat.filter((item) => !existingLabels.has(item.text))).filter(
      (item) => !excludedSlots.has(item.slot),
    );
    const batch = pending.slice(0, limit);

    for (const item of batch) {
      try {
        const audio = await generateTTS(
          item.text,
          {
            stability: 0.25,
            similarity_boost: 0.8,
            style: 0.85,
            use_speaker_boost: true,
            speed: 1.0,
          },
          ADULT_VOICE_ID,
        );
        const path = `persona-adult/${item.slot}.mp3`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("question-media")
          .upload(path, new Uint8Array(audio), {
            contentType: "audio/mpeg",
            upsert: true,
          });
        if (upErr) throw new Error(upErr.message);

        await supabaseAdmin.from("sound_clips").delete().eq("storage_path", path);
        const { error: insErr } = await supabaseAdmin.from("sound_clips").insert({
          slot: PERSONA_FOLDER_ADULT,
          category: PERSONA_CATEGORY_ADULT,
          label: item.text,
          storage_path: path,
          original_filename: `${item.slot}.mp3`,
          is_active: true,
          audience_visible: false,
          volume: 1.0,
          loop: false,
        });
        if (insErr) throw new Error(insErr.message);
        generated.push(item.slot);
        await new Promise((r) => setTimeout(r, 200));
      } catch (e) {
        errors.push(`${item.slot}: ${(e as Error).message}`);
        failedSlots.push(item.slot);
      }
    }

    return {
      generated: generated.length,
      errors,
      total: flat.length,
      processed: batch.length,
      remaining: Math.max(0, pending.length - generated.length),
      failedSlots,
    };
  });

export const getPersonaPackAdultStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    let total = 0;
    for (const lines of Object.values(PERSONA_LINES_ADULT)) {
      for (const text of lines) {
        total += text.includes("{flirtName}") ? ADULT_FLIRT_NAMES.length : 1;
      }
    }
    const { count: baked } = await supabaseAdmin
      .from("sound_clips")
      .select("id", { count: "exact", head: true })
      .eq("category", PERSONA_CATEGORY_ADULT)
      .eq("is_active", true);
    return { total, baked: baked ?? 0 };
  });

export const getPersonaCacheMapAdult = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("sound_clips")
      .select("label, storage_path")
      .eq("category", PERSONA_CATEGORY_ADULT)
      .eq("is_active", true);
    if (error) return { map: {} as Record<string, string> };

    const map: Record<string, string> = {};
    for (const row of data ?? []) {
      const { data: signed } = await supabaseAdmin.storage
        .from("question-media")
        .createSignedUrl(row.storage_path, 60 * 60 * 24 * 7);
      if (signed?.signedUrl) {
        map[row.label] = signed.signedUrl;
      }
    }
    return { map };
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

// ──────────────────────────────────────────────────────────────────────────
// Explanation voiceovers — pre-bake The Elf reading each "Did you know?"
// ──────────────────────────────────────────────────────────────────────────

const EXPLANATION_TTS_PREFIX = "explanation-tts";

async function bakeOneExplanation(
  q: { id: string; explanation: string | null; explanation_tts_text_hash?: string | null; explanation_tts_path?: string | null },
  force = false,
): Promise<"baked" | "skipped"> {
  const text = (q.explanation ?? "").trim();
  if (!text) return "skipped";
  const hash = hashText(text);
  if (!force && q.explanation_tts_path && q.explanation_tts_text_hash === hash) return "skipped";

  const audio = await generateTTS(text, QUESTION_VOICE_SETTINGS);
  const path = `${EXPLANATION_TTS_PREFIX}/${q.id}.mp3`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("question-media")
    .upload(path, new Uint8Array(audio), {
      contentType: "audio/mpeg",
      upsert: true,
    });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  const { error: dbErr } = await supabaseAdmin
    .from("questions")
    .update({ explanation_tts_path: path, explanation_tts_text_hash: hash })
    .eq("id", q.id);
  if (dbErr) throw new Error(`DB update failed: ${dbErr.message}`);
  return "baked";
}

export const bakeExplanationTTS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ questionId: z.string().uuid(), force: z.boolean().optional() }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: q, error } = await supabaseAdmin
      .from("questions")
      .select("id, explanation, explanation_tts_path, explanation_tts_text_hash")
      .eq("id", data.questionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!q) throw new Error("Question not found");
    const result = await bakeOneExplanation(q, data.force ?? false);
    return { result };
  });

export const bakeAllExplanationTTS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ force: z.boolean().optional(), limit: z.number().int().min(1).max(500).optional() }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let query = supabaseAdmin
      .from("questions")
      .select("id, explanation, explanation_tts_path, explanation_tts_text_hash")
      .not("explanation", "is", null)
      .neq("explanation", "");
    if (!data.force) query = query.is("explanation_tts_path", null);
    const { data: rows, error } = await query.limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    const list = rows ?? [];

    let baked = 0;
    let skipped = 0;
    const errors: { id: string; message: string }[] = [];
    for (const q of list) {
      try {
        const r = await bakeOneExplanation(q, data.force ?? false);
        if (r === "baked") baked += 1;
        else skipped += 1;
      } catch (e) {
        errors.push({ id: q.id, message: (e as Error).message });
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return { baked, skipped, errors, total: list.length };
  });

export const getExplanationTTSStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { count: total } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .not("explanation", "is", null)
      .neq("explanation", "");
    const { count: baked } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .not("explanation_tts_path", "is", null);
    return { total: total ?? 0, baked: baked ?? 0 };
  });

