/**
 * Ilustración original del hero (SVG vectorial, sin recursos de terceros).
 * Día: sol de atardecer, mar, skyline costero y palmeras en contraluz.
 * Noche: skyline con ventanas de neón en los colores del logo y humo flotante.
 */
export function HeroArt() {
  return (
    <div className="hero__art" aria-hidden>
      {/* ───────── DÍA ───────── */}
      <svg className="only-day" viewBox="0 0 1440 560" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff2a8" />
            <stop offset="0.55" stopColor="#ffb340" />
            <stop offset="1" stopColor="#ff5a5f" />
          </linearGradient>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff7a6b" />
            <stop offset="0.25" stopColor="#c94c8f" />
            <stop offset="1" stopColor="#2a2a7a" />
          </linearGradient>
          <clipPath id="sunClip">
            <rect x="0" y="0" width="1440" height="350" />
          </clipPath>
        </defs>
        <g clipPath="url(#sunClip)">
          <circle cx="980" cy="330" r="190" fill="url(#sun)" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x="760" y={250 + i * 22} width="440" height={4 + i * 2.2} fill="#e43f8a" opacity="0.9" />
          ))}
        </g>
        {/* skyline lejano */}
        <path
          fill="#5b1f6e"
          opacity="0.85"
          d="M0 350 V300 h40 v-30 h30 v30 h24 v-60 h36 v60 h20 v-24 h44 v24 h30 v-90 h18 v-16 h22 v106 h28 v-40 h40 v40 h26 v-120 h12 v-20 h10 v20 h12 v120 h30 v-52 h40 v52 h24 v-34 h30 v34 h300 v-28 h30 v-50 h26 v78 h24 v-100 h42 v100 h20 v-44 h34 v44 h30 v-70 h20 v70 h40 v-36 h50 v36 h28 v-84 h36 v84 h40 v-30 h32 v30 h60 V350 Z"
        />
        {/* mar */}
        <rect x="0" y="350" width="1440" height="210" fill="url(#sea)" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={760 + i * 18} y={368 + i * 26} width={440 - i * 36} height="3" rx="2" fill="#ffd38a" opacity={0.8 - i * 0.11} />
        ))}
        {/* arena / malecón */}
        <path fill="#2a0e2c" d="M0 470 C 240 450, 420 500, 720 480 S 1200 450, 1440 478 V560 H0 Z" />
        {/* palmeras */}
        <Palm x={120} y={490} s={1.25} />
        <Palm x={300} y={500} s={0.85} flip />
        <Palm x={1260} y={486} s={1.35} flip />
        <Palm x={1390} y={500} s={0.9} />
      </svg>

      {/* ───────── NOCHE ───────── */}
      <svg className="only-night" viewBox="0 0 1440 560" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="nGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8f3dff" stopOpacity="0" />
            <stop offset="1" stopColor="#8f3dff" stopOpacity="0.45" />
          </linearGradient>
          <filter id="neon" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x="0" y="260" width="1440" height="300" fill="url(#nGlow)" />
        <path
          fill="#130926"
          d="M0 560 V380 h60 v-60 h40 v60 h30 v-140 h70 v140 h24 v-50 h50 v50 h40 v-190 h16 v-30 h30 v220 h40 v-90 h60 v90 h30 v-60 h40 v60 h40 v-160 h80 v160 h30 v-40 h60 v40 h40 v-120 h20 v-26 h30 v146 h40 v-80 h70 v80 h30 v-200 h60 v200 h40 v-60 h40 v60 h40 v-110 h50 v110 h50 v-50 h60 V560 Z"
        />
        {/* ventanas de neón */}
        <g filter="url(#neon)">
          {WINDOWS.map(([x, y, c], i) => (
            <rect key={i} x={x} y={y} width="8" height="12" rx="1" fill={c} opacity="0.9" />
          ))}
          <path d="M520 300 h80" stroke="#2fe3a4" strokeWidth="3" />
          <path d="M930 286 h60" stroke="#e043ff" strokeWidth="3" />
          <path d="M210 340 h70" stroke="#8f3dff" strokeWidth="3" />
        </g>
        {/* reflejo en el agua */}
        <rect x="0" y="540" width="1440" height="20" fill="#0b0613" />
      </svg>
      <div className="only-night">
        <span className="smoke" style={{ width: 520, height: 320, left: '-6%', bottom: '18%', background: 'rgba(143,61,255,.45)' }} />
        <span
          className="smoke"
          style={{ width: 460, height: 300, right: '-4%', top: '12%', background: 'rgba(224,67,255,.32)', animationDelay: '-6s' }}
        />
        <span
          className="smoke"
          style={{ width: 380, height: 240, left: '40%', bottom: '4%', background: 'rgba(47,227,164,.22)', animationDelay: '-11s' }}
        />
      </div>
    </div>
  );
}

const C = ['#8f3dff', '#2fe3a4', '#e043ff', '#52d2ff'];
const WINDOWS: [number, number, string][] = Array.from({ length: 70 }, (_, i) => {
  // Distribución determinista (sin aleatoriedad en cada render).
  const x = 70 + ((i * 197) % 1300);
  const y = 330 + ((i * 53) % 190);
  return [x, y, C[i % C.length]];
});

function Palm({ x, y, s = 1, flip }: { x: number; y: number; s?: number; flip?: boolean }) {
  const fronds = [-150, -120, -85, -55, -20, 15, 45];
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill="#2a0e2c">
      <path d="M-6 0 C -2 -80, 14 -170, 30 -250 L 38 -248 C 24 -168, 10 -80, 8 0 Z" />
      <g transform="translate(34 -250)">
        {fronds.map((a, i) => (
          <path key={i} transform={`rotate(${a})`} d="M0 0 C 30 -18, 70 -20, 104 4 C 72 -6, 40 0, 0 6 Z" />
        ))}
        <circle r="7" />
      </g>
    </g>
  );
}
