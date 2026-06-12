import { memo, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { play, setMusicIntensity } from "@/lib/sound-engine";
import { ShatteredFaces } from "./ShatteredFaces";
import { ShutterTransition } from "./ShutterTransition";
import { CategoryReveal } from "./CategoryReveal";
import { mirrorLetters } from "@/lib/wildcards";


type Player = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  current_answer: number | null;
  is_audience?: boolean;
};

type Props = {
  questionText: string;
  answers: string[];
  droppedIndexes: number[];
  correctIndex: number | null; // null until reveal
  secondsLeft: number;
  totalS?: number;
  readSecondsLeft?: number; // >0 while in the read window
  players: Player[];
  phase: "question" | "reveal";
  explanation?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null; // 'image' | 'audio'
  questionNumber?: number;
  hideTimer?: boolean;
  /** Optional category name e.g. "Movies" — drives the category-reveal card during the intro. */
  category?: string | null;
  /** Active wildcard for this round; drives mirror/blackout visual treatments. */
  wildcard?: string | null;
};



const LETTERS = ["A", "B", "C", "D"] as const;

/** Duration of the falling-tile gravity animation. Drop SFX + debris fire at impact. */
export const DROP_FALL_MS = 750;

export const QuestionStage = memo(function QuestionStage({
  questionText,
  answers,
  droppedIndexes,
  correctIndex,
  secondsLeft,
  totalS = 25,
  readSecondsLeft = 0,
  players,
  phase,
  explanation,
  mediaUrl,
  mediaType,
  questionNumber = 1,
  hideTimer = false,
  category = null,
}: Props) {

  // Anchor the intro on when THIS host first observed the new question.
  // The server schedules `question_started_at` ~6s in the future, but realtime
  // delivery latency can eat into that window, randomly shortening the intro.
  // We track the local start time per question and guarantee a full local
  // budget regardless of when the server-derived value arrives.
  const INTRO_BUDGET_S = 6;
  const questionKey = `${questionNumber}|${questionText}`;
  const localStartRef = useRef<{ key: string; startedAt: number } | null>(null);
  if (!localStartRef.current || localStartRef.current.key !== questionKey) {
    localStartRef.current = { key: questionKey, startedAt: performance.now() };
  }
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (phase !== "question") return;
    const startedAt = localStartRef.current?.startedAt ?? performance.now();
    const id = window.setInterval(() => {
      forceTick((n) => n + 1);
      // The intro window is only INTRO_BUDGET_S; stop ticking once it elapses
      if (performance.now() - startedAt > (INTRO_BUDGET_S + 0.2) * 1000) {
        window.clearInterval(id);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, questionKey]);

  const localReadSecondsLeft =
    phase === "question"
      ? Math.max(0, INTRO_BUDGET_S - (performance.now() - localStartRef.current.startedAt) / 1000)
      : 0;
  const effectiveReadSecondsLeft = Math.max(localReadSecondsLeft, readSecondsLeft);
  const reading = effectiveReadSecondsLeft > 0 && phase === "question";

  // Phased intro derived from effectiveReadSecondsLeft (6s total budget).
  //   Phase 1 (badge):     readSecondsLeft > 4.0  (~0–2.0s)
  //   Phase 2 (question):  readSecondsLeft 2.0–4.0 (~2.0–4.0s)
  //   Phase 3 (answers):   readSecondsLeft 0–2.0  (~4.0–6.0s)
  //   Phase 4 (play):      readSecondsLeft <= 0
  const introPhase: 1 | 2 | 3 | 4 = !reading
    ? 4
    : effectiveReadSecondsLeft > 4.0
      ? 1
      : effectiveReadSecondsLeft > 2.0
        ? 2
        : 3;
  const showBadge = introPhase === 1;
  const showQuestion = introPhase >= 2;
  const showAnswers = introPhase >= 3;

  // Soft tick SFX as each answer lands during the stagger (~2s phase).
  const tickedRef = useRef<string>("");
  useEffect(() => {
    if (!showAnswers) {
      tickedRef.current = "";
      return;
    }
    const key = `${questionText}-${answers.join("|")}`;
    if (tickedRef.current === key) return;
    tickedRef.current = key;
    for (let i = 0; i < answers.length; i++) {
      window.setTimeout(() => play("tick"), 100 + i * 380);
    }
  }, [showAnswers, questionText, answers]);

  // Heartbeat pulse near end of timer
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

  // Adaptive music intensity — ramps a rumble/sub layer as timer drains.
  // 0 outside the question phase; otherwise (1 - secondsLeft/totalS).
  useEffect(() => {
    if (phase !== "question" || reading) {
      setMusicIntensity(0);
      return;
    }
    const i = 1 - Math.max(0, Math.min(1, secondsLeft / Math.max(1, totalS)));
    setMusicIntensity(i);
  }, [secondsLeft, totalS, phase, reading]);
  useEffect(() => () => setMusicIntensity(0), []);



  const { lockedByIndex, lockedCount } = useMemo<{
    lockedByIndex: Record<number, Player[]>;
    lockedCount: number;
  }>(() => {
    const idx: Record<number, Player[]> = { 0: [], 1: [], 2: [], 3: [] };
    let count = 0;
    for (const p of players) {
      if (p.current_answer !== null && p.current_answer >= 0 && p.current_answer < 4) {
        idx[p.current_answer].push(p);
        count++;
      }
    }
    return { lockedByIndex: idx, lockedCount: count };
  }, [players]);



  // Two-beat reveal: 'tiles' (~2.2s) -> 'fullscreen' (correct answer + did you know).
  const [revealStage, setRevealStage] = useState<"tiles" | "fullscreen">("tiles");
  useEffect(() => {
    if (phase !== "reveal") {
      setRevealStage("tiles");
      return;
    }
    const id = window.setTimeout(() => setRevealStage("fullscreen"), 2200);
    return () => window.clearTimeout(id);
  }, [phase, questionNumber]);
  const showFullscreenReveal =
    phase === "reveal" && revealStage === "fullscreen" && correctIndex != null;

  // Per-cell "has the falling tile hit the floor?" gate — debris fires at impact.
  const [impacted, setImpacted] = useState<boolean[]>([false, false, false, false]);
  useEffect(() => {
    // Reset impact flags whenever the question changes.
    setImpacted([false, false, false, false]);
  }, [questionNumber]);
  useEffect(() => {
    const timers: number[] = [];
    droppedIndexes.forEach((i) => {
      if (impacted[i]) return;
      timers.push(
        window.setTimeout(() => {
          setImpacted((prev) => {
            if (prev[i]) return prev;
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }, DROP_FALL_MS),
      );
    });
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedIndexes.join(",")]);

  return (
    <motion.div
      className="relative flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4 sm:gap-4 sm:p-5"
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
          opacity: !hideTimer && phase === "question" && secondsLeft <= 5 && pulse ? 1 : 0,
        }}
      />


      {/* Header */}
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-300/80">
          {reading
            ? "Read the question…"
            : phase === "question"
              ? "Live · Eliminate the wrong"
              : "Reveal"}
        </div>
        {!hideTimer && (
          <div className="flex items-center gap-4">
            {phase === "question" && !reading && (
              <PointsTicker secondsLeft={secondsLeft} max={totalS} />
            )}
            {reading ? null : (
              <TimerRing seconds={secondsLeft} max={totalS} active={phase === "question"} />
            )}
          </div>
        )}
      </div>


      {/* Question — fades in during phase 2 */}
      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <motion.h2
          initial={false}
          animate={{
            opacity: showQuestion ? 1 : 0,
            y: showQuestion ? 0 : 16,
            filter: showQuestion ? "blur(0px)" : "blur(8px)",
          }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-2xl font-black leading-[1.05] text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)] sm:text-3xl lg:text-4xl xl:text-5xl"
          style={{ textWrap: "balance" as never }}
        >
          {questionText}
        </motion.h2>
        <div className="mx-auto mt-2 h-[2px] w-24 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
      </div>

      {/* Media (image / audio) */}
      {mediaUrl && mediaType === "image" && (
        <div className="relative z-10 mx-auto flex w-full max-w-3xl justify-center">
          <img
            src={mediaUrl}
            alt=""
            className="max-h-[22vh] w-auto rounded-2xl border border-white/10 object-contain shadow-[0_20px_80px_-20px_rgba(0,0,0,0.7)]"
          />
        </div>
      )}
      {mediaUrl && mediaType === "audio" && phase === "question" && (
        <QuestionAudio src={mediaUrl} autoStart={!reading} />
      )}
      {mediaUrl && mediaType === "video" && phase === "question" && (
        <QuestionVideo src={mediaUrl} autoStart={!reading} />
      )}

      {/* Cinematic shutter wipe + "QUESTION N" card during phase 1 */}
      <ShutterTransition
        visible={showBadge}
        eyebrow="Get ready"
        title={`Question ${questionNumber}`}
        closeMs={420}
        holdMs={900}
        openMs={520}
        zIndex={30}
        position="absolute"
      />

      {/* Broadcast-style category reveal — sits above the shutter during the
          first read-phase, then exits as the question text fades in. */}
      <CategoryReveal
        category={category}
        visible={showBadge}
        subline={`Question ${questionNumber}`}
        zIndex={35}
        appearDelayMs={1250}
      />





      {/* Answer panels — fixed 2x2 grid; cells NEVER reflow when shattered */}
      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3">

        {answers.map((label, i) => {
          const dropped = droppedIndexes.includes(i);
          const isCorrect = phase === "reveal" && correctIndex === i;
          const isWrongReveal =
            phase === "reveal" && correctIndex !== null && i !== correctIndex;
          const locks = lockedByIndex[i];

          // Stable tilt per cell so each drop looks different
          const tilt = (i % 2 === 0 ? -1 : 1) * (10 + (i * 3) % 8);

          return (
            <div key={i} className="relative min-h-0">
              {/* Ghost footprint — faded letter/label + lock avatars, shown only after the card has fallen */}
              <div
                className={`absolute inset-0 flex h-full w-full flex-col justify-between rounded-2xl border border-rose-500/20 bg-rose-950/15 p-3 backdrop-blur-sm transition-opacity duration-500 sm:p-4 ${
                  dropped ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden={!dropped}
              >
                <div className="flex items-start justify-between">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-white/5 font-display text-base font-black text-white/30 ring-1 ring-white/10 line-through decoration-rose-400/70 decoration-2 sm:h-10 sm:w-10 sm:text-lg">
                    {LETTERS[i]}
                  </div>
                </div>
                <div className="my-2 text-lg font-bold leading-tight text-white/25 line-through decoration-rose-400/60 sm:text-xl lg:text-2xl xl:text-3xl">
                  {label}
                </div>
                <div className="flex min-h-[28px] flex-wrap items-center gap-1.5">
                  {phase === "question" && dropped && locks.slice(0, 12).map((p) => (
                    <div
                      key={p.id}
                      title={p.nickname}
                      className="h-7 w-7 overflow-hidden rounded-full opacity-70 ring-2 ring-rose-400/40"
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.nickname} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-white/20 text-[10px] font-black text-white">
                          {p.nickname.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
                  {phase === "question" && dropped && locks.length > 12 && (
                    <div className="text-[10px] font-bold text-white/40">+{locks.length - 12}</div>
                  )}
                </div>
              </div>

              {/* Falling card — animates off the bottom when dropped */}
              <motion.div
                initial={false}
                animate={
                  dropped
                    ? {
                        y: ["0%", "15%", "180%"],
                        rotate: [0, (i % 2 === 0 ? -1 : 1) * 3, (i % 2 === 0 ? -1 : 1) * (4 + (i % 3))],
                        opacity: [1, 1, 0],
                        scale: 1,
                      }
                    : {
                        scale: !showAnswers ? 0.94 : isCorrect ? 1.04 : 1,
                        opacity: !showAnswers ? 0 : isWrongReveal ? 0.25 : 1,
                        y: !showAnswers ? 16 : 0,
                        rotate: 0,
                      }
                }
                transition={
                  dropped
                    ? {
                        duration: DROP_FALL_MS / 1000,
                        times: [0, 0.2, 1],
                        ease: ["easeOut", "easeIn"],
                      }
                    : { duration: 0.35, delay: showAnswers && reading ? i * 0.11 : 0, ease: [0.22, 1, 0.36, 1] }
                }
                style={{ transformOrigin: "50% 0%" }}
                className={`relative flex h-full w-full min-h-0 flex-col justify-between overflow-hidden rounded-2xl border p-3 backdrop-blur-xl sm:p-4 ${
                  isCorrect
                    ? "border-amber-300/80 bg-gradient-to-br from-amber-400/25 to-amber-600/10 shadow-[0_0_80px_oklch(0.85_0.18_85/0.7)]"
                    : "border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_60px_rgba(0,0,0,0.5)]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`grid h-9 w-9 place-items-center rounded-full font-display text-base font-black sm:h-10 sm:w-10 sm:text-lg ${
                      isCorrect
                        ? "bg-amber-300 text-amber-950"
                        : "bg-white/10 text-white/90 ring-1 ring-white/20"
                    }`}
                  >
                    {LETTERS[i]}
                  </div>
                </div>

                <div className="my-2 text-lg font-bold leading-tight text-white sm:text-xl lg:text-2xl xl:text-3xl">
                  {label}
                </div>

                <div className="flex min-h-[28px] flex-wrap items-center gap-1.5">
                  {/* During the live question, peer picks are HIDDEN to prevent
                      copying. Avatars surface on reveal only. */}
                  {phase === "reveal" && !dropped &&
                    locks.slice(0, 12).map((p) => (
                      <div
                        key={p.id}
                        title={p.nickname}
                        className={`flex items-center gap-1.5 rounded-full px-1.5 py-0.5 ring-1 ${
                          isCorrect
                            ? "bg-amber-300/20 ring-amber-300/40"
                            : "bg-rose-500/20 ring-rose-400/40"
                        }`}
                      >
                        <div className="h-5 w-5 overflow-hidden rounded-full ring-1 ring-black/40">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt={p.nickname} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-white/20 text-[9px] font-black text-white">
                              {p.nickname.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="pr-1 text-[11px] font-bold text-white/90">{p.nickname}</span>
                      </div>
                    ))}

                  {phase === "reveal" && !dropped && locks.length > 12 && (
                    <div className="text-[10px] font-bold text-white/60">+{locks.length - 12}</div>
                  )}
                </div>
              </motion.div>

              {/* Debris burst — fires at the impact moment, after the tile has fallen */}
              <AnimatePresence>
                {dropped && impacted[i] && <DropDebris key={`debris-${i}`} />}
              </AnimatePresence>
            </div>
          );
        })}
      </div>




      {/* Full-screen reveal: huge correct answer + Did You Know */}
      <AnimatePresence>
        {showFullscreenReveal && (
          <motion.div
            key={`fullscreen-reveal-${questionNumber}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-8 overflow-y-auto px-8 py-12 sm:px-16"
            style={{
              background:
                "radial-gradient(ellipse 90% 70% at 50% 40%, oklch(0.20 0.06 270 / 0.98), oklch(0.06 0.02 270) 80%)",
              backdropFilter: "blur(14px)",
            }}
          >
            {/* Correct answer block */}
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.5em] text-emerald-300/80">
                Correct answer
              </div>
              <div
                className="mt-4 bg-gradient-to-b from-amber-100 via-amber-200 to-amber-400 bg-clip-text font-display text-5xl font-black uppercase leading-[1.05] tracking-tight text-transparent drop-shadow-[0_8px_50px_rgba(251,191,36,0.45)] sm:text-6xl lg:text-7xl xl:text-8xl"
                style={{ textWrap: "balance" as never }}
              >
                {LETTERS[correctIndex!]}. {answers[correctIndex!]}
              </div>
              <div className="mx-auto mt-5 h-[3px] w-40 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
            </motion.div>

            {/* Did You Know */}
            {explanation && explanation.trim().length > 0 && (
              <motion.div
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.55, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto w-full max-w-5xl rounded-3xl border-2 border-amber-300/40 bg-gradient-to-br from-amber-400/15 via-amber-500/[0.06] to-transparent px-8 py-7 shadow-[0_30px_120px_-30px_rgba(251,191,36,0.45)] backdrop-blur-xl sm:px-12 sm:py-9"
              >
                <div className="text-center text-xs font-bold uppercase tracking-[0.5em] text-amber-300">
                  💡 Did you know?
                </div>
                <div
                  className="mt-5 text-center font-display text-2xl font-semibold leading-snug text-white sm:text-3xl lg:text-4xl"
                  style={{ textWrap: "balance" as never }}
                >
                  {explanation}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>



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

      {/* Wrong-answer face overlay — fires on reveal */}
      <ShatteredFaces
        victims={
          phase === "reveal" && correctIndex != null
            ? players
                .filter(
                  (p) =>
                    !p.is_audience &&
                    p.current_answer != null &&
                    p.current_answer !== correctIndex,
                )
                .map((p) => ({
                  id: p.id,
                  nickname: p.nickname,
                  avatar_url: p.avatar_url,
                }))
            : []
        }
        triggerKey={phase === "reveal" ? `${questionNumber}-reveal` : ""}
      />
    </motion.div>
  );
});

function DropDebris() {
  // Debris burst that fires once when an answer tile drops off the board:
  // a few rectangular shards spin outward + rose embers drift up.
  const shards = Array.from({ length: 7 });
  const embers = Array.from({ length: 10 });
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible">
      {/* Impact flash — fires just as the tile lands */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.5, 0], scale: [0.6, 1.3, 1.5] }}
        transition={{ duration: 0.35, delay: 0.05, ease: "easeOut", times: [0, 0.3, 1] }}
        className="absolute inset-x-0 bottom-0 mx-auto h-12 w-2/3 rounded-full"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 100%, oklch(0.78 0.18 30 / 0.55), transparent 70%)",
          filter: "blur(4px)",
        }}
      />
      {/* Rectangular shards spinning outward in a staggered wave */}
      {shards.map((_, i) => {
        const angle = -90 + (i - shards.length / 2) * 22 + (i * 7) % 11;
        const dist = 60 + (i * 13) % 40;
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * dist;
        const y = Math.sin(rad) * dist;
        return (
          <motion.span
            key={`s-${i}`}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{
              x: [0, x * 0.6, x],
              y: [0, y, y + 60],
              opacity: [1, 1, 0],
              rotate: (i % 2 ? 1 : -1) * (180 + i * 30),
              scale: [1, 0.7, 0.4],
            }}
            transition={{
              duration: 0.75,
              delay: 0.05 + i * 0.025,
              ease: [0.22, 1, 0.36, 1],
              times: [0, 0.4, 1],
            }}
            className="absolute left-1/2 top-1/2 block h-2 w-3 rounded-sm bg-rose-300/80"
            style={{ filter: "drop-shadow(0 0 6px rgba(244,63,94,0.8))" }}
          />
        );
      })}
      {/* Rose embers drifting up — lingering, not flashing */}
      {embers.map((_, i) => {
        const xStart = 18 + ((i * 11) % 72);
        const drift = (i % 2 === 0 ? -1 : 1) * (10 + (i % 3) * 8);
        const delay = 0.08 + (i % 5) * 0.06;
        return (
          <motion.span
            key={`e-${i}`}
            initial={{ opacity: 0, x: `${xStart}%`, y: "80%", scale: 0.6 }}
            animate={{
              opacity: [0, 0.7, 0],
              y: "5%",
              x: `${xStart + drift}%`,
              scale: [0.5, 1, 0.3],
            }}
            transition={{ duration: 1.1, delay, ease: "easeOut" }}
            className="absolute block h-1.5 w-1.5 rounded-full bg-rose-300"
            style={{ filter: "drop-shadow(0 0 6px rgba(244,63,94,0.9))" }}
          />
        );
      })}
    </div>
  );
}




function PointsTicker({ secondsLeft, max }: { secondsLeft: number; max: number }) {
  const points = Math.max(0, Math.round((Math.max(0, secondsLeft) / max) * 1000));
  const color =
    points >= 500
      ? "text-amber-200"
      : points >= 150
        ? "text-amber-400"
        : "text-rose-400";
  return (
    <div className="flex flex-col items-end justify-center">
      <div className="text-[9px] font-bold uppercase tracking-[0.35em] text-white/50">
        Lock now
      </div>
      <div className={`font-mono text-xl font-black tabular-nums sm:text-2xl lg:text-3xl ${color} drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]`}>
        {points}
      </div>
    </div>
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
    <div className={`relative h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 ${danger && active ? "animate-pulse" : ""}`}>
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
      <div className="absolute inset-0 grid place-items-center font-mono text-lg font-black text-white sm:text-xl lg:text-2xl">
        {Math.max(0, Math.ceil(seconds))}
      </div>
    </div>
  );
}

function QuestionAudio({ src, autoStart }: { src: string; autoStart: boolean }) {
  const [playedKey, setPlayedKey] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  // Auto-play once per source when the read window ends.
  useEffect(() => {
    if (!audioEl || !autoStart) return;
    if (playedKey === src) return;
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
    setPlayedKey(src);
  }, [audioEl, autoStart, src, playedKey]);

  // Reset the "played" key whenever the src changes (new question).
  useEffect(() => {
    setPlayedKey(null);
  }, [src]);


  return (
    <div className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 backdrop-blur-xl">
      <button
        type="button"
        onClick={() => {
          if (!audioEl) return;
          audioEl.currentTime = 0;
          audioEl.play().catch(() => {});
        }}
        className="grid h-14 w-14 place-items-center rounded-full bg-amber-300 text-2xl font-black text-amber-950 shadow-[0_0_30px_oklch(0.85_0.18_85/0.55)]"
        aria-label="Replay clip"
      >
        {isPlaying ? "▶" : "▶"}
      </button>
      <div className="flex-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-300/80">
          Listen
        </div>
        <div className="mt-1 text-sm text-white/70">
          {isPlaying ? "Playing…" : "Tap to replay"}
        </div>
      </div>
      <audio
        ref={setAudioEl}
        src={src}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
}

function QuestionVideo({ src, autoStart }: { src: string; autoStart: boolean }) {
  const [playedKey, setPlayedKey] = useState<string | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoEl || !autoStart) return;
    if (playedKey === src) return;
    videoEl.currentTime = 0;
    videoEl.play().catch(() => {});
    setPlayedKey(src);
  }, [videoEl, autoStart, src, playedKey]);

  useEffect(() => {
    setPlayedKey(null);
  }, [src]);

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-3xl justify-center">
      <video
        ref={setVideoEl}
        src={src}
        controls
        preload="auto"
        className="max-h-[40vh] w-auto rounded-2xl border border-white/10 object-contain shadow-[0_20px_80px_-20px_rgba(0,0,0,0.7)]"
      />
    </div>
  );
}
