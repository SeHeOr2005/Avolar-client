/**
 * Recuerda (solo en esta pestaña del navegador del propio cliente) el código y el teléfono
 * de su última reserva, para que pueda recargar la página de confirmación sin volver a escribirlos.
 */
const KEY = 'avolar-last-reservation';

export function rememberReservation(code: string, phone: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ code, phone }));
  } catch {
    /* sin almacenamiento: no es crítico */
  }
}

export function recallReservation(code?: string): { code: string; phone: string } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (v && (!code || v.code === code)) return v;
  } catch {
    /* ignorar */
  }
  return null;
}
