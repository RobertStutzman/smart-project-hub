import { Haptics } from "@/hooks/use-haptics";
import { play } from "@/lib/sound-engine";

const SLOTS = [
  { key: "A", color: "bg-rose-500", ring: "ring-rose-300", shape: "circle" },
  { key: "B", color: "bg-amber-500", ring: "ring-amber-300", shape: "triangle" },
  { key: "C", color: "bg-emerald-500", ring: "ring-emerald-300", shape: "square" },
  { key: "D", color: "bg-sky-500", ring: "ring-sky-300", shape: "star" },
] as const;

function Shape({ kind }: { kind: (typeof SLOTS)[number]["shape"] }) {
  const cls = "h-10 w-10 opacity-15";
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
  labels?: [string, string, string, string] | string[];
  droppedIndexes?: number[];
  selectedIndex?: number | null;
  onPick: (index: 0 | 1 | 2 | 3) => void;
};

export function AnswerGrid({
  disabled,
  labels,
  droppedIndexes = [],
  selectedIndex = null,
  onPick,
}: Props) {
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-2">
      {SLOTS.map((slot, i) => {
        const dropped = droppedIndexes.includes(i);
        const selected = selectedIndex === i;
        const inactive = dropped || disabled;
        return (
          <button
            key={slot.key}
            disabled={inactive}
            onClick={() => {
              Haptics.tap();
              play("tap");
              onPick(i as 0 | 1 | 2 | 3);
            }}
            className={`relative flex items-center justify-center overflow-hidden rounded-2xl p-4 text-primary-foreground transition active:scale-[0.97] ${slot.color} ring-0 focus:outline-none focus:ring-4 ${slot.ring} ${
              dropped ? "opacity-30 grayscale" : ""
            } ${selected ? "ring-4 ring-white" : ""}`}
          >
            <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-black/25 font-display text-sm font-black text-white">
              {slot.key}
            </span>
            <div className="absolute right-2 bottom-2 text-white">
              <Shape kind={slot.shape} />
            </div>
            <span className="relative z-10 line-clamp-4 px-2 text-center text-xl font-bold leading-tight text-white drop-shadow sm:text-2xl">
              {labels?.[i] ?? slot.key}
            </span>
            {dropped && (
              <div className="absolute inset-0 grid place-items-center bg-black/40 text-6xl">
                ✕
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
