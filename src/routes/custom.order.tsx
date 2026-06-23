import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { submitCustomOrder } from "@/lib/custom-packs.functions";

export const Route = createFileRoute("/custom/order")({
  head: () => ({
    meta: [
      { title: "Order a Custom Trivia Pack — Drop Trivia" },
      { name: "description", content: "Submit your details and we'll build a private trivia game for your party." },
    ],
  }),
  component: OrderForm,
});

type EventType = "wedding" | "bachelorette" | "bachelor" | "birthday" | "roast" | "anniversary" | "other";
type Tone = "clean" | "medium" | "spicy" | "roast";

function OrderForm() {
  const submit = useServerFn(submitCustomOrder);
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [customerName, setName] = useState("");
  const [customerEmail, setEmail] = useState("");
  const [eventType, setEventType] = useState<EventType>("wedding");
  const [eventDate, setDate] = useState("");
  const [honoreeNames, setHonoree] = useState("");
  const [questionCount, setCount] = useState(20);
  const [tone, setTone] = useState<Tone>("medium");
  const [childhood, setChildhood] = useState("");
  const [relationships, setRelationships] = useState("");
  const [embarrassing, setEmbarrassing] = useState("");
  const [insideJokes, setJokes] = useState("");
  const [hobbies, setHobbies] = useState("");
  const [achievements, setAchievements] = useState("");
  const [anythingElse, setExtra] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await submit({
        data: {
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          eventType,
          eventDate: eventDate || null,
          honoreeNames: honoreeNames.trim(),
          questionCount,
          tone,
          intake: {
            childhood,
            relationships,
            embarrassing,
            insideJokes,
            hobbies,
            achievements,
            anythingElse,
          },
        },
      });
      setOrderId(res.orderId);
      toast.success("Order received!");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (orderId) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <div className="text-6xl">🎉</div>
          <h1 className="mt-6 text-4xl font-black">Order received!</h1>
          <p className="mt-4 text-white/70">
            We&apos;ll email a quote and your custom code to <strong>{customerEmail}</strong> within 24-48 hours.
          </p>
          <p className="mt-2 text-xs text-white/40">Order ID: {orderId}</p>
          <Link to="/" className="mt-8 inline-block rounded-full border border-white/20 px-6 py-2 text-sm font-bold text-white/80 hover:bg-white/10">
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link to="/custom" className="text-xs text-white/50 hover:text-white">← Back</Link>
        <h1 className="mt-4 text-4xl font-black">Order a Custom Pack</h1>
        <p className="mt-2 text-white/60">All fields are optional except your contact info and the guest of honor.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-6">
          <Field label="Your name *">
            <Input value={customerName} onChange={setName} required maxLength={120} />
          </Field>
          <Field label="Your email *">
            <Input type="email" value={customerEmail} onChange={setEmail} required maxLength={255} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Event type *">
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
              >
                <option value="wedding">Wedding</option>
                <option value="bachelorette">Bachelorette</option>
                <option value="bachelor">Bachelor</option>
                <option value="birthday">Birthday</option>
                <option value="roast">Roast</option>
                <option value="anniversary">Anniversary</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Event date">
              <Input type="date" value={eventDate} onChange={setDate} />
            </Field>
          </div>
          <Field label="Guest of honor name(s) *">
            <Input value={honoreeNames} onChange={setHonoree} required maxLength={200} placeholder="e.g. Sarah & Mike" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Number of questions">
              <select
                value={questionCount}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
              >
                <option value={10}>10 questions</option>
                <option value={20}>20 questions</option>
                <option value={30}>30 questions</option>
              </select>
            </Field>
            <Field label="Tone">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
              >
                <option value="clean">Clean (family friendly)</option>
                <option value="medium">Medium (light teasing)</option>
                <option value="spicy">Spicy (innuendo OK)</option>
                <option value="roast">Roast (savage)</option>
              </select>
            </Field>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <h2 className="text-lg font-black text-amber-200">Tell us about them</h2>
            <p className="mt-1 text-xs text-white/40">The more detail, the funnier the questions.</p>
          </div>

          <Field label="Childhood & hometown">
            <TextArea value={childhood} onChange={setChildhood} />
          </Field>
          <Field label="Relationships / dating history">
            <TextArea value={relationships} onChange={setRelationships} />
          </Field>
          <Field label="Embarrassing stories">
            <TextArea value={embarrassing} onChange={setEmbarrassing} />
          </Field>
          <Field label="Inside jokes & nicknames">
            <TextArea value={insideJokes} onChange={setJokes} />
          </Field>
          <Field label="Hobbies, quirks, obsessions">
            <TextArea value={hobbies} onChange={setHobbies} />
          </Field>
          <Field label="Achievements & milestones">
            <TextArea value={achievements} onChange={setAchievements} />
          </Field>
          <Field label="Anything else?">
            <TextArea value={anythingElse} onChange={setExtra} maxLength={4000} />
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-amber-400 px-6 py-3 text-base font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Submit Order"}
          </button>
          <p className="text-center text-xs text-white/40">
            No payment yet — we&apos;ll email you a quote within 24-48 hours.
          </p>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-white/80">{label}</span>
      {children}
    </label>
  );
}

function Input(props: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <input
      type={props.type ?? "text"}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      required={props.required}
      maxLength={props.maxLength}
      placeholder={props.placeholder}
      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-amber-400 focus:outline-none"
    />
  );
}

function TextArea({ value, onChange, maxLength = 2000 }: { value: string; onChange: (v: string) => void; maxLength?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      rows={3}
      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30 focus:border-amber-400 focus:outline-none"
    />
  );
}
