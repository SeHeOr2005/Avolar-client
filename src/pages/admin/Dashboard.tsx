import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleCheck,
  CircleDashed,
  HandCoins,
  Hourglass,
  PackageCheck,
  PackageX,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { ErrorState, Skeleton, StatusBadge } from '../../components/ui';
import { api, qs } from '../../lib/api';
import { money, STATUS_TONE, todayInZone } from '../../lib/format';
import { useSettings } from '../../hooks/data';
import ShopSalesPage from './ShopSales';
import CreditPage from './Credit';
import { useTheme } from '../../hooks/theme';
import { useAuth } from '../../hooks/auth';

interface Dash {
  stats: {
    reservationsToday: number;
    pendingPayment: number;
    paymentReview: number;
    confirmedUpcoming: number;
    cancelledThisMonth: number;
    revenueTotal: number;
    revenueThisMonth: number;
    productsActive: number;
    productsAvailable: number;
    productsOutOfStock: number;
    lowStockVariants: number;
    activeConsoles: number;
  };
  currency: string;
  statusBreakdown: { status: string; label: string; count: number }[];
  series: { date: string; label: string; isToday: boolean; reservations: number; cancelled: number }[];
  revenueSeries: { date: string; label: string; revenue: number }[];
  upcoming: { id: string; code: string; customerName: string; console: { name: string }; dateLabel: string; startTime: string; endTime: string; status: string; statusLabel: string }[];
  lowStock: { variantId: string; productId: string; productName: string; size: string; color: string | null; stock: number }[];
  setup: { hasWhatsapp: boolean; hasHours: boolean; hasPaymentInstructions: boolean; hasLegal: boolean; hasConsoles: boolean; hasProducts: boolean };
}

type Tab = 'resumen' | 'ventas' | 'fiados';
const TABS: { key: Tab; label: string; perm: string; icon: typeof Wallet }[] = [
  { key: 'resumen', label: 'Resumen', perm: 'dashboard.view', icon: Wallet },
  { key: 'ventas', label: 'Ventas tienda', perm: 'pos.reports', icon: Receipt },
  { key: 'fiados', label: 'Fiados', perm: 'pos.sell', icon: HandCoins },
];

/** Todo lo de dinero en un solo lugar: resumen (reservas + tienda + fiados), ventas de la tienda y fiados. */
export default function Dashboard() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabs = TABS.filter((t) => can(t.perm));
  const tab = tabs.find((t) => t.key === params.get('tab'))?.key ?? tabs[0]?.key ?? 'resumen';
  const current = tabs.find((t) => t.key === tab);
  return (
    <>
      <PageTitle
        title="Dashboard"
        sub={tabs.length > 1 ? 'Reservas, ventas de la tienda y fiados en un solo lugar.' : current?.key === 'fiados' ? 'Fiados de la tienda.' : 'Resumen de la operación.'}
      />
      {tabs.length > 1 && (
        <div className="row dash-tabs" role="tablist" aria-label="Secciones del dashboard">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              className="chip"
              aria-selected={tab === t.key}
              aria-pressed={tab === t.key}
              onClick={() => setParams(t.key === tabs[0].key ? {} : { tab: t.key }, { replace: true })}
            >
              <t.icon size={16} aria-hidden /> {t.label}
            </button>
          ))}
        </div>
      )}
      {current?.key === 'ventas' ? <ShopSalesPage embedded /> : current?.key === 'fiados' ? <CreditPage embedded /> : <Overview />}
    </>
  );
}

function Overview() {
  const { theme } = useTheme();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => api.get<Dash>('/admin/dashboard'), refetchInterval: 60_000 });

  if (q.isLoading) {
    return (
      <>
        <div className="stats">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} h={108} r={16} />
          ))}
        </div>
      </>
    );
  }
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const s = d.stats;
  // Colores de gráfico por modo (validados contra la superficie de cada modo).
  const seriesColor = theme === 'day' ? '#e0115f' : '#a865ff';
  const axis = theme === 'day' ? '#6a4462' : '#b8a8d4';
  const grid = theme === 'day' ? 'rgba(42,14,44,.10)' : 'rgba(190,150,255,.12)';
  const todayKey = d.series.find((x) => x.isToday)?.date ?? '';
  const totalStatus = d.statusBreakdown.reduce((n, x) => n + x.count, 0) || 1;
  const pendingSetup = [
    !d.setup.hasWhatsapp && { label: 'Configura el número de WhatsApp', to: '/admin/configuracion', perm: 'settings.manage' },
    !d.setup.hasHours && { label: 'Publica el horario de atención', to: '/admin/configuracion', perm: 'settings.manage' },
    !d.setup.hasPaymentInstructions && { label: 'Agrega las instrucciones para el depósito', to: '/admin/configuracion', perm: 'settings.manage' },
    !d.setup.hasLegal && { label: 'Completa la razón social y el NIT (datos legales)', to: '/admin/configuracion', perm: 'settings.manage' },
    !d.setup.hasConsoles && { label: 'Registra la primera consola', to: '/admin/consolas', perm: 'consoles.manage' },
    !d.setup.hasProducts && { label: 'Publica productos en el catálogo', to: '/admin/productos', perm: 'catalog.manage' },
  ].filter(Boolean) as { label: string; to: string; perm: string }[];

  return (
    <>
      {pendingSetup.length > 0 && (
        <div className="card panel" style={{ marginBottom: 18 }}>
          <h2 className="panel__title">Completa la configuración de la tienda</h2>
          <ul className="setup-list">
            {pendingSetup.map((p) => (
              <li key={p.label}>
                <CircleDashed aria-hidden style={{ color: 'var(--warn)' }} />
                {can(p.perm) ? (
                  <Link className="link" to={p.to}>
                    {p.label}
                  </Link>
                ) : (
                  <span>{p.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <MoneySection />

      <h2 className="dash-section-title">Operación</h2>
      <div className="stats">
        <Stat to="/admin/reservas" accent icon={CalendarClock} label="Reservas de hoy" value={s.reservationsToday} hint="Activas para hoy" />
        <Stat to="/admin/reservas?status=PENDING_PAYMENT" icon={Hourglass} label="Pendientes de pago" value={s.pendingPayment} />
        <Stat to="/admin/reservas?status=PAYMENT_REVIEW" icon={AlertTriangle} label="Por verificar" value={s.paymentReview} hint="Comprobantes recibidos" />
        <Stat to="/admin/reservas?status=CONFIRMED" icon={CalendarCheck} label="Confirmadas" value={s.confirmedUpcoming} hint="Próximas" />
        <Stat to="/admin/reservas?status=CANCELLED" icon={CalendarX} label="Canceladas" value={s.cancelledThisMonth} hint="Este mes" />
        <Stat to="/admin/productos?status=active" icon={PackageCheck} label="Productos disponibles" value={s.productsAvailable} hint={`${s.productsActive} activos`} />
        <Stat to="/admin/productos?status=low" icon={PackageX} label="Poco stock" value={s.lowStockVariants} hint={`${s.productsOutOfStock} agotados`} />
      </div>

      <div className="dash-grid">
        <div className="stack">
          <section className="card panel" aria-labelledby="ch1">
            <div className="spread">
              <h2 id="ch1" className="panel__title">
                Reservas por día
              </h2>
              <span className="tiny muted">Por día de juego · 6 días atrás a 7 adelante · sin canceladas</span>
            </div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={d.series} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke={grid} />
                  <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: grid }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="card" style={{ padding: '8px 12px', boxShadow: 'var(--shadow-sm)' }}>
                          <div className="tiny muted">{label}</div>
                          <strong>{payload[0].value} reservas</strong>
                          <div className="tiny muted">{(payload[0].payload as Dash['series'][0]).cancelled} canceladas</div>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="reservations" radius={[4, 4, 0, 0]} maxBarSize={22}>
                    {d.series.map((x) => (
                      <Cell key={x.date} fill={seriesColor} fillOpacity={x.date < todayKey ? 0.45 : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="card panel" aria-labelledby="up">
            <div className="spread">
              <h2 id="up" className="panel__title">
                Próximas reservas
              </h2>
              <Link to="/admin/reservas" className="small link">
                Ver todas
              </Link>
            </div>
            {d.upcoming.length ? (
              <ul className="list">
                {d.upcoming.map((r) => (
                  <li key={r.id}>
                    <Link to={`/admin/reservas/${r.id}`} className="stack" style={{ '--gap': '2px' } as React.CSSProperties}>
                      <strong>{r.customerName}</strong>
                      <span className="tiny muted cap">
                        {r.console.name} · {r.dateLabel.split(' de 20')[0]} · {r.startTime}–{r.endTime}
                      </span>
                    </Link>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">No hay reservas próximas.</p>
            )}
          </section>

          <section className="card panel" aria-labelledby="st">
            <h2 id="st" className="panel__title">
              Reservas por estado
            </h2>
            <ul className="list">
              {d.statusBreakdown.map((x) => (
                <li key={x.status} style={{ display: 'grid', gap: 6 }}>
                  <div className="spread">
                    <span>{x.label}</span>
                    <strong className="num">{x.count}</strong>
                  </div>
                  <div className="bar" style={{ color: `var(--${toneVar(STATUS_TONE[x.status])})` }}>
                    <span style={{ width: `${(x.count / totalStatus) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card panel" aria-labelledby="ls">
            <h2 id="ls" className="panel__title">
              Poco stock
            </h2>
            {d.lowStock.length ? (
              <ul className="list">
                {d.lowStock.map((v) => (
                  <li key={v.variantId}>
                    <Link to={`/admin/productos/${v.productId}`}>
                      {v.productName}{' '}
                      <span className="muted tiny">
                        {v.size}
                        {v.color ? ` · ${v.color}` : ''}
                      </span>
                    </Link>
                    <span className={`badge ${v.stock === 0 ? 'badge--danger' : 'badge--warn'}`}>{v.stock === 0 ? 'Agotado' : `${v.stock} u.`}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted row" style={{ '--gap': '8px' } as React.CSSProperties}>
                <CircleCheck size={16} aria-hidden /> Todo el inventario está por encima del mínimo.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

interface Money {
  currency: string;
  range: { from: string; to: string };
  withShop: boolean;
  totals: {
    received: number;
    reservations: number;
    reservationsCount: number;
    shopSold?: number;
    shopCollected?: number;
    shopSales?: number;
    shopProfit?: number;
    creditGiven?: number;
    creditCollected?: number;
    receivable?: number;
    debtors?: number;
  };
  byDay: { date: string; label: string; reservations: number; shop: number; credit: number }[];
}

/** Colores validados (CVD y contraste) contra la superficie de cada modo. Orden fijo: reservas, tienda, abonos. */
const MONEY_COLORS = {
  day: { reservations: '#e0115f', shop: '#0f72a6', credit: '#b86e00' },
  night: { reservations: '#a865ff', shop: '#169e70', credit: '#cf7f1d' },
};

/** Dinero del periodo: lo que entró por reservas, tienda y abonos de fiados, y lo que queda por cobrar. */
function MoneySection() {
  const { theme } = useTheme();
  const { data: st } = useSettings();
  const zone = st?.timezone ?? 'America/Bogota';
  const today = todayInZone(zone);
  const presets = [
    { key: 'today', label: 'Hoy', from: today, to: today },
    { key: '7d', label: '7 días', from: todayInZone(zone, -6), to: today },
    { key: 'month', label: 'Este mes', from: `${today.slice(0, 8)}01`, to: today },
    { key: '30d', label: '30 días', from: todayInZone(zone, -29), to: today },
  ];
  const [range, setRange] = useState({ key: 'month', from: presets[2].from, to: today });
  const q = useQuery({
    queryKey: ['admin-money', range.from, range.to],
    queryFn: () => api.get<Money>(`/admin/dashboard/money${qs({ from: range.from, to: range.to })}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const colors = MONEY_COLORS[theme === 'day' ? 'day' : 'night'];
  const axis = theme === 'day' ? '#6a4462' : '#b8a8d4';
  const grid = theme === 'day' ? 'rgba(42,14,44,.10)' : 'rgba(190,150,255,.12)';
  const m = q.data;
  const t = m?.totals;
  const cur = m?.currency ?? 'COP';
  const series = [
    { key: 'reservations' as const, label: 'Reservas' },
    ...(m?.withShop
      ? [
          { key: 'shop' as const, label: 'Tienda (cobrado)' },
          { key: 'credit' as const, label: 'Abonos de fiados' },
        ]
      : []),
  ];

  return (
    <section className="money" aria-labelledby="money-title">
      <div className="spread" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h2 id="money-title" className="dash-section-title" style={{ margin: 0 }}>
          Dinero
        </h2>
        <div className="row" role="group" aria-label="Periodo" style={{ '--gap': '6px' } as React.CSSProperties}>
          {presets.map((p) => (
            <button key={p.key} type="button" className="chip" aria-pressed={range.key === p.key} onClick={() => setRange({ key: p.key, from: p.from, to: p.to })}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading || !t ? (
        q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <Skeleton h={220} r={16} />
      ) : (
        <>
          <div className="stats">
            <div className="card stat stat--accent">
              <span className="stat__label">
                <Wallet aria-hidden /> Dinero que entró
              </span>
              <span className="stat__value">{money(t.received, cur)}</span>
              <span className="stat__hint">{m!.withShop ? 'Reservas + tienda + abonos' : 'Pagos de reservas'}</span>
            </div>
            <Stat to="/admin/reservas" icon={CalendarCheck} label="Reservas" value={money(t.reservations, cur)} hint={`${t.reservationsCount} pago(s) registrados`} />
            {m!.withShop && (
              <>
                <Stat
                  to="/admin?tab=ventas"
                  icon={Receipt}
                  label="Tienda"
                  value={money(t.shopCollected ?? 0, cur)}
                  hint={`${t.shopSales} venta(s) · vendido ${money(t.shopSold ?? 0, cur)}`}
                />
                <Stat icon={TrendingUp} label="Ganancia tienda" value={money(t.shopProfit ?? 0, cur)} hint="Ventas menos costo (incluye fiado)" />
                <Stat
                  to="/admin?tab=fiados"
                  icon={HandCoins}
                  label="Por cobrar (fiado)"
                  value={money(t.receivable ?? 0, cur)}
                  hint={`${t.debtors} cliente(s) · fiado en el periodo ${money(t.creditGiven ?? 0, cur)} · abonos ${money(t.creditCollected ?? 0, cur)}`}
                />
              </>
            )}
          </div>

          <div className="card panel" style={{ marginTop: 14 }}>
            <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
              <h3 className="panel__title">Dinero que entró por día</h3>
              <ul className="chart-legend" aria-label="Leyenda">
                {series.map((x) => (
                  <li key={x.key}>
                    <span className="chart-legend__swatch" style={{ background: colors[x.key] }} aria-hidden />
                    {x.label}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ height: 230 }}>
              <ResponsiveContainer>
                <BarChart data={m!.byDay} margin={{ top: 8, right: 4, left: 8, bottom: 0 }} barCategoryGap="24%">
                  <CartesianGrid vertical={false} stroke={grid} />
                  <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fill: axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(v) => new Intl.NumberFormat('es-CO', { notation: 'compact' }).format(v)}
                  />
                  <Tooltip
                    cursor={{ fill: grid }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0].payload as Money['byDay'][0];
                      const total = row.reservations + row.shop + row.credit;
                      return (
                        <div className="card" style={{ padding: '8px 12px', boxShadow: 'var(--shadow-sm)', minWidth: 180 }}>
                          <div className="tiny muted">{label}</div>
                          <strong>{money(total, cur)}</strong>
                          {series.map((x) => (
                            <div key={x.key} className="spread tiny" style={{ gap: 12 }}>
                              <span className="row" style={{ '--gap': '6px' } as React.CSSProperties}>
                                <span className="chart-legend__swatch" style={{ background: colors[x.key] }} aria-hidden />
                                {x.label}
                              </span>
                              <span className="num">{money(row[x.key], cur)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  {series.map((x, i) => (
                    <Bar
                      key={x.key}
                      dataKey={x.key}
                      name={x.label}
                      stackId="money"
                      fill={colors[x.key]}
                      stroke="var(--surface)"
                      strokeWidth={2}
                      maxBarSize={28}
                      radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <details className="money-table">
              <summary className="tiny">Ver como tabla</summary>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Día</th>
                      {series.map((x) => (
                        <th key={x.key} className="num">
                          {x.label}
                        </th>
                      ))}
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m!.byDay
                      .filter((r) => r.reservations + r.shop + r.credit > 0)
                      .map((r) => (
                        <tr key={r.date}>
                          <td>{r.label}</td>
                          {series.map((x) => (
                            <td key={x.key} className="num">
                              {money(r[x.key], cur)}
                            </td>
                          ))}
                          <td className="num strong">{money(r.reservations + r.shop + r.credit, cur)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </>
      )}
    </section>
  );
}

const toneVar = (t: string | undefined) => (t === 'ok' ? 'ok' : t === 'warn' ? 'warn' : t === 'info' ? 'info' : t === 'danger' ? 'danger' : 'ink-faint');

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  to,
  accent,
}: {
  icon: typeof Wallet;
  label: string;
  value: React.ReactNode;
  hint?: string;
  to?: string;
  accent?: boolean;
}) {
  const body = (
    <>
      <span className="stat__label">
        <Icon aria-hidden /> {label}
      </span>
      <span className="stat__value">{value}</span>
      {hint && <span className="stat__hint">{hint}</span>}
    </>
  );
  const cls = `card stat ${accent ? 'stat--accent' : ''}`;
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
