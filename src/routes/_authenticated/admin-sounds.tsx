import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  bulkRegisterClips,
  createFolder,
  deleteFolder,
  deleteSoundClip,
  EVENTS,
  listEventAssignments,
  listFolders,
  listSoundClips,
  renameFolder,
  setEventAssignment,
  updateClip,
  type EventAssignment,
  type SoundClip,
  type SoundEvent,
  type SoundFolder,
} from "@/lib/sounds.functions";
import {
  generateAnnouncerPack,
  previewAnnouncerLine,
  WELCOME_LINES,
} from "@/lib/announcer.functions";

export const Route = createFileRoute("/_authenticated/admin-sounds")({
  component: SoundsPage,
});

type ClipWithUrl = SoundClip & { signedUrl: string | null };

const EVENT_LABELS: Record<SoundEvent, string> = {
  lobby_music: "Lobby music (loops)",
  round_intro: "Round intro sting",
  correct: "Correct answer",
  wrong: "Wrong answer",
  reveal: "Reveal sting",
  leaderboard: "Leaderboard",
  final: "Final round intro",
  victory: "Victory / game over",
};

function SoundsPage() {
  const listClipsFn = useServerFn(listSoundClips);
  const listFoldersFn = useServerFn(listFolders);
  const listEventsFn = useServerFn(listEventAssignments);

  const [folders, setFolders] = useState<SoundFolder[]>([]);
  const [clips, setClips] = useState<ClipWithUrl[]>([]);
  const [events, setEvents] = useState<EventAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [f, c, e] = await Promise.all([
        listFoldersFn(),
        listClipsFn(),
        listEventsFn(),
      ]);
      setFolders(f.folders);
      setClips(c.clips);
      setEvents(e.assignments);
      setActiveFolder((cur) => cur ?? f.folders[0]?.name ?? null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [listFoldersFn, listClipsFn, listEventsFn]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const folderClips = useMemo(
    () => clips.filter((c) => c.category === activeFolder),
    [clips, activeFolder],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Admin
            </div>
            <h1 className="mt-1 text-4xl font-bold">Soundboard</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Organize clips in folders, then assign one clip per game event.
              Mark clips as audience-playable to expose them as buttons on
              audience phones.
            </p>
          </div>
          <Link
            to="/admin"
            className="rounded-full border border-border px-4 py-2 text-sm hover:bg-card/60"
          >
            ← Questions
          </Link>
        </header>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-10">
            <EventsPanel events={events} clips={clips} onChange={reload} />
            <FoldersAndLibrary
              folders={folders}
              activeFolder={activeFolder}
              setActiveFolder={setActiveFolder}
              clips={folderClips}
              allClips={clips}
              onChange={reload}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Events panel ─────────────────────────────────────────────────

function EventsPanel({
  events,
  clips,
  onChange,
}: {
  events: EventAssignment[];
  clips: ClipWithUrl[];
  onChange: () => Promise<void>;
}) {
  const setEventFn = useServerFn(setEventAssignment);
  const generatePackFn = useServerFn(generateAnnouncerPack);
  const [generating, setGenerating] = useState(false);

  async function handleAssign(event: SoundEvent, clipId: string | null) {
    try {
      await setEventFn({ data: { event, clip_id: clipId } });
      toast.success("Assigned");
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleGenerate() {
    if (
      !window.confirm(
        "Generate the AI announcer pack? This calls ElevenLabs for ~10 voice lines + 1 lobby music loop (~30s) and overwrites any existing announcer clips. Takes ~1-2 minutes.",
      )
    )
      return;
    setGenerating(true);
    try {
      const res = await generatePackFn();
      if (res.errors.length) {
        toast.warning(
          `Generated ${res.generated.length}/${res.total}. Errors: ${res.errors.join("; ")}`,
        );
      } else {
        toast.success(`Generated ${res.generated.length} announcer clips`);
      }
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const byEvent = new Map(events.map((e) => [e.event, e]));

  return (
    <section className="rounded-3xl border border-border bg-card/30 p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300/80">
            Event assignments
          </div>
          <h2 className="text-2xl font-bold">What plays when</h2>
        </div>
        <button
          onClick={() => void handleGenerate()}
          disabled={generating}
          className="rounded-full bg-gradient-to-r from-amber-400 to-pink-500 px-5 py-2 text-sm font-bold text-black shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? "Generating… (1-2 min)" : "🎙️ Generate AI announcer pack"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Empty events fall back to the built-in synth sounds. The AI pack uses
        ElevenLabs to create a hype game-show host voice + lobby music in one
        click.
      </p>

      <WelcomePreview />




      <div className="mt-5 grid gap-3">
        {EVENTS.map((event) => {
          const assignment = byEvent.get(event);
          const clipId = assignment?.clip_id ?? null;
          const clip = clipId ? clips.find((c) => c.id === clipId) : null;
          return (
            <div
              key={event}
              className="grid items-center gap-3 rounded-2xl border border-border bg-background/40 p-3 sm:grid-cols-[200px_1fr_auto]"
            >
              <div className="text-sm font-bold">{EVENT_LABELS[event]}</div>
              <select
                value={clipId ?? ""}
                onChange={(e) =>
                  void handleAssign(event, e.target.value || null)
                }
                className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
              >
                <option value="">— None (synth fallback) —</option>
                {clips.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.category}] {c.label}
                  </option>
                ))}
              </select>
              {clip?.signedUrl ? (
                <audio src={clip.signedUrl} controls className="h-8" />
              ) : (
                <div className="text-xs text-muted-foreground">No preview</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Folders + library ────────────────────────────────────────────

function FoldersAndLibrary({
  folders,
  activeFolder,
  setActiveFolder,
  clips,
  allClips,
  onChange,
}: {
  folders: SoundFolder[];
  activeFolder: string | null;
  setActiveFolder: (n: string | null) => void;
  clips: ClipWithUrl[];
  allClips: ClipWithUrl[];
  onChange: () => Promise<void>;
}) {
  const createFolderFn = useServerFn(createFolder);
  const renameFolderFn = useServerFn(renameFolder);
  const deleteFolderFn = useServerFn(deleteFolder);

  async function handleCreate() {
    const name = window.prompt("New folder name");
    if (!name?.trim()) return;
    try {
      await createFolderFn({ data: { name: name.trim() } });
      setActiveFolder(name.trim());
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleRename(folder: SoundFolder) {
    const name = window.prompt("Rename folder", folder.name);
    if (!name?.trim() || name.trim() === folder.name) return;
    try {
      await renameFolderFn({ data: { id: folder.id, name: name.trim() } });
      setActiveFolder(name.trim());
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(folder: SoundFolder) {
    if (!window.confirm(`Delete folder "${folder.name}"?`)) return;
    try {
      await deleteFolderFn({ data: { id: folder.id } });
      setActiveFolder(folders[0]?.name ?? null);
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card/30 p-6">
      <div className="mb-1 text-xs font-bold uppercase tracking-[0.3em] text-amber-300/80">
        Library
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Folders</h2>
        <button
          onClick={handleCreate}
          className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground"
        >
          + New folder
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {folders.map((f) => {
          const count = allClips.filter((c) => c.category === f.name).length;
          const active = activeFolder === f.name;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFolder(f.name)}
              onDoubleClick={() => handleRename(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                active
                  ? "bg-amber-300 text-amber-950"
                  : "bg-background/60 text-foreground hover:bg-card/60"
              }`}
              title="Click to open · double-click to rename"
            >
              {f.name}{" "}
              <span className="ml-1 text-xs opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {activeFolder && (
        <FolderContents
          folderName={activeFolder}
          clips={clips}
          onChange={onChange}
          onDeleteFolder={() => {
            const f = folders.find((x) => x.name === activeFolder);
            if (f) void handleDelete(f);
          }}
          onRenameFolder={() => {
            const f = folders.find((x) => x.name === activeFolder);
            if (f) void handleRename(f);
          }}
        />
      )}
    </section>
  );
}

function FolderContents({
  folderName,
  clips,
  onChange,
  onDeleteFolder,
  onRenameFolder,
}: {
  folderName: string;
  clips: ClipWithUrl[];
  onChange: () => Promise<void>;
  onDeleteFolder: () => void;
  onRenameFolder: () => void;
}) {
  const bulkRegisterFn = useServerFn(bulkRegisterClips);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith("audio/"));
      if (arr.length === 0) {
        toast.error("Pick MP3/WAV files");
        return;
      }
      const oversized = arr.filter((f) => f.size > 15 * 1024 * 1024);
      if (oversized.length > 0) {
        toast.error(`${oversized.length} file(s) over 15 MB skipped`);
      }
      const valid = arr.filter((f) => f.size <= 15 * 1024 * 1024);
      if (valid.length === 0) return;

      setUploading(true);
      setProgress({ done: 0, total: valid.length });
      const uploaded: {
        storage_path: string;
        label: string;
        original_filename: string;
      }[] = [];

      for (const file of valid) {
        try {
          const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
          const path = `sounds/${folderName.toLowerCase().replace(/\s+/g, "-")}/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage
            .from("question-media")
            .upload(path, file, {
              contentType: file.type || "audio/mpeg",
              upsert: false,
            });
          if (error) throw error;
          const label = file.name.replace(/\.[^.]+$/, "");
          uploaded.push({
            storage_path: path,
            label,
            original_filename: file.name,
          });
        } catch (err) {
          toast.error(`${file.name}: ${(err as Error).message}`);
        } finally {
          setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
        }
      }

      if (uploaded.length > 0) {
        try {
          await bulkRegisterFn({
            data: { category: folderName, items: uploaded },
          });
          toast.success(`Added ${uploaded.length} clip(s) to ${folderName}`);
          await onChange();
        } catch (err) {
          toast.error((err as Error).message);
        }
      }

      setUploading(false);
      setProgress(null);
    },
    [folderName, bulkRegisterFn, onChange],
  );

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-xl font-bold">{folderName}</h3>
        <div className="flex gap-2 text-xs">
          <button
            onClick={onRenameFolder}
            className="rounded-full border border-border px-3 py-1 hover:bg-card/60"
          >
            Rename
          </button>
          <button
            onClick={onDeleteFolder}
            className="rounded-full border border-border px-3 py-1 text-rose-400 hover:bg-rose-500/10"
          >
            Delete folder
          </button>
        </div>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0)
            void handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragOver
            ? "border-amber-300 bg-amber-300/10"
            : "border-border bg-background/30 hover:bg-card/40"
        }`}
      >
        <input
          type="file"
          accept="audio/*"
          multiple
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
        <div className="text-lg font-bold">
          {uploading
            ? `Uploading ${progress?.done}/${progress?.total}…`
            : "Drag MP3/WAV files here"}
        </div>
        <div className="text-xs text-muted-foreground">
          or click to pick multiple — up to 15 MB each
        </div>
      </label>

      {clips.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border/60 bg-background/30 px-4 py-6 text-center text-sm text-muted-foreground">
          No clips in this folder yet.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {clips.map((c) => (
            <ClipRow key={c.id} clip={c} onChange={onChange} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ClipRow({
  clip,
  onChange,
}: {
  clip: ClipWithUrl;
  onChange: () => Promise<void>;
}) {
  const updateClipFn = useServerFn(updateClip);
  const deleteClipFn = useServerFn(deleteSoundClip);
  const [label, setLabel] = useState(clip.label);

  async function commitLabel() {
    if (label.trim() === clip.label || !label.trim()) return;
    try {
      await updateClipFn({ data: { id: clip.id, label: label.trim() } });
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function toggleAudience() {
    try {
      await updateClipFn({
        data: { id: clip.id, audience_visible: !clip.audience_visible },
      });
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${clip.label}"?`)) return;
    try {
      await deleteClipFn({ data: { id: clip.id } });
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commitLabel}
        className="min-w-[180px] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-bold hover:border-border focus:border-border focus:outline-none"
      />
      {clip.signedUrl ? (
        <audio src={clip.signedUrl} controls className="h-8 max-w-xs" />
      ) : (
        <div className="text-xs text-muted-foreground">Loading…</div>
      )}
      <label className="flex cursor-pointer items-center gap-1.5 rounded-full bg-background/60 px-3 py-1 text-xs">
        <input
          type="checkbox"
          checked={clip.audience_visible}
          onChange={toggleAudience}
        />
        Audience
      </label>
      <button
        onClick={handleDelete}
        className="text-xs uppercase tracking-widest text-muted-foreground hover:text-rose-400"
      >
        Delete
      </button>
    </li>
  );
}
