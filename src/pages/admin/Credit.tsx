import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Ban, HandCoins, MessageCircle, Pencil, Search, ShoppingBag, Users } from 'lucide-react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { Button, Empty, ErrorState, Modal, Skeleton, TextArea, TextInput } from '../../components/ui';
import { BalanceBadge, PaymentModal, useInvalidateCredit } from '../../components/admin/Credit';
import { ApiError, api, qs } from '../../lib/api';
import { dateTime, money } from '../../lib/format';
import type { ShopCustomer } from '../../lib/pos';
import { useSettings } from '../../hooks/data';
import { useAuth } from '../../hooks/auth';
import { useToast } from '../../hooks/toast';
import type { Pagination } from '../../lib/types';

interface Movement {
  kind: 'sale' | 'payment';
  id: string;
  number: number;
  amount: number;
  status: 'COMPLETED' | 'VOIDED';
  by: string;
  detail: string | null;
  methodLabel?: string;
  saleNumber?: number | null;
  voidReason: string | null;
  createdAt: string;
}

/** Enlace de WhatsApp para recordarle la deuda (solo números de Colombia de 10 dígitos o con indicativo). */
function waLink(c: ShopCustomer, currency: string, store: string) {
  const digits = (c.phone ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const to = digits.length === 10 ? `57${digits}` : digits;
  const text = `Hola ${c.name.split(' ')[0]}, te escribimos de ${store}. Tienes un saldo pendiente de ${money(c.balance, currency)}. ¡Gracias!`;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

export default function CreditPage({ embedded = false }: { embedded?: boolean }) {
  const { data: s } = useSettings();
  const currency = s?.currency ?? 'COP';
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'debt' | 'all'>('debt');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [paying, setPaying] = useState<ShopCustomer | null | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = useQuery({
    queryKey: ['shop-customers', q, status, page],
    queryFn: () =>
      api.get<{ customers: ShopCustomer[]; totals: { receivable: number; debtors: number }; pagination: Pagination }>(
        `/admin/pos/customers${qs({ q, status, page })}`,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  if (list.isLoading) return <Skeleton h={400} r={16} />;
  if (list.isError || !list.data) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  const d = list.data;

  return (
    <>
      {embedded ? (
        <div className="spread" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <p className="small muted" style={{ margin: 0 }}>
            Quién le debe a la tienda, cuánto ha abonado y su historial.
          </p>
          <Button variant="primary" icon={<HandCoins aria-hidden />} onClick={() => setPaying(null)}>
            Recibir abono
          </Button>
        </div>
      ) : (
        <PageTitle
          title="Fiados"
          sub="Quién le debe a la tienda, cuánto ha abonado y su historial."
          actions={
            <Button variant="primary" icon={<HandCoins aria-hidden />} onClick={() => setPaying(null)}>
              Recibir abono
            </Button>
          }
        />
      )}

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="card stat stat--accent">
          <span className="stat__label">
            <HandCoins aria-hidden /> Por cobrar
          </span>
          <span className="stat__value">{money(d.totals.receivable, currency)}</span>
          <span className="stat__hint">
            {d.totals.debtors} cliente{d.totals.debtors === 1 ? '' : 's'} con deuda
          </span>
        </div>
      </div>

      <div className="filterbar credit-filters">
        <label className="field">
          <span className="field__label">Buscar</span>
          <span style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--ink-faint)' }} aria-hidden />
            <input className="input" style={{ paddingLeft: 38 }} placeholder="Nombre o celular…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </span>
        </label>
        <div className="row" role="group" aria-label="Mostrar" style={{ alignSelf: 'end' }}>
          <button type="button" className="chip" aria-pressed={status === 'debt'} onClick={() => (setStatus('debt'), setPage(1))}>
            Con deuda
          </button>
          <button type="button" className="chip" aria-pressed={status === 'all'} onClick={() => (setStatus('all'), setPage(1))}>
            Todos los clientes
          </button>
        </div>
      </div>

      {!d.customers.length ? (
        <Empty icon={<Users />} title={status === 'debt' && !q ? 'Nadie debe nada' : 'Sin resultados'}>
          {status === 'debt' && !q ? 'Cuando fíes en la Caja (medio de pago "Fiado"), el cliente aparecerá aquí.' : 'Prueba con otro nombre o muestra todos los clientes.'}
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="num">Fiado</th>
                <th className="num">Abonado</th>
                <th className="num">Saldo</th>
                <th>Último abono</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {d.customers.map((c) => (
                <tr key={c.id} className="is-link" onClick={() => setOpen(c.id)}>
                  <td>
                    <strong>{c.name}</strong>
                    <div className="tiny muted">{c.phone ?? 'Sin teléfono'}</div>
                  </td>
                  <td className="num">{money(c.owed, currency)}</td>
                  <td className="num">{money(c.paid, currency)}</td>
                  <td className="num">
                    <BalanceBadge balance={c.balance} currency={currency} />
                  </td>
                  <td className="small">{c.lastPaymentAt ? dateTime(c.lastPaymentAt) : <span className="muted">—</span>}</td>
                  <td className="num">
                    {c.balance > 0 && (
                      <Button
                        size="sm"
                        icon={<HandCoins aria-hidden />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPaying(c);
                        }}
                      >
                        Abonar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {d.pagination.totalPages > 1 && (
        <div className="pagination">
          <span>{d.pagination.total} clientes</span>
          <div className="row">
            <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <span>
              {page} / {d.pagination.totalPages}
            </span>
            <Button size="sm" disabled={page >= d.pagination.totalPages} onClick={() => setPage(page + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {open && <CustomerModal id={open} currency={currency} store={s?.businessName ?? 'AVOLAR'} onClose={() => setOpen(null)} onPay={(c) => setPaying(c)} />}
      {paying !== undefined && <PaymentModal customer={paying} currency={currency} onClose={() => setPaying(undefined)} />}
    </>
  );
}

/** Estado de cuenta de un cliente: fiados y abonos, editar datos y anular abonos. */
function CustomerModal({
  id,
  currency,
  store,
  onClose,
  onPay,
}: {
  id: string;
  currency: string;
  store: string;
  onClose: () => void;
  onPay: (c: ShopCustomer) => void;
}) {
  const { can } = useAuth();
  const toast = useToast();
  const invalidate = useInvalidateCredit();
  const q = useQuery({
    queryKey: ['shop-customer', id],
    queryFn: () => api.get<{ customer: ShopCustomer; movements: Movement[] }>(`/admin/pos/customers/${id}`),
  });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [voiding, setVoiding] = useState<Movement | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const c = q.data?.customer;

  async function save() {
    setBusy(true);
    setErrors({});
    try {
      await api.put(`/admin/pos/customers/${id}`, { name: form.name, phone: form.phone || null, notes: form.notes || null });
      toast.ok('Cliente actualizado');
      setEditing(false);
      invalidate();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) setErrors(e.fields);
      else toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  async function voidPayment() {
    if (!voiding) return;
    setBusy(true);
    try {
      await api.post(`/admin/pos/payments/${voiding.id}/void`, { reason });
      toast.ok('Abono anulado; la deuda se ajustó');
      setVoiding(null);
      setReason('');
      invalidate();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.fields.reason ?? e.message : 'No se pudo anular.');
    } finally {
      setBusy(false);
    }
  }

  const wa = c ? waLink(c, currency, store) : null;

  return (
    <Modal
      wide
      title={c ? c.name : 'Cliente'}
      onClose={onClose}
      footer={
        c &&
        (editing ? (
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button variant="primary" loading={busy} onClick={save}>
              Guardar
            </Button>
          </>
        ) : voiding ? (
          <>
            <Button variant="ghost" onClick={() => setVoiding(null)}>
              Volver
            </Button>
            <Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={voidPayment}>
              Anular abono #{voiding.number}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              icon={<Pencil aria-hidden />}
              onClick={() => {
                setForm({ name: c.name, phone: c.phone ?? '', notes: c.notes ?? '' });
                setEditing(true);
              }}
            >
              Editar datos
            </Button>
            {wa && c.balance > 0 && (
              <a className="btn btn--ghost" href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden /> Recordar por WhatsApp
              </a>
            )}
            {c.balance > 0 && (
              <Button
                variant="primary"
                icon={<HandCoins aria-hidden />}
                onClick={() => {
                  onClose();
                  onPay(c);
                }}
              >
                Recibir abono
              </Button>
            )}
          </>
        ))
      }
    >
      {q.isLoading || !c ? (
        q.isError ? <ErrorState error={q.error} /> : <Skeleton h={200} />
      ) : editing ? (
        <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
          <TextInput label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} maxLength={120} />
          <TextInput label="Celular (opcional)" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} maxLength={20} />
          <TextArea label="Notas (opcional)" rows={2} maxLength={300} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      ) : (
        <>
          <dl className="kv">
            <div>
              <dt>Saldo</dt>
              <dd>
                <BalanceBadge balance={c.balance} currency={currency} />
              </dd>
            </div>
            <div>
              <dt>Total fiado</dt>
              <dd>{money(c.owed, currency)}</dd>
            </div>
            <div>
              <dt>Total abonado</dt>
              <dd>{money(c.paid, currency)}</dd>
            </div>
            <div>
              <dt>Celular</dt>
              <dd>{c.phone ?? '—'}</dd>
            </div>
          </dl>
          {c.notes && <p className="small muted">Nota: {c.notes}</p>}

          {voiding && (
            <TextArea
              label={`Motivo para anular el abono #${voiding.number} de ${money(voiding.amount, currency)}`}
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              hint="La deuda vuelve a subir en ese valor y queda en el registro de actividad."
              autoFocus
            />
          )}

          <h3 className="panel__title" style={{ marginTop: 8 }}>
            Historial
          </h3>
          {!q.data!.movements.length ? (
            <p className="small muted">Sin movimientos.</p>
          ) : (
            <ol className="activity">
              {q.data!.movements.map((m) => (
                <li key={`${m.kind}-${m.id}`} className="activity__item" style={m.status === 'VOIDED' ? { opacity: 0.55 } : undefined}>
                  <time className="activity__time tiny" dateTime={m.createdAt}>
                    {dateTime(m.createdAt)}
                  </time>
                  <div className="activity__body">
                    <div className="spread">
                      <span className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
                        {m.kind === 'sale' ? (
                          <span className="badge badge--warn badge--plain">
                            <ShoppingBag size={12} aria-hidden /> Fiado · venta #{m.number}
                          </span>
                        ) : (
                          <span className="badge badge--ok badge--plain">
                            <HandCoins size={12} aria-hidden /> Abono #{m.number} · {m.methodLabel}
                          </span>
                        )}
                        {m.status === 'VOIDED' && <span className="badge badge--danger badge--plain">Anulado</span>}
                      </span>
                      <strong className="num">
                        {m.kind === 'sale' ? '+' : '−'}
                        {money(m.amount, currency)}
                      </strong>
                    </div>
                    {m.detail && <p className="activity__summary small">{m.detail}</p>}
                    <span className="tiny muted">
                      {m.kind === 'sale' ? 'Vendió' : 'Recibió'} {m.by}
                      {m.voidReason ? ` · Anulado: ${m.voidReason}` : ''}
                    </span>
                    {m.kind === 'payment' && m.status === 'COMPLETED' && !m.saleNumber && can('pos.reports') && !voiding && (
                      <div>
                        <Button size="sm" variant="ghost" icon={<Ban aria-hidden />} onClick={() => setVoiding(m)}>
                          Anular abono
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Modal>
  );
}
