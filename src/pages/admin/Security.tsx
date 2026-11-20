import { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck, Unlock } from 'lucide-react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { Button, ErrorState, Skeleton } from '../../components/ui';
import { ApiError, api, qs } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { useToast } from '../../hooks/toast';
import type { Pagination } from '../../lib/types';

interface SecurityData {
  last24h: { type: string; label: string; count: number }[];
  bans: { ip: string; until: string; reason: string; banCount: number }[];
  lockedUsers: { id: string; username: string; fullName: string; lockedUntil: string }[];
  events: { id: string; type: string; label: string; ip: string | null; username: string | null; path: string | null; detail: string | null; createdAt: string }[];
  pagination: Pagination;
}

/** Tono de cada tipo de evento (siempre acompañado de su etiqueta, nunca solo color). */
const TONE: Record<string, string> = {
  login_success: 'ok',
  login_failed: 'warn',
  login_blocked: 'warn',
  account_locked: 'danger',
  blocked_request: 'danger',
  rate_limited: 'warn',
  ip_banned: 'danger',
  ip_unbanned: 'info',
};

export default function SecurityPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [type, setType] = useState('');
  const [ip, setIp] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['admin-security', type, ip, page],
    queryFn: () => api.get<SecurityData>(`/admin/security${qs({ type, ip, page })}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  const reload = () => qc.invalidateQueries({ queryKey: ['admin-security'] });

  async function unbanIp(value: string) {
    if (!confirm(`¿Desbloquear la IP ${value}?`)) return;
    try {
      await api.del(`/admin/security/bans/${encodeURIComponent(value)}`);
      toast.ok('IP desbloqueada');
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo desbloquear.');
    }
  }
  async function unlockUser(id: string, username: string) {
    if (!confirm(`¿Desbloquear la cuenta ${username}?`)) return;
    try {
      await api.post(`/admin/security/users/${id}/unlock`);
      toast.ok('Cuenta desbloqueada');
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo desbloquear.');
    }
  }

  if (q.isLoading) return <Skeleton h={500} r={16} />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const threats = d.last24h.filter((x) => ['blocked_request', 'ip_banned', 'account_locked'].includes(x.type)).reduce((n, x) => n + x.count, 0);

  return (
    <>
      <PageTitle title="Seguridad" sub="Intentos de acceso, ataques bloqueados e IPs bloqueadas por el guardián." />

      <div className={`alert ${threats ? 'alert--warn' : 'alert--ok'}`} style={{ marginBottom: 18 }}>
        {threats ? <ShieldAlert aria-hidden /> : <ShieldCheck aria-hidden />}
        <span>
          {threats
            ? `En las últimas 24 horas el guardián frenó ${threats} amenaza(s). Revisa los detalles abajo.`
            : 'Sin amenazas en las últimas 24 horas.'}
        </span>
      </div>

      <div className="stats" style={{ marginBottom: 18 }}>
        {d.last24h
          .filter((x) => x.type !== 'ip_unbanned')
          .map((x) => (
            <button
              key={x.type}
              type="button"
              className="card stat"
              style={{ textAlign: 'left', cursor: 'pointer', outline: type === x.type ? '2px solid var(--brand)' : undefined }}
              onClick={() => {
                setType(type === x.type ? '' : x.type);
                setPage(1);
              }}
            >
              <span className="stat__label">{x.label}</span>
              <span className="stat__value">{x.count}</span>
              <span className="stat__hint">Últimas 24 h</span>
            </button>
          ))}
      </div>

      <div className="dash-grid" style={{ marginTop: 0, marginBottom: 18 }}>
        <section className="card panel">
          <h2 className="panel__title">IPs bloqueadas ahora</h2>
          {d.bans.length ? (
            <ul className="list">
              {d.bans.map((b) => (
                <li key={b.ip}>
                  <span className="stack" style={{ '--gap': '2px' } as React.CSSProperties}>
                    <strong className="mono">{b.ip}</strong>
                    <span className="tiny muted">
                      Hasta {dateTime(b.until)} · {b.banCount}ª vez · {b.reason}
                    </span>
                  </span>
                  <Button size="sm" icon={<Unlock aria-hidden />} onClick={() => unbanIp(b.ip)}>
                    Desbloquear
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Ninguna IP bloqueada.</p>
          )}
        </section>
        <section className="card panel">
          <h2 className="panel__title">Cuentas del panel bloqueadas</h2>
          {d.lockedUsers.length ? (
            <ul className="list">
              {d.lockedUsers.map((u) => (
                <li key={u.id}>
                  <span className="stack" style={{ '--gap': '2px' } as React.CSSProperties}>
                    <strong>{u.fullName}</strong>
                    <span className="tiny muted">
                      @{u.username} · hasta {dateTime(u.lockedUntil)}
                    </span>
                  </span>
                  <Button size="sm" icon={<Unlock aria-hidden />} onClick={() => unlockUser(u.id, u.username)}>
                    Desbloquear
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Ninguna cuenta bloqueada.</p>
          )}
        </section>
      </div>

      <section className="card panel">
        <div className="spread">
          <h2 className="panel__title">Bitácora{type ? ` · ${d.last24h.find((x) => x.type === type)?.label}` : ''}</h2>
          <label className="row small">
            <span className="sr-only">Filtrar por IP</span>
            <input
              className="input"
              style={{ minHeight: 40, width: 200 }}
              placeholder="Filtrar por IP"
              value={ip}
              onChange={(e) => {
                setIp(e.target.value);
                setPage(1);
              }}
            />
            {(type || ip) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setType('');
                  setIp('');
                  setPage(1);
                }}
              >
                Limpiar
              </Button>
            )}
          </label>
        </div>
        {d.events.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Evento</th>
                  <th>IP</th>
                  <th>Usuario</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {d.events.map((e) => (
                  <tr key={e.id}>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>
                      {dateTime(e.createdAt)}
                    </td>
                    <td>
                      <span className={`badge badge--${TONE[e.type] ?? 'muted'}`}>{e.label}</span>
                    </td>
                    <td className="mono small">{e.ip ?? '—'}</td>
                    <td className="small">{e.username ?? '—'}</td>
                    <td className="small muted">
                      {e.detail ?? ''}
                      {e.path ? <span className="mono tiny"> · {e.path}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="small muted">Sin eventos para estos filtros.</p>
        )}
        {d.pagination.totalPages > 1 && (
          <div className="pagination">
            <span>{d.pagination.total} eventos</span>
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
        <p className="tiny muted">Los eventos se conservan 90 días.</p>
      </section>
    </>
  );
}
