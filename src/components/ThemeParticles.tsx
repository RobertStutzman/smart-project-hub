import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeProvider";

/**
 * Full-viewport canvas particle layer that switches behavior per theme.
 * - fellowship: embers + dust drifting upward
 * - synthwave:  perspective grid sliding toward camera
 * - sanctuary:  slow diagonal light rays
 * Pauses while tab hidden and respects prefers-reduced-motion.
 */
export function ThemeParticles() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    type Ember = { x: number; y: number; vy: number; r: number; hue: number; a: number };
    const embers: Ember[] = [];
    if (theme === "fellowship") {
      for (let i = 0; i < 80; i++) {
        embers.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vy: 0.2 + Math.random() * 0.6,
          r: 0.5 + Math.random() * 1.8,
          hue: 30 + Math.random() * 25,
          a: 0.2 + Math.random() * 0.6,
        });
      }
    }

    let gridOffset = 0;

    let rayPhase = 0;

    let raf = 0;
    let running = !document.hidden && !reduced;

    function frame() {
      ctx!.clearRect(0, 0, w, h);

      if (theme === "fellowship") {
        for (const e of embers) {
          e.y -= e.vy;
          e.x += Math.sin((e.y + e.hue) * 0.01) * 0.2;
          if (e.y < -10) {
            e.y = h + 10;
            e.x = Math.random() * w;
          }
          ctx!.beginPath();
          ctx!.fillStyle = `hsla(${e.hue}, 90%, 60%, ${e.a})`;
          ctx!.shadowColor = `hsla(${e.hue}, 100%, 60%, ${e.a})`;
          ctx!.shadowBlur = 8;
          ctx!.arc(e.x, e.y, e.r, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.shadowBlur = 0;
      } else if (theme === "synthwave") {
        gridOffset = (gridOffset + 1.2) % 40;
        const horizon = h * 0.55;
        ctx!.strokeStyle = "rgba(255, 30, 200, 0.5)";
        ctx!.lineWidth = 1;
        // Horizontal lines (perspective)
        for (let i = 0; i < 18; i++) {
          const t = (i + gridOffset / 40) / 18;
          const y = horizon + Math.pow(t, 2) * (h - horizon);
          if (y > h) continue;
          ctx!.globalAlpha = 1 - t * 0.8;
          ctx!.beginPath();
          ctx!.moveTo(0, y);
          ctx!.lineTo(w, y);
          ctx!.stroke();
        }
        // Vertical lines converging
        ctx!.globalAlpha = 0.6;
        ctx!.strokeStyle = "rgba(0, 230, 255, 0.5)";
        const vanishX = w / 2;
        for (let i = -10; i <= 10; i++) {
          const x = vanishX + (i * w) / 6;
          ctx!.beginPath();
          ctx!.moveTo(x, h);
          ctx!.lineTo(vanishX, horizon);
          ctx!.stroke();
        }
        ctx!.globalAlpha = 1;
      } else if (theme === "sanctuary") {
        rayPhase += 0.002;
        for (let i = 0; i < 5; i++) {
          const t = (i / 5 + rayPhase) % 1;
          const x = -w * 0.3 + t * w * 1.6;
          const grad = ctx!.createLinearGradient(x, 0, x + w * 0.3, h);
          grad.addColorStop(0, "rgba(180, 140, 255, 0)");
          grad.addColorStop(0.5, "rgba(200, 170, 255, 0.06)");
          grad.addColorStop(1, "rgba(180, 140, 255, 0)");
          ctx!.fillStyle = grad;
          ctx!.fillRect(x, 0, w * 0.3, h);
        }
      }

      if (running) raf = requestAnimationFrame(frame);
    }

    function onVis() {
      running = !document.hidden && !reduced;
      if (running) raf = requestAnimationFrame(frame);
      else cancelAnimationFrame(raf);
    }
    document.addEventListener("visibilitychange", onVis);

    if (running) raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
