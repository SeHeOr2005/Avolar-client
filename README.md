# AVOLAR Smoke Shop — Web (Avolar-client)

Sitio público + panel administrativo de AVOLAR. Consume el API de `Avolar-server`.

**Stack:** React 19 · Vite 8 · TypeScript · React Router 7 · TanStack Query · Recharts · lucide-react · CSS propio con tokens de diseño (sin framework de estilos).

## Puesta en marcha

```bash
npm install
cp .env.example .env      # opcional en local
npm run dev               # http://localhost:5173 (el API debe estar en http://localhost:4000)
```

En desarrollo, Vite reenvía `/api` al backend, así que frontend y API comparten origen y las cookies de sesión funcionan sin configurar CORS.
Producción: se despliega en Vercel con [`vercel.json`](vercel.json), que reenvía `/api` al backend en Render y sirve `index.html` en todas las rutas. Guía completa en `Avolar-server/DESPLIEGUE.md`.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `VITE_API_URL` | En producción si el API está en otro dominio | URL base del API terminada en `/api`. Por defecto `/api` |
| `DEV_API_PROXY_TARGET` | No (solo dev) | Destino del proxy de Vite. Por defecto `http://localhost:4000` |

El frontend **no** tiene secretos: nada de claves de Supabase ni contraseñas. El número de WhatsApp y los datos de la tienda llegan del API (`/public/settings`).

## Secciones

| Ruta | Página |
|---|---|
| `/` | Landing: hero, qué ofrece AVOLAR, cómo reservar, consolas y novedades del catálogo |
| `/reservar` · `/reservar/:slug` | Consolas y flujo de reserva (día → inicio/fin → datos → anticipo) |
| `/reserva/:code` · `/mi-reserva` | Ticket de reserva con instrucciones y botón de WhatsApp / consulta por código + teléfono |
| `/catalogo` · `/catalogo/:slug` | Catálogo con filtros y búsqueda / detalle con fotos, tallas, colores, stock y WhatsApp |
| `/tienda` · `/contacto` | Información, horario y contacto |
| `/admin/login` · `/admin/*` | Panel: dashboard, reservas, consolas, productos, categorías, configuración, usuarios y roles, mi cuenta |

## Sistema visual: Día y Noche

Los dos modos se definen en [`src/styles/tokens.css`](src/styles/tokens.css) y cambian **toda** la piel (fondos, tipografías, bordes, sombras, botones, tarjetas, formularios y gráficos):

- **Día**: póster tropical de verano (atardecer rosa/naranja/amarillo, mar azul, palmeras). Tipografía condensada *Big Shoulders Display* + acentos en *Yellowtail*. Componentes tipo sticker con contorno grueso y sombra desplazada, eco del trazo del logo. Referencia de ambiente veraniega/urbana; no usa recursos de ningún videojuego.
- **Noche**: paleta del logo (violeta `#8F3DFF`, menta `#2FE3A4`, magenta `#E043FF`) sobre ciruela casi negra, tipografía *Unbounded*, superficies de vidrio y brillos neón.

El interruptor está siempre visible en la cabecera y en el panel. La preferencia se guarda en `localStorage` (`avolar-theme`) y se aplica antes del primer pintado (sin parpadeo). La primera visita usa Día de 6:00 a 18:00 y Noche el resto. El cambio se revela en círculo desde el interruptor (View Transitions) y se desactiva con `prefers-reduced-motion`.

Accesibilidad: foco visible, enlace "saltar al contenido", diálogos con trampa de foco y cierre con Esc, etiquetas en todos los campos, `aria-live` en avisos, objetivos táctiles de 44 px o más, inputs de 16 px en móvil (sin zoom en iOS) y movimiento reducido.

## Estructura

```
src/
  main.tsx, AdminRoutes.tsx     rutas (el panel se carga bajo demanda)
  lib/        api.ts (fetch + CSRF + renovación de sesión), format.ts, types.ts
  hooks/      theme, toast, auth, data
  components/ ui/ (botones, campos, modal, insignias…), layout/, admin/, tarjetas, HeroArt
  pages/      public/ y admin/
  styles/     tokens.css, base.css, ui.css, public.css, admin.css
public/       logo-avolar.webp, favicon.png
```
