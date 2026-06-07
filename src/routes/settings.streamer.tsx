import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/settings/streamer")({
  head: () => ({
    meta: [
      { title: "Streamer Mode — Beat the Drop" },
      { name: "description", content: "Enable Twitch chat voting on the host TV." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StreamerSettingsPage,
});

function StreamerSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [channel, setChannel] = useState("");

  useEffect(() => {
    setEnabled(window.localStorage.getItem("btd-twitch-enabled") === "1");
    setChannel(window.localStorage.getItem("btd-twitch") ?? "");
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem("btd-twitch-enabled", next ? "1" : "0");
  }

  function saveChannel(v: string) {
    setChannel(v);
    window.localStorage.setItem("btd-twitch", v.trim());
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link to="/" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
          ← Back home
        </Link>

        <h1 className="mt-6 font-display text-4xl font-black">Streamer mode</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Off by default — it's distracting on the host TV. Turn it on here if you want Twitch chat to vote A/B/C/D during questions. Settings are stored on this device.
        </p>

        <section className="mt-8 rounded-3xl border border-border bg-card/40 p-6 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Twitch chat voting</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Shows a live chat vote tally next to each question.
              </p>
            </div>
            <button
              type="button"
              onClick={toggle}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${
                enabled
                  ? "bg-purple-500 text-white"
                  : "border border-border bg-background/60 text-foreground hover:bg-card/60"
              }`}
            >
              {enabled ? "Enabled" : "Disabled"}
            </button>
          </div>

          {enabled && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Default channel
              </label>
              <input
                value={channel}
                onChange={(e) => saveChannel(e.target.value)}
                placeholder="your_twitch_handle"
                className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-sm"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
