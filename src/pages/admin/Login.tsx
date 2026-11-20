import { useEffect, useState, type FormEvent } from 'react';
import { clearLogoutReason, peekLogoutReason } from '../../hooks/idle';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button, Logo, TextInput, ThemeToggle } from '../../components/ui';
import { useAuth } from '../../hooks/auth';
import { ApiError } from '../../lib/api';
import { useDocumentTitle } from '../../hooks/data';
// El login se carga aparte del panel: necesita sus propios estilos aunque se entre directo a /admin/login.
import '../../styles/admin.css';

export default function Login() {
  useDocumentTitle('Acceso del equipo');
  const { user, login, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string; reason?: string } };
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason] = useState(() => peekLogoutReason() ?? loc.state?.reason ?? null);
  // El aviso se muestra una sola vez: al recargar el login ya no aparece.
  useEffect(() => clearLogoutReason(), []);

  if (!loading && user) return <Navigate to={loc.state?.from ?? '/admin'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      nav(loc.state?.from ?? '/admin', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="card login__card" onSubmit={submit}>
        <Logo height={80} />
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 'var(--text-lg)' }}>Panel de administración</h1>
          <p className="small muted">Acceso exclusivo para el equipo de la tienda.</p>
        </div>
        {reason === 'idle' && (
          <div className="alert alert--warn" role="status">
            Cerramos tu sesión tras 30 minutos sin actividad. Vuelve a ingresar para continuar.
          </div>
        )}
        <TextInput label="Usuario o correo" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        <TextInput
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        )}
        <Button type="submit" variant="primary" block loading={busy} icon={<LogIn aria-hidden />}>
          Entrar
        </Button>
        <div className="spread">
          <Link to="/" className="small link">
            ← Volver al sitio
          </Link>
          <ThemeToggle compact />
        </div>
      </form>
    </div>
  );
}
