import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { checkIsAdmin } from "@/lib/admin.functions";
import {
  approveAndDeliverPack,
  deleteCustomQuestion,
  draftCustomQuestionsWithAI,
  getCustomOrder,
  listCustomOrders,
  markOrderDelivered,
  upsertCustomQuestion,
} from "@/lib/custom-packs.functions";

export const Route = createFileRoute("/_authenticated/admin-custom")({
  head: () => ({
    meta: [{ title: "Admin · Custom Packs — Drop Trivia" }],
  }),
  component: AdminCustomPage,
});

type Order = {
  id: string;
  created_at: string;
  status: string;
  customer_name: string;
  customer_email: string;
  event_type: string;
  event_date: string | null;
  honoree_names: string;
  question_count: number;
  tone: string;
  intake_payload: Record<string, string>;
  admin_notes: string | null;
  delivered_at: string | null;
  pack: { id: string; pack_code: string; title: string; is_active: boolean; expires_at: string | null; single_use: boolean; used_at: string | null } | null;
};

type Question = {
  id: string;
  category: string;
  question_text: string;
  correct_answer: string;
  wrong_1: string;
  wrong_2: string;
  wrong_3: string;
  explanation: string | null;
  difficulty: string;
};

function AdminCustomPage() {
  const checkAdmin = useServerFn(checkIsAdmin);
  const listFn = useServerFn(listCustomOrders);
  const getFn = useServerFn(getCustomOrder);
  const draftFn = useServerFn(draftCustomQuestionsWithAI);
  const upsertFn = useServerFn(upsertCustomQuestion);
  const deleteFn = useServerFn(deleteCustomQuestion);
  const approveFn = useServerFn(approveAndDeliverPack);
  const markDelivered = useServerFn(markOrderDelivered);

  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    checkAdmin().then((r) => {
      setIsAdmin(r.isAdmin);
      setAuthChecked(true);
    }).catch(() => setAuthChecked(true));
  }, [checkAdmin]);

  const refreshOrders = useCallback(async () => {
    try {
      const r = await listFn();
      setOrders(r.orders as unknown as Order[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [listFn]);

  useEffect(() => {
    if (isAdmin) void refreshOrders();
  }, [isAdmin, refreshOrders]);

  const loadOrder = useCallback(async (id: string) => {
    try {
      const r = await getFn({ data: { orderId: id } });
      setSelected(r.order as unknown as Order);
      setQuestions(r.questions as Question[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [getFn]);

  async function runDraft() {
    if (!selected) return;
    if (questions.length > 0 && !window.confirm("Draft more questions and append?")) return;
    setBusy(true);
    try {
      await draftFn({ data: { orderId: selected.id } });
      toast.success("Questions drafted");
      await loadOrder(selected.id);
      await refreshOrders();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveQuestion(q: Question) {
    if (!selected?.pack) {
      toast.error("Approve & save creates the pack; click 'Draft with AI' first to create it.");
      return;
    }
    setBusy(true);
    try {
      await upsertFn({
        data: {
          packId: selected.pack.id,
          question: {
            id: q.id,
            question_text: q.question_text,
            correct_answer: q.correct_answer,
            wrong_1: q.wrong_1,
            wrong_2: q.wrong_2,
            wrong_3: q.wrong_3,
            explanation: q.explanation ?? "",
            difficulty: (["easy", "medium", "hard", "impossible"].includes(q.difficulty) ? q.difficulty : "medium") as "easy" | "medium" | "hard" | "impossible",
          },
        },
      });
      toast.success("Saved");
      await loadOrder(selected.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion(id: string) {
    if (!window.confirm("Delete this question?")) return;
    setBusy(true);
    try {
      await deleteFn({ data: { questionId: id } });
      if (selected) await loadOrder(selected.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await approveFn({ data: { orderId: selected.id, singleUse: false } });
      toast.success(`Pack approved — code: ${r.packCode}`);
      await loadOrder(selected.id);
      await refreshOrders();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!authChecked) return <main className="p-8 text-white">Checking access…</main>;
  if (!isAdmin) return <main className="p-8 text-white">Admin access required. <Link to="/admin" className="underline">Back</Link></main>;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="text-sm text-white/60 hover:text-white">← Admin</Link>
          <h1 className="text-xl font-black">Custom Packs Queue</h1>
        </div>
      </header>

      <div className="grid grid-cols-[320px_1fr] gap-0">
        <aside className="h-[calc(100vh-65px)] overflow-y-auto border-r border-white/10">
          {orders.length === 0 ? (
            <div className="p-6 text-sm text-white/50">No orders yet.</div>
          ) : orders.map((o) => (
            <button
              key={o.id}
              onClick={() => loadOrder(o.id)}
              className={`block w-full border-b border-white/5 px-4 py-3 text-left text-sm transition hover:bg-white/5 ${selected?.id === o.id ? "bg-white/10" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-bold">{o.honoree_names}</div>
                <StatusPill status={o.status} />
              </div>
              <div className="mt-1 text-xs text-white/50">{o.event_type} · {o.customer_email}</div>
              {o.pack && <div className="mt-1 font-mono text-xs text-amber-300">{o.pack.pack_code}</div>}
            </button>
          ))}
        </aside>

        <section className="h-[calc(100vh-65px)] overflow-y-auto p-6">
          {!selected ? (
            <div className="text-white/50">Select an order on the left.</div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black">{selected.honoree_names}</h2>
                  <div className="text-sm text-white/60">
                    {selected.event_type}
                    {selected.event_date && ` · ${selected.event_date}`}
                    {" · "}{selected.customer_name} ({selected.customer_email})
                  </div>
                </div>
                <StatusPill status={selected.status} />
              </div>

              {selected.pack && (
                <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4">
                  <div className="text-xs uppercase tracking-widest text-amber-300">Pack code</div>
                  <div className="mt-1 flex items-center gap-3">
                    <code className="font-mono text-2xl font-black text-amber-200">{selected.pack.pack_code}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selected.pack!.pack_code);
                        toast.success("Code copied");
                      }}
                      className="rounded border border-amber-400/40 px-2 py-1 text-xs hover:bg-amber-400/20"
                    >
                      Copy
                    </button>
                    <span className="text-xs text-white/50">
                      Host plays at <code>/host?code={selected.pack.pack_code}</code>
                    </span>
                  </div>
                </div>
              )}

              <details className="rounded-lg border border-white/10 bg-white/5 p-4">
                <summary className="cursor-pointer text-sm font-bold">Intake details</summary>
                <div className="mt-3 space-y-3 text-sm">
                  <div><strong className="text-amber-200">Tone:</strong> {selected.tone}</div>
                  <div><strong className="text-amber-200">Question count:</strong> {selected.question_count}</div>
                  {Object.entries(selected.intake_payload || {}).map(([k, v]) =>
                    v && v.trim() ? (
                      <div key={k}>
                        <div className="text-xs uppercase tracking-widest text-white/40">{k}</div>
                        <div className="whitespace-pre-wrap text-white/80">{v}</div>
                      </div>
                    ) : null,
                  )}
                </div>
              </details>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={runDraft}
                  disabled={busy}
                  className="rounded-full bg-purple-500 px-5 py-2 text-sm font-bold disabled:opacity-50"
                >
                  {questions.length === 0 ? "✨ Draft with AI" : "✨ Draft more"}
                </button>
                {selected.pack && !selected.pack.is_active && (
                  <button
                    onClick={approve}
                    disabled={busy || questions.length === 0}
                    className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
                  >
                    Approve & generate code
                  </button>
                )}
                {selected.pack?.is_active && selected.status !== "delivered" && (
                  <button
                    onClick={async () => {
                      await markDelivered({ data: { orderId: selected.id } });
                      await refreshOrders();
                      await loadOrder(selected.id);
                      toast.success("Marked delivered");
                    }}
                    className="rounded-full border border-white/20 px-5 py-2 text-sm font-bold hover:bg-white/10"
                  >
                    Mark delivered
                  </button>
                )}
              </div>

              <div>
                <h3 className="text-lg font-black">Questions ({questions.length})</h3>
                <div className="mt-4 space-y-4">
                  {questions.map((q, i) => (
                    <QuestionEditor
                      key={q.id}
                      index={i}
                      q={q}
                      onSave={(next) => saveQuestion(next)}
                      onDelete={() => removeQuestion(q.id)}
                      busy={busy}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: "bg-blue-500/30 text-blue-200",
    drafting: "bg-amber-500/30 text-amber-200",
    ready: "bg-emerald-500/30 text-emerald-200",
    delivered: "bg-purple-500/30 text-purple-200",
    cancelled: "bg-red-500/30 text-red-200",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${map[status] || "bg-white/10 text-white/70"}`}>{status}</span>;
}

function QuestionEditor({ q, index, onSave, onDelete, busy }: {
  q: Question;
  index: number;
  onSave: (q: Question) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Question>(q);
  useEffect(() => setDraft(q), [q]);
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-widest text-white/40">Q{index + 1}</div>
        <button onClick={onDelete} className="text-xs text-red-300 hover:text-red-200">Delete</button>
      </div>
      <textarea
        value={draft.question_text}
        onChange={(e) => setDraft({ ...draft, question_text: e.target.value })}
        rows={2}
        className="w-full rounded border border-white/10 bg-black/30 p-2 text-sm"
      />
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          <span className="text-emerald-300">✓ Correct</span>
          <input value={draft.correct_answer} onChange={(e) => setDraft({ ...draft, correct_answer: e.target.value })}
            className="mt-1 w-full rounded border border-emerald-400/30 bg-black/30 p-2 text-sm" />
        </label>
        <label className="text-xs">
          <span className="text-white/50">Wrong 1</span>
          <input value={draft.wrong_1} onChange={(e) => setDraft({ ...draft, wrong_1: e.target.value })}
            className="mt-1 w-full rounded border border-white/10 bg-black/30 p-2 text-sm" />
        </label>
        <label className="text-xs">
          <span className="text-white/50">Wrong 2</span>
          <input value={draft.wrong_2} onChange={(e) => setDraft({ ...draft, wrong_2: e.target.value })}
            className="mt-1 w-full rounded border border-white/10 bg-black/30 p-2 text-sm" />
        </label>
        <label className="text-xs">
          <span className="text-white/50">Wrong 3</span>
          <input value={draft.wrong_3} onChange={(e) => setDraft({ ...draft, wrong_3: e.target.value })}
            className="mt-1 w-full rounded border border-white/10 bg-black/30 p-2 text-sm" />
        </label>
      </div>
      <label className="mt-2 block text-xs">
        <span className="text-white/50">Explanation (read aloud after reveal)</span>
        <textarea value={draft.explanation ?? ""} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
          rows={2} className="mt-1 w-full rounded border border-white/10 bg-black/30 p-2 text-sm" />
      </label>
      <div className="mt-2 flex items-center gap-3">
        <label className="text-xs">
          <span className="text-white/50">Difficulty</span>
          <select value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}
            className="ml-2 rounded border border-white/10 bg-black/30 p-1 text-sm">
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
            <option value="impossible">impossible</option>
          </select>
        </label>
        <button
          onClick={() => onSave(draft)}
          disabled={busy}
          className="ml-auto rounded-full bg-amber-400 px-4 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
