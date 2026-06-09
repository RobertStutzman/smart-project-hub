import { useEffect, useRef, useState } from "react";
import { Haptics } from "@/hooks/use-haptics";
import { supabase } from "@/integrations/supabase/client";
import { AUDIENCE_TABS, type AudienceTab } from "@/lib/audience-sfx";
import { playClipUrl } from "@/lib/sound-engine";

const REACTIONS = ["🔥", "💀", "😂", "❤️", "👏", "🤯"] as const;
type Reaction = (typeof REACTIONS)[number];
type Float = { id: number; emoji: Reaction; x: number };

type Props = { roomCode: string; nickname: string; sessionId: string };

export function AudienceSoundboard({ roomCode, nickname, sessionId }: Props) {
  const [tabId, setTabId] = useState<AudienceTab["id"]>("gross");
  const [floats, setFloats] = useState<Float[]>([]);
  const idRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const ch = supabase.channel(`sfx-${roomCode}`);
    void ch.subscribe();
    channelRef.current = ch;
    ch.on("broadcast", { event: "react" }, (msg) => {
      const e = (msg.payload as { emoji?: Reaction } | undefined)?.emoji;
      if (!e || !REACTIONS.includes(e)) return;
      const id = ++idRef.current;
      setFloats((f) => [...f, { id, emoji: e, x: Math.random() * 80 + 10 }]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1800);
    });
    return () => {
      void supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [roomCode]);

  async function firePad(padId: string, url: string, volume: number, label: string, emoji: string) {
    Haptics.tap();
    // Local preview so the audience hears their own pad too
    playClipUrl(url, Math.min(0.6, volume), padId);
    await channelRef.current?.send({
      type: "broadcast",
      event: "sfx_url",
      payload: { padId, url, volume, nickname, sessionId, label, emoji },
    });
  }

  async function fireReact(emoji: Reaction) {
    Haptics.tap();
    const id = ++idRef.current;
    setFloats((f) => [...f, { id, emoji, x: Math.random() * 80 + 10 }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1800);
    await channelRef.current?.send({
      type: "broadcast",
      event: "react",
      payload: { emoji, nickname, sessionId },
    });
  }


  const activeTab = AUDIENCE_TABS.find((t) => t.id === tabId) ?? AUDIENCE_TABS[0];

  return (
    <div className="relative rounded-3xl border border-border bg-card/50 p-4 backdrop-blur">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0 overflow-hidden">
        {floats.map((f) => (
          <span
            key={f.id}
            className="absolute bottom-2 text-3xl animate-[reactFloat_1.8s_ease-out_forwards]"
            style={{ left: `${f.x}%` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes reactFloat {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          15% { transform: translateY(-10px) scale(1.1); opacity: 1; }
          100% { transform: translateY(-180px) scale(0.9); opacity: 0; }
        }
      `}</style>

      <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Reactions
      </div>
      <div className="mb-4 grid grid-cols-6 gap-1.5">
        {REACTIONS.map((e) => (
          <button
            key={e}
            onClick={() => void fireReact(e)}
            className="grid aspect-square place-items-center rounded-xl border border-border bg-background/60 text-2xl active:scale-90 transition hover:bg-accent"
          >
            {e}
          </button>
        ))}
      </div>

      <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Soundboard
      </div>

      {/* Tabs */}
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {AUDIENCE_TABS.map((t) => {
          const active = t.id === tabId;
          return (
            <button
              key={t.id}
              onClick={() => {
                Haptics.tap();
                setTabId(t.id);
              }}
              className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition ${
                active
                  ? `${t.color} border-transparent text-white shadow-lg scale-[1.02]`
                  : "border-border bg-background/40 text-muted-foreground"
              }`}
            >
              <span className="text-xl leading-none">{t.emoji}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Pad grid */}
      <div className="grid grid-cols-3 gap-2">
        {activeTab.pads.map((p) => (
          <button
            key={p.id}
            onClick={() => void firePad(p.id, p.url, p.volume, p.label, p.emoji)}
            className={`flex flex-col items-center gap-1 rounded-2xl ${activeTab.color} px-2 py-4 text-white active:scale-95 transition hover:brightness-110`}
          >
            <span className="text-3xl leading-none">{p.emoji}</span>
            <span className="text-[11px] font-semibold leading-tight text-center">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
