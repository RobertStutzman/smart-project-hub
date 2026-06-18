import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { play } from "@/lib/sound-engine";
import { speakPersona } from "@/lib/host-persona";

type Top = {
  id: string;
  nickname: string;
  avatar_url: string | null;
};

type Props = {
  top3: Top[]; // [1st, 2nd, 3rd] by score desc
  onDone: () => void;
};

/**
 * Cinematic final-round cold open:
 *   eyebrow → 3rd place → 2nd place → 1st place → "FINAL ROUND" title
 * Total runtime ≈ 9.5s. Parent should flip to final_wager when `onDone` fires.
 */
export function FinalIntroStage({ top3, onDone }: Props) {
  const [stage, setStage] = useState<
    "eyebrow" | "third" | "second" | "first" | "title" | "out"
  >("eyebrow");
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const first = top3[0] ?? null;
  const second = top3[1] ?? null;
  const third = top3[2] ?? null;

  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) =>
      timers.push(window.setTimeout(fn, ms));

    play("whoosh");
    speakPersona("And now…", { preset: "hype", interrupt: true });

    if (third) {
      at(500, () => {
        setStage("third");
        play("tick");
        speakPersona(`In third — ${third.nickname}.`, { preset: "hype", interrupt: false });
      });
    }
    if (second) {
      at(1700, () => {
        setStage("second");
        play("tickHeavy");
        speakPersona(`Second — ${second.nickname}.`, { preset: "hype", interrupt: false });
      });
    }
    at(2900, () => {
      setStage("first");
      play("whoosh");
      if (first) {
        speakPersona(`Your leader — ${first.nickname}.`, { preset: "hype", interrupt: false });
      }
    });
    at(4300, () => {
      setStage("title");
      play("drop");
      speakPersona("Final round. Winner takes all.", { preset: "hype", interrupt: false });
    });
    at(5800, () => {
      setStage("out");
      onDoneRef.current();
    });

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [first, second, third]);

  const Avatar = ({ p, big }: { p: Top; big?: boolean }) => (
    <div className={`flex flex-col items-center ${big ? "gap-4" : "gap-2"}`}>
      <div
        className={`rounded-full p-1 ring-2 ring-amber-300/70 shadow-[0_0_60px_oklch(0.85_0.22_70/0.7)] ${
          big ? "" : ""
        }`}
      >
        {p.avatar_url ? (
          <img
            src={p.avatar_url}
            alt={p.nickname}
            className={`${big ? "h-44 w-44" : "h-28 w-28"} rounded-full object-cover`}
          />
        ) : (
          <div
            className={`grid ${big ? "h-44 w-44 text-6xl" : "h-28 w-28 text-4xl"} place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 font-display font-black text-amber-950`}
          >
            {p.nickname.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div
        className={`font-display ${big ? "text-5xl" : "text-2xl"} font-black uppercase tracking-tight text-white`}
      >
        {p.nickname}
      </div>
    </div>
  );

  return (
    <div className="relative grid h-full place-items-center overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.35_0.18_85/0.35),oklch(0.05_0.02_270)_70%)]" />
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_50%,oklch(0.85_0.18_85/0.15),transparent_60%)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <AnimatePresence mode="wait">
        {stage === "eyebrow" && (
          <motion.div
            key="eyebrow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <div className="font-display text-[7vw] font-black uppercase tracking-[0.4em] text-amber-200/90">
              And now…
            </div>
          </motion.div>
        )}

        {stage === "third" && third && (
          <motion.div
            key="third"
            initial={{ opacity: 0, x: -80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -120 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <div className="text-xs font-bold uppercase tracking-[0.6em] text-amber-300/80">
              In third place
            </div>
            <div className="mt-4">
              <Avatar p={third} />
            </div>
          </motion.div>
        )}

        {stage === "second" && second && (
          <motion.div
            key="second"
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 120 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <div className="text-xs font-bold uppercase tracking-[0.6em] text-amber-300/85">
              In second place
            </div>
            <div className="mt-4">
              <Avatar p={second} />
            </div>
          </motion.div>
        )}

        {stage === "first" && first && (
          <motion.div
            key="first"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <div className="text-xs font-bold uppercase tracking-[0.6em] text-amber-300/90">
              Your leader
            </div>
            <div className="mt-4">
              <Avatar p={first} big />
            </div>
          </motion.div>
        )}

        {stage === "title" && (
          <motion.div
            key="title"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.6em] text-amber-300/90">
              One question. All on the line.
            </div>
            <h1
              className="mt-4 font-display text-[15vw] font-black uppercase leading-none tracking-tight text-transparent sm:text-[12vw]"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, oklch(0.97 0.15 90) 0%, oklch(0.70 0.22 50) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                filter: "drop-shadow(0 14px 70px oklch(0.85 0.22 70 / 0.85))",
              }}
            >
              Final Round
            </h1>
            <div className="mx-auto mt-6 h-[3px] w-64 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
