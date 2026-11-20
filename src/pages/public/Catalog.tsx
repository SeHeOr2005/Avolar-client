import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, Shirt } from 'lucide-react';
import { ProductCard } from '../../components/ProductCard';
import { Button, Empty, ErrorState, Skeleton } from '../../components/ui';
import { api, qs } from '../../lib/api';
import { useDocumentTitle, useSettings } from '../../hooks/data';
import type { Category, Pagination, Product } from '../../lib/types';

export default function Catalog() {
  useDocumentTitle('Catálogo de ropa');
  const { data: s } = useSettings();
  const [params, setParams] = useSearchParams();
  const category = params.get('categoria') ?? '';
  const sort = params.get('orden') ?? 'new';
  const page = Number(params.get('pagina') ?? 1);
  const [search, setSearch] = useState(params.get('q') ?? '');

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!('pagina' in patch)) next.delete('pagina');
    setParams(next, { replace: true });
  };

  // Búsqueda con pequeña espera para no consultar en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') ?? '') !== search.trim()) update({ q: search.trim() || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const cats = useQuery({
    queryKey: ['public-categories'],
    queryFn: () => api.get<{ categories: Category[] }>('/public/categories').then((r) => r.categories),
  });
  const prods = useQuery({
    queryKey: ['public-products', category, sort, page, params.get('q')],
    queryFn: () =>
      api.get<{ products: Product[]; pagination: Pagination }>(
        `/public/products${qs({ category, sort, page, q: params.get('q'), pageSize: 24 })}`,
      ),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="container">
      <header className="page-head">
        <p className="eyebrow">Catálogo</p>
        <h1 className="display">Ropa Avolar</h1>
        <p>Explora las prendas disponibles en tienda. ¿Te interesa alguna? Escríbenos por WhatsApp desde el producto y te la apartamos.</p>
        <div className="page-band" />
      </header>

      <div className="filters" role="group" aria-label="Filtrar por categoría">
        <button className="chip" aria-pressed={!category} onClick={() => update({ categoria: null })}>
          Todo
        </button>
        {cats.data?.map((c) => (
          <button key={c.id} className="chip" aria-pressed={category === c.slug} onClick={() => update({ categoria: c.slug })}>
            {c.name}
            <span className="tiny muted">{c.productCount}</span>
          </button>
        ))}
      </div>

      <div className="catalog-toolbar">
        <label className="row" style={{ flex: '1 1 260px', maxWidth: 420, position: 'relative' }}>
          <span className="sr-only">Buscar prendas</span>
          <Search size={18} style={{ position: 'absolute', left: 14, color: 'var(--ink-faint)' }} aria-hidden />
          <input className="input" style={{ paddingLeft: 42 }} placeholder="Buscar prendas…" value={search} onChange={(e) => setSearch(e.target.value)} type="search" />
        </label>
        <label className="row small">
          <span className="muted">Ordenar</span>
          <select className="select" style={{ width: 'auto' }} value={sort} onChange={(e) => update({ orden: e.target.value })}>
            <option value="new">Más recientes</option>
            <option value="price_asc">Precio: menor a mayor</option>
            <option value="price_desc">Precio: mayor a menor</option>
            <option value="name">Nombre</option>
          </select>
        </label>
      </div>

      {prods.isLoading ? (
        <div className="product-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} h={380} r={26} />
          ))}
        </div>
      ) : prods.isError ? (
        <ErrorState error={prods.error} onRetry={() => prods.refetch()} />
      ) : prods.data?.products.length ? (
        <>
          <div className="product-grid" style={{ opacity: prods.isFetching ? 0.6 : 1, transition: 'opacity 200ms ease' }}>
            {prods.data.products.map((p) => (
              <ProductCard key={p.id} p={p} currency={s?.currency ?? 'COP'} />
            ))}
          </div>
          {prods.data.pagination.totalPages > 1 && (
            <div className="pagination">
              <Button size="sm" disabled={page <= 1} onClick={() => update({ pagina: String(page - 1) })}>
                Anterior
              </Button>
              <span>
                Página {page} de {prods.data.pagination.totalPages}
              </span>
              <Button size="sm" disabled={page >= prods.data.pagination.totalPages} onClick={() => update({ pagina: String(page + 1) })}>
                Siguiente
              </Button>
            </div>
          )}
        </>
      ) : (
        <Empty
          icon={<Shirt />}
          title={category || params.get('q') ? 'No encontramos prendas' : 'El catálogo está en camino'}
          action={
            category || params.get('q') ? (
              <Button
                onClick={() => {
                  setSearch('');
                  setParams({}, { replace: true });
                }}
              >
                Ver todo el catálogo
              </Button>
            ) : undefined
          }
        >
          {category || params.get('q') ? 'Prueba con otra categoría o búsqueda.' : 'Muy pronto publicaremos nuestras prendas.'}
        </Empty>
      )}
    </div>
  );
}
