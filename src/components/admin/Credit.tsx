/** Fiados de la tienda: elegir o registrar al cliente y recibir abonos. Lo usan la Caja y la página Fiados. */
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, HandCoins, Search, UserPlus, Wallet } from 'lucide-react';
import { Button, Modal, TextArea, TextInput } from '../ui';
import { ApiError, api, qs } from '../../lib/api';
import { money } from '../../lib/format';
import { MONEY_LABELS, type MoneyMethod, type ShopCustomer } from '../../lib/pos';
import { useToast } from '../../hooks/toast';

/** Refresca todo lo que depende de saldos de fiado. */
export function useInvalidateCredit() {
  const qc = useQueryClient();
  return () => ['shop-customers', 'shop-customer', 'pos-customers', 'pos-session', 'shop-report', 'shop-sales'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function BalanceBadge({ balance, currency }: { balance: number; currency: string }) {
  if (balance > 0) return <span className="badge badge--warn badge--plain">Debe {money(balance, currency)}</span>;
  if (balance < 0) return <span className="badge badge--info badge--plain">A favor {money(-balance, currency)}</span>;
  return <span className="badge badge--ok badge--plain">Al día</span>;
}

/** Método de pago del dinero que entra (efectivo / Nequi / transferencia). */
export function MoneyMethodPicker({ value, onChange, label = 'Cómo paga' }: { value: MoneyMethod; onChange: (m: MoneyMethod) => void; label?: string }) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="row" style={{ '--gap': '6px' } as React.CSSProperties} role="radiogroup" aria-label={label}>
        {(Object.keys(MONEY_LABELS) as MoneyMethod[]).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={value === m} className="chip" onClick={() => onChange(m)}>
            {m === 'CASH' ? <Banknote size={16} aria-hidden /> : <Wallet size={16} aria-hidden />}
            {MONEY_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Buscar un cliente por nombre o teléfono, o registrarlo en el momento.
 * `onlyDebt` limita la lista a quienes deben (para recibir abonos).
 */
export function CustomerPicker({
  value,
  onChange,
  currency,
  onlyDebt = false,
}: {
  value: ShopCustomer | null;
  onChange: (c: ShopCustomer | null) => void;
  currency: string;
  onlyDebt?: boolean;
}) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: ['pos-customers', q.trim(), onlyDebt],
    enabled: !value && !creating,
    queryFn: () =>
      api
        .get<{ customers: ShopCustomer[] }>(`/admin/pos/customers${qs({ q: q.trim(), status: onlyDebt ? 'debt' : 'all', pageSize: 6 })}`)
        .then((r) => r.customers),
    staleTime: 5_000,
  });

  async function create(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const r = await api.post<{ customer: ShopCustomer }>('/admin/pos/customers', { name, phone: phone || null });
      onChange(r.customer);
      setCreating(false);
      setQ('');
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      else toast.error(err instanceof ApiError ? err.message : 'No se pudo registrar el cliente.');
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <div className="credit-customer">
        <div>
          <strong>{value.name}</strong>
          <div className="tiny muted">{value.phone ?? 'Sin teléfono'}</div>
        </div>
        <BalanceBadge balance={value.balance} currency={currency} />
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          Cambiar
        </Button>
      </div>
    );
  }

  if (creating) {
    return (
      <div className="stack credit-new" style={{ '--gap': '10px' } as React.CSSProperties}>
        <TextInput label="Nombre del cliente" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={120} autoFocus />
        <TextInput
          label="Celular (opcional)"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
          hint="Sirve para cobrarle por WhatsApp."
          maxLength={20}
        />
        <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
          <Button variant="ghost" onClick={() => setCreating(false)}>
            Volver
          </Button>
          <Button variant="primary" loading={busy} disabled={name.trim().length < 2} onClick={() => create()} icon={<UserPlus aria-hidden />}>
            Registrar cliente
          </Button>
        </div>
      </div>
    );
  }

  const rows = list.data ?? [];
  return (
    <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
      <label className="field">
        <span className="field__label">{onlyDebt ? '¿Quién abona?' : '¿A quién se le fía?'}</span>
        <span style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--ink-faint)' }} aria-hidden />
          <input className="input" style={{ paddingLeft: 38 }} placeholder="Nombre o celular…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </span>
      </label>
      {rows.length > 0 && (
        <ul className="pos-results" role="listbox" aria-label="Clientes">
          {rows.map((c) => (
            <li key={c.id}>
              <button type="button" role="option" aria-selected={false} onClick={() => onChange(c)}>
                <span className="stack" style={{ '--gap': '0' } as React.CSSProperties}>
                  <strong>{c.name}</strong>
                  <span className="tiny muted">{c.phone ?? 'Sin teléfono'}</span>
                </span>
                <BalanceBadge balance={c.balance} currency={currency} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!list.isLoading && !rows.length && (
        <p className="tiny muted">{onlyDebt ? (q.trim() ? 'Nadie con deuda con ese nombre.' : 'Nadie debe nada. 🎉') : 'Sin coincidencias.'}</p>
      )}
      {!onlyDebt && (
        <Button
          size="sm"
          icon={<UserPlus aria-hidden />}
          onClick={() => {
            // Si escribió un número, se usa como celular; si no, como nombre.
            const isPhone = /^\+?[0-9 ]{7,20}$/.test(q.trim());
            setName(isPhone ? '' : q.trim());
            setPhone(isPhone ? q.trim() : '');
            setCreating(true);
          }}
        >
          Nuevo cliente{q.trim() && !/^\+?[0-9 ]+$/.test(q.trim()) ? ` «${q.trim()}»` : ''}
        </Button>
      )}
    </div>
  );
}

/** Recibir un abono. Si no se pasa el cliente, primero se elige entre quienes deben. */
export function PaymentModal({
  customer: initial,
  currency,
  onClose,
}: {
  customer?: ShopCustomer | null;
  currency: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const invalidate = useInvalidateCredit();
  const [customer, setCustomer] = useState<ShopCustomer | null>(initial ?? null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<MoneyMethod>('CASH');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<{ amount: number; balance: number; methodLabel: string } | null>(null);

  const value = Number(amount || 0);
  const tooHigh = customer != null && value > customer.balance;

  async function submit() {
    if (!customer || value <= 0 || tooHigh) return;
    setBusy(true);
    setError(undefined);
    try {
      const r = await api.post<{ balance: number; payment: { amount: number; methodLabel: string } }>(`/admin/pos/customers/${customer.id}/payments`, {
        amount: value,
        method,
        note: note.trim() || null,
      });
      setDone({ amount: r.payment.amount, balance: r.balance, methodLabel: r.payment.methodLabel });
      invalidate();
    } catch (e) {
      const msg = e instanceof ApiError ? e.fields.amount ?? e.message : 'No se pudo registrar el abono.';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (done && customer) {
    return (
      <Modal title="Abono registrado" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Listo</Button>}>
        <div className="pos-total" style={{ textAlign: 'center' }}>
          <span className="small muted">
            {customer.name} abonó · {done.methodLabel}
          </span>
          <strong>{money(done.amount, currency)}</strong>
        </div>
        <div className={`alert ${done.balance > 0 ? 'alert--warn' : 'alert--ok'}`}>
          {done.balance > 0 ? `Todavía debe ${money(done.balance, currency)}.` : `${customer.name} quedó a paz y salvo.`}
        </div>
      </Modal>
    );
  }

  const quick = customer ? [customer.balance, Math.round(customer.balance / 2 / 1000) * 1000].filter((v, i, a) => v > 0 && a.indexOf(v) === i) : [];

  return (
    <Modal
      title="Recibir abono"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} disabled={!customer || value <= 0 || tooHigh} onClick={submit} icon={<HandCoins aria-hidden />}>
            Registrar abono {value > 0 ? money(value, currency) : ''}
          </Button>
        </>
      }
    >
      <CustomerPicker value={customer} onChange={setCustomer} currency={currency} onlyDebt />
      {customer && (
        <>
          <TextInput
            label="¿Cuánto abona?"
            type="number"
            inputMode="numeric"
            min={1}
            max={customer.balance}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={tooHigh ? `Debe ${money(customer.balance, currency)}; no puede abonar más.` : error}
            autoFocus
          />
          {quick.length > 0 && (
            <div className="row" style={{ '--gap': '6px' } as React.CSSProperties}>
              {quick.map((v, i) => (
                <button key={v} type="button" className="chip" onClick={() => setAmount(String(v))}>
                  {i === 0 ? `Todo (${money(v, currency)})` : `Mitad (${money(v, currency)})`}
                </button>
              ))}
            </div>
          )}
          <MoneyMethodPicker value={method} onChange={setMethod} />
          {method !== 'CASH' && <p className="tiny muted">Verifica el pago en el celular de la tienda antes de registrarlo.</p>}
          <TextArea label="Nota (opcional)" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: pagó con la quincena" />
          {value > 0 && !tooHigh && (
            <p className="small">
              Después del abono debe <strong>{money(customer.balance - value, currency)}</strong>.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
