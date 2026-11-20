import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Gamepad2, Plus, Trash2 } from 'lucide-react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { ImageManager } from '../../components/admin/ImageManager';
import { HoursEditor, defaultHours, hoursValid } from '../../components/admin/HoursEditor';
import { Button, Empty, ErrorState, Skeleton, Switch, TextArea, TextInput, btnClass } from '../../components/ui';
import { ApiError, api } from '../../lib/api';
import { duration, money } from '../../lib/format';
import { useSettings } from '../../hooks/data';
import { useToast } from '../../hooks/toast';
import type { GameConsole, Hours } from '../../lib/types';

export function ConsolesList() {
  const { data: s } = useSettings();
  const q = useQuery({ queryKey: ['admin-consoles'], queryFn: () => api.get<{ consoles: GameConsole[] }>('/admin/consoles').then((r) => r.consoles) });
  return (
    <>
      <PageTitle
        title="Consolas"
        sub="Equipos disponibles para reservar, sus precios y horarios."
        actions={
          <Link to="/admin/consolas/nueva" className={btnClass('primary')}>
            <Plus aria-hidden /> Nueva consola
          </Link>
        }
      />
      {q.isLoading ? (
        <Skeleton h={300} r={16} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <Empty icon={<Gamepad2 />} title="Aún no hay consolas" action={<Link to="/admin/consolas/nueva" className={btnClass('primary')}>Registrar consola</Link>}>
          Registra las consolas de la tienda para que los clientes puedan reservarlas.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Consola</th>
                <th>Plataforma</th>
                <th className="num">Precio / hora</th>
                <th>Duración</th>
                <th>Horario</th>
                <th className="num">Reservas</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/admin/consolas/${c.id}`} className="row strong" style={{ '--gap': '10px', textDecoration: 'none' } as React.CSSProperties}>
                      {c.images[0] ? (
                        <img src={c.images[0].url} alt="" width={44} height={44} style={{ borderRadius: 10, objectFit: 'cover', width: 44, height: 44 }} />
                      ) : (
                        <span className="empty__icon" style={{ width: 44, height: 44, borderRadius: 10 }}>
                          <Gamepad2 size={20} />
                        </span>
                      )}
                      {c.name}
                    </Link>
                  </td>
                  <td>{c.platform}</td>
                  <td className="num">{money(c.pricePerHour, s?.currency)}</td>
                  <td className="small">
                    {duration(c.minMinutes)} – {duration(c.maxMinutes)}
                  </td>
                  <td className="small">{c.customSchedule ? 'Propio' : 'De la tienda'}</td>
                  <td className="num">{c.reservationCount ?? 0}</td>
                  <td>{c.isActive ? <span className="badge badge--ok">Activa</span> : <span className="badge">Inactiva</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

interface Form {
  name: string;
  platform: string;
  description: string;
  features: string;
  pricePerHour: string;
  minMinutes: string;
  maxMinutes: string;
  maxPlayers: string;
  sortOrder: string;
  isActive: boolean;
}
const empty: Form = { name: '', platform: '', description: '', features: '', pricePerHour: '', minMinutes: '60', maxMinutes: '240', maxPlayers: '2', sortOrder: '0', isActive: true };
const toForm = (c: GameConsole): Form => ({
  name: c.name,
  platform: c.platform,
  description: c.description ?? '',
  features: c.features.join('\n'),
  pricePerHour: String(c.pricePerHour),
  minMinutes: String(c.minMinutes),
  maxMinutes: String(c.maxMinutes),
  maxPlayers: String(c.maxPlayers),
  sortOrder: String(c.sortOrder),
  isActive: c.isActive,
});

export function ConsoleEdit() {
  const { id } = useParams();
  const isNew = !id || id === 'nueva';
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: s } = useSettings();
  const q = useQuery({
    queryKey: ['admin-console', id],
    enabled: !isNew,
    queryFn: () => api.get<{ console: GameConsole }>(`/admin/consoles/${id}`).then((r) => r.console),
  });
  const [c, setC] = useState<GameConsole | null>(null);
  const [f, setF] = useState<Form>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [custom, setCustom] = useState(false);
  const [hours, setHours] = useState<Hours[]>(defaultHours());
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    if (q.data) {
      setC(q.data);
      setF(toForm(q.data));
      setCustom(q.data.customSchedule);
      setHours(defaultHours(q.data.schedules?.length ? q.data.schedules : s?.hours));
    }
  }, [q.data, s?.hours]);

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const refresh = (next: GameConsole) => {
    setC(next);
    qc.invalidateQueries({ queryKey: ['admin-consoles'] });
    qc.invalidateQueries({ queryKey: ['public-consoles'] });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const body = {
      name: f.name,
      platform: f.platform,
      description: f.description || null,
      features: f.features.split('\n').map((x) => x.trim()).filter(Boolean),
      pricePerHour: Number(f.pricePerHour),
      minMinutes: Number(f.minMinutes),
      maxMinutes: Number(f.maxMinutes),
      maxPlayers: Number(f.maxPlayers),
      sortOrder: Number(f.sortOrder || 0),
      isActive: f.isActive,
    };
    try {
      const r = isNew ? await api.post<{ console: GameConsole }>('/admin/consoles', body) : await api.put<{ console: GameConsole }>(`/admin/consoles/${id}`, body);
      refresh(r.console);
      toast.ok(isNew ? 'Consola creada. Ahora agrega sus fotos.' : 'Cambios guardados');
      if (isNew) nav(`/admin/consolas/${r.console.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        toast.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule() {
    if (!c) return;
    if (custom && !hoursValid(hours)) return toast.error('Revisa los horarios: el cierre debe ser posterior a la apertura.');
    setSavingHours(true);
    try {
      const r = await api.put<{ console: GameConsole }>(`/admin/consoles/${c.id}/schedule`, { customSchedule: custom, days: custom ? hours : [] });
      refresh(r.console);
      toast.ok('Horario guardado');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar el horario.');
    } finally {
      setSavingHours(false);
    }
  }

  async function remove() {
    if (!c || !confirm(`¿Eliminar "${c.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.del(`/admin/consoles/${c.id}`);
      qc.invalidateQueries({ queryKey: ['admin-consoles'] });
      toast.ok('Consola eliminada');
      nav('/admin/consolas');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo eliminar.');
    }
  }

  if (!isNew && q.isLoading) return <Skeleton h={500} r={16} />;
  if (!isNew && q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  return (
    <>
      <Link to="/admin/consolas" className={btnClass('ghost', 'sm')} style={{ marginBottom: 10 }}>
        <ArrowLeft aria-hidden /> Consolas
      </Link>
      <PageTitle
        title={isNew ? 'Nueva consola' : c?.name ?? 'Consola'}
        actions={
          !isNew && (
            <Button variant="ghost" onClick={remove} icon={<Trash2 aria-hidden />}>
              Eliminar
            </Button>
          )
        }
      />
      <div className="detail-grid">
        <form className="card panel" onSubmit={submit} noValidate>
          <h2 className="panel__title">Información</h2>
          <div className="grid-2">
            <TextInput label="Nombre" value={f.name} onChange={set('name')} error={errors.name} required maxLength={120} placeholder="Ej.: Estación 1" />
            <TextInput label="Plataforma" value={f.platform} onChange={set('platform')} error={errors.platform} required maxLength={60} placeholder="Ej.: PlayStation 5" />
          </div>
          <TextArea label="Descripción" value={f.description} onChange={set('description')} error={errors.description} maxLength={4000} />
          <TextArea label="Características" hint="Una por línea (p. ej. «2 controles», «Pantalla de 55 pulgadas»)." value={f.features} onChange={set('features')} rows={4} error={errors.features} />
          <div className="grid-2">
            <TextInput label={`Precio por hora (${s?.currency ?? ''})`} type="number" min={0} step="any" inputMode="decimal" value={f.pricePerHour} onChange={set('pricePerHour')} error={errors.pricePerHour} required />
            <TextInput label="Jugadores máximos" type="number" min={1} max={16} value={f.maxPlayers} onChange={set('maxPlayers')} error={errors.maxPlayers} />
            <TextInput label="Duración mínima (min)" type="number" min={15} step={15} value={f.minMinutes} onChange={set('minMinutes')} error={errors.minMinutes} />
            <TextInput label="Duración máxima (min)" type="number" min={15} step={15} value={f.maxMinutes} onChange={set('maxMinutes')} error={errors.maxMinutes} />
            <TextInput label="Orden en la lista" type="number" min={0} value={f.sortOrder} onChange={set('sortOrder')} hint="Menor número aparece primero." />
          </div>
          <Switch checked={f.isActive} onChange={(v) => setF((x) => ({ ...x, isActive: v }))} label={f.isActive ? 'Activa: visible y reservable' : 'Inactiva: oculta al público'} />
          <div>
            <Button type="submit" variant="primary" loading={saving}>
              {isNew ? 'Crear consola' : 'Guardar cambios'}
            </Button>
          </div>
        </form>

        <div className="stack">
          <section className="card panel">
            <h2 className="panel__title">Fotos</h2>
            {c ? (
              <ImageManager<GameConsole> images={c.images} basePath={`/admin/consoles/${c.id}`} onChange={refresh} />
            ) : (
              <p className="small muted">Guarda la consola para poder subir fotos.</p>
            )}
          </section>
          <section className="card panel">
            <h2 className="panel__title">Disponibilidad y horario</h2>
            {c ? (
              <>
                <Switch checked={custom} onChange={setCustom} label={custom ? 'Horario propio para esta consola' : 'Usa el horario general de la tienda'} />
                {custom && <HoursEditor value={hours} onChange={setHours} />}
                <div>
                  <Button loading={savingHours} onClick={saveSchedule}>
                    Guardar horario
                  </Button>
                </div>
              </>
            ) : (
              <p className="small muted">Guarda la consola para configurar su horario.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
