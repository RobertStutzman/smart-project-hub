import { useEffect, useRef } from "react";

/**
 * Full-viewport canvas particle layer for the Fellowship theme.
 * Embers drifting upward. Pauses while tab hidden, respects
 * prefers-reduced-motion, and can be globally suppressed via
 * setThemeParticlesEnabled(false) for performance-sensitive phases.
 */

let particlesEnabled = true;
const listeners = new Set<(v: boolean) => void>();

export function setThemeParticlesEnabled(v: boolean) {
  if (particlesEnabled === v) return;
  particlesEnabled = v;
  for (const fn of listeners) fn(v);
}

export function ThemeParticles() {
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

    // Pre-render a glowing ember sprite once. Drawing this sprite per ember is
    // 5–10x cheaper than using ctx.shadowBlur on every frame.
    const SPRITE = 32;
    const sprite = document.createElement("canvas");
    sprite.width = SPRITE;
    sprite.height = SPRITE;
    const sctx = sprite.getContext("2d")!;
    const grad = sctx.createRadialGradient(
      SPRITE / 2, SPRITE / 2, 0,
      SPRITE / 2, SPRITE / 2, SPRITE / 2,
    );
    grad.addColorStop(0, "hsla(38, 100%, 70%, 1)");
    grad.addColorStop(0.35, "hsla(35, 95%, 60%, 0.55)");
    grad.addColorStop(1, "hsla(30, 90%, 50%, 0)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, SPRITE, SPRITE);

    type Ember = { x: number; y: number; vy: number; size: number; a: number; phase: number };
    const COUNT = 40;
    const embers: Ember[] = [];
    for (let i = 0; i < COUNT; i++) {
      embers.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vy: 0.2 + Math.random() * 0.6,
        size: 6 + Math.random() * 12,
        a: 0.25 + Math.random() * 0.6,
        phase: Math.random() * 1000,
      });
    }

    let raf = 0;
    const isRunning = () =>
      !document.hidden && !reduced && particlesEnabled;
    let running = isRunning();

    function frame() {
      ctx!.clearRect(0, 0, w, h);
      for (const e of embers) {
        e.y -= e.vy;
        e.x += Math.sin((e.y + e.phase) * 0.01) * 0.2;
        if (e.y < -20) {
          e.y = h + 10;
          e.x = Math.random() * w;
        }
        ctx!.globalAlpha = e.a;
        ctx!.drawImage(sprite, e.x - e.size / 2, e.y - e.size / 2, e.size, e.size);
      }
      ctx!.globalAlpha = 1;
      if (running) raf = requestAnimationFrame(frame);
    }

    function start() {
      cancelAnimationFrame(raf);
      running = isRunning();
      if (running) raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
      ctx!.clearRect(0, 0, w, h);
    }

    function onVis() {
      if (isRunning()) start();
      else stop();
    }
    document.addEventListener("visibilitychange", onVis);

    const listener = (enabled: boolean) => {
      if (enabled && !document.hidden && !reduced) start();
      else stop();
    };
    listeners.add(listener);

    if (running) raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      listeners.delete(listener);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
