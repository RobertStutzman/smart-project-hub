import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import Papa from "papaparse";
import {
  backfillExplanations,
  bulkInsertQuestions,
  checkDuplicates,
  checkIsAdmin,
  countDuplicateAnswers,
  countMissingExplanations,
  deleteQuestion,
  deleteQuestionsByIds,
  findSemanticDuplicates,
  generateQuestionImage,
  generateQuestionVoice,
  generateQuestions,
  listQuestions,
  repairDuplicateAnswers,
  signQuestionMedia,
  upsertQuestion,
} from "@/lib/admin.functions";
import { dedupeKey } from "@/lib/dedupe";
import { bakeAllQuestionTTS, bakeAllExplanationTTS } from "@/lib/announcer.functions";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/categories";
import { listCategories } from "@/lib/rooms.functions";
import { CapacityWidget } from "@/components/admin/CapacityWidget";

type CategoryOption = { name: string; count: number };

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
  const [dbCategories, setDbCategories] = useState<CategoryOption[]>([]);
  const [toolTab, setToolTab] = useState<"add" | "maintain" | "health">("add");
  const listCategoriesFn = useServerFn(listCategories);

  const mergedCategories = useMemo<CategoryOption[]>(() => {
    const map = new Map<string, number>();
    for (const c of CATEGORIES) {
      if (c.name === "Mystery Mix") continue;
      map.set(c.name, 0);
    }
    for (const c of dbCategories) map.set(c.name, c.count);
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dbCategories]);

  async function reloadCategories() {
    try {
      const res = await listCategoriesFn();
      setDbCategories(res.categories);
    } catch {
      // ignore
    }
  }

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
    await reloadCategories();
  }

  async function handleSave(q: DraftQuestion) {
    setWorking(true);
    try {
      const cleanCategory = q.category.trim().replace(/\s+/g, " ");
      if (!cleanCategory) {
        toast.error("Category is required");
        setWorking(false);
        return;
      }
      await upsertFn({
        data: {
          id: q.id,
          q: {
            category: cleanCategory,
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
              to="/admin-questions"
              className="rounded-full border border-border px-4 py-2 text-sm hover:bg-card/60"
            >
              Quality
            </Link>
            <Link
              to="/admin-sounds"
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

        <section className="rounded-3xl border border-border bg-card/40 p-2 backdrop-blur">
          <div role="tablist" className="flex flex-wrap gap-1">
            {([
              { id: "add", label: "➕ Add questions" },
              { id: "maintain", label: "🛠️ Maintain" },
              { id: "health", label: "📊 Health" },
            ] as const).map((t) => {
              const active = toolTab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setToolTab(t.id)}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:bg-card/60"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </section>

        {toolTab === "add" && (
          <div className="flex flex-col gap-6">
            <AIGenerator generate={generateFn} bulkInsert={bulkFn} onInserted={reload} categories={mergedCategories} />
            <GeminiImporter bulkInsert={bulkFn} onInserted={reload} />
            <CsvDropzone bulkInsert={bulkFn} onInserted={reload} />
          </div>
        )}

        {toolTab === "maintain" && (
          <div className="flex flex-col gap-6">
            <ExplanationBackfill onUpdated={reload} />
            <DuplicateAnswersRepair onUpdated={reload} />
            <SemanticDupeScanner onUpdated={reload} categories={mergedCategories} />
            <p className="text-xs text-muted-foreground">
              Narrating questions or "Did you know?" lives on the{" "}
              <a href="/admin-sounds" className="font-bold underline">Sounds</a> page.
            </p>
          </div>
        )}

        {toolTab === "health" && (
          <div className="flex flex-col gap-6">
            <CapacityWidget />
          </div>
        )}


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
                {mergedCategories.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}{c.count > 0 ? ` (${c.count})` : ""}
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
          categories={mergedCategories}
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
  categories,
  onClose,
  onSave,
}: {
  draft: DraftQuestion;
  busy: boolean;
  categories: CategoryOption[];
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
          <div className="flex flex-col gap-1">
            <input
              list="admin-category-list"
              value={q.category}
              onChange={(e) => setQ({ ...q, category: e.target.value })}
              placeholder="Category (type new or pick)"
              className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
            />
            <datalist id="admin-category-list">
              {categories.map((c) => (
                <option key={c.name} value={c.name}>{c.count > 0 ? `${c.count} questions` : "new"}</option>
              ))}
            </datalist>
            <span className="px-1 text-[10px] text-muted-foreground">Type a new name to create a category.</span>
          </div>
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
    if (preview.length > 1000) {
      toast.error(`CSV has ${preview.length} rows; max is 1000 per import. Split the file and try again.`);
      return;
    }
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
  categories,
}: {
  generate: ReturnType<typeof useServerFn<typeof generateQuestions>>;
  bulkInsert: ReturnType<typeof useServerFn<typeof bulkInsertQuestions>>;
  onInserted: () => Promise<void>;
  categories: CategoryOption[];
}) {
  const [prompt, setPrompt] = useState("10 hard 80s rock questions");
  const [category, setCategory] = useState(categories[0]?.name ?? CATEGORIES[0].name);
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
        let totalSemanticSkipped = 0;
        const total = count;
        setProgress({ done: 0, total });
        let remaining = total;
        while (remaining > 0) {
          const batchSize = Math.min(BATCH, remaining);
          const res = await generate({
            data: { prompt, category, count: batchSize, isPremium, difficulty },
          });
          totalSemanticSkipped += res.skippedSemanticDupes ?? 0;
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
        toast.success(
          `Inserted ${totalInserted} AI questions${totalSemanticSkipped ? ` · ${totalSemanticSkipped} semantic dupes skipped` : ""}`,
        );
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
        <input
          list="ai-generator-category-list"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
        />
        <datalist id="ai-generator-category-list">
          {categories.map((c) => (
            <option key={c.name} value={c.name}>{c.count > 0 ? `${c.count} questions` : "new"}</option>
          ))}
        </datalist>
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

type DupeItem = { id: string; question_text: string };
type DupeGroup = { category: string; correct_answer: string; items: DupeItem[] };

function SemanticDupeScanner({
  onUpdated,
  categories,
}: {
  onUpdated: () => Promise<void> | void;
  categories: CategoryOption[];
}) {
  const scanFn = useServerFn(findSemanticDuplicates);
  const deleteFn = useServerFn(deleteQuestionsByIds);
  const [scanning, setScanning] = useState(false);
  const [category, setCategory] = useState<string>("__all__");
  const [groups, setGroups] = useState<DupeGroup[] | null>(null);
  // Map of group-index -> id-to-keep
  const [keep, setKeep] = useState<Record<number, string>>({});

  async function scan() {
    setScanning(true);
    setGroups(null);
    setKeep({});
    const toastId = toast.loading(
      category === "__all__"
        ? "Scanning all categories for semantic duplicates…"
        : `Scanning "${category}" for semantic duplicates…`,
    );
    try {
      const res = await scanFn({
        data: category === "__all__" ? {} : { category },
      });
      setGroups(res.groups);
      // Default: keep the longest question text in each group
      const next: Record<number, string> = {};
      res.groups.forEach((g, i) => {
        const longest = g.items.reduce((a, b) =>
          b.question_text.length > a.question_text.length ? b : a,
        );
        next[i] = longest.id;
      });
      setKeep(next);
      toast.success(
        `Scanned ${res.scanned} questions · ${res.bucketsChecked} answer buckets · ${res.groups.length} dupe group${res.groups.length === 1 ? "" : "s"} found`,
        { id: toastId },
      );
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
    } finally {
      setScanning(false);
    }
  }

  async function deleteGroup(idx: number) {
    if (!groups) return;
    const g = groups[idx];
    const keepId = keep[idx];
    const toDelete = g.items.filter((it) => it.id !== keepId).map((it) => it.id);
    if (toDelete.length === 0) return;
    const toastId = toast.loading(`Deleting ${toDelete.length}…`);
    try {
      await deleteFn({ data: { ids: toDelete } });
      toast.success(`Deleted ${toDelete.length} duplicate${toDelete.length === 1 ? "" : "s"}`, { id: toastId });
      setGroups((cur) => (cur ? cur.filter((_, i) => i !== idx) : cur));
      await onUpdated();
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
    }
  }

  async function deleteAll() {
    if (!groups) return;
    const ids = groups.flatMap((g, i) =>
      g.items.filter((it) => it.id !== keep[i]).map((it) => it.id),
    );
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} duplicate question${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) {
      return;
    }
    const toastId = toast.loading(`Deleting ${ids.length}…`);
    try {
      // Chunk to respect the 500-id server cap
      let deleted = 0;
      for (let i = 0; i < ids.length; i += 400) {
        const chunk = ids.slice(i, i + 400);
        await deleteFn({ data: { ids: chunk } });
        deleted += chunk.length;
      }
      toast.success(`Deleted ${deleted} duplicates`, { id: toastId });
      setGroups([]);
      await onUpdated();
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
    }
  }

  const totalDeletable = groups
    ? groups.reduce((sum, g, i) => sum + g.items.filter((it) => it.id !== keep[i]).length, 0)
    : 0;

  return (
    <section className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">🔍 Find semantic duplicates</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Catches questions that ask the same thing but are worded differently
            (e.g. "Who painted the Mona Lisa?" vs "Which artist created the Mona Lisa?").
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={scanning}
            className="rounded-full border border-border bg-background/60 px-3 py-2 text-sm"
          >
            <option value="__all__">All categories</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}{c.count > 0 ? ` (${c.count})` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={scan}
            disabled={scanning}
            className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-amber-950 disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Scan"}
          </button>
        </div>
      </div>

      {groups !== null && groups.length === 0 && (
        <p className="mt-4 text-sm text-emerald-300">No semantic duplicates found 🎉</p>
      )}

      {groups && groups.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {groups.map((g, idx) => (
            <div
              key={`${g.category}-${g.correct_answer}-${idx}`}
              className="rounded-2xl border border-amber-500/30 bg-background/40 p-4"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-semibold">{g.category}</span>
                  <span className="text-muted-foreground"> · answer:</span>{" "}
                  <span className="font-mono">"{g.correct_answer}"</span>
                  <span className="text-muted-foreground"> · {g.items.length} questions</span>
                </div>
                <button
                  onClick={() => deleteGroup(idx)}
                  className="rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-rose-950"
                >
                  Delete {g.items.length - 1}
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {g.items.map((it) => {
                  const isKept = keep[idx] === it.id;
                  return (
                    <label
                      key={it.id}
                      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${isKept ? "bg-emerald-500/10" : "bg-rose-500/5"}`}
                    >
                      <input
                        type="radio"
                        name={`keep-${idx}`}
                        checked={isKept}
                        onChange={() => setKeep((k) => ({ ...k, [idx]: it.id }))}
                        className="mt-1"
                      />
                      <span className="flex-1">
                        <span className={`mr-2 text-xs font-semibold ${isKept ? "text-emerald-400" : "text-rose-400"}`}>
                          {isKept ? "KEEP" : "DELETE"}
                        </span>
                        {it.question_text}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="sticky bottom-2 mt-2 flex items-center justify-between rounded-full border border-amber-500/30 bg-background/80 px-4 py-2 backdrop-blur">
            <span className="text-sm text-muted-foreground">
              {totalDeletable} marked for deletion across {groups.length} group{groups.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={deleteAll}
              disabled={totalDeletable === 0}
              className="rounded-full bg-rose-500 px-4 py-1.5 text-sm font-semibold text-rose-950 disabled:opacity-50"
            >
              Delete all marked
            </button>
          </div>
        </div>
      )}
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
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setImageSource("upload")}
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${
                imageSource === "upload"
                  ? "bg-accent text-accent-foreground"
                  : "bg-background/60 text-muted-foreground"
              }`}
            >
              Upload
            </button>
            <button
              type="button"
              onClick={() => setImageSource("ai")}
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${
                imageSource === "ai"
                  ? "bg-accent text-accent-foreground"
                  : "bg-background/60 text-muted-foreground"
              }`}
            >
              AI generate
            </button>
          </div>

          {imageSource === "upload" ? (
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImageUpload(f);
                  e.target.value = "";
                }}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-accent-foreground"
              />
              <p className="text-xs text-muted-foreground">
                JPG/PNG/WebP under 10 MB. Shows centered above the answers during the question.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={imgPrompt}
                onChange={(e) => setImgPrompt(e.target.value)}
                placeholder="Describe the image (e.g. 'a close-up of a vintage Fender Stratocaster on a stage')"
                className="min-h-[60px] w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={busy}
                className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
              >
                {busy ? "Working…" : previewUrl ? "Regenerate" : "Generate image"}
              </button>
            </div>
          )}

          {previewUrl && (
            <div className="space-y-2">
              <img
                src={previewUrl}
                alt=""
                className="max-h-64 rounded-xl border border-border object-contain"
              />
              <button
                type="button"
                onClick={() => {
                  setQ({ ...q, media_url: null, media_type: null });
                  setPreviewUrl(null);
                }}
                className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                Clear image
              </button>
            </div>
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




// ===== Gemini paste-in importer =====

const DIFFICULTIES = ["easy", "medium", "hard", "impossible"] as const;
type Diff = (typeof DIFFICULTIES)[number];

type ParsedRow = {
  ok: boolean;
  error?: string;
  dbDup?: { category: string };
  raw: any;
  row?: {
    category: string;
    subcategory: null;
    question_text: string;
    correct_answer: string;
    wrong_1: string;
    wrong_2: string;
    wrong_3: string;
    explanation: string | null;
    difficulty: Diff;
    media_url: null;
    media_type: null;
    is_premium: boolean;
  };
};

function buildGeminiPrompt(category: string, count: number, difficulty: Diff | "mixed") {
  if (difficulty === "mixed") {
    const total = count * 4;
    return `You write trivia questions for a live multiplayer game. Generate exactly ${total} questions in the category "${category}", split evenly across all four difficulty levels.

Required distribution (must be exact):
- ${count} questions with "difficulty": "easy"
- ${count} questions with "difficulty": "medium"
- ${count} questions with "difficulty": "hard"
- ${count} questions with "difficulty": "impossible"

Calibration:
- easy = most adults know it
- medium = casual fans know it
- hard = real fans / trivia regulars
- impossible = stumps almost everyone, super obscure detail

Rules:
- Exactly ONE correct answer + THREE plausible, distinct wrong answers (case-insensitive distinct).
- Include a 1–2 sentence "explanation" (under 200 chars) — a fun fact a host would read after the reveal.
- No duplicates. Crisp, unambiguous wording. Keep answers short.

Return ONLY a JSON array of ${total} objects (no prose, no markdown code fences) matching this exact schema:
[
  {
    "category": "${category}",
    "question_text": "string",
    "correct_answer": "string",
    "wrong_1": "string",
    "wrong_2": "string",
    "wrong_3": "string",
    "explanation": "string",
    "difficulty": "easy" | "medium" | "hard" | "impossible"
  }
]

If you can't fit all questions in one reply, output as many complete objects as you can and stop cleanly with \`]\` — do NOT continue across messages.`;
  }
  return `You write trivia questions for a live multiplayer game. Generate ${count} questions in the category "${category}".

Rules:
- Exactly ONE correct answer + THREE plausible, distinct wrong answers (case-insensitive distinct).
- Include a 1–2 sentence "explanation" (under 200 chars) — a fun fact a host would read after the reveal.
- Every question must be "${difficulty}" difficulty.
  Calibration: easy = most adults know it; medium = casual fans; hard = real fans / trivia regulars; impossible = stumps almost everyone.
- No duplicates. Crisp, unambiguous wording. Keep answers short.

Return ONLY a JSON array (no prose, no markdown code fences) of objects matching this exact schema:
[
  {
    "category": "${category}",
    "question_text": "string",
    "correct_answer": "string",
    "wrong_1": "string",
    "wrong_2": "string",
    "wrong_3": "string",
    "explanation": "string",
    "difficulty": "easy" | "medium" | "hard" | "impossible"
  }
]

If you can't fit all questions in one reply, output as many complete objects as you can and stop cleanly with \`]\` — do NOT continue across messages.`;
}

function normalizeQuotes(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"');
}

function stripTrailingCommas(s: string): string {
  // remove ", }" and ", ]" — safe in JSON-ish payloads, doesn't touch strings perfectly
  // but in practice Gemini only emits trailing commas in structure, not strings.
  return s.replace(/,(\s*[}\]])/g, "$1");
}

/**
 * Pull every top-level JSON object out of a string by depth-tracking braces.
 * Ignores braces inside strings. Returns parsed objects, skipping ones that
 * fail to parse.
 */
function extractJsonObjects(text: string): unknown[] {
  const out: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (escape) { escape = false; continue; }
      if (c === "\\") { escape = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        const chunk = text.slice(start, i + 1);
        try {
          out.push(JSON.parse(chunk));
        } catch {
          try {
            out.push(JSON.parse(stripTrailingCommas(chunk)));
          } catch {
            // skip — unparseable object, will be reported as overall miss
          }
        }
        start = -1;
      } else if (depth < 0) {
        // resync
        depth = 0;
        start = -1;
      }
    }
  }
  return out;
}

function parseGeminiJson(text: string, fallbackCategory: string): ParsedRow[] {
  let cleaned = normalizeQuotes(text).trim();
  // Strip ```json fences anywhere (not just at start/end)
  cleaned = cleaned.replace(/```(?:json|JSON)?/g, "").replace(/```/g, "").trim();

  let arr: any[] = [];

  // Fast path: clean JSON array or object with { questions: [...] }
  const tryWhole = () => {
    try {
      const v = JSON.parse(stripTrailingCommas(cleaned));
      if (Array.isArray(v)) return v;
      if (Array.isArray((v as any)?.questions)) return (v as any).questions;
    } catch {
      // fall through
    }
    return null;
  };
  const whole = tryWhole();
  if (whole) arr = whole;
  else {
    // Fallback: extract every top-level {...} object. Handles:
    //   - multiple concatenated arrays [..][..]
    //   - NDJSON (one object per line)
    //   - prose mixed with objects
    //   - truncated arrays where the trailing ] is missing
    arr = extractJsonObjects(cleaned) as any[];
  }

  if (!arr.length) throw new Error("No questions found in the pasted text.");

  return arr.map((raw): ParsedRow => {
    const errs: string[] = [];
    const get = (k: string) => (typeof raw?.[k] === "string" ? raw[k].trim() : "");
    const category = get("category") || fallbackCategory;
    const question_text = get("question_text");
    const correct_answer = get("correct_answer");
    const wrong_1 = get("wrong_1");
    const wrong_2 = get("wrong_2");
    const wrong_3 = get("wrong_3");
    const explanation = get("explanation") || null;
    const difficultyRaw = (get("difficulty") || "medium").toLowerCase();

    if (question_text.length < 3) errs.push("question_text too short");
    for (const [k, v] of [
      ["correct_answer", correct_answer],
      ["wrong_1", wrong_1],
      ["wrong_2", wrong_2],
      ["wrong_3", wrong_3],
    ] as const) {
      if (!v) errs.push(`${k} missing`);
    }
    if (!DIFFICULTIES.includes(difficultyRaw as Diff)) errs.push(`bad difficulty "${difficultyRaw}"`);
    const norm = (s: string) => s.trim().toLowerCase();
    const set = new Set([norm(correct_answer), norm(wrong_1), norm(wrong_2), norm(wrong_3)]);
    if (set.size !== 4) errs.push("answers not distinct");

    if (errs.length) return { ok: false, error: errs.join("; "), raw };
    return {
      ok: true,
      raw,
      row: {
        category,
        subcategory: null,
        question_text,
        correct_answer,
        wrong_1,
        wrong_2,
        wrong_3,
        explanation,
        difficulty: difficultyRaw as Diff,
        media_url: null,
        media_type: null,
        is_premium: false,
      },
    };
  });
}




const IMPORT_CHUNK = 200;

function GeminiImporter({
  bulkInsert,
  onInserted,
}: {
  bulkInsert: ReturnType<typeof useServerFn<typeof bulkInsertQuestions>>;
  onInserted: () => Promise<void>;
}) {
  const bakeFn = useServerFn(bakeAllQuestionTTS);
  const bakeExplanationFn = useServerFn(bakeAllExplanationTTS);
  const checkDupesFn = useServerFn(checkDuplicates);
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [count, setCount] = useState(50);
  const [difficulty, setDifficulty] = useState<Diff | "mixed">("mixed");
  const [pasted, setPasted] = useState("");
  const [staged, setStaged] = useState<ParsedRow[]>([]);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [bakeTts, setBakeTts] = useState(true);
  const [busy, setBusy] = useState(false);

  async function findDbDupes(keys: string[]): Promise<Map<string, { category: string }>> {
    const out = new Map<string, { category: string }>();
    if (!keys.length) return out;
    try {
      const res = await checkDupesFn({ data: { keys } });
      for (const k of res.duplicates) {
        const meta = res.sample[k];
        if (meta) out.set(k, { category: meta.category });
      }
    } catch (e) {
      console.warn("checkDuplicates failed", e);
    }
    return out;
  }



  const prompt = useMemo(() => buildGeminiPrompt(category, count, difficulty), [category, count, difficulty]);

  function copyPrompt() {
    navigator.clipboard.writeText(prompt).then(
      () => toast.success("Prompt copied — paste into Gemini"),
      () => toast.error("Couldn't copy to clipboard"),
    );
  }

  async function appendRows(rows: ParsedRow[]) {
    if (!rows.length) {
      toast.error("Nothing parsed from that paste.");
      return;
    }
    const existingKeys = new Set(
      staged.filter((r) => r.ok && r.row).map((r) => dedupeKey(r.row!.question_text)),
    );
    let stagedDupes = 0;
    const candidates: ParsedRow[] = [];
    for (const r of rows) {
      if (r.ok && r.row) {
        const k = dedupeKey(r.row.question_text);
        if (existingKeys.has(k)) { stagedDupes++; continue; }
        existingKeys.add(k);
      }
      candidates.push(r);
    }

    const probe = candidates
      .filter((r) => r.ok && r.row)
      .map((r) => dedupeKey(r.row!.question_text));
    const dbHits = await findDbDupes(probe);

    let dbDupes = 0;
    const fresh: ParsedRow[] = [];
    for (const r of candidates) {
      if (r.ok && r.row) {
        const k = dedupeKey(r.row.question_text);
        const hit = dbHits.get(k);
        if (hit) {
          dbDupes++;
          fresh.push({ ...r, ok: false, error: `Already in DB (${hit.category})`, dbDup: hit });
          continue;
        }
      }
      fresh.push(r);
    }

    const valid = fresh.filter((r) => r.ok).length;
    if (!fresh.length) {
      toast.info(
        `Skipped all ${stagedDupes + dbDupes} (${dbDupes} in DB, ${stagedDupes} already staged).`,
      );
      return;
    }
    setStaged((prev) => [...prev, ...fresh]);
    const bad = fresh.filter((r) => !r.ok && !r.dbDup).length;
    const parts = [`Added ${valid} valid`];
    if (bad) parts.push(`${bad} with issues`);
    if (dbDupes) parts.push(`${dbDupes} already in DB`);
    if (stagedDupes) parts.push(`${stagedDupes} already staged`);
    toast.success(parts.join(" · "));
  }

  async function addBatch() {
    try {
      const rows = parseGeminiJson(pasted, category);
      await appendRows(rows);
      setPasted("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseGeminiJson(text, category);
      await appendRows(rows);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }


  function clearStaged() {
    if (!staged.length) return;
    if (!window.confirm(`Clear ${staged.length} staged question${staged.length === 1 ? "" : "s"}?`)) return;
    setStaged([]);
    setSkip(new Set());
  }

  async function doImport() {
    const toInsert = staged
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => r.ok && !skip.has(i))
      .map(({ r }) => r.row!);
    if (!toInsert.length) {
      toast.error("Nothing to import.");
      return;
    }
    setBusy(true);
    let imported = 0;
    const failures: string[] = [];
    try {
      const total = toInsert.length;
      for (let i = 0; i < toInsert.length; i += IMPORT_CHUNK) {
        const chunk = toInsert.slice(i, i + IMPORT_CHUNK);
        try {
          const res = await bulkInsert({ data: { rows: chunk } });
          imported += res.inserted ?? chunk.length;
          toast.info(`Imported ${Math.min(i + chunk.length, total)} / ${total}…`);
        } catch (e) {
          failures.push(`Chunk ${i / IMPORT_CHUNK + 1}: ${(e as Error).message}`);
        }
      }
      if (imported) {
        toast.success(
          `Imported ${imported} question${imported === 1 ? "" : "s"}${failures.length ? ` · ${failures.length} chunk(s) failed` : ""}`,
        );
      }
      if (failures.length) {
        toast.error(failures.slice(0, 3).join(" | "));
      }
      await onInserted();
      if (bakeTts && imported > 0) {
        toast.info("Generating voice narration… this may take a minute.");
        try {
          const b = await bakeFn({ data: { limit: Math.max(imported, 50) } });
          toast.success(`Prompt voice baked: ${b.baked} new, ${b.skipped} already done${b.errors.length ? `, ${b.errors.length} failed` : ""}`);
        } catch (e) {
          toast.error(`Prompt TTS bake failed: ${(e as Error).message}`);
        }
        try {
          const e2 = await bakeExplanationFn({ data: { limit: Math.max(imported, 50) } });
          toast.success(`Did You Know baked: ${e2.baked} new, ${e2.skipped} already done${e2.errors.length ? `, ${e2.errors.length} failed` : ""}`);
        } catch (e) {
          toast.error(`Did You Know bake failed: ${(e as Error).message}`);
        }
      }
      if (imported) {
        setStaged([]);
        setSkip(new Set());
      }
    } finally {
      setBusy(false);
    }
  }

  const validCount = staged.filter((r, i) => r.ok && !skip.has(i)).length;
  const issueCount = staged.filter((r) => !r.ok).length;

  return (
    <section className="rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Import from Gemini (free)</h2>
          <p className="text-sm text-muted-foreground">
            Generate batches in Gemini and paste each one in. Add as many as you want, then import the whole stack at once.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <div className="mb-1 text-muted-foreground">Category</div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-border bg-background/60 px-3 py-2"
          >
            {CATEGORIES.filter((c) => c.name !== "Mystery Mix").map((c) => (
              <option key={c.name} value={c.name}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1 text-muted-foreground">
            {difficulty === "mixed" ? `Per difficulty (× 4 = ${count * 4} total)` : "Count per batch"}
          </div>
          <input
            type="number"
            min={1}
            max={difficulty === "mixed" ? 50 : 200}
            value={count}
            onChange={(e) => {
              const cap = difficulty === "mixed" ? 50 : 200;
              setCount(Math.max(1, Math.min(cap, Number(e.target.value) || 1)));
            }}
            className="w-full rounded-lg border border-border bg-background/60 px-3 py-2"
          />
          <div className="mt-1 text-xs text-muted-foreground">
            Gemini 3 handles large batches — default 200 total (50 per difficulty in mixed).
          </div>
        </label>
        <label className="text-sm">
          <div className="mb-1 text-muted-foreground">Difficulty</div>
          <select
            value={difficulty}
            onChange={(e) => {
              const next = e.target.value as Diff | "mixed";
              setDifficulty(next);
              const cap = next === "mixed" ? 6 : 25;
              setCount((c) => Math.min(c, cap));
            }}
            className="w-full rounded-lg border border-border bg-background/60 px-3 py-2"
          >
            <option value="mixed">Mixed</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Prompt to paste into Gemini</div>
          <button
            onClick={copyPrompt}
            className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
          >
            Copy prompt
          </button>
        </div>
        <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-background/40 p-3 text-xs whitespace-pre-wrap">
          {prompt}
        </pre>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-sm text-muted-foreground">
          Paste Gemini&rsquo;s JSON response here (one batch at a time, or paste many at once)
        </div>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={8}
          placeholder='[ { "category": "...", "question_text": "...", "correct_answer": "...", ... } ]'
          className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-xs"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={addBatch}
          disabled={!pasted.trim() || busy}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-card/60 disabled:opacity-50"
        >
          Add batch to staging
        </button>
        <label className="cursor-pointer rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-card/60">
          Upload .json / .txt
          <input
            type="file"
            accept=".json,.txt,application/json,text/plain"
            onChange={onFile}
            className="hidden"
          />
        </label>
        <button
          onClick={clearStaged}
          disabled={!staged.length || busy}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-card/60 disabled:opacity-50"
        >
          Clear staged
        </button>
        <div className="text-sm text-muted-foreground">
          Staged: <span className="font-semibold text-foreground">{staged.length}</span>
          {staged.length > 0 && (
            <>
              {" "}
              ({validCount} valid{issueCount ? ` · ${issueCount} with issues` : ""})
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={bakeTts}
              onChange={(e) => setBakeTts(e.target.checked)}
            />
            Bake Elf voice after import
          </label>
          <button
            onClick={doImport}
            disabled={!validCount || busy}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Importing…" : `Import ${validCount} question${validCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      {staged.length > 0 && (
        <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-border bg-background/30">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background/80">
              <tr className="text-left">
                <th className="px-2 py-2 w-8"></th>
                <th className="px-2 py-2 w-8">#</th>
                <th className="px-2 py-2">Question</th>
                <th className="px-2 py-2">Correct</th>
                <th className="px-2 py-2">Diff</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {staged.map((r, i) => (
                <tr
                  key={i}
                  className={`border-t border-border/40 ${r.ok ? "" : "bg-destructive/10"}`}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      disabled={!r.ok}
                      checked={r.ok && !skip.has(i)}
                      onChange={(e) => {
                        const next = new Set(skip);
                        if (e.target.checked) next.delete(i);
                        else next.add(i);
                        setSkip(next);
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5">{r.row?.question_text ?? String(r.raw?.question_text ?? "—")}</td>
                  <td className="px-2 py-1.5">{r.row?.correct_answer ?? "—"}</td>
                  <td className="px-2 py-1.5">{r.row?.difficulty ?? "—"}</td>
                  <td className="px-2 py-1.5">
                    {r.ok ? (
                      <span className="text-emerald-400">✓ ok</span>
                    ) : (
                      <span className="text-destructive">✕ {r.error}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

