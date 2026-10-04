import type { AuthTokens, AuthUser } from "@/types/auth";

const STORAGE_KEY = "odoben-auth-session";

export type StoredSession = {
  user: AuthUser;
} & AuthTokens;

export function readSession(): StoredSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.user || !parsed?.accessToken || !parsed?.refreshToken) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: StoredSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function getAccessToken() {
  return readSession()?.accessToken ?? null;
}

export function getRefreshToken() {
  return readSession()?.refreshToken ?? null;
}
