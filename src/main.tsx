import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './hooks/theme';
import { ToastProvider } from './hooks/toast';
import { AuthProvider } from './hooks/auth';
import { PublicLayout } from './components/layout/PublicLayout';
import { ApiError } from './lib/api';
import Home from './pages/public/Home';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/public.css';

// Páginas públicas secundarias y todo el panel se cargan bajo demanda.
const Consoles = lazy(() => import('./pages/public/Consoles'));
const BookConsole = lazy(() => import('./pages/public/BookConsole'));
const ReservationTicket = lazy(() => import('./pages/public/ReservationTicket'));
const LookupPage = lazy(() => import('./pages/public/ReservationTicket').then((m) => ({ default: () => <m.Lookup /> })));
const Catalog = lazy(() => import('./pages/public/Catalog'));
const ProductDetail = lazy(() => import('./pages/public/ProductDetail'));
const StoreInfo = lazy(() => import('./pages/public/StoreInfo').then((m) => ({ default: m.StoreInfo })));
const Contact = lazy(() => import('./pages/public/StoreInfo').then((m) => ({ default: m.Contact })));
const AdminRoutes = lazy(() => import('./AdminRoutes'));
const Login = lazy(() => import('./pages/admin/Login'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => !(err instanceof ApiError && [401, 403, 404].includes(err.status)) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

function Fallback() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}>
      <span className="spinner" style={{ width: 28, height: 28 }} aria-label="Cargando" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="container page-head" style={{ textAlign: 'center' }}>
      <p className="eyebrow">Error 404</p>
      <h1 className="display">Por aquí no es</h1>
      <p style={{ marginInline: 'auto' }}>La página que buscas no existe o cambió de lugar.</p>
      <div className="row" style={{ justifyContent: 'center', marginTop: 24 }}>
        <Link to="/" className="btn btn--primary">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <Suspense fallback={<Fallback />}>
                <Routes>
                  <Route element={<PublicLayout />}>
                    <Route index element={<Home />} />
                    <Route path="reservar" element={<Consoles />} />
                    <Route path="reservar/:slug" element={<BookConsole />} />
                    <Route path="reserva/:code" element={<ReservationTicket />} />
                    <Route path="mi-reserva" element={<LookupPage />} />
                    <Route path="catalogo" element={<Catalog />} />
                    <Route path="catalogo/:slug" element={<ProductDetail />} />
                    <Route path="tienda" element={<StoreInfo />} />
                    <Route path="contacto" element={<Contact />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                  <Route path="admin/login" element={<Login />} />
                  <Route path="admin/*" element={<AdminRoutes />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
