import { Link } from 'react-router-dom';
import { Clock, Gamepad2, Users } from 'lucide-react';
import { duration, money } from '../lib/format';
import type { GameConsole } from '../lib/types';

export function ConsoleCard({ c, currency }: { c: GameConsole; currency: string }) {
  const img = c.images[0];
  return (
    <Link to={`/reservar/${c.slug}`} className="card console-card">
      <div className="console-card__media">
        {img ? (
          <img src={img.url} alt={img.alt ?? c.name} loading="lazy" width={img.width ?? undefined} height={img.height ?? undefined} />
        ) : (
          <div className="console-card__placeholder">
            <Gamepad2 aria-hidden />
          </div>
        )}
        <span className="badge badge--plain console-card__platform" style={{ background: 'var(--surface)', color: 'var(--ink)' }}>
          {c.platform}
        </span>
      </div>
      <div className="console-card__body">
        <h3 className="display">{c.name}</h3>
        <div className="row small muted" style={{ '--gap': '14px' } as React.CSSProperties}>
          <span className="row" style={{ '--gap': '6px' } as React.CSSProperties}>
            <Users size={16} aria-hidden /> Hasta {c.maxPlayers} jugadores
          </span>
          <span className="row" style={{ '--gap': '6px' } as React.CSSProperties}>
            <Clock size={16} aria-hidden /> Mín. {duration(c.minMinutes)}
          </span>
        </div>
        {c.features.length > 0 && (
          <ul className="feature-list">
            {c.features.slice(0, 4).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
        <div className="spread" style={{ marginTop: 'auto' }}>
          <span className="price-tag">
            <strong>{money(c.pricePerHour, currency)}</strong>
            <span>/ hora</span>
          </span>
          <span className="btn btn--primary btn--sm">Reservar</span>
        </div>
      </div>
    </Link>
  );
}
