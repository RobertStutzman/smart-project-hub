import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { joinRoom } from "@/lib/rooms.functions";
import {
  getOrCreateSessionId,
  loadPlayerSession,
  savePlayerSession,
} from "@/lib/player-session";

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

function JoinPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/join" });
  const joinFn = useServerFn(joinRoom);

  const existing = typeof window !== "undefined" ? loadPlayerSession() : null;
  const [code, setCode] = useState(
    (search.code ?? existing?.roomCode ?? "").toUpperCase().slice(0, 4),
  );
  const [nickname, setNickname] = useState(existing?.nickname ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.length !== 4 || !nickname.trim()) return;
    setSubmitting(true);
    try {
      const sessionId = getOrCreateSessionId();
      const res = await joinFn({
        data: { roomCode: code, nickname: nickname.trim(), sessionId },
      });
      savePlayerSession({ sessionId, roomCode: code, nickname: nickname.trim() });
      navigate({ to: "/play" });
      void res;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
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
        <div className="my-auto">
          <h1 className="text-4xl font-black tracking-tight">Join the game</h1>
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
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
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
                placeholder="Your name"
                className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-lg outline-none focus:border-foreground"
              />
            </div>
            {error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || code.length !== 4 || !nickname.trim()}
              className="rounded-full bg-foreground px-6 py-4 text-base font-semibold text-background disabled:opacity-40"
            >
              {submitting ? "Joining…" : "Join game"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
