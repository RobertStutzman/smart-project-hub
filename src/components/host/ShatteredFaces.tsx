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
    play("wrong");
    const id = window.setTimeout(() => {
      setShown((cur) => cur.filter((v) => v.ts !== now));
    }, 2200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  if (shown.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center">
      <svg width="0" height="0" className="absolute">
        <filter id="cracked-glass">
          <feTurbulence baseFrequency="0.9" numOctaves="2" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="6" />
        </filter>
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-6">
        <AnimatePresence>
          {shown.map((v) => (
            <motion.div
              key={`${v.id}-${v.ts}`}
              initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: [-8, 4, -2, 0] }}
              exit={{ scale: 1.4, opacity: 0, rotate: 12 }}
              transition={{ duration: 0.5 }}
              className="relative"
            >
              <div className="relative h-40 w-40 overflow-hidden rounded-2xl border-4 border-rose-500 bg-rose-950/40 shadow-[0_0_60px_oklch(0.6_0.25_25)]">
                {v.avatar_url ? (
                  <img
                    src={v.avatar_url}
                    alt={v.nickname}
                    className="h-full w-full object-cover"
                    style={{ filter: "url(#cracked-glass) saturate(0.7) contrast(1.2)" }}
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center font-display text-5xl font-black text-rose-100">
                    {v.nickname.slice(0, 1).toUpperCase()}
                  </div>
                )}
                {/* crack overlay */}
                <svg
                  viewBox="0 0 200 200"
                  className="pointer-events-none absolute inset-0 h-full w-full opacity-90 mix-blend-screen"
                >
                  <g stroke="white" strokeWidth="1.5" fill="none">
                    <path d="M100 0 L96 60 L70 90 L40 110 L20 200" />
                    <path d="M100 0 L110 50 L140 80 L170 120 L200 160" />
                    <path d="M96 60 L130 70 L160 50" />
                    <path d="M70 90 L60 130 L80 170" />
                    <path d="M140 80 L120 120 L150 160" />
                    <path d="M110 50 L90 90 L110 130 L100 200" />
                  </g>
                </svg>
              </div>
              <div className="mt-2 text-center font-display text-lg font-black uppercase tracking-widest text-rose-200">
                {v.nickname}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
