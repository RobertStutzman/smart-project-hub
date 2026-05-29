import { Haptics } from "@/hooks/use-haptics";
import { supabase } from "@/integrations/supabase/client";
import type { Sfx } from "@/lib/sound-engine";

const PADS: { label: string; sfx: Sfx; emoji: string; color: string }[] = [
  { label: "Airhorn", sfx: "airhorn", emoji: "📣", color: "bg-rose-500" },
  { label: "Crickets", sfx: "crickets", emoji: "🦗", color: "bg-emerald-500" },
  { label: "Boo", sfx: "boo", emoji: "👻", color: "bg-violet-500" },
];

type Props = { roomCode: string };

export function AudienceSoundboard({ roomCode }: Props) {
  async function fire(sfx: Sfx) {
    Haptics.tap();
    const channel = supabase.channel(`sfx-${roomCode}`);
    await channel.subscribe();
    await channel.send({ type: "broadcast", event: "sfx", payload: { sfx } });
    setTimeout(() => void supabase.removeChannel(channel), 500);
  }

  return (
    <div className="rounded-3xl border border-border bg-card/50 p-5 backdrop-blur">
      <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Audience soundboard
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PADS.map((p) => (
          <button
            key={p.sfx}
            onClick={() => void fire(p.sfx)}
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
