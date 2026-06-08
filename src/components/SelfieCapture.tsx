import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Check, X } from "lucide-react";

type Props = {
  onCapture: (blob: Blob) => void;
  onSkip: () => void;
};

export function SelfieCapture({ onCapture, onSkip }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 480, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setError((e as Error).message || "Camera unavailable");
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const size = 320;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror so it matches what the user saw
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const s = Math.min(vw, vh);
    ctx.drawImage(video, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, size, size);
    setSnapshot(canvas.toDataURL("image/jpeg", 0.85));
  }

  function confirm() {
    if (!snapshot) return;
    const bin = atob(snapshot.split(",")[1]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    onCapture(new Blob([arr], { type: "image/jpeg" }));
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-3xl border border-amber-300/30 bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
        {error ? (
          <div className="grid h-full place-items-center p-4 text-center text-sm text-amber-100/70">
            {error}
          </div>
        ) : snapshot ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <img src={snapshot} className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full -scale-x-100 object-cover"
          />
        )}
      </div>

      <div className="flex w-full max-w-xs gap-2">
        {snapshot ? (
          <>
            <button
              onClick={() => setSnapshot(null)}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-amber-300/30 bg-white/5 px-4 py-3 text-sm font-medium text-amber-100 hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" /> Retake
            </button>
            <button
              onClick={confirm}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-3 text-sm font-bold uppercase tracking-wider text-amber-950 shadow-[0_0_30px_oklch(0.85_0.18_85/0.35)] hover:brightness-110"
            >
              <Check className="h-4 w-4" /> Use this
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onSkip}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-amber-300/30 bg-white/5 px-4 py-3 text-sm font-medium text-amber-100 hover:bg-white/10"
            >
              <X className="h-4 w-4" /> Skip
            </button>
            <button
              onClick={snap}
              disabled={!!error}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-3 text-sm font-bold uppercase tracking-wider text-amber-950 shadow-[0_0_30px_oklch(0.85_0.18_85/0.35)] hover:brightness-110 disabled:opacity-40"
            >
              <Camera className="h-4 w-4" /> Capture
            </button>
          </>
        )}
      </div>
    </div>
  );
}
