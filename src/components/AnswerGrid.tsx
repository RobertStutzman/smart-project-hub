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
            className={`relative flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border p-4 text-left transition active:scale-[0.97] ${
              dropped
                ? "border-destructive/40 bg-destructive/10 text-foreground/50 opacity-50 grayscale"
                : isCorrect
                  ? "border-accent bg-accent/20 text-foreground shadow-[0_0_30px_color-mix(in_oklab,var(--accent)_50%,transparent)]"
                  : isWrongReveal
                    ? "border-border bg-card/40 text-foreground/40 opacity-60"
                    : selected
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_0_30px_color-mix(in_oklab,var(--primary)_45%,transparent)] ring-2 ring-primary"
                      : "border-border bg-card text-card-foreground shadow-sm hover:bg-card/80"
            }`}
          >
            <div className="flex items-start justify-between">
              <div
                className={`grid h-9 w-9 place-items-center rounded-full font-display text-base font-black ${
                  isCorrect
                    ? "bg-accent text-accent-foreground"
                    : selected
                      ? "bg-primary-foreground text-primary"
                      : "bg-primary/15 text-primary ring-1 ring-primary/30"
                }`}
              >
                {letter}
              </div>
            </div>

            <div className="my-2 line-clamp-4 text-base font-bold leading-tight sm:text-lg">
              {labels?.[i] ?? letter}
            </div>

            {tileAvatars.length > 0 && !dropped && (
              <div className="flex flex-wrap items-center gap-1">
                {tileAvatars.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    title={p.nickname}
                    className="h-5 w-5 overflow-hidden rounded-full ring-1 ring-border animate-scale-in"
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.nickname} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-muted text-[9px] font-black text-muted-foreground">
                        {p.nickname.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
                {tileAvatars.length > 6 && (
                  <div className="text-[10px] font-black text-muted-foreground">+{tileAvatars.length - 6}</div>
                )}
              </div>
            )}

            {dropped && (
              <div className="absolute inset-0 grid place-items-center text-6xl font-black text-destructive/70 drop-shadow">
                ✕
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
