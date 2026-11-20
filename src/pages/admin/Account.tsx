import { useState, type FormEvent } from 'react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { Button, TextInput } from '../../components/ui';
import { ApiError, api } from '../../lib/api';
import { useAuth } from '../../hooks/auth';
import { useToast } from '../../hooks/toast';

export default function Account() {
  const { user } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) return setErrors({ confirm: 'Las contraseñas no coinciden.' });
    setBusy(true);
    setErrors({});
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      toast.ok('Contraseña actualizada. Se cerraron tus otras sesiones.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      if (err instanceof ApiError) setErrors(Object.keys(err.fields).length ? err.fields : { _: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle title="Mi cuenta" sub={`${user?.fullName} · @${user?.username} · ${user?.role.name}`} />
      <form className="card panel" style={{ maxWidth: 520 }} onSubmit={submit}>
        <h2 className="panel__title">Cambiar contraseña</h2>
        <TextInput label="Contraseña actual" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.currentPassword} required />
        <TextInput label="Nueva contraseña" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={errors.newPassword} hint="Mínimo 10 caracteres con letras y números." required />
        <TextInput label="Repite la nueva contraseña" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} required />
        {errors._ && <div className="alert alert--danger">{errors._}</div>}
        <div>
          <Button type="submit" variant="primary" loading={busy}>
            Actualizar contraseña
          </Button>
        </div>
      </form>
    </>
  );
}
