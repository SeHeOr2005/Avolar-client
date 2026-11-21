import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  ExternalLink,
  Gamepad2,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Boxes,
  Receipt,
  ScanBarcode,
  Settings,
  ShieldCheck,
  Shirt,
  Tags,
  UserCog,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/auth';
import { Button, Logo, Modal, ThemeToggle } from '../ui';
import { setLogoutReason, useIdleLogout } from '../../hooks/idle';

export const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view', end: true },
  { to: '/admin/caja', label: 'Caja', icon: ScanBarcode, perm: 'pos.sell' },
  { to: '/admin/reservas', label: 'Reservas', icon: CalendarClock, perm: 'reservations.view' },
  { to: '/admin/consolas', label: 'Consolas', icon: Gamepad2, perm: 'consoles.manage' },
  { to: '/admin/productos', label: 'Productos', icon: Shirt, perm: 'catalog.manage' },
  { to: '/admin/categorias', label: 'Categorías', icon: Tags, perm: 'catalog.manage' },
  { to: '/admin/inventario-tienda', label: 'Inventario tienda', icon: Boxes, perm: 'pos.sell' },
  { to: '/admin/ventas-tienda', label: 'Ventas tienda', icon: Receipt, perm: 'pos.reports' },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings, perm: 'settings.manage' },
  { to: '/admin/usuarios', label: 'Usuarios y roles', icon: UserCog, perm: 'users.manage' },
  { to: '/admin/actividad', label: 'Actividad', icon: History, perm: 'audit.view' },
  { to: '/admin/seguridad', label: 'Seguridad', icon: ShieldCheck, perm: 'security.view' },
];

export function AdminLayout() {
  const { user, loading, logout, can } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);

  // Cierre automático tras 30 min sin actividad del usuario.
  const onIdle = useCallback(() => {
    setLogoutReason('idle');
    void logout().then(() => navigate('/admin/login', { replace: true }));
  }, [logout, navigate]);
  const { remainingMs, stayActive } = useIdleLogout(onIdle, Boolean(user));

  // Si el navegador restaura el panel desde su caché (botón Atrás tras cerrar sesión), se recarga
  // para que la verificación de sesión decida qué mostrar y no quede contenido viejo a la vista.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && window.location.reload();
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

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
      {remainingMs != null && (
        <Modal
          title="¿Sigues ahí?"
          onClose={stayActive}
          footer={
            <>
              <Button variant="ghost" onClick={onIdle}>
                Cerrar sesión
              </Button>
              <Button variant="primary" onClick={stayActive}>
                Seguir conectado
              </Button>
            </>
          }
        >
          <p>
            Por seguridad, tu sesión se cerrará en{' '}
            <strong className="num" aria-live="polite">
              {Math.floor(remainingMs / 60000)}:{String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0')}
            </strong>{' '}
            por inactividad.
          </p>
        </Modal>
      )}
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
    document.title = `${title} · Panel A volar`;
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
