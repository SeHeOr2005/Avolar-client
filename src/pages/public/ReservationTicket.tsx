import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Copy, MessageCircle, Search, TicketCheck } from 'lucide-react';
import { Button, ErrorState, Skeleton, StatusBadge, TextInput, btnClass } from '../../components/ui';
import { ApiError, api } from '../../lib/api';
import { duration, money, relativeFromNow } from '../../lib/format';
import { useDocumentTitle } from '../../hooks/data';
import { useToast } from '../../hooks/toast';
import type { PublicReservation } from '../../lib/types';
import { recallReservation, rememberReservation } from './reservationMemory';
import { PaymentMethods } from '../../components/PaymentMethods';
import { ReceiptUpload } from '../../components/ReceiptUpload';

/** Página de confirmación tras reservar: código, instrucciones de depósito y botón de WhatsApp. */
export default function ReservationTicket() {
  const { code = '' } = useParams();
  const loc = useLocation() as { state?: { reservation?: PublicReservation; phone?: string } };
  const remembered = recallReservation(code);
  const phone = loc.state?.phone ?? remembered?.phone ?? null;
  const [r, setR] = useState<PublicReservation | null>(loc.state?.reservation ?? null);
  const [error, setError] = useState<unknown>(null);
  useDocumentTitle(`Reserva ${code}`);

  useEffect(() => {
    if (r || !phone) return;
    api
      .post<{ reservation: PublicReservation }>('/public/reservations/lookup', { code, phone })
      .then((x) => setR(x.reservation))
      .catch(setError);
  }, [code, phone, r]);

  if (!phone && !r) return <Lookup initialCode={code} />;
  if (error) {
    return (
      <div className="container page-head">
        <ErrorState error={error} />
      </div>
    );
  }
  if (!r) {
    return (
      <div className="container page-head stack" style={{ maxWidth: 820 }}>
        <Skeleton h={200} r={26} />
        <Skeleton h={300} r={26} />
      </div>
    );
  }
  return <Ticket r={r} phone={phone!} onUpdate={setR} fresh={Boolean(loc.state?.reservation)} />;
}

function Ticket({
  r,
  phone,
  onUpdate,
  fresh,
}: {
  r: PublicReservation;
  phone: string;
  onUpdate: (r: PublicReservation) => void;
  fresh: boolean;
}) {
  const toast = useToast();
  const step = r.status === 'PENDING_PAYMENT' ? 0 : r.status === 'PAYMENT_REVIEW' ? 1 : r.status === 'CONFIRMED' || r.status === 'FINISHED' ? 2 : -1;

  // Se avisa al sistema (sin bloquear la apertura de WhatsApp) de que el cliente envió el comprobante.
  const markSent = () => {
    if (r.status !== 'PENDING_PAYMENT') return;
    api
      .post<{ reservation: PublicReservation }>('/public/reservations/payment-sent', { code: r.code, phone })
      .then((x) => onUpdate(x.reservation))
      .catch(() => {});
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(r.code);
      toast.ok('Código copiado');
    } catch {
      toast.error('No se pudo copiar. Anótalo: ' + r.code);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 860 }}>
      <header className="page-head">
        <p className="eyebrow">{fresh ? '¡Reserva creada!' : 'Tu reserva'}</p>
        <h1 className="display">{fresh ? 'Ya casi es tuya' : `Hola, ${r.customerName.split(' ')[0]}`}</h1>
        {fresh && <p>Guarda tu número de reserva. Para confirmarla, haz el depósito del anticipo y sube aquí el comprobante (o envíalo por WhatsApp).</p>}
      </header>

      <article className="card ticket">
        <div className="ticket__top">
          <div className="spread">
            <span className="eyebrow" style={{ color: 'rgba(255,255,255,.8)' }}>
              Número de reserva
            </span>
            <StatusBadge status={r.status} label={r.statusLabel} />
          </div>
          <div className="row" style={{ '--gap': '14px' } as React.CSSProperties}>
            <span className="display ticket__code mono">{r.code}</span>
            <button className="btn btn--icon btn--sm" onClick={copy} aria-label="Copiar código" style={{ color: 'var(--ink)' }}>
              <Copy />
            </button>
          </div>
        </div>
        <div className="ticket__tear" aria-hidden />
        <div className="ticket__body">
          {step >= 0 && (
            <ol className="progress-steps" aria-label="Progreso">
              <li className={step > 0 ? 'is-done' : 'is-current'}>Anticipo</li>
              <li className={step > 1 ? 'is-done' : step === 1 ? 'is-current' : ''}>Verificación</li>
              <li className={step >= 2 ? 'is-done' : ''}>Confirmada</li>
            </ol>
          )}
          <dl className="ticket__grid">
            <div>
              <dt>Consola</dt>
              <dd>
                {r.console.name} <span className="muted">· {r.console.platform}</span>
              </dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd className="cap">{r.dateLabel}</dd>
            </div>
            <div>
              <dt>Horario</dt>
              <dd>
                {r.startTime} – {r.endTime} <span className="muted">({duration(r.durationMinutes)})</span>
              </dd>
            </div>
            <div>
              <dt>A nombre de</dt>
              <dd>{r.customerName}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{money(r.totalAmount, r.currency)}</dd>
            </div>
            <div>
              <dt>Anticipo ({r.depositPercent} %)</dt>
              <dd style={{ color: 'var(--brand)', fontSize: '1.25rem', fontWeight: 900 }}>{money(r.depositAmount, r.currency)}</dd>
            </div>
          </dl>

          {r.status === 'PENDING_PAYMENT' && (
            <>
              <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
                <h2 style={{ fontSize: 'var(--text-lg)' }}>
                  Paga tu anticipo de {money(r.depositAmount, r.currency)}
                </h2>
                {r.paymentMethods?.length > 0 && <PaymentMethods methods={r.paymentMethods} />}
                {r.paymentInstructions ? (
                  <div className="instructions">{r.paymentInstructions}</div>
                ) : (
                  !r.paymentMethods?.length && (
                    <div className="instructions">Escríbenos por WhatsApp y te enviamos los datos para hacer el depósito.</div>
                  )
                )}
                {r.holdExpiresAt && (
                  <p className="small muted">
                    Apartamos tu horario hasta {new Date(r.holdExpiresAt).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}{' '}
                    ({relativeFromNow(r.holdExpiresAt)}). Si no recibimos el comprobante, el horario se libera.
                  </p>
                )}
              </div>
              <ReceiptUpload r={r} phone={phone} onUpdate={onUpdate} />
              {r.whatsappUrl && (
                <a href={r.whatsappUrl} target="_blank" rel="noopener noreferrer" className={btnClass('whatsapp', 'md', true)} onClick={markSent}>
                  <MessageCircle aria-hidden /> O envíalo por WhatsApp
                </a>
              )}
            </>
          )}
          {r.status === 'PAYMENT_REVIEW' && (
            <>
              <div className="alert">
                <TicketCheck aria-hidden />
                <span>
                  {r.receiptCount > 0
                    ? 'Recibimos tu comprobante. Lo estamos verificando y te confirmaremos pronto.'
                    : 'Recibimos tu aviso de pago. Si aún no enviaste el comprobante, súbelo aquí o envíalo por WhatsApp.'}
                </span>
              </div>
              <ReceiptUpload r={r} phone={phone} onUpdate={onUpdate} />
            </>
          )}
          {r.status === 'CONFIRMED' && (
            <div className="alert alert--ok">
              <TicketCheck aria-hidden />
              <span>
                ¡Reserva confirmada! Te esperamos. El saldo de {money(r.balanceAmount, r.currency)} se paga en la tienda.
              </span>
            </div>
          )}
          {r.status === 'CANCELLED' && (
            <div className="alert alert--danger">Esta reserva fue cancelada. Si crees que es un error, escríbenos por WhatsApp.</div>
          )}
        </div>
      </article>

      <div className="row" style={{ marginTop: 22 }}>
        <Link to="/reservar" className={btnClass('default')}>
          Hacer otra reserva
        </Link>
        <Link to="/" className={btnClass('ghost')}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

/** Consulta de reserva por código + teléfono (/mi-reserva). */
export function Lookup({ initialCode = '' }: { initialCode?: string }) {
  useDocumentTitle('Consultar mi reserva');
  const remembered = recallReservation();
  const [code, setCode] = useState(initialCode || remembered?.code || '');
  const [phone, setPhone] = useState(remembered?.phone ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<PublicReservation | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await api.post<{ reservation: PublicReservation }>('/public/reservations/lookup', { code, phone });
      rememberReservation(r.reservation.code, phone);
      setFound(r.reservation);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo consultar la reserva.');
    } finally {
      setLoading(false);
    }
  }

  if (found) return <Ticket r={found} phone={phone} onUpdate={setFound} fresh={false} />;

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <header className="page-head">
        <p className="eyebrow">Reservas</p>
        <h1 className="display">Consulta tu reserva</h1>
        <p>Escribe el número de reserva y el teléfono con el que reservaste.</p>
      </header>
      <form className="card card__body stack" onSubmit={submit}>
        <TextInput
          label="Número de reserva"
          placeholder="AV-XXXXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          className="mono"
          required
        />
        <TextInput label="Teléfono" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        {error && (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        )}
        <Button type="submit" variant="primary" loading={loading} icon={<Search aria-hidden />}>
          Consultar
        </Button>
      </form>
    </div>
  );
}
