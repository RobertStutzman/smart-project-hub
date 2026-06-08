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
import { playFunnySoundById } from "@/lib/funny-sounds";
import { useLobbyChatter } from "@/hooks/use-lobby-chatter";

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

type Step = "form" | "selfie";

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
      setStep("selfie");
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
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <button
          onClick={() => navigate({ to: "/" })}
          className="self-start text-sm text-muted-foreground hover:text-foreground"
        >
          ← Home
        </button>

        {step === "form" ? (
          <div className="my-auto rounded-3xl border border-border bg-card p-6 shadow-sm">
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">Join the game</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter the 4-letter code shown on the TV.
            </p>

            <form onSubmit={handleJoin} className="mt-8 flex flex-col gap-5">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted-foreground">
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
                  className="w-full rounded-2xl border border-border bg-card px-5 py-5 text-center font-mono text-4xl font-black tracking-[0.4em] outline-none focus:border-foreground"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted-foreground">
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
                  className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-lg outline-none focus:border-foreground"
                />
              </div>

              <div
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-mono transition ${
                  flash && !canSubmit
                    ? "animate-pulse border-destructive bg-destructive/10"
                    : "border-border bg-card/40"
                }`}
              >
                <span className={codeOk ? "text-emerald-500" : "text-muted-foreground"}>
                  Code: {code.length}/4 {codeOk ? "✓" : ""}
                </span>
                <span className={nickOk ? "text-emerald-500" : "text-muted-foreground"}>
                  Nickname: {trimmedNickname.length}/20 {nickOk ? "✓" : ""}
                </span>
              </div>

              {error && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className={`rounded-full px-6 py-4 text-base font-semibold transition ${
                  canSubmit
                    ? "bg-foreground text-background"
                    : "bg-foreground/40 text-background"
                }`}
              >
                {submitting ? "Joining…" : canSubmit ? "Next" : "Fill both fields"}
              </button>

            </form>
            <div className="mt-6 text-center text-xs text-muted-foreground">
              All player slots full? <button
                type="button"
                onClick={() => navigate({ to: "/audience", search: { code: code || undefined } })}
                className="font-semibold underline underline-offset-2 hover:text-foreground"
              >Watch as audience</button>
            </div>
          </div>
        ) : (
          <div className="my-auto">
            <h1 className="text-3xl font-black tracking-tight">Take a selfie</h1>
            <p className="mt-2 text-sm text-muted-foreground">
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
