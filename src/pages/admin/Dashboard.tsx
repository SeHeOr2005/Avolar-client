import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleCheck,
  CircleDashed,
  Hourglass,
  PackageCheck,
  PackageX,
  Wallet,
} from 'lucide-react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { ErrorState, Skeleton, StatusBadge } from '../../components/ui';
import { api } from '../../lib/api';
import { money, STATUS_TONE } from '../../lib/format';
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
  setup: { hasWhatsapp: boolean; hasHours: boolean; hasPaymentInstructions: boolean; hasConsoles: boolean; hasProducts: boolean };
}

export default function Dashboard() {
  const { theme } = useTheme();
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => api.get<Dash>('/admin/dashboard'), refetchInterval: 60_000 });

  if (q.isLoading) {
    return (
      <>
        <PageTitle title="Dashboard" />
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
  const lineColor = theme === 'day' ? '#0f72a6' : '#2fe3a4';
  const axis = theme === 'day' ? '#6a4462' : '#b8a8d4';
  const grid = theme === 'day' ? 'rgba(42,14,44,.10)' : 'rgba(190,150,255,.12)';
  const todayKey = d.series.find((x) => x.isToday)?.date ?? '';
  const totalStatus = d.statusBreakdown.reduce((n, x) => n + x.count, 0) || 1;
  const pendingSetup = [
    !d.setup.hasWhatsapp && { label: 'Configura el número de WhatsApp', to: '/admin/configuracion', perm: 'settings.manage' },
    !d.setup.hasHours && { label: 'Publica el horario de atención', to: '/admin/configuracion', perm: 'settings.manage' },
    !d.setup.hasPaymentInstructions && { label: 'Agrega las instrucciones para el depósito', to: '/admin/configuracion', perm: 'settings.manage' },
    !d.setup.hasConsoles && { label: 'Registra la primera consola', to: '/admin/consolas', perm: 'consoles.manage' },
    !d.setup.hasProducts && { label: 'Publica productos en el catálogo', to: '/admin/productos', perm: 'catalog.manage' },
  ].filter(Boolean) as { label: string; to: string; perm: string }[];

  return (
    <>
      <PageTitle title="Dashboard" sub="Resumen de la operación de hoy." />

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

      <div className="stats">
        <Stat to="/admin/reservas" accent icon={CalendarClock} label="Reservas de hoy" value={s.reservationsToday} hint="Activas para hoy" />
        <Stat to="/admin/reservas?status=PENDING_PAYMENT" icon={Hourglass} label="Pendientes de pago" value={s.pendingPayment} />
        <Stat to="/admin/reservas?status=PAYMENT_REVIEW" icon={AlertTriangle} label="Por verificar" value={s.paymentReview} hint="Comprobantes recibidos" />
        <Stat to="/admin/reservas?status=CONFIRMED" icon={CalendarCheck} label="Confirmadas" value={s.confirmedUpcoming} hint="Próximas" />
        <Stat to="/admin/reservas?status=CANCELLED" icon={CalendarX} label="Canceladas" value={s.cancelledThisMonth} hint="Este mes" />
        <Stat icon={Wallet} label="Ingresos registrados" value={money(s.revenueTotal, d.currency)} hint={`Este mes: ${money(s.revenueThisMonth, d.currency)}`} />
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
          <section className="card panel" aria-labelledby="ch2">
            <div className="spread">
              <h2 id="ch2" className="panel__title">
                Pagos registrados
              </h2>
              <span className="tiny muted">Últimos 14 días · {d.currency}</span>
            </div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer>
                <LineChart data={d.revenueSeries} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={grid} />
                  <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fill: axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                    tickFormatter={(v) => new Intl.NumberFormat('es-CO', { notation: 'compact' }).format(v)}
                  />
                  <Tooltip
                    cursor={{ stroke: axis, strokeDasharray: '3 3' }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="card" style={{ padding: '8px 12px', boxShadow: 'var(--shadow-sm)' }}>
                          <div className="tiny muted">{label}</div>
                          <strong>{money(Number(payload[0].value), d.currency)}</strong>
                        </div>
                      ) : null
                    }
                  />
                  <Line type="monotone" dataKey="revenue" stroke={lineColor} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }} />
                </LineChart>
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
