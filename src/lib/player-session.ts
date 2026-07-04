const KEY = "btd:player";
const HOST_KEY = "btd:host";

export type PlayerSession = {
  sessionId: string;
  roomCode: string;
  nickname: string;
};

export type HostSession = {
  sessionId: string;
  roomCode: string;
};

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getOrCreateSessionId(storageKey = KEY): string {
  if (typeof window === "undefined") return uuid();
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.sessionId) return parsed.sessionId;
    }
  } catch {
    /* ignore */
  }
  return uuid();
}

export function savePlayerSession(s: PlayerSession) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* Storage can be blocked on some in-app browsers. Joining should still continue. */
  }
}

export function loadPlayerSession(): PlayerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PlayerSession) : null;
  } catch {
    return null;
  }
}

export function clearPlayerSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function saveHostSession(s: HostSession) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HOST_KEY, JSON.stringify(s));
  } catch {
    /* Storage can be blocked on some browsers; the host room still exists server-side. */
  }
}

export function loadHostSession(): HostSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(HOST_KEY);
    return raw ? (JSON.parse(raw) as HostSession) : null;
  } catch {
    return null;
  }
}

export function newId() {
  return uuid();
}
