import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { IntroStage } from "@/components/host/IntroStage";

export const Route = createFileRoute("/preview-intro")({
  head: () => ({ meta: [{ title: "Intro preview — Beat the Drop" }] }),
  component: PreviewIntro,
});

const MOCK_PLAYERS = [
  { id: "1", nickname: "Alpha", avatar_url: null },
  { id: "2", nickname: "Bravo", avatar_url: null },
  { id: "3", nickname: "Charlie", avatar_url: null },
  { id: "4", nickname: "Delta", avatar_url: null },
];

function PreviewIntro() {
  const [done, setDone] = useState(false);
  const [doneAt, setDoneAt] = useState<number | null>(null);
  return (
    <div className="h-screen w-screen">
      {!done ? (
        <IntroStage
          players={MOCK_PLAYERS}
          onDone={() => {
            setDoneAt(performance.now());
            setDone(true);
          }}
        />
      ) : (
        <div
          data-testid="intro-done"
          className="grid h-full place-items-center bg-black text-white"
        >
          <div className="text-center">
            <div className="text-2xl font-bold">First question would mount now</div>
            <div className="mt-2 text-sm opacity-70">doneAt={doneAt?.toFixed(0)}ms</div>
          </div>
        </div>
      )}
    </div>
  );
}
