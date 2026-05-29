import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Haptics } from "@/hooks/use-haptics";

type Stats = {
  nickname: string;
  avatar_url: string | null;
  score: number;
  rank: number;
  totalPlayers: number;
  correct: number;
  wrong: number;
  bestStreak: number;
  fastestCount: number;
  avgResponseMs: number;
  badge: string; // e.g. "Fastest Finger", "Most Wrong", "Streak Lord"
  roomCode: string;
};

export function MemeScorecard({ stats }: { stats: Stats }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function exportImg() {
    if (!ref.current) return;
    setBusy(true);
    Haptics.tap();
    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      // Try Web Share, then fallback to download
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `scorecard-${stats.roomCode}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Beat the Drop scorecard" });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `beatthedrop-${stats.roomCode}.png`;
        a.click();
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  const accuracy =
    stats.correct + stats.wrong > 0
      ? Math.round((stats.correct / (stats.correct + stats.wrong)) * 100)
      : 0;
  const avgS = stats.avgResponseMs > 0 ? (stats.avgResponseMs / 1000).toFixed(2) : "—";

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={ref}
        className="relative w-[340px] overflow-hidden rounded-3xl p-5 text-white"
        style={{
          background:
            "linear-gradient(140deg, oklch(0.25 0.18 295) 0%, oklch(0.35 0.22 350) 50%, oklch(0.3 0.2 25) 100%)",
        }}
      >
        <div className="absolute inset-0 opacity-25 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 10%, white 1px, transparent 1.5px), radial-gradient(circle at 70% 60%, white 1px, transparent 1.5px)",
            backgroundSize: "40px 40px, 70px 70px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="h-16 w-16 overflow-hidden rounded-2xl border-2 border-white/60 bg-white/10">
            {stats.avatar_url ? (
              <img src={stats.avatar_url} alt={stats.nickname} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-2xl font-black">
                {stats.nickname.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.25em] opacity-80">
              Beat the Drop · #{stats.roomCode}
            </div>
            <div className="truncate font-display text-2xl font-black leading-tight">
              {stats.nickname}
            </div>
            <div className="text-xs opacity-80">
              Rank {stats.rank} of {stats.totalPlayers}
            </div>
          </div>
        </div>

        <div className="relative mt-4 rounded-2xl bg-black/30 px-4 py-3 text-center backdrop-blur-sm">
          <div className="text-[10px] uppercase tracking-[0.25em] opacity-70">Final score</div>
          <div className="font-mono text-5xl font-black leading-none">{stats.score}</div>
        </div>

        <div className="relative mt-3 inline-block rounded-full bg-amber-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-950">
          🏅 {stats.badge}
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2 text-center text-[11px]">
          <StatChip label="Correct" value={String(stats.correct)} />
          <StatChip label="Wrong" value={String(stats.wrong)} />
          <StatChip label="Accuracy" value={`${accuracy}%`} />
          <StatChip label="Avg time" value={`${avgS}s`} />
          <StatChip label="Best streak" value={`🔥 ${stats.bestStreak}`} />
          <StatChip label="Fastest" value={`⚡ ${stats.fastestCount}`} />
        </div>

        <div className="relative mt-4 text-center text-[10px] uppercase tracking-[0.25em] opacity-60">
          beatthedrop.live
        </div>
      </div>

      <button
        onClick={() => void exportImg()}
        disabled={busy}
        className="w-full rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "Generating…" : "Export to socials 📲"}
      </button>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.2em] opacity-70">{label}</div>
      <div className="font-mono text-base font-black">{value}</div>
    </div>
  );
}

export function computeBadge(p: {
  rank: number;
  fastestCount: number;
  wrong: number;
  correct: number;
  bestStreak: number;
}): string {
  if (p.rank === 1) return "Champion";
  if (p.fastestCount >= 3) return "Fastest Finger";
  if (p.bestStreak >= 5) return "Streak Lord";
  if (p.wrong > p.correct && p.wrong >= 3) return "Most Wrong";
  if (p.correct === 0) return "Heart of Gold";
  return "Survivor";
}
