import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Camera as Instagram, Globe as Facebook, Menu, MessageCircle, Music2, X } from 'lucide-react';
import { Logo, ThemeToggle } from '../ui';
import { useSettings } from '../../hooks/data';
import { hhmm, WEEKDAYS, waLink } from '../../lib/format';

const NAV = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/reservar', label: 'Reservar consola' },
  { to: '/catalogo', label: 'Catálogo' },
  { to: '/tienda', label: 'La tienda' },
  { to: '/contacto', label: 'Contacto' },
];

export function PublicLayout() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const { data: s } = useSettings();

  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const wa = waLink(s?.whatsappNumber, `Hola ${s?.businessName ?? 'AVOLAR'}, tengo una pregunta.`);

  return (
    <>
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      {/* Sobre el hero del inicio (sin scroll) el texto va en claro para leerse sobre el atardecer. */}
      <header className={`site-header ${scrolled ? 'is-scrolled' : ''} ${pathname === '/' && !scrolled ? 'is-over-hero' : ''}`}>
        <div className="container site-header__inner">
          <Link to="/" className="site-header__logo" aria-label="AVOLAR Smoke Shop, inicio">
            <Logo height={46} />
          </Link>
          <nav className="site-nav" aria-label="Principal">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="site-nav__link">
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="site-header__actions">
            <Link to="/mi-reserva" className="site-header__mine">
              Mi reserva
            </Link>
            <ThemeToggle />
            <button
              className="btn btn--icon site-header__burger"
              aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      <div id="mobile-menu" className={`mobile-menu ${open ? 'is-open' : ''}`} hidden={!open}>
        <nav aria-label="Menú móvil" className="mobile-menu__nav">
          {NAV.map((n, i) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="mobile-menu__link display" style={{ '--i': i } as React.CSSProperties}>
              {n.label}
            </NavLink>
          ))}
          <NavLink to="/mi-reserva" className="mobile-menu__link display" style={{ '--i': NAV.length } as React.CSSProperties}>
            Mi reserva
          </NavLink>
        </nav>
        <div className="mobile-menu__foot">
          <ThemeToggle />
        </div>
      </div>

      <main id="main" className="site-main">
        <Outlet />
      </main>

      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="wa-fab" aria-label="Escríbenos por WhatsApp">
          <MessageCircle aria-hidden />
        </a>
      )}

      <footer className="site-footer">
        <div className="container site-footer__grid">
          <div className="stack">
            <Logo height={56} />
            <p className="muted small">{s?.tagline ?? 'Smoke shop, gaming y ropa urbana.'}</p>
            <div className="row">
              {s?.instagramUrl && (
                <a className="btn btn--icon" href={s.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <Instagram />
                </a>
              )}
              {s?.tiktokUrl && (
                <a className="btn btn--icon" href={s.tiktokUrl} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                  <Music2 />
                </a>
              )}
              {s?.facebookUrl && (
                <a className="btn btn--icon" href={s.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <Facebook />
                </a>
              )}
            </div>
          </div>
          <div className="stack">
            <h2 className="eyebrow">Explora</h2>
            <ul className="footer-links">
              {NAV.slice(1).map((n) => (
                <li key={n.to}>
                  <Link to={n.to}>{n.label}</Link>
                </li>
              ))}
              <li>
                <Link to="/mi-reserva">Consultar mi reserva</Link>
              </li>
            </ul>
          </div>
          <div className="stack">
            <h2 className="eyebrow">Horario</h2>
            {s?.hours?.some((h) => h.isOpen) ? (
              <ul className="footer-hours">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const h = s.hours.find((x) => x.weekday === d);
                  return (
                    <li key={d}>
                      <span>{WEEKDAYS[d]}</span>
                      <span>{h?.isOpen ? `${hhmm(h.openMinute)} – ${hhmm(h.closeMinute)}` : 'Cerrado'}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted small">Horario por confirmar.</p>
            )}
          </div>
          <div className="stack">
            <h2 className="eyebrow">Visítanos</h2>
            {s?.address ? (
              <p className="small">
                {s.address}
                {s.city ? `, ${s.city}` : ''}
              </p>
            ) : (
              <p className="muted small">Dirección por confirmar.</p>
            )}
            {s?.mapsUrl && (
              <a className="link small" href={s.mapsUrl} target="_blank" rel="noopener noreferrer">
                Abrir en Maps
              </a>
            )}
          </div>
        </div>
        <div className="container site-footer__base">
          <span>
            © {new Date().getFullYear()} {s?.businessName ?? 'AVOLAR Smoke Shop'}. Venta solo a mayores de edad.
          </span>
          <Link to="/admin/login" className="muted">
            Acceso del equipo
          </Link>
        </div>
      </footer>
    </>
  );
}
