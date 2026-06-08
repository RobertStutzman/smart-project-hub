import { createFileRoute } from "@tanstack/react-router";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function listAllFolders(supabase: any): Promise<string[]> {
  const { data, error } = await supabase.storage.from("avatars").list("", {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;
  // Folders have no `id` (or null id) in the list response
  return (data ?? [])
    .filter((entry: any) => !entry.id)
    .map((entry: any) => entry.name as string);
}

async function listFilesInFolder(supabase: any, folder: string): Promise<string[]> {
  const out: string[] = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from("avatars").list(folder, {
      limit: pageSize,
      offset,
    });
    if (error) throw error;
    const rows = data ?? [];
    for (const r of rows) {
      if (r.id) out.push(`${folder}/${r.name}`);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

function ageMsFromPath(path: string): number | null {
  // path format: {roomCode}/{sessionId}-{timestamp}.jpg
  const m = path.match(/-(\d{10,})\.jpg$/i);
  if (!m) return null;
  const ts = Number(m[1]);
  if (!Number.isFinite(ts)) return null;
  return Date.now() - ts;
}

export const Route = createFileRoute("/api/public/hooks/cleanup-avatars")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let scanned = 0;
        let deleted = 0;
        const toDelete: string[] = [];

        try {
          const folders = await listAllFolders(supabaseAdmin);
          for (const folder of folders) {
            const files = await listFilesInFolder(supabaseAdmin, folder);
            for (const path of files) {
              scanned++;
              const age = ageMsFromPath(path);
              // If we can't parse the timestamp, fall back: delete if older than 7 days
              // by checking via list metadata is expensive — just leave it for safety.
              if (age != null && age > MAX_AGE_MS) {
                toDelete.push(path);
              }
            }
          }

          // Delete in batches of 100
          for (let i = 0; i < toDelete.length; i += 100) {
            const batch = toDelete.slice(i, i + 100);
            const { error: delErr } = await supabaseAdmin.storage
              .from("avatars")
              .remove(batch);
            if (delErr) {
              console.error("[cleanup-avatars] remove error", delErr);
              continue;
            }
            deleted += batch.length;

            // Best-effort: clear players.avatar_url pointing at any deleted file.
            // Match by filename (it's unique enough across rooms).
            for (const path of batch) {
              const filename = path.split("/").pop();
              if (!filename) continue;
              await supabaseAdmin
                .from("players")
                .update({ avatar_url: null })
                .like("avatar_url", `%${filename}%`);
            }
          }

          return Response.json({ ok: true, scanned, deleted });
        } catch (e) {
          console.error("[cleanup-avatars] failed", e);
          return Response.json(
            { ok: false, error: (e as Error).message, scanned, deleted },
            { status: 500 },
          );
        }
      },
    },
  },
});
