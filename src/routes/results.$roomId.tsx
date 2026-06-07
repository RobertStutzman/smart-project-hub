import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/results/$roomId")({
  head: () => ({
    meta: [
      { title: "Game results — Beat the Drop Trivia" },
      { name: "description", content: "Final standings from this trivia night." },
      { property: "og:title", content: "Beat the Drop — Final standings" },
      { property: "og:description", content: "Who came out on top?" },
    ],
  }),
  component: ResultsPage,
});

type Row = {
  id: string;
  nickname: string;
  score: number;
  avatar_url: string | null;
  best_streak: number;
  correct_count: number;
  is_audience: boolean;
};

function ResultsPage() {
  const { roomId } = Route.useParams();
  const [players, setPlayers] = useState<Row[]>([]);
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: room } = await supabase
        .from("rooms")
        .select("room_code")
        .eq("id", roomId)
        .maybeSingle();
      const { data: rows } = await supabase
        .from("players")
        .select("id, nickname, score, avatar_url, best_streak, correct_count, is_audience")
        .eq("room_id", roomId)
        .order("score", { ascending: false });
      if (cancelled) return;
      setCode(room?.room_code ?? "");
      setPlayers((rows ?? []) as Row[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const ranked = players.filter((p) => !p.is_audience);
  const winner = ranked[0];

  return (
    <main className="min-h-screen bg-[oklch(0.06_0.02_270)] text-white">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="text-center text-xs font-bold uppercase tracking-[0.5em] text-amber-300/80">
          Beat the Drop · Final standings
        </div>
        {code && (
          <div className="mt-1 text-center font-mono text-sm text-white/40">Room {code}</div>
        )}

        {loading ? (
          <div className="mt-20 text-center text-white/50">Loading…</div>
        ) : ranked.length === 0 ? (
          <div className="mt-20 text-center text-white/50">No results yet.</div>
        ) : (
          <>
            {winner && (
              <div className="mt-10 flex flex-col items-center gap-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">
                  Winner
                </div>
                {winner.avatar_url ? (
                  <img
                    src={winner.avatar_url}
                    alt={winner.nickname}
                    className="h-32 w-32 rounded-full border-2 border-amber-300/70 object-cover shadow-[0_0_80px_oklch(0.85_0.18_85/0.6)]"
                  />
                ) : (
                  <div className="grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 font-display text-5xl font-black text-amber-950 shadow-[0_0_80px_oklch(0.85_0.18_85/0.6)]">
                    {winner.nickname.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="font-display text-4xl font-black">{winner.nickname}</div>
                <div className="font-mono text-2xl text-amber-300">{winner.score.toLocaleString()} pts</div>
              </div>
            )}

            <div className="mt-10 overflow-hidden rounded-2xl border border-white/10">
              {ranked.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-4 px-4 py-3 ${
                    i === 0 ? "bg-amber-300/10" : i % 2 === 0 ? "bg-white/[0.02]" : ""
                  }`}
                >
                  <div className="w-6 text-right font-mono text-sm text-white/40">#{i + 1}</div>
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xs font-bold">
                      {p.nickname.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 font-semibold">{p.nickname}</div>
                  <div className="text-xs text-white/40">{p.correct_count} ✓ · {p.best_streak}🔥</div>
                  <div className="w-20 text-right font-mono font-bold text-amber-300">
                    {p.score.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-10 text-center text-xs text-white/40">
          Play again at <span className="font-mono text-white/70">beatthedrop</span>
        </div>
      </div>
    </main>
  );
}
