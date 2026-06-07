import { useEffect } from "react";

/**
 * Global keyboard / remote-control bindings for the host screen.
 *
 *   Enter         → click whichever button has [data-host-primary].
 *                   Firestick & TV-browser remote "OK" buttons map to Enter,
 *                   giving one-button gameplay. (Space is reserved for pause.)
 *   F             → toggle browser fullscreen (passed in from caller).

 *
 * Each phase tags its "advance" button with data-host-primary="true". The
 * hook just clicks the first visible one — no state-machine coupling.
 */
export function useHostHotkeys(toggleFullscreen: () => void | Promise<void>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in an input/textarea/contentEditable.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Enter") {
        const btn = document.querySelector<HTMLElement>(
          '[data-host-primary="true"]',
        );
        if (btn) {
          e.preventDefault();
          btn.click();
        }
        return;
      }

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);
}
