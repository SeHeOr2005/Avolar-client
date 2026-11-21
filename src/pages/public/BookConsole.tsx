import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarX, Check, Clock, Gamepad2, Users } from 'lucide-react';
import { Button, Empty, ErrorState, Skeleton, TextArea, TextInput } from '../../components/ui';
import { ApiError, api } from '../../lib/api';
import { calendar, duration, hhmm, money, todayInZone, WEEKDAYS_SHORT } from '../../lib/format';
import { useDocumentTitle, useSettings } from '../../hooks/data';
import { useToast } from '../../hooks/toast';
import type { Availability, GameConsole, PublicReservation } from '../../lib/types';
import { rememberReservation } from './reservationMemory';
import { PaymentMethods } from '../../components/PaymentMethods';

export default function BookConsole() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: s } = useSettings();

  const consoleQ = useQuery({
    queryKey: ['public-console', slug],
    queryFn: () => api.get<{ console: GameConsole }>(`/public/consoles/${slug}`).then((r) => r.console),
  });
  const c = consoleQ.data;
  useDocumentTitle(c ? `Reservar ${c.name}` : 'Reservar');

  const zone = s?.timezone ?? 'America/Bogota';
  const days = useMemo(() => {
    if (!s) return [];
    const n = Math.min(s.bookingWindowDays, 30) + 1;
    return Array.from({ length: n }, (_, i) => todayInZone(zone, i));
  }, [s, zone]);

  const isDayOpen = (date: string) => {
    if (!s || !c) return false;
    const wd = calendar(date).weekday;
    const src = c.customSchedule ? c.schedules ?? [] : s.hours;
    return Boolean(src.find((h) => h.weekday === wd)?.isOpen);
  };

  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);

  // Primer día abierto por defecto.
  useEffect(() => {
    if (!date && days.length && c) {
      const first = days.find(isDayOpen);
      if (first) setDate(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, c]);

  const availQ = useQuery({
    queryKey: ['availability', c?.id, date],
    enabled: Boolean(c && date),
    queryFn: () => api.get<{ availability: Availability }>(`/public/consoles/${c!.id}/availability?date=${date}`).then((r) => r.availability),
    refetchInterval: 60_000,
  });
  const a = availQ.data;

  const overlaps = (from: number, to: number) => (a?.busy ?? []).some((b) => from < b.end && to > b.start);

  const starts = useMemo(() => {
    if (!a || a.open == null || a.close == null || a.earliestStart == null) return [];
    const out: { m: number; free: boolean }[] = [];
    const first = Math.ceil(a.open / a.slotMinutes) * a.slotMinutes;
    for (let m = first; m + a.minMinutes <= a.close; m += a.slotMinutes) {
      out.push({ m, free: m >= a.earliestStart && !overlaps(m, m + a.minMinutes) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a]);

  const ends = useMemo(() => {
    if (!a || start == null || a.close == null) return [];
    const nextBusy = Math.min(...(a.busy.filter((b) => b.start >= start + 1).map((b) => b.start) as number[]), a.close);
    const limit = Math.min(start + a.maxMinutes, a.close, nextBusy);
    const out: number[] = [];
    for (let m = start + a.minMinutes; m <= limit; m += a.slotMinutes) out.push(m);
    return out;
  }, [a, start]);

  // Al cambiar el día o la disponibilidad, se limpia una selección que ya no es válida.
  useEffect(() => {
    setStart(null);
    setEnd(null);
  }, [date]);
  useEffect(() => {
    if (start != null && !starts.find((x) => x.m === start && x.free)) {
      setStart(null);
      setEnd(null);
    }
  }, [starts, start]);

  const minutes = start != null && end != null ? end - start : 0;
  const price = c ? Math.round(c.pricePerHour * 100 * (minutes / 60)) / 100 : 0;
  const depositPct = s?.depositPercent ?? 50;
  const deposit = Math.round(price * depositPct) / 100;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [hp, setHp] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!c || !date || start == null || end == null) return;
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.customerName = 'Escribe tu nombre';
    if (phone.replace(/\D/g, '').length < 7) errs.customerPhone = 'Ingresa un teléfono válido';
    if (!accepted) errs.acceptTerms = 'Debes aceptar para poder reservar';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const r = await api.post<{ reservation: PublicReservation }>('/public/reservations', {
        consoleId: c.id,
        date,
        startTime: hhmm(start),
        endTime: end === 1440 ? '24:00' : hhmm(end),
        customerName: name,
        customerPhone: phone,
        customerNotes: notes || null,
        acceptTerms: accepted,
        website: hp,
      });
      rememberReservation(r.reservation.code, phone);
      qc.invalidateQueries({ queryKey: ['availability'] });
      navigate(`/reserva/${r.reservation.code}`, { state: { reservation: r.reservation, phone } });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        if (err.code === 'SLOT_TAKEN') {
          toast.error('Alguien acaba de tomar ese horario. Elige otro.');
          setStart(null);
          setEnd(null);
          availQ.refetch();
        }
        setFormError(err.message);
      } else setFormError('No se pudo crear la reserva.');
    } finally {
      setSubmitting(false);
    }
  }

  if (consoleQ.isLoading || !s) {
    return (
      <div className="container page-head stack">
        <Skeleton h={48} w="50%" />
        <Skeleton h={420} r={26} />
      </div>
    );
  }
  if (consoleQ.isError || !c) {
    return (
      <div className="container page-head">
        {consoleQ.error instanceof ApiError && consoleQ.error.status === 404 ? (
          <Empty icon={<Gamepad2 />} title="Consola no disponible" action={<Link className="btn" to="/reservar">Ver consolas</Link>}>
            Esta consola no existe o ya no está disponible para reservas.
          </Empty>
        ) : (
          <ErrorState error={consoleQ.error} onRetry={() => consoleQ.refetch()} />
        )}
      </div>
    );
  }

  const ready = start != null && end != null;
  const span = a && a.open != null && a.close != null ? a.close - a.open : 0;
  const pct = (m: number) => (span ? ((m - (a!.open ?? 0)) / span) * 100 : 0);

  return (
    <>
      <div className="container">
        <header className="page-head">
          <nav className="breadcrumb" aria-label="Migas de pan">
            <Link to="/reservar">Consolas</Link> <span aria-hidden>/</span> <span>{c.name}</span>
          </nav>
          <h1 className="display">{c.name}</h1>
          <div className="row muted" style={{ marginTop: 12 }}>
            <span className="badge badge--plain">{c.platform}</span>
            <span className="row small" style={{ '--gap': '6px' } as React.CSSProperties}>
              <Users size={16} aria-hidden /> Hasta {c.maxPlayers} jugadores
            </span>
            <span className="row small" style={{ '--gap': '6px' } as React.CSSProperties}>
              <Clock size={16} aria-hidden /> De {duration(c.minMinutes)} a {duration(c.maxMinutes)}
            </span>
          </div>
        </header>

        <div className="booking">
          <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
            <ConsoleGallery c={c} />

            {!s.reservationsEnabled && (
              <div className="alert alert--warn">Las reservas en línea están pausadas temporalmente.</div>
            )}

            {/* Paso 1: fecha */}
            <section className="card booking__step" aria-labelledby="step-date">
              <div className="booking__step-head">
                <span className={`booking__step-n ${date ? 'is-done' : ''}`}>{date ? <Check size={18} /> : 1}</span>
                <h2 id="step-date">Elige el día</h2>
              </div>
              <div className="date-strip" role="group" aria-label="Días disponibles">
                {days.map((d) => {
                  const cal = calendar(d);
                  const open = isDayOpen(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      className="date-pill"
                      aria-pressed={date === d}
                      disabled={!open}
                      onClick={() => setDate(d)}
                      aria-label={`${cal.long}${open ? '' : ', cerrado'}`}
                    >
                      <small>{WEEKDAYS_SHORT[cal.weekday]}</small>
                      <strong>{cal.day}</strong>
                      <small>{cal.month}</small>
                    </button>
                  );
                })}
              </div>
              {!days.some(isDayOpen) && (
                <div className="alert alert--warn">La tienda aún no ha publicado su horario de atención para reservas.</div>
              )}
            </section>

            {/* Paso 2: horario */}
            <section className="card booking__step" aria-labelledby="step-time" aria-disabled={!date}>
              <div className="booking__step-head">
                <span className={`booking__step-n ${ready ? 'is-done' : ''}`}>{ready ? <Check size={18} /> : 2}</span>
                <h2 id="step-time">Hora de inicio y fin</h2>
              </div>
              {!date ? (
                <p className="muted small">Primero elige un día.</p>
              ) : availQ.isLoading ? (
                <div className="slot-grid">
                  {Array.from({ length: 12 }, (_, i) => (
                    <Skeleton key={i} h={44} r={12} />
                  ))}
                </div>
              ) : availQ.isError ? (
                <ErrorState error={availQ.error} onRetry={() => availQ.refetch()} />
              ) : a && (a.reason || !starts.some((x) => x.free)) ? (
                <Empty icon={<CalendarX />} title="Sin horarios para este día">
                  {a.reason ?? 'Todos los horarios de este día ya están reservados. Prueba con otra fecha.'}
                </Empty>
              ) : a ? (
                <>
                  <div>
                    <div className="timeline" aria-hidden>
                      {a.busy.map((b, i) => (
                        <span key={i} className="timeline__busy" style={{ left: `${pct(b.start)}%`, width: `${pct(b.end) - pct(b.start)}%` }} />
                      ))}
                      {ready && <span className="timeline__sel" style={{ left: `${pct(start!)}%`, width: `${pct(end!) - pct(start!)}%` }} />}
                    </div>
                    <div className="timeline__scale" aria-hidden>
                      <span>{hhmm(a.open!)}</span>
                      <span>{hhmm(a.close!)}</span>
                    </div>
                  </div>

                  <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
                    <div className="spread">
                      <h3 className="small strong">Inicio</h3>
                      <div className="slot-legend">
                        <span>
                          <i /> Libre
                        </span>
                        <span>
                          <i className="taken" /> No disponible
                        </span>
                      </div>
                    </div>
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
                    <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
                      <h3 className="small strong">Fin</h3>
                      <div className="slot-grid" role="radiogroup" aria-label="Hora de finalización">
                        {ends.map((m) => (
                          <button key={m} type="button" role="radio" className="chip" aria-checked={end === m} onClick={() => setEnd(m)}>
                            <span>{hhmm(m)}</span>
                          </button>
                        ))}
                      </div>
                      <p className="tiny muted">
                        Duración mínima {duration(a.minMinutes)}, máxima {duration(a.maxMinutes)}, en bloques de {a.slotMinutes} min.
                      </p>
                    </div>
                  )}
                </>
              ) : null}
            </section>

            {/* Paso 3: datos */}
            <form className="card booking__step" aria-labelledby="step-data" onSubmit={submit} noValidate>
              <div className="booking__step-head">
                <span className="booking__step-n">3</span>
                <h2 id="step-data">Tus datos</h2>
              </div>
              <p className="small muted">No necesitas crear una cuenta. Usaremos tu teléfono solo para contactarte sobre esta reserva.</p>
              <div className="grid-2">
                <TextInput
                  label="Nombre"
                  autoComplete="name"
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  error={errors.customerName}
                  required
                />
                <TextInput
                  label="Teléfono / WhatsApp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  maxLength={20}
                  onChange={(e) => setPhone(e.target.value)}
                  error={errors.customerPhone}
                  hint="Con el que nos escribirás por WhatsApp."
                  required
                />
              </div>
              <TextArea
                label="Comentarios (opcional)"
                value={notes}
                maxLength={500}
                rows={3}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="¿Algún juego o pedido especial?"
              />
              {/* Campo trampa para bots: oculto a personas y lectores de pantalla */}
              <div aria-hidden style={{ position: 'absolute', left: '-9999px' }}>
                <label>
                  Sitio web
                  <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
                </label>
              </div>
              <div className="consent">
                <label className="check consent__check">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    aria-invalid={errors.acceptTerms ? true : undefined}
                    aria-describedby={errors.acceptTerms ? 'consent-err' : undefined}
                  />
                  <span>
                    Acepto los{' '}
                    <a href="/terminos" target="_blank" rel="noopener noreferrer" className="link">
                      Términos y condiciones
                    </a>{' '}
                    y autorizo el tratamiento de mis datos personales según la{' '}
                    <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="link">
                      Política de tratamiento de datos
                    </a>
                    .
                  </span>
                </label>
                {errors.acceptTerms && (
                  <span className="field__error" id="consent-err" role="alert">
                    {errors.acceptTerms}
                  </span>
                )}
                <p className="tiny muted">
                  Si cancelas con al menos {s.cancellationNoticeHours} h de anticipación puedes reprogramar o pedir la devolución del anticipo.
                </p>
              </div>
              {formError && (
                <div className="alert alert--danger" role="alert">
                  {formError}
                </div>
              )}
              <Button type="submit" variant="primary" size="lg" block loading={submitting} disabled={!ready || !s.reservationsEnabled}>
                {ready ? `Reservar y pagar anticipo de ${money(deposit, s.currency)}` : 'Elige día y horario'}
                {!submitting && <ArrowRight aria-hidden />}
              </Button>
              <p className="tiny muted">
                Tu reserva queda <strong>pendiente de pago</strong> hasta que verifiquemos el anticipo.
                {s.paymentHoldMinutes > 0 && ` Si no recibimos el comprobante en ${duration(s.paymentHoldMinutes)}, el horario se libera.`}
              </p>
            </form>
          </div>

          <aside className="card summary" aria-label="Resumen de la reserva">
            <div className="summary__head">
              <p className="eyebrow" style={{ color: 'rgba(255,255,255,.8)' }}>
                Tu reserva
              </p>
              <h2 className="display">{c.name}</h2>
            </div>
            <dl className="summary__rows">
              <div>
                <dt>Fecha</dt>
                <dd className="cap">{date ? calendar(date).long : '—'}</dd>
              </div>
              <div>
                <dt>Horario</dt>
                <dd>{ready ? `${hhmm(start!)} – ${hhmm(end!)}` : '—'}</dd>
              </div>
              <div>
                <dt>Tiempo de uso</dt>
                <dd>{ready ? duration(minutes) : '—'}</dd>
              </div>
              <div>
                <dt>Precio por hora</dt>
                <dd>{money(c.pricePerHour, s.currency)}</dd>
              </div>
            </dl>
            <div className="summary__total">
              <div className="big">
                <span className="strong">Total</span>
                <strong>{money(price, s.currency)}</strong>
              </div>
              <div className="spread small muted">
                <span>Saldo a pagar en la tienda</span>
                <span>{money(price - deposit, s.currency)}</span>
              </div>
            </div>
            <div className="deposit-box">
              <span className="small strong">Anticipo ({depositPct} %)</span>
              <strong>{money(deposit, s.currency)}</strong>
            </div>
            {s.paymentMethods?.length > 0 && (
              <div className="summary__pay">
                <h3 className="eyebrow">Paga tu anticipo por</h3>
                <PaymentMethods methods={s.paymentMethods} compact />
                <p className="tiny muted">Recibirás tu número de reserva y envías el comprobante por WhatsApp.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
      {ready && (
        <div className="mobile-bar">
          <div>
            <div className="tiny muted">
              Total {money(price, s.currency)} · {duration(minutes)}
            </div>
            <strong>Anticipo {money(deposit, s.currency)}</strong>
          </div>
          <a href="#step-data" className="btn btn--primary btn--sm">
            Continuar
          </a>
        </div>
      )}
    </>
  );
}

function ConsoleGallery({ c }: { c: GameConsole }) {
  const [i, setI] = useState(0);
  const img = c.images[i];
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="console-card__media" style={{ aspectRatio: '16 / 8' }}>
        {img ? (
          <img key={img.id} src={img.url} alt={img.alt ?? c.name} style={{ animation: 'fade-in 240ms ease-out' }} />
        ) : (
          <div className="console-card__placeholder">
            <Gamepad2 aria-hidden />
          </div>
        )}
      </div>
      <div className="card__body stack" style={{ '--gap': '14px' } as React.CSSProperties}>
        {c.images.length > 1 && (
          <div className="gallery__thumbs" role="group" aria-label="Fotos">
            {c.images.map((im, k) => (
              <button key={im.id} type="button" className="gallery__thumb" style={{ width: 88, height: 60 }} aria-current={k === i} onClick={() => setI(k)} aria-label={`Foto ${k + 1}`}>
                <img src={im.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
        {c.description && <p style={{ whiteSpace: 'pre-line' }}>{c.description}</p>}
        {c.features.length > 0 && (
          <ul className="feature-list">
            {c.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
