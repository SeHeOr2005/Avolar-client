import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setSessionExpiredHandler } from '../lib/api';
import { clearIdleMarker } from './idle';
import { answerOtherTabs, clearTab, isTabMarked, markTab, otherTabHasSession } from './tabSession';
import type { AuthUser } from '../lib/types';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  can: (perm: string) => boolean;
  reload: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const reload = useCallback(async () => {
    // Pestaña nueva (se cerró la anterior o se abrió de cero): la sesión no se reutiliza,
    // salvo que haya otra pestaña del panel abierta en este momento.
    if (!isTabMarked()) {
      if (await otherTabHasSession()) {
        markTab();
      } else {
        // Solo en rutas del panel se avisa al servidor; en el sitio público basta con no usar la sesión.
        if (window.location.pathname.startsWith('/admin')) await api.post('/auth/logout').catch(() => {});
        setUser(null);
        setLoading(false);
        return;
      }
    }
    try {
      const r = await api.get<{ user: AuthUser }>('/auth/me');
      setUser(r.user);
    } catch {
      // Token de acceso vencido: se intenta renovar con el de refresco.
      if (await api.refresh()) {
        try {
          const r = await api.get<{ user: AuthUser }>('/auth/me');
          setUser(r.user);
          return;
        } catch {
          /* sin sesión */
        }
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mientras esta pestaña tenga la sesión, responde a pestañas nuevas del panel.
  useEffect(() => (user ? answerOtherTabs() : undefined), [user]);

  useEffect(() => {
    void reload();
    setSessionExpiredHandler(() => {
      setUser(null);
      qc.clear();
      clearIdleMarker();
      clearTab();
    });
  }, [reload, qc]);

  const login = async (username: string, password: string) => {
    const r = await api.post<{ user: AuthUser }>('/auth/login', { username, password });
    markTab();
    setUser(r.user);
    return r.user;
  };

  /** Revoca la sesión en el servidor y borra del navegador todo dato del panel en memoria. */
  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    qc.clear();
    clearIdleMarker();
    clearTab();
  };

  const can = (perm: string) => Boolean(user && (user.isSuperadmin || user.permissions.includes(perm)));

  return <AuthCtx.Provider value={{ user, loading, login, logout, can, reload }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth fuera de AuthProvider');
  return ctx;
}
