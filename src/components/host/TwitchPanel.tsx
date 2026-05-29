import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";

type Props = {
  questionKey: string; // resets votes when changed
  answers: [string, string, string, string] | string[];
  droppedIndexes: number[];
};

const LETTERS = ["A", "B", "C", "D"] as const;

// Lazy-loaded tmi.js client. We only initialize in the browser inside useEffect
// to avoid pulling Node-only deps into SSR.
type ChatClient = {
  connect: () => Promise<unknown>;
  disconnect: () => Promise<unknown>;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
};

export function TwitchPanel({ questionKey, answers, droppedIndexes }: Props) {
  const [channel, setChannel] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem("btd-twitch") ?? "",
  );
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [votes, setVotes] = useState<[number, number, number, number]>([0, 0, 0, 0]);
  const clientRef = useRef<ChatClient | null>(null);
  const votersRef = useRef<Map<string, number>>(new Map()); // user -> last vote idx

  // Reset votes on each new question
  useEffect(() => {
    votersRef.current = new Map();
    setVotes([0, 0, 0, 0]);
  }, [questionKey]);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect().catch(() => {});
      clientRef.current = null;
    };
  }, []);

  async function connect() {
    if (!channel.trim()) return;
    setError(null);
    try {
      const mod = await import("tmi.js");
      const tmi = (mod as unknown as { default: typeof import("tmi.js") }).default ?? mod;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client: ChatClient = new (tmi as any).Client({
        channels: [channel.trim().replace(/^#/, "")],
        connection: { reconnect: true, secure: true },
      });
      client.on("message", (...args: unknown[]) => {
        const tags = args[1] as { username?: string; "user-id"?: string } | undefined;
        const message = args[2] as string | undefined;
        const self = args[3] as boolean | undefined;
        if (self || !message) return;
        const m = message.trim().toUpperCase();
        const idx = LETTERS.indexOf(m as (typeof LETTERS)[number]);
        if (idx < 0) return;
        if (droppedIndexes.includes(idx)) return;
        const userId = tags?.["user-id"] ?? tags?.username ?? Math.random().toString();
        const prev = votersRef.current.get(userId);
        if (prev === idx) return;
        votersRef.current.set(userId, idx);
        setVotes((v) => {
          const next = [...v] as [number, number, number, number];
          if (typeof prev === "number") next[prev] = Math.max(0, next[prev] - 1);
          next[idx] = next[idx] + 1;
          return next;
        });
      });
      await client.connect();
      clientRef.current = client;
      setConnected(true);
      window.localStorage.setItem("btd-twitch", channel.trim());
    } catch (e) {
      setError((e as Error).message || "Failed to connect");
    }
  }

  async function disconnect() {
    await clientRef.current?.disconnect().catch(() => {});
    clientRef.current = null;
    setConnected(false);
  }

  const total = votes.reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-2xl border border-purple-500/40 bg-purple-950/40 p-3 text-xs text-purple-100 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-purple-400" />
          <span className="font-bold uppercase tracking-[0.2em]">{t("streamer_mode")}</span>
          {connected && <span className="text-[10px] text-purple-300">#{channel}</span>}
        </div>
        {connected ? (
          <button
            onClick={disconnect}
            className="rounded-full border border-purple-300/40 px-2 py-0.5 text-[10px] uppercase tracking-wider hover:bg-purple-500/20"
          >
            {t("disconnect")}
          </button>
        ) : (
          <div className="flex gap-1">
            <input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder={t("twitch_channel")}
              className="w-32 rounded-full border border-purple-400/40 bg-purple-900/40 px-2 py-0.5 text-[11px]"
            />
            <button
              onClick={connect}
              className="rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
            >
              {t("connect")}
            </button>
          </div>
        )}
      </div>
      {error && <div className="mt-1 text-[10px] text-rose-300">{error}</div>}
      {connected && (
        <div className="mt-2 space-y-1">
          {LETTERS.map((L, i) => {
            const pct = total ? Math.round((votes[i] / total) * 100) : 0;
            const dropped = droppedIndexes.includes(i);
            return (
              <div key={L} className={dropped ? "opacity-30" : ""}>
                <div className="flex justify-between text-[10px]">
                  <span className="font-mono">
                    {L}. {answers[i] ?? ""}
                  </span>
                  <span className="font-mono">
                    {votes[i]} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-purple-900/60">
                  <div
                    className="h-full bg-purple-400 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="pt-1 text-center text-[10px] text-purple-300">
            {total} chat vote{total === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </div>
  );
}
