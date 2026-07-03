// Tiny in-app debug event bus. Subsystems fire-and-forget with
// btdDebug.emit(...); the /dev QA panel subscribes to grade assertions.
//
// - No-op when nothing is listening (checks a global flag).
// - Bridges across the host <iframe> in /dev via postMessage so the parent
//   panel sees events emitted inside the iframe host.

export type DebugEvent =
  | { type: "phase.change"; phase: string; roundNumber?: number }
  | { type: "question.show"; questionKey: string; questionNumber: number | null; category: string | null }
  | { type: "timer.start"; scope: "question" | "final"; durationS: number }
  | { type: "countdown.show"; kind: "intro-321" | "big-321" | "final" }
  | { type: "ambience.start"; layer: "chatter" | "crowd" | "drumroll" }
  | { type: "ambience.stop"; layer: "chatter" | "crowd" | "drumroll" | "all" }
  | { type: "ambience.blocked"; layer: "chatter" | "crowd" | "drumroll" }
  | { type: "music.start"; mode: string }
  | { type: "music.stop" }
  | { type: "tts.speak"; preset?: string; text: string }
  | { type: "drop.answer"; index: number; questionKey?: string }
  | { type: "final.question"; difficulty: string | null; questionId: string | null }
  | { type: "note"; message: string };

export type StampedEvent = DebugEvent & { t: number; from: "self" | "iframe" };

type Listener = (e: StampedEvent) => void;

const g = (typeof window !== "undefined" ? window : ({} as Window)) as Window & {
  __btdDebugEnabled?: boolean;
  __btdDebugListeners?: Set<Listener>;
};

function ensureListeners(): Set<Listener> {
  if (!g.__btdDebugListeners) g.__btdDebugListeners = new Set();
  return g.__btdDebugListeners;
}

/** Turn on emission (parent /dev calls this; iframe also enables on receiving a ping). */
export function enableDebugBus(): void {
  if (typeof window === "undefined") return;
  g.__btdDebugEnabled = true;
  // Nudge child iframes on the same origin so their emits start flowing.
  try {
    const frames = document.querySelectorAll("iframe");
    frames.forEach((f) => {
      try {
        f.contentWindow?.postMessage({ type: "btd:debug:enable" }, "*");
      } catch { /* cross-origin */ }
    });
  } catch { /* ignore */ }
}

export function disableDebugBus(): void {
  if (typeof window === "undefined") return;
  g.__btdDebugEnabled = false;
  ensureListeners().clear();
}

export function subscribeDebugBus(cb: Listener): () => void {
  const set = ensureListeners();
  set.add(cb);
  return () => set.delete(cb);
}

/** Fire an event. No-op unless the bus was enabled (kept cheap in production). */
export function emitDebug(evt: DebugEvent): void {
  if (typeof window === "undefined") return;
  if (!g.__btdDebugEnabled) return;
  const stamped: StampedEvent = { ...evt, t: Date.now(), from: "self" };
  // Local delivery
  for (const l of ensureListeners()) {
    try { l(stamped); } catch { /* ignore */ }
  }
  // Bridge to parent window if we're inside an iframe
  if (window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({ type: "btd:debug:event", event: stamped }, "*");
    } catch { /* ignore */ }
  }
}

/**
 * Install a parent-side receiver that turns postMessage events from child
 * iframes into local subscriber deliveries. Call once in the parent (e.g.
 * from /dev). Returns an unsubscribe fn.
 */
export function installDebugBridge(): () => void {
  if (typeof window === "undefined") return () => {};
  function onMsg(e: MessageEvent) {
    const data = e.data as
      | { type?: string; event?: StampedEvent }
      | null;
    if (!data) return;
    if (data.type === "btd:debug:event" && data.event) {
      const evt = { ...data.event, from: "iframe" as const };
      for (const l of ensureListeners()) {
        try { l(evt); } catch { /* ignore */ }
      }
    }
  }
  window.addEventListener("message", onMsg);
  return () => window.removeEventListener("message", onMsg);
}

/** Iframe-side: listen for the parent's enable ping so we start emitting. */
if (typeof window !== "undefined" && window.parent && window.parent !== window) {
  window.addEventListener("message", (e) => {
    const d = e.data as { type?: string } | null;
    if (d?.type === "btd:debug:enable") g.__btdDebugEnabled = true;
  });
}
