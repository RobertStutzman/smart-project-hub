import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/custom")({
  head: () => ({
    meta: [
      { title: "Custom Trivia Packs — Drop Trivia" },
      {
        name: "description",
        content:
          "Order a custom trivia pack for your wedding, bachelorette, birthday, or roast. We turn your stories into a 20-question party game with a private code.",
      },
      { property: "og:title", content: "Custom Trivia Packs — Drop Trivia" },
      {
        property: "og:description",
        content: "Custom trivia about the guest of honor. Private code. Plays on any device.",
      },
    ],
  }),
  component: CustomLanding,
});

function CustomLanding() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <header className="text-center">
          <div className="inline-block rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-200">
            New
          </div>
          <h1 className="mt-4 bg-gradient-to-b from-white to-amber-200 bg-clip-text text-5xl font-black leading-tight text-transparent sm:text-6xl">
            Custom Trivia, Built For Your Party
          </h1>
          <p className="mt-6 text-lg text-white/70 sm:text-xl">
            Wedding? Bachelorette? Birthday roast? Send us the dirt on the guest of honor — we
            turn it into a 20-question multiple-choice game your friends play on their phones.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              to="/custom/order"
              className="inline-block rounded-full bg-amber-400 px-7 py-3 text-base font-bold text-slate-950 shadow-lg shadow-amber-500/30 transition hover:bg-amber-300"
            >
              Order a Custom Pack
            </Link>
            <Link
              to="/host"
              className="inline-block rounded-full border border-white/20 px-7 py-3 text-base font-bold text-white/80 transition hover:bg-white/10"
            >
              Have a Code?
            </Link>
          </div>
        </header>

        <section className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            { n: "1", t: "Tell us about them", d: "Fill out a form: childhood, exes, inside jokes, anything embarrassing." },
            { n: "2", t: "We write the questions", d: "You'll get your unique code in 24-48 hours, AI-drafted and human-edited." },
            { n: "3", t: "Play on game night", d: "Open the app, enter your code, play on any phone or laptop. No app install." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-3xl font-black text-amber-300">{s.n}</div>
              <div className="mt-2 text-lg font-bold">{s.t}</div>
              <div className="mt-2 text-sm text-white/60">{s.d}</div>
            </div>
          ))}
        </section>

        <section className="mt-20 rounded-2xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-2xl font-black">Pick your vibe</h2>
          <ul className="mt-4 space-y-3 text-white/80">
            <li><strong className="text-amber-200">Clean.</strong> Family-friendly. Grandma is fine.</li>
            <li><strong className="text-amber-200">Medium.</strong> Light teasing, nothing X-rated.</li>
            <li><strong className="text-amber-200">Spicy.</strong> Cheeky innuendo welcome.</li>
            <li><strong className="text-amber-200">Roast.</strong> Bold and savage — still not mean.</li>
          </ul>
        </section>

        <section className="mt-16 text-center">
          <h2 className="text-2xl font-black">Ready?</h2>
          <Link
            to="/custom/order"
            className="mt-6 inline-block rounded-full bg-amber-400 px-7 py-3 text-base font-bold text-slate-950 shadow-lg shadow-amber-500/30 transition hover:bg-amber-300"
          >
            Start Your Order
          </Link>
          <p className="mt-4 text-sm text-white/50">
            Pricing and turnaround confirmed by email after you submit.
          </p>
        </section>
      </div>
    </main>
  );
}
