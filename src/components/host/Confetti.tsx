import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  shape: "rect" | "circ";
  life: number;
};

const PALETTE = [
  "#fcd34d", // amber-300
  "#f59e0b", // amber-500
  "#fb7185", // rose-400
  "#34d399", // emerald-400
  "#60a5fa", // blue-400
  "#c084fc", // purple-400
  "#ffffff",
];

type Props = {
  /** When this value changes, a new burst fires. */
  triggerKey: string | number;
  /** Continuous confetti while true (in addition to burst). */
  continuous?: boolean;
  /** Particles per burst. */
  count?: number;
};

export function Confetti({ triggerKey, continuous = false, count = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastEmitRef = useRef<number>(0);

  // Animation loop — always running so continuous mode keeps spawning
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      // Cap DPR at 1.5 — full-viewport canvas at 3x retina was the main
      // source of fill-rate jank ("graffiti" look from choppy specks).
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Hard cap so a long winner screen can't pile up hundreds of sprites.
    const MAX_PARTICLES = 220;

    const step = (t: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      // Gentler continuous rain — fewer particles, slower cadence.
      if (
        continuous &&
        t - lastEmitRef.current > 180 &&
        particlesRef.current.length < MAX_PARTICLES
      ) {
        lastEmitRef.current = t;
        spawnBurst(particlesRef.current, w, h, 5, "top");

      }

      const ps = particlesRef.current;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.vy += 0.08; // softer gravity → smoother, more floaty fall
        p.vx *= 0.992;
        // Gentle horizontal sway so pieces drift like real confetti
        p.vx += Math.sin((t + p.life * 7) * 0.002) * 0.02;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 1;
        if (p.y > h + 40 || p.life <= 0) {
          ps.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, p.life / 80);
        if (p.shape === "rect") {
          // Wider, ribbon-like rectangles read as confetti, not specks
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.45);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      rafRef.current = window.requestAnimationFrame(step);
    };
    rafRef.current = window.requestAnimationFrame(step);
    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [continuous]);

  // Burst on trigger change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    spawnBurst(particlesRef.current, canvas.clientWidth, canvas.clientHeight, count, "sides");
  }, [triggerKey, count]);


  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-40 h-full w-full"
      aria-hidden
    />
  );
}

function spawnBurst(
  ps: Particle[],
  w: number,
  h: number,
  n: number,
  origin: "sides" | "top",
) {
  for (let i = 0; i < n; i++) {
    const fromLeft = origin === "sides" ? i % 2 === 0 : Math.random() < 0.5;
    const x = origin === "top" ? Math.random() * w : fromLeft ? -10 : w + 10;
    const y = origin === "top" ? -10 : h * (0.55 + Math.random() * 0.3);
    const angle =
      origin === "top"
        ? Math.PI / 2 + (Math.random() - 0.5) * 0.6
        : (fromLeft ? 0 : Math.PI) + (Math.random() - 0.5) * 0.9 - Math.PI / 2.5;
    const speed = origin === "top" ? 2 + Math.random() * 2 : 8 + Math.random() * 7;
    ps.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (origin === "sides" ? 3 + Math.random() * 3 : 0),
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      size: 8 + Math.random() * 8,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      shape: Math.random() < 0.7 ? "rect" : "circ",
      life: 220 + Math.random() * 120,
    });
  }
}
