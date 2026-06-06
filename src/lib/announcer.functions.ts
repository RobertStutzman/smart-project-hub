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

const WELCOME_LINES: string[] = [
  "Welcoooome to BEAT! THE! DROP! The trivia showdown where brains get BROKEN and egos get BRUISED!",
  "Ohhh we got a LIVE one tonight! Strap in nerds, it's BEAT THE DROP, baby!",
  "Ladies, gentlemen, and everyone in between, welcome to BEAT! THE! DROP!",
  "Welcome to BEAT THE DROP, where your relationship will NOT survive round three!",
  "It's the show your therapist warned you about... BEAT! THE! DROOOOP!",
  "Welcome contestants! Or as I like to call you... future LOSERS! Let's play BEAT THE DROP!",
  "Buckle up buttercups, it's BEAT THE DROP, the only game where being smart is a personality FLAW!",
  "Welcome to BEAT THE DROP! Tonight ONE of you becomes a legend. The rest of you become CONTENT.",
  "Heyyyy gamers! Put down the snacks, pick up the buzzers, it's BEAT THE DROP TIIIIME!",
  "Welcome to BEAT THE DROP! Where trivia goes to DIE and friendships go RIGHT along with it!",
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

async function generateTTS(text: string): Promise<ArrayBuffer> {
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
          stability: 0.2,
          similarity_boost: 0.75,
          style: 0.9,

          use_speaker_boost: true,
          speed: 1.0,
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
