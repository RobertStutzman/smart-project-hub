import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { play, playBootMusic, stopBootMusic } from "@/lib/sound-engine";
import { speakAsElf, cancelElfSpeech } from "@/lib/elf-voice";
import crowdClap from "@/assets/audio/audience/crowd_clap.mp3.asset.json";


/**
 * Jackbox-style boot sequence — plays once when the app first loads.
 *
 * Stages: gate → splash → credits → (complete → landing).
 */

type Stage = "gate" | "splash" | "credits";

type Props = {
  onComplete: () => void;
};

const STAGE_DURATIONS: Record<Exclude<Stage, "gate">, number> = {
  splash: 8800,
  credits: 5200,
};

const SOFT_EASE = [0.22, 1, 0.36, 1] as const;

// Time (ms after audio start) when "Beat. The. Drop." word lands in the
// single-line trailer VO. SplashStage syncs the logo punch to this.
const DROP_BEAT_MS = 6800;


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

// Track audio-start time so SplashStage can sync its punch animation.
let bootAudioStartedAt = 0;

function playCrowdCheer() {
  if (typeof window === "undefined") return;
  try {
    const a = new Audio(crowdClap.url);
    a.volume = 0.55;
    a.play().catch(() => {});
    // Fade out over ~2s starting at 1.4s.
    window.setTimeout(() => {
      const steps = 16;
      let i = 0;
      const startVol = a.volume;
      const id = window.setInterval(() => {
        i++;
        a.volume = Math.max(0, startVol * (1 - i / steps));
        if (i >= steps) {
          window.clearInterval(id);
          try { a.pause(); } catch { /* noop */ }
        }
      }, 40);
    }, 1400);
  } catch {
    /* noop */
  }
}

function startBootIntroAudio() {
  // Louder music bed + 3-beat movie-trailer VO + crowd cheer under the punch.
  playBootMusic(0.78);
  bootAudioStartedAt = Date.now();
  // Beat 1
  window.setTimeout(() => {
    void speakAsElf("In a world… of bad answers…", {
      preset: "calm",
      interrupt: true,
      volume: 1.0,
    });
  }, 1000);
  // Beat 2
  window.setTimeout(() => {
    void speakAsElf("…and faster fingers…", {
      preset: "calm",
      interrupt: false,
      volume: 1.0,
    });
  }, 3400);
  // Beat 3 — the drop. Crowd cheer fires just before.
  window.setTimeout(() => {
    playCrowdCheer();
  }, DROP_BEAT_MS - 200);
  window.setTimeout(() => {
    void speakAsElf("Beat. The. Drop.", {
      preset: "hype",
      interrupt: false,
      volume: 1.0,
    });
  }, DROP_BEAT_MS);
}




export function BootSequence({ onComplete }: Props) {
  // When launched from an installed PWA / TWA, skip the tap-to-begin gate.
  const [stage, setStage] = useState<Stage>(() =>
    isStandaloneLaunch() ? "splash" : "gate",
  );
  const [dismissing, setDismissing] = useState(false);
  const [gatePressed, setGatePressed] = useState(false);
  const completedRef = useRef(false);

  // On standalone launches, start the boot intro audio immediately.
  useEffect(() => {
    if (!isStandaloneLaunch()) return;
    startBootIntroAudio();
  }, []);

  // Fade out boot music + kill any pending VO when the overlay is dismissed.
  useEffect(() => {
    if (dismissing) {
      stopBootMusic(600);
      cancelElfSpeech();
    }
  }, [dismissing]);



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
      play("ignition");
      startBootIntroAudio();
      setGatePressed(true);
      window.setTimeout(() => setStage("splash"), 140);
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
    setDismissing(true);
    window.setTimeout(onComplete, 600);
  }


  return (
    <AnimatePresence>
      {!dismissing && (
        <motion.div
          key="boot"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: SOFT_EASE }}
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

          <AnimatePresence>
            {stage === "gate" && <GateStage key="gate" pressed={gatePressed} />}
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

function GateStage({ pressed = false }: { pressed?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: SOFT_EASE }}
      className="absolute inset-0 flex flex-col items-center justify-center text-center"
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
      <div
        className={`pill-pulse${pressed ? " is-pressed" : ""} mt-12 inline-flex items-center gap-3 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-10 py-5 font-display text-base font-black uppercase tracking-[0.25em] text-amber-950 shadow-[0_0_40px_oklch(0.85_0.18_85/0.45)]`}
      >
        <span>Tap or press any key to begin</span>
      </div>

      <div className="mt-5 text-[10px] uppercase tracking-[0.4em] text-white/40">
        Sound on for the full experience
      </div>
    </motion.div>
  );
}

function SplashStage() {
  // Fire the logo punch + white flash in sync with the "Beat. The. Drop."
  // VO beat. Schedules off the same audio start clock the intro uses.
  const [punched, setPunched] = useState(false);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const elapsed = bootAudioStartedAt > 0 ? Date.now() - bootAudioStartedAt : 0;
    const delay = Math.max(0, DROP_BEAT_MS - elapsed);
    const punchT = window.setTimeout(() => {
      setPunched(true);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 280);
      window.setTimeout(() => setPunched(false), 240);
    }, delay);
    return () => window.clearTimeout(punchT);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.7, ease: SOFT_EASE }}
      className="absolute inset-0 flex flex-col items-center justify-center"
    >
      {/* hotter rim glow under the logo */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 38% at 50% 50%, oklch(0.85 0.20 80 / 0.42), transparent 70%)",
        }}
      />

      {/* white flash on the drop beat */}
      <div
        className="pointer-events-none absolute inset-0 bg-white transition-opacity duration-300"
        style={{ opacity: flash ? 0.35 : 0 }}
      />

      <motion.div
        initial={{ letterSpacing: "0.4em", opacity: 0 }}
        animate={{
          letterSpacing: "0.05em",
          opacity: 1,
          scale: punched ? 1.08 : 1,
        }}
        transition={{
          duration: punched ? 0.22 : 1.2,
          delay: punched ? 0 : 0.2,
          ease: punched ? [0.34, 1.56, 0.64, 1] : [0.16, 1, 0.3, 1],
        }}
        className="relative font-display text-[clamp(3rem,11svh,8rem)] font-black leading-[0.95] tracking-tight"
        style={{
          filter: punched
            ? "drop-shadow(0 0 60px oklch(0.92 0.20 80 / 0.9))"
            : undefined,
        }}
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
      transition={{ duration: 0.7, ease: SOFT_EASE }}
      className="absolute inset-0 flex flex-col items-center justify-center text-center"
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
  return true;
}

