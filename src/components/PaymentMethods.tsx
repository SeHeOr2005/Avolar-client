import { Copy, Wallet } from 'lucide-react';
import { useToast } from '../hooks/toast';
import type { PaymentMethod } from '../lib/types';

/** Medios de pago del anticipo, en el orden configurado en el panel. */
export function PaymentMethods({ methods, compact }: { methods: PaymentMethod[]; compact?: boolean }) {
  const toast = useToast();
  if (!methods.length) return null;

  const copy = async (m: PaymentMethod) => {
    try {
      await navigator.clipboard.writeText(m.accountNumber.replace(/\s+/g, ''));
      toast.ok(`Número de ${m.name} copiado`);
    } catch {
      toast.error(`No se pudo copiar. El número es ${m.accountNumber}`);
    }
  };

  return (
    <ul className={`paymethods ${compact ? 'paymethods--compact' : ''}`}>
      {methods.map((m, i) => (
        <li key={m.id} className="paymethod">
          <span className="paymethod__icon" aria-hidden>
            <Wallet />
          </span>
          <div className="paymethod__body">
            <div className="paymethod__name">
              {m.name}
              {i === 0 && methods.length > 1 && <span className="badge badge--ok badge--plain">Recomendado</span>}
            </div>
            <div className="paymethod__number mono">{m.accountNumber}</div>
            {(m.accountType || m.accountHolder) && (
              <div className="tiny muted">{[m.accountType, m.accountHolder && `A nombre de ${m.accountHolder}`].filter(Boolean).join(' · ')}</div>
            )}
            {m.details && !compact && <div className="tiny muted">{m.details}</div>}
          </div>
          <button type="button" className="btn btn--sm" onClick={() => copy(m)} aria-label={`Copiar número de ${m.name}`}>
            <Copy aria-hidden /> {!compact && 'Copiar'}
          </button>
        </li>
      ))}
    </ul>
  );
}
