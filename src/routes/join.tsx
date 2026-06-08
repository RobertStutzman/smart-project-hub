import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { joinRoom, updatePlayerAvatar } from "@/lib/rooms.functions";
import {
  getOrCreateSessionId,
  loadPlayerSession,
  savePlayerSession,
} from "@/lib/player-session";
import { supabase } from "@/integrations/supabase/client";
import { SelfieCapture } from "@/components/SelfieCapture";
import { LegalFooter } from "@/components/LegalFooter";
import { playFunnySoundById } from "@/lib/funny-sounds";
import { useLobbyChatter } from "@/hooks/use-lobby-chatter";
import { Link } from "@tanstack/react-router";

const searchSchema = z.object({
  code: z.string().optional(),
});

export const Route = createFileRoute("/join")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Join a game — Beat the Drop Trivia" },
      { name: "description", content: "Enter the 4-letter room code from the host's screen." },
      { property: "og:title", content: "Join — Beat the Drop Trivia" },
      { property: "og:description", content: "Type the code, pick a nickname, play." },
    ],
  }),
  component: JoinPage,
});

type Step = "form" | "consent" | "selfie";

function JoinPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/join" });
  const joinFn = useServerFn(joinRoom);
  const updateAvatarFn = useServerFn(updatePlayerAvatar);

  const existing = typeof window !== "undefined" ? loadPlayerSession() : null;
  const sanitizeCode = (v: string) =>
    v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
  const [code, setCode] = useState(
    sanitizeCode(search.code ?? existing?.roomCode ?? ""),
  );
  const [nickname, setNickname] = useState(existing?.nickname ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [sessionId, setSessionId] = useState<string>("");
  const [flash, setFlash] = useState(false);

  useLobbyChatter();

  const trimmedNickname = nickname.trim();
  const codeOk = code.length === 4;
  const nickOk = trimmedNickname.length >= 1;
  const canSubmit = codeOk && nickOk && !submitting;

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1500);
      return;
    }
    setSubmitting(true);
    try {
      const sid = getOrCreateSessionId();
      const result = await joinFn({
        data: { roomCode: code, nickname: trimmedNickname, sessionId: sid },
      });
      savePlayerSession({ sessionId: sid, roomCode: code, nickname: trimmedNickname });
      setSessionId(sid);
      // Preview the funny sound this player is locked into for the game.
      playFunnySoundById((result as { funnySoundId?: string | null }).funnySoundId, sid);
      setStep("consent");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }


  async function handleSelfie(blob: Blob) {
    try {
      const path = `${code}/${sessionId}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateAvatarFn({
        data: { roomCode: code, sessionId, avatarUrl: data.publicUrl },
      });
    } catch (e) {
      console.error(e);
    } finally {
      navigate({ to: "/play" });
    }
  }

  return (
    <main
      className="relative min-h-screen text-amber-50"
      style={{
        background:
          "radial-gradient(ellipse 90% 60% at 50% 0%, oklch(0.22 0.04 270 / 0.95), oklch(0.06 0.02 270) 70%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 110%, oklch(0.55 0.18 60 / 0.25), transparent 60%)",
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <button
          onClick={() => navigate({ to: "/" })}
          className="self-start text-sm text-amber-200/70 hover:text-amber-100"
        >
          ← Home
        </button>

        {step === "form" ? (
          <div className="my-auto rounded-3xl border border-amber-300/20 bg-white/5 p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur">
            <h1 className="font-display text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                Join the game
              </span>
            </h1>
            <p className="mt-2 text-sm text-amber-100/70">
              Enter the 4-letter code shown on the TV.
            </p>

            <form onSubmit={handleJoin} className="mt-8 flex flex-col gap-5">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-amber-200/70">
                  Room code
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(sanitizeCode(e.target.value))}
                  onInput={(e) =>
                    setCode(sanitizeCode((e.target as HTMLInputElement).value))
                  }
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="ABCD"
                  className="w-full rounded-2xl border border-amber-300/30 bg-black/30 px-5 py-5 text-center font-mono text-4xl font-black tracking-[0.4em] text-amber-100 placeholder:text-amber-200/30 outline-none focus:border-amber-300"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-amber-200/70">
                  Nickname
                </label>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                  onInput={(e) =>
                    setNickname((e.target as HTMLInputElement).value.slice(0, 20))
                  }
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Your name"
                  className="w-full rounded-2xl border border-amber-300/30 bg-black/30 px-5 py-4 text-lg text-amber-50 placeholder:text-amber-200/30 outline-none focus:border-amber-300"
                />
              </div>

              <div
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-mono transition ${
                  flash && !canSubmit
                    ? "animate-pulse border-rose-400/60 bg-rose-500/10"
                    : "border-amber-300/20 bg-white/5"
                }`}
              >
                <span className={codeOk ? "text-emerald-300" : "text-amber-200/60"}>
                  Code: {code.length}/4 {codeOk ? "✓" : ""}
                </span>
                <span className={nickOk ? "text-emerald-300" : "text-amber-200/60"}>
                  Nickname: {trimmedNickname.length}/20 {nickOk ? "✓" : ""}
                </span>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className={`rounded-full px-6 py-4 text-base font-bold uppercase tracking-wider transition ${
                  canSubmit
                    ? "bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 shadow-[0_0_40px_oklch(0.85_0.18_85/0.35)] hover:brightness-110"
                    : "bg-white/10 text-amber-100/40"
                }`}
              >
                {submitting ? "Joining…" : canSubmit ? "Next" : "Fill both fields"}
              </button>

            </form>
            <div className="mt-6 text-center text-xs text-amber-100/60">
              All player slots full? <button
                type="button"
                onClick={() => navigate({ to: "/audience", search: { code: code || undefined } })}
                className="font-semibold text-amber-200 underline underline-offset-2 hover:text-amber-100"
              >Watch as audience</button>
            </div>
          </div>
        ) : (
          <div className="my-auto">
            <h1 className="font-display text-3xl font-black tracking-tight">
              <span className="bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                Take a selfie
              </span>
            </h1>
            <p className="mt-2 text-sm text-amber-100/70">
              Your face shows on the TV next to your score.
            </p>
            <div className="mt-8">
              <SelfieCapture
                onCapture={(b) => void handleSelfie(b)}
                onSkip={() => navigate({ to: "/play" })}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
