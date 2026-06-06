import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteSoundClip,
  listSoundClips,
  registerSoundClip,
  setActiveClip,
  type SoundClip,
} from "@/lib/sounds.functions";
import { signQuestionMedia } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/sounds")({
  component: SoundsPage,
});

type Slot = "lobby_loop" | "round_intro";

const SLOTS: { key: Slot; title: string; blurb: string; accept: string }[] = [
  {
    key: "lobby_loop",
    title: "Lobby loop",
    blurb:
      "Plays on a loop while players are joining the room. Lower volume background music works best.",
    accept: "audio/*",
  },
  {
    key: "round_intro",
    title: "Round intro sting",
    blurb:
      "Fires once when each new round's first question starts. Keep it to ~2–4 seconds.",
    accept: "audio/*",
  },
];

function SoundsPage() {
  const listFn = useServerFn(listSoundClips);
  const [clips, setClips] = useState<SoundClip[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      const res = await listFn();
      setClips(res.clips);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Admin
            </div>
            <h1 className="mt-1 text-4xl font-bold">Soundboard</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Upload music clips for the host TV. Only one clip per slot is
              active at a time.
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
          <div className="space-y-8">
            {SLOTS.map((s) => (
              <SlotSection
                key={s.key}
                slot={s.key}
                title={s.title}
                blurb={s.blurb}
                accept={s.accept}
                clips={clips.filter((c) => c.slot === s.key)}
                onChange={reload}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SlotSection({
  slot,
  title,
  blurb,
  accept,
  clips,
  onChange,
}: {
  slot: Slot;
  title: string;
  blurb: string;
  accept: string;
  clips: SoundClip[];
  onChange: () => void | Promise<void>;
}) {
  const registerFn = useServerFn(registerSoundClip);
  const setActiveFn = useServerFn(setActiveClip);
  const deleteFn = useServerFn(deleteSoundClip);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");

  async function handleUpload(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Audio must be under 15 MB");
      return;
    }
    if (!label.trim()) {
      toast.error("Add a label first");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
      const path = `sounds/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("question-media")
        .upload(path, file, {
          contentType: file.type || "audio/mpeg",
          upsert: false,
        });
      if (error) throw error;
      await registerFn({
        data: {
          slot,
          label: label.trim(),
          storage_path: path,
          makeActive: true,
        },
      });
      setLabel("");
      toast.success("Uploaded & set active");
      await onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card/30 p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold">{title}</h2>
        <code className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {slot}
        </code>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. 'SNL theme', 'Jeopardy bumper')"
          maxLength={120}
          className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
        />
        <label
          className={`grid cursor-pointer place-items-center rounded-xl border border-border bg-background/60 px-4 py-2 text-sm font-semibold ${
            busy ? "opacity-50" : "hover:bg-card/60"
          }`}
        >
          {busy ? "Uploading…" : "Upload MP3"}
          <input
            type="file"
            accept={accept}
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
            }}
            className="hidden"
          />
        </label>
      </div>

      {clips.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border/60 bg-background/30 px-4 py-6 text-center text-sm text-muted-foreground">
          No clips yet — synthesized fallback plays on the host TV.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {clips.map((c) => (
            <ClipRow
              key={c.id}
              clip={c}
              onSetActive={async () => {
                await setActiveFn({ data: { id: c.id } });
                await onChange();
              }}
              onDelete={async () => {
                if (!confirm(`Delete "${c.label}"?`)) return;
                await deleteFn({ data: { id: c.id } });
                await onChange();
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ClipRow({
  clip,
  onSetActive,
  onDelete,
}: {
  clip: SoundClip;
  onSetActive: () => void;
  onDelete: () => void;
}) {
  const signFn = useServerFn(signQuestionMedia);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await signFn({ data: { path: clip.storage_path } });
        if (!cancelled) setUrl(res.signedUrl);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clip.storage_path, signFn]);

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 ${
        clip.is_active
          ? "border-amber-400/60 bg-amber-400/10"
          : "border-border bg-background/40"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">
          {clip.label}{" "}
          {clip.is_active && (
            <span className="ml-1 rounded-full bg-amber-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-200">
              Active
            </span>
          )}
        </div>
        {url ? (
          <audio src={url} controls className="mt-1 h-8 w-full max-w-md" />
        ) : (
          <div className="text-xs text-muted-foreground">Loading preview…</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!clip.is_active && (
          <button
            onClick={onSetActive}
            className="rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent-foreground"
          >
            Make active
          </button>
        )}
        <button
          onClick={onDelete}
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-rose-400"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
