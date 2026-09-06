import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { SessionInfo } from "@url-shortener/shared";
import { api } from "./api-client";

interface AuthContextValue {
  session: SessionInfo | null;
  /** null = still checking, true/false = known. */
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Source of truth for "are we logged in" - always asks the API
 * (GET /api/auth/session), never reads a client-side value, since the auth
 * cookie is httpOnly and unreadable from JS by design (see plan §2.1).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const info = await api.auth.getSession();
      setSession(info);
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (token: string) => {
    const info = await api.auth.login({ token });
    setSession(info);
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
