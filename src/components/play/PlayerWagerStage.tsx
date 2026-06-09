import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const WAGER_DURATION_S = 30;

type Props = {
  score: number;
  wagerDraft: number;
  setWagerDraft: (n: number) => void;
  locked: boolean;
  lockedWager: number;
  onLock: () => void;
};

function riskTier(pct: number): {
  label: string;
  color: string;
  bg: string;
  ring: string;
  shadow: string;
} {
  if (pct >= 1) {
    return {
      label: "ALL IN",
      color: "text-rose-200",
      bg: "from-rose-500/30 via-rose-700/20 to-black",
      ring: "border-rose-400/80",
      shadow: "shadow-[0_0_60px_oklch(0.65_0.25_25/0.55)]",
    };
  }
  if (pct >= 0.66) {
    return {
      label: "Reckless",
      color: "text-rose-300",
      bg: "from-rose-500/15 via-amber-500/10 to-black",
      ring: "border-rose-400/60",
      shadow: "shadow-[0_0_40px_oklch(0.65_0.20_25/0.4)]",
    };
  }
  if (pct >= 0.33) {
    return {
      label: "Bold",
      color: "text-amber-300",
      bg: "from-amber-500/15 via-card/40 to-black",
      ring: "border-amber-300/60",
      shadow: "shadow-[0_0_30px_oklch(0.85_0.18_85/0.35)]",
    };
  }
  return {
    label: "Safe",
    color: "text-emerald-300",
    bg: "from-emerald-500/10 via-card/40 to-black",
    ring: "border-emerald-300/40",
    shadow: "shadow-[0_0_20px_oklch(0.75_0.18_165/0.25)]",
  };
}

function vibrate(ms: number | number[]) {
  try {
    if ("vibrate" in navigator) navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}

export function PlayerWagerStage({
  score,
  wagerDraft,
  setWagerDraft,
  locked,
  lockedWager,
  onLock,
}: Props) {
  const max = Math.max(0, score);
  const pct = max > 0 ? wagerDraft / max : 0;
  const tier = useMemo(() => riskTier(pct), [pct]);

  // Mount-based 30s countdown to match the host's auto-advance.
  const [startMs] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const secondsLeft = Math.max(
    0,
    Math.ceil(WAGER_DURATION_S - (now - startMs) / 1000),
  );
  const timeProgress = Math.min(1, (now - startMs) / (WAGER_DURATION_S * 1000));
  const danger = secondsLeft <= 5 && !locked;

  // Tick haptic when crossing tier thresholds
  useEffect(() => {
    if (locked) return;
    vibrate(8);
  }, [tier.label, locked]);

  if (locked) {
    return (
      <div
        className={`relative flex flex-1 flex-col overflow-hidden rounded-3xl border-2 ${riskTier(
          max > 0 ? lockedWager / max : 0,
        ).ring} bg-gradient-to-br ${
          riskTier(max > 0 ? lockedWager / max : 0).bg
        } p-5`}
      >
        <div className="grid flex-1 place-items-center">
          <motion.div
            initial={{ scale: 1.6, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: -6 }}
            transition={{ type: "spring", stiffness: 240, damping: 14 }}
            className="text-center"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-300/80">
              Wager locked
            </div>
            <div className="mt-2 font-display text-7xl font-black text-amber-200 drop-shadow-[0_0_30px_oklch(0.85_0.20_70/0.6)]">
              {lockedWager}
            </div>
            <div className="mt-3 inline-block rounded-full border-2 border-amber-300/70 px-4 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-amber-200">
              {riskTier(max > 0 ? lockedWager / max : 0).label}
            </div>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-white/40">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-300" />
              Waiting for the question
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const reward = wagerDraft;
  const newHigh = score + reward;
  const newLow = score - reward;

  return (
    <div
      className={`relative flex flex-1 flex-col gap-4 overflow-hidden rounded-3xl border-2 ${tier.ring} bg-gradient-to-br ${tier.bg} p-5 transition-all duration-300 ${tier.shadow}`}
    >
      {/* danger pulse ring when all in */}
      {pct >= 1 && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl"
          animate={{
            boxShadow: [
              "inset 0 0 0px 0px oklch(0.65 0.25 25 / 0.6)",
              "inset 0 0 60px 6px oklch(0.65 0.25 25 / 0.6)",
              "inset 0 0 0px 0px oklch(0.65 0.25 25 / 0.6)",
            ],
          }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <div className="relative text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-300">
          Place your wager
        </div>
        <div className="mt-1 text-xs text-white/50">
          0 – <span className="font-mono font-bold text-white/80">{max}</span> pts on the line
        </div>

        {/* Countdown */}
        <div className="mt-3 flex items-center justify-center gap-3">
          <span
            className={`font-mono text-3xl font-black tabular-nums ${
              danger ? "text-rose-300 animate-pulse" : "text-amber-200"
            }`}
          >
            {secondsLeft}s
          </span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            to lock
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full transition-all ${danger ? "bg-rose-400" : "bg-amber-300"}`}
            style={{ width: `${timeProgress * 100}%` }}
          />
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-4">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={tier.label}
            initial={{ opacity: 0, y: -6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`rounded-full border px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.3em] ${tier.color} ${
              pct >= 1
                ? "border-rose-400/80 bg-rose-500/20"
                : pct >= 0.66
                  ? "border-rose-400/40 bg-rose-500/10"
                  : pct >= 0.33
                    ? "border-amber-300/40 bg-amber-500/10"
                    : "border-emerald-300/40 bg-emerald-500/10"
            }`}
          >
            {tier.label}
          </motion.div>
        </AnimatePresence>

        <motion.div
          key={Math.floor(wagerDraft / Math.max(1, Math.ceil(max / 40))) /* re-mount on bucket change for a tiny bounce */}
          initial={{ scale: 0.92 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          className={`font-display text-7xl font-black tabular-nums ${tier.color} drop-shadow-[0_0_30px_currentColor]`}
        >
          {wagerDraft}
        </motion.div>

        {/* gradient slider */}
        <div className="w-full">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="absolute inset-y-0 left-0"
              style={{
                width: `${pct * 100}%`,
                background:
                  "linear-gradient(90deg, oklch(0.75 0.18 165) 0%, oklch(0.85 0.18 85) 50%, oklch(0.65 0.25 25) 100%)",
                boxShadow: "0 0 20px currentColor",
              }}
            />
            <input
              type="range"
              min={0}
              max={max}
              value={wagerDraft}
              onChange={(e) => setWagerDraft(Number(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Wager amount"
            />
            <div
              className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gradient-to-br from-amber-200 to-amber-500 shadow-[0_0_20px_oklch(0.85_0.18_85/0.8)]"
              style={{ left: `${pct * 100}%` }}
            />
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              { label: "0", val: 0 },
              { label: "¼", val: Math.floor(max / 4) },
              { label: "½", val: Math.floor(max / 2) },
              { label: "All in", val: max, hot: true },
            ].map((q) => (
              <button
                key={q.label}
                onClick={() => {
                  vibrate(15);
                  setWagerDraft(q.val);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                  q.hot
                    ? "border-rose-400/60 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                    : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* outcome preview */}
        <div className="grid w-full grid-cols-2 gap-2 text-center">
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-300/80">
              If correct
            </div>
            <div className="font-mono text-lg font-black text-emerald-300">
              {newHigh}
            </div>
          </div>
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/5 px-3 py-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-rose-300/80">
              If wrong
            </div>
            <div className="font-mono text-lg font-black text-rose-300">
              {Math.max(0, newLow)}
            </div>
          </div>
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => {
          vibrate([30, 40, 80]);
          onLock();
        }}
        className={`relative overflow-hidden rounded-2xl px-6 py-4 font-display text-lg font-black uppercase tracking-wider transition ${
          pct >= 1
            ? "bg-gradient-to-b from-rose-300 to-rose-600 text-rose-950 shadow-[0_0_40px_oklch(0.65_0.25_25/0.6)]"
            : "bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 shadow-[0_0_30px_oklch(0.85_0.18_85/0.5)]"
        }`}
      >
        {pct >= 1 ? "🔥 Lock ALL IN" : `Lock ${wagerDraft}`}
      </motion.button>
    </div>
  );
}
