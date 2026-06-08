import { useEffect, useState } from "react";

type WildcardType =
  | "lightning"
  | "double_or_nothing"
  | "first_blood"
  | "underdog"
  | "saboteur"
  | "glitch"
  | "roast";

interface Config {
  icon: string;
  label: string;
  rule: string;
  /** Tailwind color tokens for banner bg/border/text */
  bg: string;
  border: string;
  text: string;
  /** Glow color (oklch) used for entrance flash + shadow */
  glow: string;
}

const CONFIGS: Record<WildcardType, Config> = {
  lightning: {
    icon: "⚡",
    label: "Lightning",
    rule: "2× points · 8 seconds",
    bg: "bg-amber-400/95",
    border: "border-amber-200",
    text: "text-amber-950",
    glow: "oklch(0.85 0.18 90)",
  },
  double_or_nothing: {
    icon: "💀",
    label: "Double or Nothing",
    rule: "Right doubles · Wrong −150",
    bg: "bg-rose-600/95",
    border: "border-rose-300",
    text: "text-rose-50",
    glow: "oklch(0.65 0.25 25)",
  },
  first_blood: {
    icon: "🩸",
    label: "First Blood",
    rule: "Only the fastest correct scores",
    bg: "bg-red-700/95",
    border: "border-red-300",
    text: "text-red-50",
    glow: "oklch(0.55 0.22 20)",
  },
  underdog: {
    icon: "🐢",
    label: "Underdog Boost",
    rule: "Last place plays for double",
    bg: "bg-emerald-600/95",
    border: "border-emerald-200",
    text: "text-emerald-50",
    glow: "oklch(0.7 0.18 155)",
  },
  saboteur: {
    icon: "🕵",
    label: "Saboteur Round",
    rule: "Trust no one",
    bg: "bg-violet-600/95",
    border: "border-violet-200",
    text: "text-violet-50",
    glow: "oklch(0.6 0.2 295)",
  },
  glitch: {
    icon: "⚡",
    label: "Glitch Round",
    rule: "Things are about to get weird",
    bg: "bg-fuchsia-600/95",
    border: "border-fuchsia-200",
    text: "text-fuchsia-50",
    glow: "oklch(0.65 0.25 320)",
  },
  roast: {
    icon: "🔥",
    label: "Roast Vote",
    rule: "Pick your victim",
    bg: "bg-orange-600/95",
    border: "border-orange-200",
    text: "text-orange-50",
    glow: "oklch(0.7 0.2 50)",
  },
};

export function WildcardBanner({
  wildcard,
  triggerKey,
}: {
  wildcard: string | null;
  /** Changes whenever a new wildcard moment starts (e.g. question_started_at) — drives entrance flash */
  triggerKey: string | number | null;
}) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!wildcard || !triggerKey) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1200);
    return () => clearTimeout(t);
  }, [wildcard, triggerKey]);

  if (!wildcard || !(wildcard in CONFIGS)) return null;
  const cfg = CONFIGS[wildcard as WildcardType];

  return (
    <>
      {/* Entrance flash — radial sting from center */}
      {flash && (
        <div
          key={`flash-${triggerKey}`}
          className="pointer-events-none absolute inset-0 z-20 animate-fade-out"
          style={{
            background: `radial-gradient(ellipse at center, ${cfg.glow.replace(")", " / 0.35)")} 0%, transparent 60%)`,
            animationDuration: "1.2s",
          }}
        />
      )}

      {/* The banner itself */}
      <div
        key={`banner-${triggerKey}`}
        className={`pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 animate-scale-in`}
      >
        <div
          className={`flex items-center gap-3 rounded-full border-2 ${cfg.border} ${cfg.bg} ${cfg.text} px-5 py-2 shadow-2xl`}
          style={{
            boxShadow: `0 0 40px ${cfg.glow.replace(")", " / 0.55)")}, 0 8px 24px rgba(0,0,0,0.4)`,
            animation: "wildcard-pulse 2.4s ease-in-out infinite",
          }}
        >
          <span className="text-xl leading-none">{cfg.icon}</span>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[11px] font-black uppercase tracking-[0.28em]">
              Wildcard · {cfg.label}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-85">
              {cfg.rule}
            </span>
          </div>
        </div>
      </div>

      {/* Keyframes — scoped via styled tag; only mounted while banner is visible */}
      <style>{`
        @keyframes wildcard-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
      `}</style>
    </>
  );
}

/** Compact player-phone variant — small pill, no entrance flash. */
export function WildcardPill({ wildcard }: { wildcard: string | null }) {
  if (!wildcard || !(wildcard in CONFIGS)) return null;
  const cfg = CONFIGS[wildcard as WildcardType];
  return (
    <div
      className={`flex items-center justify-center gap-2 rounded-full border-2 ${cfg.border} ${cfg.bg} ${cfg.text} px-3 py-1.5 text-center animate-scale-in`}
      style={{
        boxShadow: `0 0 20px ${cfg.glow.replace(")", " / 0.45)")}`,
      }}
    >
      <span className="text-sm leading-none">{cfg.icon}</span>
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[9px] font-black uppercase tracking-[0.25em]">
          {cfg.label}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.15em] opacity-85">
          {cfg.rule}
        </span>
      </div>
    </div>
  );
}
