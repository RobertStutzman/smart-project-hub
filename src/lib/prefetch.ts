// Silently pre-fetch the next question's media so playback is zero-lag.
const cache = new Map<string, HTMLImageElement | HTMLAudioElement>();

export function prefetchMedia(url: string, type: "image" | "audio" | "video" = "image") {
  if (!url || cache.has(url) || typeof window === "undefined") return;
  if (type === "image") {
    const img = new Image();
    img.src = url;
    cache.set(url, img);
  } else {
    const a = new Audio();
    a.preload = "auto";
    a.src = url;
    cache.set(url, a);
  }
}

export function getPrefetched(url: string) {
  return cache.get(url) ?? null;
}

export function clearPrefetch() {
  cache.clear();
}
