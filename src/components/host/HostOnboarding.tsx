import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const KEY = "btd:host-onboarded:v1";

const STEPS = [
  {
    icon: "📺",
    title: "This is your TV screen",
    body: "Cast or mirror this page to the biggest display in the room. The room code and QR are made for a 10-foot read.",
  },
  {
    icon: "📱",
    title: "Players join with their phones",
    body: "They scan the QR or open the URL and type the 4-letter code. Phones are their buzzers, soundboards, and wager dials.",
  },
  {
    icon: "🎛",
    title: "Pick a category, hit go",
    body: "Each category is a 10-round arc with reveals, wildcards, a Lightning round, and a final wager.",
  },
  {
    icon: "🏆",
    title: "Roll the credits",
    body: "End-of-game spotlight, confetti, share cards on every phone. Welcome to Beat the Drop.",
  },
];

export function HostOnboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(KEY)) return;
    // Tiny delay so it doesn't fight the room-creation toast
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    window.localStorage.setItem(KEY, "1");
    setOpen(false);
  }

  function next() {
    if (step >= STEPS.length - 1) return dismiss();
    setStep((s) => s + 1);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-black/70 backdrop-blur-md p-6"
          onClick={dismiss}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-900 to-black p-8 text-white shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)]"
          >
            {/* Top gradient bar */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-rose-400 to-violet-500" />

            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.4em] text-amber-200/80">
              Host tour · {step + 1} of {STEPS.length}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mt-2 text-6xl">{STEPS[step].icon}</div>
                <h2 className="mt-4 font-display text-3xl font-black leading-tight">
                  {STEPS[step].title}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-white/75">
                  {STEPS[step].body}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-7 flex items-center justify-between gap-3">
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === step ? "w-8 bg-amber-300" : "w-2 bg-white/20"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={dismiss}
                  className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/60 hover:text-white"
                >
                  Skip
                </button>
                <button
                  onClick={next}
                  className="rounded-full bg-amber-300 px-5 py-2 text-xs font-black uppercase tracking-widest text-amber-950 hover:bg-amber-200 active:scale-[0.97] transition"
                >
                  {step >= STEPS.length - 1 ? "Let's go" : "Next"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
