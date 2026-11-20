import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarSearch, MessageCircle, Search } from 'lucide-react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { Button, Empty, ErrorState, Modal, Skeleton, StatusBadge, TextArea, TextInput, btnClass } from '../../components/ui';
import { ApiError, api, qs } from '../../lib/api';
import { dateTime, duration, money, STATUS_LABEL } from '../../lib/format';
import { useAuth } from '../../hooks/auth';
import { useToast } from '../../hooks/toast';
import type { GameConsole, Pagination } from '../../lib/types';

interface Row {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  console: { id: string; name: string; platform: string };
  dateLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalAmount: number;
  depositAmount: number;
  amountPaid: number;
  currency: string;
  status: string;
  statusLabel: string;
}

export function ReservationsList() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const f = {
    q: params.get('q') ?? '',
    status: params.get('status') ?? '',
    consoleId: params.get('consoleId') ?? '',
    date: params.get('date') ?? '',
    page: Number(params.get('page') ?? 1),
  };
  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k));
    if (!('page' in patch)) n.delete('page');
    setParams(n, { replace: true });
  };
  useEffect(() => {
    const t = setTimeout(() => search.trim() !== f.q && set({ q: search.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const consoles = useQuery({
    queryKey: ['admin-consoles-min'],
    queryFn: () => api.get<{ consoles: GameConsole[] }>('/admin/consoles').then((r) => r.consoles),
    retry: false,
  });
  const q = useQuery({
    queryKey: ['admin-reservations', f],
    queryFn: () => api.get<{ reservations: Row[]; pagination: Pagination }>(`/admin/reservations${qs({ ...f, pageSize: 25 })}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageTitle title="Reservas" sub="Busca, filtra y gestiona el estado de cada reserva." />
      <div className="filterbar">
        <label className="field">
          <span className="field__label">Buscar</span>
          <span style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--ink-faint)' }} aria-hidden />
            <input className="input" style={{ paddingLeft: 38 }} placeholder="Nombre, teléfono o código" value={search} onChange={(e) => setSearch(e.target.value)} />
          </span>
        </label>
        <label className="field">
          <span className="field__label">Fecha</span>
          <input type="date" className="input" value={f.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">Consola</span>
          <select className="select" value={f.consoleId} onChange={(e) => set({ consoleId: e.target.value })}>
            <option value="">Todas</option>
            {consoles.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Estado</span>
          <select className="select" value={f.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="ghost"
          disabled={!f.q && !f.status && !f.consoleId && !f.date}
          onClick={() => {
            setSearch('');
            setParams({}, { replace: true });
          }}
        >
          Limpiar
        </Button>
      </div>

      {q.isLoading ? (
        <Skeleton h={400} r={16} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.reservations.length ? (
        <Empty icon={<CalendarSearch />} title="No hay reservas">
          {f.q || f.status || f.date || f.consoleId ? 'Ninguna reserva coincide con los filtros.' : 'Las reservas que hagan los clientes aparecerán aquí.'}
        </Empty>
      ) : (
        <>
          <div className="table-wrap desktop-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cliente</th>
                  <th>Consola</th>
                  <th>Fecha y hora</th>
                  <th className="num">Total</th>
                  <th className="num">Pagado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {q.data.reservations.map((r) => (
                  <tr key={r.id} className="is-link" onClick={() => nav(`/admin/reservas/${r.id}`)}>
                    <td>
                      <Link to={`/admin/reservas/${r.id}`} className="mono strong" onClick={(e) => e.stopPropagation()}>
                        {r.code}
                      </Link>
                    </td>
                    <td>
                      <div className="strong">{r.customerName}</div>
                      <div className="tiny muted">{r.customerPhone}</div>
                    </td>
                    <td>{r.console.name}</td>
                    <td>
                      <div className="cap">{r.dateLabel.replace(/ de \d{4}$/, '')}</div>
                      <div className="tiny muted">
                        {r.startTime}–{r.endTime} · {duration(r.durationMinutes)}
                      </div>
                    </td>
                    <td className="num">{money(r.totalAmount, r.currency)}</td>
                    <td className="num">{money(r.amountPaid, r.currency)}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-cards">
            {q.data.reservations.map((r) => (
              <Link key={r.id} to={`/admin/reservas/${r.id}`} className="card mcard">
                <div className="spread">
                  <span className="mono strong">{r.code}</span>
                  <StatusBadge status={r.status} />
                </div>
                <strong>{r.customerName}</strong>
                <span className="small muted cap">
                  {r.console.name} · {r.dateLabel.replace(/ de \d{4}$/, '')} · {r.startTime}–{r.endTime}
                </span>
                <span className="small">{money(r.totalAmount, r.currency)}</span>
              </Link>
            ))}
          </div>
          <div className="pagination">
            <span>{q.data.pagination.total} reservas</span>
            <div className="row">
              <Button size="sm" disabled={f.page <= 1} onClick={() => set({ page: String(f.page - 1) })}>
                Anterior
              </Button>
              <span>
                {f.page} / {q.data.pagination.totalPages}
              </span>
              <Button size="sm" disabled={f.page >= q.data.pagination.totalPages} onClick={() => set({ page: String(f.page + 1) })}>
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

interface Detail extends Row {
  customerNotes: string | null;
  adminNotes: string | null;
  pricePerHour: number;
  depositPercent: number;
  allowedTransitions: { status: string; label: string }[];
  holdExpiresAt: string | null;
  paymentSentAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  contactCustomerUrl: string | null;
  history: {
    id: string;
    fromLabel: string | null;
    toStatus: string;
    toLabel: string;
    actor: string;
    changedBy: { fullName: string } | null;
    note: string | null;
    createdAt: string;
  }[];
}

const ACTION_COPY: Record<string, { title: string; cta: string; variant: 'primary' | 'danger' | 'default' }> = {
  CONFIRMED: { title: 'Confirmar pago y reserva', cta: 'Confirmar', variant: 'primary' },
  PAYMENT_REVIEW: { title: 'Marcar pago por verificar', cta: 'Marcar', variant: 'default' },
  PENDING_PAYMENT: { title: 'Volver a pendiente de pago', cta: 'Cambiar', variant: 'default' },
  FINISHED: { title: 'Marcar como finalizada', cta: 'Finalizar', variant: 'primary' },
  CANCELLED: { title: 'Cancelar reserva', cta: 'Cancelar reserva', variant: 'danger' },
};

export function ReservationDetail() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['admin-reservation', id], queryFn: () => api.get<{ reservation: Detail }>(`/admin/reservations/${id}`).then((r) => r.reservation) });
  const [action, setAction] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: (body: { status: string; note?: string; amountPaid?: number | null }) =>
      api.patch<{ reservation: Detail }>(`/admin/reservations/${id}/status`, body),
    onSuccess: (r) => {
      qc.setQueryData(['admin-reservation', id], r.reservation);
      qc.invalidateQueries({ queryKey: ['admin-reservations'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      toast.ok(`Reserva: ${r.reservation.statusLabel}`);
      setAction(null);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo actualizar.'),
  });
  const saveNotes = useMutation({
    mutationFn: (adminNotes: string) => api.patch<{ reservation: Detail }>(`/admin/reservations/${id}`, { adminNotes }),
    onSuccess: (r) => {
      qc.setQueryData(['admin-reservation', id], r.reservation);
      setNotes(null);
      toast.ok('Notas guardadas');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar.'),
  });

  if (q.isLoading) return <Skeleton h={500} r={16} />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const r = q.data;
  const manage = can('reservations.manage');

  const open = (s: string) => {
    setAction(s);
    setNote('');
    setAmount(s === 'CONFIRMED' ? String(r.amountPaid || r.depositAmount) : s === 'FINISHED' ? String(r.totalAmount) : '');
  };

  return (
    <>
      <Link to="/admin/reservas" className={btnClass('ghost', 'sm')} style={{ marginBottom: 10 }}>
        <ArrowLeft aria-hidden /> Reservas
      </Link>
      <PageTitle
        title={`Reserva ${r.code}`}
        sub={`Creada el ${dateTime(r.createdAt)}`}
        actions={<StatusBadge status={r.status} label={r.statusLabel} />}
      />
      <div className="detail-grid">
        <div className="stack">
          <section className="card panel">
            <h2 className="panel__title">Detalles</h2>
            <dl className="kv">
              <div>
                <dt>Cliente</dt>
                <dd>{r.customerName}</dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>
                  <a className="link" href={`tel:${r.customerPhone}`}>
                    {r.customerPhone}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Consola</dt>
                <dd>
                  {r.console.name} <span className="muted">· {r.console.platform}</span>
                </dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd className="cap">{r.dateLabel}</dd>
              </div>
              <div>
                <dt>Horario</dt>
                <dd>
                  {r.startTime} – {r.endTime} ({duration(r.durationMinutes)})
                </dd>
              </div>
              <div>
                <dt>Precio por hora</dt>
                <dd>{money(r.pricePerHour, r.currency)}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{money(r.totalAmount, r.currency)}</dd>
              </div>
              <div>
                <dt>Anticipo ({r.depositPercent} %)</dt>
                <dd>{money(r.depositAmount, r.currency)}</dd>
              </div>
              <div>
                <dt>Pagado</dt>
                <dd style={{ color: r.amountPaid > 0 ? 'var(--ok)' : undefined }}>{money(r.amountPaid, r.currency)}</dd>
              </div>
              {r.holdExpiresAt && (
                <div>
                  <dt>Plazo de pago</dt>
                  <dd>{dateTime(r.holdExpiresAt)}</dd>
                </div>
              )}
              {r.paymentSentAt && (
                <div>
                  <dt>Aviso de comprobante</dt>
                  <dd>{dateTime(r.paymentSentAt)}</dd>
                </div>
              )}
            </dl>
            {r.customerNotes && (
              <div className="instructions">
                <strong>Comentario del cliente:</strong> {r.customerNotes}
              </div>
            )}
            {r.contactCustomerUrl && (
              <div>
                <a href={r.contactCustomerUrl} target="_blank" rel="noopener noreferrer" className={btnClass('whatsapp', 'sm')}>
                  <MessageCircle aria-hidden /> Escribir al cliente
                </a>
              </div>
            )}
          </section>

          <section className="card panel">
            <div className="spread">
              <h2 className="panel__title">Notas internas</h2>
              {manage && notes === null && (
                <Button size="sm" onClick={() => setNotes(r.adminNotes ?? '')}>
                  Editar
                </Button>
              )}
            </div>
            {notes !== null ? (
              <>
                <TextArea label="Notas (solo visibles para el equipo)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} />
                <div className="row">
                  <Button variant="primary" size="sm" loading={saveNotes.isPending} onClick={() => saveNotes.mutate(notes)}>
                    Guardar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setNotes(null)}>
                    Descartar
                  </Button>
                </div>
              </>
            ) : (
              <p className={r.adminNotes ? '' : 'muted small'} style={{ whiteSpace: 'pre-line' }}>
                {r.adminNotes || 'Sin notas.'}
              </p>
            )}
          </section>
        </div>

        <div className="stack">
          {manage && (
            <section className="card panel">
              <h2 className="panel__title">Acciones</h2>
              {r.allowedTransitions.length ? (
                <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
                  {r.allowedTransitions.map((t) => (
                    <Button key={t.status} block variant={ACTION_COPY[t.status]?.variant ?? 'default'} onClick={() => open(t.status)}>
                      {ACTION_COPY[t.status]?.title ?? t.label}
                    </Button>
                  ))}
                  {r.status === 'CONFIRMED' && (
                    <Button block variant="ghost" onClick={() => open('CONFIRMED_PAY')}>
                      Registrar pago adicional
                    </Button>
                  )}
                </div>
              ) : (
                <p className="small muted">Esta reserva está {r.statusLabel.toLowerCase()} y ya no admite cambios de estado.</p>
              )}
            </section>
          )}
          <section className="card panel">
            <h2 className="panel__title">Historial</h2>
            <ol className="timeline-v">
              {r.history.map((h) => (
                <li key={h.id}>
                  <div className="strong">{h.fromLabel ? `${h.fromLabel} → ${h.toLabel}` : h.toLabel}</div>
                  <div className="tiny muted">
                    {dateTime(h.createdAt)} · {h.changedBy?.fullName ?? (h.actor === 'customer' ? 'Cliente' : h.actor === 'system' ? 'Sistema' : 'Admin')}
                  </div>
                  {h.note && <div className="small">{h.note}</div>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {action && (
        <Modal
          title={action === 'CONFIRMED_PAY' ? 'Registrar pago' : ACTION_COPY[action]?.title ?? 'Cambiar estado'}
          onClose={() => setAction(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setAction(null)}>
                Volver
              </Button>
              <Button
                variant={action === 'CONFIRMED_PAY' ? 'primary' : ACTION_COPY[action]?.variant}
                loading={change.isPending}
                onClick={() =>
                  change.mutate({
                    status: action === 'CONFIRMED_PAY' ? 'CONFIRMED' : action,
                    note: note || undefined,
                    amountPaid: amount === '' ? null : Number(amount),
                  })
                }
              >
                {action === 'CONFIRMED_PAY' ? 'Guardar pago' : ACTION_COPY[action]?.cta ?? 'Guardar'}
              </Button>
            </>
          }
        >
          {action === 'CONFIRMED' && <p className="small">Confirma solo después de verificar el comprobante del anticipo.</p>}
          {action === 'CANCELLED' && <p className="small">El horario quedará libre para otros clientes. Esta acción no se puede deshacer.</p>}
          {(action === 'CONFIRMED' || action === 'FINISHED' || action === 'CONFIRMED_PAY') && (
            <TextInput
              label={`Monto pagado total (${r.currency})`}
              type="number"
              inputMode="decimal"
              min={0}
              max={r.totalAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              hint={`Anticipo: ${money(r.depositAmount, r.currency)} · Total: ${money(r.totalAmount, r.currency)}`}
            />
          )}
          <TextArea label="Nota (opcional)" rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: comprobante verificado por Nequi" />
        </Modal>
      )}
    </>
  );
}
