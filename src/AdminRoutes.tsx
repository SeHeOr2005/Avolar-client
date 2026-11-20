import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout, ADMIN_NAV, RequirePerm } from './components/layout/AdminLayout';
import { useAuth } from './hooks/auth';
import Dashboard from './pages/admin/Dashboard';
import { ReservationDetail, ReservationsList } from './pages/admin/Reservations';
import { ConsoleEdit, ConsolesList } from './pages/admin/Consoles';
import { CategoriesPage, ProductEdit, ProductsList } from './pages/admin/Products';
import SettingsPage from './pages/admin/Settings';
import UsersPage from './pages/admin/Users';
import Account from './pages/admin/Account';
import './styles/admin.css';

/** Si el usuario no ve el dashboard, entra a la primera sección que sí puede ver. */
function AdminHome() {
  const { can } = useAuth();
  if (can('dashboard.view')) return <Dashboard />;
  const first = ADMIN_NAV.find((n) => can(n.perm));
  return first ? <Navigate to={first.to} replace /> : <Navigate to="/admin/cuenta" replace />;
}

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminHome />} />
        <Route path="reservas" element={<RequirePerm perm="reservations.view"><ReservationsList /></RequirePerm>} />
        <Route path="reservas/:id" element={<RequirePerm perm="reservations.view"><ReservationDetail /></RequirePerm>} />
        <Route path="consolas" element={<RequirePerm perm="consoles.manage"><ConsolesList /></RequirePerm>} />
        <Route path="consolas/:id" element={<RequirePerm perm="consoles.manage"><ConsoleEdit /></RequirePerm>} />
        <Route path="productos" element={<RequirePerm perm="catalog.manage"><ProductsList /></RequirePerm>} />
        <Route path="productos/:id" element={<RequirePerm perm="catalog.manage"><ProductEdit /></RequirePerm>} />
        <Route path="categorias" element={<RequirePerm perm="catalog.manage"><CategoriesPage /></RequirePerm>} />
        <Route path="configuracion" element={<RequirePerm perm="settings.manage"><SettingsPage /></RequirePerm>} />
        <Route path="usuarios" element={<RequirePerm perm="users.manage"><UsersPage /></RequirePerm>} />
        <Route path="cuenta" element={<Account />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
