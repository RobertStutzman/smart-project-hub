import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { play } from "@/lib/sound-engine";
import { startLobbyChatter, startCrowd } from "@/lib/ambience-engine";

/**
 * Jackbox-style boot sequence — plays once when the app first loads.
 *
 * Stages: gate → splash → credits → (complete → landing).
 * The "tips / how to play" stage was removed — the rules are shown once
 * on the host start screen instead, so we don't surface them twice.
 */

const SKIP_KEY = "btd:boot:done";

type Stage = "gate" | "splash" | "credits";

type Props = {
  onComplete: () => void;
};

const STAGE_DURATIONS: Record<Exclude<Stage, "gate">, number> = {
  splash: 2200,
  credits: 4000,
};

function isStandaloneLaunch(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  } catch {
    /* ignore */
  }
  const navStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return navStandalone === true;
}

function startAmbienceBeds() {
  void startLobbyChatter();
  void startCrowd();
}

export function BootSequence({ onComplete }: Props) {
  // When launched from an installed PWA / TWA, skip the tap-to-begin gate.
  const [stage, setStage] = useState<Stage>(() =>
    isStandaloneLaunch() ? "splash" : "gate",
  );
  const [dismissing, setDismissing] = useState(false);
  const completedRef = useRef(false);

  // On standalone launches, unlock audio immediately.
  useEffect(() => {
    if (!isStandaloneLaunch()) return;
    startAmbienceBeds();
  }, []);

  // Advance through stages on a timer.
  useEffect(() => {
    if (stage === "gate") return;
    const baseMs = STAGE_DURATIONS[stage];
    const t = window.setTimeout(() => {
      if (stage === "splash") setStage("credits");
      else if (stage === "credits") complete();
    }, baseMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Splash sound sting
  useEffect(() => {
    if (stage === "splash") {
      const t = window.setTimeout(() => play("whoosh"), 150);
      return () => window.clearTimeout(t);
    }
  }, [stage]);

  // Any key/click skips to the next stage.
  // On `gate`, the first gesture unlocks audio and starts the intro.
  // From `credits`, skipping completes immediately.
  useEffect(() => {
    function unlockAudioAndStart() {
      startAmbienceBeds();
      setStage("splash");
    }
    function advance() {
      if (completedRef.current) return;
      if (stage === "gate") {
        unlockAudioAndStart();
        return;
      }
      if (stage === "splash") setStage("credits");
      else if (stage === "credits") complete();
    }
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      e.preventDefault();
      advance();
    }
    function onPointer() {
      advance();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function complete() {
    if (completedRef.current) return;
    completedRef.current = true;
    try {
      window.sessionStorage.setItem(SKIP_KEY, "1");
    } catch {
      /* sessionStorage may be unavailable in private mode */
    }
    setDismissing(true);
    window.setTimeout(onComplete, 450);
  }

  return (
    <AnimatePresence>
      {!dismissing && (
        <motion.div
          key="boot"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[100] overflow-hidden bg-[oklch(0.06_0.02_270)] text-white"
        >
          {/* Background grain + glow shared across all stages */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.22 0.05 280 / 0.85), transparent 70%)",
            }}
          />

          {stage !== "gate" && (
            <div className="absolute right-6 top-6 z-10 text-[10px] uppercase tracking-[0.35em] text-white/40">
              Press any key to skip
            </div>
          )}

          <AnimatePresence mode="wait">
            {stage === "gate" && <GateStage key="gate" />}
            {stage === "splash" && <SplashStage key="splash" />}
            {stage === "credits" && <CreditsStage key="credits" />}
          </AnimatePresence>

          {/* Progress dots */}
          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {(["splash", "credits"] as const).map((s, i) => {
              const order: Stage[] = ["splash", "credits"];
              const idx = order.indexOf(stage);
              const isPast = idx >= 0 && idx >= i;
              return (
                <div
                  key={s}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    isPast ? "w-6 bg-amber-300" : "w-3 bg-white/15"
                  }`}
                />
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function GateStage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="relative flex h-full w-full flex-col items-center justify-center text-center"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 40% 30% at 50% 50%, oklch(0.85 0.18 85 / 0.18), transparent 70%)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-[10px] uppercase tracking-[0.5em] text-amber-200/70"
      >
        A Beat the Drop production
      </motion.div>
      <motion.div
        initial={{ letterSpacing: "0.4em", opacity: 0 }}
        animate={{ letterSpacing: "0.05em", opacity: 1 }}
        transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="mt-6 font-display text-[clamp(2.5rem,9svh,6rem)] font-black leading-[0.95] tracking-tight"
      >
        <span className="text-white drop-shadow-[0_4px_40px_rgba(0,0,0,0.7)]">Beat the </span>
        <span className="bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
          Drop
        </span>
      </motion.div>
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="mt-12 inline-flex items-center gap-3 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-10 py-5 font-display text-base font-black uppercase tracking-[0.25em] text-amber-950 shadow-[0_0_60px_oklch(0.85_0.18_85/0.5)]"
      >
        <span>Tap or press any key to begin</span>
      </motion.div>
      <div className="mt-5 text-[10px] uppercase tracking-[0.4em] text-white/40">
        Sound on for the full experience
      </div>
    </motion.div>
  );
}

function SplashStage() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex h-full w-full flex-col items-center justify-center"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 40% 30% at 50% 50%, oklch(0.85 0.18 85 / 0.25), transparent 70%)",
        }}
      />

      <motion.div
        initial={{ letterSpacing: "0.4em", opacity: 0 }}
        animate={{ letterSpacing: "0.05em", opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative font-display text-[clamp(3rem,11svh,8rem)] font-black leading-[0.95] tracking-tight"
      >
        <span className="text-white drop-shadow-[0_4px_40px_rgba(0,0,0,0.7)]">Beat the </span>
        <span className="bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
          Drop
        </span>
      </motion.div>

      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "8rem" }}
        transition={{ duration: 0.9, delay: 0.8 }}
        className="mt-6 h-[2px] rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent"
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.1 }}
        className="mt-5 text-[clamp(0.7rem,1.4svh,0.9rem)] uppercase tracking-[0.5em] text-amber-200/80"
      >
        Live trivia · For your TV
      </motion.div>
    </motion.div>
  );
}

function CreditsStage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="relative flex h-full w-full flex-col items-center justify-center text-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1 }}
        className="text-[10px] uppercase tracking-[0.5em] text-white/40"
      >
        A Beat the Drop production
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="mt-8 font-display text-[clamp(1.4rem,4svh,2.6rem)] font-black tracking-tight text-white/90"
      >
        Made for couches, lobbies,
        <br />
        and competitive friend groups.
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.6 }}
        className="mt-10 flex items-center gap-3 text-[10px] uppercase tracking-[0.4em] text-white/30"
      >
        <span>Host on TV</span>
        <span className="h-1 w-1 rounded-full bg-amber-300/60" />
        <span>Play on phone</span>
        <span className="h-1 w-1 rounded-full bg-amber-300/60" />
        <span>No installs</span>
      </motion.div>
    </motion.div>
  );
}

/**
 * Check if the boot sequence should be shown.
 * - Skipped if sessionStorage flag set (already shown this session)
 * - Skipped if URL has ?nosplash=1 (dev convenience)
 */
export function shouldShowBoot(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get("nosplash") === "1") return false;
  try {
    return window.sessionStorage.getItem(SKIP_KEY) !== "1";
  } catch {
    return true;
  }
}
