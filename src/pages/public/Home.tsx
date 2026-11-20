import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarCheck, Gamepad2, MessageCircle, Shirt, Wallet } from 'lucide-react';
import { HeroArt } from '../../components/HeroArt';
import { ConsoleCard } from '../../components/ConsoleCard';
import { ProductCard } from '../../components/ProductCard';
import { btnClass, Skeleton } from '../../components/ui';
import { api } from '../../lib/api';
import { useDocumentTitle, useSettings } from '../../hooks/data';
import { money } from '../../lib/format';
import type { GameConsole, Product } from '../../lib/types';

export default function Home() {
  useDocumentTitle(undefined);
  const { data: s } = useSettings();
  const consoles = useQuery({
    queryKey: ['public-consoles'],
    queryFn: () => api.get<{ consoles: GameConsole[] }>('/public/consoles').then((r) => r.consoles),
  });
  const products = useQuery({
    queryKey: ['public-products', 'home'],
    queryFn: () => api.get<{ products: Product[] }>('/public/products?pageSize=8').then((r) => r.products),
  });
  const cheapest = consoles.data?.length ? Math.min(...consoles.data.map((c) => c.pricePerHour)) : null;
  const deposit = s?.depositPercent ?? 50;

  return (
    <>
      <section className="hero">
        <HeroArt />
        <div className="container hero__inner">
          <div>
            <h1 className="hero__title display reveal" style={{ '--d': 1 } as React.CSSProperties}>
              <span className="script">bienvenido a</span>
              Juega, viste
              <br />
              y <span className="stroke">vuela.</span>
            </h1>
            <p className="hero__lead reveal" style={{ '--d': 2 } as React.CSSProperties}>
              Reserva tu consola y ven a jugar a la tienda, o pasa a ver la ropa del momento. Sin cuentas y sin
              registros: eliges tu horario y lo apartas con un anticipo del {deposit} %.
            </p>
            <div className="hero__ctas reveal" style={{ '--d': 3 } as React.CSSProperties}>
              <Link to="/reservar" className={btnClass('accent', 'lg')}>
                <Gamepad2 aria-hidden /> Reservar consola
              </Link>
              <Link to="/catalogo" className={btnClass('default', 'lg')}>
                <Shirt aria-hidden /> Ver catálogo
              </Link>
            </div>
          </div>
          <div className="hero__badge reveal" style={{ '--d': 2 } as React.CSSProperties}>
            <div className="hero__badge-card">
              {/* Mascota de AVOLAR (imagen aportada por la tienda: public/mascota.webp). */}
              <div className="mascot">
                <img src="/mascota.webp" alt="Mascota de AVOLAR Smoke Shop" width={820} height={764} className="mascot__img" />
                <span className="mascot__shadow" aria-hidden />
              </div>
              <div className="hero__stats">
                <div>
                  <strong>{consoles.data ? consoles.data.length : '–'}</strong>
                  <span>Consolas</span>
                </div>
                <div>
                  <strong>{deposit}%</strong>
                  <span>Anticipo</span>
                </div>
                <div>
                  <strong>0</strong>
                  <span>Registros</span>
                </div>
              </div>
              {cheapest != null && s && (
                <p className="small" style={{ textAlign: 'center', fontWeight: 700 }}>
                  Desde {money(cheapest, s.currency)} la hora
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="ticker" aria-hidden>
        <div className="ticker__track">
          {[0, 1].map((k) => (
            <span key={k}>
              Reserva tu consola <span>✦</span> Ropa urbana <span>✦</span> Anticipo por WhatsApp <span>✦</span> Sin registro{' '}
              <span>✦</span> Ven a jugar <span>✦</span> Avolar Smoke Shop <span>✦</span>
            </span>
          ))}
        </div>
      </div>

      <section className="section container">
        <div className="section-head">
          <div>
            <p className="eyebrow">Qué hay en Avolar</p>
            <h2 className="display">Dos planes, una sola parada</h2>
          </div>
          <p>Una tienda física con espacio para jugar y una selección de ropa. Todo se gestiona aquí mismo, en línea.</p>
        </div>
        <div className="offer-grid">
          <Link to="/reservar" className="offer offer--games">
            <OfferPattern kind="games" />
            <span className="eyebrow" style={{ color: 'rgba(255,255,255,.8)' }}>
              Reservas
            </span>
            <h3 className="display">Gaming lounge</h3>
            <p>Elige consola, día y horario. El sistema revisa la disponibilidad en tiempo real y te calcula el precio al instante.</p>
            <span className="offer__cta">
              Ver consolas disponibles <ArrowRight size={18} aria-hidden />
            </span>
          </Link>
          <Link to="/catalogo" className="offer offer--wear">
            <OfferPattern kind="wear" />
            <span className="eyebrow" style={{ color: 'rgba(255,255,255,.8)' }}>
              Catálogo
            </span>
            <h3 className="display">Ropa Avolar</h3>
            <p>Prendas, tallas, colores y disponibilidad. ¿Te gustó algo? Escríbenos por WhatsApp y te lo apartamos.</p>
            <span className="offer__cta">
              Explorar prendas <ArrowRight size={18} aria-hidden />
            </span>
          </Link>
        </div>
      </section>

      <section className="section container" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <p className="eyebrow">Cómo reservar</p>
            <h2 className="display">En cuatro pasos</h2>
          </div>
        </div>
        <ol className="steps" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {[
            { icon: Gamepad2, t: 'Elige tu consola', d: 'Mira las características, fotos y el precio por hora de cada una.' },
            { icon: CalendarCheck, t: 'Escoge día y horario', d: 'Solo ves los horarios libres. El tiempo y el total se calculan solos.' },
            { icon: Wallet, t: `Paga el ${deposit} %`, d: 'Recibes tu número de reserva y las instrucciones para hacer el depósito.' },
            { icon: MessageCircle, t: 'Envía el comprobante', d: 'Un botón abre WhatsApp con tu reserva lista. Te confirmamos en cuanto lo verifiquemos.' },
          ].map((st, i) => (
            <li key={st.t} className="card step">
              <span className="step__n">0{i + 1}</span>
              <h3>{st.t}</h3>
              <p>{st.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section container" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <p className="eyebrow">Consolas</p>
            <h2 className="display">Listas para jugar</h2>
          </div>
          <Link to="/reservar" className={btnClass('default')}>
            Ver todas <ArrowRight aria-hidden />
          </Link>
        </div>
        {consoles.isLoading ? (
          <div className="console-grid">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h={360} r={26} />
            ))}
          </div>
        ) : consoles.data?.length ? (
          <div className="console-grid">
            {consoles.data.slice(0, 3).map((c) => (
              <ConsoleCard key={c.id} c={c} currency={s?.currency ?? 'COP'} />
            ))}
          </div>
        ) : (
          <p className="muted">Muy pronto publicaremos las consolas disponibles.</p>
        )}
      </section>

      {products.data && products.data.length > 0 && (
        <section className="section container" style={{ paddingTop: 0 }}>
          <div className="section-head">
            <div>
              <p className="eyebrow">Catálogo</p>
              <h2 className="display">Lo nuevo en ropa</h2>
            </div>
            <Link to="/catalogo" className={btnClass('default')}>
              Ver catálogo <ArrowRight aria-hidden />
            </Link>
          </div>
          <div className="product-grid">
            {products.data.slice(0, 4).map((p) => (
              <ProductCard key={p.id} p={p} currency={s?.currency ?? 'COP'} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Patrones gráficos decorativos de las tarjetas de oferta. */
function OfferPattern({ kind }: { kind: 'games' | 'wear' }) {
  return (
    <svg className="offer__art" viewBox="0 0 400 300" preserveAspectRatio="xMaxYMin slice" aria-hidden>
      {kind === 'games' ? (
        <g fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="10" strokeLinecap="round">
          <circle cx="330" cy="60" r="34" />
          <path d="M250 40 l40 40 M290 40 l-40 40" />
          <rect x="300" y="120" width="60" height="60" rx="6" />
          <path d="M240 150 l30 -50 l30 50 z" />
        </g>
      ) : (
        <g fill="rgba(255,255,255,.16)">
          <path d="M250 30 l40 -16 q20 18 40 0 l40 16 l-14 44 l-22 -8 v90 h-88 v-90 l-22 8 z" />
          <circle cx="250" cy="200" r="40" />
        </g>
      )}
    </svg>
  );
}
