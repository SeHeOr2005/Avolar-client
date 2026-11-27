import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, HandCoins, Lock, Minus, PencilLine, Plus, Printer, ScanBarcode, ShoppingCart, Trash2, Unlock, Wallet } from 'lucide-react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { Button, ErrorState, Modal, Skeleton, TextArea, TextInput } from '../../components/ui';
import { ApiError, api, qs } from '../../lib/api';
import { dateTime, money } from '../../lib/format';
import { PAY_LABELS, beep, looksLikeBarcode, type MoneyMethod, type OpenSession, type PayMethod, type SaleDetail, type ShopCustomer, type ShopProduct } from '../../lib/pos';
import { CustomerPicker, MoneyMethodPicker, PaymentModal, useInvalidateCredit } from '../../components/admin/Credit';
import { useSettings } from '../../hooks/data';
import { useToast } from '../../hooks/toast';
import { useAuth } from '../../hooks/auth';

interface CartLine {
  product: ShopProduct;
  qty: number;
}

/** Línea de venta libre: artículo que no está en el inventario, con precio escrito a mano. */
interface FreeLine {
  key: number;
  description: string;
  unitPrice: number;
  qty: number;
  unitCost: number | null;
}

export default function PosPage() {
  const session = useQuery({
    queryKey: ['pos-session'],
    queryFn: () => api.get<{ session: OpenSession | null }>('/admin/pos/session').then((r) => r.session),
    refetchInterval: 60_000,
  });
  if (session.isLoading) return <Skeleton h={500} r={16} />;
  if (session.isError) return <ErrorState error={session.error} onRetry={() => session.refetch()} />;
  return session.data ? <Register session={session.data} /> : <OpenRegister />;
}

/** Apertura de caja: se registra la base en efectivo con la que arranca el turno. */
function OpenRegister() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: s } = useSettings();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api.post('/admin/pos/session/open', { openingCash: Number(amount || 0) });
      toast.ok('Caja abierta. ¡Buenas ventas!');
      qc.invalidateQueries({ queryKey: ['pos-session'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.fields.openingCash ?? err.message : 'No se pudo abrir la caja.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle title="Caja" sub="Abre la caja para empezar a vender." />
      <form className="card panel" style={{ maxWidth: 460 }} onSubmit={submit}>
        <div className="row">
          <span className="empty__icon" style={{ width: 52, height: 52 }}>
            <Unlock size={24} />
          </span>
          <div>
            <h2 className="panel__title">Abrir caja</h2>
            <p className="small muted">Cuenta el efectivo con el que inicias el turno (la base).</p>
          </div>
        </div>
        <TextInput
          label={`Base en efectivo (${s?.currency ?? 'COP'})`}
          type="number"
          inputMode="numeric"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={error}
          autoFocus
          placeholder="0"
        />
        <Button type="submit" variant="primary" size="lg" block loading={busy} icon={<Unlock aria-hidden />}>
          Abrir caja
        </Button>
      </form>
    </>
  );
}

function Register({ session }: { session: OpenSession }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const { data: s } = useSettings();
  const currency = s?.currency ?? 'COP';
  const scanRef = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<PayMethod>('CASH');
  const [received, setReceived] = useState('');
  const [charging, setCharging] = useState(false);
  const [done, setDone] = useState<SaleDetail | null>(null);
  const [closing, setClosing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [freeLines, setFreeLines] = useState<FreeLine[]>([]);
  /** null = cerrado; string = abierto con esa descripción sugerida. */
  const [freeOpen, setFreeOpen] = useState<string | null>(null);
  const canFree = can('pos.free_sale');
  // Fiado: cliente y abono en el momento (opcional).
  const [customer, setCustomer] = useState<ShopCustomer | null>(null);
  const [down, setDown] = useState('');
  const [downMethod, setDownMethod] = useState<MoneyMethod>('CASH');
  const invalidateCredit = useInvalidateCredit();

  const focusScan = useCallback(() => setTimeout(() => scanRef.current?.focus(), 0), []);

  // Si el lector "escribe" mientras el foco está en otro lado, se redirige al campo de escaneo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (done || closing || paying || freeOpen !== null || !scanRef.current) return;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      e.preventDefault();
      setScan((v) => v + e.key);
      scanRef.current.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, closing, paying, freeOpen]);

  const search = useQuery({
    queryKey: ['pos-search', scan],
    // Busca por nombre mientras se escribe; los códigos numéricos del lector se resuelven al presionar Enter.
    enabled: scan.trim().length >= 2 && !/^\d+$/.test(scan.trim()),
    queryFn: () => api.get<{ products: ShopProduct[] }>(`/admin/pos/products${qs({ q: scan.trim(), status: 'active', pageSize: 8 })}`).then((r) => r.products),
    staleTime: 10_000,
  });

  const add = useCallback(
    (p: ShopProduct) => {
      if (!p.isActive) {
        beep('error');
        return toast.error(`"${p.name}" está desactivado.`);
      }
      setCart((c) => {
        const i = c.findIndex((l) => l.product.id === p.id);
        const qty = (i >= 0 ? c[i].qty : 0) + 1;
        if (qty > p.stock) {
          beep('error');
          toast.error(p.stock === 0 ? `"${p.name}" está agotado.` : `Solo quedan ${p.stock} de "${p.name}".`);
          return c;
        }
        beep('ok');
        if (i >= 0) return c.map((l, k) => (k === i ? { ...l, qty, product: p } : l));
        return [...c, { product: p, qty }];
      });
      setScan('');
      setNotFound(null);
      focusScan();
    },
    [focusScan, toast],
  );

  async function onScanSubmit(e: FormEvent) {
    e.preventDefault();
    const value = scan.trim();
    if (!value) return;
    if (looksLikeBarcode(value)) {
      try {
        const r = await api.get<{ product: ShopProduct }>(`/admin/pos/products/lookup${qs({ code: value })}`);
        return add(r.product);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          beep('error');
          return toast.error(err instanceof ApiError ? err.message : 'Error al buscar.');
        }
      }
    }
    // No es un código conocido: si hay un único resultado por nombre, se agrega.
    const list = search.data ?? [];
    if (list.length === 1) return add(list[0]);
    if (!list.length) {
      beep('error');
      setNotFound(value);
    }
  }

  const setQty = (id: string, qty: number) =>
    setCart((c) =>
      c.flatMap((l) => {
        if (l.product.id !== id) return [l];
        if (qty <= 0) return [];
        if (qty > l.product.stock) {
          toast.error(`Solo quedan ${l.product.stock} de "${l.product.name}".`);
          return [{ ...l, qty: l.product.stock }];
        }
        return [{ ...l, qty }];
      }),
    );

  const setFreeQty = (key: number, qty: number) =>
    setFreeLines((f) => f.flatMap((l) => (l.key !== key ? [l] : qty <= 0 ? [] : [{ ...l, qty: Math.min(qty, 10000) }])));

  const total = useMemo(
    () =>
      (cart.reduce((s, l) => s + Math.round(l.product.price * 100) * l.qty, 0) + freeLines.reduce((s, l) => s + Math.round(l.unitPrice * 100) * l.qty, 0)) / 100,
    [cart, freeLines],
  );
  const items = cart.reduce((n, l) => n + l.qty, 0) + freeLines.reduce((n, l) => n + l.qty, 0);
  const hasLines = cart.length > 0 || freeLines.length > 0;
  const receivedNum = received === '' ? total : Number(received);
  const change = method === 'CASH' ? Math.max(0, receivedNum - total) : 0;
  const short = method === 'CASH' && receivedNum < total;
  const credit = method === 'CREDIT';
  const downNum = Number(down || 0);
  const downTooHigh = credit && downNum >= total && total > 0;
  const blocked = short || (credit && (!customer || downTooHigh));

  async function charge() {
    if (!hasLines || blocked) return;
    setCharging(true);
    try {
      const r = await api.post<{ sale: SaleDetail }>('/admin/pos/sales', {
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.qty })),
        freeItems: freeLines.map((l) => ({ description: l.description, unitPrice: l.unitPrice, quantity: l.qty, unitCost: l.unitCost })),
        paymentMethod: method,
        cashReceived: method === 'CASH' ? receivedNum : null,
        customerId: credit ? customer!.id : null,
        downPayment: credit && downNum > 0 ? { amount: downNum, method: downMethod } : null,
      });
      beep('ok');
      setDone(r.sale);
      setCart([]);
      setFreeLines([]);
      setReceived('');
      setMethod('CASH');
      setCustomer(null);
      setDown('');
      setDownMethod('CASH');
      if (credit) invalidateCredit();
      qc.invalidateQueries({ queryKey: ['pos-session'] });
      qc.invalidateQueries({ queryKey: ['pos-search'] });
      qc.invalidateQueries({ queryKey: ['shop-products'] });
    } catch (err) {
      beep('error');
      toast.error(err instanceof ApiError ? err.message : 'No se pudo registrar la venta.');
    } finally {
      setCharging(false);
    }
  }

  const quickCash = [total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, 100000].filter((v, i, a) => v >= total && v > 0 && a.indexOf(v) === i).slice(0, 4);

  return (
    <>
      <PageTitle
        title="Caja"
        sub={`Abierta ${dateTime(session.openedAt)} por ${session.openedBy.fullName} · ${session.summary.salesCount} venta(s) · ${money(session.summary.total, currency)}`}
        actions={
          <>
            <Button icon={<HandCoins aria-hidden />} onClick={() => setPaying(true)}>
              Recibir abono
            </Button>
            <Button icon={<Lock aria-hidden />} onClick={() => setClosing(true)}>
              Cerrar caja
            </Button>
          </>
        }
      />
      <div className="pos">
        <section className="card panel pos__left">
          <form onSubmit={onScanSubmit} className="pos-scan">
            <label htmlFor="pos-scan" className="sr-only">
              Escanear código o buscar por nombre
            </label>
            <ScanBarcode className="pos-scan__icon" aria-hidden />
            <input
              id="pos-scan"
              ref={scanRef}
              className="input pos-scan__input"
              value={scan}
              onChange={(e) => {
                setScan(e.target.value);
                setNotFound(null);
              }}
              placeholder="Escanea el código o escribe el nombre…"
              autoComplete="off"
              autoFocus
            />
          </form>
          {canFree && (
            <div>
              <Button size="sm" variant="ghost" icon={<PencilLine aria-hidden />} onClick={() => setFreeOpen('')}>
                Registrar venta libre
              </Button>
            </div>
          )}
          {notFound && (
            <div className="alert alert--warn" role="alert">
              <div>
                No encontramos «{notFound}». {can('pos.inventory') ? 'Regístralo en Inventario tienda' : 'Pide a un administrador que lo registre'}
                {canFree ? ' o véndelo como venta libre.' : '.'}
                {canFree && (
                  <div style={{ marginTop: 8 }}>
                    <Button size="sm" icon={<PencilLine aria-hidden />} onClick={() => setFreeOpen(looksLikeBarcode(notFound) && /\d/.test(notFound) ? '' : notFound)}>
                      Venta libre
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          {scan.trim().length >= 2 && (search.data?.length ?? 0) > 0 && (
            <ul className="pos-results" role="listbox" aria-label="Resultados">
              {search.data!.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => add(p)} disabled={p.stock === 0} role="option" aria-selected={false}>
                    <span className="stack" style={{ '--gap': '2px' } as React.CSSProperties}>
                      <strong>{p.name}</strong>
                      <span className="row tiny muted" style={{ '--gap': '6px' } as React.CSSProperties}>
                        <CategoryTag category={p.category} />
                        <span className="mono">{p.barcode}</span>
                      </span>
                    </span>
                    <span className="stack" style={{ '--gap': '0', textAlign: 'right' } as React.CSSProperties}>
                      <strong>{money(p.price, currency)}</strong>
                      <span className={`tiny ${p.stock === 0 ? '' : 'muted'}`} style={p.stock === 0 ? { color: 'var(--danger)' } : undefined}>
                        {p.stock === 0 ? 'Agotado' : `${p.stock} en stock`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {hasLines ? (
            <ul className="pos-cart" aria-label="Productos de la venta">
              {cart.map((l) => (
                <li key={l.product.id} className="pos-line">
                  <div className="pos-line__info">
                    <strong>{l.product.name}</strong>
                    <span className="row tiny muted" style={{ '--gap': '6px' } as React.CSSProperties}>
                      <CategoryTag category={l.product.category} />
                      <span>
                        {money(l.product.price, currency)} c/u · {l.product.stock} en stock
                      </span>
                    </span>
                  </div>
                  <div className="pos-qty">
                    <button type="button" className="btn btn--icon btn--sm" aria-label="Quitar uno" onClick={() => setQty(l.product.id, l.qty - 1)}>
                      <Minus />
                    </button>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={l.product.stock}
                      value={l.qty}
                      aria-label={`Cantidad de ${l.product.name}`}
                      onChange={(e) => setQty(l.product.id, Number(e.target.value))}
                    />
                    <button type="button" className="btn btn--icon btn--sm" aria-label="Agregar uno" onClick={() => setQty(l.product.id, l.qty + 1)}>
                      <Plus />
                    </button>
                  </div>
                  <strong className="pos-line__total num">{money(l.product.price * l.qty, currency)}</strong>
                  <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Quitar ${l.product.name}`} onClick={() => setQty(l.product.id, 0)}>
                    <Trash2 />
                  </button>
                </li>
              ))}
              {freeLines.map((l) => (
                <li key={`free-${l.key}`} className="pos-line">
                  <div className="pos-line__info">
                    <strong>{l.description}</strong>
                    <span className="row tiny muted" style={{ '--gap': '6px' } as React.CSSProperties}>
                      <span className="badge badge--warn badge--plain">Venta libre</span>
                      <span>{money(l.unitPrice, currency)} c/u</span>
                    </span>
                  </div>
                  <div className="pos-qty">
                    <button type="button" className="btn btn--icon btn--sm" aria-label="Quitar uno" onClick={() => setFreeQty(l.key, l.qty - 1)}>
                      <Minus />
                    </button>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={l.qty}
                      aria-label={`Cantidad de ${l.description}`}
                      onChange={(e) => setFreeQty(l.key, Number(e.target.value))}
                    />
                    <button type="button" className="btn btn--icon btn--sm" aria-label="Agregar uno" onClick={() => setFreeQty(l.key, l.qty + 1)}>
                      <Plus />
                    </button>
                  </div>
                  <strong className="pos-line__total num">{money(l.unitPrice * l.qty, currency)}</strong>
                  <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Quitar ${l.description}`} onClick={() => setFreeQty(l.key, 0)}>
                    <Trash2 />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="pos-empty">
              <ShoppingCart aria-hidden />
              <p>Escanea un producto para empezar la venta.</p>
              <p className="tiny muted">El lector funciona aunque el cursor no esté en el campo.</p>
            </div>
          )}
        </section>

        <aside className="card panel pos__right" aria-label="Cobro">
          <div className="pos-total">
            <span className="small muted">
              Total · {items} artículo{items === 1 ? '' : 's'}
            </span>
            <strong>{money(total, currency)}</strong>
          </div>
          <div className="pos-methods" role="radiogroup" aria-label="Medio de pago">
            {(Object.keys(PAY_LABELS) as PayMethod[]).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={method === m} className="chip" onClick={() => setMethod(m)}>
                {m === 'CASH' ? <Banknote size={18} aria-hidden /> : m === 'CREDIT' ? <HandCoins size={18} aria-hidden /> : <Wallet size={18} aria-hidden />}
                {PAY_LABELS[m]}
              </button>
            ))}
          </div>
          {method === 'CASH' && (
            <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              <TextInput
                label="Efectivo recibido"
                type="number"
                inputMode="numeric"
                min={0}
                value={received}
                placeholder={String(total)}
                onChange={(e) => setReceived(e.target.value)}
                error={short ? 'Es menor que el total' : undefined}
              />
              {total > 0 && (
                <div className="row" style={{ '--gap': '6px' } as React.CSSProperties}>
                  {quickCash.map((v) => (
                    <button key={v} type="button" className="chip" onClick={() => setReceived(String(v))}>
                      {money(v, currency)}
                    </button>
                  ))}
                </div>
              )}
              <div className="spread">
                <span className="muted">Vueltas</span>
                <strong className="pos-change">{money(change, currency)}</strong>
              </div>
            </div>
          )}
          {(method === 'WALLET' || method === 'TRANSFER') && <p className="small muted">Verifica el pago en el celular de la tienda antes de cobrar.</p>}
          {credit && (
            <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
              <CustomerPicker value={customer} onChange={setCustomer} currency={currency} />
              {customer && (
                <>
                  <TextInput
                    label="Abona ahora (opcional)"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={down}
                    placeholder="0"
                    onChange={(e) => setDown(e.target.value)}
                    error={downTooHigh ? 'Si paga todo, cóbralo con efectivo o Nequi' : undefined}
                  />
                  {downNum > 0 && <MoneyMethodPicker value={downMethod} onChange={setDownMethod} label="El abono lo da en" />}
                  <div className="spread">
                    <span className="muted">Queda debiendo</span>
                    <strong className="pos-change">{money(Math.max(0, total - downNum) + Math.max(0, customer.balance), currency)}</strong>
                  </div>
                  {customer.balance > 0 && (
                    <p className="tiny muted">
                      Incluye {money(customer.balance, currency)} que ya debía.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          <Button variant="primary" size="lg" block loading={charging} disabled={!hasLines || blocked} onClick={charge}>
            {credit ? 'Fiar' : 'Cobrar'} {total > 0 ? money(total, currency) : ''}
          </Button>
          {hasLines && (
            <Button
              variant="ghost"
              block
              onClick={() => {
                setCart([]);
                setFreeLines([]);
              }}
            >
              Vaciar venta
            </Button>
          )}
        </aside>
      </div>

      {done && (
        <SaleDone
          sale={done}
          currency={currency}
          onClose={() => {
            setDone(null);
            focusScan();
          }}
        />
      )}
      {closing && <CloseRegister session={session} currency={currency} onClose={() => setClosing(false)} />}
      {freeOpen !== null && (
        <FreeItemModal
          initial={freeOpen}
          currency={currency}
          withCost={can('pos.inventory') || can('pos.reports')}
          onClose={() => {
            setFreeOpen(null);
            focusScan();
          }}
          onAdd={(l) => {
            setFreeLines((f) => [...f, { ...l, key: Date.now() }]);
            setScan('');
            setNotFound(null);
            beep('ok');
            setFreeOpen(null);
            focusScan();
          }}
        />
      )}
      {paying && (
        <PaymentModal
          currency={currency}
          onClose={() => {
            setPaying(false);
            focusScan();
          }}
        />
      )}
    </>
  );
}

/** Agregar a la venta un artículo que no está en el inventario: descripción, precio y cantidad a mano. */
function FreeItemModal({
  initial,
  currency,
  withCost,
  onClose,
  onAdd,
}: {
  initial: string;
  currency: string;
  withCost: boolean;
  onClose: () => void;
  onAdd: (l: Omit<FreeLine, 'key'>) => void;
}) {
  const [description, setDescription] = useState(initial);
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [cost, setCost] = useState('');
  const priceNum = Number(price || 0);
  const qtyNum = Math.floor(Number(qty || 0));
  const costNum = cost === '' ? null : Number(cost);
  const errors = {
    description: description.trim().length > 0 && description.trim().length < 2 ? 'Describe lo que vendes' : undefined,
    cost: costNum != null && costNum > priceNum ? 'El costo no puede ser mayor que el precio' : undefined,
  };
  const valid = description.trim().length >= 2 && priceNum > 0 && qtyNum >= 1 && qtyNum <= 10000 && !errors.cost;

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!valid) return;
    onAdd({ description: description.trim(), unitPrice: priceNum, qty: qtyNum, unitCost: withCost ? costNum : null });
  }

  return (
    <Modal
      title="Venta libre"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!valid} onClick={() => submit()} icon={<Plus aria-hidden />}>
            Agregar {valid ? money(priceNum * qtyNum, currency) : ''}
          </Button>
        </>
      }
    >
      <form className="stack" style={{ '--gap': '12px' } as React.CSSProperties} onSubmit={submit}>
        <p className="small muted">Para algo que no está en el inventario. No descuenta stock y queda registrado en la Actividad con tu nombre.</p>
        <TextInput
          label="¿Qué vendes?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          maxLength={140}
          placeholder="Ej.: Encendedor genérico"
          autoFocus
        />
        <div className="grid-2">
          <TextInput label={`Precio por unidad (${currency})`} type="number" inputMode="numeric" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
          <TextInput label="Cantidad" type="number" inputMode="numeric" min={1} max={10000} value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        {withCost && (
          <TextInput
            label="Costo por unidad (opcional)"
            type="number"
            inputMode="numeric"
            min={0}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            error={errors.cost}
            hint="Para que la ganancia del reporte sea real. Si lo dejas vacío, cuenta como costo 0."
          />
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

/** Categoría del producto de tienda (o "Sin categoría"). */
function CategoryTag({ category }: { category: string | null }) {
  return <span className={`badge badge--plain ${category ? 'badge--info' : ''}`}>{category ?? 'Sin categoría'}</span>;
}

/** Venta registrada: resumen, vueltas e impresión del ticket. */
export function SaleDone({ sale, currency, onClose }: { sale: SaleDetail; currency: string; onClose: () => void }) {
  const { data: s } = useSettings();
  return (
    <Modal
      title={`Venta #${sale.number} registrada`}
      onClose={onClose}
      footer={
        <>
          <Button icon={<Printer aria-hidden />} onClick={() => window.print()}>
            Imprimir ticket
          </Button>
          <Button variant="primary" onClick={onClose}>
            Nueva venta
          </Button>
        </>
      }
    >
      <div className="pos-total" style={{ textAlign: 'center' }}>
        <span className="small muted">{sale.paymentLabel}</span>
        <strong>{money(sale.total, currency)}</strong>
        {sale.change != null && sale.change > 0 && <span className="pos-change">Vueltas: {money(sale.change, currency)}</span>}
      </div>
      {sale.customer && (
        <div className="alert alert--warn">
          <div>
            Fiado a <strong>{sale.customer.name}</strong>
            {sale.downPayment ? ` · abonó ${money(sale.downPayment.amount, currency)} (${sale.downPayment.label.toLowerCase()})` : ' · sin abono'}. Ahora debe en
            total <strong>{money(sale.customer.balance, currency)}</strong>.
          </div>
        </div>
      )}
      <div className="print-ticket">
        <p style={{ textAlign: 'center', fontWeight: 800 }}>{s?.legalName || s?.businessName || 'AVOLAR'}</p>
        {s?.taxId && <p style={{ textAlign: 'center' }}>NIT {s.taxId}</p>}
        {s?.address && <p style={{ textAlign: 'center' }}>{s.address}</p>}
        <p>
          Venta #{sale.number} · {dateTime(sale.createdAt)}
          <br />
          Atendió: {sale.seller}
        </p>
        <table>
          <tbody>
            {sale.items.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.quantity} × {i.name}
                  {i.free ? ' *' : ''}
                </td>
                <td style={{ textAlign: 'right' }}>{money(i.lineTotal, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontWeight: 800, textAlign: 'right' }}>TOTAL {money(sale.total, currency)}</p>
        <p style={{ textAlign: 'right' }}>
          {sale.paymentLabel}
          {sale.cashReceived != null && (
            <>
              <br />
              Recibido {money(sale.cashReceived, currency)} · Vueltas {money(sale.change ?? 0, currency)}
            </>
          )}
          {sale.customer && (
            <>
              <br />
              Cliente: {sale.customer.name}
              {sale.downPayment && (
                <>
                  <br />
                  Abono: {money(sale.downPayment.amount, currency)} ({sale.downPayment.label})
                </>
              )}
              <br />
              Saldo pendiente: {money(sale.customer.balance, currency)}
            </>
          )}
        </p>
        {sale.items.some((i) => i.free) && <p>* Artículo registrado como venta libre.</p>}
        <p style={{ textAlign: 'center' }}>Documento de control interno. No es factura electrónica.</p>
      </div>
    </Modal>
  );
}

/** Cierre de caja con arqueo: efectivo esperado vs. contado. */
function CloseRegister({ session, currency, onClose }: { session: OpenSession; currency: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ expectedCash: number; countedCash: number; difference: number } | null>(null);
  const sum = session.summary;

  async function close() {
    if (counted === '') return toast.error('Cuenta el efectivo y escribe el valor.');
    setBusy(true);
    try {
      const r = await api.post<{ closed: { expectedCash: number; countedCash: number; difference: number } }>('/admin/pos/session/close', {
        countedCash: Number(counted),
        notes: notes || null,
      });
      setResult(r.closed);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo cerrar la caja.');
    } finally {
      setBusy(false);
    }
  }
  const finish = () => {
    qc.invalidateQueries({ queryKey: ['pos-session'] });
    onClose();
  };

  if (result) {
    const d = result.difference;
    return (
      <Modal title="Caja cerrada" onClose={finish} footer={<Button variant="primary" onClick={finish}>Listo</Button>}>
        <dl className="kv">
          <div>
            <dt>Efectivo esperado</dt>
            <dd>{money(result.expectedCash, currency)}</dd>
          </div>
          <div>
            <dt>Efectivo contado</dt>
            <dd>{money(result.countedCash, currency)}</dd>
          </div>
        </dl>
        <div className={`alert ${d === 0 ? 'alert--ok' : 'alert--warn'}`}>
          {d === 0 ? 'La caja cuadra exacto.' : d > 0 ? `Sobran ${money(d, currency)}.` : `Faltan ${money(-d, currency)}.`}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Cerrar caja"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Volver
          </Button>
          <Button variant="primary" loading={busy} onClick={close} icon={<Lock aria-hidden />}>
            Cerrar caja
          </Button>
        </>
      }
    >
      <ul className="list">
        {sum.byMethod.map((m) => (
          <li key={m.method}>
            <span>
              {m.label} <span className="tiny muted">({m.count})</span>
            </span>
            <strong className="num">{money(m.total, currency)}</strong>
          </li>
        ))}
        {sum.creditPayments
          .filter((m) => m.count > 0)
          .map((m) => (
            <li key={`abono-${m.method}`}>
              <span>
                Abonos de fiado · {m.label} <span className="tiny muted">({m.count})</span>
              </span>
              <strong className="num">{money(m.total, currency)}</strong>
            </li>
          ))}
        <li>
          <span>Base inicial</span>
          <strong className="num">{money(sum.openingCash, currency)}</strong>
        </li>
        <li>
          <strong title="Base + ventas en efectivo + abonos en efectivo">Efectivo que debería haber</strong>
          <strong className="num">{money(sum.expectedCash, currency)}</strong>
        </li>
      </ul>
      <TextInput label="Efectivo contado en caja" type="number" inputMode="numeric" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
      <TextArea label="Notas (opcional)" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: se pagó un domicilio con efectivo de la caja" />
    </Modal>
  );
}

