import { createFileRoute, Link } from "@tanstack/react-router";

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
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(0.45_0.25_295/0.35),transparent_60%),radial-gradient(circle_at_bottom_right,oklch(0.6_0.22_30/0.3),transparent_55%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
          Live multiplayer trivia
        </div>
        <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
          Beat the <span className="bg-gradient-to-r from-fuchsia-400 via-amber-300 to-rose-400 bg-clip-text text-transparent">Drop</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Host the game on your TV. Players join from their phones with a 4-letter code.
          Fastest fingers win.
        </p>
        <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/host"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-8 py-4 text-base font-semibold text-background transition hover:scale-[1.02] active:scale-[0.98]"
          >
            Host on this screen →
          </Link>
          <Link
            to="/join"
            className="inline-flex items-center justify-center rounded-full border border-border bg-card/50 px-8 py-4 text-base font-semibold backdrop-blur transition hover:bg-card"
          >
            Join from my phone
          </Link>
        </div>
        <div className="mt-16 grid w-full grid-cols-3 gap-3 text-left text-xs text-muted-foreground sm:text-sm">
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
    <div className="rounded-2xl border border-border bg-card/40 p-4 backdrop-blur">
      <div className="text-[10px] font-mono text-muted-foreground">{n}</div>
      <div className="mt-1 font-semibold text-foreground">{t}</div>
      <div className="mt-1 text-muted-foreground">{d}</div>
    </div>
  );
}
