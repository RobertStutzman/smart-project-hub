import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

const CONTRAST_KEY = "btd-a11y-contrast";
const FONT_KEY = "btd-a11y-font";

function apply(contrast: boolean, dyslexic: boolean) {
  if (typeof document === "undefined") return;
  document.body.setAttribute("data-a11y-contrast", contrast ? "high" : "normal");
  document.body.setAttribute("data-a11y-font", dyslexic ? "dyslexic" : "normal");
}

export function AccessibilityToggle() {
  const [contrast, setContrast] = useState(false);
  const [dyslexic, setDyslexic] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const c = window.localStorage.getItem(CONTRAST_KEY) === "1";
    const d = window.localStorage.getItem(FONT_KEY) === "1";
    setContrast(c);
    setDyslexic(d);
    apply(c, d);
  }, []);

  function toggleContrast() {
    const next = !contrast;
    setContrast(next);
    window.localStorage.setItem(CONTRAST_KEY, next ? "1" : "0");
    apply(next, dyslexic);
  }

  function toggleDyslexic() {
    const next = !dyslexic;
    setDyslexic(next);
    window.localStorage.setItem(FONT_KEY, next ? "1" : "0");
    apply(contrast, next);
  }

  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={toggleContrast}
        aria-pressed={contrast}
        className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${
          contrast
            ? "border-foreground bg-foreground text-background"
            : "border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        {t("high_contrast")}
      </button>
      <button
        type="button"
        onClick={toggleDyslexic}
        aria-pressed={dyslexic}
        className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${
          dyslexic
            ? "border-foreground bg-foreground text-background"
            : "border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        {t("dyslexia_font")}
      </button>
    </div>
  );
}
