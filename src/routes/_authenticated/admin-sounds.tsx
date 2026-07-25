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
  bakeAllQuestionTTS,
  bakeAllExplanationTTS,
  generateAnnouncerPack,
  generateMusicPack,
  generatePersonaPack,
  generatePersonaPackAdult,
  getExplanationTTSStats,
  getPersonaPackAdultStats,
  getPersonaPackStats,
  getQuestionTTSStats,
  getTTSCacheStats,
  previewAnnouncerLine,
  WELCOME_LINES,
} from "@/lib/announcer.functions";
import {
  HOST_MOMENTS,
  bakedCount,
  type HostMomentMeta,
} from "@/lib/host-moments";

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
  const generateMusicPackFn = useServerFn(generateMusicPack);
  const generatePersonaFn = useServerFn(generatePersonaPack);
  const personaStatsFn = useServerFn(getPersonaPackStats);
  const generatePersonaAdultFn = useServerFn(generatePersonaPackAdult);
  const personaStatsAdultFn = useServerFn(getPersonaPackAdultStats);
  const [generating, setGenerating] = useState(false);
  const [generatingMusic, setGeneratingMusic] = useState(false);
  const [generatingPersona, setGeneratingPersona] = useState(false);
  const [personaProgress, setPersonaProgress] = useState<string | null>(null);
  const [personaStats, setPersonaStats] = useState<{ total: number; baked: number } | null>(null);
  const [generatingPersonaAdult, setGeneratingPersonaAdult] = useState(false);
  const [personaAdultProgress, setPersonaAdultProgress] = useState<string | null>(null);
  const [personaAdultStats, setPersonaAdultStats] = useState<{ total: number; baked: number } | null>(null);

  async function loadPersonaStats() {
    try {
      const s = await personaStatsFn();
      setPersonaStats({ total: s.total, baked: s.baked });
    } catch {
      // non-fatal
    }
  }

  async function loadPersonaAdultStats() {
    try {
      const s = await personaStatsAdultFn();
      setPersonaAdultStats({ total: s.total, baked: s.baked });
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    void loadPersonaStats();
    void loadPersonaAdultStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGeneratePersona() {
    const missing = personaStats ? personaStats.total - personaStats.baked : null;
    const msg = missing != null
      ? `Bake ${missing} missing Vox catchphrase${missing === 1 ? "" : "s"}? These are the host's hype lines ("Lock in!", "Fingers on buzzers!", round transitions) — NOT question reads. Already-baked lines are skipped. Calls ElevenLabs — takes ~1 minute.`
      : `Pre-bake the Vox catchphrases (host hype lines, not question reads)? Already-baked are skipped. Calls ElevenLabs once per missing line. ~1 minute.`;
    if (!window.confirm(msg)) return;
    setGeneratingPersona(true);
    const remaining = missing ?? 0;
    const toastId = toast.loading(`Baking catchphrases… 0 / ${remaining}`);
    setPersonaProgress(`Baking catchphrases… 0 / ${remaining}`);
    try {
      let totalGenerated = 0;
      let totalErrors = 0;
      let latestErrors: string[] = [];
      const failedSlots = new Set<string>();
      let safety = 0;

      while (safety++ < 200) {
        const res = await generatePersonaFn({
          data: { limit: 20, excludeSlots: Array.from(failedSlots) },
        });
        totalGenerated += res.generated;
        totalErrors += res.errors.length;
        latestErrors = res.errors.slice(0, 3);
        for (const slot of res.failedSlots) failedSlots.add(slot);

        const done = Math.min(remaining, totalGenerated + failedSlots.size);
        const progress = `Baking catchphrases… ${done} / ${remaining}${totalErrors ? ` · ${totalErrors} errors` : ""}`;
        setPersonaProgress(progress);
        toast.loading(progress, { id: toastId });

        if (res.processed === 0 || res.remaining === 0) break;
      }

      const errorSuffix = totalErrors
        ? ` · ${totalErrors} errors${latestErrors.length ? `: ${latestErrors.join("; ")}` : ""}`
        : "";
      const doneMessage = `Done! Baked ${totalGenerated} Vox catchphrases${errorSuffix}.`;
      if (totalErrors) toast.warning(doneMessage, { id: toastId });
      else toast.success(doneMessage, { id: toastId });
      await loadPersonaStats();
      await onChange();
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setPersonaProgress(null);
      setGeneratingPersona(false);
    }
  }

  async function handleGeneratePersonaAdult() {
    const missing = personaAdultStats ? personaAdultStats.total - personaAdultStats.baked : null;
    const msg = missing != null
      ? `Bake ${missing} missing ADULT Vox catchphrase${missing === 1 ? "" : "s"}? These use a distinct ElevenLabs voice (Bill — gravelly, older) for adult/party mode. Already-baked lines are skipped. Calls ElevenLabs — takes several minutes.`
      : `Pre-bake the ADULT Vox catchphrases (party-mode host voice). Already-baked are skipped. Calls ElevenLabs once per missing line.`;
    if (!window.confirm(msg)) return;
    setGeneratingPersonaAdult(true);
    const remaining = missing ?? 0;
    const toastId = toast.loading(`Baking ADULT catchphrases… 0 / ${remaining}`);
    setPersonaAdultProgress(`Baking ADULT catchphrases… 0 / ${remaining}`);
    try {
      let totalGenerated = 0;
      let totalErrors = 0;
      let latestErrors: string[] = [];
      const failedSlots = new Set<string>();
      let safety = 0;

      while (safety++ < 200) {
        const res = await generatePersonaAdultFn({
          data: { limit: 20, excludeSlots: Array.from(failedSlots) },
        });
        totalGenerated += res.generated;
        totalErrors += res.errors.length;
        latestErrors = res.errors.slice(0, 3);
        for (const slot of res.failedSlots) failedSlots.add(slot);

        const done = Math.min(remaining, totalGenerated + failedSlots.size);
        const progress = `Baking ADULT catchphrases… ${done} / ${remaining}${totalErrors ? ` · ${totalErrors} errors` : ""}`;
        setPersonaAdultProgress(progress);
        toast.loading(progress, { id: toastId });

        if (res.processed === 0 || res.remaining === 0) break;
      }

      const errorSuffix = totalErrors
        ? ` · ${totalErrors} errors${latestErrors.length ? `: ${latestErrors.join("; ")}` : ""}`
        : "";
      const doneMessage = `Done! Baked ${totalGenerated} ADULT Vox catchphrases${errorSuffix}.`;
      if (totalErrors) toast.warning(doneMessage, { id: toastId });
      else toast.success(doneMessage, { id: toastId });
      await loadPersonaAdultStats();
      await onChange();
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
    } finally {
      setPersonaAdultProgress(null);
      setGeneratingPersonaAdult(false);
    }
  }



  async function handleAssign(event: SoundEvent, clipId: string | null) {
    try {
      await setEventFn({ data: { event, clip_id: clipId } });
      toast.success("Assigned");
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleGenerateMusicPack() {
    if (
      !window.confirm(
        "Generate the FULL AI music pack? This calls ElevenLabs Music 8 separate times (lobby loop, round intro, correct/wrong/reveal stings, leaderboard, final, victory fanfare) and auto-assigns each to its game event. Takes 4-6 minutes.",
      )
    )
      return;
    setGeneratingMusic(true);
    try {
      const res = await generateMusicPackFn();
      if (res.errors.length) {
        toast.warning(
          `Generated ${res.generated.length}/${res.total}. Errors: ${res.errors.join("; ")}`,
        );
      } else {
        toast.success(`Generated ${res.generated.length} music tracks`);
      }
      await onChange();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGeneratingMusic(false);
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
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-amber-700">
            Event assignments
          </div>
          <h2 className="text-2xl font-bold">What plays when</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void handleGenerateMusicPack()}
            disabled={generatingMusic}
            className="rounded-full bg-cyan-600 px-5 py-2 text-sm font-bold text-white shadow-md ring-1 ring-cyan-400/30 transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generatingMusic ? "🎵 Generating music pack… (4-6 min)" : "🎵 Generate AI music pack (8 tracks)"}
          </button>
          <button
            onClick={() => void handleGeneratePersona()}
            disabled={generatingPersona}
            className="rounded-full bg-amber-600 px-5 py-2 text-sm font-bold text-white shadow-md ring-1 ring-amber-400/30 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generatingPersona
              ? personaProgress ?? "🎭 Baking catchphrases…"
              : personaStats
                ? personaStats.baked >= personaStats.total
                  ? `🎭 Vox catchphrases fully baked (${personaStats.baked}/${personaStats.total}) — re-bake?`
                  : `🎭 Bake ${personaStats.total - personaStats.baked} missing Vox catchphrase${personaStats.total - personaStats.baked === 1 ? "" : "s"} (${personaStats.baked}/${personaStats.total} done)`
                : "🎭 Bake Vox catchphrases"}
          </button>
          <button
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="rounded-full bg-pink-600 px-5 py-2 text-sm font-bold text-white shadow-md ring-1 ring-pink-400/30 transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? "Generating… (1-2 min)" : "🎙️ Generate AI announcer pack"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Empty events fall back to the built-in synth sounds. The AI pack uses
        ElevenLabs to create a hype game-show host voice + lobby music in one
        click. The music pack generates 8 unique tracks and auto-assigns them to
        lobby, round intro, correct/wrong/reveal, leaderboard, final, and victory.
      </p>
      <p className="mt-2 text-xs text-amber-700">
        🎭 Catchphrases = host hype lines ("Lock in!", "Fingers on buzzers!", round transitions). To narrate the actual trivia questions, use the <strong>Question voiceovers</strong> panel below.
      </p>

      <WelcomePreview />

      <QuestionVoiceoversPanel />

      <ExplanationVoiceoversPanel />

      <TTSCacheStatsPanel />

      <HostMomentsPanel />







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
      <div className="mb-1 text-xs font-bold uppercase tracking-[0.3em] text-amber-700">
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

// ─── Welcome intro preview ────────────────────────────────────────

function WelcomePreview() {
  const previewFn = useServerFn(previewAnnouncerLine);
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>([...WELCOME_LINES]);
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);

  async function handlePreview(i: number) {
    setLoadingIdx(i);
    try {
      const res = await previewFn({ data: { text: lines[i] } });
      const audio = new Audio(`data:audio/mpeg;base64,${res.audioBase64}`);
      audio.volume = 0.95;
      await audio.play();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoadingIdx(null);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-amber-700">
            Audition
          </div>
          <div className="text-sm font-bold">
            Welcome intros ({lines.length}) — preview before generating
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {open ? "Hide ▲" : "Show ▼"}
        </span>
      </button>
      {open && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            Tweak any line and hit ▶ to hear it with The Elf voice. Edits here
            are scratch — to bake the final pool into storage, edit{" "}
            <code className="rounded bg-muted px-1">WELCOME_LINES</code> in{" "}
            <code className="rounded bg-muted px-1">
              src/lib/announcer.functions.ts
            </code>{" "}
            then click Generate.
          </p>
          {lines.map((text, i) => (
            <div
              key={i}
              className="grid items-start gap-2 sm:grid-cols-[auto_1fr_auto]"
            >
              <div className="pt-2 text-xs font-mono text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </div>
              <textarea
                value={text}
                onChange={(e) =>
                  setLines((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value;
                    return next;
                  })
                }
                rows={2}
                className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handlePreview(i)}
                disabled={loadingIdx !== null}
                className="rounded-full bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingIdx === i ? "…" : "▶ Preview"}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines([...WELCOME_LINES])}
            className="mt-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}


function QuestionVoiceoversPanel() {
  const bakeAllFn = useServerFn(bakeAllQuestionTTS);
  const statsFn = useServerFn(getQuestionTTSStats);
  const [stats, setStats] = useState<{ total: number; baked: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await statsFn();
      setStats(s);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [statsFn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runBake(force: boolean) {
    const verb = force ? "Re-bake ALL" : "Bake all missing";
    if (
      !window.confirm(
        `${verb} question voiceovers? Calls ElevenLabs once per question (~80 chars each). Runs automatically in batches until done — leave this tab open.`,
      )
    )
      return;
    setRunning(true);
    const remaining = stats
      ? force
        ? stats.total
        : Math.max(0, stats.total - stats.baked)
      : 0;
    setProgress(`Narrating questions… 0 / ${remaining}`);
    const toastId = toast.loading(`Narrating questions… 0 / ${remaining}`);
    let totalBaked = 0;
    let totalErrors = 0;
    let safety = 0;
    try {
      while (safety++ < 200) {
        const r = await bakeAllFn({ data: { force, limit: 25 } });
        totalBaked += r.baked;
        totalErrors += r.errors.length;
        const msg = `Narrating questions… ${totalBaked} / ${remaining}${totalErrors ? ` · ${totalErrors} errors` : ""}`;
        toast.loading(msg, { id: toastId });
        setProgress(msg);
        if (r.total === 0 || r.baked === 0) break;
      }
      toast.success(
        `Done! Baked ${totalBaked} question voiceover${totalBaked === 1 ? "" : "s"}${totalErrors ? ` · ${totalErrors} errors` : ""}.`,
        { id: toastId },
      );
      setProgress(null);
    } catch (err) {
      toast.error((err as Error).message, { id: toastId });
      setProgress(null);
    } finally {
      setRunning(false);
      await refresh();
    }
  }

  const pct = stats && stats.total > 0 ? Math.round((stats.baked / stats.total) * 100) : 0;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-amber-700">
            Question voiceovers
          </div>
          <h3 className="text-lg font-bold">The Elf reads every question</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre-bakes a TTS clip per question. Plays instantly on reveal — buzzer
            stays unlocked.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tabular-nums">
            {stats ? `${stats.baked} / ${stats.total}` : "…"}
          </div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {pct}% baked
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void runBake(false)}
          disabled={running}
          className="rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2 text-sm font-bold text-black shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? "Baking…" : "🎤 Bake all missing questions"}
        </button>
        <button
          type="button"
          onClick={() => void runBake(true)}
          disabled={running}
          className="rounded-full border border-border px-4 py-2 text-sm font-bold transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-60"
        >
          Re-bake ALL (overwrite)
        </button>
      </div>
      {progress && (
        <p className="mt-3 text-xs text-muted-foreground">{progress}</p>
      )}
    </div>
  );
}

function ExplanationVoiceoversPanel() {
  const statsFn = useServerFn(getExplanationTTSStats);
  const bakeFn = useServerFn(bakeAllExplanationTTS);
  const [stats, setStats] = useState<{ total: number; baked: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStats(await statsFn());
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [statsFn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run() {
    setRunning(true);
    const remaining = stats ? Math.max(0, stats.total - stats.baked) : 0;
    setProgress(`Narrating… 0 / ${remaining}`);
    const toastId = toast.loading(`Narrating "Did you know?"… 0 / ${remaining}`);
    let totalBaked = 0;
    let totalErrors = 0;
    let safety = 0;
    try {
      while (safety++ < 100) {
        const r = await bakeFn({ data: { limit: 25 } });
        totalBaked += r.baked;
        totalErrors += r.errors.length;
        const msg = `Narrating "Did you know?"… ${totalBaked} / ${remaining}${totalErrors ? ` · ${totalErrors} errors` : ""}`;
        toast.loading(msg, { id: toastId });
        setProgress(msg);
        if (r.total === 0 || r.baked === 0) break;
      }
      toast.success(
        `Done! Narrated ${totalBaked} explanation${totalBaked === 1 ? "" : "s"}${totalErrors ? ` · ${totalErrors} errors` : ""}.`,
        { id: toastId },
      );
      setProgress(null);
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
      setProgress(null);
    } finally {
      setRunning(false);
      await refresh();
    }
  }

  const remaining = stats ? Math.max(0, stats.total - stats.baked) : null;
  const pct = stats && stats.total > 0 ? Math.round((stats.baked / stats.total) * 100) : 0;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-violet-300/80">
            Explanation voiceovers
          </div>
          <h3 className="text-lg font-bold">The Elf reads every "Did you know?"</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats === null
              ? "Checking how many explanations still need narration…"
              : remaining === 0
                ? `All ${stats.baked} explanations are narrated.`
                : `${remaining} still need baking — one-time cost, cached forever.`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tabular-nums">
            {stats ? `${stats.baked} / ${stats.total}` : "…"}
          </div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {pct}% baked
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void run()}
          disabled={running || remaining === null || remaining === 0}
          className="rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 px-4 py-2 text-sm font-bold text-black shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? "Narrating…" : "💡 Bake missing explanations"}
        </button>
      </div>
      {progress && <p className="mt-3 text-xs text-muted-foreground">{progress}</p>}
    </div>
  );
}

function TTSCacheStatsPanel() {
  const statsFn = useServerFn(getTTSCacheStats);
  const [stats, setStats] = useState<{
    total: number;
    totalHits: number;
    cap: number;
    top: { text: string; preset: string; hit_count: number; last_used_at: string }[];
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await statsFn();
      setStats(s);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [statsFn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savedCalls = stats?.totalHits ?? 0;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-amber-700">
            Dynamic line cache
          </div>
          <h3 className="text-lg font-bold">ElevenLabs cost insurance</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Every dynamic Vox line (roasts, narration) is cached server-side
            after the first call. A per-game cap of{" "}
            <span className="font-bold text-foreground">{stats?.cap ?? "…"}</span>{" "}
            live ElevenLabs calls acts as a circuit breaker. Override with the{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">TTS_CAP_PER_GAME</code>{" "}
            secret.

          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tabular-nums">{stats?.total ?? "…"}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            cached lines
          </div>
          <div className="mt-2 text-sm font-bold tabular-nums text-emerald-300">
            {savedCalls.toLocaleString()} free replays
          </div>
        </div>
      </div>

      {stats && stats.top.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Top 10 most-replayed lines
          </div>
          <ul className="space-y-1 text-sm">
            {stats.top.map((row, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
              >
                <span className="min-w-[2.5rem] text-right font-mono text-xs tabular-nums text-emerald-300">
                  ×{row.hit_count}
                </span>
                <span className="flex-1 truncate" title={row.text}>
                  {row.text}
                </span>
                <span className="text-xs uppercase text-muted-foreground">
                  {row.preset}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-full border border-border px-4 py-1.5 text-xs font-bold transition hover:bg-card"
        >
          Refresh stats
        </button>
      </div>
    </div>
  );
}

// ─── Host moments (Vox) ───────────────────────────────────────────

function HostMomentsPanel() {
  const previewFn = useServerFn(previewAnnouncerLine);
  const [open, setOpen] = useState(false);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  async function handlePreview(m: HostMomentMeta) {
    setLoadingKey(m.key);
    try {
      const res = await previewFn({ data: { text: m.sampleText } });
      const audio = new Audio(`data:audio/mpeg;base64,${res.audioBase64}`);
      audio.volume = 0.95;
      await audio.play();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-amber-700">
            Host moments
          </div>
          <div className="text-sm font-bold">
            Vox reactions ({HOST_MOMENTS.length}) — every moment the host calls out
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {open ? "Hide ▲" : "Show ▼"}
        </span>
      </button>
      {open && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            <span className="font-bold text-amber-700">Baked</span> = static
            catchphrases (free, cached forever).{" "}
            <span className="font-bold text-pink-300/80">Live</span> = generated
            per game with the player's nickname (Tier 1 budget). Preview plays
            the sample line with the real ElevenLabs voice.
          </p>
          <div className="grid gap-2">
            {HOST_MOMENTS.map((m) => {
              const baked = bakedCount(m);
              const live = m.liveCount ?? 0;
              return (
                <div
                  key={m.key}
                  className="grid items-start gap-3 rounded-xl border border-border bg-background/40 p-3 sm:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-bold">{m.label}</div>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {m.key}
                      </code>
                      {(m.tier === "baked" || m.tier === "both") && (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                          {baked} baked
                        </span>
                      )}
                      {(m.tier === "live" || m.tier === "both") && (
                        <span className="rounded-full bg-pink-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-200">
                          {live} live
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {m.description}
                    </div>
                    <div className="mt-1 text-xs italic text-foreground/70">
                      “{m.sampleText}”
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handlePreview(m)}
                    disabled={loadingKey !== null}
                    className="self-center rounded-full bg-amber-400 px-4 py-2 text-xs font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingKey === m.key ? "…" : "▶ Preview"}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            To edit baked lines: <code className="rounded bg-muted px-1">src/lib/host-persona.ts</code> →{" "}
            <code className="rounded bg-muted px-1">LINES</code>. To edit live templates:{" "}
            <code className="rounded bg-muted px-1">src/lib/persona-live.ts</code> →{" "}
            <code className="rounded bg-muted px-1">TEMPLATES</code>.
          </p>
        </div>
      )}
    </div>
  );
}
