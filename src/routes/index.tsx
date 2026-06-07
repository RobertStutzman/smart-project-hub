import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BootSequence, shouldShowBoot } from "@/components/BootSequence";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Beat the Drop Trivia — Live multiplayer trivia for parties" },
      {
        name: "description",
        content:
          "Host trivia on your TV, play from your phone. Music, movies, and more. No app install — just a 4-letter code.",
      },
      { property: "og:title", content: "Beat the Drop Trivia" },
      {
        property: "og:description",
        content: "Live multiplayer trivia. Host on TV, play on your phone.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  // Boot sequence — first visit per session. SSR-safe (defaults to false).
  const [showBoot, setShowBoot] = useState(false);
  useEffect(() => {
    if (shouldShowBoot()) setShowBoot(true);
  }, []);

  return (
    <main
      className="relative min-h-screen overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(ellipse 90% 60% at 50% 30%, oklch(0.22 0.04 270 / 0.95), oklch(0.06 0.02 270) 80%)",
      }}
    >
      {/* film grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      {/* warm rim glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 110%, oklch(0.55 0.18 60 / 0.35), transparent 60%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.35em] text-amber-200/90 backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
          Live multiplayer trivia
        </div>

        <h1 className="font-display text-6xl font-black leading-[0.95] tracking-tight text-white drop-shadow-[0_4px_40px_rgba(0,0,0,0.7)] sm:text-8xl">
          Beat the{" "}
          <span className="bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
            Drop
          </span>
        </h1>

        <div className="mx-auto mt-5 h-[2px] w-24 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />

        <p className="mt-6 max-w-xl text-base text-white/70 sm:text-lg">
          Host the game on your TV. Players join from their phones with a 4-letter code.
          Fastest fingers win.
        </p>

        <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/host"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-8 py-4 font-display text-base font-bold uppercase tracking-wider text-amber-950 shadow-[0_0_50px_oklch(0.85_0.18_85/0.45)] transition hover:scale-[1.03] active:scale-[0.98]"
          >
            Host on this screen →
          </Link>
          <Link
            to="/join"
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-8 py-4 font-display text-base font-bold uppercase tracking-wider text-white backdrop-blur transition hover:bg-white/10"
          >
            Join from my phone
          </Link>
        </div>

        <div className="mt-16 grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-3">
          <Feature n="01" t="Code in" d="Type 4 letters to join. No app." />
          <Feature n="02" t="Beat the clock" d="Answer before the drop." />
          <Feature n="03" t="Win streaks" d="Combos = bonus points." />
        </div>
      </div>
    </main>
  );
}

function Feature({ n, t, d }: { n: string; t: string; d: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur transition hover:border-amber-300/30 hover:bg-white/[0.07]">
      <div className="font-mono text-[10px] tracking-widest text-amber-300/70">{n}</div>
      <div className="mt-1 font-display text-base font-bold text-white">{t}</div>
      <div className="mt-1 text-sm text-white/60">{d}</div>
    </div>
  );
}
