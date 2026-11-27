const ZERO_DECIMALS = new Set(['COP', 'CLP', 'PYG', 'JPY']);

export function money(amount: number | null | undefined, currency = 'COP') {
  if (amount == null) return '—';
  const zero = ZERO_DECIMALS.has(currency);
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: zero ? 0 : 2,
      maximumFractionDigits: zero ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(zero ? 0 : 2)}`;
  }
}

export const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const hhmmToMin = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

export function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Fecha "hoy" (YYYY-MM-DD) en la zona horaria de la tienda. */
/** Minuto actual del día (0–1439) en la zona horaria de la tienda. */
export function nowMinuteInZone(zone: string) {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':').map(Number);
  return h * 60 + m;
}

export function todayInZone(zone: string, plusDays = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (!plusDays) return parts;
  const d = new Date(`${parts}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + plusDays);
  return d.toISOString().slice(0, 10);
}

/** Interpreta YYYY-MM-DD como fecha de calendario (sin desfases por zona horaria). */
export function calendar(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: d.getUTCDay(),
    day: d.getUTCDate(),
    month: d.toLocaleDateString('es-CO', { month: 'short', timeZone: 'UTC' }).replace('.', ''),
    long: d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
  };
}

export function dateTime(iso: string | null | undefined, zone?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: zone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeFromNow(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return mins >= 0 ? `en ${mins} min` : `hace ${-mins} min`;
  const hrs = Math.round(mins / 60);
  return hrs >= 0 ? `en ${hrs} h` : `hace ${-hrs} h`;
}

export const waLink = (number: string | null | undefined, text: string) =>
  number ? `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}` : null;

export const STATUS_TONE: Record<string, 'warn' | 'info' | 'ok' | 'danger' | 'muted'> = {
  PENDING_PAYMENT: 'warn',
  PAYMENT_REVIEW: 'info',
  CONFIRMED: 'ok',
  CANCELLED: 'danger',
  FINISHED: 'muted',
};

export const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PAYMENT_REVIEW: 'Pago por verificar',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  FINISHED: 'Finalizada',
};

/** "jueves 19 de noviembre" → "Jueves 19 de noviembre" (solo la primera letra). */
export const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
