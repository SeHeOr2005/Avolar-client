import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Shirt } from 'lucide-react';
import { ProductCard } from '../../components/ProductCard';
import { Empty, ErrorState, Skeleton, btnClass } from '../../components/ui';
import { ApiError, api } from '../../lib/api';
import { money, waLink } from '../../lib/format';
import { useDocumentTitle, useSettings } from '../../hooks/data';
import type { Product } from '../../lib/types';

const TONE: Record<string, string> = { AVAILABLE: 'ok', LOW_STOCK: 'warn', OUT_OF_STOCK: 'danger', INACTIVE: 'muted' };

export default function ProductDetail() {
  const { slug = '' } = useParams();
  const { data: s } = useSettings();
  const q = useQuery({
    queryKey: ['public-product', slug],
    queryFn: () => api.get<{ product: Product; related: Product[] }>(`/public/products/${slug}`),
  });
  const p = q.data?.product;
  useDocumentTitle(p?.name ?? 'Producto');

  const [img, setImg] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  const stockFor = useMemo(() => {
    return (sz: string | null, col: string | null) =>
      (p?.variants ?? []).filter((v) => (!sz || v.size === sz) && (!col || v.color === col)).reduce((n, v) => n + v.stock, 0);
  }, [p]);

  if (q.isLoading) {
    return (
      <div className="container page-head pdp">
        <Skeleton h={560} r={26} />
        <div className="stack">
          <Skeleton h={60} />
          <Skeleton h={40} w="40%" />
          <Skeleton h={160} />
        </div>
      </div>
    );
  }
  if (q.isError || !p) {
    return (
      <div className="container page-head">
        {q.error instanceof ApiError && q.error.status === 404 ? (
          <Empty icon={<Shirt />} title="Producto no disponible" action={<Link to="/catalogo" className="btn">Ir al catálogo</Link>}>
            Este producto no existe o ya no está en el catálogo.
          </Empty>
        ) : (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        )}
      </div>
    );
  }

  const selectedStock = size || color ? stockFor(size, color) : p.totalStock;
  const hasColors = p.colors.length > 0;
  const message = [
    `Hola ${s?.businessName ?? 'AVOLAR'}, me interesa este producto:`,
    `• ${p.name} (${money(p.price, s?.currency)})`,
    size ? `• Talla: ${size}` : null,
    color ? `• Color: ${color}` : null,
    `${window.location.origin}/catalogo/${p.slug}`,
    '¿Está disponible?',
  ]
    .filter(Boolean)
    .join('\n');
  const wa = waLink(s?.whatsappNumber, message);
  const current = p.images[img];

  return (
    <div className="container">
      <nav className="breadcrumb page-head" style={{ paddingBottom: 0 }} aria-label="Migas de pan">
        <Link to="/catalogo">Catálogo</Link> <span aria-hidden>/</span>
        <Link to={`/catalogo?categoria=${p.category.slug}`}>{p.category.name}</Link> <span aria-hidden>/</span>
        <span>{p.name}</span>
      </nav>

      <div className="pdp" style={{ marginTop: 18 }}>
        <div className="gallery">
          <div className="gallery__main">
            {current ? (
              <img key={current.id} src={current.url} alt={current.alt ?? p.name} />
            ) : (
              <div className="no-photo">
                <Shirt aria-hidden />
              </div>
            )}
          </div>
          {p.images.length > 1 && (
            <div className="gallery__thumbs" role="group" aria-label="Fotos del producto">
              {p.images.map((im, k) => (
                <button key={im.id} type="button" className="gallery__thumb" aria-current={k === img} onClick={() => setImg(k)} aria-label={`Ver foto ${k + 1}`}>
                  <img src={im.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pdp__info">
          <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <span className="eyebrow">{p.category.name}</span>
            <h1 className="display">{p.name}</h1>
            <div className="row">
              <span className="pdp__price">{money(p.price, s?.currency)}</span>
              <span className={`badge badge--${TONE[p.availability]}`}>{p.availabilityLabel}</span>
            </div>
          </div>

          {p.description && <p style={{ whiteSpace: 'pre-line' }}>{p.description}</p>}

          {p.sizes.length > 0 && (
            <fieldset className="stack" style={{ '--gap': '10px', border: 0, padding: 0, margin: 0 } as React.CSSProperties}>
              <legend className="small strong" style={{ marginBottom: 10 }}>
                Talla {size && <span className="muted">· {size}</span>}
              </legend>
              <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
                {p.sizes.map((sz) => {
                  const st = stockFor(sz, color);
                  return (
                    <button
                      key={sz}
                      type="button"
                      className="chip"
                      aria-pressed={size === sz}
                      disabled={st === 0}
                      title={st === 0 ? 'Agotada' : undefined}
                      onClick={() => setSize(size === sz ? null : sz)}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {hasColors && (
            <fieldset className="stack" style={{ '--gap': '10px', border: 0, padding: 0, margin: 0 } as React.CSSProperties}>
              <legend className="small strong" style={{ marginBottom: 10 }}>
                Color {color && <span className="muted">· {color}</span>}
              </legend>
              <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
                {p.colors.map((c) => {
                  const st = stockFor(size, c.name);
                  return (
                    <button
                      key={c.name}
                      type="button"
                      className="chip"
                      aria-pressed={color === c.name}
                      disabled={st === 0}
                      onClick={() => setColor(color === c.name ? null : c.name)}
                    >
                      {c.hex && <span className="swatch" style={{ background: c.hex }} aria-hidden />}
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <p className="small muted" aria-live="polite">
            {selectedStock > 0
              ? `${selectedStock} ${selectedStock === 1 ? 'unidad disponible' : 'unidades disponibles'}${size || color ? ' en tu selección' : ''}.`
              : 'Sin unidades disponibles en este momento. Escríbenos y te avisamos cuando vuelva.'}
          </p>

          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={btnClass('whatsapp', 'lg', true)}>
              <MessageCircle aria-hidden /> {selectedStock > 0 ? 'Lo quiero: escribir por WhatsApp' : 'Preguntar por WhatsApp'}
            </a>
          ) : (
            <div className="alert alert--warn">El contacto por WhatsApp aún no está configurado.</div>
          )}
          <p className="tiny muted">Venta en tienda física. Te confirmamos disponibilidad y te apartamos la prenda por WhatsApp.</p>
        </div>
      </div>

      {q.data!.related.length > 0 && (
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="section-head">
            <h2 className="display" style={{ fontSize: 'var(--text-xl)' }}>
              También en {p.category.name}
            </h2>
          </div>
          <div className="product-grid">
            {q.data!.related.map((r) => (
              <ProductCard key={r.id} p={r} currency={s?.currency ?? 'COP'} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
