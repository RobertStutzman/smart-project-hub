import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { joinRoom } from "@/lib/rooms.functions";
import { lockAnswer } from "@/lib/game.functions";
import { supabase } from "@/integrations/supabase/client";
import { newId } from "@/lib/player-session";
import { QAPanel } from "@/components/dev/QAPanel";
import { RunnerPanel } from "@/components/dev/RunnerPanel";

export const Route = createFileRoute("/dev")({
  head: () => ({
    meta: [{ title: "Dev playground — Beat the Drop" }],
  }),
  component: DevPage,
});

const NAMES = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot",
  "Golf", "Hotel", "India", "Juliet", "Kilo", "Lima",
  "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo",
  "Sierra", "Tango",
];

type Mode = "smart" | "random" | "wrong";

type BotState = "joining" | "lobby" | "thinking" | "locked" | "reveal" | "error";

type Bot = {
  key: string;
  name: string;
  sessionId: string;
  state: BotState;
  pick: number | null;
  score: number;
  error?: string;
};

function DevPage() {
  const joinFn = useServerFn(joinRoom);
  const lockFn = useServerFn(lockAnswer);

  const [roomCode, setRoomCode] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [roomPhase, setRoomPhase] = useState<string>("");
  const [count, setCount] = useState(4);
  const [mode, setMode] = useState<Mode>("smart");
  const [delay, setDelay] = useState(1200);
  const [bots, setBots] = useState<Bot[]>([]);
  const botsRef = useRef<Bot[]>([]);
  const lastQRef = useRef<string>("");
  const modeRef = useRef<Mode>(mode);
  const delayRef = useRef<number>(delay);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const newRoom = useCallback(() => {
    setBots([]);
    lastQRef.current = "";
    setRoomCode("");
    setRoomId("");
    iframeRef.current?.contentWindow?.postMessage({ type: "parent:new-room" }, "*");
  }, []);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { delayRef.current = delay; }, [delay]);
  useEffect(() => { botsRef.current = bots; }, [bots]);

  const updateBot = useCallback((key: string, patch: Partial<Bot>) => {
    setBots((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  }, []);

  // Receive room code from host iframe
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const data = e.data as { type?: string; code?: string; id?: string } | null;
      if (data?.type === "host:room" && data.code) {
        setRoomCode(data.code);
        if (data.id) setRoomId(data.id);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Spawn a single bot (join + add to list)
  const spawnBot = useCallback(
    async (index: number) => {
      if (!roomCode) return;
      const name = `${NAMES[index % NAMES.length]}${index >= NAMES.length ? Math.floor(index / NAMES.length) + 1 : ""}`;
      const sessionId = newId();
      const key = `${sessionId}`;
      const bot: Bot = { key, name, sessionId, state: "joining", pick: null, score: 0 };
      setBots((prev) => [...prev, bot]);
      try {
        await joinFn({ data: { roomCode, nickname: name, sessionId } });
        updateBot(key, { state: "lobby" });
      } catch (e) {
        updateBot(key, { state: "error", error: (e as Error).message });
      }
    },
    [roomCode, joinFn, updateBot],
  );

  // Spawn N bots
  const spawnAll = useCallback(async (n?: number) => {
    if (!roomCode) return;
    const target = typeof n === "number" ? n : count;
    setBots([]);
    lastQRef.current = "";
    for (let i = 0; i < target; i++) {
      await spawnBot(i);
    }
  }, [roomCode, count, spawnBot]);

  const addOne = useCallback(() => {
    void spawnBot(botsRef.current.length);
  }, [spawnBot]);

  const stopAll = useCallback(() => {
    setBots([]);
    lastQRef.current = "";
  }, []);

  // Watch room phase and drive bot answers
  useEffect(() => {
    if (!roomId || bots.length === 0) return;

    async function tick() {
      const { data: room } = await supabase
        .from("rooms")
        .select("phase, current_question_id, current_correct_index, dropped_indexes")
        .eq("id", roomId)
        .maybeSingle();
      if (!room) return;
      setRoomPhase(room.phase ?? "");

      if (
        room.phase === "question" &&
        room.current_question_id &&
        room.current_question_id !== lastQRef.current
      ) {
        lastQRef.current = room.current_question_id;
        const correct = room.current_correct_index ?? 0;
        const dropped = (room.dropped_indexes ?? []) as number[];
        const currentMode = modeRef.current;
        const currentDelay = delayRef.current;

        for (const bot of botsRef.current) {
          if (bot.state === "error") continue;
          updateBot(bot.key, { state: "thinking", pick: null });

          let pick: number;
          if (currentMode === "smart") {
            pick = correct;
          } else if (currentMode === "wrong") {
            const wrongs = [0, 1, 2, 3].filter((i) => i !== correct && !dropped.includes(i));
            pick = wrongs[Math.floor(Math.random() * wrongs.length)] ?? correct;
          } else {
            const opts = [0, 1, 2, 3].filter((i) => !dropped.includes(i));
            pick = opts[Math.floor(Math.random() * opts.length)] ?? 0;
          }
          const wait = Math.max(50, currentDelay + Math.random() * 800 - 400);
          const b = bot;
          window.setTimeout(() => {
            lockFn({
              data: { roomCode, sessionId: b.sessionId, answerIndex: pick },
            })
              .then(() => updateBot(b.key, { state: "locked", pick }))
              .catch((e) => updateBot(b.key, { state: "error", error: (e as Error).message }));
          }, wait);
        }
      } else if (room.phase === "reveal") {
        for (const bot of botsRef.current) {
          if (bot.state !== "error") updateBot(bot.key, { state: "reveal" });
        }
      } else if (room.phase === "lobby") {
        lastQRef.current = "";
        for (const bot of botsRef.current) {
          if (bot.state !== "error") updateBot(bot.key, { state: "lobby", pick: null });
        }
      }
    }

    void tick();
    const channel = supabase
      .channel(`dev-rig-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        () => void tick(),
      )
      .subscribe();

    // Poll scores
    const scoreInterval = setInterval(async () => {
      const ids = botsRef.current.map((b) => b.sessionId);
      if (ids.length === 0) return;
      const { data } = await supabase
        .from("players")
        .select("session_id, score")
        .eq("room_id", roomId)
        .in("session_id", ids);
      if (!data) return;
      const map = new Map(data.map((p) => [p.session_id, p.score]));
      setBots((prev) =>
        prev.map((b) => ({ ...b, score: map.get(b.sessionId) ?? b.score })),
      );
    }, 2000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(scoreInterval);
    };
  }, [roomId, bots.length, lockFn, roomCode, updateBot]);

  const ready = roomCode.length === 4;

  return (
    <main className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-4 py-2">
        <Link to="/" className="text-xs text-zinc-400 hover:text-zinc-100">
          ← Home
        </Link>
        <h1 className="text-sm font-bold">Dev playground</h1>
        <span className="rounded bg-zinc-900 px-2 py-0.5 font-mono text-xs">
          Room: <span className="text-emerald-400">{roomCode || "····"}</span>
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <span className="text-zinc-400">Bots</span>
            <input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="w-14 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 outline-none focus:border-zinc-500"
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-zinc-400">Mode</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 outline-none focus:border-zinc-500"
            >
              <option value="smart">smart</option>
              <option value="random">random</option>
              <option value="wrong">wrong</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span className="text-zinc-400">Delay</span>
            <input
              type="number"
              min={0}
              max={15000}
              step={100}
              value={delay}
              onChange={(e) => setDelay(Math.max(0, Math.min(15000, Number(e.target.value) || 0)))}
              className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 outline-none focus:border-zinc-500"
            />
          </label>

          <button
            onClick={() => void spawnAll()}
            disabled={!ready}
            className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-40"
          >
            ▶ Spawn {count}
          </button>
          <button
            onClick={addOne}
            disabled={!ready || bots.length >= 20}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900 disabled:opacity-40"
          >
            + Add
          </button>
          <button
            onClick={stopAll}
            disabled={bots.length === 0}
            className="rounded border border-red-500/60 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"
          >
            ■ Clear bots
          </button>
          <button
            onClick={newRoom}
            className="rounded border border-amber-500/60 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10"
          >
            🔄 New room
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Host iframe */}
        <div className="flex-1 min-w-0 bg-black">
          <iframe
            ref={iframeRef}
            src="/host"
            title="Host view"
            className="h-full w-full border-0"
          />
        </div>

        {/* Bot rail */}
        <aside className="flex w-[320px] flex-col border-l border-zinc-800 bg-zinc-950">
          <div className="border-b border-zinc-800 px-3 py-2 text-xs uppercase tracking-wider text-zinc-400">
            Bots ({bots.length})
          </div>
          <div className="flex-1 overflow-auto">
            {bots.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500">
                {ready
                  ? "Click Spawn to fill the lobby with bots."
                  : "Waiting for host iframe to generate a room code…"}
              </div>
            ) : (
              <ul className="divide-y divide-zinc-900">
                {bots.map((b) => (
                  <BotRow key={b.key} bot={b} />
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-500">
            Drive the game from the host view on the left. Bots react in real time.
          </div>
        </aside>

        {/* QA harness */}
        <QAPanel roomCode={roomCode} roomPhase={roomPhase} />
      </div>
    </main>
  );
}

// Trailing helper unchanged below

function BotRow({ bot }: { bot: Bot }) {
  const dot =
    bot.state === "error"
      ? "bg-red-500"
      : bot.state === "joining"
        ? "bg-yellow-500 animate-pulse"
        : bot.state === "thinking"
          ? "bg-blue-500 animate-pulse"
          : bot.state === "locked"
            ? "bg-purple-400"
            : bot.state === "reveal"
              ? "bg-emerald-500"
              : "bg-zinc-500";
  const letters = ["A", "B", "C", "D"];
  return (
    <li className="flex items-center gap-2 px-3 py-2 text-xs">
      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0 flex-1 truncate font-medium">{bot.name}</span>
      <span className="font-mono text-[10px] uppercase text-zinc-500">{bot.state}</span>
      <span className="w-5 text-center font-mono text-[10px] text-zinc-300">
        {bot.pick !== null ? letters[bot.pick] : "–"}
      </span>
      <span className="w-10 text-right font-mono text-zinc-200">{bot.score}</span>
    </li>
  );
}
