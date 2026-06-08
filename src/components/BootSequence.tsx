import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { play } from "@/lib/sound-engine";
import { speakAsElf, cancelElfSpeech, prewarmElfLines } from "@/lib/elf-voice";
import { startLobbyChatter } from "@/lib/ambience-engine";

const TIPS_VO =
  "Here's the deal — answer fast, your score drops with the clock. Stack your two-times multiplier for the round that matters most. And in the final drop, wager it all and steal the win.";

/**
 * Jackbox-style boot sequence — plays once when the app first loads.
 *
 * Stages: splash → credits → tips → press-to-start.
 * Skippable with any key/click/remote button.
 * Auto-advances; final stage auto-completes after 12s so the Firestick
 * never gets stuck on "press OK".
 *
 * Persisted via sessionStorage so reloads during a single session don't
 * keep re-playing it (and ?nosplash=1 disables it entirely).
 */

const SKIP_KEY = "btd:boot:done";

type Stage = "splash" | "credits" | "tips" | "ready";

type Props = {
  onComplete: () => void;
};

const STAGE_DURATIONS: Record<Exclude<Stage, "ready">, number> = {
  splash: 2200,
  credits: 4000,
  tips: 6500,
};

const READY_AUTO_ADVANCE_MS = 12_000;

const TIPS = [
  {
    icon: "⏱",
    title: "Answer fast",
    body: "Score drops as the clock ticks. Beat the drop.",
  },
  {
    icon: "✕2",
    title: "Stack your 2×",
    body: "One round per game, you can double down. Pick the right moment.",
  },
  {
    icon: "★",
    title: "Final round bets all",
    body: "Last question. Wager your score. One winner takes it.",
  },
];

export function BootSequence({ onComplete }: Props) {
  const [stage, setStage] = useState<Stage>("splash");
  const [dismissing, setDismissing] = useState(false);
  const completedRef = useRef(false);

  // Advance through stages on a timer.
  // For `tips`, gate the advance on both the visual baseline (6.5s) AND the
  // announcer VO finishing — whichever takes longer — so the cards stay on
  // screen for the full narration.
  useEffect(() => {
    if (stage === "ready") return;
    let cancelled = false;
    const startedAt = performance.now();
    const baseMs = STAGE_DURATIONS[stage];

    if (stage === "tips") {
      const vo = speakAsElf(TIPS_VO, { preset: "hype", interrupt: true }).catch(
        () => {},
      );
      vo.then(() => {
        if (cancelled) return;
        const elapsed = performance.now() - startedAt;
        const wait = Math.max(0, baseMs - elapsed);
        window.setTimeout(() => {
          if (!cancelled) setStage("ready");
        }, wait);
      });
      return () => {
        cancelled = true;
      };
    }

    const t = window.setTimeout(() => {
      setStage((s) =>
        s === "splash" ? "credits" : s === "credits" ? "tips" : "ready",
      );
    }, baseMs);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [stage]);

  // Splash sound sting
  useEffect(() => {
    if (stage === "splash") {
      const t = window.setTimeout(() => play("whoosh"), 150);
      return () => window.clearTimeout(t);
    }
    if (stage === "ready") {
      play("tap");
    }
  }, [stage]);

  // Auto-advance off the ready stage so a TV left alone keeps going
  useEffect(() => {
    if (stage !== "ready") return;
    const t = window.setTimeout(complete, READY_AUTO_ADVANCE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Any key/click skips to the next stage; on "ready", finishes.
  useEffect(() => {
    function advance() {
      if (completedRef.current) return;
      if (stage === "tips") cancelElfSpeech();
      if (stage === "ready") {
        complete();
      } else if (stage === "splash") {
        setStage("credits");
      } else if (stage === "credits") {
        setStage("tips");
      } else {
        setStage("ready");
      }
    }
    function onKey(e: KeyboardEvent) {
      // Ignore typing inside form fields (none here yet, but defensive)
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
  }, [stage]);

  function complete() {
    if (completedRef.current) return;
    completedRef.current = true;
    cancelElfSpeech();
    try {
      window.sessionStorage.setItem(SKIP_KEY, "1");
    } catch {
      /* sessionStorage may be unavailable in private mode */
    }
    setDismissing(true);
    // Let the fade-out finish before unmounting
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

          {/* Skip hint — always visible top-right */}
          <div className="absolute right-6 top-6 z-10 text-[10px] uppercase tracking-[0.35em] text-white/40">
            Press any key to skip
          </div>

          {/* Stage content */}
          <AnimatePresence mode="wait">
            {stage === "splash" && <SplashStage key="splash" />}
            {stage === "credits" && <CreditsStage key="credits" />}
            {stage === "tips" && <TipsStage key="tips" />}
            {stage === "ready" && <ReadyStage key="ready" />}
          </AnimatePresence>

          {/* Progress dots */}
          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {(["splash", "credits", "tips", "ready"] as const).map((s, i) => {
              const order: Stage[] = ["splash", "credits", "tips", "ready"];
              const isPast = order.indexOf(stage) >= i;
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

function SplashStage() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex h-full w-full flex-col items-center justify-center"
    >
      {/* Amber rim glow behind the logo */}
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

function TipsStage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="relative flex h-full w-full flex-col items-center justify-center"
    >
      <div className="mb-8 text-[10px] uppercase tracking-[0.5em] text-amber-200/70">
        How to play
      </div>

      <div className="flex w-full max-w-5xl flex-col items-center justify-center gap-4 px-6 sm:flex-row sm:gap-6">
        {TIPS.map((tip, i) => (
          <motion.div
            key={tip.title}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full max-w-xs flex-col items-center rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur"
          >
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 font-display text-2xl font-black text-amber-950 shadow-[0_0_30px_oklch(0.85_0.18_85/0.45)]">
              {tip.icon}
            </div>
            <div className="font-display text-lg font-black uppercase tracking-wider text-white">
              {tip.title}
            </div>
            <div className="mt-2 text-sm text-white/60">{tip.body}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function ReadyStage() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex h-full w-full flex-col items-center justify-center"
    >
      <div className="font-display text-[clamp(2rem,7svh,5rem)] font-black tracking-tight text-white drop-shadow-[0_4px_40px_rgba(0,0,0,0.7)]">
        Ready to play?
      </div>

      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="mt-10 inline-flex items-center gap-3 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-10 py-5 font-display text-lg font-black uppercase tracking-[0.25em] text-amber-950 shadow-[0_0_60px_oklch(0.85_0.18_85/0.5)]"
      >
        <span>Press</span>
        <kbd className="rounded-md border border-amber-950/30 bg-amber-50/40 px-3 py-1 font-mono text-base">
          OK
        </kbd>
        <span>to start</span>
      </motion.div>

      <div className="mt-8 text-[10px] uppercase tracking-[0.4em] text-white/40">
        or tap anywhere
      </div>
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
