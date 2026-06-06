import { createFileRoute } from "@tanstack/react-router";
import { QuestionStage } from "@/components/host/QuestionStage";

export const Route = createFileRoute("/preview-question")({
  head: () => ({ meta: [{ title: "Question preview" }] }),
  component: PreviewPage,
});

function PreviewPage() {
  return (
    <div className="h-screen w-screen bg-black">
      <QuestionStage
        questionText="Which guitar is most associated with Jimi Hendrix?"
        answers={["Fender Stratocaster", "Gibson Les Paul", "Rickenbacker 360", "Gretsch White Falcon"]}
        droppedIndexes={[]}
        correctIndex={null}
        secondsLeft={12}
        readSecondsLeft={0}
        players={[
          { id: "1", nickname: "Alex", avatar_url: null, current_answer: 0 },
          { id: "2", nickname: "Sam", avatar_url: null, current_answer: null },
          { id: "3", nickname: "Jo", avatar_url: null, current_answer: 2 },
        ]}
        phase="question"
        explanation={null}
        mediaUrl="https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=1200&q=80"
        mediaType="image"
      />
    </div>
  );
}
