import { useEffect, useRef, useState } from "react";
import { Haptics } from "@/hooks/use-haptics";
import { supabase } from "@/integrations/supabase/client";
import type { Sfx } from "@/lib/sound-engine";

const PADS: { label: string; sfx: Sfx; emoji: string; color: string }[] = [
  { label: "Airhorn", sfx: "airhorn", emoji: "📣", color: "bg-rose-500" },
  { label: "Crickets", sfx: "crickets", emoji: "🦗", color: "bg-emerald-500" },
  { label: "Boo", sfx: "boo", emoji: "👻", color: "bg-violet-500" },
];

// Lightweight floating reactions — broadcast emoji that pop on every screen
const REACTIONS = ["🔥", "💀", "😂", "❤️", "👏", "🤯"] as const;
type Reaction = (typeof REACTIONS)[number];

type Float = { id: number; emoji: Reaction; x: number };

type Props = { roomCode: string };

export function AudienceSoundboard({ roomCode }: Props) {
  const [floats, setFloats] = useState<Float[]>([]);
  const idRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Keep one persistent channel for both SFX and reactions
  useEffect(() => {
    const ch = supabase.channel(`sfx-${roomCode}`);
    void ch.subscribe();
    channelRef.current = ch;
    // Also subscribe to others' reactions so my screen shows the crowd
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

  async function fireSfx(sfx: Sfx) {
    Haptics.tap();
    await channelRef.current?.send({ type: "broadcast", event: "sfx", payload: { sfx } });
  }

  async function fireReact(emoji: Reaction) {
    Haptics.tap();
    // Local pop immediately (don't wait for broadcast loopback)
    const id = ++idRef.current;
    setFloats((f) => [...f, { id, emoji, x: Math.random() * 80 + 10 }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1800);
    await channelRef.current?.send({ type: "broadcast", event: "react", payload: { emoji } });
  }

  return (
    <div className="relative rounded-3xl border border-border bg-card/50 p-5 backdrop-blur">
      {/* Floating reactions overlay */}
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
        Audience reactions
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
      <div className="grid grid-cols-3 gap-2">
        {PADS.map((p) => (
          <button
            key={p.sfx}
            onClick={() => void fireSfx(p.sfx)}
            className={`flex flex-col items-center gap-1 rounded-2xl ${p.color} px-2 py-4 text-primary-foreground active:scale-95 transition`}
          >
            <span className="text-3xl">{p.emoji}</span>
            <span className="text-xs font-semibold">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
