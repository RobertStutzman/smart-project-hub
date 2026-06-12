import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Slide = {
  emoji: string;
  title: string;
  body: string;
  accent: string;
};

const SLIDES: Slide[] = [
  {
    emoji: "📱",
    title: "Grab your phone",
    body: "Open the join URL, type the 4-letter code, pick a nickname. That's your buzzer.",
    accent: "from-amber-300 to-amber-500",
  },
  {
    emoji: "⚡",
    title: "Lock fast, score big",
    body: "Every question is worth more the sooner you lock it in. Hesitate and the points drain.",
    accent: "from-rose-400 to-orange-500",
  },
  {
    emoji: "🔥",
    title: "Build streaks, beat the drop",
    body: "Three correct in a row triggers a streak bonus. The final round can flip the whole game.",
    accent: "from-violet-400 to-sky-400",
  },
];

// Safety ceiling per slide — if TTS hangs or is blocked, advance anyway.
const SLIDE_MAX_MS = 9000;
// Brief beat after narration finishes before advancing.
const POST_SPEECH_PAUSE_MS = 600;

export function HowToPlay({ onComplete }: { onComplete: () => void }) {
  const [idx, setIdx] = useState(0);

  // Narrate the current slide, then advance once the line finishes (with a
  // small beat). Capped by SLIDE_MAX_MS so a hung TTS request can't freeze us.
  useEffect(() => {
    let cancelled = false;
    let advanceTimer: number | undefined;
    const slide = SLIDES[idx];

    const advance = () => {
      if (cancelled) return;
      if (idx < SLIDES.length - 1) setIdx(idx + 1);
      else onComplete();
    };

    const ceiling = window.setTimeout(() => {
      if (cancelled) return;
      void import("@/lib/elf-voice").then(({ cancelElfSpeech }) => cancelElfSpeech());
      advance();
    }, SLIDE_MAX_MS);

    void import("@/lib/elf-voice").then(({ speakAsElf }) => {
      if (cancelled) return;
      // First slide doesn't interrupt (nothing to cut); subsequent slides
      // only run after the previous finished, so interrupt is a no-op safety.
      speakAsElf(`${slide.title}. ${slide.body}`, {
        interrupt: idx === 0,
        preset: "hype",
      }).then(() => {
        if (cancelled) return;
        window.clearTimeout(ceiling);
        advanceTimer = window.setTimeout(advance, POST_SPEECH_PAUSE_MS);
      });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(ceiling);
      if (advanceTimer !== undefined) window.clearTimeout(advanceTimer);
    };
  }, [idx, onComplete]);

  useEffect(() => {
    function skip(e: KeyboardEvent | MouseEvent) {
      if (e instanceof KeyboardEvent && e.code !== "Enter" && e.code !== "Space" && e.code !== "Escape") return;
      void import("@/lib/elf-voice").then(({ cancelElfSpeech }) => cancelElfSpeech());
      onComplete();
    }
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [onComplete]);

  // Cancel any in-flight narration when the component unmounts (rules done).
  useEffect(() => {
    return () => {
      void import("@/lib/elf-voice").then(({ cancelElfSpeech }) => cancelElfSpeech());
    };
  }, []);

  const slide = SLIDES[idx];

  return (
    <div
      onClick={onComplete}
      className="fixed inset-0 z-[100] grid place-items-center bg-[oklch(0.06_0.02_270)] text-white"
    >
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-[0.5em] text-white/40">
        How to play · {idx + 1} of {SLIDES.length}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.95 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex max-w-3xl flex-col items-center gap-8 px-8 text-center"
        >
          <motion.div
            initial={{ scale: 0.5, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 12, stiffness: 200 }}
            className={`grid h-40 w-40 place-items-center rounded-[2.5rem] bg-gradient-to-br ${slide.accent} text-7xl shadow-[0_20px_80px_oklch(0.85_0.18_85/0.4)]`}
          >
            {slide.emoji}
          </motion.div>
          <h2 className="font-display text-5xl font-black tracking-tight md:text-7xl">
            {slide.title}
          </h2>
          <p className="max-w-xl text-lg text-white/70 md:text-2xl">{slide.body}</p>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 gap-2">
        {SLIDES.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? "w-10 bg-amber-300" : i < idx ? "w-6 bg-white/40" : "w-6 bg-white/15"
            }`}
          />
        ))}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.4em] text-white/30">
        Press any key to skip
      </div>
    </div>
  );
}
