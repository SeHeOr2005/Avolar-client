import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { Button, ErrorState, Modal, Skeleton, Switch, TextInput } from '../ui';
import { ApiError, api } from '../../lib/api';
import { useToast } from '../../hooks/toast';
import type { PaymentMethod } from '../../lib/types';

type Draft = { id?: string; name: string; accountNumber: string; accountHolder: string; accountType: string; details: string; isActive: boolean; sortOrder: number };

/** Medios de pago del anticipo (Nequi, Daviplata, cuentas…). El primero activo se muestra como recomendado. */
export function PaymentMethodsAdmin() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: ['admin-payment-methods'],
    queryFn: () => api.get<{ paymentMethods: PaymentMethod[] }>('/admin/settings/payment-methods').then((r) => r.paymentMethods),
  });
  const [edit, setEdit] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const done = (list: PaymentMethod[]) => {
    qc.setQueryData(['admin-payment-methods'], list);
    qc.invalidateQueries({ queryKey: ['public-settings'] });
    qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };
  const body = (d: Draft) => ({
    name: d.name,
    accountNumber: d.accountNumber,
    accountHolder: d.accountHolder || null,
    accountType: d.accountType || null,
    details: d.details || null,
    isActive: d.isActive,
    sortOrder: d.sortOrder,
  });

  async function save() {
    if (!edit) return;
    setBusy(true);
    setErrors({});
    try {
      const r = edit.id
        ? await api.put<{ paymentMethods: PaymentMethod[] }>(`/admin/settings/payment-methods/${edit.id}`, body(edit))
        : await api.post<{ paymentMethods: PaymentMethod[] }>('/admin/settings/payment-methods', body(edit));
      done(r.paymentMethods);
      toast.ok('Medio de pago guardado');
      setEdit(null);
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields);
        toast.error(e.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: PaymentMethod) {
    if (!confirm(`¿Eliminar ${m.name}? Los clientes dejarán de verlo.`)) return;
    try {
      done((await api.del<{ paymentMethods: PaymentMethod[] }>(`/admin/settings/payment-methods/${m.id}`)).paymentMethods);
      toast.ok('Medio de pago eliminado');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar.');
    }
  }

  /** Sube (o reemplaza) el logo oficial del medio de pago. */
  async function uploadLogo(m: PaymentMethod, file: File | undefined) {
    if (!file) return;
    if (!['image/png', 'image/webp', 'image/jpeg', 'image/avif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error('Usa una imagen PNG, WEBP o JPG de hasta 5 MB (ideal PNG con fondo transparente).');
      return;
    }
    const fd = new FormData();
    fd.append('logo', file);
    try {
      done((await api.post<{ paymentMethods: PaymentMethod[] }>(`/admin/settings/payment-methods/${m.id}/logo`, fd)).paymentMethods);
      toast.ok(`Logo de ${m.name} actualizado`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo subir el logo.');
    }
  }

  async function removeLogo(m: PaymentMethod) {
    try {
      done((await api.del<{ paymentMethods: PaymentMethod[] }>(`/admin/settings/payment-methods/${m.id}/logo`)).paymentMethods);
      toast.ok('Logo eliminado');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo quitar el logo.');
    }
  }

  /** Reordena intercambiando posiciones y renumerando 0..n. */
  async function move(idx: number, dir: -1 | 1) {
    const list = [...(q.data ?? [])];
    const j = idx + dir;
    if (j < 0 || j >= list.length) return;
    [list[idx], list[j]] = [list[j], list[idx]];
    try {
      let last: PaymentMethod[] = list;
      for (const [i, m] of list.entries()) {
        if (m.sortOrder === i) continue;
        last = (
          await api.put<{ paymentMethods: PaymentMethod[] }>(`/admin/settings/payment-methods/${m.id}`, {
            ...body({ ...m, accountHolder: m.accountHolder ?? '', accountType: m.accountType ?? '', details: m.details ?? '', isActive: m.isActive ?? true, sortOrder: i }),
          })
        ).paymentMethods;
      }
      done(last);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo reordenar.');
    }
  }

  const list = q.data ?? [];

  return (
    <section className="card panel">
      <div className="spread">
        <h2 className="panel__title">Medios de pago del anticipo</h2>
        <Button
          size="sm"
          icon={<Plus aria-hidden />}
          onClick={() => setEdit({ name: '', accountNumber: '', accountHolder: '', accountType: '', details: '', isActive: true, sortOrder: list.length })}
        >
          Agregar
        </Button>
      </div>
      <p className="small muted">
        El cliente los ve al reservar y en su ticket, en este orden. El primero aparece como recomendado. Con el botón de imagen
        sube el <strong>logo oficial</strong> de cada uno (PNG con fondo transparente, mínimo 48×48 px).
      </p>
      {q.isLoading ? (
        <Skeleton h={80} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !list.length ? (
        <div className="alert alert--warn">Aún no hay medios de pago. Agrega al menos uno (por ejemplo Nequi) para que los clientes sepan dónde pagar.</div>
      ) : (
        <ul className="list">
          {list.map((m, i) => (
            <li key={m.id} style={m.isActive ? undefined : { opacity: 0.55 }}>
              <span className="row" style={{ '--gap': '10px', minWidth: 0 } as React.CSSProperties}>
                {m.logoUrl ? (
                  <img src={m.logoUrl} alt="" width={36} height={36} style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8, background: '#fff', flex: 'none' }} />
                ) : (
                  <Wallet size={18} aria-hidden style={{ color: 'var(--brand)', flex: 'none' }} />
                )}
                <span className="stack" style={{ '--gap': '0', minWidth: 0 } as React.CSSProperties}>
                  <strong>
                    {m.name} {!m.isActive && <span className="tiny muted">(oculto)</span>}
                  </strong>
                  <span className="small mono">{m.accountNumber}</span>
                </span>
              </span>
              <span className="row" style={{ '--gap': '2px', flexWrap: 'nowrap' } as React.CSSProperties}>
                <label className="btn btn--ghost btn--icon btn--sm" title={m.logoUrl ? 'Cambiar logo' : 'Subir logo'}>
                  <input type="file" accept="image/png,image/webp,image/jpeg,image/avif" className="sr-only" aria-label={`Logo de ${m.name}`} onChange={(e) => { void uploadLogo(m, e.target.files?.[0]); e.target.value = ''; }} />
                  <ImagePlus aria-hidden />
                </label>
                {m.logoUrl && (
                  <Button size="sm" variant="ghost" className="btn--sm" onClick={() => removeLogo(m)}>
                    Quitar logo
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="btn--icon" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button size="sm" variant="ghost" className="btn--icon" aria-label="Bajar" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="btn--icon"
                  aria-label={`Editar ${m.name}`}
                  onClick={() =>
                    setEdit({
                      id: m.id,
                      name: m.name,
                      accountNumber: m.accountNumber,
                      accountHolder: m.accountHolder ?? '',
                      accountType: m.accountType ?? '',
                      details: m.details ?? '',
                      isActive: m.isActive ?? true,
                      sortOrder: m.sortOrder ?? i,
                    })
                  }
                >
                  <Pencil />
                </Button>
                <Button size="sm" variant="ghost" className="btn--icon" aria-label={`Eliminar ${m.name}`} onClick={() => remove(m)}>
                  <Trash2 />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {edit && (
        <Modal
          title={edit.id ? `Editar ${edit.name}` : 'Nuevo medio de pago'}
          onClose={() => setEdit(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEdit(null)}>
                Cancelar
              </Button>
              <Button variant="primary" loading={busy} onClick={save}>
                Guardar
              </Button>
            </>
          }
        >
          <div className="grid-2">
            <TextInput label="Nombre" placeholder="Nequi, Daviplata, Bancolombia…" value={edit.name} maxLength={60} onChange={(e) => setEdit({ ...edit, name: e.target.value })} error={errors.name} required />
            <TextInput
              label="Número o cuenta"
              inputMode="numeric"
              placeholder="3001234567"
              value={edit.accountNumber}
              maxLength={40}
              onChange={(e) => setEdit({ ...edit, accountNumber: e.target.value })}
              error={errors.accountNumber}
              required
            />
            <TextInput label="Titular (opcional)" value={edit.accountHolder} maxLength={120} onChange={(e) => setEdit({ ...edit, accountHolder: e.target.value })} />
            <TextInput label="Tipo (opcional)" placeholder="Ahorros, corriente, llave…" value={edit.accountType} maxLength={60} onChange={(e) => setEdit({ ...edit, accountType: e.target.value })} />
          </div>
          <TextInput label="Nota (opcional)" placeholder="Ej.: envía el comprobante con tu número de reserva" value={edit.details} maxLength={500} onChange={(e) => setEdit({ ...edit, details: e.target.value })} />
          <Switch checked={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} label={edit.isActive ? 'Visible para los clientes' : 'Oculto'} />
        </Modal>
      )}
    </section>
  );
}
