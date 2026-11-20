import { Link } from 'react-router-dom';
import { Shirt } from 'lucide-react';
import { money } from '../lib/format';
import type { Product } from '../lib/types';

const TONE: Record<string, string> = { AVAILABLE: 'ok', LOW_STOCK: 'warn', OUT_OF_STOCK: 'danger', INACTIVE: 'muted' };

export function ProductCard({ p, currency }: { p: Product; currency: string }) {
  const img = p.images[0];
  return (
    <Link to={`/catalogo/${p.slug}`} className="card product-card">
      <div className="product-card__media">
        {img ? (
          <img src={img.url} alt={img.alt ?? p.name} loading="lazy" />
        ) : (
          <div className="no-photo">
            <Shirt aria-hidden />
          </div>
        )}
        {p.availability !== 'AVAILABLE' && <span className={`badge badge--${TONE[p.availability]}`}>{p.availabilityLabel}</span>}
      </div>
      <div className="product-card__body">
        <span className="tiny muted strong" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>
          {p.category.name}
        </span>
        <h3>{p.name}</h3>
        <span className="product-card__price">{money(p.price, currency)}</span>
        {p.sizes.length > 0 && <span className="tiny muted">Tallas: {p.sizes.join(' · ')}</span>}
      </div>
    </Link>
  );
}
