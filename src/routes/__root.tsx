import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { resumeAudioContext, retryBlockedMusic } from "@/lib/sound-engine";
import { resumeAmbienceContext, retryBlockedAmbience } from "@/lib/ambience-engine";
import { unlockElfVoice } from "@/lib/elf-voice";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeParticles } from "@/components/ThemeParticles";
import { setCategoryMetaCache } from "@/lib/categories";
import { listCategoryMeta } from "@/lib/categories.functions";
import { Toaster } from "sonner";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

const STALE_CHUNK_RE =
  /Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk .* failed|ChunkLoadError|Unable to preload/i;
const RELOAD_FLAG = "btd-stale-chunk-reload";

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  const isStaleChunk = STALE_CHUNK_RE.test(error?.message ?? "");
  const alreadyReloaded =
    typeof window !== "undefined" && window.sessionStorage.getItem(RELOAD_FLAG) === "1";

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  // Auto-recover from stale-chunk errors (browser cached an old index-*.js
  // whose split chunks no longer exist after a deploy). One-shot guard so
  // we never enter a reload loop.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isStaleChunk || alreadyReloaded) return;
    try { window.sessionStorage.setItem(RELOAD_FLAG, "1"); } catch {}
    window.location.reload();
  }, [isStaleChunk, alreadyReloaded]);

  const title = isStaleChunk && alreadyReloaded
    ? "A new version was deployed"
    : "This page didn't load";
  const body = isStaleChunk && alreadyReloaded
    ? "Tap Refresh to load the latest version."
    : isStaleChunk
      ? "Refreshing to pick up the latest version…"
      : "Something went wrong on our end. You can try refreshing or head back home.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              if (isStaleChunk) {
                try { window.sessionStorage.removeItem(RELOAD_FLAG); } catch {}
                window.location.reload();
                return;
              }
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {isStaleChunk ? "Refresh" : "Try again"}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0f0a1f" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Drop Trivia" },
      { name: "mobile-web-app-capable", content: "yes" },
      { title: "Lovable App" },
      { name: "description", content: "A multiplayer trivia game app for hosts and mobile players, featuring AI-driven mechanics and Twitch integration." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "A multiplayer trivia game app for hosts and mobile players, featuring AI-driven mechanics and Twitch integration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "A multiplayer trivia game app for hosts and mobile players, featuring AI-driven mechanics and Twitch integration." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/23241cea-4190-4f19-9895-86741a625813/id-preview-cbf6dd3f--a53d90a6-85a1-4b52-914d-2e46615cb4a6.lovable.app-1780078943214.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/23241cea-4190-4f19-9895-86741a625813/id-preview-cbf6dd3f--a53d90a6-85a1-4b52-914d-2e46615cb4a6.lovable.app-1780078943214.png" },

    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=EB+Garamond:wght@400;600&family=Cinzel:wght@500;700&family=Press+Start+2P&family=VT323&display=swap",
      },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Self-contained, inline-styled fallback for legacy browsers (Samsung Tizen
  // TV, old Chromium/Safari < 2023). Tailwind v4 requires Chrome 111+ and
  // does not render at all on those browsers, so we replace the page with a
  // plain-HTML notice instead of leaving a blank screen.
  const legacyBrowserScript = `(function(){try{
    var ok = window.CSS && CSS.supports && CSS.supports('color','oklch(0 0 0)') && CSS.supports('color','color-mix(in oklab, red, blue)');
    if (ok) return;
    var msg = '<div style="position:fixed;inset:0;background:#0f0a1f;color:#fff;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;padding:6vmin;text-align:center;z-index:2147483647;">'
      + '<div style="max-width:720px;">'
      + '<div style="font-size:6vmin;font-weight:700;margin-bottom:3vmin;color:#d6a23a;">Browser not supported</div>'
      + '<div style="font-size:3vmin;line-height:1.5;margin-bottom:4vmin;">Drop Trivia needs a modern browser to host a game. Your TV browser is too old to render this page.</div>'
      + '<div style="font-size:2.6vmin;line-height:1.6;opacity:.9;">Try one of these instead:<br/><br/>'
      + '\u2022 Open <b>droptrivia.app</b> on a phone or laptop and cast/mirror to the TV<br/>'
      + '\u2022 Use a Chromecast, Apple TV, or Fire Stick browser<br/>'
      + '\u2022 Players can still join with their phones at <b>droptrivia.app</b></div>'
      + '</div></div>';
    document.addEventListener('DOMContentLoaded', function(){ document.body.insertAdjacentHTML('beforeend', msg); });
  }catch(e){}})();`;
  return (
    <html lang="en" data-theme="fellowship">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: legacyBrowserScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Global first-gesture audio unlock. Browsers leave AudioContexts suspended
  // until ctx.resume() is called synchronously from a user gesture. Music and
  // crowd ambience use Web Audio; the announcer uses a shared HTMLAudio
  // element which ALSO needs a gesture in Safari/strict-autoplay browsers —
  // unlockElfVoice blesses it and replays any line that was blocked.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tryUnlock = () => {
      unlockElfVoice();
      void resumeAudioContext();
      resumeAmbienceContext();
      // Always retry — these are no-ops when nothing is pending / already playing.
      retryBlockedMusic();
      // Slight delay lets the AudioContext flip to 'running' before scheduling.
      setTimeout(() => retryBlockedAmbience(), 50);
    };

    window.addEventListener("pointerdown", tryUnlock, true);
    window.addEventListener("keydown", tryUnlock, true);
    window.addEventListener("touchstart", tryUnlock, true);
    return () => {
      window.removeEventListener("pointerdown", tryUnlock, true);
      window.removeEventListener("keydown", tryUnlock, true);
      window.removeEventListener("touchstart", tryUnlock, true);
    };
  }, []);

  // Load DB-backed category metadata (emoji + off-by-default flags) once on
  // mount. Lets new categories added via the Gemini importer show their real
  // emoji everywhere without a code change.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await listCategoryMeta();
        if (cancelled) return;
        setCategoryMetaCache(res.meta);
      } catch {
        // non-fatal — falls back to hardcoded CATEGORIES list
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemeParticles />
        <div className="relative z-10">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </div>
        <Toaster position="top-center" richColors />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

