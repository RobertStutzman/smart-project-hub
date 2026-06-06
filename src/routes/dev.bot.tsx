import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { joinRoom } from "@/lib/rooms.functions";
import { lockAnswer } from "@/lib/game.functions";
import { supabase } from "@/integrations/supabase/client";
import { newId } from "@/lib/player-session";

const search = z.object({
  code: z.string().length(4),
  name: z.string().min(1).max(20),
  mode: z.enum(["smart", "random", "wrong"]).optional(),
  delay: z.coerce.number().min(0).max(15000).optional(),
});

export const Route = createFileRoute("/dev/bot")({
  validateSearch: search,
  component: BotPage,
});

type State = "joining" | "lobby" | "question" | "locked" | "reveal" | "error";

function BotPage() {
  const { code, name, mode = "smart", delay = 800 } = Route.useSearch();
  const joinFn = useServerFn(joinRoom);
  const lockFn = useServerFn(lockAnswer);

  const [state, setState] = useState<State>("joining");
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastPick, setLastPick] = useState<number | null>(null);
  const sessionIdRef = useRef<string>("");
  const roomIdRef = useRef<string>("");
  const lastQRef = useRef<string>("");

  // Join on mount with a fresh in-memory session (independent per iframe).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const sid = newId();
        sessionIdRef.current = sid;
        const res = await joinFn({
          data: { roomCode: code, nickname: name, sessionId: sid },
        });
        if (cancelled) return;
        roomIdRef.current = res.roomId;
        setState("lobby");
      } catch (e) {
        setError((e as Error).message);
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, name, joinFn]);

  // Watch the room for question phase, auto-answer.
  useEffect(() => {
    if (!roomIdRef.current) return;
    const roomId = roomIdRef.current;

    async function react() {
      const { data: room } = await supabase
        .from("rooms")
        .select("phase, current_question_id, current_correct_index, current_answers, dropped_indexes")
        .eq("id", roomId)
        .maybeSingle();
      if (!room) return;

      if (room.phase === "question" && room.current_question_id && room.current_question_id !== lastQRef.current) {
        lastQRef.current = room.current_question_id;
        setState("question");
        setLastPick(null);

        const correct = room.current_correct_index ?? 0;
        const dropped = (room.dropped_indexes ?? []) as number[];
        let pick: number;
        if (mode === "smart") {
          pick = correct;
        } else if (mode === "wrong") {
          const wrongs = [0, 1, 2, 3].filter((i) => i !== correct && !dropped.includes(i));
          pick = wrongs[Math.floor(Math.random() * wrongs.length)] ?? correct;
        } else {
          const opts = [0, 1, 2, 3].filter((i) => !dropped.includes(i));
          pick = opts[Math.floor(Math.random() * opts.length)] ?? 0;
        }

        // Jitter the lock by ±300ms so all bots don't lock simultaneously.
        const wait = delay + Math.random() * 600 - 300;
        window.setTimeout(() => {
          lockFn({
            data: { roomCode: code, sessionId: sessionIdRef.current, answerIndex: pick },
          })
            .then(() => {
              setLastPick(pick);
              setState("locked");
            })
            .catch(() => setState("locked"));
        }, Math.max(50, wait));
      } else if (room.phase === "reveal") {
        setState("reveal");
      } else if (room.phase === "lobby") {
        setState("lobby");
        lastQRef.current = "";
      }
    }

    void react();
    const channel = supabase
      .channel(`devbot-${roomId}-${sessionIdRef.current}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        () => void react(),
      )
      .subscribe();

    // Pull current score periodically.
    const scoreInterval = setInterval(async () => {
      const { data } = await supabase
        .from("players")
        .select("score")
        .eq("room_id", roomId)
        .eq("session_id", sessionIdRef.current)
        .maybeSingle();
      if (data) setScore(data.score);
    }, 2000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(scoreInterval);
    };
  }, [state === "joining" ? "joining" : "ready", mode, delay, code, lockFn]); // eslint-disable-line react-hooks/exhaustive-deps

  const dot =
    state === "error"
      ? "bg-red-500"
      : state === "joining"
        ? "bg-yellow-500 animate-pulse"
        : state === "question"
          ? "bg-blue-500 animate-pulse"
          : state === "locked"
            ? "bg-purple-500"
            : state === "reveal"
              ? "bg-emerald-500"
              : "bg-zinc-400";

  return (
    <div className="flex h-screen flex-col bg-zinc-950 p-2 font-mono text-xs text-zinc-100">
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        <span className="font-bold truncate">{name}</span>
        <span className="ml-auto text-zinc-400">{score}pt</span>
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
        {state} · {mode}
      </div>
      {lastPick !== null && (
        <div className="mt-1 text-[10px] text-zinc-400">picked #{lastPick}</div>
      )}
      {error && <div className="mt-1 text-[10px] text-red-400">{error}</div>}
    </div>
  );
}
