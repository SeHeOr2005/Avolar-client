import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PackagePlus, Pencil, Plus, Shirt, Trash2 } from 'lucide-react';
import { PageTitle } from '../../components/layout/AdminLayout';
import { ImageManager } from '../../components/admin/ImageManager';
import { Button, Empty, ErrorState, Modal, Select, Skeleton, Switch, TextArea, TextInput, btnClass } from '../../components/ui';
import { ApiError, api, qs } from '../../lib/api';
import { dateTime, money } from '../../lib/format';
import { useAuth } from '../../hooks/auth';
import { useSettings } from '../../hooks/data';
import { useToast } from '../../hooks/toast';
import type { Category, Pagination, Product, Variant } from '../../lib/types';

const TONE: Record<string, string> = { AVAILABLE: 'ok', LOW_STOCK: 'warn', OUT_OF_STOCK: 'danger', INACTIVE: 'muted' };
const useCategories = () =>
  useQuery({ queryKey: ['admin-categories'], queryFn: () => api.get<{ categories: Category[] }>('/admin/catalog/categories').then((r) => r.categories) });

export function ProductsList() {
  const { data: s } = useSettings();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const f = { q: params.get('q') ?? '', categoryId: params.get('categoryId') ?? '', status: params.get('status') ?? '' };
  const [search, setSearch] = useState(f.q);
  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k));
    setParams(n, { replace: true });
  };
  useEffect(() => {
    const t = setTimeout(() => search.trim() !== f.q && set({ q: search.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  const cats = useCategories();
  const q = useQuery({
    queryKey: ['admin-products', f],
    queryFn: () => api.get<{ products: Product[]; pagination: Pagination }>(`/admin/catalog/products${qs({ ...f, pageSize: 100 })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageTitle
        title="Productos"
        sub="Catálogo de ropa, fotos, tallas, colores e inventario."
        actions={
          <Link to="/admin/productos/nuevo" className={btnClass('primary')}>
            <Plus aria-hidden /> Nuevo producto
          </Link>
        }
      />
      <div className="filterbar" style={{ gridTemplateColumns: 'minmax(200px,2fr) repeat(2, minmax(160px,1fr))' }}>
        <label className="field">
          <span className="field__label">Buscar</span>
          <input className="input" placeholder="Nombre del producto" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">Categoría</span>
          <select className="select" value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
            <option value="">Todas</option>
            {cats.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Estado</span>
          <select className="select" value={f.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="low">Poco stock</option>
            <option value="out">Agotados</option>
          </select>
        </label>
      </div>
      {q.isLoading ? (
        <Skeleton h={300} r={16} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.products.length ? (
        cats.data && !cats.data.length ? (
          <Empty icon={<Shirt />} title="Primero crea una categoría" action={<Link to="/admin/categorias" className={btnClass('primary')}>Crear categorías</Link>}>
            Cada producto pertenece a una categoría (p. ej. camisetas, gorras).
          </Empty>
        ) : (
          <Empty icon={<Shirt />} title="Sin productos" action={<Link to="/admin/productos/nuevo" className={btnClass('primary')}>Crear producto</Link>}>
            {f.q || f.status || f.categoryId ? 'Ningún producto coincide con los filtros.' : 'Publica tu primera prenda.'}
          </Empty>
        )
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="num">Precio</th>
                <th>Tallas</th>
                <th className="num">Stock</th>
                <th>Disponibilidad</th>
              </tr>
            </thead>
            <tbody>
              {q.data.products.map((p) => (
                <tr key={p.id} className="is-link" onClick={() => nav(`/admin/productos/${p.id}`)}>
                  <td>
                    <Link to={`/admin/productos/${p.id}`} className="row strong" style={{ '--gap': '10px', textDecoration: 'none' } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
                      {p.images[0] ? (
                        <img src={p.images[0].url} alt="" style={{ width: 40, height: 48, objectFit: 'cover', borderRadius: 8 }} />
                      ) : (
                        <span className="empty__icon" style={{ width: 40, height: 48, borderRadius: 8 }}>
                          <Shirt size={18} />
                        </span>
                      )}
                      <span>
                        {p.name}
                        {p.isFeatured && <span className="badge badge--info badge--plain" style={{ marginLeft: 6 }}>Destacado</span>}
                      </span>
                    </Link>
                  </td>
                  <td>{p.category.name}</td>
                  <td className="num">{money(p.price, s?.currency)}</td>
                  <td className="small">{p.sizes.join(', ') || '—'}</td>
                  <td className="num">{p.totalStock}</td>
                  <td>
                    <span className={`badge badge--${TONE[p.availability]}`}>{p.availabilityLabel}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

interface PForm {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  isActive: boolean;
  isFeatured: boolean;
}

export function ProductEdit() {
  const { id } = useParams();
  const isNew = !id || id === 'nuevo';
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const { data: s } = useSettings();
  const cats = useCategories();
  const q = useQuery({
    queryKey: ['admin-product', id],
    enabled: !isNew,
    queryFn: () => api.get<{ product: Product }>(`/admin/catalog/products/${id}`).then((r) => r.product),
  });
  const [p, setP] = useState<Product | null>(null);
  const [f, setF] = useState<PForm>({ name: '', description: '', price: '', categoryId: '', isActive: true, isFeatured: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [variantModal, setVariantModal] = useState<Variant | 'new' | null>(null);
  const [stockModal, setStockModal] = useState<Variant | null>(null);

  useEffect(() => {
    if (q.data) {
      setP(q.data);
      setF({
        name: q.data.name,
        description: q.data.description ?? '',
        price: String(q.data.price),
        categoryId: q.data.category.id,
        isActive: q.data.isActive,
        isFeatured: q.data.isFeatured,
      });
    }
  }, [q.data]);
  useEffect(() => {
    if (isNew && !f.categoryId && cats.data?.length) setF((x) => ({ ...x, categoryId: cats.data![0].id }));
  }, [cats.data, isNew, f.categoryId]);

  const refresh = (next: Product) => {
    setP(next);
    qc.setQueryData(['admin-product', next.id], next);
    qc.invalidateQueries({ queryKey: ['admin-products'] });
    qc.invalidateQueries({ queryKey: ['admin-movements', next.id] });
    qc.invalidateQueries({ queryKey: ['public-products'] });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const body = { ...f, price: Number(f.price), description: f.description || null };
    try {
      const r = isNew
        ? await api.post<{ product: Product }>('/admin/catalog/products', body)
        : await api.put<{ product: Product }>(`/admin/catalog/products/${id}`, body);
      refresh(r.product);
      toast.ok(isNew ? 'Producto creado. Agrega fotos y tallas.' : 'Cambios guardados');
      if (isNew) nav(`/admin/productos/${r.product.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        toast.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!p || !confirm(`¿Eliminar "${p.name}" con sus fotos e inventario? Esta acción no se puede deshacer.`)) return;
    try {
      await api.del(`/admin/catalog/products/${p.id}`);
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      toast.ok('Producto eliminado');
      nav('/admin/productos');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo eliminar.');
    }
  }

  async function deleteVariant(v: Variant) {
    if (!p || !confirm(`¿Eliminar la variante ${v.size}${v.color ? ` / ${v.color}` : ''}?`)) return;
    try {
      refresh((await api.del<{ product: Product }>(`/admin/catalog/products/${p.id}/variants/${v.id}`)).product);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo eliminar.');
    }
  }

  if (!isNew && q.isLoading) return <Skeleton h={500} r={16} />;
  if (!isNew && q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  return (
    <>
      <Link to="/admin/productos" className={btnClass('ghost', 'sm')} style={{ marginBottom: 10 }}>
        <ArrowLeft aria-hidden /> Productos
      </Link>
      <PageTitle
        title={isNew ? 'Nuevo producto' : p?.name ?? 'Producto'}
        actions={
          p && (
            <>
              <span className={`badge badge--${TONE[p.availability]}`}>{p.availabilityLabel}</span>
              <Button variant="ghost" onClick={remove} icon={<Trash2 aria-hidden />}>
                Eliminar
              </Button>
            </>
          )
        }
      />
      <div className="detail-grid">
        <div className="stack">
          <form className="card panel" onSubmit={submit} noValidate>
            <h2 className="panel__title">Información</h2>
            <TextInput label="Nombre" value={f.name} maxLength={140} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} required />
            <TextArea label="Descripción" value={f.description} maxLength={5000} onChange={(e) => setF({ ...f, description: e.target.value })} error={errors.description} />
            <div className="grid-2">
              <TextInput
                label={`Precio (${s?.currency ?? ''})`}
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={f.price}
                onChange={(e) => setF({ ...f, price: e.target.value })}
                error={errors.price}
                required
              />
              <Select label="Categoría" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} error={errors.categoryId} required>
                {!cats.data?.length && <option value="">Crea una categoría primero</option>}
                {cats.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.isActive ? '' : ' (inactiva)'}
                  </option>
                ))}
              </Select>
            </div>
            <Switch checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label={f.isActive ? 'Activo: visible en el catálogo' : 'Inactivo: oculto al público'} />
            <Switch checked={f.isFeatured} onChange={(v) => setF({ ...f, isFeatured: v })} label="Destacado" />
            <div>
              <Button type="submit" variant="primary" loading={saving} disabled={!f.categoryId}>
                {isNew ? 'Crear producto' : 'Guardar cambios'}
              </Button>
            </div>
          </form>

          {p && (
            <section className="card panel">
              <div className="spread">
                <h2 className="panel__title">Tallas, colores e inventario</h2>
                <Button size="sm" onClick={() => setVariantModal('new')} icon={<Plus aria-hidden />}>
                  Agregar variante
                </Button>
              </div>
              {p.variants.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Talla</th>
                        <th>Color</th>
                        <th>SKU</th>
                        <th className="num">Stock</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {p.variants.map((v) => (
                        <tr key={v.id} style={v.isActive === false ? { opacity: 0.55 } : undefined}>
                          <td className="strong">{v.size}</td>
                          <td>
                            <span className="row" style={{ '--gap': '6px' } as React.CSSProperties}>
                              {v.colorHex && <span className="swatch" style={{ background: v.colorHex }} />}
                              {v.color ?? '—'}
                            </span>
                          </td>
                          <td className="small mono">{v.sku ?? '—'}</td>
                          <td className="num">
                            <span className={`badge badge--plain ${v.stock === 0 ? 'badge--danger' : v.stock <= (s?.lowStockThreshold ?? 3) ? 'badge--warn' : 'badge--ok'}`}>{v.stock}</span>
                          </td>
                          <td>
                            <div className="row" style={{ justifyContent: 'flex-end', '--gap': '4px' } as React.CSSProperties}>
                              {can('inventory.manage') && (
                                <Button size="sm" onClick={() => setStockModal(v)} icon={<PackagePlus aria-hidden />}>
                                  Stock
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="btn--icon" onClick={() => setVariantModal(v)} aria-label="Editar variante">
                                <Pencil />
                              </Button>
                              <Button size="sm" variant="ghost" className="btn--icon" onClick={() => deleteVariant(v)} aria-label="Eliminar variante">
                                <Trash2 />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="small muted">Agrega al menos una talla para que el producto tenga stock y aparezca como disponible.</p>
              )}
            </section>
          )}
        </div>

        <div className="stack">
          <section className="card panel">
            <h2 className="panel__title">Fotos</h2>
            {p ? <ImageManager<Product> images={p.images} basePath={`/admin/catalog/products/${p.id}`} onChange={refresh} /> : <p className="small muted">Guarda el producto para subir fotos.</p>}
          </section>
          {p && can('inventory.manage') && <Movements productId={p.id} />}
        </div>
      </div>

      {variantModal && p && <VariantModal product={p} variant={variantModal === 'new' ? null : variantModal} onClose={() => setVariantModal(null)} onSaved={refresh} />}
      {stockModal && p && <StockModal variant={stockModal} onClose={() => setStockModal(null)} onSaved={refresh} />}
    </>
  );
}

function VariantModal({ product, variant, onClose, onSaved }: { product: Product; variant: Variant | null; onClose: () => void; onSaved: (p: Product) => void }) {
  const toast = useToast();
  const [v, setV] = useState({
    size: variant?.size ?? '',
    color: variant?.color ?? '',
    colorHex: variant?.colorHex ?? '',
    sku: variant?.sku ?? '',
    stock: '0',
    isActive: variant?.isActive ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setErrors({});
    const body = { size: v.size, color: v.color || null, colorHex: v.colorHex || null, sku: v.sku || null, isActive: v.isActive };
    try {
      const r = variant
        ? await api.put<{ product: Product }>(`/admin/catalog/products/${product.id}/variants/${variant.id}`, body)
        : await api.post<{ product: Product }>(`/admin/catalog/products/${product.id}/variants`, { ...body, stock: Number(v.stock || 0) });
      onSaved(r.product);
      toast.ok('Variante guardada');
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        toast.error(err.code === 'DUPLICATE' ? 'Ya existe esa combinación de talla y color.' : err.message);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={variant ? 'Editar variante' : 'Nueva variante'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={busy} onClick={save} disabled={!v.size.trim()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid-2">
        <TextInput label="Talla" placeholder="S, M, L, 32, Única…" value={v.size} maxLength={20} onChange={(e) => setV({ ...v, size: e.target.value })} error={errors.size} required />
        <TextInput label="SKU (opcional)" value={v.sku} maxLength={60} onChange={(e) => setV({ ...v, sku: e.target.value })} error={errors.sku} />
        <TextInput label="Color (opcional)" placeholder="Negro" value={v.color} maxLength={40} onChange={(e) => setV({ ...v, color: e.target.value })} error={errors.color} />
        <label className="field">
          <span className="field__label">Muestra de color</span>
          <span className="row">
            <input type="color" value={v.colorHex || '#000000'} onChange={(e) => setV({ ...v, colorHex: e.target.value })} style={{ width: 48, height: 44, border: 0, background: 'none' }} aria-label="Elegir color" />
            {v.colorHex && (
              <Button size="sm" variant="ghost" onClick={() => setV({ ...v, colorHex: '' })}>
                Quitar
              </Button>
            )}
          </span>
        </label>
        {!variant && (
          <TextInput label="Stock inicial" type="number" min={0} value={v.stock} onChange={(e) => setV({ ...v, stock: e.target.value })} error={errors.stock} />
        )}
      </div>
      <Switch checked={v.isActive} onChange={(x) => setV({ ...v, isActive: x })} label={v.isActive ? 'Variante activa' : 'Variante oculta'} />
    </Modal>
  );
}

const REASONS: Record<string, string> = { restock: 'Reposición', sale: 'Venta en tienda', adjustment: 'Ajuste / conteo', damage: 'Dañado / pérdida', return: 'Devolución', initial: 'Stock inicial' };

function StockModal({ variant, onClose, onSaved }: { variant: Variant; onClose: () => void; onSaved: (p: Product) => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<'add' | 'remove' | 'set'>('add');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('restock');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const qn = Number(quantity || 0);
  const next = mode === 'add' ? variant.stock + qn : mode === 'remove' ? variant.stock - qn : qn;
  async function save() {
    setBusy(true);
    try {
      const r = await api.post<{ product: Product }>(`/admin/catalog/variants/${variant.id}/stock`, { mode, quantity: qn, reason, note: note || null });
      onSaved(r.product);
      toast.ok('Inventario actualizado');
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo actualizar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Inventario · ${variant.size}${variant.color ? ` / ${variant.color}` : ''}`}
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
      <div className="row" role="radiogroup" aria-label="Tipo de ajuste">
        {(['add', 'remove', 'set'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            className="chip"
            aria-checked={mode === m}
            onClick={() => {
              setMode(m);
              setReason(m === 'add' ? 'restock' : m === 'remove' ? 'sale' : 'adjustment');
            }}
          >
            {m === 'add' ? 'Entrada' : m === 'remove' ? 'Salida' : 'Fijar cantidad'}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <TextInput label={mode === 'set' ? 'Nueva cantidad' : 'Cantidad'} type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <Select label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)}>
          {Object.entries(REASONS)
            .filter(([k]) => k !== 'initial')
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </Select>
      </div>
      <TextInput label="Nota (opcional)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      <p className="small">
        Stock actual <strong>{variant.stock}</strong> → nuevo{' '}
        <strong style={{ color: next < 0 ? 'var(--danger)' : undefined }}>{next < 0 ? 'insuficiente' : next}</strong>
      </p>
    </Modal>
  );
}

function Movements({ productId }: { productId: string }) {
  const q = useQuery({
    queryKey: ['admin-movements', productId],
    queryFn: () =>
      api
        .get<{ movements: { id: string; delta: number; stockAfter: number; reason: string; note: string | null; size: string; color: string | null; user: string | null; createdAt: string }[] }>(
          `/admin/catalog/products/${productId}/movements`,
        )
        .then((r) => r.movements),
  });
  return (
    <section className="card panel">
      <h2 className="panel__title">Movimientos de inventario</h2>
      {q.isLoading ? (
        <Skeleton h={120} />
      ) : !q.data?.length ? (
        <p className="small muted">Sin movimientos todavía.</p>
      ) : (
        <ul className="list">
          {q.data.slice(0, 20).map((m) => (
            <li key={m.id}>
              <span className="stack" style={{ '--gap': '2px' } as React.CSSProperties}>
                <span className="small strong">
                  {REASONS[m.reason] ?? m.reason} · {m.size}
                  {m.color ? ` / ${m.color}` : ''}
                </span>
                <span className="tiny muted">
                  {dateTime(m.createdAt)}
                  {m.user ? ` · ${m.user}` : ''}
                  {m.note ? ` · ${m.note}` : ''}
                </span>
              </span>
              <span className="strong num" style={{ color: m.delta > 0 ? 'var(--ok)' : 'var(--danger)' }}>
                {m.delta > 0 ? `+${m.delta}` : m.delta} → {m.stockAfter}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CategoriesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const cats = useCategories();
  const [edit, setEdit] = useState<Partial<Category> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!edit) return;
    setBusy(true);
    setErrors({});
    const body = { name: edit.name ?? '', description: edit.description || null, sortOrder: Number(edit.sortOrder ?? 0), isActive: edit.isActive ?? true };
    try {
      if (edit.id) await api.put(`/admin/catalog/categories/${edit.id}`, body);
      else await api.post('/admin/catalog/categories', body);
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['public-categories'] });
      toast.ok('Categoría guardada');
      setEdit(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        toast.error(err.message);
      }
    } finally {
      setBusy(false);
    }
  }
  async function remove(c: Category) {
    if (!confirm(`¿Eliminar la categoría "${c.name}"?`)) return;
    try {
      await api.del(`/admin/catalog/categories/${c.id}`);
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      toast.ok('Categoría eliminada');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo eliminar.');
    }
  }

  return (
    <>
      <PageTitle
        title="Categorías"
        sub="Organizan el catálogo y sirven de filtro para los clientes."
        actions={
          <Button variant="primary" onClick={() => setEdit({ isActive: true, sortOrder: 0 })} icon={<Plus aria-hidden />}>
            Nueva categoría
          </Button>
        }
      />
      {cats.isLoading ? (
        <Skeleton h={200} r={16} />
      ) : cats.isError ? (
        <ErrorState error={cats.error} onRetry={() => cats.refetch()} />
      ) : !cats.data?.length ? (
        <Empty icon={<Shirt />} title="Sin categorías">
          Crea categorías como «Camisetas», «Hoodies» o «Gorras» según lo que vendas.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th className="num">Productos</th>
                <th className="num">Orden</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cats.data.map((c) => (
                <tr key={c.id}>
                  <td className="strong">{c.name}</td>
                  <td className="small muted">{c.description ?? '—'}</td>
                  <td className="num">{c.productCount}</td>
                  <td className="num">{c.sortOrder}</td>
                  <td>{c.isActive ? <span className="badge badge--ok">Visible</span> : <span className="badge">Oculta</span>}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end', '--gap': '4px' } as React.CSSProperties}>
                      <Button size="sm" variant="ghost" className="btn--icon" aria-label={`Editar ${c.name}`} onClick={() => setEdit(c)}>
                        <Pencil />
                      </Button>
                      <Button size="sm" variant="ghost" className="btn--icon" aria-label={`Eliminar ${c.name}`} onClick={() => remove(c)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal
          title={edit.id ? 'Editar categoría' : 'Nueva categoría'}
          onClose={() => setEdit(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEdit(null)}>
                Cancelar
              </Button>
              <Button variant="primary" loading={busy} onClick={save}>
                Guardar
              </Button>
            </>
          }
        >
          <TextInput label="Nombre" value={edit.name ?? ''} maxLength={80} onChange={(e) => setEdit({ ...edit, name: e.target.value })} error={errors.name} required />
          <TextInput label="Descripción (opcional)" value={edit.description ?? ''} maxLength={300} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
          <TextInput label="Orden" type="number" min={0} value={String(edit.sortOrder ?? 0)} onChange={(e) => setEdit({ ...edit, sortOrder: Number(e.target.value) })} />
          <Switch checked={edit.isActive ?? true} onChange={(v) => setEdit({ ...edit, isActive: v })} label={edit.isActive ?? true ? 'Visible en el catálogo' : 'Oculta'} />
        </Modal>
      )}
    </>
  );
}
