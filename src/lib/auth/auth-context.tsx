import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthUser, Role } from '@/types/api';
import { authApi } from '@/lib/api/endpoints';
import { setUnauthorizedHandler, toApiError, USE_MOCKS } from '@/lib/api/client';
import { tokenStore } from './token-store';
import { setMockSessionUserId } from '@/lib/mock/router';
import { can, homeRoute, type Capability } from './rbac';

interface AuthContextValue {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  can: (capability: Capability) => boolean;
  role: Role | null;
  home: string;
  sessionError: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const bootstrapped = useRef(false);

  const resetSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      resetSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [resetSession]);

  useEffect(() => {
    // StrictMode в dev монтирует эффект дважды: повторный bootstrap привёл бы к гонке
    // refresh-запросов, поэтому запускаем ровно один раз за жизнь провайдера.
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    void (async () => {
      try {
        const refreshed = await authApi.refresh();
        tokenStore.set(refreshed.data.access_token);
        const me = await authApi.me();
        setUser(me.data);
        setStatus('authenticated');
      } catch (error) {
        const apiError = toApiError(error);
        if (apiError.status !== 401) setSessionError(apiError.message);
        setStatus('anonymous');
        setUser(null);
        if (USE_MOCKS) setMockSessionUserId(null);
      }
    })();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await authApi.login(email, password);
      tokenStore.set(response.data.access_token);
      queryClient.clear();
      setUser(response.data.user);
      setStatus('authenticated');
      setSessionError(null);
      return response.data.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Выход не должен блокироваться сетевой ошибкой.
    } finally {
      if (USE_MOCKS) setMockSessionUserId(null);
      resetSession();
    }
  }, [resetSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login,
      logout,
      can: (capability: Capability) => can(user?.role, capability),
      role: user?.role ?? null,
      home: homeRoute(user?.role),
      sessionError,
    }),
    [user, status, login, logout, sessionError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth должен использоваться внутри AuthProvider');
  return context;
}
