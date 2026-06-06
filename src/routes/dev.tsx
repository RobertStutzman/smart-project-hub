import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/dev")({
  head: () => ({
    meta: [{ title: "Dev test rig — Beat the Drop" }],
  }),
  component: DevPage,
});

const NAMES = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot",
  "Golf", "Hotel", "India", "Juliet", "Kilo", "Lima",
];

type Mode = "smart" | "random" | "wrong";

function DevPage() {
  const [code, setCode] = useState("");
  const [count, setCount] = useState(4);
  const [mode, setMode] = useState<Mode>("random");
  const [delay, setDelay] = useState(1200);
  const [running, setRunning] = useState(false);

  const validCode = /^[A-Z]{4}$/.test(code);

  function start() {
    if (!validCode) return;
    setRunning(true);
  }
  function stop() {
    setRunning(false);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center gap-4 border-b border-zinc-800 p-4">
        <Link to="/" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← Home
        </Link>
        <h1 className="text-lg font-bold">Dev test rig</h1>
        <span className="text-xs text-zinc-500">
          Spawn fake players in iframes against any live room — no phone needed.
        </span>
      </header>

      <section className="grid gap-3 border-b border-zinc-800 p-4 md:grid-cols-[120px_100px_140px_140px_auto_auto]">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-zinc-400">Room code</span>
          <input
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))
            }
            placeholder="ABCD"
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono uppercase tracking-widest outline-none focus:border-zinc-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-zinc-400">Bots</span>
          <input
            type="number"
            min={1}
            max={12}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 outline-none focus:border-zinc-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-zinc-400">Mode</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 outline-none focus:border-zinc-500"
          >
            <option value="smart">smart (always correct)</option>
            <option value="random">random</option>
            <option value="wrong">always wrong</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-zinc-400">Lock delay (ms)</span>
          <input
            type="number"
            min={0}
            max={15000}
            step={100}
            value={delay}
            onChange={(e) => setDelay(Math.max(0, Math.min(15000, Number(e.target.value) || 0)))}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 outline-none focus:border-zinc-500"
          />
        </label>
        <div className="flex items-end gap-2">
          {!running ? (
            <button
              onClick={start}
              disabled={!validCode}
              className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              ▶ Spawn {count}
            </button>
          ) : (
            <button
              onClick={stop}
              className="rounded bg-red-500 px-4 py-2 text-sm font-semibold text-white"
            >
              ■ Stop all
            </button>
          )}
        </div>
        <div className="flex items-end">
          <a
            href={validCode ? `/host` : "#"}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
          >
            Open /host ↗
          </a>
        </div>
      </section>

      {!running ? (
        <div className="p-10 text-center text-sm text-zinc-500">
          1. Open <code className="rounded bg-zinc-900 px-1.5 py-0.5">/host</code> in another tab and copy the room code.
          <br />
          2. Paste the code, choose how many bots and how they should answer.
          <br />
          3. Click Spawn — each bot runs in its own iframe with an independent session.
        </div>
      ) : (
        <div className="grid gap-2 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: count }).map((_, i) => {
            const name = `${NAMES[i % NAMES.length]}${i >= NAMES.length ? Math.floor(i / NAMES.length) + 1 : ""}`;
            const src = `/dev/bot?code=${code}&name=${encodeURIComponent(name)}&mode=${mode}&delay=${delay}`;
            return (
              <iframe
                key={`${code}-${i}-${mode}-${delay}`}
                src={src}
                title={name}
                className="h-32 w-full rounded border border-zinc-800 bg-zinc-900"
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
