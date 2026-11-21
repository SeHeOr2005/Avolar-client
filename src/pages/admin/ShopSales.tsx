import { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Ban, Receipt, TrendingUp } from 'lucide-react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { Button, ErrorState, Modal, Skeleton, TextArea } from '../../components/ui';
import { ApiError, api, qs } from '../../lib/api';
import { dateTime, money, todayInZone } from '../../lib/format';
import type { SaleDetail } from '../../lib/pos';
import { useSettings } from '../../hooks/data';
import { useTheme } from '../../hooks/theme';
import { useToast } from '../../hooks/toast';
import type { Pagination } from '../../lib/types';

interface Report {
  range: { from: string; to: string };
  totals: { sales: number; voided: number; revenue: number; cost: number; profit: number; marginPct: number; averageTicket: number };
  byDay: { date: string; label: string; total: number; profit: number }[];
  byMethod: { method: string; label: string; count: number; total: number }[];
  bySeller: { seller: string; count: number; total: number }[];
  topProducts: { productId: string; name: string; quantity: number; revenue: number; profit: number }[];
  lowStock: { id: string; name: string; stock: number; minStock: number }[];
}
interface SaleRow {
  id: string;
  number: number;
  status: 'COMPLETED' | 'VOIDED';
  paymentLabel: string;
  total: number;
  profit: number;
  items: number;
  seller: string;
  createdAt: string;
}
interface SessionRow {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  openedBy: string;
  closedAt: string | null;
  closedBy: string | null;
  openingCash: number;
  expectedCash: number | null;
  countedCash: number | null;
  difference: number | null;
  notes: string | null;
}

export default function ShopSalesPage() {
  const { data: s } = useSettings();
  const { theme } = useTheme();
  const zone = s?.timezone ?? 'America/Bogota';
  const currency = s?.currency ?? 'COP';
  const today = todayInZone(zone);
  const presets = [
    { key: 'today', label: 'Hoy', from: today, to: today },
    { key: 'yesterday', label: 'Ayer', from: todayInZone(zone, -1), to: todayInZone(zone, -1) },
    { key: '7d', label: '7 días', from: todayInZone(zone, -6), to: today },
    { key: 'month', label: 'Este mes', from: `${today.slice(0, 8)}01`, to: today },
  ];
  const [range, setRange] = useState({ key: 'today', from: today, to: today });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<'sales' | 'sessions'>('sales');

  const report = useQuery({
    queryKey: ['shop-report', range.from, range.to],
    queryFn: () => api.get<Report>(`/admin/pos/reports${qs({ from: range.from, to: range.to })}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const sales = useQuery({
    queryKey: ['shop-sales', range.from, range.to, page],
    queryFn: () => api.get<{ sales: SaleRow[]; pagination: Pagination }>(`/admin/pos/sales${qs({ from: range.from, to: range.to, page })}`),
    placeholderData: keepPreviousData,
  });
  const sessions = useQuery({
    queryKey: ['shop-sessions'],
    enabled: tab === 'sessions',
    queryFn: () => api.get<{ sessions: SessionRow[] }>('/admin/pos/sessions').then((r) => r.sessions),
  });

  const axis = theme === 'day' ? '#6a4462' : '#b8a8d4';
  const grid = theme === 'day' ? 'rgba(42,14,44,.10)' : 'rgba(190,150,255,.12)';
  const bar = theme === 'day' ? '#e0115f' : '#a865ff';
  const r = report.data;
  const maxMethod = Math.max(1, ...(r?.byMethod.map((m) => m.total) ?? [1]));

  return (
    <>
      <PageTitle title="Ventas tienda" sub="Ventas, ganancias y arqueos de la caja de la tienda." />

      <div className="row" style={{ marginBottom: 16 }} role="group" aria-label="Periodo">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            className="chip"
            aria-pressed={range.key === p.key}
            onClick={() => {
              setRange({ key: p.key, from: p.from, to: p.to });
              setPage(1);
            }}
          >
            {p.label}
          </button>
        ))}
        <label className="row small" style={{ '--gap': '6px' } as React.CSSProperties}>
          <span className="sr-only">Desde</span>
          <input className="input" style={{ minHeight: 44, width: 'auto' }} type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && (setRange({ key: 'custom', from: e.target.value, to: range.to }), setPage(1))} />
          <span className="muted">a</span>
          <span className="sr-only">Hasta</span>
          <input className="input" style={{ minHeight: 44, width: 'auto' }} type="date" value={range.to} min={range.from} max={today} onChange={(e) => e.target.value && (setRange({ key: 'custom', from: range.from, to: e.target.value }), setPage(1))} />
        </label>
      </div>

      {report.isLoading ? (
        <Skeleton h={300} r={16} />
      ) : report.isError || !r ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : (
        <>
          <div className="stats">
            <div className="card stat stat--accent">
              <span className="stat__label">
                <Receipt aria-hidden /> Ventas
              </span>
              <span className="stat__value">{money(r.totals.revenue, currency)}</span>
              <span className="stat__hint">{r.totals.sales} venta(s)</span>
            </div>
            <div className="card stat">
              <span className="stat__label">
                <TrendingUp aria-hidden /> Ganancia
              </span>
              <span className="stat__value">{money(r.totals.profit, currency)}</span>
              <span className="stat__hint">Margen {r.totals.marginPct}%</span>
            </div>
            <div className="card stat">
              <span className="stat__label">Costo de lo vendido</span>
              <span className="stat__value">{money(r.totals.cost, currency)}</span>
            </div>
            <div className="card stat">
              <span className="stat__label">Ticket promedio</span>
              <span className="stat__value">{money(r.totals.averageTicket, currency)}</span>
              <span className="stat__hint">{r.totals.voided} anulada(s)</span>
            </div>
          </div>

          <div className="dash-grid">
            <section className="card panel" aria-labelledby="sales-by-day">
              <div className="spread">
                <h2 id="sales-by-day" className="panel__title">
                  Ventas por día
                </h2>
                <span className="tiny muted">Sin anuladas · {currency}</span>
              </div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={r.byDay} margin={{ top: 8, right: 4, left: 8, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid vertical={false} stroke={grid} />
                    <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => new Intl.NumberFormat('es-CO', { notation: 'compact' }).format(v)} />
                    <Tooltip
                      cursor={{ fill: grid }}
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="card" style={{ padding: '8px 12px', boxShadow: 'var(--shadow-sm)' }}>
                            <div className="tiny muted">{label}</div>
                            <strong>{money(Number(payload[0].value), currency)}</strong>
                            <div className="tiny muted">Ganancia {money((payload[0].payload as Report['byDay'][0]).profit, currency)}</div>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="total" fill={bar} radius={[4, 4, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <div className="stack">
              <section className="card panel">
                <h2 className="panel__title">Por medio de pago</h2>
                <ul className="list">
                  {r.byMethod.map((m) => (
                    <li key={m.method} style={{ display: 'grid', gap: 6 }}>
                      <div className="spread">
                        <span>
                          {m.label} <span className="tiny muted">({m.count})</span>
                        </span>
                        <strong className="num">{money(m.total, currency)}</strong>
                      </div>
                      <div className="bar" style={{ color: bar }}>
                        <span style={{ width: `${(m.total / maxMethod) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              {r.bySeller.length > 0 && (
                <section className="card panel">
                  <h2 className="panel__title">Por vendedor</h2>
                  <ul className="list">
                    {r.bySeller.map((v) => (
                      <li key={v.seller}>
                        <span>
                          {v.seller} <span className="tiny muted">({v.count})</span>
                        </span>
                        <strong className="num">{money(v.total, currency)}</strong>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>

          <div className="dash-grid">
            <section className="card panel">
              <h2 className="panel__title">Más vendidos</h2>
              {r.topProducts.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th className="num">Unidades</th>
                        <th className="num">Ventas</th>
                        <th className="num">Ganancia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.topProducts.map((t) => (
                        <tr key={t.productId}>
                          <td className="strong">{t.name}</td>
                          <td className="num">{t.quantity}</td>
                          <td className="num">{money(t.revenue, currency)}</td>
                          <td className="num">{money(t.profit, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="small muted">Sin ventas en este periodo.</p>
              )}
            </section>
            <section className="card panel">
              <h2 className="panel__title">Stock bajo</h2>
              {r.lowStock.length ? (
                <ul className="list">
                  {r.lowStock.map((p) => (
                    <li key={p.id}>
                      <span>{p.name}</span>
                      <span className={`badge ${p.stock === 0 ? 'badge--danger' : 'badge--warn'}`}>{p.stock === 0 ? 'Agotado' : `${p.stock} u.`}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">Todo por encima del mínimo.</p>
              )}
            </section>
          </div>
        </>
      )}

      <div className="row" style={{ margin: '28px 0 12px' }} role="tablist">
        <button type="button" role="tab" className="chip" aria-selected={tab === 'sales'} aria-pressed={tab === 'sales'} onClick={() => setTab('sales')}>
          Ventas del periodo
        </button>
        <button type="button" role="tab" className="chip" aria-selected={tab === 'sessions'} aria-pressed={tab === 'sessions'} onClick={() => setTab('sessions')}>
          Arqueos de caja
        </button>
      </div>

      {tab === 'sales' ? (
        sales.isLoading ? (
          <Skeleton h={200} r={16} />
        ) : !sales.data?.sales.length ? (
          <p className="small muted">No hay ventas en este periodo.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fecha</th>
                    <th>Vendedor</th>
                    <th>Pago</th>
                    <th className="num">Artículos</th>
                    <th className="num">Total</th>
                    <th className="num">Ganancia</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.data.sales.map((x) => (
                    <tr key={x.id} className="is-link" onClick={() => setOpen(x.id)} style={x.status === 'VOIDED' ? { opacity: 0.55 } : undefined}>
                      <td className="mono strong">{x.number}</td>
                      <td className="small">{dateTime(x.createdAt)}</td>
                      <td className="small">{x.seller}</td>
                      <td className="small">{x.paymentLabel}</td>
                      <td className="num">{x.items}</td>
                      <td className="num">{money(x.total, currency)}</td>
                      <td className="num">{money(x.profit, currency)}</td>
                      <td>{x.status === 'VOIDED' ? <span className="badge badge--danger">Anulada</span> : <span className="badge badge--ok">Completada</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sales.data.pagination.totalPages > 1 && (
              <div className="pagination">
                <span>{sales.data.pagination.total} ventas</span>
                <div className="row">
                  <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Anterior
                  </Button>
                  <span>
                    {page} / {sales.data.pagination.totalPages}
                  </span>
                  <Button size="sm" disabled={page >= sales.data.pagination.totalPages} onClick={() => setPage(page + 1)}>
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )
      ) : sessions.isLoading ? (
        <Skeleton h={200} r={16} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Apertura</th>
                <th>Cierre</th>
                <th className="num">Base</th>
                <th className="num">Esperado</th>
                <th className="num">Contado</th>
                <th className="num">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {sessions.data?.map((x) => (
                <tr key={x.id}>
                  <td className="small">
                    {dateTime(x.openedAt)}
                    <div className="tiny muted">{x.openedBy}</div>
                  </td>
                  <td className="small">
                    {x.closedAt ? dateTime(x.closedAt) : <span className="badge badge--info">Abierta</span>}
                    {x.closedBy && <div className="tiny muted">{x.closedBy}</div>}
                  </td>
                  <td className="num">{money(x.openingCash, currency)}</td>
                  <td className="num">{x.expectedCash != null ? money(x.expectedCash, currency) : '—'}</td>
                  <td className="num">{x.countedCash != null ? money(x.countedCash, currency) : '—'}</td>
                  <td className="num">
                    {x.difference == null ? (
                      '—'
                    ) : (
                      <span className={`badge badge--plain ${x.difference === 0 ? 'badge--ok' : 'badge--warn'}`} title={x.notes ?? undefined}>
                        {x.difference > 0 ? '+' : ''}
                        {money(x.difference, currency)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <SaleModal id={open} currency={currency} onClose={() => setOpen(null)} />}
    </>
  );
}

function SaleModal({ id, currency, onClose }: { id: string; currency: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['shop-sale', id], queryFn: () => api.get<{ sale: SaleDetail }>(`/admin/pos/sales/${id}`).then((r) => r.sale) });
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  async function doVoid() {
    setBusy(true);
    try {
      await api.post(`/admin/pos/sales/${id}/void`, { reason });
      toast.ok('Venta anulada y stock devuelto');
      ['shop-sale', 'shop-sales', 'shop-report', 'shop-products', 'pos-session'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.fields.reason ?? e.message : 'No se pudo anular.');
    } finally {
      setBusy(false);
    }
  }
  const s = q.data;
  return (
    <Modal
      wide
      title={s ? `Venta #${s.number}` : 'Venta'}
      onClose={onClose}
      footer={
        s?.status === 'COMPLETED' &&
        (voiding ? (
          <>
            <Button variant="ghost" onClick={() => setVoiding(false)}>
              Volver
            </Button>
            <Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={doVoid}>
              Confirmar anulación
            </Button>
          </>
        ) : (
          <Button variant="ghost" icon={<Ban aria-hidden />} onClick={() => setVoiding(true)}>
            Anular venta
          </Button>
        ))
      }
    >
      {q.isLoading || !s ? (
        q.isError ? <ErrorState error={q.error} /> : <Skeleton h={160} />
      ) : (
        <>
          <dl className="kv">
            <div>
              <dt>Fecha</dt>
              <dd>{dateTime(s.createdAt)}</dd>
            </div>
            <div>
              <dt>Vendedor</dt>
              <dd>{s.seller}</dd>
            </div>
            <div>
              <dt>Pago</dt>
              <dd>{s.paymentLabel}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{money(s.total, currency)}</dd>
            </div>
            <div>
              <dt>Ganancia</dt>
              <dd>{money(s.profit ?? 0, currency)}</dd>
            </div>
            {s.cashReceived != null && (
              <div>
                <dt>Recibido / vueltas</dt>
                <dd>
                  {money(s.cashReceived, currency)} / {money(s.change ?? 0, currency)}
                </dd>
              </div>
            )}
          </dl>
          {s.status === 'VOIDED' && (
            <div className="alert alert--danger">
              Anulada {dateTime(s.voidedAt)} por {s.voidedBy}: {s.voidReason}
            </div>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Cant.</th>
                  <th className="num">Precio</th>
                  <th className="num">Total</th>
                  <th className="num">Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {s.items.map((i) => (
                  <tr key={i.barcode}>
                    <td>
                      {i.name}
                      <div className="tiny muted mono">{i.barcode}</div>
                    </td>
                    <td className="num">{i.quantity}</td>
                    <td className="num">{money(i.unitPrice, currency)}</td>
                    <td className="num">{money(i.lineTotal, currency)}</td>
                    <td className="num">{money(i.lineProfit ?? 0, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {voiding && (
            <TextArea
              label="Motivo de la anulación"
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              hint="El stock de los productos vuelve al inventario y la venta deja de contar en las ganancias."
              autoFocus
            />
          )}
        </>
      )}
    </Modal>
  );
}
