import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, Trash2 } from 'lucide-react';
import { Button, Skeleton } from '../ui';
import { ApiError, api } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { useAuth } from '../../hooks/auth';
import { useToast } from '../../hooks/toast';

interface Receipt {
  id: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

/**
 * Comprobantes subidos por el cliente. Los enlaces son firmados y vencen a los 5 minutos;
 * la consulta se renueva sola antes de eso para que los enlaces sigan funcionando.
 */
export function ReceiptsPanel({ reservationId, count }: { reservationId: string; count: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const q = useQuery({
    queryKey: ['admin-receipts', reservationId, count],
    enabled: count > 0,
    queryFn: () => api.get<{ receipts: Receipt[] }>(`/admin/reservations/${reservationId}/receipts`).then((r) => r.receipts),
    refetchInterval: 4 * 60_000,
    staleTime: 3 * 60_000,
  });

  async function remove(id: string) {
    if (!confirm('¿Eliminar este comprobante? No se puede deshacer.')) return;
    try {
      await api.del(`/admin/reservations/${reservationId}/receipts/${id}`);
      toast.ok('Comprobante eliminado');
      qc.invalidateQueries({ queryKey: ['admin-reservation', reservationId] });
      qc.invalidateQueries({ queryKey: ['admin-receipts', reservationId] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar.');
    }
  }

  return (
    <section className="card panel">
      <h2 className="panel__title">Comprobantes de pago</h2>
      {count === 0 ? (
        <p className="small muted">El cliente aún no ha subido comprobantes en la web. Puede que lo haya enviado por WhatsApp.</p>
      ) : q.isLoading ? (
        <Skeleton h={120} />
      ) : q.isError ? (
        <p className="small" style={{ color: 'var(--danger)' }}>
          No se pudieron cargar los comprobantes. {q.error instanceof Error ? q.error.message : ''}
        </p>
      ) : (
        <div className="receipts-grid">
          {q.data!.map((r, i) => (
            <figure key={r.id} className="receipt-tile">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="receipt-tile__media" aria-label={`Abrir comprobante ${i + 1}`}>
                {r.mimeType === 'application/pdf' ? (
                  <span className="receipt-tile__pdf">
                    <FileText aria-hidden />
                    PDF
                  </span>
                ) : (
                  <img src={r.url} alt={`Comprobante ${i + 1}`} loading="lazy" />
                )}
              </a>
              <figcaption className="tiny muted">
                {dateTime(r.createdAt)} · {Math.max(1, Math.round(r.sizeBytes / 1024))} KB
              </figcaption>
              <div className="row" style={{ '--gap': '6px' } as React.CSSProperties}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn btn--sm">
                  <ExternalLink aria-hidden /> Abrir
                </a>
                {can('reservations.manage') && (
                  <Button size="sm" variant="ghost" className="btn--icon" aria-label="Eliminar comprobante" onClick={() => remove(r.id)}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            </figure>
          ))}
        </div>
      )}
      <p className="tiny muted">Archivos privados: los enlaces vencen a los 5 minutos y se renuevan solos mientras esta página esté abierta.</p>
    </section>
  );
}
