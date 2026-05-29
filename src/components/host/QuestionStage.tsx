import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LockInDots } from "./LockInDots";

const SLOT_META = [
  { key: "A", color: "bg-rose-500", shape: "circle" },
  { key: "B", color: "bg-amber-500", shape: "triangle" },
  { key: "C", color: "bg-emerald-500", shape: "square" },
  { key: "D", color: "bg-sky-500", shape: "star" },
] as const;

function ShapeIcon({ kind }: { kind: (typeof SLOT_META)[number]["shape"] }) {
  const cls = "h-12 w-12 opacity-30";
  switch (kind) {
    case "circle":
      return <svg viewBox="0 0 24 24" className={cls}><circle cx="12" cy="12" r="9" fill="currentColor" /></svg>;
    case "triangle":
      return <svg viewBox="0 0 24 24" className={cls}><polygon points="12,3 22,21 2,21" fill="currentColor" /></svg>;
    case "square":
      return <svg viewBox="0 0 24 24" className={cls}><rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" /></svg>;
    case "star":
      return (
        <svg viewBox="0 0 24 24" className={cls}>
          <polygon
            points="12,2 15,9 22,9 16.5,13.5 18.5,21 12,16.5 5.5,21 7.5,13.5 2,9 9,9"
            fill="currentColor"
          />
        </svg>
      );
  }
}

type Player = {
  id: string;
  nickname: string;
  current_answer: number | null;
};

type Props = {
  questionText: string;
  answers: string[];
  droppedIndexes: number[];
  correctIndex: number | null; // null until reveal
  secondsLeft: number;
  players: Player[];
  phase: "question" | "reveal";
};

export function QuestionStage({
  questionText,
  answers,
  droppedIndexes,
  correctIndex,
  secondsLeft,
  players,
  phase,
}: Props) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (secondsLeft > 5 || phase !== "question") {
      setPulse(false);
      return;
    }
    const tempo = Math.max(140, 140 + secondsLeft * 110);
    const id = window.setInterval(() => setPulse((p) => !p), tempo);
    return () => window.clearInterval(id);
  }, [secondsLeft, phase]);

  return (
    <div className="relative flex h-full flex-col gap-6 p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-150"
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.55 0.25 25 / 0.45), transparent 70%)",
          opacity: phase === "question" && secondsLeft <= 5 && pulse ? 1 : 0,
        }}
      />

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {phase === "question" ? "Question" : "Reveal"}
        </div>
        <TimerRing seconds={secondsLeft} max={15} active={phase === "question"} />
      </div>

      <h2 className="relative z-10 mx-auto max-w-4xl text-center font-display text-3xl font-bold leading-tight sm:text-5xl">
        {questionText}
      </h2>

      <div className="relative z-10 grid flex-1 grid-cols-2 gap-3 sm:gap-4">
        {answers.map((label, i) => {
          const slot = SLOT_META[i];
          const dropped = droppedIndexes.includes(i);
          const isCorrect = phase === "reveal" && correctIndex === i;
          const isWrongReveal = phase === "reveal" && correctIndex !== null && i !== correctIndex;
          return (
            <AnimatePresence key={i} mode="popLayout">
              {dropped ? (
                <motion.div
                  key={`d-${i}`}
                  initial={{ scale: 1, opacity: 1 }}
                  animate={{ scale: 0.6, opacity: 0, rotate: -8 }}
                  transition={{ duration: 0.45 }}
                  className={`relative grid place-items-center overflow-hidden rounded-3xl ${slot.color} text-primary-foreground`}
                >
                  <span className="text-7xl">✕</span>
                </motion.div>
              ) : (
                <motion.div
                  key={`a-${i}`}
                  layout
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{
                    scale: 1,
                    opacity: isWrongReveal ? 0.35 : 1,
                  }}
                  transition={{ duration: 0.25 }}
                  className={`relative flex flex-col items-center justify-center overflow-hidden rounded-3xl text-primary-foreground ${slot.color} ${
                    isCorrect ? "ring-4 ring-white shadow-[0_0_60px_oklch(0.9_0.15_150)]" : ""
                  }`}
                >
                  <div className="absolute inset-0 grid place-items-center text-white">
                    <ShapeIcon kind={slot.shape} />
                  </div>
                  <div className="relative z-10 flex flex-col items-center gap-2 px-4 text-center">
                    <span className="font-display text-5xl font-black drop-shadow">{slot.key}</span>
                    <span className="text-xl font-semibold sm:text-2xl">{label}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          );
        })}
      </div>

      <div className="relative z-10">
        <LockInDots players={players} />
      </div>
    </div>
  );
}

function TimerRing({ seconds, max, active }: { seconds: number; max: number; active: boolean }) {
  const pct = Math.max(0, Math.min(1, seconds / max));
  const r = 36;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="oklch(0.3 0 0)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={seconds <= 5 ? "oklch(0.65 0.25 25)" : "oklch(0.8 0.2 150)"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: active ? "stroke-dashoffset 0.2s linear" : undefined }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-mono text-2xl font-black">
        {Math.max(0, Math.ceil(seconds))}
      </div>
    </div>
  );
}
