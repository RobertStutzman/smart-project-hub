import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Papa from "papaparse";
import {
  backfillExplanations,
  bulkInsertQuestions,
  checkIsAdmin,
  countDuplicateAnswers,
  countMissingExplanations,
  deleteQuestion,
  generateQuestionImage,
  generateQuestionVoice,
  generateQuestions,
  listQuestions,
  repairDuplicateAnswers,
  signQuestionMedia,
  upsertQuestion,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/categories";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Beat the Drop Trivia" },
      { name: "description", content: "Manage trivia questions, bulk import, and AI generation." },
    ],
  }),
  component: AdminPage,
});

type Difficulty = "easy" | "medium" | "hard" | "impossible";

type Question = {
  id: string;
  category: string;
  subcategory: string | null;
  question_text: string;
  correct_answer: string;
  wrong_1: string;
  wrong_2: string;
  wrong_3: string;
  media_url: string | null;
  media_type: string | null;
  is_premium: boolean;
  difficulty: Difficulty;
  created_at: string;
};

type DraftQuestion = Omit<Question, "id" | "created_at"> & { id?: string };

const EMPTY_DRAFT: DraftQuestion = {
  category: "Music",
  subcategory: null,
  question_text: "",
  correct_answer: "",
  wrong_1: "",
  wrong_2: "",
  wrong_3: "",
  media_url: null,
  media_type: null,
  is_premium: false,
  difficulty: "medium",
};

function AdminPage() {
  const navigate = useNavigate();
  const checkAdminFn = useServerFn(checkIsAdmin);
  const listFn = useServerFn(listQuestions);
  const upsertFn = useServerFn(upsertQuestion);
  const deleteFn = useServerFn(deleteQuestion);
  const bulkFn = useServerFn(bulkInsertQuestions);
  const generateFn = useServerFn(generateQuestions);

  const [authState, setAuthState] = useState<"checking" | "ok" | "denied">("checking");
  const [items, setItems] = useState<Question[]>([]);
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editing, setEditing] = useState<DraftQuestion | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await checkAdminFn();
        if (!res.isAdmin) {
          setAuthState("denied");
          return;
        }
        setAuthState("ok");
        await reload();
      } catch (e) {
        toast.error((e as Error).message);
        setAuthState("denied");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reload() {
    const { questions } = await listFn();
    setItems(questions as Question[]);
  }

  async function handleSave(q: DraftQuestion) {
    setWorking(true);
    try {
      await upsertFn({
        data: {
          id: q.id,
          q: {
            category: q.category,
            subcategory: q.subcategory,
            question_text: q.question_text,
            correct_answer: q.correct_answer,
            wrong_1: q.wrong_1,
            wrong_2: q.wrong_2,
            wrong_3: q.wrong_3,
            media_url: q.media_url,
            media_type: q.media_type,
            is_premium: q.is_premium,
            difficulty: q.difficulty,
          },
        },
      });
      toast.success(q.id ? "Question updated" : "Question created");
      setEditing(null);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this question?")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Deleted");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const filtered = useMemo(() => {
    return items.filter((q) => {
      if (categoryFilter !== "all" && q.category !== categoryFilter) return false;
      if (filter && !q.question_text.toLowerCase().includes(filter.toLowerCase())) return false;
      return true;
    });
  }, [items, filter, categoryFilter]);

  if (authState === "checking") {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Checking access…
      </main>
    );
  }

  if (authState === "denied") {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md rounded-3xl border border-border bg-card/60 p-8 text-center backdrop-blur">
          <h1 className="text-2xl font-bold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account doesn't have the <span className="font-mono">admin</span> role.
            Ask the project owner to grant it in the database (insert into{" "}
            <span className="font-mono">user_roles</span>).
          </p>
          <button
            onClick={handleSignOut}
            className="mt-6 inline-flex items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-semibold"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 p-6 lg:p-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Admin</div>
            <h1 className="mt-1 text-4xl font-bold">Question Library</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/sounds"
              className="rounded-full border border-border px-4 py-2 text-sm hover:bg-card/60"
            >
              Sounds
            </Link>
            <Link
              to="/host"
              className="rounded-full border border-border px-4 py-2 text-sm hover:bg-card/60"
            >
              Host view
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-full border border-border px-4 py-2 text-sm hover:bg-card/60"
            >
              Sign out
            </button>
          </div>
        </header>

        <AIGenerator generate={generateFn} bulkInsert={bulkFn} onInserted={reload} />

        <ExplanationBackfill onUpdated={reload} />

        <DuplicateAnswersRepair onUpdated={reload} />

        <CsvDropzone bulkInsert={bulkFn} onInserted={reload} />

        <section className="rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">All questions ({items.length})</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-full border border-border bg-background/60 px-3 py-2 text-sm"
              >
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Search…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-full border border-border bg-background/60 px-4 py-2 text-sm"
              />
              <button
                onClick={() => setEditing({ ...EMPTY_DRAFT })}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                + New question
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Question</th>
                  <th className="px-3 py-2">Correct</th>
                  <th className="px-3 py-2">Diff.</th>
                  <th className="px-3 py-2">Premium</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q) => (
                  <tr key={q.id} className="border-t border-border/60">
                    <td className="px-3 py-2 align-top">{q.category}</td>
                    <td className="px-3 py-2 align-top">{q.question_text}</td>
                    <td className="px-3 py-2 align-top font-medium">{q.correct_answer}</td>
                    <td className="px-3 py-2 align-top">
                      <DifficultyBadge value={q.difficulty} />
                    </td>
                    <td className="px-3 py-2 align-top">{q.is_premium ? "★" : ""}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditing({ ...q })}
                          className="rounded-full border border-border px-3 py-1 text-xs hover:bg-background/60"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="rounded-full border border-destructive/50 px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                      No questions match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editing && (
        <QuestionEditor
          draft={editing}
          busy={working}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </main>
  );
}

function QuestionEditor({
  draft,
  busy,
  onClose,
  onSave,
}: {
  draft: DraftQuestion;
  busy: boolean;
  onClose: () => void;
  onSave: (q: DraftQuestion) => void;
}) {
  const [q, setQ] = useState<DraftQuestion>(draft);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl border border-border bg-card p-6"
      >
        <h3 className="text-xl font-bold">{q.id ? "Edit question" : "New question"}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select
            value={q.category}
            onChange={(e) => setQ({ ...q, category: e.target.value })}
            className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
          <input
            placeholder="Subcategory (optional)"
            value={q.subcategory ?? ""}
            onChange={(e) => setQ({ ...q, subcategory: e.target.value || null })}
            className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Question text"
            value={q.question_text}
            onChange={(e) => setQ({ ...q, question_text: e.target.value })}
            className="sm:col-span-2 min-h-[80px] rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
          />
          <input
            placeholder="Correct answer"
            value={q.correct_answer}
            onChange={(e) => setQ({ ...q, correct_answer: e.target.value })}
            className="sm:col-span-2 rounded-xl border-2 border-primary/50 bg-background/60 px-3 py-2 text-sm"
          />
          <input
            placeholder="Wrong answer 1"
            value={q.wrong_1}
            onChange={(e) => setQ({ ...q, wrong_1: e.target.value })}
            className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
          />
          <input
            placeholder="Wrong answer 2"
            value={q.wrong_2}
            onChange={(e) => setQ({ ...q, wrong_2: e.target.value })}
            className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
          />
          <input
            placeholder="Wrong answer 3"
            value={q.wrong_3}
            onChange={(e) => setQ({ ...q, wrong_3: e.target.value })}
            className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
          />
          <select
            value={q.difficulty}
            onChange={(e) => setQ({ ...q, difficulty: e.target.value as Difficulty })}
            className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="impossible">Impossible</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={q.is_premium}
              onChange={(e) => setQ({ ...q, is_premium: e.target.checked })}
            />
            Premium
          </label>
        </div>
        <MediaEditor q={q} setQ={setQ} />
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={() => onSave(q)}
            disabled={busy}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DifficultyBadge({ value }: { value: Difficulty }) {
  const styles: Record<Difficulty, string> = {
    easy: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
    medium: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
    hard: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
    impossible: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ring-1 ${styles[value]}`}
    >
      {value}
    </span>
  );
}

function CsvDropzone({
  bulkInsert,
  onInserted,
}: {
  bulkInsert: ReturnType<typeof useServerFn<typeof bulkInsertQuestions>>;
  onInserted: () => Promise<void>;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.errors.length) toast.warning(`CSV parsed with ${res.errors.length} warnings`);
        setPreview(res.data);
      },
      error: (err) => toast.error(err.message),
    });
  }

  async function insert() {
    if (!preview) return;
    setBusy(true);
    try {
      const rows = preview.map((r) => ({
        category: r.category?.trim() ?? "",
        subcategory: r.subcategory?.trim() || null,
        question_text: r.question_text?.trim() ?? "",
        correct_answer: r.correct_answer?.trim() ?? "",
        wrong_1: r.wrong_1?.trim() ?? "",
        wrong_2: r.wrong_2?.trim() ?? "",
        wrong_3: r.wrong_3?.trim() ?? "",
        media_url: r.media_url?.trim() || null,
        media_type: r.media_type?.trim() || null,
        is_premium: String(r.is_premium ?? "false").toLowerCase() === "true",
      }));
      const res = await bulkInsert({ data: { rows } });
      toast.success(`Imported ${res.inserted} questions`);
      setPreview(null);
      await onInserted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`rounded-3xl border-2 border-dashed p-6 backdrop-blur transition ${
        dragOver ? "border-primary bg-primary/10" : "border-border bg-card/30"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">CSV Bulk Import</h2>
          <p className="text-sm text-muted-foreground">
            Drag a CSV with headers:{" "}
            <span className="font-mono text-xs">
              category, subcategory, question_text, correct_answer, wrong_1, wrong_2, wrong_3, media_url, media_type, is_premium
            </span>
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded-full border border-border px-4 py-2 text-sm"
        >
          Browse…
        </button>
      </div>

      {preview && (
        <div className="mt-4">
          <div className="text-sm text-muted-foreground">
            Preview ({preview.length} rows, first 5 shown):
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {preview.slice(0, 5).map((r, i) => (
              <li key={i} className="truncate rounded-md bg-background/40 px-2 py-1">
                <span className="font-mono text-muted-foreground">[{r.category}]</span>{" "}
                {r.question_text} → <strong>{r.correct_answer}</strong>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              onClick={insert}
              disabled={busy}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Importing…" : `Import ${preview.length} questions`}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="rounded-full border border-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function AIGenerator({
  generate,
  bulkInsert,
  onInserted,
}: {
  generate: ReturnType<typeof useServerFn<typeof generateQuestions>>;
  bulkInsert: ReturnType<typeof useServerFn<typeof bulkInsertQuestions>>;
  onInserted: () => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("10 hard 80s rock questions");
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [count, setCount] = useState(10);
  const [isPremium, setIsPremium] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "impossible" | "mixed">("mixed");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [preview, setPreview] = useState<
    Array<{
      question_text: string;
      correct_answer: string;
      wrong_1: string;
      wrong_2: string;
      wrong_3: string;
      explanation?: string;
      difficulty: Difficulty;
      category: string;
      is_premium: boolean;
    }>
  | null>(null);

  const BATCH = 50;

  async function run() {
    setBusy(true);
    setPreview(null);
    try {
      if (count <= BATCH) {
        const res = await generate({
          data: { prompt, category, count, isPremium, difficulty },
        });
        setPreview(res.questions);
      } else {
        // Batched mode: generate + auto-insert in chunks of BATCH
        let totalInserted = 0;
        const total = count;
        setProgress({ done: 0, total });
        let remaining = total;
        while (remaining > 0) {
          const batchSize = Math.min(BATCH, remaining);
          const res = await generate({
            data: { prompt, category, count: batchSize, isPremium, difficulty },
          });
          const rows = res.questions.map((q) => ({
            category: q.category,
            subcategory: null,
            question_text: q.question_text,
            correct_answer: q.correct_answer,
            wrong_1: q.wrong_1,
            wrong_2: q.wrong_2,
            wrong_3: q.wrong_3,
            explanation: q.explanation ?? null,
            difficulty: q.difficulty,
            media_url: null,
            media_type: null,
            is_premium: q.is_premium,
          }));
          const ins = await bulkInsert({ data: { rows } });
          totalInserted += ins.inserted;
          remaining -= batchSize;
          setProgress({ done: total - remaining, total });
        }
        toast.success(`Inserted ${totalInserted} AI questions`);
        await onInserted();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function insertAll() {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await bulkInsert({
        data: {
          rows: preview.map((q) => ({
            category: q.category,
            subcategory: null,
            question_text: q.question_text,
            correct_answer: q.correct_answer,
            wrong_1: q.wrong_1,
            wrong_2: q.wrong_2,
            wrong_3: q.wrong_3,
            explanation: q.explanation ?? null,
            difficulty: q.difficulty,
            media_url: null,
            media_type: null,
            is_premium: q.is_premium,
          })),
        },
      });
      toast.success(`Inserted ${res.inserted} AI questions`);
      setPreview(null);
      await onInserted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">AI Question Generator</h2>
          <p className="text-sm text-muted-foreground">
            Up to 50 = preview & review. More = auto-batched & inserted (max 10,000).
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. 10 hard 80s rock questions"
          className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
          className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
          title="Difficulty"
        >
          <option value="mixed">Mixed</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
          <option value="impossible">Impossible</option>
        </select>
        <input
          type="number"
          min={1}
          max={10000}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))}
          className="w-24 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
        />
        <button
          onClick={run}
          disabled={busy}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {busy
            ? progress
              ? `Generating ${progress.done}/${progress.total}…`
              : "Generating…"
            : "Generate"}
        </button>
      </div>
      <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={isPremium}
          onChange={(e) => setIsPremium(e.target.checked)}
        />
        Mark as premium
      </label>

      {preview && (
        <div className="mt-4">
          <ul className="space-y-2 text-sm">
            {preview.map((q, i) => (
              <li key={i} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{q.question_text}</div>
                  <DifficultyBadge value={q.difficulty} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  ✓ {q.correct_answer} &nbsp;·&nbsp; ✗ {q.wrong_1} / {q.wrong_2} / {q.wrong_3}
                </div>
                {q.explanation && (
                  <div className="mt-1 text-xs italic text-amber-300/80">💡 {q.explanation}</div>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              onClick={insertAll}
              disabled={busy}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Inserting…" : `Insert all (${preview.length})`}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="rounded-full border border-border px-4 py-2 text-sm"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ExplanationBackfill({ onUpdated }: { onUpdated: () => Promise<void> | void }) {
  const countFn = useServerFn(countMissingExplanations);
  const backfillFn = useServerFn(backfillExplanations);
  const [missing, setMissing] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ updated: 0, total: 0 });

  useEffect(() => {
    void (async () => {
      try {
        const { missing } = await countFn();
        setMissing(missing);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    try {
      const { missing } = await countFn();
      setMissing(missing);
    } catch {
      /* ignore */
    }
  }

  async function run() {
    setRunning(true);
    const initial = missing ?? 0;
    setProgress({ updated: 0, total: initial });
    const toastId = toast.loading(`Backfilling explanations… 0 / ${initial}`);
    let totalUpdated = 0;
    let safetyCounter = 0;
    try {
      while (safetyCounter++ < 200) {
        const res = await backfillFn({ data: { batchSize: 15 } });
        totalUpdated += res.updated;
        setProgress({ updated: totalUpdated, total: initial });
        toast.loading(
          `Backfilling explanations… ${totalUpdated} / ${initial}`,
          { id: toastId },
        );
        if (res.done || res.processed === 0) break;
      }
      toast.success(`Done! Added ${totalUpdated} explanations.`, { id: toastId });
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
    } finally {
      setRunning(false);
      await refresh();
      await onUpdated();
    }
  }

  return (
    <section className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">💡 "Did you know?" backfill</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {missing === null
              ? "Checking how many questions still need an explanation…"
              : missing === 0
                ? "Every question already has an explanation. New questions auto-generate one."
                : `${missing} question${missing === 1 ? "" : "s"} still missing an explanation. Run once — explanations are stored in the database, so games never call AI.`}
          </p>
          {running && progress.total > 0 && (
            <div className="mt-2 text-xs text-amber-300">
              Updated {progress.updated} / {progress.total}…
            </div>
          )}
        </div>
        <button
          onClick={run}
          disabled={running || missing === null || missing === 0}
          className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-amber-950 disabled:opacity-50"
        >
          {running ? "Generating…" : "Backfill explanations"}
        </button>
      </div>
    </section>
  );
}

function DuplicateAnswersRepair({ onUpdated }: { onUpdated: () => Promise<void> | void }) {
  const countFn = useServerFn(countDuplicateAnswers);
  const repairFn = useServerFn(repairDuplicateAnswers);
  const [dupes, setDupes] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ updated: 0, total: 0 });

  useEffect(() => {
    void (async () => {
      try {
        const { duplicates } = await countFn();
        setDupes(duplicates);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    try {
      const { duplicates } = await countFn();
      setDupes(duplicates);
    } catch {
      /* ignore */
    }
  }

  async function run() {
    setRunning(true);
    const initial = dupes ?? 0;
    setProgress({ updated: 0, total: initial });
    const toastId = toast.loading(`Repairing duplicate answers… 0 / ${initial}`);
    let totalUpdated = 0;
    let safetyCounter = 0;
    try {
      while (safetyCounter++ < 200) {
        const res = await repairFn({ data: { batchSize: 10 } });
        totalUpdated += res.updated;
        setProgress({ updated: totalUpdated, total: initial });
        toast.loading(
          `Repairing duplicate answers… ${totalUpdated} / ${initial}`,
          { id: toastId },
        );
        if (res.done || res.processed === 0) break;
      }
      toast.success(`Done! Repaired ${totalUpdated} question${totalUpdated === 1 ? "" : "s"}.`, { id: toastId });
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
    } finally {
      setRunning(false);
      await refresh();
      await onUpdated();
    }
  }

  if (dupes === 0) return null;

  return (
    <section className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">🛠️ Repair duplicate answers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dupes === null
              ? "Checking for questions with duplicate answer options…"
              : `${dupes} question${dupes === 1 ? "" : "s"} have a wrong answer that matches the correct one (or another wrong). AI will rewrite the wrong options so all four are distinct.`}
          </p>
          {running && progress.total > 0 && (
            <div className="mt-2 text-xs text-rose-300">
              Repaired {progress.updated} / {progress.total}…
            </div>
          )}
        </div>
        <button
          onClick={run}
          disabled={running || dupes === null || dupes === 0}
          className="rounded-full bg-rose-500 px-5 py-2 text-sm font-semibold text-rose-950 disabled:opacity-50"
        >
          {running ? "Repairing…" : "Repair duplicates"}
        </button>
      </div>
    </section>
  );
}

const VOICES = [
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda" },
  { id: "MDLAMJ0jxkpYkjXbmG4t", name: "Santa" },
  { id: "kPtEHAvRnjUJFv7SK9WI", name: "Glitch" },
] as const;

function MediaEditor({
  q,
  setQ,
}: {
  q: DraftQuestion;
  setQ: (next: DraftQuestion) => void;
}) {
  const genImg = useServerFn(generateQuestionImage);
  const genVoice = useServerFn(generateQuestionVoice);
  const signFn = useServerFn(signQuestionMedia);
  const [busy, setBusy] = useState(false);
  const [imgPrompt, setImgPrompt] = useState("");
  const [voiceText, setVoiceText] = useState("");
  const [voiceId, setVoiceId] = useState<string>(VOICES[0].id);
  const [audioSource, setAudioSource] = useState<"upload" | "ai">("upload");
  const [imageSource, setImageSource] = useState<"upload" | "ai">("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const type = (q.media_type ?? "none") as "none" | "image" | "audio" | "video";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setPreviewUrl(null);
      if (!q.media_url) return;
      if (/^https?:\/\//i.test(q.media_url)) {
        setPreviewUrl(q.media_url);
        return;
      }
      try {
        const res = await signFn({ data: { path: q.media_url } });
        if (!cancelled) setPreviewUrl(res.signedUrl);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q.media_url, signFn]);

  async function handleGenerate() {
    if (!imgPrompt.trim()) {
      toast.error("Describe the image first");
      return;
    }
    setBusy(true);
    try {
      const res = await genImg({ data: { prompt: imgPrompt.trim() } });
      setQ({ ...q, media_url: res.path, media_type: "image" });
      setPreviewUrl(res.signedUrl);
      toast.success("Image generated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateVoice() {
    if (!voiceText.trim()) {
      toast.error("Enter the line to speak");
      return;
    }
    setBusy(true);
    try {
      const res = await genVoice({ data: { text: voiceText.trim(), voiceId } });
      setQ({ ...q, media_url: res.path, media_type: "audio" });
      setPreviewUrl(res.signedUrl);
      toast.success("Voice clip generated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAudioUpload(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Audio must be under 15 MB");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
      const path = `audio/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("question-media")
        .upload(path, file, { contentType: file.type || "audio/mpeg", upsert: false });
      if (error) throw error;
      setQ({ ...q, media_url: path, media_type: "audio" });
      const res = await signFn({ data: { path } });
      setPreviewUrl(res.signedUrl);
      toast.success("Audio uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("That's not an image");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `image/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("question-media")
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
      if (error) throw error;
      setQ({ ...q, media_url: path, media_type: "image" });
      const res = await signFn({ data: { path } });
      setPreviewUrl(res.signedUrl);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }


  async function handleVideoUpload(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Video must be under 25 MB");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `video/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("question-media")
        .upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
      if (error) throw error;
      setQ({ ...q, media_url: path, media_type: "video" });
      const res = await signFn({ data: { path } });
      setPreviewUrl(res.signedUrl);
      toast.success("Video uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-bold">Media</div>
        <select
          value={type}
          onChange={(e) => {
            const v = e.target.value as "none" | "image" | "audio" | "video";
            if (v === "none") setQ({ ...q, media_url: null, media_type: null });
            else setQ({ ...q, media_type: v });
          }}
          className="rounded-xl border border-border bg-background/60 px-3 py-1.5 text-sm"
        >
          <option value="none">None</option>
          <option value="image">Image</option>
          <option value="audio">Audio</option>
          <option value="video">Video</option>
        </select>
      </div>

      {type === "image" && (
        <div className="mt-3 space-y-2">
          <textarea
            value={imgPrompt}
            onChange={(e) => setImgPrompt(e.target.value)}
            placeholder="Describe the image (e.g. 'a close-up of a vintage Fender Stratocaster on a stage')"
            className="min-h-[60px] w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
            >
              {busy ? "Working…" : previewUrl ? "Regenerate" : "Generate image"}
            </button>
            {previewUrl && (
              <button
                type="button"
                onClick={() => {
                  setQ({ ...q, media_url: null, media_type: null });
                  setPreviewUrl(null);
                }}
                className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              className="mt-2 max-h-64 rounded-xl border border-border object-contain"
            />
          )}
        </div>
      )}

      {type === "audio" && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAudioSource("upload")}
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${
                audioSource === "upload"
                  ? "bg-accent text-accent-foreground"
                  : "bg-background/60 text-muted-foreground"
              }`}
            >
              Upload file
            </button>
            <button
              type="button"
              onClick={() => setAudioSource("ai")}
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${
                audioSource === "ai"
                  ? "bg-accent text-accent-foreground"
                  : "bg-background/60 text-muted-foreground"
              }`}
            >
              AI voice
            </button>
          </div>

          {audioSource === "upload" ? (
            <>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleAudioUpload(f);
                }}
                className="block w-full text-sm"
              />
              <p className="text-xs text-muted-foreground">
                MP3/M4A/WAV under 15 MB. The host TV will auto-play the clip once when the round starts.
              </p>
            </>
          ) : (
            <>
              <textarea
                value={voiceText}
                onChange={(e) => setVoiceText(e.target.value)}
                placeholder="Line to speak (e.g. 'I'll be back.')"
                maxLength={500}
                className="min-h-[60px] w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  className="rounded-xl border border-border bg-background/60 px-3 py-1.5 text-sm"
                >
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleGenerateVoice}
                  disabled={busy}
                  className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                >
                  {busy ? "Working…" : previewUrl ? "Regenerate voice" : "Generate voice"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                AI-generated impression. Not the real person.
              </p>
            </>
          )}

          {previewUrl && (
            <div className="space-y-2">
              <audio src={previewUrl} controls className="w-full" />
              <button
                type="button"
                onClick={() => {
                  setQ({ ...q, media_url: null, media_type: null });
                  setPreviewUrl(null);
                }}
                className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {type === "video" && (
        <div className="mt-3 space-y-2">
          <input
            type="file"
            accept="video/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleVideoUpload(f);
            }}
            className="block w-full text-sm"
          />
          {previewUrl && (
            <div className="space-y-2">
              <video
                src={previewUrl}
                controls
                className="mt-2 max-h-64 w-full rounded-xl border border-border object-contain"
              />
              <button
                type="button"
                onClick={() => {
                  setQ({ ...q, media_url: null, media_type: null });
                  setPreviewUrl(null);
                }}
                className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            MP4/WebM/MOV under 25 MB. The host TV will auto-play the clip once when the round starts.
          </p>
        </div>
      )}
    </div>
  );
}
