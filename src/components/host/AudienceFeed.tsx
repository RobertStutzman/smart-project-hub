import { useEffect, useState } from "react";
import {
  subscribeAudienceFeed,
  type AudienceFeedEvent,
} from "@/lib/audience-feed";

const HOLD_MS = 2500;
const MAX_VISIBLE = 3;

export function AudienceFeed() {
  const [items, setItems] = useState<AudienceFeedEvent[]>([]);

  useEffect(() => {
    return subscribeAudienceFeed((e) => {
      setItems((prev) => [...prev, e].slice(-MAX_VISIBLE));
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== e.id));
      }, HOLD_MS);
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-30 flex flex-col gap-1.5">
      <style>{`
        @keyframes audFeedIn {
          0% { opacity: 0; transform: translateX(-12px); }
          15% { opacity: 1; transform: translateX(0); }
          80% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(-6px); }
        }
      `}</style>
      {items.map((e) => {
        const text =
          e.kind === "react"
            ? `${e.nickname} ${e.emoji ?? ""}`.trim()
            : `${e.emoji ? e.emoji + " " : ""}${e.nickname}${
                e.label ? ` · ${e.label}` : ""
              }`;
        return (
          <div
            key={e.id}
            className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-medium text-white/55 backdrop-blur-md"
            style={{ animation: `audFeedIn ${HOLD_MS}ms ease-out forwards` }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}
