/** Tipos y utilidades del punto de venta de la tienda. */
export type MoneyMethod = 'CASH' | 'WALLET' | 'TRANSFER';
export type PayMethod = MoneyMethod | 'CREDIT';

/** Medios con los que entra dinero (para cobrar o recibir abonos). */
export const MONEY_LABELS: Record<MoneyMethod, string> = {
  CASH: 'Efectivo',
  WALLET: 'Nequi / Daviplata',
  TRANSFER: 'Transferencia',
};

export const PAY_LABELS: Record<PayMethod, string> = { ...MONEY_LABELS, CREDIT: 'Fiado' };

export interface ShopCustomer {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  owed: number;
  paid: number;
  balance: number;
  creditSales: number;
  lastPaymentAt: string | null;
  createdAt: string;
}

export interface ShopProduct {
  id: string;
  name: string;
  barcode: string;
  category: string | null;
  price: number;
  stock: number;
  minStock: number;
  lowStock: boolean;
  isActive: boolean;
  cost?: number;
  margin?: number;
  marginPct?: number;
  updatedAt: string;
}

export interface SessionSummary {
  salesCount: number;
  voidedCount: number;
  total: number;
  byMethod: { method: PayMethod; label: string; count: number; total: number }[];
  /** Abonos a fiados recibidos en el turno. */
  creditPayments: { method: MoneyMethod; label: string; count: number; total: number }[];
  creditCollected: number;
  openingCash: number;
  expectedCash: number;
}

export interface OpenSession {
  id: string;
  openedAt: string;
  openedBy: { fullName: string; username: string };
  openingCash: number;
  summary: SessionSummary;
}

export interface SaleDetail {
  id: string;
  number: number;
  status: 'COMPLETED' | 'VOIDED';
  paymentMethod: PayMethod;
  paymentLabel: string;
  total: number;
  cashReceived: number | null;
  change: number | null;
  seller: string;
  createdAt: string;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  customer: { id: string; name: string; balance: number } | null;
  downPayment: { amount: number; method: MoneyMethod; label: string } | null;
  costTotal?: number;
  profit?: number;
  items: { name: string; barcode: string; quantity: number; unitPrice: number; lineTotal: number; unitCost?: number; lineProfit?: number }[];
}

/** Un código "parece" escaneado si no tiene espacios y solo usa caracteres válidos de código de barras. */
export const looksLikeBarcode = (v: string) => /^[0-9A-Za-z-]{3,40}$/.test(v);

let ctx: AudioContext | null = null;
/** Pitido de confirmación (ok) o de error para la caja. Silencioso si el navegador no lo permite. */
export function beep(kind: 'ok' | 'error') {
  try {
    ctx ??= new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === 'ok' ? 'sine' : 'square';
    osc.frequency.value = kind === 'ok' ? 1046 : 196;
    gain.gain.value = 0.06;
    osc.connect(gain).connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'ok' ? 0.09 : 0.25));
    osc.start(now);
    osc.stop(now + (kind === 'ok' ? 0.1 : 0.26));
  } catch {
    /* sin audio */
  }
}
