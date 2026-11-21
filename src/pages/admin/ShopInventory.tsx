import { useEffect, useRef, useState, type FormEvent } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import JsBarcode from 'jsbarcode';
import { History, PackagePlus, Pencil, Plus, Printer, ScanBarcode, Tag, Trash2 } from 'lucide-react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { Button, Empty, ErrorState, Modal, Select, Skeleton, Switch, TextInput } from '../../components/ui';
import { ApiError, api, qs } from '../../lib/api';
import { dateTime, money } from '../../lib/format';
import { beep, looksLikeBarcode, type ShopProduct } from '../../lib/pos';
import { useAuth } from '../../hooks/auth';
import { useSettings } from '../../hooks/data';
import { useToast } from '../../hooks/toast';
import type { Pagination } from '../../lib/types';

interface ListResponse {
  products: ShopProduct[];
  pagination: Pagination;
  inventoryValue?: { atCost: number; atPrice: number };
}

export default function ShopInventoryPage() {
  const { can } = useAuth();
  const manage = can('pos.inventory');
  const toast = useToast();
  const qc = useQueryClient();
  const { data: s } = useSettings();
  const currency = s?.currency ?? 'COP';
  const scanRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Partial<ShopProduct> | null>(null);
  const [stockOf, setStockOf] = useState<ShopProduct | null>(null);
  const [historyOf, setHistoryOf] = useState<ShopProduct | null>(null);
  const [labels, setLabels] = useState<Map<string, { product: ShopProduct; copies: number }>>(new Map());
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      // Mientras el lector escribe un código numérico no se filtra la lista.
      if (!/^\d{6,}$/.test(q.trim())) {
        setDebounced(q.trim());
        setPage(1);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const list = useQuery({
    queryKey: ['shop-products', debounced, category, status, page],
    queryFn: () => api.get<ListResponse>(`/admin/pos/products${qs({ q: debounced, category, status, page, pageSize: 50 })}`),
    placeholderData: keepPreviousData,
  });
  const cats = useQuery({
    queryKey: ['shop-categories'],
    queryFn: () => api.get<{ categories: string[] }>('/admin/pos/categories').then((r) => r.categories),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['shop-products'] });
    qc.invalidateQueries({ queryKey: ['shop-categories'] });
  };

  /** Enter con un código: abre el producto si existe o el formulario de alta con el código puesto. */
  async function onScan(e: FormEvent) {
    e.preventDefault();
    const value = q.trim();
    if (!looksLikeBarcode(value)) return;
    try {
      const r = await api.get<{ product: ShopProduct }>(`/admin/pos/products/lookup${qs({ code: value })}`);
      beep('ok');
      setQ('');
      if (manage) setStockOf(r.product);
      else toast.ok(`${r.product.name}: ${r.product.stock} en stock · ${money(r.product.price, currency)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        beep('error');
        if (manage) {
          setQ('');
          setEdit({ barcode: value, isActive: true, minStock: 3 });
        } else toast.error('Ese código no está registrado.');
      } else toast.error(err instanceof ApiError ? err.message : 'Error al buscar.');
    }
  }

  const toggleLabel = (p: ShopProduct) =>
    setLabels((m) => {
      const n = new Map(m);
      if (n.has(p.id)) n.delete(p.id);
      else n.set(p.id, { product: p, copies: 1 });
      return n;
    });

  async function remove(p: ShopProduct) {
    if (!confirm(`¿Eliminar "${p.name}"? Si ya tiene ventas no se podrá; en ese caso desactívalo.`)) return;
    try {
      await api.del(`/admin/pos/products/${p.id}`);
      toast.ok('Producto eliminado');
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo eliminar.');
    }
  }

  const d = list.data;

  return (
    <>
      <PageTitle
        title="Inventario tienda"
        sub={manage ? 'Productos de la smoke shop, uso interno: no se muestran en la web pública.' : 'Consulta de existencias de la tienda.'}
        actions={
          manage && (
            <>
              {labels.size > 0 && (
                <Button icon={<Printer aria-hidden />} onClick={() => setPrinting(true)}>
                  Imprimir {labels.size} etiqueta{labels.size === 1 ? '' : 's'}
                </Button>
              )}
              <Button variant="primary" icon={<Plus aria-hidden />} onClick={() => setEdit({ isActive: true, minStock: 3 })}>
                Nuevo producto
              </Button>
            </>
          )
        }
      />

      {manage && d?.inventoryValue && (
        <div className="stats" style={{ marginBottom: 16 }}>
          <div className="card stat">
            <span className="stat__label">Productos</span>
            <span className="stat__value">{d.pagination.total}</span>
          </div>
          <div className="card stat">
            <span className="stat__label">Inventario a costo</span>
            <span className="stat__value">{money(d.inventoryValue.atCost, currency)}</span>
          </div>
          <div className="card stat">
            <span className="stat__label">Inventario a precio de venta</span>
            <span className="stat__value">{money(d.inventoryValue.atPrice, currency)}</span>
            <span className="stat__hint">Ganancia potencial {money(d.inventoryValue.atPrice - d.inventoryValue.atCost, currency)}</span>
          </div>
        </div>
      )}

      <div className="filterbar" style={{ gridTemplateColumns: 'minmax(220px,2fr) repeat(2, minmax(150px,1fr))' }}>
        <form onSubmit={onScan} className="field">
          <label className="field__label" htmlFor="inv-scan">
            Escanear o buscar
          </label>
          <span style={{ position: 'relative' }}>
            <ScanBarcode size={18} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--ink-faint)' }} aria-hidden />
            <input
              id="inv-scan"
              ref={scanRef}
              className="input"
              style={{ paddingLeft: 38 }}
              placeholder={manage ? 'Escanea un producto para registrarlo o editarlo' : 'Escanea o escribe el nombre'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </span>
        </form>
        <label className="field">
          <span className="field__label">Categoría</span>
          <select className="select" value={category} onChange={(e) => (setCategory(e.target.value), setPage(1))}>
            <option value="">Todas</option>
            {cats.data?.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Estado</span>
          <select className="select" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
            <option value="">Todos</option>
            <option value="low">Stock bajo</option>
            <option value="out">Agotados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </label>
      </div>

      {list.isLoading ? (
        <Skeleton h={300} r={16} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !d?.products.length ? (
        <Empty icon={<ScanBarcode />} title={debounced || category || status ? 'Sin resultados' : 'El inventario está vacío'}>
          {debounced || category || status
            ? 'Ningún producto coincide con la búsqueda.'
            : manage
              ? 'Escanea el primer producto con el lector: se abrirá el formulario con su código ya puesto. Si no tiene código, usa «Nuevo producto» y el sistema le genera uno.'
              : 'Aún no hay productos registrados.'}
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {manage && <th aria-label="Etiqueta" />}
                <th>Producto</th>
                <th>Código</th>
                <th className="num">Precio</th>
                {manage && <th className="num">Costo</th>}
                {manage && <th className="num">Margen</th>}
                <th className="num">Stock</th>
                {manage && <th />}
              </tr>
            </thead>
            <tbody>
              {d.products.map((p) => (
                <tr key={p.id} style={p.isActive ? undefined : { opacity: 0.5 }}>
                  {manage && (
                    <td>
                      <input type="checkbox" aria-label={`Etiqueta de ${p.name}`} checked={labels.has(p.id)} onChange={() => toggleLabel(p)} />
                    </td>
                  )}
                  <td>
                    <div className="strong">{p.name}</div>
                    <div className="tiny muted">
                      {p.category ?? 'Sin categoría'}
                      {!p.isActive && ' · inactivo'}
                    </div>
                  </td>
                  <td className="mono small">{p.barcode}</td>
                  <td className="num">{money(p.price, currency)}</td>
                  {manage && <td className="num">{money(p.cost ?? 0, currency)}</td>}
                  {manage && <td className="num small">{p.marginPct}%</td>}
                  <td className="num">
                    <span className={`badge badge--plain ${p.stock === 0 ? 'badge--danger' : p.lowStock ? 'badge--warn' : 'badge--ok'}`}>{p.stock}</span>
                  </td>
                  {manage && (
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end', '--gap': '2px', flexWrap: 'nowrap' } as React.CSSProperties}>
                        <Button size="sm" icon={<PackagePlus aria-hidden />} onClick={() => setStockOf(p)}>
                          Stock
                        </Button>
                        <Button size="sm" variant="ghost" className="btn--icon" aria-label="Editar" onClick={() => setEdit(p)}>
                          <Pencil />
                        </Button>
                        <Button size="sm" variant="ghost" className="btn--icon" aria-label="Historial" onClick={() => setHistoryOf(p)}>
                          <History />
                        </Button>
                        <Button size="sm" variant="ghost" className="btn--icon" aria-label="Eliminar" onClick={() => remove(p)}>
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {d && d.pagination.totalPages > 1 && (
        <div className="pagination">
          <span>{d.pagination.total} productos</span>
          <div className="row">
            <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <span>
              {page} / {d.pagination.totalPages}
            </span>
            <Button size="sm" disabled={page >= d.pagination.totalPages} onClick={() => setPage(page + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {edit && (
        <ProductModal
          product={edit}
          categories={cats.data ?? []}
          currency={currency}
          onClose={() => {
            setEdit(null);
            scanRef.current?.focus();
          }}
          onSaved={(p, isNew) => {
            refresh();
            setEdit(null);
            toast.ok(isNew ? `"${p.name}" registrado` : 'Cambios guardados');
            scanRef.current?.focus();
          }}
        />
      )}
      {stockOf && (
        <StockModal
          product={stockOf}
          onClose={() => {
            setStockOf(null);
            scanRef.current?.focus();
          }}
          onSaved={() => {
            refresh();
            setStockOf(null);
            scanRef.current?.focus();
          }}
        />
      )}
      {historyOf && <HistoryModal product={historyOf} onClose={() => setHistoryOf(null)} />}
      {printing && (
        <LabelsModal
          items={[...labels.values()]}
          currency={currency}
          onCopies={(id, copies) => setLabels((m) => new Map(m).set(id, { ...m.get(id)!, copies }))}
          onClose={() => setPrinting(false)}
          onClear={() => {
            setLabels(new Map());
            setPrinting(false);
          }}
        />
      )}
    </>
  );
}

function ProductModal({
  product,
  categories,
  currency,
  onClose,
  onSaved,
}: {
  product: Partial<ShopProduct>;
  categories: string[];
  currency: string;
  onClose: () => void;
  onSaved: (p: ShopProduct, isNew: boolean) => void;
}) {
  const isNew = !product.id;
  const [f, setF] = useState({
    name: product.name ?? '',
    barcode: product.barcode ?? '',
    category: product.category ?? '',
    cost: product.cost != null ? String(product.cost) : '',
    price: product.price != null ? String(product.price) : '',
    stock: '0',
    minStock: String(product.minStock ?? 3),
    isActive: product.isActive ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const cost = Number(f.cost || 0);
  const price = Number(f.price || 0);
  const marginPct = price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : 0;

  async function generate() {
    try {
      setF({ ...f, barcode: (await api.get<{ barcode: string }>('/admin/pos/barcode/new')).barcode });
    } catch {
      /* el servidor genera uno al guardar si queda vacío */
    }
  }

  async function save() {
    setBusy(true);
    setErrors({});
    const body = {
      name: f.name,
      barcode: f.barcode || null,
      category: f.category || null,
      cost,
      price,
      minStock: Number(f.minStock || 0),
      isActive: f.isActive,
      ...(isNew ? { stock: Number(f.stock || 0) } : {}),
    };
    try {
      const r = isNew
        ? await api.post<{ product: ShopProduct }>('/admin/pos/products', body)
        : await api.put<{ product: ShopProduct }>(`/admin/pos/products/${product.id}`, body);
      onSaved(r.product, isNew);
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.code === 'DUPLICATE' ? { barcode: 'Ese código ya está registrado en otro producto.' } : e.fields);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isNew ? 'Nuevo producto de la tienda' : `Editar ${product.name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={save}>
            {isNew ? 'Registrar producto' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="grid-2">
        <TextInput label="Nombre" value={f.name} maxLength={140} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} required autoFocus />
        <div className="field">
          <TextInput
            label="Código de barras"
            value={f.barcode}
            maxLength={40}
            onChange={(e) => setF({ ...f, barcode: e.target.value.trim() })}
            error={errors.barcode}
            hint={isNew ? 'Escanéalo, escríbelo o déjalo vacío para generar uno.' : undefined}
            className="mono"
          />
          {!f.barcode && (
            <Button size="sm" variant="ghost" icon={<Tag aria-hidden />} onClick={generate}>
              Generar código
            </Button>
          )}
        </div>
        <div className="field">
          <TextInput label="Categoría" list="shop-cats" value={f.category} maxLength={80} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Papeles, Grinders, Vapes…" />
          <datalist id="shop-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <TextInput label="Stock mínimo (alerta)" type="number" min={0} value={f.minStock} onChange={(e) => setF({ ...f, minStock: e.target.value })} error={errors.minStock} />
        <TextInput label={`Costo (${currency})`} type="number" min={0} inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} error={errors.cost} hint="Lo que te cuesta a ti." />
        <TextInput
          label={`Precio de venta (${currency})`}
          type="number"
          min={0}
          inputMode="decimal"
          value={f.price}
          onChange={(e) => setF({ ...f, price: e.target.value })}
          error={errors.price}
          hint={price > 0 ? `Ganancia ${money(price - cost, currency)} por unidad (${marginPct}%)` : undefined}
        />
        {isNew && <TextInput label="Stock inicial" type="number" min={0} value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} hint="Unidades que hay hoy en la tienda." />}
      </div>
      <Switch checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label={f.isActive ? 'Activo: se puede vender' : 'Inactivo: no aparece en la caja'} />
    </Modal>
  );
}

const REASONS: Record<string, string> = { restock: 'Entrada de mercancía', adjustment: 'Ajuste / conteo', damage: 'Dañado / pérdida', return: 'Devolución' };

function StockModal({ product, onClose, onSaved }: { product: ShopProduct; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<'add' | 'remove' | 'set'>('add');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('restock');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const qn = Number(quantity || 0);
  const next = mode === 'add' ? product.stock + qn : mode === 'remove' ? product.stock - qn : qn;
  async function save() {
    setBusy(true);
    try {
      await api.post(`/admin/pos/products/${product.id}/stock`, { mode, quantity: qn, reason, note: note || null });
      toast.ok(`Stock de "${product.name}": ${next}`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo actualizar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Stock · ${product.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={save} disabled={next < 0 || (mode !== 'set' && qn <= 0)}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="row" role="radiogroup" aria-label="Tipo de movimiento">
        {(['add', 'remove', 'set'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            className="chip"
            aria-checked={mode === m}
            onClick={() => {
              setMode(m);
              setReason(m === 'add' ? 'restock' : m === 'remove' ? 'damage' : 'adjustment');
            }}
          >
            {m === 'add' ? 'Entrada' : m === 'remove' ? 'Salida' : 'Conteo físico'}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <TextInput label={mode === 'set' ? 'Cantidad contada' : 'Cantidad'} type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />
        <Select label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)}>
          {Object.entries(REASONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      <TextInput label="Nota (opcional)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: pedido del proveedor #123" />
      <p className="small">
        Stock actual <strong>{product.stock}</strong> → nuevo <strong style={{ color: next < 0 ? 'var(--danger)' : undefined }}>{next < 0 ? 'insuficiente' : next}</strong>
      </p>
      <p className="tiny muted">Las ventas descuentan el stock solas desde la caja; aquí registras compras, conteos y pérdidas.</p>
    </Modal>
  );
}

function HistoryModal({ product, onClose }: { product: ShopProduct; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['shop-movements', product.id],
    queryFn: () =>
      api
        .get<{ movements: { id: string; delta: number; stockAfter: number; reasonLabel: string; note: string | null; user: string | null; saleNumber: number | null; createdAt: string }[] }>(
          `/admin/pos/products/${product.id}/movements`,
        )
        .then((r) => r.movements),
  });
  return (
    <Modal title={`Historial · ${product.name}`} onClose={onClose} wide>
      {q.isLoading ? (
        <Skeleton h={160} />
      ) : !q.data?.length ? (
        <p className="small muted">Sin movimientos.</p>
      ) : (
        <ul className="list">
          {q.data.map((m) => (
            <li key={m.id}>
              <span className="stack" style={{ '--gap': '2px' } as React.CSSProperties}>
                <span className="small strong">
                  {m.reasonLabel}
                  {m.saleNumber ? ` #${m.saleNumber}` : ''}
                </span>
                <span className="tiny muted">
                  {dateTime(m.createdAt)}
                  {m.user ? ` · ${m.user}` : ''}
                  {m.note ? ` · ${m.note}` : ''}
                </span>
              </span>
              <strong className="num" style={{ color: m.delta > 0 ? 'var(--ok)' : 'var(--danger)' }}>
                {m.delta > 0 ? `+${m.delta}` : m.delta} → {m.stockAfter}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Código de barras en SVG (EAN-13 si el código lo es; si no, CODE128). */
function BarcodeSvg({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, value, { format: /^\d{13}$/.test(value) ? 'EAN13' : 'CODE128', height: 42, width: 1.6, fontSize: 12, margin: 0 });
    } catch {
      JsBarcode(ref.current, value, { format: 'CODE128', height: 42, width: 1.6, fontSize: 12, margin: 0 });
    }
  }, [value]);
  return <svg ref={ref} role="img" aria-label={`Código ${value}`} />;
}

function LabelsModal({
  items,
  currency,
  onCopies,
  onClose,
  onClear,
}: {
  items: { product: ShopProduct; copies: number }[];
  currency: string;
  onCopies: (id: string, copies: number) => void;
  onClose: () => void;
  onClear: () => void;
}) {
  return (
    <Modal
      wide
      title="Etiquetas para imprimir"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClear}>
            Quitar selección
          </Button>
          <Button variant="primary" icon={<Printer aria-hidden />} onClick={() => window.print()}>
            Imprimir
          </Button>
        </>
      }
    >
      <ul className="list">
        {items.map(({ product, copies }) => (
          <li key={product.id}>
            <span>{product.name}</span>
            <label className="row small" style={{ '--gap': '6px' } as React.CSSProperties}>
              Copias
              <input className="input" style={{ width: 80, minHeight: 36 }} type="number" min={1} max={200} value={copies} onChange={(e) => onCopies(product.id, Math.max(1, Math.min(200, Number(e.target.value) || 1)))} />
            </label>
          </li>
        ))}
      </ul>
      <p className="tiny muted">Se imprime en hojas tamaño carta; recorta y pega cada etiqueta. Los lectores leen EAN-13 y CODE128.</p>
      <div className="label-sheet">
        {items.flatMap(({ product, copies }) =>
          Array.from({ length: copies }, (_, i) => (
            <div key={`${product.id}-${i}`} className="shop-label">
              <span className="shop-label__name">{product.name}</span>
              <BarcodeSvg value={product.barcode} />
              <strong className="shop-label__price">{money(product.price, currency)}</strong>
            </div>
          )),
        )}
      </div>
    </Modal>
  );
}
