import { useEffect, useRef } from "react";
import { MemeScorecard, computeBadge } from "@/components/MemeScorecard";
import { Haptics } from "@/hooks/use-haptics";

type Props = {
  me: {
    nickname: string;
    avatar_url: string | null;
    score: number;
    correct_count: number;
    wrong_count: number;
    best_streak: number;
    fastest_count: number;
    total_response_ms: number;
    answered_count: number;
  };
  rank: number;
  totalPlayers: number;
  roomCode: string;
};

export function PlayerVictoryScreen({ me, rank, totalPlayers, roomCode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Phone-side confetti burst — small + battery-friendly
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      canvas!.width = canvas!.clientWidth * dpr;
      canvas!.height = canvas!.clientHeight * dpr;
    }
    resize();
    window.addEventListener("resize", resize);

    const count = rank === 1 ? 90 : rank <= 3 ? 60 : 30;
    const colors =
      rank === 1
        ? ["#fcd34d", "#fbbf24", "#f59e0b", "#fff", "#fde68a"]
        : rank <= 3
          ? ["#a78bfa", "#f0abfc", "#fcd34d", "#fff"]
          : ["#94a3b8", "#cbd5e1", "#e2e8f0"];

    type P = { x: number; y: number; vx: number; vy: number; r: number; c: string; a: number; spin: number };
    const parts: P[] = Array.from({ length: count }, () => ({
      x: canvas.width / 2,
      y: -10,
      vx: (Math.random() - 0.5) * 6 * dpr,
      vy: (Math.random() * 3 + 2) * dpr,
      r: (Math.random() * 4 + 2) * dpr,
      c: colors[Math.floor(Math.random() * colors.length)],
      a: 1,
      spin: Math.random() * Math.PI,
    }));

    Haptics.tap();
    if (rank === 1) setTimeout(() => Haptics.tap(), 150);

    let raf = 0;
    function tick() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      let alive = false;
      for (const p of parts) {
        p.vy += 0.12 * dpr;
        p.x += p.vx;
        p.y += p.vy;
        p.spin += 0.05;
        p.a -= 0.005;
        if (p.a > 0 && p.y < canvas!.height + 20) {
          alive = true;
          ctx!.save();
          ctx!.globalAlpha = Math.max(0, p.a);
          ctx!.translate(p.x, p.y);
          ctx!.rotate(p.spin);
          ctx!.fillStyle = p.c;
          ctx!.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
          ctx!.restore();
        }
      }
      if (alive) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [rank]);

  const isChamp = rank === 1;
  const isPodium = rank <= 3;
  const ribbon = isChamp
    ? { text: "🏆 CHAMPION", from: "from-amber-300", to: "to-amber-500", tint: "text-amber-950" }
    : rank === 2
      ? { text: "🥈 RUNNER-UP", from: "from-slate-200", to: "to-slate-400", tint: "text-slate-900" }
      : rank === 3
        ? { text: "🥉 THIRD PLACE", from: "from-orange-300", to: "to-orange-500", tint: "text-orange-950" }
        : { text: `#${rank} of ${totalPlayers}`, from: "from-violet-400", to: "to-fuchsia-500", tint: "text-white" };

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden py-2">
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {/* Ribbon */}
      <div
        className={`relative mb-3 rounded-full bg-gradient-to-r ${ribbon.from} ${ribbon.to} px-5 py-1.5 text-xs font-black uppercase tracking-[0.25em] ${ribbon.tint} shadow-[0_8px_30px_-8px_rgba(251,191,36,0.6)] ${isChamp ? "animate-pulse" : ""}`}
      >
        {ribbon.text}
      </div>
      {isPodium && (
        <div className="relative mb-2 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Game over — final result
          </div>
        </div>
      )}
      <div className="relative">
        <MemeScorecard
          stats={{
            nickname: me.nickname,
            avatar_url: me.avatar_url,
            score: me.score,
            rank,
            totalPlayers,
            correct: me.correct_count,
            wrong: me.wrong_count,
            bestStreak: me.best_streak,
            fastestCount: me.fastest_count,
            avgResponseMs:
              me.answered_count > 0 ? Math.round(me.total_response_ms / me.answered_count) : 0,
            badge: computeBadge({
              rank,
              fastestCount: me.fastest_count,
              wrong: me.wrong_count,
              correct: me.correct_count,
              bestStreak: me.best_streak,
            }),
            roomCode,
          }}
        />
      </div>
    </div>
  );
}
