import { Link } from 'react-router-dom';
import { Camera as Instagram, Clock, Globe as Facebook, Mail, MapPin, MessageCircle, Music2, Phone } from 'lucide-react';
import { ErrorState, Skeleton, btnClass } from '../../components/ui';
import { useDocumentTitle, useSettings } from '../../hooks/data';
import { calendar, hhmm, todayInZone, waLink, WEEKDAYS } from '../../lib/format';

export function StoreInfo() {
  useDocumentTitle('La tienda');
  const { data: s, isLoading, isError, error, refetch } = useSettings();
  if (isLoading) return <div className="container page-head"><Skeleton h={400} r={26} /></div>;
  if (isError || !s) return <div className="container page-head"><ErrorState error={error} onRetry={() => refetch()} /></div>;
  const today = calendar(todayInZone(s.timezone)).weekday;
  const anyOpen = s.hours.some((h) => h.isOpen);

  return (
    <div className="container">
      <header className="page-head">
        <p className="eyebrow">La tienda</p>
        <h1 className="display">{s.businessName}</h1>
        {s.tagline && <p>{s.tagline}</p>}
        <div className="page-band" />
      </header>
      <div className="info-grid">
        <div className="card card__body stack" style={{ '--gap': '18px' } as React.CSSProperties}>
          <h2 style={{ fontSize: 'var(--text-lg)' }}>Sobre nosotros</h2>
          {s.about ? (
            <p style={{ whiteSpace: 'pre-line' }}>{s.about}</p>
          ) : (
            <p className="muted">Una smoke shop con zona gaming y ropa urbana. Reserva tu consola en línea o pasa a conocernos.</p>
          )}
          <div className="row">
            <Link to="/reservar" className={btnClass('primary')}>
              Reservar consola
            </Link>
            <Link to="/catalogo" className={btnClass('default')}>
              Ver catálogo
            </Link>
          </div>
          <hr className="divider" />
          <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
            <h3 className="row small strong" style={{ '--gap': '8px' } as React.CSSProperties}>
              <MapPin size={18} aria-hidden /> Dirección
            </h3>
            {s.address ? (
              <p>
                {s.address}
                {s.city ? `, ${s.city}` : ''}
              </p>
            ) : (
              <p className="muted">Pronto publicaremos la dirección.</p>
            )}
            {s.mapsUrl && (
              <a className="link" href={s.mapsUrl} target="_blank" rel="noopener noreferrer">
                Cómo llegar (Google Maps)
              </a>
            )}
          </div>
        </div>
        <div className="card card__body stack">
          <h2 className="row" style={{ fontSize: 'var(--text-lg)', '--gap': '10px' } as React.CSSProperties}>
            <Clock size={22} aria-hidden /> Horario de atención
          </h2>
          {anyOpen ? (
            <table className="hours-table">
              <tbody>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const h = s.hours.find((x) => x.weekday === d);
                  return (
                    <tr key={d} className={d === today ? 'is-today' : ''}>
                      <td>
                        {WEEKDAYS[d]}
                        {d === today && ' (hoy)'}
                      </td>
                      <td>{h?.isOpen ? `${hhmm(h.openMinute)} – ${hhmm(h.closeMinute)}` : 'Cerrado'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="muted">El horario se publicará pronto.</p>
          )}
          <p className="tiny muted">Horario en zona {s.timezone.replace('_', ' ')}.</p>
        </div>
      </div>
    </div>
  );
}

export function Contact() {
  useDocumentTitle('Contacto');
  const { data: s, isLoading } = useSettings();
  if (isLoading || !s) return <div className="container page-head"><Skeleton h={300} r={26} /></div>;
  const wa = waLink(s.whatsappNumber, `Hola ${s.businessName}, quisiera más información.`);
  const tiles = [
    wa && { href: wa, icon: MessageCircle, title: 'WhatsApp', text: `+${s.whatsappNumber}`, color: '#1fbf5c', ext: true },
    s.phone && { href: `tel:${s.phone.replace(/[^\d+]/g, '')}`, icon: Phone, title: 'Teléfono', text: s.phone },
    s.email && { href: `mailto:${s.email}`, icon: Mail, title: 'Correo', text: s.email },
    s.instagramUrl && { href: s.instagramUrl, icon: Instagram, title: 'Instagram', text: 'Síguenos', ext: true },
    s.tiktokUrl && { href: s.tiktokUrl, icon: Music2, title: 'TikTok', text: 'Síguenos', ext: true },
    s.facebookUrl && { href: s.facebookUrl, icon: Facebook, title: 'Facebook', text: 'Síguenos', ext: true },
    s.mapsUrl && { href: s.mapsUrl, icon: MapPin, title: 'Visítanos', text: s.address ?? 'Ver en el mapa', ext: true },
  ].filter(Boolean) as { href: string; icon: typeof Phone; title: string; text: string; color?: string; ext?: boolean }[];

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <header className="page-head">
        <p className="eyebrow">Contacto</p>
        <h1 className="display">Hablemos</h1>
        <p>La forma más rápida de contactarnos es por WhatsApp: reservas, comprobantes, tallas y disponibilidad.</p>
        <div className="page-band" />
      </header>
      {tiles.length ? (
        <div className="grid-2">
          {tiles.map((t) => (
            <a key={t.title} href={t.href} className="card contact-tile" {...(t.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              <span className="contact-tile__icon" style={t.color ? { background: t.color, color: '#fff' } : undefined}>
                <t.icon aria-hidden />
              </span>
              <span className="stack" style={{ '--gap': '2px' } as React.CSSProperties}>
                <strong>{t.title}</strong>
                <span className="small muted">{t.text}</span>
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div className="alert alert--warn">Los datos de contacto se publicarán pronto.</div>
      )}
    </div>
  );
}
