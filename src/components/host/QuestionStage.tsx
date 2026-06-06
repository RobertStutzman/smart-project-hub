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
  readSecondsLeft?: number; // >0 while in the 5-second read window
  players: Player[];
  phase: "question" | "reveal";
  explanation?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null; // 'image' | 'audio'
};

const LETTERS = ["A", "B", "C", "D"] as const;

export function QuestionStage({
  questionText,
  answers,
  droppedIndexes,
  correctIndex,
  secondsLeft,
  readSecondsLeft = 0,
  players,
  phase,
  explanation,
  mediaUrl,
  mediaType,
}: Props) {
  const reading = readSecondsLeft > 0 && phase === "question";
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
          {reading
            ? "Read the question…"
            : phase === "question"
              ? "Live · Eliminate the wrong"
              : "Reveal"}
        </div>
        <div className="flex items-center gap-4">
          {phase === "question" && !reading && (
            <PointsTicker secondsLeft={secondsLeft} max={15} />
          )}
          {reading ? (
            <div className="grid h-24 w-24 place-items-center rounded-full border-4 border-amber-300/60 bg-amber-400/10 font-mono text-4xl font-black text-amber-200 shadow-[0_0_40px_oklch(0.85_0.18_85/0.5)]">
              {Math.ceil(readSecondsLeft)}
            </div>
          ) : (
            <TimerRing seconds={secondsLeft} max={15} active={phase === "question"} />
          )}
        </div>
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

      {/* Media (image / audio) */}
      {mediaUrl && mediaType === "image" && (
        <div className="relative z-10 mx-auto flex w-full max-w-3xl justify-center">
          <img
            src={mediaUrl}
            alt=""
            className="max-h-[36vh] w-auto rounded-2xl border border-white/10 object-contain shadow-[0_20px_80px_-20px_rgba(0,0,0,0.7)]"
          />
        </div>
      )}
      {mediaUrl && mediaType === "audio" && phase === "question" && (
        <QuestionAudio src={mediaUrl} autoStart={!reading} />
      )}
      {mediaUrl && mediaType === "video" && phase === "question" && (
        <QuestionVideo src={mediaUrl} autoStart={!reading} />
      )}

      {/* Answer panels — fixed 2x2 grid; cells NEVER reflow when shattered */}
      <div
        className={`relative z-10 grid flex-1 grid-cols-2 grid-rows-2 gap-4 transition-all duration-300 ${
          reading ? "scale-[0.98] opacity-40 blur-[2px]" : ""
        }`}
      >
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
                </div>

                <div className="my-4 text-2xl font-bold leading-tight text-white sm:text-3xl">
                  {label}
                </div>

                <div className="flex min-h-[28px] flex-wrap items-center gap-1.5">
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



      {/* Explanation / fun fact — reveal only */}
      <AnimatePresence>
        {phase === "reveal" && explanation && explanation.trim().length > 0 && (
          <motion.div
            key="explanation"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 mx-auto w-full max-w-5xl rounded-3xl border-2 border-amber-300/60 bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-amber-600/[0.06] px-8 py-6 shadow-[0_20px_80px_-20px_rgba(251,191,36,0.45)] backdrop-blur-xl sm:px-10 sm:py-8"
          >
            <div className="text-sm font-bold uppercase tracking-[0.4em] text-amber-300">
              💡 Did you know?
            </div>
            <div className="mt-3 text-2xl font-semibold leading-relaxed text-white sm:text-3xl md:text-4xl md:leading-snug">
              {explanation}
            </div>
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
    </motion.div>
  );
}

function ShatterOverlay(_props: { letter: string; label: string }) {
  // 6 shards exploding outward — animate once, then a calm static ✕ stays.
  const shards = [
    { x: -120, y: -90, r: -25 },
    { x: 110, y: -110, r: 30 },
    { x: -140, y: 60, r: -40 },
    { x: 130, y: 80, r: 35 },
    { x: 0, y: -160, r: 12 },
    { x: 0, y: 140, r: -18 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible rounded-2xl">
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
      {/* persistent wrong stamp — animates in once, then stays */}
      <motion.div
        initial={{ scale: 1.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.85 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="absolute inset-0 grid place-items-center"
      >
        <div className="font-display text-7xl font-black text-rose-400/80 drop-shadow-[0_0_30px_rgba(244,63,94,0.8)]">
          ✕
        </div>
      </motion.div>
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
