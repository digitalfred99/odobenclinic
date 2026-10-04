import { clearSession, getAccessToken, readSession, writeSession } from "@/lib/session";
import type { AuthUser, RefreshResponse } from "@/types/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";

export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  label?: string;
  key?: string;
  details?: unknown;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  label?: string;
  key?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, label?: string, key?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.label = label;
    this.key = key;
    this.details = details;
  }
}

async function parseApiPayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as ApiEnvelope<unknown>;
  } catch {
    throw new ApiError("Unexpected server response", response.status);
  }
}

function unwrapPayload<T>(payload: ApiEnvelope<T> | null): T | null {
  if (!payload) {
    return null;
  }

  if (payload.success === false) {
    throw new ApiError(
      payload.message ?? "Request failed",
      400,
      payload.code,
      payload.label,
      payload.key,
      payload.details
    );
  }

  if (payload.success === true && "data" in payload) {
    return (payload.data as T) ?? null;
  }

  if (payload && typeof payload === "object" && "accessToken" in payload) {
    return payload as T;
  }

  return payload as T;
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const currentSession = readSession();

    if (!currentSession?.refreshToken) {
      return null;
    }

    try {
      const url = `${API_BASE_URL.replace(/\/$/, "")}/auth/refresh`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: currentSession.refreshToken }),
      });

      const payload = await parseApiPayload(response);

      if (!response.ok) {
        if (payload && typeof payload === "object" && "message" in payload) {
          throw new ApiError(String(payload.message), response.status, payload.code, payload.label, payload.key, payload.details);
        }
        throw new ApiError("Session refresh failed", response.status);
      }

      const refreshed = unwrapPayload(payload as ApiEnvelope<RefreshResponse>) as RefreshResponse | null;

      if (!refreshed?.accessToken || !refreshed?.refreshToken) {
        throw new ApiError("Invalid refresh response", 401);
      }

      const nextSession = {
        ...currentSession,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
      };

      writeSession(nextSession);
      return refreshed.accessToken;
    } catch {
      clearSession();
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, options: { auth?: boolean; skipRefresh?: boolean } = {}): Promise<T> {
  const { auth = true, skipRefresh = false } = options;
  const url = `${API_BASE_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers ?? {});

  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  let response = await fetch(url, { ...init, headers });

  if (response.status === 401 && auth && !skipRefresh && !path.endsWith("/auth/refresh")) {
    const refreshedAccessToken = await refreshAccessToken();

    if (refreshedAccessToken) {
      headers.set("Authorization", `Bearer ${refreshedAccessToken}`);
      response = await fetch(url, { ...init, headers });
    }
  }

  const payload = await parseApiPayload(response);

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : "Request failed";
    const code = payload && typeof payload === "object" && "code" in payload ? String(payload.code) : undefined;
    const label = payload && typeof payload === "object" && "label" in payload ? String(payload.label) : undefined;
    const key = payload && typeof payload === "object" && "key" in payload ? String(payload.key) : undefined;
    const details = payload && typeof payload === "object" && "details" in payload ? payload.details : undefined;
    throw new ApiError(message, response.status, code, label, key, details);
  }

  return unwrapPayload(payload as ApiEnvelope<T>) as T;
}

export async function loginUser(phone: string, password: string): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
  const data = await apiRequest<{ user: AuthUser; accessToken: string; refreshToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone, password }),
  }, { auth: false });

  return data;
}

export async function logoutUser() {
  try {
    await apiRequest<{ success: true }>("/auth/logout", { method: "POST" }, { auth: true, skipRefresh: true });
  } catch {
    // Best effort only, per backend contract.
  }
}
