import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- Types ----------

export type SoundClip = {
  id: string;
  slot: string; // legacy; kept in DB but not used by new UI
  category: string;
  label: string;
  storage_path: string;
  original_filename: string | null;
  is_active: boolean;
  audience_visible: boolean;
  volume: number;
  loop: boolean;
  created_at: string;
};

export type SoundFolder = {
  id: string;
  name: string;
  sort_order: number;
};

export const EVENTS = [
  "lobby_music",
  "round_intro",
  "correct",
  "wrong",
  "reveal",
  "leaderboard",
  "final",
  "victory",
] as const;
export type SoundEvent = (typeof EVENTS)[number];

export type EventAssignment = {
  event: SoundEvent;
  clip_id: string | null;
  volume: number;
  loop: boolean;
};

export type ActiveSound = {
  url: string;
  volume: number;
  loop: boolean;
  label: string;
  clipId: string;
};

// ---------- Helpers ----------

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

async function signPath(path: string): Promise<string | null> {
  const { data } = await supabaseAdmin.storage
    .from("question-media")
    .createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl ?? null;
}

// ---------- Folders ----------

export const listFolders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("sound_folders")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { folders: (data ?? []) as SoundFolder[] };
  });

export const createFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ name: z.string().min(1).max(60) }).parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("sound_folders")
      .insert({ name: data.name.trim(), sort_order: 1000 });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ id: z.string().uuid(), name: z.string().min(1).max(60) }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row } = await supabaseAdmin
      .from("sound_folders")
      .select("name")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Folder not found");
    const newName = data.name.trim();
    const { error } = await supabaseAdmin
      .from("sound_folders")
      .update({ name: newName })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // Move clips
    await supabaseAdmin
      .from("sound_clips")
      .update({ category: newName })
      .eq("category", row.name);
    return { ok: true };
  });

export const deleteFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row } = await supabaseAdmin
      .from("sound_folders")
      .select("name")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: true };
    const { count } = await supabaseAdmin
      .from("sound_clips")
      .select("id", { count: "exact", head: true })
      .eq("category", row.name);
    if ((count ?? 0) > 0)
      throw new Error("Move or delete the clips in this folder first");
    const { error } = await supabaseAdmin
      .from("sound_folders")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Clips ----------

export const listSoundClips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("sound_clips")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const clips = (data ?? []) as SoundClip[];
    // Sign every clip URL (short list, fine to bulk sign)
    const withUrls: (SoundClip & { signedUrl: string | null })[] = [];
    for (const c of clips) {
      const url = await signPath(c.storage_path).catch(() => null);
      withUrls.push({ ...c, signedUrl: url });
    }
    return { clips: withUrls };
  });

export const bulkRegisterClips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      category: z.string().min(1).max(60),
      items: z
        .array(
          z.object({
            storage_path: z.string().min(1).max(500),
            label: z.string().min(1).max(120),
            original_filename: z.string().min(1).max(255),
          }),
        )
        .min(1)
        .max(50),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const rows = data.items.map((it) => ({
      slot: data.category, // legacy column
      category: data.category,
      label: it.label,
      original_filename: it.original_filename,
      storage_path: it.storage_path,
      is_active: false,
      volume: 0.8,
      loop: false,
    }));
    const { error } = await supabaseAdmin.from("sound_clips").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const updateClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      label: z.string().min(1).max(120).optional(),
      category: z.string().min(1).max(60).optional(),
      audience_visible: z.boolean().optional(),
      volume: z.number().min(0).max(1).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const patch: {
      label?: string;
      category?: string;
      slot?: string;
      audience_visible?: boolean;
      volume?: number;
    } = {};
    if (data.label !== undefined) patch.label = data.label;
    if (data.category !== undefined) {
      patch.category = data.category;
      patch.slot = data.category;
    }
    if (data.audience_visible !== undefined)
      patch.audience_visible = data.audience_visible;
    if (data.volume !== undefined) patch.volume = data.volume;
    const { error } = await supabaseAdmin
      .from("sound_clips")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSoundClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row } = await supabaseAdmin
      .from("sound_clips")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    await supabaseAdmin.from("sound_clips").delete().eq("id", data.id);
    if (row?.storage_path) {
      await supabaseAdmin.storage
        .from("question-media")
        .remove([row.storage_path])
        .catch(() => {});
    }
    return { ok: true };
  });

// ---------- Event assignments ----------

export const listEventAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("sound_event_assignments")
      .select("*");
    if (error) throw new Error(error.message);
    return { assignments: (data ?? []) as EventAssignment[] };
  });

export const setEventAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      event: z.enum(EVENTS),
      clip_id: z.string().uuid().nullable(),
      volume: z.number().min(0).max(1).optional(),
      loop: z.boolean().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const patch: {
      clip_id: string | null;
      updated_at: string;
      volume?: number;
      loop?: boolean;
    } = {
      clip_id: data.clip_id,
      updated_at: new Date().toISOString(),
    };
    if (data.volume !== undefined) patch.volume = data.volume;
    if (data.loop !== undefined) patch.loop = data.loop;
    const { error } = await supabaseAdmin
      .from("sound_event_assignments")
      .update(patch)
      .eq("event", data.event);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Public: what the host TV & audience need ----------

/**
 * Public: signed URLs for all events that have an assigned clip.
 * Plus the audience-playable library.
 */
export const getActiveSounds = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data: assignments } = await supabaseAdmin
      .from("sound_event_assignments")
      .select("event, clip_id, volume, loop");
    const { data: clips } = await supabaseAdmin
      .from("sound_clips")
      .select("id, storage_path, label, category, audience_visible");

    const clipById = new Map(
      (clips ?? []).map((c) => [c.id as string, c]),
    );

    const events: Partial<Record<SoundEvent, ActiveSound>> = {};
    for (const a of assignments ?? []) {
      if (!a.clip_id) continue;
      const c = clipById.get(a.clip_id);
      if (!c) continue;
      const url = await signPath(c.storage_path);
      if (!url) continue;
      events[a.event as SoundEvent] = {
        url,
        volume: Number(a.volume),
        loop: !!a.loop,
        label: c.label,
        clipId: c.id,
      };
    }

    // Audience-playable library (with signed URLs)
    const audience: { id: string; label: string; url: string; category: string }[] = [];
    for (const c of clips ?? []) {
      if (!c.audience_visible) continue;
      const url = await signPath(c.storage_path);
      if (!url) continue;
      audience.push({
        id: c.id,
        label: c.label,
        url,
        category: c.category,
      });
    }

    // Welcome intro pool (random rotation in lobby)
    const welcomes: { url: string; volume: number; label: string }[] = [];
    for (const c of clips ?? []) {
      if (c.category !== "Announcer") continue;
      if (!/^Welcome\s/i.test(c.label)) continue;
      const url = await signPath(c.storage_path);
      if (!url) continue;
      welcomes.push({ url, volume: 0.95, label: c.label });
    }

    return { events, audience, welcomes };
  },
);
