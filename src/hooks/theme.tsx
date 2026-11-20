import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'day' | 'night';
const KEY = 'avolar-theme';

const ThemeCtx = createContext<{ theme: Theme; toggle: (origin?: { x: number; y: number }) => void }>({
  theme: 'night',
  toggle: () => {},
});

function readTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'day' ? 'day' : 'night';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'day' ? '#fff3e6' : '#0b0613');
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* almacenamiento no disponible: el modo funciona igual en esta visita */
    }
  }, [theme]);

  const toggle = useCallback(
    (origin?: { x: number; y: number }) => {
      const next: Theme = theme === 'day' ? 'night' : 'day';
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
      if (!doc.startViewTransition || reduce) {
        setTheme(next);
        return;
      }
      // El nuevo modo se revela en un círculo que nace del interruptor: una acción poco
      // frecuente, así que se permite una animación con carácter (~520 ms).
      const x = origin?.x ?? window.innerWidth - 40;
      const y = origin?.y ?? 32;
      const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      const t = doc.startViewTransition(() => {
        flushSync(() => setTheme(next));
        document.documentElement.setAttribute('data-theme', next);
      });
      t.ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 520, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      });
    },
    [theme],
  );

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
