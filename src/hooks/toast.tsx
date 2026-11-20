import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';

interface Toast {
  id: number;
  kind: 'ok' | 'error';
  message: string;
}

const ToastCtx = createContext<{ ok: (m: string) => void; error: (m: string) => void }>({
  ok: () => {},
  error: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-2), { id, kind, message }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);

  const value = { ok: (m: string) => push('ok', m), error: (m: string) => push('error', m) };

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            {t.kind === 'ok' ? <CircleCheck aria-hidden /> : <CircleAlert aria-hidden />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
