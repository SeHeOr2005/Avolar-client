import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '../../hooks/theme';
import { STATUS_LABEL, STATUS_TONE } from '../../lib/format';

/* ─────────── Botón ─────────── */
type BtnVariant = 'primary' | 'accent' | 'ghost' | 'danger' | 'whatsapp' | 'default';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}
export const btnClass = (variant: BtnVariant = 'default', size: 'sm' | 'md' | 'lg' = 'md', block = false, extra = '') =>
  ['btn', variant !== 'default' && `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', extra]
    .filter(Boolean)
    .join(' ');

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', block, loading, icon, children, className, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={btnClass(variant, size, block, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden /> : icon}
      {children}
    </button>
  );
});

/* ─────────── Campos ─────────── */
interface FieldShell {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  className?: string;
}
export function Field({ label, hint, error, children, className }: FieldShell) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={`field ${className ?? ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children(id, [hintId, errId].filter(Boolean).join(' ') || undefined)}
      {hint && !error && (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={errId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string };
export function TextInput({ label, hint, error, className, ...rest }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id, d) => <input id={id} className="input" aria-invalid={error ? true : undefined} aria-describedby={d} {...rest} />}
    </Field>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode; error?: string };
export function TextArea({ label, hint, error, className, ...rest }: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id, d) => <textarea id={id} className="textarea" aria-invalid={error ? true : undefined} aria-describedby={d} {...rest} />}
    </Field>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: ReactNode; error?: string };
export function Select({ label, hint, error, className, children, ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id, d) => (
        <select id={id} className="select" aria-invalid={error ? true : undefined} aria-describedby={d} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" aria-hidden />
      <span>{label}</span>
    </label>
  );
}

/* ─────────── Estados ─────────── */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={`badge badge--${STATUS_TONE[status] ?? 'muted'}`}>{label ?? STATUS_LABEL[status] ?? status}</span>;
}

export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden>
        {icon}
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'No se pudo cargar la información.';
  return (
    <div className="alert alert--danger" role="alert">
      <CircleAlert aria-hidden />
      <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
        <span>{msg}</span>
        {onRetry && (
          <div>
            <Button size="sm" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Skeleton({ h = 20, w = '100%', r }: { h?: number | string; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden />;
}

/* ─────────── Modal accesible ─────────── */
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
    (first ?? ref.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input, select, textarea');
        if (!f.length) return;
        const a = f[0];
        const b = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal__head">
          <h2 id={titleId}>{title}</h2>
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Cerrar" data-close>
            <X />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ─────────── Interruptor Día / Noche ─────────── */
export function ThemeToggle({ compact }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const isDay = theme === 'day';
  return (
    <button
      type="button"
      className={`theme-toggle ${compact ? 'theme-toggle--compact' : ''}`}
      role="switch"
      aria-checked={!isDay}
      aria-label={isDay ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
      title={isDay ? 'Modo noche' : 'Modo día'}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
    >
      <span className="theme-toggle__opt" data-active={isDay}>
        <Sun aria-hidden />
        {!compact && <span>Día</span>}
      </span>
      <span className="theme-toggle__opt" data-active={!isDay}>
        <Moon aria-hidden />
        {!compact && <span>Noche</span>}
      </span>
      <span className="theme-toggle__thumb" aria-hidden />
    </button>
  );
}

export function Logo({ height = 44 }: { height?: number }) {
  return (
    <img
      src="/logo-avolar.webp"
      alt="AVOLAR Smoke Shop"
      width={Math.round((height * 1027) / 404)}
      height={height}
      className="logo-img"
      style={{ height, width: 'auto' }}
      decoding="async"
    />
  );
}
