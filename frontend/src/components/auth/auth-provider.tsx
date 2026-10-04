"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, loginUser, logoutUser } from "@/lib/api";
import { clearSession, readSession, writeSession } from "@/lib/session";
import type { AuthUser } from "@/types/auth";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const session = readSession();
    setUser(session?.user ?? null);
    setStatus(session ? "authenticated" : "unauthenticated");
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const response = await loginUser(phone, password);
    const session = {
      user: response.user,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    };

    writeSession(session);
    setUser(response.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Ignore logout backend failures and always clear local session.
    }

    clearSession();
    setUser(null);
    setStatus("unauthenticated");
    router.push("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login,
      logout,
    }),
    [login, logout, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export async function fetchWithAuth<T>(path: string, init?: RequestInit, options?: { auth?: boolean; skipRefresh?: boolean }) {
  return apiRequest<T>(path, init, options);
}
