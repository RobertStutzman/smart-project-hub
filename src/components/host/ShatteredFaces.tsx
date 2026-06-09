import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { play } from "@/lib/sound-engine";

type Victim = { id: string; nickname: string; avatar_url: string | null; ts: number };

type Props = {
  victims: { id: string; nickname: string; avatar_url: string | null }[];
  triggerKey: string;
};

/**
 * When `triggerKey` changes (e.g. a drop sig), surfaces every player in
 * `victims` as a "shattered face" overlay on the TV for ~2s with a buzzer.
 */
export function ShatteredFaces({ victims, triggerKey }: Props) {
  const [shown, setShown] = useState<Victim[]>([]);

  useEffect(() => {
    if (!triggerKey || victims.length === 0) return;
    const now = Date.now();
    const batch: Victim[] = victims.map((v) => ({ ...v, ts: now }));
    setShown((cur) => [...cur, ...batch]);
    play("sadTrombone");
    const id = window.setTimeout(() => {
      setShown((cur) => cur.filter((v) => v.ts !== now));
    }, 2200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  if (shown.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center">
      <div className="flex flex-wrap items-center justify-center gap-8">
        <AnimatePresence>
          {shown.map((v) => (
            <motion.div
              key={`${v.id}-${v.ts}`}
              initial={{ scale: 0.7, opacity: 0, y: -20 }}
              animate={{ scale: 1, opacity: 1, y: 0, rotate: [-3, 2, -1, 0] }}
              exit={{ scale: 0.9, opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="relative"
            >
              {/* Soft rose halo behind the card */}
              <div className="absolute -inset-6 rounded-[2rem] bg-rose-500/20 blur-2xl" aria-hidden />

              <div
                className="relative h-44 w-44 overflow-hidden rounded-3xl border border-rose-400/60 bg-gradient-to-br from-rose-950/60 to-rose-900/30 shadow-[0_20px_60px_-15px_oklch(0.55_0.22_25/0.7),0_0_0_1px_oklch(0.5_0.2_25/0.3)_inset] backdrop-blur"
              >
                {v.avatar_url ? (
                  <img
                    src={v.avatar_url}
                    alt={v.nickname}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-rose-700 to-rose-900 font-display text-6xl font-black text-rose-50">
                    {v.nickname.slice(0, 1).toUpperCase()}
                  </div>
                )}

                {/* Subtle red tint + vignette so the avatar reads as "down" without distorting it */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, transparent 40%, oklch(0.35 0.18 25 / 0.45) 100%), linear-gradient(180deg, oklch(0.5 0.2 25 / 0.15), oklch(0.3 0.2 25 / 0.35))",
                  }}
                  aria-hidden
                />

                {/* Diagonal "WRONG" stamp — clean typography, no grit */}
                <motion.div
                  initial={{ scale: 1.4, opacity: 0, rotate: -16 }}
                  animate={{ scale: 1, opacity: 1, rotate: -12 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 16 }}
                  className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center"
                >
                  <div className="inline-block rounded-md border-2 border-rose-300 bg-rose-500/85 px-3 py-1 font-display text-2xl font-black uppercase tracking-[0.2em] text-white shadow-[0_6px_20px_-4px_oklch(0.45_0.2_25/0.8)]">
                    Wrong
                  </div>
                </motion.div>
              </div>

              <div className="mt-3 text-center font-display text-lg font-bold uppercase tracking-[0.15em] text-rose-100/95 drop-shadow-[0_2px_8px_oklch(0.4_0.2_25/0.5)]">
                {v.nickname}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

