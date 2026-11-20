import { useCallback, useEffect, useRef, useState } from 'react';

/** Debe coincidir con SESSION_IDLE_MINUTES del backend (que también lo exige). */
export const IDLE_LIMIT_MS = 30 * 60_000;
/** Cuánto antes del cierre aparece el aviso. */
export const IDLE_WARNING_MS = 2 * 60_000;

const KEY = 'avolar-admin-last-activity';
const EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart'] as const;

const readLast = () => {
  try {
    return Number(localStorage.getItem(KEY)) || Date.now();
  } catch {
    return Date.now();
  }
};
const writeLast = (t: number) => {
  try {
    localStorage.setItem(KEY, String(t));
  } catch {
    /* sin almacenamiento: el temporizador funciona solo en esta pestaña */
  }
};
export const clearIdleMarker = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignorar */
  }
};

/** Motivo del último cierre, para mostrarlo en el login (solo esta pestaña, se borra al leerlo). */
const REASON_KEY = 'avolar-logout-reason';
export const setLogoutReason = (r: string) => {
  try {
    sessionStorage.setItem(REASON_KEY, r);
  } catch {
    /* ignorar */
  }
};
export const peekLogoutReason = () => {
  try {
    return sessionStorage.getItem(REASON_KEY);
  } catch {
    return null;
  }
};
export const clearLogoutReason = () => {
  try {
    sessionStorage.removeItem(REASON_KEY);
  } catch {
    /* ignorar */
  }
};

/**
 * Cierra la sesión tras IDLE_LIMIT_MS sin actividad del usuario (no cuentan las consultas
 * automáticas en segundo plano). La última actividad se comparte entre pestañas vía
 * localStorage, así que trabajar en una pestaña mantiene viva la sesión en las demás.
 */
export function useIdleLogout(onTimeout: () => void, enabled = true) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const local = useRef(Date.now());
  const fired = useRef(false);

  const touch = useCallback(() => {
    const now = Date.now();
    // Se escribe como mucho cada 5 s para no saturar el almacenamiento con pointermove.
    if (now - local.current > 5_000) {
      local.current = now;
      writeLast(now);
    }
    setRemainingMs(null);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fired.current = false;
    local.current = Date.now();
    writeLast(local.current);

    const check = () => {
      const idle = Date.now() - Math.max(readLast(), local.current);
      if (idle >= IDLE_LIMIT_MS) {
        if (!fired.current) {
          fired.current = true;
          onTimeout();
        }
      } else if (idle >= IDLE_LIMIT_MS - IDLE_WARNING_MS) {
        setRemainingMs(IDLE_LIMIT_MS - idle);
      } else {
        setRemainingMs(null);
      }
    };

    const onActivity = () => touch();
    // Al volver a la pestaña (o al despertar el equipo) se revisa de inmediato.
    const onVisible = () => document.visibilityState === 'visible' && check();
    // Otra pestaña registró actividad: se oculta el aviso aquí también.
    const onStorage = (e: StorageEvent) => e.key === KEY && check();

    EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', onStorage);
    const timer = window.setInterval(check, 1_000);
    return () => {
      EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(timer);
    };
  }, [enabled, onTimeout, touch]);

  /** "Seguir conectado": cuenta como actividad. */
  const stayActive = useCallback(() => {
    local.current = Date.now();
    writeLast(local.current);
    setRemainingMs(null);
  }, []);

  return { remainingMs, stayActive };
}
