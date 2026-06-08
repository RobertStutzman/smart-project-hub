import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { speakPersona } from "@/lib/host-persona";
import { speakAboutPlayer } from "@/lib/persona-live";

type Player = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  score: number;
  current_answer?: number | null;
  current_round_score?: number;
  current_round_fastest?: boolean;
  streak_count?: number;
  best_streak?: number;
  is_audience?: boolean;
};

type Props = {
  players: Player[];
  roundNumber: number;
  /** Re-mounts the reel when this changes (e.g. round_number). */
  triggerKey: string | number;
  onDone: () => void;
};

function Avatar({
  p,
  size = "h-28 w-28",
  glow = "shadow-[0_0_60px_oklch(0.85_0.18_85/0.55)]",
  desat = false,
  ring = "border-amber-300/70",
}: {
  p: Player;
  size?: string;
  glow?: string;
  desat?: boolean;
  ring?: string;
}) {
  const filter = desat ? "grayscale(0.7) brightness(0.85)" : undefined;
  if (p.avatar_url) {
    return (
      <img
        src={p.avatar_url}
        alt={p.nickname}
        style={{ filter }}
        className={`${size} rounded-full border-2 ${ring} object-cover ${glow}`}
      />
    );
  }
  return (
    <div
      style={{ filter }}
      className={`${size} grid place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 font-display text-4xl font-black text-amber-950 ${glow}`}
    >
      {p.nickname.slice(0, 1).toUpperCase()}
    </div>
  );
}

type Beat = {
  key: string;
  durationMs: number;
  render: () => React.ReactNode;
  speak?: () => void;
};

export function RoundRecapReel({ players, roundNumber, triggerKey, onDone }: Props) {
  const [beatIdx, setBeatIdx] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const beats = useMemo<Beat[]>(() => {
    const real = players.filter((p) => !p.is_audience);
    const byRoundDesc = [...real].sort(
      (a, b) => (b.current_round_score ?? 0) - (a.current_round_score ?? 0),
    );
    const byRoundAsc = [...real].sort(
      (a, b) => (a.current_round_score ?? 0) - (b.current_round_score ?? 0),
    );

    const mvp = byRoundDesc[0];
    const fastest =
      real.find((p) => p.current_round_fastest) ??
      byRoundDesc.find((p) => (p.current_round_score ?? 0) > 0) ??
      null;

    const streakKing = [...real].sort(
      (a, b) => (b.streak_count ?? 0) - (a.streak_count ?? 0),
    )[0];
    const hasStreak = (streakKing?.streak_count ?? 0) >= 2;

    // Wooden Spoon: lowest current_round_score; require at least 2 real players
    // and skip if everyone tied at the top (no spread).
    const woodenSpoon =
      real.length >= 2 &&
      (byRoundDesc[0]?.current_round_score ?? 0) !==
        (byRoundAsc[0]?.current_round_score ?? 0)
        ? byRoundAsc[0]
        : null;

    const zeroes = real.filter((p) => (p.current_round_score ?? 0) === 0);
    const hasZeroes = zeroes.length > 0 && real.length >= 2;

    // Biggest Climb / Drop — compare rank by score vs rank by prev score.
    let biggestClimb: { p: Player; ranks: number } | null = null;
    let biggestDrop: { p: Player; ranks: number } | null = null;
    if (real.length >= 3) {
      const currRanks = new Map<string, number>();
      [...real].sort((a, b) => b.score - a.score).forEach((p, i) => currRanks.set(p.id, i));
      const prevRanks = new Map<string, number>();
      [...real]
        .sort((a, b) => (b.score - (b.current_round_score ?? 0)) - (a.score - (a.current_round_score ?? 0)))
        .forEach((p, i) => prevRanks.set(p.id, i));
      for (const p of real) {
        const delta = (prevRanks.get(p.id) ?? 0) - (currRanks.get(p.id) ?? 0);
        if (delta > 0 && (!biggestClimb || delta > biggestClimb.ranks)) biggestClimb = { p, ranks: delta };
        if (delta < 0 && (!biggestDrop || delta < -biggestDrop.ranks)) biggestDrop = { p, ranks: -delta };
      }
    }

    const list: Beat[] = [];


    // beat: Round splash
    list.push({
      key: "splash",
      durationMs: 1800,
      render: () => (
        <motion.div
          key="splash"
          initial={{ opacity: 0, scale: 1.25, letterSpacing: "0.05em" }}
          animate={{ opacity: 1, scale: 1, letterSpacing: "0.15em" }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="max-w-full overflow-hidden text-center"
        >
          <div className="text-[11px] font-black uppercase tracking-[0.6em] text-amber-300/80">
            Recap
          </div>
          <div
            className="mt-2 max-w-full truncate font-display text-[clamp(4rem,13vw,9rem)] font-black uppercase leading-none text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(180deg, oklch(0.98 0.10 90) 0%, oklch(0.75 0.20 60) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              filter: "drop-shadow(0 8px 40px oklch(0.85 0.20 70 / 0.55))",
            }}
          >
            Round {roundNumber}
          </div>
          <div className="mx-auto mt-3 h-[3px] w-40 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
        </motion.div>
      ),
    });

    // beat: Round scoreboard — always shown so the recap has substance
    // even when no conditional beats (MVP/fastest/streak/spoon/zeros) qualify.
    if (real.length > 0) {
      list.push({
        key: "scoreboard",
        durationMs: 2600,
        speak: () => speakPersona(`Here's how round ${roundNumber} shook out.`, { interrupt: true }),
        render: () => (
          <motion.div
            key="scoreboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex max-w-[94vw] flex-col items-center gap-5 overflow-hidden text-center"
          >
            <div className="text-[11px] font-black uppercase tracking-[0.6em] text-amber-300/80">
              Round {roundNumber} · Scoreboard
            </div>
            <div className="flex flex-wrap items-end justify-center gap-4 sm:gap-5">
              {byRoundDesc.slice(0, 8).map((p, i) => {
                const score = p.current_round_score ?? 0;
                const top = i === 0 && score > 0;
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 24, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      delay: 0.18 + i * 0.09,
                      type: "spring",
                      stiffness: 240,
                      damping: 20,
                    }}
                    className="flex w-24 flex-col items-center sm:w-28"
                  >
                    <Avatar
                      p={p}
                      size="h-20 w-20 sm:h-24 sm:w-24"
                      ring={top ? "border-amber-300/80" : "border-white/30"}
                      glow={
                        top
                          ? "shadow-[0_0_55px_oklch(0.85_0.18_85/0.55)]"
                          : "shadow-[0_0_30px_oklch(0.4_0.05_270/0.5)]"
                      }
                    />
                    <div className="mt-2 max-w-[6.5rem] truncate font-display text-sm font-bold uppercase tracking-wider text-white sm:text-base">
                      {p.nickname}
                    </div>
                    <div
                      className={`mt-1 font-mono text-xl font-black sm:text-2xl ${
                        score > 0 ? "text-emerald-300" : "text-zinc-400"
                      }`}
                    >
                      {score > 0 ? `+${score}` : "0"}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ),
      });
    }

    // beat: Fastest finger
    if (fastest) {
      list.push({
        key: "fastest",
        durationMs: 2100,
        speak: () => speakPersona(`Fastest finger: ${fastest.nickname}!`, { interrupt: true }),
        render: () => (
          <motion.div
            key="fastest"
            initial={{ opacity: 0, x: -120 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 120 }}
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
            className="flex max-w-[92vw] items-center gap-5 overflow-hidden text-left sm:gap-6"
          >
            <Avatar p={fastest} ring="border-rose-300/70" glow="shadow-[0_0_60px_oklch(0.7_0.2_20/0.55)]" />
            <div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.4em] text-rose-300">
                ⚡ Fastest finger
              </div>
              <div className="mt-1 max-w-[58vw] truncate font-display text-5xl font-black text-white sm:text-6xl">
                {fastest.nickname}
              </div>
              {(fastest.current_round_score ?? 0) > 0 && (
                <div className="mt-1 font-mono text-2xl font-black text-emerald-300">
                  +{fastest.current_round_score}
                </div>
              )}
            </div>
          </motion.div>
        ),
      });
    }

    // beat: Hot Streak (conditional)
    if (hasStreak && streakKing) {
      list.push({
        key: "streak",
        durationMs: 2000,
        speak: () =>
          void speakAboutPlayer({
            nickname: streakKing.nickname,
            moment: "streak",
            streak: streakKing.streak_count ?? 2,
          }),
        render: () => (
          <motion.div
            key="streak"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 180, damping: 16 }}
            className="flex max-w-[92vw] items-center gap-5 overflow-hidden text-left sm:gap-6"
          >
            <Avatar p={streakKing} size="h-32 w-32" ring="border-orange-400/80" glow="shadow-[0_0_70px_oklch(0.75_0.2_50/0.7)]" />
            <div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.4em] text-orange-300">
                🔥 Hot streak
              </div>
              <div className="mt-1 max-w-[58vw] truncate font-display text-5xl font-black text-orange-200 sm:text-6xl">
                {streakKing.nickname}
              </div>
              <div className="mt-1 font-mono text-3xl font-black text-orange-300">
                {streakKing.streak_count}× in a row
              </div>
            </div>
          </motion.div>
        ),
      });
    }

    // beat: MVP
    if (mvp && (mvp.current_round_score ?? 0) > 0) {
      list.push({
        key: "mvp",
        durationMs: 2400,
        speak: () =>
          void speakAboutPlayer({
            nickname: mvp.nickname,
            moment: "round_recap",
            roundNumber,
          }),
        render: () => (
          <motion.div
            key="mvp"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 180, damping: 16 }}
            className="flex max-w-[92vw] items-center gap-5 overflow-hidden text-left sm:gap-6"
          >
            <Avatar p={mvp} size="h-32 w-32" />
            <div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.4em] text-amber-300">
                ★ Round MVP
              </div>
              <div className="mt-1 max-w-[58vw] truncate font-display text-5xl font-black text-amber-200 sm:text-6xl">
                {mvp.nickname}
              </div>
              <div className="mt-1 font-mono text-3xl font-black text-emerald-300">
                +{mvp.current_round_score ?? 0}
              </div>
            </div>
          </motion.div>
        ),
      });
    }

    // beat: Wooden Spoon
    if (woodenSpoon) {
      list.push({
        key: "spoon",
        durationMs: 2400,
        speak: () =>
          void speakAboutPlayer({
            nickname: woodenSpoon.nickname,
            moment: "wooden_spoon",
            roundNumber,
          }),
        render: () => (
          <motion.div
            key="spoon"
            initial={{ opacity: 0, y: 40, rotate: -3 }}
            animate={{ opacity: 1, y: 0, rotate: -2 }}
            exit={{ opacity: 0, y: 40, rotate: 3 }}
            transition={{ type: "spring", stiffness: 160, damping: 18 }}
            className="relative flex max-w-[92vw] items-center gap-5 overflow-hidden text-left sm:gap-6"
          >
            <div className="absolute inset-x-0 -top-10 mx-auto h-40 w-[120%] -translate-y-1/2 rounded-full bg-rose-900/30 blur-3xl" />
            <div className="relative">
              <Avatar
                p={woodenSpoon}
                desat
                ring="border-rose-400/70"
                glow="shadow-[0_0_60px_oklch(0.5_0.2_25/0.55)]"
              />
              <div className="absolute -bottom-2 -right-2 grid h-12 w-12 place-items-center rounded-full bg-rose-500 text-2xl shadow-lg">
                🥄
              </div>
            </div>
            <div className="relative">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.4em] text-rose-300">
                🥄 Wooden spoon
              </div>
              <div className="mt-1 max-w-[58vw] truncate font-display text-5xl font-black text-rose-200 sm:text-6xl">
                {woodenSpoon.nickname}
              </div>
              <div className="mt-1 font-mono text-2xl font-black text-rose-300">
                +{woodenSpoon.current_round_score ?? 0}
              </div>
              <div className="mt-2 text-xs font-bold uppercase tracking-[0.3em] text-rose-200/80">
                Last place. Somebody had to.
              </div>
            </div>
          </motion.div>
        ),
      });
    }

    // beat: Goose Eggs
    if (hasZeroes) {
      const shown = zeroes.slice(0, 3);
      const extra = zeroes.length - shown.length;
      const namesForSpeech =
        zeroes.length === 1
          ? zeroes[0].nickname
          : zeroes.length === 2
            ? `${zeroes[0].nickname} and ${zeroes[1].nickname}`
            : `${zeroes[0].nickname}, ${zeroes[1].nickname} and ${zeroes.length - 2} more`;
      list.push({
        key: "zeroes",
        durationMs: 2200,
        speak: () =>
          void speakAboutPlayer({
            nickname: zeroes[0].nickname,
            extraNames: zeroes.slice(1).map((p) => p.nickname),
            moment: "goose_egg",
            roundNumber,
          }),
        render: () => (
          <motion.div
            key="zeroes"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex max-w-[92vw] flex-col items-center gap-4 text-center"
          >
            <div className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-300">
              🥚 Goose egg club
            </div>
            <div className="flex items-end gap-4">
              {shown.map((p) => (
                <div key={p.id} className="relative">
                  <Avatar
                    p={p}
                    size="h-20 w-20"
                    desat
                    ring="border-zinc-400/50"
                    glow="shadow-[0_0_40px_oklch(0.4_0.05_270/0.5)]"
                  />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900 px-2 py-0.5 font-mono text-xs font-black text-zinc-100 ring-1 ring-zinc-500">
                    0
                  </div>
                  <div className="mt-3 max-w-[7rem] truncate text-center text-sm font-bold text-zinc-200">
                    {p.nickname}
                  </div>
                </div>
              ))}
              {extra > 0 && (
                <div className="grid h-20 w-20 place-items-center rounded-full bg-zinc-800/70 font-display text-2xl font-black text-zinc-200 ring-2 ring-zinc-600/60">
                  +{extra}
                </div>
              )}
            </div>
            <div className="max-w-[80vw] truncate font-display text-2xl font-black text-zinc-200 sm:text-3xl">
              {namesForSpeech}
            </div>
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-400">
              Scored nothing. Made memories.
            </div>
          </motion.div>
        ),
      });
    }

    // beat: To the board
    list.push({
      key: "board",
      durationMs: 1800,
      render: () => (
        <motion.div
          key="board"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="text-center"
        >
          <div className="text-[11px] font-black uppercase tracking-[0.6em] text-amber-300/80">
            Up next
          </div>
          <div className="mt-2 font-display text-[clamp(3rem,10vw,7rem)] font-black uppercase leading-none text-amber-100">
            To the board
          </div>
          <motion.div
            animate={{ y: [0, 14, 0] }}
            transition={{ duration: 1.0, repeat: Infinity, ease: "easeInOut" }}
            className="mt-2 text-5xl"
          >
            ↓
          </motion.div>
        </motion.div>
      ),
    });

    return list;
  }, [players, roundNumber]);

  const totalMs = useMemo(() => beats.reduce((sum, b) => sum + b.durationMs, 0), [beats]);

  // Schedule beat advances + voice triggers.
  useEffect(() => {
    setBeatIdx(0);
    const timers: number[] = [];
    // Fire beat 0's voice immediately (if any).
    beats[0]?.speak?.();
    let accum = 0;
    for (let i = 0; i < beats.length; i++) {
      accum += beats[i].durationMs;
      const next = i + 1;
      if (next < beats.length) {
        const tid = window.setTimeout(() => {
          setBeatIdx(next);
          beats[next].speak?.();
        }, accum);
        timers.push(tid);
      } else {
        const tid = window.setTimeout(() => onDoneRef.current(), accum);
        timers.push(tid);
      }
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  const current = beats[beatIdx];

  return (
    <div className="relative h-full w-full overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.22_0.04_270/0.95),oklch(0.05_0.02_270)_75%)]" />
      {/* sweeping light bar — retimed to the full reel */}
      <motion.div
        key={`sweep-${triggerKey}`}
        initial={{ x: "-30%", opacity: 0 }}
        animate={{ x: "120%", opacity: [0, 0.5, 0] }}
        transition={{ duration: totalMs / 1000, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-amber-300/15 to-transparent"
      />
      {/* film grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative grid h-full min-h-0 place-items-center overflow-hidden p-5 sm:p-7">
        <AnimatePresence mode="wait">{current?.render()}</AnimatePresence>
      </div>

      {/* progress pips */}
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
        {beats.map((b, i) => (
          <div
            key={b.key}
            className={`h-1 w-12 rounded-full transition-all ${
              i <= beatIdx ? "bg-amber-300" : "bg-white/15"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
