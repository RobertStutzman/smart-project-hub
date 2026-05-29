import { Haptics } from "@/hooks/use-haptics";
import { play } from "@/lib/sound-engine";

// Four distinct color + geometric watermark pairs for colorblind support.
const SLOTS = [
  { key: "A", color: "bg-rose-500", ring: "ring-rose-300", shape: "circle" },
  { key: "B", color: "bg-amber-500", ring: "ring-amber-300", shape: "triangle" },
  { key: "C", color: "bg-emerald-500", ring: "ring-emerald-300", shape: "square" },
  { key: "D", color: "bg-sky-500", ring: "ring-sky-300", shape: "star" },
] as const;

function Shape({ kind }: { kind: (typeof SLOTS)[number]["shape"] }) {
  const cls = "h-16 w-16 opacity-25";
  switch (kind) {
    case "circle":
      return <svg viewBox="0 0 24 24" className={cls}><circle cx="12" cy="12" r="9" fill="currentColor" /></svg>;
    case "triangle":
      return <svg viewBox="0 0 24 24" className={cls}><polygon points="12,3 22,21 2,21" fill="currentColor" /></svg>;
    case "square":
      return <svg viewBox="0 0 24 24" className={cls}><rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" /></svg>;
    case "star":
      return (
        <svg viewBox="0 0 24 24" className={cls}>
          <polygon
            points="12,2 15,9 22,9 16.5,13.5 18.5,21 12,16.5 5.5,21 7.5,13.5 2,9 9,9"
            fill="currentColor"
          />
        </svg>
      );
  }
}

type Props = {
  disabled?: boolean;
  labels?: [string, string, string, string];
  onPick: (index: 0 | 1 | 2 | 3) => void;
};

export function AnswerGrid({ disabled, labels, onPick }: Props) {
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-2">
      {SLOTS.map((slot, i) => (
        <button
          key={slot.key}
          disabled={disabled}
          onClick={() => {
            Haptics.tap();
            play("tap");
            onPick(i as 0 | 1 | 2 | 3);
          }}
          className={`relative flex flex-col items-center justify-center overflow-hidden rounded-2xl text-primary-foreground transition active:scale-[0.97] disabled:opacity-50 ${slot.color} ring-0 focus:outline-none focus:ring-4 ${slot.ring}`}
        >
          <div className="absolute inset-0 grid place-items-center text-white">
            <Shape kind={slot.shape} />
          </div>
          <div className="relative z-10 flex flex-col items-center gap-1 px-3 text-center">
            <span className="font-display text-4xl font-black drop-shadow">
              {slot.key}
            </span>
            {labels?.[i] && (
              <span className="line-clamp-2 text-sm font-semibold">{labels[i]}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
