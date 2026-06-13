import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { play } from "@/lib/sound-engine";
import { ASYM_LABELS, type AsymFormat } from "@/lib/asymmetry";

type Player = {
  id: string;
  session_id: string;
  nickname: string;
  avatar_url: string | null;
  score: number;
  current_round_score: number | null;
};

type Submission = {
  text?: string;
  choice?: "agree" | "disagree";
  statements?: string[];
  lieIndex?: number;
};

type Props = {
  format: AsymFormat;
  prompt: string;
  players: Player[]; // non-audience
  sourceSessionId: string | null;
  submissions: Record<string, Submission>;
  votes: Record<string, string | number>;
  endsAt: string | null;
};

function useCountdown(endsAt: string | null): number {
  const [n, setN] = useState(() => calc(endsAt));
  useEffect(() => {
    setN(calc(endsAt));
    if (!endsAt) return;
    const id = window.setInterval(() => setN(calc(endsAt)), 250);
    return () => window.clearInterval(id);
  }, [endsAt]);
  return n;
}
function calc(endsAt: string | null): number {
  if (!endsAt) return 0;
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 1000));
}

export function AsymSubmitStage({ format, prompt, players, sourceSessionId, submissions, endsAt }: Props) {
  const secs = useCountdown(endsAt);
  const total = players.length;
  const submittedCount =
    format === "two_truths"
      ? sourceSessionId && submissions[sourceSessionId]?.statements
        ? 1
        : 0
      : players.filter((p) => !!submissions[p.session_id]).length;
  const targetCount = format === "two_truths" ? 1 : total;
  const sourceName =
    players.find((p) => p.session_id === sourceSessionId)?.nickname ?? "—";

  return (
    <div className="relative grid h-full place-items-center overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.35_0.22_310/0.45),oklch(0.05_0.02_270)_70%)]" />
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_50%,oklch(0.85_0.20_320/0.18),transparent_60%)]" />
      <div className="relative w-full max-w-5xl px-12 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.6em] text-fuchsia-300/90">
          {ASYM_LABELS[format]} · {format === "two_truths" ? `${sourceName} is writing…` : "Type your answer on your phone"}
        </div>
        <div className="mt-6 rounded-3xl border-2 border-fuchsia-300/30 bg-white/[0.04] px-10 py-10 backdrop-blur">
          <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-fuchsia-300/80">
            The Prompt
          </div>
          <div className="mt-4 font-display text-4xl font-black leading-tight text-white">
            {prompt}
          </div>
        </div>
        <div className="mt-10 flex items-center justify-center gap-8">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-fuchsia-200/80">Submitted</div>
            <div className="mt-1 font-mono text-5xl font-black text-fuchsia-100">
              {submittedCount}<span className="text-fuchsia-300/60">/{targetCount}</span>
            </div>
          </div>
          <div className="h-12 w-px bg-white/20" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-fuchsia-200/80">Time left</div>
            <div className="mt-1 font-mono text-5xl font-black text-fuchsia-100">{secs}s</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AsymVoteStage({ format, prompt, players, sourceSessionId, submissions, votes, endsAt }: Props) {
  const secs = useCountdown(endsAt);
  const totalVoters = format === "two_truths" ? players.length - 1 : players.length;
  const voteCount = Object.keys(votes ?? {}).length;
  const source = players.find((p) => p.session_id === sourceSessionId);

  const items =
    format === "two_truths"
      ? (source && submissions[source.session_id]?.statements
          ? submissions[source.session_id].statements!.map((text, idx) => ({ key: String(idx), label: `${idx + 1}`, text }))
          : [])
      : Object.entries(submissions)
          .filter(([, s]) => !!s.text)
          .map(([sid, s], i) => ({ key: sid, label: String.fromCharCode(65 + i), text: s.text! }));

  return (
    <div className="relative grid h-full place-items-start overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.35_0.22_310/0.4),oklch(0.05_0.02_270)_70%)]" />
      <div className="relative mx-auto mt-6 w-full max-w-6xl px-8">
        <div className="text-center text-[11px] font-bold uppercase tracking-[0.6em] text-fuchsia-300/90">
          Vote on your phone · {secs}s · {voteCount}/{totalVoters} cast
        </div>
        <div className="mx-auto mt-3 max-w-3xl rounded-2xl border border-fuchsia-300/20 bg-white/[0.04] px-6 py-3 text-center text-lg font-bold text-white">
          {prompt}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((it) => (
            <div
              key={it.key}
              className="rounded-2xl border-2 border-fuchsia-300/30 bg-fuchsia-500/10 p-5 backdrop-blur"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-fuchsia-300/80">
                {format === "two_truths" ? `Statement ${it.label}` : `Answer ${it.label}`}
              </div>
              <div className="mt-2 text-2xl font-bold leading-snug text-white">
                {it.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type RevealProps = Props & {
  scoringDeltas: Record<string, number>; // session_id → +pts
};

export function AsymRevealStage({ format, players, sourceSessionId, submissions, votes, scoringDeltas }: RevealProps) {
  const [showWinner, setShowWinner] = useState(false);
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    play("drop");
    const t = window.setTimeout(() => setShowWinner(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  // Compute winner narrative per format
  const source = players.find((p) => p.session_id === sourceSessionId) ?? null;
  let headline = "Results";
  let detail: string | null = null;

  if (format === "crowd_pleaser" || format === "finish_sentence") {
    // tally votes per submission's session_id
    const tally = new Map<string, number>();
    Object.values(votes ?? {}).forEach((v) => {
      const sid = String(v);
      tally.set(sid, (tally.get(sid) ?? 0) + 1);
    });
    let winnerSid: string | null = null;
    let maxV = -1;
    tally.forEach((v, sid) => {
      if (v > maxV) {
        maxV = v;
        winnerSid = sid;
      }
    });
    const winner = players.find((p) => p.session_id === winnerSid);
    headline = winner ? `🏆 ${winner.nickname} wins the room` : "No winner";
    detail = winner && submissions[winner.session_id]?.text ? `"${submissions[winner.session_id].text}"` : null;
  } else if (format === "two_truths") {
    const lieIdx = source && submissions[source.session_id]?.lieIndex;
    const lieStatement =
      source && submissions[source.session_id]?.statements && typeof lieIdx === "number"
        ? submissions[source.session_id].statements![lieIdx]
        : null;
    headline = source ? `${source.nickname}'s lie:` : "Results";
    detail = lieStatement ?? null;
  } else if (format === "hot_take") {
    const counts = { agree: 0, disagree: 0 };
    Object.values(submissions ?? {}).forEach((s) => {
      if (s.choice === "agree") counts.agree++;
      else if (s.choice === "disagree") counts.disagree++;
    });
    const minority =
      counts.agree === counts.disagree
        ? "Split decision — everyone scores."
        : counts.agree < counts.disagree
          ? `Minority: AGREE (${counts.agree})`
          : `Minority: DISAGREE (${counts.disagree})`;
    headline = "Hot Take results";
    detail = minority;
  }

  return (
    <div className="relative grid h-full place-items-center overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.40_0.22_310/0.45),oklch(0.05_0.02_270)_70%)]" />
      <div className="relative w-full max-w-5xl px-12 text-center">
        <AnimatePresence>
          {showWinner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="text-xs font-bold uppercase tracking-[0.5em] text-fuchsia-300/90">
                {ASYM_LABELS[format]}
              </div>
              <h2
                className="mt-4 font-display text-6xl font-black uppercase tracking-tight text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, oklch(0.97 0.18 320) 0%, oklch(0.65 0.25 310) 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 10px 50px oklch(0.85 0.22 320 / 0.7))",
                }}
              >
                {headline}
              </h2>
              {detail && (
                <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-fuchsia-300/30 bg-white/[0.04] px-8 py-5 text-2xl font-bold text-fuchsia-50">
                  {detail}
                </div>
              )}
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                {players.map((p) => {
                  const delta = scoringDeltas[p.session_id] ?? 0;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-2 backdrop-blur ${
                        delta > 0
                          ? "border-emerald-400/70 bg-emerald-500/15"
                          : "border-white/20 bg-white/5"
                      }`}
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-amber-400 text-xs font-black text-amber-950">
                          {p.nickname.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="text-sm font-bold">{p.nickname}</div>
                      <div
                        className={`font-mono text-base font-black ${
                          delta > 0 ? "text-emerald-300" : "text-white/40"
                        }`}
                      >
                        {delta > 0 ? `+${delta}` : "+0"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
