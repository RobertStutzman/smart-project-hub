import { useEffect } from "react";

/**
 * Try to autoplay the lobby chatter ambience. If the browser blocks
 * playback, listen for ANY user gesture and retry on each one until
 * play() resolves. Once playback succeeds, detach the listeners.
 */
export function useLobbyChatter() {
  useEffect(() => {
    let cancelled = false;
    let detach: (() => void) | undefined;
    let unsubBlocked: (() => void) | undefined;

    const events = ["pointerdown", "click", "touchstart", "keydown"] as const;

    void import("@/lib/ambience-engine").then((m) => {
      if (cancelled) return;

      const attach = () => {
        if (detach) return; // already attached
        const retry = () => {
          void m.startLobbyChatter().then((ok) => {
            if (ok) detachListeners();
          });
        };
        const detachListeners = () => {
          events.forEach((e) =>
            window.removeEventListener(e, retry, {
              capture: true,
            } as EventListenerOptions),
          );
          detach = undefined;
        };
        events.forEach((e) =>
          window.addEventListener(e, retry, {
            capture: true,
            passive: true,
          }),
        );
        detach = detachListeners;
      };

      // 1) Try once immediately.
      void m.startLobbyChatter().then((ok) => {
        if (cancelled) return;
        if (!ok) attach();
      });

      // 2) React to blocked-state changes (e.g. mute toggle re-blocks later).
      unsubBlocked = m.onAmbienceBlockedChange((isBlocked) => {
        if (cancelled) return;
        if (isBlocked) attach();
        else detach?.();
      }) as unknown as () => void;
    });

    return () => {
      cancelled = true;
      detach?.();
      unsubBlocked?.();
    };
  }, []);
}
