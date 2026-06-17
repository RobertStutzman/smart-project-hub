import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isAdultMode, setAdultMode } from "@/lib/adult-mode";

export const Route = createFileRoute("/settings/adult")({
  head: () => ({
    meta: [
      { title: "Adult Mode — Beat the Drop" },
      { name: "description", content: "18+ only. Crude announcer language." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdultSettingsPage,
});

function AdultSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ageOk, setAgeOk] = useState(false);
  const [tosOk, setTosOk] = useState(false);

  useEffect(() => {
    setEnabled(isAdultMode());
  }, []);

  function handleToggle() {
    if (enabled) {
      setAdultMode(false);
      setEnabled(false);
      return;
    }
    setAgeOk(false);
    setTosOk(false);
    setConfirming(true);
  }

  function confirm() {
    if (!ageOk || !tosOk) return;
    setAdultMode(true);
    setEnabled(true);
    setConfirming(false);
  }

  function cancel() {
    setConfirming(false);
    setAgeOk(false);
    setTosOk(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link to="/" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
          ← Back home
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <span className="text-3xl" aria-hidden>🔞</span>
          <h1 className="font-display text-4xl font-black">Adult Mode</h1>
        </div>

        <div className="mt-6 rounded-3xl border-2 border-red-500/70 bg-red-500/5 p-5">
          <p className="text-sm font-semibold text-red-300">
            18+ ONLY. Crude language and sexual humor in the announcer.
          </p>
          <p className="mt-2 text-xs text-red-200/80">
            Built for the college crowd. The host voice will swear (f-bombs, shit, asshole, dick) and make crude jokes
            between questions, on reveals, and in the credits. Question content is unchanged.
          </p>
          <p className="mt-2 text-xs font-semibold text-red-200">
            Auto-resets when you leave the game. Adult Mode is stored only for this browser tab — close the tab, end
            the game, or open a fresh window and it turns off automatically. It will NEVER be on by default next time
            someone (or their kid) opens the app.
          </p>
        </div>

        <section className="mt-8 rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Adult announcer</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {enabled ? "Currently ON — gloves off. Resets when this tab closes." : "Currently OFF — the show stays PG-13."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${
                enabled
                  ? "bg-red-500 text-white"
                  : "border border-border bg-background/60 text-foreground hover:bg-card/60"
              }`}
            >
              {enabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        </section>

        <p className="mt-8 text-xs text-muted-foreground">
          Also see <Link to="/settings/streamer" className="underline">Streamer mode</Link>.
        </p>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-md rounded-3xl border-2 border-red-500/70 bg-card p-6 shadow-2xl">
            <h3 className="text-xl font-black">Confirm 18+</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Adult Mode unleashes crude profanity and sexual humor from the host. Not for kids, not for the office,
              definitely not for family game night with grandma.
            </p>

            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-border bg-background/40 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={ageOk}
                onChange={(e) => setAgeOk(e.target.checked)}
                className="mt-1 h-4 w-4 accent-red-500"
              />
              <span className="text-xs text-foreground">
                I confirm I am <strong>18 years or older</strong> and that no minors are in the room.
              </span>
            </label>

            <label className="mt-2 flex items-start gap-3 rounded-2xl border border-border bg-background/40 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={tosOk}
                onChange={(e) => setTosOk(e.target.checked)}
                className="mt-1 h-4 w-4 accent-red-500"
              />
              <span className="text-xs text-foreground">
                I agree to the{" "}
                <Link to="/terms" className="underline">Terms of Service</Link> and accept full responsibility for who
                hears this content. I understand Adult Mode will auto-disable when this tab closes or the game ends.
              </span>
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancel}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-card/60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!ageOk || !tosOk}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                I am 18+, enable it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
