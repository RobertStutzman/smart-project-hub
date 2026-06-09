// Tiny event bus for surfacing audience-triggered events (pads, reactions,
// synth sfx) on the host TV without coupling host.tsx ↔ HostGameStage.

export type AudienceFeedEvent = {
  id: number;
  kind: "pad" | "react" | "sfx";
  nickname: string;
  emoji?: string;
  label?: string;
};

const target = typeof window !== "undefined" ? new EventTarget() : null;
const EVT = "audience-feed";
let nextId = 1;

export function emitAudienceFeed(
  e: Omit<AudienceFeedEvent, "id">,
): void {
  if (!target) return;
  const detail: AudienceFeedEvent = { ...e, id: nextId++ };
  target.dispatchEvent(new CustomEvent(EVT, { detail }));
}

export function subscribeAudienceFeed(
  cb: (e: AudienceFeedEvent) => void,
): () => void {
  if (!target) return () => {};
  const handler = (ev: Event) => {
    cb((ev as CustomEvent<AudienceFeedEvent>).detail);
  };
  target.addEventListener(EVT, handler);
  return () => target.removeEventListener(EVT, handler);
}
