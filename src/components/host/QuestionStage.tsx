import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Player = {
  id: string;
  nickname: string;
  avatar_url: string | null;
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

const LETTERS = ["A", "B", "C", "D"] as const;

export function QuestionStage({
  questionText,
  answers,
  droppedIndexes,
  correctIndex,
  secondsLeft,
  players,
  phase,
}: Props) {
  // Heartbeat pulse + screen shake on each new drop
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

  // Trigger shake whenever droppedIndexes grows
  const [shakeKey, setShakeKey] = useState(0);
  const [vignette, setVignette] = useState(false);
  useEffect(() => {
    if (droppedIndexes.length === 0) return;
    setShakeKey((k) => k + 1);
    setVignette(true);
    const id = window.setTimeout(() => setVignette(false), 600);
    return () => window.clearTimeout(id);
  }, [droppedIndexes.length]);

  const lockedByIndex: Record<number, Player[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const p of players) {
    if (p.current_answer !== null && p.current_answer >= 0 && p.current_answer < 4) {
      lockedByIndex[p.current_answer].push(p);
    }
  }
  const lockedCount = players.filter((p) => p.current_answer !== null).length;

  return (
    <motion.div
      key={shakeKey}
      animate={
        shakeKey > 0
          ? { x: [0, -14, 12, -8, 6, -3, 0], y: [0, 6, -4, 3, -2, 0] }
          : undefined
      }
      transition={{ duration: 0.5 }}
      className="relative flex h-full flex-col gap-6 overflow-hidden p-6"
      style={{
        background:
          "radial-gradient(ellipse 90% 60% at 50% 35%, oklch(0.22 0.04 270 / 0.9), oklch(0.08 0.02 270) 75%)",
      }}
    >
      {/* film grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* heartbeat red vignette under 5s */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-150"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, oklch(0.45 0.28 25 / 0.55) 100%)",
          opacity: phase === "question" && secondsLeft <= 5 && pulse ? 1 : 0,
        }}
      />

      {/* heavy red flash on each drop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-500"
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.55 0.3 25 / 0.5), transparent 70%)",
          opacity: vignette ? 1 : 0,
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-300/80">
          {phase === "question" ? "Live · Eliminate the wrong" : "Reveal"}
        </div>
        <TimerRing seconds={secondsLeft} max={15} active={phase === "question"} />
      </div>

      {/* Question */}
      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <h2
          className="font-display text-4xl font-black leading-[1.05] text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)] sm:text-6xl"
          style={{ textWrap: "balance" as never }}
        >
          {questionText}
        </h2>
        <div className="mx-auto mt-4 h-[2px] w-24 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
      </div>

      {/* Answer panels — fixed 2x2 grid; cells NEVER reflow when shattered */}
      <div className="relative z-10 grid flex-1 grid-cols-2 grid-rows-2 gap-4">
        {answers.map((label, i) => {
          const dropped = droppedIndexes.includes(i);
          const isCorrect = phase === "reveal" && correctIndex === i;
          const isWrongReveal =
            phase === "reveal" && correctIndex !== null && i !== correctIndex;
          const locks = lockedByIndex[i];

          return (
            <div key={i} className="relative min-h-0">
              {/* Stable card container — always rendered, never repositioned */}
              <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 8 }}
                animate={{
                  scale: isCorrect ? 1.04 : 1,
                  opacity: dropped ? 0.15 : isWrongReveal ? 0.25 : 1,
                  y: 0,
                }}
                transition={{ duration: 0.3 }}
                className={`relative flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border p-6 backdrop-blur-xl ${
                  dropped
                    ? "border-rose-500/30 bg-rose-950/20 grayscale"
                    : isCorrect
                      ? "border-amber-300/80 bg-gradient-to-br from-amber-400/25 to-amber-600/10 shadow-[0_0_80px_oklch(0.85_0.18_85/0.7)]"
                      : "border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_60px_rgba(0,0,0,0.5)]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`grid h-11 w-11 place-items-center rounded-full font-display text-xl font-black ${
                      isCorrect
                        ? "bg-amber-300 text-amber-950"
                        : "bg-white/10 text-white/90 ring-1 ring-white/20"
                    }`}
                  >
                    {LETTERS[i]}
                  </div>
                  {locks.length > 0 && !dropped && (
                    <div className="rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/80 ring-1 ring-white/10">
                      {locks.length} locked
                    </div>
                  )}
                </div>

                <div className="my-4 text-2xl font-bold leading-tight text-white sm:text-3xl">
                  {label}
                </div>

                <div className="flex min-h-[28px] items-center gap-1.5">
                  {!dropped &&
                    locks.slice(0, 10).map((p) => (
                      <div
                        key={p.id}
                        title={p.nickname}
                        className="h-6 w-6 overflow-hidden rounded-full ring-2 ring-black/40"
                      >
                        {p.avatar_url ? (
                          <img
                            src={p.avatar_url}
                            alt={p.nickname}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center bg-white/20 text-[10px] font-black text-white">
                            {p.nickname.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                    ))}
                  {!dropped && locks.length > 10 && (
                    <div className="text-[10px] font-bold text-white/60">
                      +{locks.length - 10}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Shatter overlay — sits on top, never affects layout */}
              <AnimatePresence>
                {dropped && (
                  <ShatterOverlay key={`shatter-${i}`} letter={LETTERS[i]} label={label} />
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Locked progress bar */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">
          Locked
        </div>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-300 transition-all duration-300"
            style={{
              width: `${players.length === 0 ? 0 : (lockedCount / players.length) * 100}%`,
            }}
          />
        </div>
        <div className="font-mono text-xs text-white/70">
          {lockedCount} / {players.length}
        </div>
      </div>
    </motion.div>
  );
}

function ShatterOverlay({ letter, label }: { letter: string; label: string }) {
  // 6 shards exploding outward
  const shards = [
    { x: -120, y: -90, r: -25 },
    { x: 110, y: -110, r: 30 },
    { x: -140, y: 60, r: -40 },
    { x: 130, y: 80, r: 35 },
    { x: 0, y: -160, r: 12 },
    { x: 0, y: 140, r: -18 },
  ];
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.7, delay: 0.4 }}
      className="pointer-events-none absolute inset-0 overflow-visible rounded-2xl"
    >
      {shards.map((s, idx) => (
        <motion.div
          key={idx}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: s.x, y: s.y, rotate: s.r, opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="absolute inset-0 rounded-2xl border border-white/20 bg-white/[0.08] backdrop-blur-md"
          style={{
            clipPath: `polygon(${20 + idx * 12}% 0%, ${60 + idx * 5}% 0%, 100% ${
              30 + idx * 8
            }%, ${70 - idx * 5}% 100%, 0% ${60 - idx * 4}%)`,
          }}
        />
      ))}
      {/* fading wrong stamp */}
      <motion.div
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: 1.3, opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 grid place-items-center"
      >
        <div className="font-display text-7xl font-black text-rose-400/80 drop-shadow-[0_0_30px_rgba(244,63,94,0.8)]">
          ✕
        </div>
        <div className="absolute bottom-4 text-xs font-bold uppercase tracking-widest text-rose-200/80">
          {letter} · {label}
        </div>
      </motion.div>
    </motion.div>
  );
}

function TimerRing({ seconds, max, active }: { seconds: number; max: number; active: boolean }) {
  const pct = Math.max(0, Math.min(1, seconds / max));
  const r = 36;
  const c = 2 * Math.PI * r;
  const danger = seconds <= 5;
  const stroke = danger
    ? "oklch(0.7 0.28 25)"
    : seconds <= 9
      ? "oklch(0.78 0.18 75)"
      : "oklch(0.78 0.15 200)";
  return (
    <div className={`relative h-24 w-24 ${danger && active ? "animate-pulse" : ""}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="oklch(1 0 0 / 0.08)" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{
            transition: active ? "stroke-dashoffset 0.2s linear, stroke 0.3s" : undefined,
            filter: `drop-shadow(0 0 8px ${stroke})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-mono text-2xl font-black text-white">
        {Math.max(0, Math.ceil(seconds))}
      </div>
    </div>
  );
}
