import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageTitle } from '../../components/layout/AdminLayout';
import { HoursEditor, defaultHours, hoursValid } from '../../components/admin/HoursEditor';
import { PaymentMethodsAdmin } from '../../components/admin/PaymentMethodsAdmin';
import { Button, ErrorState, Select, Skeleton, Switch, TextArea, TextInput } from '../../components/ui';
import { ApiError, api } from '../../lib/api';
import { useToast } from '../../hooks/toast';
import type { Hours } from '../../lib/types';

type S = Record<string, string | number | boolean | null>;

const TIMEZONES = ['America/Bogota', 'America/Mexico_City', 'America/Lima', 'America/Guayaquil', 'America/Caracas', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/New_York', 'Europe/Madrid'];

export default function SettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin-settings'], queryFn: () => api.get<{ settings: S; hours: Hours[] }>('/admin/settings') });
  const [f, setF] = useState<S | null>(null);
  const [hours, setHours] = useState<Hours[]>(defaultHours());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    if (q.data) {
      setF(q.data.settings);
      setHours(defaultHours(q.data.hours));
    }
  }, [q.data]);

  if (q.isLoading || (!f && !q.isError)) return <Skeleton h={600} r={16} />;
  if (q.isError || !f) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const str = (k: string) => (f[k] == null ? '' : String(f[k]));
  const bind = (k: string) => ({
    value: str(k),
    onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }),
    error: errors[k],
  });

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const body = {
      businessName: str('businessName'),
      tagline: str('tagline') || null,
      about: str('about') || null,
      whatsappNumber: str('whatsappNumber') || null,
      phone: str('phone') || null,
      email: str('email') || null,
      address: str('address') || null,
      city: str('city') || null,
      mapsUrl: str('mapsUrl') || null,
      instagramUrl: str('instagramUrl') || null,
      tiktokUrl: str('tiktokUrl') || null,
      facebookUrl: str('facebookUrl') || null,
      currency: str('currency'),
      timezone: str('timezone'),
      depositPercent: Number(f!.depositPercent),
      slotMinutes: Number(f!.slotMinutes),
      bookingWindowDays: Number(f!.bookingWindowDays),
      minLeadMinutes: Number(f!.minLeadMinutes),
      paymentHoldMinutes: Number(f!.paymentHoldMinutes),
      lowStockThreshold: Number(f!.lowStockThreshold),
      paymentInstructions: str('paymentInstructions') || null,
      reservationsEnabled: Boolean(f!.reservationsEnabled),
    };
    try {
      const r = await api.put<{ settings: S }>('/admin/settings', body);
      setF(r.settings);
      qc.invalidateQueries({ queryKey: ['public-settings'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      toast.ok('Configuración guardada');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        toast.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveHours() {
    if (!hoursValid(hours)) return toast.error('Revisa los horarios: el cierre debe ser posterior a la apertura.');
    setSavingHours(true);
    try {
      await api.put('/admin/settings/hours', { hours });
      qc.invalidateQueries({ queryKey: ['public-settings'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      toast.ok('Horario guardado');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setSavingHours(false);
    }
  }

  return (
    <>
      <PageTitle title="Configuración" sub="Datos de la tienda, contacto, horarios y reglas de reserva." />
      <div className="detail-grid">
        <form className="stack" onSubmit={save} noValidate>
          <section className="card panel">
            <h2 className="panel__title">Tienda</h2>
            <TextInput label="Nombre comercial" {...bind('businessName')} maxLength={120} required />
            <TextInput label="Frase corta" {...bind('tagline')} maxLength={200} />
            <TextArea label="Sobre nosotros" {...bind('about')} maxLength={4000} />
          </section>
          <section className="card panel">
            <h2 className="panel__title">Contacto y redes</h2>
            <TextInput
              label="Número de WhatsApp"
              {...bind('whatsappNumber')}
              inputMode="tel"
              placeholder="573001234567"
              hint="Con indicativo de país y sin espacios. Se usa en todos los botones de WhatsApp del sitio."
            />
            <div className="grid-2">
              <TextInput label="Teléfono" {...bind('phone')} maxLength={30} />
              <TextInput label="Correo" type="email" {...bind('email')} maxLength={160} />
              <TextInput label="Dirección" {...bind('address')} maxLength={255} />
              <TextInput label="Ciudad" {...bind('city')} maxLength={120} />
            </div>
            <TextInput label="Enlace de Google Maps" {...bind('mapsUrl')} placeholder="https://maps.google.com/…" />
            <div className="grid-3">
              <TextInput label="Instagram" {...bind('instagramUrl')} placeholder="https://instagram.com/…" />
              <TextInput label="TikTok" {...bind('tiktokUrl')} placeholder="https://tiktok.com/@…" />
              <TextInput label="Facebook" {...bind('facebookUrl')} placeholder="https://facebook.com/…" />
            </div>
          </section>
          <section className="card panel">
            <h2 className="panel__title">Reservas y pagos</h2>
            <Switch checked={Boolean(f.reservationsEnabled)} onChange={(v) => setF({ ...f, reservationsEnabled: v })} label={f.reservationsEnabled ? 'Reservas en línea activas' : 'Reservas en línea pausadas'} />
            <TextArea
              label="Instrucciones para el depósito del anticipo"
              {...bind('paymentInstructions')}
              rows={5}
              maxLength={4000}
              hint="Texto adicional que ve el cliente después de reservar. Los números de Nequi, cuentas, etc. van en «Medios de pago del anticipo»."
            />
            <div className="grid-3">
              <TextInput label="Anticipo (%)" type="number" min={0} max={100} {...bind('depositPercent')} />
              <Select label="Intervalo de horarios" {...bind('slotMinutes')}>
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
                <option value="60">60 minutos</option>
              </Select>
              <TextInput label="Días de anticipación máx." type="number" min={1} max={365} {...bind('bookingWindowDays')} />
              <TextInput label="Anticipación mínima (min)" type="number" min={0} {...bind('minLeadMinutes')} hint="Tiempo mínimo antes del inicio." />
              <TextInput label="Plazo para pagar (min)" type="number" min={0} {...bind('paymentHoldMinutes')} hint="0 = sin vencimiento automático." />
              <TextInput label="Alerta de poco stock" type="number" min={0} {...bind('lowStockThreshold')} hint="Unidades o menos." />
            </div>
            <div className="grid-2">
              <TextInput label="Moneda (ISO)" maxLength={3} {...bind('currency')} hint="Ej.: COP, MXN, USD." />
              <Select label="Zona horaria" {...bind('timezone')}>
                {[...new Set([str('timezone'), ...TIMEZONES])].map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </Select>
            </div>
          </section>
          <div>
            <Button type="submit" variant="primary" size="lg" loading={saving}>
              Guardar configuración
            </Button>
          </div>
        </form>
        <div className="stack">
        <PaymentMethodsAdmin />
        <section className="card panel">
          <h2 className="panel__title">Horario de atención</h2>
          <p className="small muted">Las consolas sin horario propio solo se pueden reservar dentro de este horario.</p>
          <HoursEditor value={hours} onChange={setHours} />
          <div>
            <Button loading={savingHours} onClick={saveHours}>
              Guardar horario
            </Button>
          </div>
        </section>
        </div>
      </div>
    </>
  );
}
