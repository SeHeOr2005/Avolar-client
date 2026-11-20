import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  CalendarClock,
  ExternalLink,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shirt,
  Tags,
  UserCog,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/auth';
import { Logo, ThemeToggle } from '../ui';

export const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view', end: true },
  { to: '/admin/reservas', label: 'Reservas', icon: CalendarClock, perm: 'reservations.view' },
  { to: '/admin/consolas', label: 'Consolas', icon: Gamepad2, perm: 'consoles.manage' },
  { to: '/admin/productos', label: 'Productos', icon: Shirt, perm: 'catalog.manage' },
  { to: '/admin/categorias', label: 'Categorías', icon: Tags, perm: 'catalog.manage' },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings, perm: 'settings.manage' },
  { to: '/admin/usuarios', label: 'Usuarios y roles', icon: UserCog, perm: 'users.manage' },
];

export function AdminLayout() {
  const { user, loading, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <span className="spinner" style={{ width: 32, height: 32 }} aria-label="Cargando" />
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;

  const nav = ADMIN_NAV.filter((n) => can(n.perm));

  return (
    <div className="admin">
      <a className="skip-link" href="#admin-main">
        Saltar al contenido
      </a>
      <aside className={`admin-side ${open ? 'is-open' : ''}`} aria-label="Navegación del panel">
        <div className="admin-side__top">
          <Link to="/admin" className="admin-side__logo">
            <Logo height={38} />
          </Link>
          <button className="btn btn--ghost btn--icon admin-side__close" onClick={() => setOpen(false)} aria-label="Cerrar menú">
            <X />
          </button>
        </div>
        <nav className="admin-nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="admin-nav__link">
              <n.icon aria-hidden />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="admin-side__foot">
          <ThemeToggle />
          <a href="/" target="_blank" rel="noopener noreferrer" className="admin-nav__link">
            <ExternalLink aria-hidden /> <span>Ver sitio público</span>
          </a>
          <NavLink to="/admin/cuenta" className="admin-nav__link">
            <UserRound aria-hidden />
            <span className="stack" style={{ '--gap': '0' } as React.CSSProperties}>
              <span>{user.fullName}</span>
              <span className="tiny muted">{user.role.name}</span>
            </span>
          </NavLink>
          <button className="admin-nav__link" onClick={() => logout()}>
            <LogOut aria-hidden /> <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      {open && <div className="admin-scrim" onClick={() => setOpen(false)} aria-hidden />}
      <div className="admin-main">
        <header className="admin-topbar">
          <button className="btn btn--icon" onClick={() => setOpen(true)} aria-label="Abrir menú" aria-expanded={open}>
            <Menu />
          </button>
          <Logo height={30} />
          <span style={{ width: 42 }} />
        </header>
        <main id="admin-main" className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Bloquea una vista si el usuario no tiene el permiso (el backend también lo valida). */
export function RequirePerm({ perm, children }: { perm: string; children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can(perm)) {
    return (
      <div className="alert alert--warn" role="alert">
        No tienes permiso para ver esta sección. Pide acceso a un superadministrador.
      </div>
    );
  }
  return <>{children}</>;
}

export function PageTitle({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Panel AVOLAR`;
  }, [title]);
  return (
    <div className="admin-head">
      <div>
        <h1 className="display">{title}</h1>
        {sub && <p className="muted small">{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}
