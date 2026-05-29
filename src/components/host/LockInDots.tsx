type Player = {
  id: string;
  nickname: string;
  current_answer: number | null;
};

export function LockInDots({ players }: { players: Player[] }) {
  if (players.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {players.map((p) => {
        const locked = p.current_answer !== null;
        return (
          <span
            key={p.id}
            title={p.nickname}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              locked ? "bg-emerald-400 shadow-[0_0_8px_oklch(0.75_0.2_150)]" : "bg-muted"
            }`}
          />
        );
      })}
    </div>
  );
}
