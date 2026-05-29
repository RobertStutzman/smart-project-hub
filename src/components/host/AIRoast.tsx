import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateRoast } from "@/lib/game.functions";

type Props = {
  roomCode: string;
  hostSessionId: string;
};

export function AIRoast({ roomCode, hostSessionId }: Props) {
  const generateRoastFn = useServerFn(generateRoast);
  const [roast, setRoast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    generateRoastFn({ data: { roomCode, hostSessionId } })
      .then((res) => {
        if (!cancelled) setRoast(res.roast);
      })
      .catch(() => {
        if (!cancelled) setRoast("That game happened. Some of you should be proud. The rest of you, less so.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode, hostSessionId, generateRoastFn]);

  return (
    <div className="mt-8 max-w-2xl rounded-3xl border border-amber-400/40 bg-amber-400/10 p-6 text-amber-100">
      <div className="text-xs uppercase tracking-[0.3em] text-amber-300">
        🎤 The Host's verdict
      </div>
      <p className="mt-3 text-lg font-medium leading-snug">
        {loading ? "The AI is sharpening its tongue…" : roast}
      </p>
    </div>
  );
}
