import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { Button, ErrorState, Modal, Select, Skeleton, Switch, TextInput } from '../../components/ui';
import { ApiError, api } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { useAuth } from '../../hooks/auth';
import { useToast } from '../../hooks/toast';

interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}
interface User {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  role: { id: string; key: string; name: string };
}

export default function UsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { user: me } = useAuth();
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => api.get<{ users: User[] }>('/admin/users').then((r) => r.users) });
  const roles = useQuery({ queryKey: ['admin-roles'], queryFn: () => api.get<{ roles: Role[]; permissions: { key: string; description: string }[] }>('/admin/roles') });
  const [userModal, setUserModal] = useState<User | 'new' | null>(null);
  const [pwModal, setPwModal] = useState<User | null>(null);
  const [roleModal, setRoleModal] = useState<Role | 'new' | null>(null);

  const reload = () => {
    qc.invalidateQueries({ queryKey: ['admin-users'] });
    qc.invalidateQueries({ queryKey: ['admin-roles'] });
  };

  async function removeUser(u: User) {
    if (!confirm(`¿Eliminar al usuario ${u.username}? Para conservar su historial puedes desactivarlo en su lugar.`)) return;
    try {
      await api.del(`/admin/users/${u.id}`);
      reload();
      toast.ok('Usuario eliminado');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar.');
    }
  }
  async function removeRole(r: Role) {
    if (!confirm(`¿Eliminar el rol "${r.name}"?`)) return;
    try {
      await api.del(`/admin/roles/${r.id}`);
      reload();
      toast.ok('Rol eliminado');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar.');
    }
  }

  return (
    <>
      <PageTitle
        title="Usuarios y roles"
        sub="Solo los administradores pueden crear otras cuentas. No existe registro público."
        actions={
          <Button variant="primary" icon={<Plus aria-hidden />} onClick={() => setUserModal('new')}>
            Nuevo usuario
          </Button>
        }
      />
      {users.isLoading ? (
        <Skeleton h={200} r={16} />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => users.refetch()} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Último acceso</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.data!.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="strong">
                      {u.fullName} {u.id === me?.id && <span className="tiny muted">(tú)</span>}
                    </div>
                    <div className="tiny muted">
                      @{u.username}
                      {u.email ? ` · ${u.email}` : ''}
                    </div>
                  </td>
                  <td>{u.role.name}</td>
                  <td className="small">{u.lastLoginAt ? dateTime(u.lastLoginAt) : 'Nunca'}</td>
                  <td>
                    {!u.isActive ? (
                      <span className="badge">Inactivo</span>
                    ) : u.lockedUntil && new Date(u.lockedUntil) > new Date() ? (
                      <span className="badge badge--warn">Bloqueado</span>
                    ) : (
                      <span className="badge badge--ok">Activo</span>
                    )}
                  </td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', '--gap': '4px' } as React.CSSProperties}>
                      <Button size="sm" variant="ghost" className="btn--icon" aria-label="Editar" onClick={() => setUserModal(u)}>
                        <Pencil />
                      </Button>
                      <Button size="sm" variant="ghost" className="btn--icon" aria-label="Restablecer contraseña" onClick={() => setPwModal(u)}>
                        <KeyRound />
                      </Button>
                      {u.id !== me?.id && (
                        <Button size="sm" variant="ghost" className="btn--icon" aria-label="Eliminar" onClick={() => removeUser(u)}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="admin-head" style={{ marginTop: 40 }}>
        <div>
          <h2 className="display" style={{ fontSize: 'var(--text-xl)' }}>
            Roles y permisos
          </h2>
          <p className="muted small">El backend valida cada permiso en cada petición.</p>
        </div>
        <Button icon={<ShieldCheck aria-hidden />} onClick={() => setRoleModal('new')}>
          Nuevo rol
        </Button>
      </div>
      {roles.data && (
        <div className="table-wrap">
          <table className="table perm-matrix">
            <thead>
              <tr>
                <th>Permiso</th>
                {roles.data.roles.map((r) => (
                  <th key={r.id}>
                    <span className="row" style={{ justifyContent: 'center', '--gap': '4px' } as React.CSSProperties}>
                      {r.name}
                      {r.key !== 'superadmin' && (
                        <button className="btn btn--ghost btn--icon btn--sm" aria-label={`Editar rol ${r.name}`} onClick={() => setRoleModal(r)}>
                          <Pencil size={14} />
                        </button>
                      )}
                      {!r.isSystem && (
                        <button className="btn btn--ghost btn--icon btn--sm" aria-label={`Eliminar rol ${r.name}`} onClick={() => removeRole(r)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.data.permissions.map((p) => (
                <tr key={p.key}>
                  <td className="small">{p.description}</td>
                  {roles.data!.roles.map((r) => (
                    <td key={r.id} aria-label={r.permissions.includes(p.key) ? 'Sí' : 'No'}>
                      {r.permissions.includes(p.key) ? <span style={{ color: 'var(--ok)', fontWeight: 900 }}>✓</span> : <span className="muted">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {userModal && roles.data && <UserModal user={userModal === 'new' ? null : userModal} roles={roles.data.roles} onClose={() => setUserModal(null)} onSaved={reload} />}
      {pwModal && <PasswordModal user={pwModal} onClose={() => setPwModal(null)} />}
      {roleModal && roles.data && <RoleModal role={roleModal === 'new' ? null : roleModal} permissions={roles.data.permissions} onClose={() => setRoleModal(null)} onSaved={reload} />}
    </>
  );
}

function UserModal({ user, roles, onClose, onSaved }: { user: User | null; roles: Role[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { user: me } = useAuth();
  const assignable = roles.filter((r) => me?.isSuperadmin || r.key !== 'superadmin');
  const [f, setF] = useState({
    username: user?.username ?? '',
    fullName: user?.fullName ?? '',
    email: user?.email ?? '',
    roleId: user?.role.id ?? assignable.find((r) => r.key === 'admin')?.id ?? assignable[0]?.id ?? '',
    password: '',
    isActive: user?.isActive ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function save(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      if (user) await api.put(`/admin/users/${user.id}`, { fullName: f.fullName, email: f.email || null, roleId: f.roleId, isActive: f.isActive });
      else await api.post('/admin/users', { username: f.username, fullName: f.fullName, email: f.email || null, roleId: f.roleId, password: f.password });
      onSaved();
      toast.ok('Usuario guardado');
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        toast.error(err.code === 'DUPLICATE' ? 'Ese usuario o correo ya existe.' : err.message);
      }
    } finally {
      setBusy(false);
    }
  }
  const self = user?.id === me?.id;
  return (
    <Modal
      title={user ? `Editar ${user.username}` : 'Nuevo usuario'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={() => save()}>
            Guardar
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="stack">
        {!user && <TextInput label="Usuario" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase() })} error={errors.username} hint="Minúsculas, números, punto o guion." autoComplete="off" required />}
        <TextInput label="Nombre completo" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} error={errors.fullName} required />
        <TextInput label="Correo (opcional)" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errors.email} />
        <Select label="Rol" value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value })} disabled={self}>
          {assignable.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        {!user && (
          <TextInput
            label="Contraseña inicial"
            type="password"
            autoComplete="new-password"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            error={errors.password}
            hint="Mínimo 10 caracteres con letras y números. Compártela de forma segura."
            required
          />
        )}
        {user && !self && <Switch checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label={f.isActive ? 'Cuenta activa' : 'Cuenta desactivada'} />}
      </form>
    </Modal>
  );
}

function PasswordModal({ user, onClose }: { user: User; onClose: () => void }) {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api.post(`/admin/users/${user.id}/reset-password`, { password: pw });
      toast.ok('Contraseña restablecida. Se cerraron sus sesiones.');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.fields.password ?? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Restablecer contraseña de ${user.username}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={save}>
            Restablecer
          </Button>
        </>
      }
    >
      <TextInput label="Nueva contraseña" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={error} hint="Mínimo 10 caracteres con letras y números." />
    </Modal>
  );
}

function RoleModal({ role, permissions, onClose, onSaved }: { role: Role | null; permissions: { key: string; description: string }[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [perms, setPerms] = useState<string[]>(role?.permissions ?? []);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const body = { name, description: description || null, permissions: perms };
      if (role) await api.put(`/admin/roles/${role.id}`, body);
      else await api.post('/admin/roles', body);
      onSaved();
      toast.ok('Rol guardado');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      title={role ? `Rol: ${role.name}` : 'Nuevo rol'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={save} disabled={name.trim().length < 2}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid-2">
        <TextInput label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <TextInput label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} />
      </div>
      <fieldset className="stack" style={{ '--gap': '10px', border: 0, padding: 0, margin: 0 } as React.CSSProperties}>
        <legend className="small strong" style={{ marginBottom: 8 }}>
          Permisos
        </legend>
        {permissions.map((p) => (
          <label key={p.key} className="check">
            <input type="checkbox" checked={perms.includes(p.key)} onChange={(e) => setPerms(e.target.checked ? [...perms, p.key] : perms.filter((x) => x !== p.key))} />
            <span>
              {p.description} <span className="tiny muted mono">{p.key}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}
