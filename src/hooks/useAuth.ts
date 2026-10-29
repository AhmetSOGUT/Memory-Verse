import { useCallback, useEffect, useState } from "react";
import * as authApi from "../api/auth";
import { ApiError, errorMessage, setUnauthorizedHandler } from "../api/client";
import type { AuthUser } from "../types";

export type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "unreachable"; message: string }
  | { status: "authenticated"; user: AuthUser };

/** Oturum durumu: açılışta sunucuya sorar, giriş/çıkışı yönetir, oturum düşerse giriş ekranına döner. */
export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((user) => {
        if (!cancelled) setState({ status: "authenticated", user });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) setState({ status: "anonymous" });
        else setState({ status: "unreachable", message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    setUnauthorizedHandler(() => setState({ status: "anonymous" }));
    return () => setUnauthorizedHandler(null);
  }, []);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const user = await authApi.login(username, password);
    setState({ status: "authenticated", user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* oturum zaten kapanmış olabilir; yine de çıkış yap */
    }
    setState({ status: "anonymous" });
  }, []);

  return { state, login, logout, retry };
}