import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { HOST_NAME, pickLine, speakPersona } from "@/lib/host-persona";
import { play, playCreditsMusic, stopCreditsMusic } from "@/lib/sound-engine";
import { pickAwardRoast, type AwardKey } from "@/lib/credits-awards";
import { derivePlayerHighlights, pickHighlightVox } from "@/lib/player-highlights";

type Player = {
  id: string;
  nickname: string;
  score: number;
  avatar_url: string | null;
  best_streak?: number;
  fastest_count?: number;
  correct_count?: number;
  wrong_count?: number;
  is_audience: boolean;
};

type WrongPick = {
  questionId: string;
  questionText: string;
  correctText: string;
  picks: { sessionId: string; nickname: string; pickedText: string }[];
};

type Props = {
  players: Player[];
  wrongPicks?: WrongPick[];
  onPlayAgain: () => void;
};


type Award = {
  key: AwardKey;
  label: string;
  emoji: string;
  player: Player;
  detail: string;
  tint: string;
};

function deriveAwards(live: Player[]): Award[] {
  if (live.length === 0) return [];
  const out: Award[] = [];

  const ranked = [...live].sort((a, b) => b.score - a.score);
  const champ = ranked[0];
  if (champ) {
    out.push({
      key: "champion",
      label: "Tonight's Champion",
      emoji: "👑",
      player: champ,
      detail: `${champ.score} pts`,
      tint: "from-amber-200 to-amber-400",
    });
  }

  const byCorrect = [...live].sort((a, b) => (b.correct_count ?? 0) - (a.correct_count ?? 0))[0];
  if (byCorrect && (byCorrect.correct_count ?? 0) >= 1 && byCorrect.id !== champ?.id) {
    out.push({
      key: "brain",
      label: "Brain of the Night",
      emoji: "🧠",
      player: byCorrect,
      detail: `${byCorrect.correct_count} correct`,
      tint: "from-violet-200 to-violet-400",
    });
  }

  const byFast = [...live].sort((a, b) => (b.fastest_count ?? 0) - (a.fastest_count ?? 0))[0];
  if (byFast && (byFast.fastest_count ?? 0) >= 1) {
    out.push({
      key: "fastest",
      label: "Fastest Finger",
      emoji: "⚡",
      player: byFast,
      detail: `${byFast.fastest_count}× first to lock`,
      tint: "from-cyan-200 to-cyan-400",
    });
  }

  const byStreak = [...live].sort((a, b) => (b.best_streak ?? 0) - (a.best_streak ?? 0))[0];
  if (byStreak && (byStreak.best_streak ?? 0) >= 3) {
    out.push({
      key: "streak",
      label: "Longest Streak",
      emoji: "🔥",
      player: byStreak,
      detail: `${byStreak.best_streak} in a row`,
      tint: "from-orange-200 to-orange-400",
    });
  }

  const byWrong = [...live].sort((a, b) => (b.wrong_count ?? 0) - (a.wrong_count ?? 0))[0];
  if (byWrong && (byWrong.wrong_count ?? 0) >= 2) {
    out.push({
      key: "wrong",
      label: "Most Confident Wrong",
      emoji: "💥",
      player: byWrong,
      detail: `${byWrong.wrong_count} wrong with conviction`,
      tint: "from-rose-200 to-rose-400",
    });
  }

  // Wooden spoon = lowest score, only if distinct from champ and there's spread
  if (ranked.length >= 3) {
    const last = ranked[ranked.length - 1];
    if (last.id !== champ?.id && last.score < champ!.score) {
      out.push({
        key: "spoon",
        label: "Wooden Spoon",
        emoji: "🥄",
        player: last,
        detail: `${last.score} pts. Bless.`,
        tint: "from-zinc-300 to-zinc-500",
      });
    }
  }

  return out;
}

function PolaroidCard({ award, rotate }: { award: Award; rotate: number }) {
  const { player } = award;
  // Wooden Spoon ("worst player") gets a hero-sized polaroid so the room
  // can actually read the roast from across the bar.
  const featured = award.key === "spoon";
  const photoSize = featured ? "h-80 w-80" : "h-44 w-44";
  const photoFallback = featured ? "text-[10rem]" : "text-7xl";
  const padding = featured ? "p-6" : "p-3";
  const tapeSize = featured ? "h-7 w-32 -top-3" : "h-5 w-20 -top-2";
  const labelSize = featured ? "text-sm tracking-[0.4em]" : "text-[10px] tracking-[0.3em]";
  const nameSize = featured ? "mt-2 text-5xl" : "mt-1 text-2xl";
  const detailSize = featured ? "mt-1 text-lg" : "text-xs";
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: rotate - 6, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, rotate, scale: 1 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ type: "spring", stiffness: 140, damping: 16 }}
      className={`relative inline-block rounded-lg bg-[#f5ecd6] ${padding} shadow-[0_18px_40px_-15px_rgba(0,0,0,0.65)]`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {/* tape */}
      <div className={`absolute left-1/2 -translate-x-1/2 rotate-[-3deg] bg-yellow-200/70 mix-blend-multiply shadow-sm ${tapeSize}`} />
      <div className={`grid ${photoSize} place-items-center overflow-hidden rounded bg-gradient-to-br ${award.tint}`}>
        {player.avatar_url ? (
          <img src={player.avatar_url} alt={player.nickname} className="h-full w-full object-cover" />
        ) : (
          <div className={`font-display font-black text-amber-950 ${photoFallback}`}>
            {player.nickname.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="mt-3 px-1 text-center">
        <div className={`font-mono uppercase text-amber-900/70 ${labelSize}`}>
          {award.emoji} {award.label}
        </div>
        <div className={`font-display font-black uppercase tracking-tight text-amber-950 ${nameSize}`}>
          {player.nickname}
        </div>
        <div className={`italic text-amber-900/80 ${detailSize}`}>{award.detail}</div>
      </div>
    </motion.div>
  );
}


function DumbAnswerCard({
  questionText,
  correctText,
  nickname,
  pickedText,
  rotate,
}: {
  questionText: string;
  correctText: string;
  nickname: string;
  pickedText: string;
  rotate: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: rotate - 6, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, rotate, scale: 1 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ type: "spring", stiffness: 140, damping: 16 }}
      className="relative inline-block w-64 rounded-lg bg-[#f5ecd6] p-3 shadow-[0_18px_40px_-15px_rgba(0,0,0,0.65)]"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div className="absolute -top-2 left-1/2 h-5 w-20 -translate-x-1/2 rotate-[-3deg] bg-rose-200/70 mix-blend-multiply shadow-sm" />
      <div className="rounded bg-gradient-to-br from-rose-100 to-rose-200 p-3">
        <div className="line-clamp-3 text-[11px] italic leading-snug text-amber-950/80">
          “{questionText}”
        </div>
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-rose-900/70">
          {nickname} said
        </div>
        <div className="mt-1 font-display text-2xl font-black uppercase leading-tight tracking-tight text-rose-900">
          {pickedText}
        </div>
        <div className="mt-3 border-t border-rose-900/15 pt-2">
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-emerald-900/70">
            Actually
          </div>
          <div className="mt-0.5 text-sm font-bold text-emerald-900">{correctText}</div>
        </div>
      </div>
      <div className="mt-2 px-1 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-amber-900/70">
        💥 Funniest Moment
      </div>
    </motion.div>
  );
}

export function CreditsStage({ players, wrongPicks, onPlayAgain }: Props) {
  const live = useMemo(() => players.filter((p) => !p.is_audience), [players]);
  const ranked = useMemo(() => [...live].sort((a, b) => b.score - a.score), [live]);
  const winner = ranked[0];
  const awards = useMemo(() => deriveAwards(live), [live]);
  const rotationsRef = useRef<number[]>([]);
  if (rotationsRef.current.length !== awards.length) {
    rotationsRef.current = awards.map((_, i) => ((i * 37) % 7) - 3);
  }

  // Flatten captured wrong picks into per-(player,question) cards, then pick
  // the funniest 6: questions where multiple players whiffed score higher,
  // ties broken by original round order so the latest rounds bubble up.
  const dumbAnswers = useMemo(() => {
    const list = wrongPicks ?? [];
    type Card = {
      key: string;
      questionText: string;
      correctText: string;
      nickname: string;
      pickedText: string;
      groupSize: number;
      order: number;
    };
    const cards: Card[] = [];
    list.forEach((wp, qOrder) => {
      const groupSize = wp.picks.length;
      wp.picks.forEach((pk) => {
        cards.push({
          key: `${wp.questionId}-${pk.sessionId}`,
          questionText: wp.questionText,
          correctText: wp.correctText,
          nickname: pk.nickname,
          pickedText: pk.pickedText,
          groupSize,
          order: qOrder,
        });
      });
    });
    cards.sort((a, b) => b.groupSize - a.groupSize || b.order - a.order);
    return cards.slice(0, 6);
  }, [wrongPicks]);
  const dumbRotationsRef = useRef<number[]>([]);
  if (dumbRotationsRef.current.length !== dumbAnswers.length) {
    dumbRotationsRef.current = dumbAnswers.map((_, i) => ((i * 53) % 9) - 4);
  }


  // Music + opening line + scheduled award roasts.
  useEffect(() => {
    play("whoosh");
    // Delay music start so it doesn't collide with the victory sting
    // that fires on phase=ended right before credits mount.
    const musicTimer = window.setTimeout(() => playCreditsMusic(0.22), 700);
    const opener = pickPersonaLine("credits_open", live.length);
    speakPersona(opener.text, { interrupt: true, voice: opener.voice });

    // Schedule a Vox roast per award, paced so they don't overlap.
    // Skip the champion (it overlaps the opening line); start at +6s.
    const timers: number[] = [];
    const toRoast = awards.filter((a) => a.key !== "champion");
    const awardSlice = toRoast.slice(0, 4);
    awardSlice.forEach((a, i) => {
      const t = window.setTimeout(() => {
        speakPersona(pickAwardRoast(a.key, a.player.nickname));
      }, 6000 + i * 6000);
      timers.push(t);
    });

    // Highlight-reel Vox: short quip per top player, matching their
    // caption category. Alternate best/worst so the reel feels varied.
    // Starts after the last award roast and stays inside the 48s scroll.
    const reelStart = 6000 + awardSlice.length * 6000 + 2000;
    ranked.slice(0, 3).forEach((p, i) => {
      const h = derivePlayerHighlights(p);
      const side: "best" | "worst" =
        i === 0 ? "best" : i === ranked.length - 1 ? "worst" : i % 2 === 0 ? "best" : "worst";
      const t = window.setTimeout(() => {
        speakPersona(pickHighlightVox(h, p.nickname, side));
      }, reelStart + i * 3200);
      timers.push(t);
    });

    return () => {
      window.clearTimeout(musicTimer);
      timers.forEach((t) => window.clearTimeout(t));
      stopCreditsMusic(800);
      // Flush any queued Vox so it doesn't bleed into the next screen.
      void import("@/lib/elf-voice").then((m) => m.cancelElfSpeech());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.length, awards.length]);

  return (
    <div
      className="relative h-full overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(ellipse 100% 80% at 50% 30%, oklch(0.18 0.08 280 / 0.95), oklch(0.04 0.02 270) 75%)",
      }}
    >
      {/* film grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Marquee lights border */}
      <div className="pointer-events-none absolute inset-3 rounded-2xl border border-amber-300/20 shadow-[inset_0_0_60px_oklch(0.85_0.18_85/0.18)]" />

      {/* Skip credits */}
      <button
        onClick={() => {
          stopCreditsMusic(300);
          void import("@/lib/elf-voice").then((m) => m.cancelElfSpeech());
          onPlayAgain();
        }}
        className="absolute right-4 top-4 z-30 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/70 backdrop-blur transition hover:bg-white/20 hover:text-white"
      >
        Skip ⏭
      </button>

      {/* Scrolling credits column — CSS keyframe for smooth GPU transform */}
      <div
        className="credits-roll absolute left-0 right-0 mx-auto flex w-full max-w-3xl flex-col items-center gap-14 px-8 pb-32 pt-32 text-center"
      >
        {/* Winner card */}
        {winner && (
          <div className="flex flex-col items-center gap-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.6em] text-amber-300/80">
              Tonight's Champion
            </div>
            <div className="rounded-full p-1 ring-2 ring-amber-300/80 shadow-[0_0_60px_oklch(0.85_0.18_85/0.6)]">
              {winner.avatar_url ? (
                <img src={winner.avatar_url} alt={winner.nickname} className="h-32 w-32 rounded-full object-cover" />
              ) : (
                <div className="grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 font-display text-5xl font-black text-amber-950">
                  {winner.nickname.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div
              className="mt-2 font-display text-5xl font-black uppercase tracking-tight text-transparent"
              style={{
                backgroundImage: "linear-gradient(180deg, oklch(0.97 0.12 90), oklch(0.75 0.20 60))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
              }}
            >
              {winner.nickname}
            </div>
            <div className="font-mono text-2xl font-black text-amber-200">{winner.score} pts</div>
          </div>
        )}

        {/* Funniest Moments — actual dumb answers people locked in */}
        {dumbAnswers.length > 0 && (
          <div className="w-full">
            <div className="text-[11px] font-bold uppercase tracking-[0.6em] text-amber-300/80">
              Funniest Moments
            </div>
            <div className="mx-auto mt-2 flex items-center justify-center gap-2">
              <div className="h-px w-12 bg-amber-300/40" />
              <span className="text-amber-300/60">😬</span>
              <div className="h-px w-12 bg-amber-300/40" />
            </div>
            <div className="mt-8 flex flex-wrap items-start justify-center gap-x-6 gap-y-8">
              {dumbAnswers.map((d, i) => (
                <DumbAnswerCard
                  key={d.key}
                  questionText={d.questionText}
                  correctText={d.correctText}
                  nickname={d.nickname}
                  pickedText={d.pickedText}
                  rotate={dumbRotationsRef.current[i] ?? 0}
                />
              ))}
            </div>
          </div>
        )}

        {/* Tonight's Awards — generic accolades */}
        {awards.length > 0 && (
          <div className="w-full">
            <div className="text-[11px] font-bold uppercase tracking-[0.6em] text-amber-300/80">
              Tonight's Awards
            </div>
            <div className="mx-auto mt-2 flex items-center justify-center gap-2">
              <div className="h-px w-12 bg-amber-300/40" />
              <span className="text-amber-300/60">✦</span>
              <div className="h-px w-12 bg-amber-300/40" />
            </div>
            <div className="mt-8 flex flex-wrap items-start justify-center gap-x-6 gap-y-8">
              {awards.map((a, i) => (
                <PolaroidCard key={a.key + a.player.id} award={a} rotate={rotationsRef.current[i] ?? 0} />
              ))}
            </div>
          </div>
        )}


        {/* Highlight Reel — best & worst per player */}
        {live.length > 0 && (
          <div className="w-full">
            <div className="text-[11px] font-bold uppercase tracking-[0.6em] text-amber-300/80">
              Highlight Reel
            </div>
            <div className="mx-auto mt-2 flex items-center justify-center gap-2">
              <div className="h-px w-12 bg-amber-300/40" />
              <span className="text-amber-300/60">🎬</span>
              <div className="h-px w-12 bg-amber-300/40" />
            </div>
            <div className="mt-6 flex flex-col gap-3">
              {ranked.map((p) => {
                const { best, worst } = derivePlayerHighlights(p);
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-5%" }}
                    transition={{ type: "spring", stiffness: 160, damping: 18 }}
                    className="mx-auto flex w-full max-w-lg items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left backdrop-blur-sm"
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/20" />
                    ) : (
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-black">
                        {p.nickname.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-sm font-black uppercase tracking-wide text-amber-200">
                        {p.nickname}
                      </div>
                      <div className="mt-0.5 text-[12px] leading-snug text-emerald-200/90">
                        <span className="mr-1 font-mono text-emerald-400/80">▲</span>{best}
                      </div>
                      <div className="text-[12px] leading-snug text-rose-200/80">
                        <span className="mr-1 font-mono text-rose-400/80">▼</span>{worst}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}



        {/* Cast */}
        <div className="w-full max-w-md">
          <div className="text-[11px] font-bold uppercase tracking-[0.6em] text-amber-300/80">Cast</div>
          <div className="mx-auto mt-2 h-px w-24 bg-amber-300/40" />
          <div className="mt-6 flex flex-col gap-3">
            {ranked.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between gap-4 text-lg">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-right font-mono text-white/40">{i + 1}.</span>
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs font-black">
                      {p.nickname.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="font-display font-bold">{p.nickname}</span>
                </div>
                <span className="font-mono text-white/70">{p.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Producer credit */}
        <div className="pt-4 text-center">
          <div className="text-[11px] uppercase tracking-[0.5em] text-white/40">Directed by</div>
          <div className="mt-2 font-display text-3xl font-black text-amber-200">{HOST_NAME}</div>
          <div className="mt-6 text-[10px] uppercase tracking-[0.4em] text-white/30">
            Drop Trivia · A trivia bloodsport
          </div>
        </div>
      </div>


      {/* Play again CTA — pinned bottom, fades in at the end */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 22, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <button
          onClick={() => {
            stopCreditsMusic(300);
            void import("@/lib/elf-voice").then((m) => m.cancelElfSpeech());
            play("whoosh");
            onPlayAgain();
          }}
          className="rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-8 py-3 font-display font-bold uppercase tracking-wider text-amber-950 shadow-[0_0_40px_oklch(0.85_0.18_85/0.5)] transition hover:scale-[1.03]"
        >
          ↻ Play again
        </button>
      </motion.div>
    </div>
  );
}
