import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HOST_NAME } from "@/lib/host-persona";
import { play, playWalkOnStinger } from "@/lib/sound-engine";

type Player = {
  id: string;
  nickname: string;
  avatar_url: string | null;
};

type Props = {
  players: Player[];
  /** Called when the intro finishes its 8-9s sequence. */
  onDone: () => void;
};

/**
 * Cold open: title card → "Tonight's contestants" roster → GO stinger.
 * Total runtime ≈ 8.5s. Host can press Space to skip.
 */
export function IntroStage({ players, onDone }: Props) {
  const [step, setStep] = useState<
    "title" | "roster" | "countdown" | "go"
  >("title");
  const [count, setCount] = useState(3);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    // Hype line via TTS as the title card lands
    play("whoosh");
    const w = window as unknown as { __btdReplayIntro?: boolean };
    const isReplayIntro = w.__btdReplayIntro === true;
    if (isReplayIntro) {
      w.__btdReplayIntro = false;
    }

    const timers: number[] = [];
    const at = (ms: number, fn: () => void) =>
      timers.push(window.setTimeout(fn, ms));

    // Timing budget: "Here we go" is the cue, then the countdown starts
    // immediately after that short line ends (with a hard 650ms fallback).
    //   t=0       whoosh + title card
    //   t=450     roster + fast walk-on stingers
    //   t=900     "Here we go."
    //   t≈1.4s    3
    //   +1.0s     2
    //   +2.0s     1
    //   +3.0s     GO
    //   +3.3s     first question

    at(450, () => setStep("roster"));
    // Walk-on stingers — one per contestant, staggered to match the
    // card pop animation (220ms cadence, starting ~150ms after roster appears).
    {
      const maxStingers = Math.min(players.length, 8);
      for (let i = 0; i < maxStingers; i++) {
        at(520 + i * 80, () => playWalkOnStinger(i));
      }
    }

    let cancelled = false;
    let countdownStarted = false;
    const TICK_MS = 1000;
    const HERE_WE_GO_AT = 900;
    const HERE_WE_GO_MAX_MS = 650;
    const speakDigit = (n: 3 | 2 | 1) => {
      // Fire-and-forget: the persona pack pre-bakes "Three." / "Two." / "One."
      // as cached URLs, so playback starts within a frame. We do NOT await —
      // the visual ticks on a strict 1s interval regardless of audio length.
      void import("@/lib/elf-voice").then((m) => {
        if (cancelled) return;
        void m.speakAsElf(`${n === 3 ? "Three" : n === 2 ? "Two" : "One"}.`, {
          preset: "hype",
          interrupt: true,
          deadline: Date.now() + 900,
        });
      });
    };

    const startCountdown = () => {
      if (cancelled || countdownStarted) return;
      countdownStarted = true;
      setStep("countdown");
      setCount(3);
      play("tick");
      speakDigit(3);
      at(TICK_MS, () => {
        if (cancelled) return;
        setCount(2);
        play("tick");
        speakDigit(2);
      });
      at(TICK_MS * 2, () => {
        if (cancelled) return;
        setCount(1);
        play("tick");
        speakDigit(1);
      });
      at(TICK_MS * 3, () => {
        if (cancelled) return;
        setStep("go");
        play("whoosh");
      });
      at(TICK_MS * 3 + 300, () => {
        if (cancelled) return;
        onDoneRef.current();
      });
    };

    at(HERE_WE_GO_AT, () => {
      if (cancelled) return;
      const deadline = Date.now() + HERE_WE_GO_MAX_MS;
      at(HERE_WE_GO_MAX_MS, startCountdown);
      void import("@/lib/elf-voice")
        .then((m) =>
          m.speakAsElf("Here we go.", {
            preset: "hype",
            interrupt: true,
            deadline,
          }),
        )
        .then(startCountdown)
        .catch(startCountdown);
    });




    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        cancelled = true;
        timers.forEach((t) => window.clearTimeout(t));
        void import("@/lib/elf-voice").then((m) => m.cancelElfSpeech());
        onDoneRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("keydown", onKey);
    };
  }, [players.length]);


  return (
    <div
      className="relative grid h-full place-items-center overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(ellipse 100% 60% at 50% 40%, oklch(0.22 0.08 280 / 0.95), oklch(0.05 0.02 270) 70%)",
      }}
    >
      {/* Film grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      {/* Pulsing spotlight */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(circle at 50% 45%, oklch(0.85 0.18 85 / 0.18), transparent 55%)",
        }}
      />

      <AnimatePresence mode="wait">
        {step === "title" && (
          <motion.div
            key="title"
            initial={{ opacity: 0, scale: 0.88, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.06, y: -16 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="relative text-center"
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.6em] text-amber-300/90">
              Tonight, on
            </div>
            <h1
              className="mt-4 font-display text-[14vw] font-black uppercase leading-none tracking-tight text-transparent sm:text-[10vw]"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, oklch(0.97 0.12 90) 0%, oklch(0.75 0.20 60) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                filter: "drop-shadow(0 8px 50px oklch(0.85 0.20 70 / 0.6))",
              }}
            >
              Beat the Drop
            </h1>
            <div className="mx-auto mt-6 h-[3px] w-56 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
            <div className="mt-6 text-sm font-bold uppercase tracking-[0.5em] text-amber-200/80">
              Hosted by {HOST_NAME}
            </div>
          </motion.div>
        )}

        {step === "roster" && (
          <motion.div
            key="roster"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="relative w-full max-w-5xl px-8 text-center"
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.6em] text-amber-300/90">
              Tonight's contestants
            </div>
            <div className="mt-6 flex flex-wrap items-end justify-center gap-5">
              {players.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 24, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: 0.08 * i,
                    type: "spring",
                    stiffness: 260,
                    damping: 22,
                  }}
                  className="flex w-28 flex-col items-center"
                >
                  <div className="rounded-full p-1 ring-2 ring-amber-300/60 shadow-[0_0_30px_oklch(0.85_0.18_85/0.4)]">
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt={p.nickname}
                        className="h-20 w-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 font-display text-3xl font-black text-amber-950">
                        {p.nickname.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 max-w-[7rem] truncate font-display text-base font-bold uppercase tracking-wider text-white">
                    {p.nickname}
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="mx-auto mt-8 h-[2px] w-32 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
          </motion.div>
        )}

        {step === "go" && (

          <motion.div
            key="go"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative text-center"
          >
            <div
              className="font-display text-[20vw] font-black uppercase leading-none tracking-tight text-transparent sm:text-[14vw]"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, oklch(0.97 0.18 90) 0%, oklch(0.65 0.25 35) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                filter: "drop-shadow(0 10px 50px oklch(0.85 0.22 70 / 0.7))",
              }}
            >
              GO
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Countdown digit rendered outside the wait-mode AnimatePresence so
          each tick (3 → 2 → 1) doesn't have to wait for the previous to
          finish exiting before appearing. Without this, only the final
          digit was visible long enough to read. */}
      {step === "countdown" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.6em] text-amber-300/90">
              Get ready
            </div>
            <AnimatePresence>
              <motion.div
                key={`count-${count}`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.4 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-x-0 mt-2 font-display text-[34vw] font-black uppercase leading-none tracking-tight text-transparent sm:text-[24vw]"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, oklch(0.97 0.15 90) 0%, oklch(0.70 0.22 50) 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 14px 70px oklch(0.85 0.22 70 / 0.85))",
                }}
              >
                {count}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.4em] text-white/40">
        Press space to skip
      </div>
    </div>
  );
}
