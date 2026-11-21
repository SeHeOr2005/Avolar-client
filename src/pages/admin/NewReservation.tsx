import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarPlus, CalendarX } from 'lucide-react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { Button, Empty, ErrorState, Select, Skeleton, TextArea, TextInput, btnClass } from '../../components/ui';
import { ApiError, api, qs } from '../../lib/api';
import { calendar, duration, hhmm, money, todayInZone } from '../../lib/format';
import { useSettings } from '../../hooks/data';
import { useToast } from '../../hooks/toast';
import type { Availability, GameConsole } from '../../lib/types';

type Payment = 'FULL' | 'DEPOSIT' | 'NONE';

/**
 * Reserva presencial: el cliente está en la tienda y el equipo la registra.
 * Mismas reglas de horario y contra la doble reserva que la web, pero sin anticipación mínima.
 */
export default function NewReservationPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: s } = useSettings();
  const zone = s?.timezone ?? 'America/Bogota';
  const currency = s?.currency ?? 'COP';
  const consoles = useQuery({
    queryKey: ['admin-consoles'],
    queryFn: () => api.get<{ consoles: GameConsole[] }>('/admin/consoles').then((r) => r.consoles),
  });
  const active = (consoles.data ?? []).filter((c) => c.isActive);

  const [consoleId, setConsoleId] = useState('');
  const [date, setDate] = useState(() => todayInZone(zone));
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<Payment>('FULL');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!consoleId && active.length) setConsoleId(active[0].id);
  }, [active, consoleId]);
  useEffect(() => {
    setStart(null);
    setEnd(null);
  }, [consoleId, date]);

  const c = active.find((x) => x.id === consoleId);
  const avail = useQuery({
    queryKey: ['admin-availability', consoleId, date],
    enabled: Boolean(consoleId && date),
    queryFn: () => api.get<{ availability: Availability }>(`/admin/reservations/availability${qs({ consoleId, date })}`).then((r) => r.availability),
    refetchInterval: 30_000,
  });
  const a = avail.data;
  const overlaps = (from: number, to: number) => (a?.busy ?? []).some((b) => from < b.end && to > b.start);

  const starts = useMemo(() => {
    if (!a || a.open == null || a.close == null || a.earliestStart == null) return [];
    const out: { m: number; free: boolean }[] = [];
    const first = Math.ceil(a.open / a.slotMinutes) * a.slotMinutes;
    for (let m = first; m + a.minMinutes <= a.close; m += a.slotMinutes) out.push({ m, free: m >= a.earliestStart && !overlaps(m, m + a.minMinutes) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a]);
  const ends = useMemo(() => {
    if (!a || start == null || a.close == null) return [];
    const nextBusy = Math.min(...a.busy.filter((b) => b.start > start).map((b) => b.start), a.close);
    const limit = Math.min(start + a.maxMinutes, a.close, nextBusy);
    const out: number[] = [];
    for (let m = start + a.minMinutes; m <= limit; m += a.slotMinutes) out.push(m);
    return out;
  }, [a, start]);

  const minutes = start != null && end != null ? end - start : 0;
  const total = c ? Math.round(c.pricePerHour * 100 * (minutes / 60)) / 100 : 0;
  const deposit = Math.round(total * (s?.depositPercent ?? 50)) / 100;
  const paidNow = payment === 'FULL' ? total : payment === 'DEPOSIT' ? deposit : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (start == null || end == null) return toast.error('Elige la hora de inicio y de fin.');
    setBusy(true);
    setErrors({});
    try {
      const r = await api.post<{ reservation: { id: string; code: string } }>('/admin/reservations', {
        consoleId,
        date,
        startTime: hhmm(start),
        endTime: end === 1440 ? '24:00' : hhmm(end),
        customerName: name,
        customerPhone: phone,
        customerNotes: notes || null,
        payment,
        consentVerbal: consent,
      });
      toast.ok(`Reserva ${r.reservation.code} registrada`);
      ['admin-reservations', 'admin-dashboard', 'admin-availability'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      nav(`/admin/reservas/${r.reservation.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        toast.error(err.message);
        if (err.code === 'SLOT_TAKEN') {
          setStart(null);
          setEnd(null);
          avail.refetch();
        }
      }
    } finally {
      setBusy(false);
    }
  }

  if (consoles.isLoading) return <Skeleton h={500} r={16} />;
  if (consoles.isError) return <ErrorState error={consoles.error} onRetry={() => consoles.refetch()} />;

  return (
    <>
      <Link to="/admin/reservas" className={btnClass('ghost', 'sm')} style={{ marginBottom: 10 }}>
        <ArrowLeft aria-hidden /> Reservas
      </Link>
      <PageTitle title="Nueva reserva presencial" sub="Para clientes que reservan en la tienda. Puede empezar desde el bloque de horario actual." />
      {!active.length ? (
        <Empty icon={<CalendarX />} title="No hay consolas activas" action={<Link className={btnClass('primary')} to="/admin/consolas">Ir a consolas</Link>}>
          Activa o registra una consola para poder reservar.
        </Empty>
      ) : (
        <form className="detail-grid" onSubmit={submit} noValidate>
          <div className="stack">
            <section className="card panel">
              <h2 className="panel__title">Consola y horario</h2>
              <div className="grid-2">
                <Select label="Consola" value={consoleId} onChange={(e) => setConsoleId(e.target.value)}>
                  {active.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} · {x.platform} · {money(x.pricePerHour, currency)}/h
                    </option>
                  ))}
                </Select>
                <TextInput label="Fecha" type="date" value={date} min={todayInZone(zone)} max={todayInZone(zone, s?.bookingWindowDays ?? 30)} onChange={(e) => e.target.value && setDate(e.target.value)} hint={<span className="cap">{calendar(date).long}</span>} />
              </div>

              {avail.isLoading ? (
                <Skeleton h={120} />
              ) : avail.isError ? (
                <ErrorState error={avail.error} onRetry={() => avail.refetch()} />
              ) : a && (a.reason || !starts.some((x) => x.free)) ? (
                <div className="alert alert--warn">{a.reason ?? 'No quedan horarios libres en este día.'}</div>
              ) : a ? (
                <>
                  <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
                    <h3 className="small strong">Inicio</h3>
                    <div className="slot-grid" role="radiogroup" aria-label="Hora de inicio">
                      {starts.map((x) => (
                        <button
                          key={x.m}
                          type="button"
                          role="radio"
                          className="chip"
                          aria-checked={start === x.m}
                          disabled={!x.free}
                          onClick={() => {
                            setStart(x.m);
                            setEnd(x.m + a.minMinutes);
                          }}
                        >
                          {hhmm(x.m)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {start != null && (
                    <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
                      <h3 className="small strong">Fin</h3>
                      <div className="slot-grid" role="radiogroup" aria-label="Hora de fin">
                        {ends.map((m) => (
                          <button key={m} type="button" role="radio" className="chip" aria-checked={end === m} onClick={() => setEnd(m)}>
                            {hhmm(m)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </section>

            <section className="card panel">
              <h2 className="panel__title">Cliente</h2>
              <div className="grid-2">
                <TextInput label="Nombre" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} error={errors.customerName} required autoComplete="off" />
                <TextInput label="Teléfono" type="tel" inputMode="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} error={errors.customerPhone} required autoComplete="off" />
              </div>
              <TextArea label="Notas (opcional)" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <div className="consent">
                <label className="check consent__check">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={errors.consentVerbal ? true : undefined} />
                  <span>
                    El cliente <strong>autorizó de palabra</strong> el tratamiento de sus datos y conoce los{' '}
                    <a className="link" href="/terminos" target="_blank" rel="noopener noreferrer">
                      Términos
                    </a>
                    .
                  </span>
                </label>
                {errors.consentVerbal && (
                  <span className="field__error" role="alert">
                    {errors.consentVerbal}
                  </span>
                )}
              </div>
            </section>
          </div>

          <aside className="card panel" style={{ position: 'sticky', top: 18 }}>
            <h2 className="panel__title">Resumen y pago</h2>
            <dl className="kv" style={{ gridTemplateColumns: '1fr' }}>
              <div>
                <dt>Horario</dt>
                <dd>{start != null && end != null ? `${hhmm(start)} – ${hhmm(end)} (${duration(minutes)})` : '—'}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd style={{ fontSize: '1.4rem' }}>{money(total, currency)}</dd>
              </div>
              <div>
                <dt>Anticipo ({s?.depositPercent ?? 50} %)</dt>
                <dd>{money(deposit, currency)}</dd>
              </div>
            </dl>
            <fieldset className="stack" style={{ '--gap': '8px', border: 0, padding: 0, margin: 0 } as React.CSSProperties}>
              <legend className="small strong" style={{ marginBottom: 8 }}>
                ¿Cómo queda el pago?
              </legend>
              {(
                [
                  ['FULL', 'Pagó todo', 'Queda confirmada'],
                  ['DEPOSIT', 'Pagó el anticipo', 'Queda confirmada; el saldo se cobra al jugar'],
                  ['NONE', 'Pendiente de pago', 'No se confirma ni vence sola'],
                ] as const
              ).map(([v, label, hint]) => (
                <label key={v} className="pay-option" data-checked={payment === v}>
                  <input type="radio" name="payment" value={v} checked={payment === v} onChange={() => setPayment(v)} />
                  <span>
                    <strong>{label}</strong>
                    <span className="tiny muted">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="small">
              Se registra como pagado: <strong>{money(paidNow, currency)}</strong>
            </p>
            <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={start == null || end == null} icon={<CalendarPlus aria-hidden />}>
              Registrar reserva
            </Button>
          </aside>
        </form>
      )}
    </>
  );
}
