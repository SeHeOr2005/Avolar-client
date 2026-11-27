import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarPlus, CalendarX, Clock } from 'lucide-react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { Button, Empty, ErrorState, Select, Skeleton, TextArea, TextInput, btnClass } from '../../components/ui';
import { ApiError, api, qs } from '../../lib/api';
import { calendar, duration, hhmm, hhmmToMin, money, nowMinuteInZone, todayInZone } from '../../lib/format';
import { useSettings } from '../../hooks/data';
import { useToast } from '../../hooks/toast';
import type { Availability, GameConsole } from '../../lib/types';

type Payment = 'FULL' | 'DEPOSIT' | 'NONE';

/**
 * Reserva presencial: el cliente está en la tienda y el equipo la registra.
 * Se anota la hora exacta en que empezaron (al minuto, hasta 60 min atrás) y la duración en bloques.
 * Mismas reglas contra la doble reserva que la web, pero sin anticipación mínima.
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
  const [length, setLength] = useState<number | null>(null);
  const end = start != null && length != null ? start + length : null;
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
    setLength(null);
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

  const isToday = date === todayInZone(zone);

  /** Bloques sugeridos (atajos); la hora exacta se escribe en el campo. */
  const starts = useMemo(() => {
    if (!a || a.open == null || a.close == null || a.earliestStart == null) return [];
    const out: { m: number; free: boolean }[] = [];
    const first = Math.ceil(a.open / a.slotMinutes) * a.slotMinutes;
    for (let m = first; m + a.minMinutes <= a.close; m += a.slotMinutes) out.push({ m, free: m >= a.earliestStart && !overlaps(m, m + a.minMinutes) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a]);

  /** Por qué la hora de inicio escrita no sirve (o null si sirve). */
  const startProblem = useMemo(() => {
    if (!a || start == null || a.open == null || a.close == null || a.earliestStart == null) return null;
    if (start < a.open) return `Abre a las ${hhmm(a.open)}.`;
    if (start < a.earliestStart) return isToday ? 'Puede ser como máximo 60 minutos antes de ahora.' : 'Esa hora no está disponible.';
    if (start + a.minMinutes > a.close) return `Cierra a las ${hhmm(a.close)}: no alcanza la duración mínima (${duration(a.minMinutes)}).`;
    const hit = a.busy.find((b) => start < b.end && start + a.minMinutes > b.start);
    if (hit) return `Ocupada de ${hhmm(hit.start)} a ${hit.end >= 1440 ? '24:00' : hhmm(hit.end)}.`;
    return null;
  }, [a, start, isToday]);

  /** Duraciones posibles desde la hora de inicio (en bloques), hasta el cierre o la siguiente reserva. */
  const lengths = useMemo(() => {
    if (!a || start == null || a.close == null || startProblem) return [];
    const nextBusy = Math.min(...a.busy.filter((b) => b.start >= start).map((b) => b.start), a.close);
    const limit = Math.min(start + a.maxMinutes, a.close, nextBusy);
    const out: number[] = [];
    for (let d = a.minMinutes; start + d <= limit; d += a.slotMinutes) out.push(d);
    return out;
  }, [a, start, startProblem]);

  // Si la duración elegida ya no cabe con la nueva hora de inicio, se ajusta a la mínima.
  useEffect(() => {
    if (length != null && !lengths.includes(length)) setLength(lengths[0] ?? null);
    if (length == null && lengths.length) setLength(lengths[0]);
  }, [lengths, length]);

  const pickNow = () => {
    if (!a || a.open == null) return;
    setStart(Math.max(a.open, nowMinuteInZone(zone)));
  };
  // Hoy, por defecto empieza "ahora" (lo más común en la tienda).
  useEffect(() => {
    if (isToday && start == null && a && !a.reason && a.open != null) setStart(Math.max(a.open, nowMinuteInZone(zone)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, isToday]);

  const minutes = start != null && end != null ? end - start : 0;
  const total = c ? Math.round(c.pricePerHour * 100 * (minutes / 60)) / 100 : 0;
  const deposit = Math.round(total * (s?.depositPercent ?? 50)) / 100;
  const paidNow = payment === 'FULL' ? total : payment === 'DEPOSIT' ? deposit : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (start == null || end == null || startProblem) return toast.error(startProblem ?? 'Elige la hora de inicio y la duración.');
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
        if (err.code === 'SLOT_TAKEN' || err.code === 'TOO_SOON') avail.refetch();
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
      <PageTitle title="Nueva reserva presencial" sub="Para clientes que reservan en la tienda. Anota la hora exacta en que empezaron a jugar." />
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
              ) : a && a.reason ? (
                <div className="alert alert--warn">{a.reason}</div>
              ) : a ? (
                <>
                  <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
                    <div className="start-exact">
                      <TextInput
                        label="Hora exacta de inicio"
                        type="time"
                        step={60}
                        value={start != null ? hhmm(start) : ''}
                        onChange={(e) => setStart(e.target.value ? hhmmToMin(e.target.value) : null)}
                        error={startProblem ?? errors.startTime}
                        hint={isToday ? 'Puede ser hasta 60 minutos antes de ahora, si ya empezaron a jugar.' : undefined}
                      />
                      {isToday && (
                        <Button icon={<Clock aria-hidden />} onClick={pickNow}>
                          Ahora
                        </Button>
                      )}
                    </div>
                    {starts.some((x) => x.free) && (
                      <details className="slot-shortcuts">
                        <summary className="tiny">O elige un bloque de horario</summary>
                        <div className="slot-grid" role="radiogroup" aria-label="Bloques de inicio">
                          {starts.map((x) => (
                            <button key={x.m} type="button" role="radio" className="chip" aria-checked={start === x.m} disabled={!x.free} onClick={() => setStart(x.m)}>
                              {hhmm(x.m)}
                            </button>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  {start != null && !startProblem && (
                    <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
                      <h3 className="small strong">¿Cuánto tiempo juegan?</h3>
                      <div className="slot-grid slot-grid--wide" role="radiogroup" aria-label="Duración">
                        {lengths.map((d) => (
                          <button key={d} type="button" role="radio" className="chip chip--stack" aria-checked={length === d}
                            aria-label={`${duration(d)}, hasta ${start + d >= 1440 ? '24:00' : hhmm(start + d)}`}
                            onClick={() => setLength(d)}
                          >
                            <strong>{duration(d)}</strong>
                            <span className="tiny">hasta {start + d >= 1440 ? '24:00' : hhmm(start + d)}</span>
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
            <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={start == null || end == null || Boolean(startProblem)} icon={<CalendarPlus aria-hidden />}>
              Registrar reserva
            </Button>
          </aside>
        </form>
      )}
    </>
  );
}
