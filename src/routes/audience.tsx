import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { joinRoom, setAudienceMode } from "@/lib/rooms.functions";
import {
  getOrCreateSessionId,
  loadPlayerSession,
  savePlayerSession,
} from "@/lib/player-session";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  code: z.string().optional(),
});

export const Route = createFileRoute("/audience")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Watch as audience — Beat the Drop Trivia" },
      { name: "description", content: "Cheer, vote, and play along without taking a player slot." },
    ],
  }),
  component: AudiencePage,
});

const REACTIONS = [
  { sfx: "applause", label: "Applause", emoji: "👏" },
  { sfx: "boo", label: "Boo", emoji: "💩" },
  { sfx: "laugh", label: "Laugh", emoji: "😂" },
  { sfx: "whoosh", label: "Whoosh", emoji: "✨" },
] as const;

function AudiencePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/audience" });
  const joinFn = useServerFn(joinRoom);
  const setAudienceFn = useServerFn(setAudienceMode);

  const existing = typeof window !== "undefined" ? loadPlayerSession() : null;
  const sanitizeCode = (v: string) => v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);

  const [code, setCode] = useState(sanitizeCode(search.code ?? existing?.roomCode ?? ""));
  const [nickname, setNickname] = useState(existing?.nickname ?? "");
  const [joined, setJoined] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist tally
  const [audienceCount, setAudienceCount] = useState<number>(0);

  useEffect(() => {
    if (!joined) return;
    let cancel = false;
    async function load() {
      const { data: room } = await supabase.from("rooms").select("id").eq("room_code", code).maybeSingle();
      if (!room || cancel) return;
      const { count } = await supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("room_id", room.id)
        .eq("is_audience", true);
      if (!cancel) setAudienceCount(count ?? 0);
    }
    void load();
    const id = setInterval(load, 4000);
    return () => {
      cancel = true;
      clearInterval(id);
    };
  }, [joined, code]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 4 || nickname.trim().length < 1) return;
    setSubmitting(true);
    setError(null);
    try {
      const sid = getOrCreateSessionId();
      await joinFn({ data: { roomCode: code, nickname: nickname.trim(), sessionId: sid } });
      await setAudienceFn({ data: { roomCode: code, sessionId: sid, isAudience: true } });
      savePlayerSession({ sessionId: sid, roomCode: code, nickname: nickname.trim() });
      setJoined(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReaction(sfx: string) {
    try {
      const channel = supabase.channel(`sfx-${code}`);
      await channel.subscribe();
      await channel.send({ type: "broadcast", event: "sfx", payload: { sfx } });
      void supabase.removeChannel(channel);
    } catch {}
  }

  if (!joined) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
          <button
            onClick={() => navigate({ to: "/" })}
            className="self-start text-sm text-muted-foreground hover:text-foreground"
          >
            ← Home
          </button>
          <div className="my-auto rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.4em] text-accent">Audience</div>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Watch and cheer</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You won't take a player slot. Send reactions, see live scores, and vote on bonus polls.
            </p>
            <form onSubmit={handleJoin} className="mt-8 flex flex-col gap-5">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Room code
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(sanitizeCode(e.target.value))}
                  placeholder="ABCD"
                  className="w-full rounded-2xl border border-border bg-card px-5 py-5 text-center font-mono text-4xl font-black tracking-[0.4em] outline-none focus:border-foreground"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Your name
                </label>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                  placeholder="Audience name"
                  className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-lg outline-none focus:border-foreground"
                />
              </div>
              {error && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting || code.length !== 4 || nickname.trim().length < 1}
                className="rounded-full bg-foreground px-6 py-4 text-base font-semibold text-background disabled:opacity-50"
              >
                {submitting ? "Joining…" : "Join as audience"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-[0.4em] text-accent">Audience</div>
          <div className="mt-1 font-mono text-3xl font-black tracking-[0.3em]">{code}</div>
          <div className="mt-2 text-sm text-muted-foreground">
            {audienceCount} in the audience
          </div>
        </div>

        <div className="my-auto rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-center text-lg font-bold">Reactions</h2>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Tap to play a sound on the TV
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {REACTIONS.map((r) => (
              <button
                key={r.sfx}
                onClick={() => sendReaction(r.sfx)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-background py-6 transition active:scale-95"
              >
                <span className="text-4xl">{r.emoji}</span>
                <span className="text-xs font-semibold uppercase tracking-wider">{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          You can rejoin as a player by visiting <span className="font-mono">/join</span>.
        </div>
      </div>
    </main>
  );
}
