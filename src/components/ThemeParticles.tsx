import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeProvider";

/**
 * Full-viewport canvas particle layer for the Fellowship theme.
 * Embers + dust drifting upward. Pauses while tab hidden and respects
 * prefers-reduced-motion.
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

    let raf = 0;
    let running = !document.hidden && !reduced;

    function frame() {
      ctx!.clearRect(0, 0, w, h);

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
