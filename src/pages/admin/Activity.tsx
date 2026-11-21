import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { History, Lock, Search } from 'lucide-react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { Button, Empty, ErrorState, Skeleton } from '../../components/ui';
import { api, qs } from '../../lib/api';
import { todayInZone } from '../../lib/format';
import { useSettings } from '../../hooks/data';
import type { Pagination } from '../../lib/types';

interface Change {
  field: string;
  from: string;
  to: string;
}
interface Entry {
  id: string;
  userId: string | null;
  actor: string;
  area: string;
  areaLabel: string;
  action: string;
  summary: string;
  details: { changes?: Change[]; note?: string } | null;
  ip: string | null;
  createdAt: string;
}
interface ActivityData {
  entries: Entry[];
  users: { id: string; fullName: string; username: string }[];
  areas: { key: string; label: string }[];
  pagination: Pagination;
}

/** Tono por tipo de acción: lo delicado (anulaciones, borrados, arqueos, permisos) resalta. */
function tone(e: Entry): string {
  if (/\.(delete|void)$|reset_password|^role\./.test(e.action)) return 'danger';
  if (e.action === 'cash.close' && /faltante|sobrante/.test(e.summary)) return 'warn';
  if (/stock|status|update/.test(e.action)) return 'info';
  if (e.area === 'session') return 'muted';
  return 'ok';
}

/** "Hoy", "Ayer" o "jueves 19 de noviembre" en la zona horaria de la tienda. */
function dayLabel(key: string, zone: string) {
  if (key === todayInZone(zone)) return 'Hoy';
  if (key === todayInZone(zone, -1)) return 'Ayer';
  const d = new Date(`${key}T12:00:00Z`);
  const s = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ActivityPage() {
  const { data: s } = useSettings();
  const zone = s?.timezone ?? 'America/Bogota';
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [userId, setUserId] = useState('');
  const [area, setArea] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery({
    queryKey: ['admin-activity', q, userId, area, from, to, page],
    queryFn: () => api.get<ActivityData>(`/admin/activity${qs({ q, userId, area, from, to, page })}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const groups = useMemo(() => {
    const fmtKey = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const out: { key: string; items: Entry[] }[] = [];
    for (const e of query.data?.entries ?? []) {
      const key = fmtKey.format(new Date(e.createdAt));
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(e);
      else out.push({ key, items: [e] });
    }
    return out;
  }, [query.data, zone]);

  const filtered = Boolean(q || userId || area || from || to);
  const reset = () => {
    setSearch('');
    setQ('');
    setUserId('');
    setArea('');
    setFrom('');
    setTo('');
    setPage(1);
  };
  const time = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: zone, hour: '2-digit', minute: '2-digit' });

  if (query.isLoading) return <Skeleton h={500} r={16} />;
  if (query.isError || !query.data) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const d = query.data;

  return (
    <>
      <PageTitle title="Actividad del equipo" sub="Quién hizo qué en el panel y cuándo: precios, stock, caja, anulaciones, reservas, usuarios y configuración." />

      <div className="filterbar activity-filters">
        <label className="field">
          <span className="field__label">Buscar</span>
          <span style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--ink-faint)' }} aria-hidden />
            <input className="input" style={{ paddingLeft: 38 }} placeholder="Código, producto, persona…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </span>
        </label>
        <label className="field">
          <span className="field__label">Persona</span>
          <select className="select" value={userId} onChange={(e) => (setUserId(e.target.value), setPage(1))}>
            <option value="">Todo el equipo</option>
            {d.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} (@{u.username})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Área</span>
          <select className="select" value={area} onChange={(e) => (setArea(e.target.value), setPage(1))}>
            <option value="">Todas</option>
            {d.areas.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Desde</span>
          <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => (setFrom(e.target.value), setPage(1))} />
        </label>
        <label className="field">
          <span className="field__label">Hasta</span>
          <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => (setTo(e.target.value), setPage(1))} />
        </label>
        <Button variant="ghost" disabled={!filtered && !search} onClick={reset}>
          Limpiar
        </Button>
      </div>

      {!d.entries.length ? (
        <Empty icon={<History />} title={filtered ? 'Nada con estos filtros' : 'Aún no hay actividad'}>
          {filtered ? 'Prueba con otra persona, área o fechas.' : 'Aquí aparecerá cada acción que el equipo haga en el panel.'}
        </Empty>
      ) : (
        <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
          {groups.map((g) => (
            <section key={g.key} className="card panel">
              <h2 className="panel__title">{dayLabel(g.key, zone)}</h2>
              <ol className="activity">
                {g.items.map((e) => {
                  const changes = e.details?.changes ?? [];
                  return (
                    <li key={e.id} className="activity__item">
                      <time className="activity__time mono" dateTime={e.createdAt}>
                        {time(e.createdAt)}
                      </time>
                      <div className="activity__body">
                        <div className="activity__meta">
                          <span className={`badge badge--${tone(e)} badge--plain`}>{e.areaLabel}</span>
                          <strong>{e.actor}</strong>
                        </div>
                        <p className="activity__summary">{e.summary}</p>
                        {e.details?.note && <p className="tiny muted">Nota: {e.details.note}</p>}
                        {changes.length > 1 && (
                          <details className="activity__changes">
                            <summary className="tiny">Ver {changes.length} cambios</summary>
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Campo</th>
                                  <th>Antes</th>
                                  <th>Después</th>
                                </tr>
                              </thead>
                              <tbody>
                                {changes.map((c) => (
                                  <tr key={c.field}>
                                    <td>{c.field}</td>
                                    <td className="muted">{c.from}</td>
                                    <td>{c.to}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </details>
                        )}
                        {e.ip && <span className="tiny muted mono">IP {e.ip}</span>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {d.pagination.totalPages > 1 && (
        <div className="pagination">
          <span>{d.pagination.total} acciones</span>
          <div className="row">
            <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Más recientes
            </Button>
            <span>
              {page} / {d.pagination.totalPages}
            </span>
            <Button size="sm" disabled={page >= d.pagination.totalPages} onClick={() => setPage(page + 1)}>
              Anteriores
            </Button>
          </div>
        </div>
      )}
      <p className="tiny muted row" style={{ marginTop: 12, gap: 6 }}>
        <Lock size={14} aria-hidden /> El registro no se puede editar ni borrar desde el panel ni desde la base de datos. Se conserva 12 meses.
      </p>
    </>
  );
}
