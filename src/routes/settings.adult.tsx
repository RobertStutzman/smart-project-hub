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

  useEffect(() => {
    setEnabled(isAdultMode());
  }, []);

  function handleToggle() {
    if (enabled) {
      setAdultMode(false);
      setEnabled(false);
      return;
    }
    setConfirming(true);
  }

  function confirm() {
    setAdultMode(true);
    setEnabled(true);
    setConfirming(false);
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
            Do not enable around minors. The host voice will swear (f-bombs, shit, asshole, dick) and make crude jokes between
            questions, on reveals, and in the credits. Question content is unchanged. This is a per-device setting, stored only
            in your browser.
          </p>
        </div>

        <section className="mt-8 rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Adult announcer</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {enabled ? "Currently ON — gloves off." : "Currently OFF — the show stays PG-13."}
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
              By enabling Adult Mode you confirm you are 18 or older and accept that the host will use profanity and crude
              sexual humor. This is not for kids. Definitely not for family game night with grandma.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-card/60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
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
