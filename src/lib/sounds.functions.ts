import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SLOT = z.enum(["lobby_loop", "round_intro"]);

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

export type SoundClip = {
  id: string;
  slot: "lobby_loop" | "round_intro";
  label: string;
  storage_path: string;
  is_active: boolean;
  volume: number;
  loop: boolean;
  created_at: string;
};

/** Admin: list every clip across all slots, newest first. */
export const listSoundClips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("sound_clips")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { clips: (data ?? []) as SoundClip[] };
  });

/**
 * Public: return signed URLs for the currently active clip in each slot.
 * The host TV calls this once on mount.
 */
export const getActiveSounds = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("sound_clips")
      .select("*")
      .eq("is_active", true);
    if (error) throw new Error(error.message);
    const out: Record<
      string,
      { url: string; volume: number; loop: boolean; label: string }
    > = {};
    for (const row of data ?? []) {
      const { data: signed } = await supabaseAdmin.storage
        .from("question-media")
        .createSignedUrl(row.storage_path, 60 * 60 * 6);
      if (signed?.signedUrl) {
        out[row.slot] = {
          url: signed.signedUrl,
          volume: Number(row.volume),
          loop: !!row.loop,
          label: row.label,
        };
      }
    }
    return { active: out };
  },
);

/**
 * Admin: register an already-uploaded clip (storage_path in question-media)
 * and make it the active clip for its slot.
 */
export const registerSoundClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      slot: SLOT,
      label: z.string().min(1).max(120),
      storage_path: z.string().min(1).max(500),
      makeActive: z.boolean().default(true),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const defaults =
      data.slot === "lobby_loop"
        ? { volume: 0.5, loop: true }
        : { volume: 1.0, loop: false };
    const { data: inserted, error } = await supabaseAdmin
      .from("sound_clips")
      .insert({
        slot: data.slot,
        label: data.label,
        storage_path: data.storage_path,
        is_active: data.makeActive,
        volume: defaults.volume,
        loop: defaults.loop,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.makeActive) {
      const { error: deactErr } = await supabaseAdmin
        .from("sound_clips")
        .update({ is_active: false })
        .eq("slot", data.slot)
        .neq("id", inserted.id);
      if (deactErr) throw new Error(deactErr.message);
    }
    return { id: inserted.id };
  });

export const setActiveClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("sound_clips")
      .select("slot")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("sound_clips")
      .update({ is_active: false })
      .eq("slot", row.slot);
    const { error: upErr } = await supabaseAdmin
      .from("sound_clips")
      .update({ is_active: true })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
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
      .single();
    await supabaseAdmin.from("sound_clips").delete().eq("id", data.id);
    if (row?.storage_path) {
      await supabaseAdmin.storage
        .from("question-media")
        .remove([row.storage_path])
        .catch(() => {});
    }
    return { ok: true };
  });

export const updateClipSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      volume: z.number().min(0).max(1).optional(),
      loop: z.boolean().optional(),
      label: z.string().min(1).max(120).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const patch: Record<string, unknown> = {};
    if (data.volume !== undefined) patch.volume = data.volume;
    if (data.loop !== undefined) patch.loop = data.loop;
    if (data.label !== undefined) patch.label = data.label;
    const { error } = await supabaseAdmin
      .from("sound_clips")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
