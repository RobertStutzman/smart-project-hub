import { Haptics } from "@/hooks/use-haptics";
import { play } from "@/lib/sound-engine";

const LETTERS = ["A", "B", "C", "D"] as const;

type TileAvatar = { id: string; nickname: string; avatar_url: string | null };

type Props = {
  disabled?: boolean;
  labels?: [string, string, string, string] | string[];
  droppedIndexes?: number[];
  selectedIndex?: number | null;
  correctIndex?: number | null;
  onPick: (index: 0 | 1 | 2 | 3) => void;
  /** Avatars to show on each tile (others' live picks). */
  avatarsByIndex?: TileAvatar[][];
};

export function AnswerGrid({
  disabled,
  labels,
  droppedIndexes = [],
  selectedIndex = null,
  correctIndex = null,
  onPick,
  avatarsByIndex,
}: Props) {
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-3">
      {LETTERS.map((letter, i) => {
        const dropped = droppedIndexes.includes(i);
        const selected = selectedIndex === i;
        const inactive = dropped || disabled;
        const isCorrect = correctIndex === i;
        const isWrongReveal = correctIndex !== null && correctIndex !== undefined && !isCorrect;
        const tileAvatars = avatarsByIndex?.[i] ?? [];
        return (
          <button
            key={letter}
            disabled={inactive}
            onClick={() => {
              Haptics.tap();
              play("tap");
              onPick(i as 0 | 1 | 2 | 3);
            }}
            className={`relative flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left backdrop-blur-xl transition active:scale-[0.97] ${
              dropped
                ? "border-rose-500/30 bg-rose-950/20 opacity-40 grayscale"
                : isCorrect
                  ? "border-amber-300/80 bg-gradient-to-br from-amber-400/25 to-amber-600/10 shadow-[0_0_40px_oklch(0.85_0.18_85/0.6)]"
                  : isWrongReveal
                    ? "border-white/10 bg-white/[0.03] opacity-40"
                    : selected
                      ? "border-emerald-300/80 bg-emerald-500/15 shadow-[0_0_30px_oklch(0.7_0.2_150/0.5)] ring-2 ring-emerald-300"
                      : "border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_30px_rgba(0,0,0,0.4)]"
            }`}
          >
            <div className="flex items-start justify-between">
              <div
                className={`grid h-9 w-9 place-items-center rounded-full font-display text-base font-black ${
                  isCorrect
                    ? "bg-amber-300 text-amber-950"
                    : selected
                      ? "bg-emerald-300 text-emerald-950"
                      : "bg-white/10 text-white/90 ring-1 ring-white/20"
                }`}
              >
                {letter}
              </div>
            </div>

            <div className="my-2 line-clamp-4 text-base font-bold leading-tight text-white sm:text-lg">
              {labels?.[i] ?? letter}
            </div>

            {tileAvatars.length > 0 && !dropped && (
              <div className="flex flex-wrap items-center gap-1">
                {tileAvatars.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    title={p.nickname}
                    className="h-5 w-5 overflow-hidden rounded-full ring-1 ring-white/40 animate-scale-in"
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.nickname} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-black/40 text-[9px] font-black text-white">
                        {p.nickname.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
                {tileAvatars.length > 6 && (
                  <div className="text-[10px] font-black text-white/70">+{tileAvatars.length - 6}</div>
                )}
              </div>
            )}

            {dropped && (
              <div className="absolute inset-0 grid place-items-center text-6xl font-black text-rose-400/80 drop-shadow-[0_0_20px_rgba(244,63,94,0.7)]">
                ✕
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
