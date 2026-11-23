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
import SecurityPage from './pages/admin/Security';
import ActivityPage from './pages/admin/Activity';
import CreditPage from './pages/admin/Credit';
import PosPage from './pages/admin/Pos';
import ShopInventoryPage from './pages/admin/ShopInventory';
import ShopSalesPage from './pages/admin/ShopSales';
import NewReservationPage from './pages/admin/NewReservation';
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
        <Route path="reservas/nueva" element={<RequirePerm perm="reservations.manage"><NewReservationPage /></RequirePerm>} />
        <Route path="reservas/:id" element={<RequirePerm perm="reservations.view"><ReservationDetail /></RequirePerm>} />
        <Route path="consolas" element={<RequirePerm perm="consoles.manage"><ConsolesList /></RequirePerm>} />
        <Route path="consolas/:id" element={<RequirePerm perm="consoles.manage"><ConsoleEdit /></RequirePerm>} />
        <Route path="productos" element={<RequirePerm perm="catalog.manage"><ProductsList /></RequirePerm>} />
        <Route path="productos/:id" element={<RequirePerm perm="catalog.manage"><ProductEdit /></RequirePerm>} />
        <Route path="categorias" element={<RequirePerm perm="catalog.manage"><CategoriesPage /></RequirePerm>} />
        <Route path="configuracion" element={<RequirePerm perm="settings.manage"><SettingsPage /></RequirePerm>} />
        <Route path="usuarios" element={<RequirePerm perm="users.manage"><UsersPage /></RequirePerm>} />
        <Route path="seguridad" element={<RequirePerm perm="security.view"><SecurityPage /></RequirePerm>} />
        <Route path="fiados" element={<RequirePerm perm="pos.sell"><CreditPage /></RequirePerm>} />
        <Route path="actividad" element={<RequirePerm perm="audit.view"><ActivityPage /></RequirePerm>} />
        <Route path="caja" element={<RequirePerm perm="pos.sell"><PosPage /></RequirePerm>} />
        <Route path="inventario-tienda" element={<RequirePerm perm="pos.sell"><ShopInventoryPage /></RequirePerm>} />
        <Route path="ventas-tienda" element={<RequirePerm perm="pos.reports"><ShopSalesPage /></RequirePerm>} />
        <Route path="cuenta" element={<Account />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
