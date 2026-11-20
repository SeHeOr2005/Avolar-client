import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarSearch, Gamepad2 } from 'lucide-react';
import { ConsoleCard } from '../../components/ConsoleCard';
import { Empty, ErrorState, Skeleton, btnClass } from '../../components/ui';
import { api } from '../../lib/api';
import { useDocumentTitle, useSettings } from '../../hooks/data';
import type { GameConsole } from '../../lib/types';

export default function Consoles() {
  useDocumentTitle('Reservar consola');
  const { data: s } = useSettings();
  const q = useQuery({
    queryKey: ['public-consoles'],
    queryFn: () => api.get<{ consoles: GameConsole[] }>('/public/consoles').then((r) => r.consoles),
  });

  return (
    <div className="container">
      <header className="page-head">
        <p className="eyebrow">Reservas</p>
        <h1 className="display">Elige tu consola</h1>
        <p>
          Cada consola muestra su precio por hora. Al elegir día y horario te calculamos el total y el anticipo del{' '}
          {s?.depositPercent ?? 50} % para apartar tu lugar.
        </p>
        <div className="row" style={{ marginTop: 18 }}>
          <Link to="/mi-reserva" className={btnClass('ghost', 'sm')}>
            <CalendarSearch aria-hidden /> ¿Ya reservaste? Consulta tu reserva
          </Link>
        </div>
        <div className="page-band" />
      </header>

      {s && !s.reservationsEnabled && (
        <div className="alert alert--warn" style={{ marginBottom: 20 }}>
          Las reservas en línea están pausadas temporalmente. Escríbenos por WhatsApp para más información.
        </div>
      )}

      {q.isLoading ? (
        <div className="console-grid">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={380} r={26} />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data?.length ? (
        <div className="console-grid">
          {q.data.map((c) => (
            <ConsoleCard key={c.id} c={c} currency={s?.currency ?? 'COP'} />
          ))}
        </div>
      ) : (
        <Empty icon={<Gamepad2 />} title="Aún no hay consolas publicadas">
          Estamos preparando el espacio de juego. Vuelve pronto o escríbenos por WhatsApp.
        </Empty>
      )}
    </div>
  );
}
