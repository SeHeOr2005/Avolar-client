/**
 * Textos legales: Términos y condiciones, Política de tratamiento de datos personales (Ley 1581 de 2012,
 * Decreto 1074 de 2015) y Política de cookies. Los datos del responsable y las reglas de reserva se leen
 * de la configuración de la tienda, para que los textos siempre coincidan con lo que aplica el sistema.
 *
 * IMPORTANTE: si cambias el contenido, actualiza LEGAL_VERSION aquí y en Avolar-server/src/config/legal.ts.
 * Estos textos son una base redactada para la operación de la tienda y deben ser revisados por un abogado.
 */
import { Link, NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ErrorState, Skeleton } from '../../components/ui';
import { useDocumentTitle, useSettings } from '../../hooks/data';
import { duration } from '../../lib/format';
import type { PublicSettings } from '../../lib/types';

export const LEGAL_VERSION = '2026-11-26';
const VERSION_LABEL = '26 de noviembre de 2026';

function LegalShell({ title, intro, children }: { title: string; intro: string; children: (s: PublicSettings) => ReactNode }) {
  useDocumentTitle(title);
  const { data: s, isLoading, isError, error, refetch } = useSettings();
  return (
    <div className="container legal">
      <header className="page-head">
        <p className="eyebrow">Legal</p>
        <h1 className="display">{title}</h1>
        <p>{intro}</p>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Última actualización: {VERSION_LABEL} · Versión {LEGAL_VERSION}
        </p>
        <nav className="legal__nav" aria-label="Documentos legales">
          <NavLink to="/terminos">Términos y condiciones</NavLink>
          <NavLink to="/privacidad">Tratamiento de datos</NavLink>
          <NavLink to="/cookies">Cookies</NavLink>
        </nav>
      </header>
      {isLoading ? <Skeleton h={500} r={20} /> : isError || !s ? <ErrorState error={error} onRetry={() => refetch()} /> : <article className="card legal__body">{children(s)}</article>}
    </div>
  );
}

/** Identificación del responsable a partir de la configuración. */
function Responsible({ s }: { s: PublicSettings }) {
  const name = s.legalName || s.businessName;
  return (
    <ul>
      <li>
        <strong>Responsable:</strong> {name}
        {s.legalName && s.legalName !== s.businessName ? ` (nombre comercial: ${s.businessName})` : ''}
      </li>
      {s.taxId && (
        <li>
          <strong>NIT / identificación:</strong> {s.taxId}
        </li>
      )}
      {s.address && (
        <li>
          <strong>Dirección:</strong> {s.address}
          {s.city ? `, ${s.city}` : ''}
        </li>
      )}
      {s.email && (
        <li>
          <strong>Correo:</strong> <a href={`mailto:${s.email}`}>{s.email}</a>
        </li>
      )}
      {(s.whatsappNumber || s.phone) && (
        <li>
          <strong>Teléfono / WhatsApp:</strong> {s.phone ?? `+${s.whatsappNumber}`}
        </li>
      )}
    </ul>
  );
}

const contactChannel = (s: PublicSettings) =>
  s.email ? `el correo ${s.email}` : s.whatsappNumber ? `WhatsApp (+${s.whatsappNumber})` : 'los canales de contacto publicados en el sitio';

export function Terms() {
  return (
    <LegalShell title="Términos y condiciones" intro="Reglas de uso del sitio, de las reservas de consolas y del catálogo. Léelas antes de reservar.">
      {(s) => (
        <>
          <h2>1. Quiénes somos</h2>
          <p>Este sitio web es operado por:</p>
          <Responsible s={s} />
          <p>
            Al usar el sitio o hacer una reserva aceptas estos términos. Si no estás de acuerdo con ellos, por favor no uses el sitio ni
            hagas reservas.
          </p>

          <h2>2. Uso del sitio</h2>
          <ul>
            <li>Para reservar o consultar el catálogo no necesitas crear una cuenta.</li>
            <li>Debes dar información veraz. Las reservas con datos falsos pueden cancelarse sin derecho a devolución.</li>
            <li>
              Está prohibido usar el sitio para fines ilícitos, intentar acceder sin autorización, alterar su funcionamiento o hacer reservas masivas
              o automatizadas. El sitio cuenta con sistemas de seguridad que bloquean automáticamente este tipo de actividad.
            </li>
          </ul>

          <h2>3. Reservas de consolas</h2>
          <ul>
            <li>Eliges consola, fecha y horario según la disponibilidad que muestra el sitio. El precio total se calcula por tiempo de uso.</li>
            <li>
              Para apartar el horario debes pagar un <strong>anticipo del {s.depositPercent} %</strong> del total por alguno de los medios de pago
              publicados y subir el comprobante en tu reserva (o enviarlo por WhatsApp). El saldo se paga en la tienda.
            </li>
            <li>
              La reserva queda <strong>pendiente de pago</strong> al crearla y solo se considera <strong>confirmada</strong> cuando la tienda
              verifica el anticipo.
            </li>
            {s.paymentHoldMinutes > 0 && (
              <li>
                Si no recibimos el comprobante dentro de {duration(s.paymentHoldMinutes)} después de reservar, la reserva se cancela
                automáticamente y el horario se libera.
              </li>
            )}
            <li>Tu número de reserva es personal. Con él y tu teléfono puedes consultar su estado en «Mi reserva».</li>
          </ul>

          <h2>4. Cancelaciones, reprogramaciones y devoluciones</h2>
          <ul>
            <li>
              Si cancelas o pides reprogramar con al menos <strong>{s.cancellationNoticeHours} horas</strong> de anticipación, puedes cambiar la fecha
              sin costo o solicitar la devolución del anticipo.
            </li>
            <li>
              Si cancelas con menos de {s.cancellationNoticeHours} horas de anticipación o no te presentas, el anticipo <strong>no es
              reembolsable</strong>, porque el horario quedó bloqueado para otros clientes.
            </li>
            <li>
              Si la tienda tiene que cancelar tu reserva (por ejemplo, por una falla del equipo o por fuerza mayor), te ofreceremos otro horario o la
              devolución total del anticipo.
            </li>
            <li>Las devoluciones se hacen por el mismo medio de pago usado, a nombre del titular que pagó.</li>
          </ul>

          <h2>5. Puntualidad y uso del tiempo</h2>
          <ul>
            <li>El tiempo reservado empieza a contar a la hora de inicio, aunque llegues tarde. Las llegadas tarde no extienden la hora de fin.</li>
            <li>Si no llegas dentro de los primeros 30 minutos y no nos avisas, la tienda puede liberar el horario sin devolver el anticipo.</li>
            <li>Si quieres jugar más tiempo, consulta en la tienda: se puede extender solo si el siguiente horario está libre.</li>
          </ul>

          <h2>6. Uso de los equipos y normas de la tienda</h2>
          <ul>
            <li>Los equipos, controles y accesorios deben usarse con cuidado. Los daños causados por mal uso pueden ser cobrados a quien los cause.</li>
            <li>La tienda se reserva el derecho de admisión y puede terminar una sesión ante comportamientos agresivos, peligrosos o ilegales.</li>
            <li>Debes respetar las normas internas que el personal te indique en la tienda.</li>
          </ul>

          <h2>7. Menores de edad y productos para fumadores</h2>
          <ul>
            <li>
              La venta de cigarrillos, tabaco, vapeadores y productos relacionados se hace <strong>solo en la tienda física y solo a mayores de 18
              años</strong>, con verificación de documento de identidad, conforme a la Ley 1335 de 2009. Este sitio no vende esos productos en línea.
            </li>
            <li>Los menores de edad deben hacer sus reservas por medio de su padre, madre o acudiente, quien es responsable de la reserva.</li>
          </ul>

          <h2>8. Catálogo de ropa</h2>
          <ul>
            <li>
              El catálogo es informativo: muestra prendas, tallas, colores, precios y disponibilidad. <strong>El sitio no procesa compras en
              línea</strong>; la compra se acuerda por WhatsApp y se realiza en la tienda.
            </li>
            <li>Los precios y la disponibilidad pueden cambiar sin aviso. Las fotos son de referencia y los colores pueden variar según la pantalla.</li>
            <li>Los productos tienen la garantía legal que establece el Estatuto del Consumidor (Ley 1480 de 2011).</li>
          </ul>

          <h2>9. Pagos</h2>
          <ul>
            <li>El sitio no recibe ni guarda datos de tarjetas ni claves. Los pagos se hacen fuera del sitio, solo a los medios de pago publicados.</li>
            <li>Nunca te pediremos claves, códigos de verificación ni datos bancarios por WhatsApp. Si alguien lo hace en nuestro nombre, no respondas.</li>
          </ul>

          <h2>10. Responsabilidad y disponibilidad</h2>
          <p>
            Hacemos lo posible para que el sitio esté disponible y la información sea correcta, pero puede haber interrupciones o errores. Si un
            error en el sitio afecta tu reserva, la tienda buscará una solución contigo, incluyendo reprogramar o devolver el anticipo.
          </p>

          <h2>11. Propiedad intelectual</h2>
          <p>
            Los textos, diseños y contenidos propios del sitio pertenecen a {s.legalName || s.businessName} o se usan con autorización. No pueden
            copiarse ni usarse con fines comerciales sin permiso.
          </p>

          <h2>12. Datos personales</h2>
          <p>
            Tratamos tus datos según nuestra <Link to="/privacidad">Política de tratamiento de datos personales</Link>. Al reservar, nos das tu
            autorización expresa para ello.
          </p>

          <h2>13. Cambios, ley aplicable y contacto</h2>
          <ul>
            <li>Podemos actualizar estos términos. La versión vigente siempre está publicada aquí, con su fecha de actualización.</li>
            <li>Estos términos se rigen por las leyes de la República de Colombia.</li>
            <li>
              Para peticiones, quejas o reclamos escríbenos a {contactChannel(s)}. También puedes acudir a la Superintendencia de Industria y
              Comercio (SIC).
            </li>
          </ul>
        </>
      )}
    </LegalShell>
  );
}

export function Privacy() {
  return (
    <LegalShell
      title="Política de tratamiento de datos personales"
      intro="Cómo recogemos, usamos y protegemos tus datos, y cómo ejercer tus derechos (Ley 1581 de 2012 y Decreto 1074 de 2015)."
    >
      {(s) => (
        <>
          <h2>1. Responsable del tratamiento</h2>
          <Responsible s={s} />

          <h2>2. Qué datos recogemos</h2>
          <ul>
            <li>
              <strong>Al reservar:</strong> nombre, número de teléfono / WhatsApp y, si los escribes, comentarios sobre la reserva.
            </li>
            <li>
              <strong>Datos técnicos:</strong> fecha, hora y dirección IP desde la que aceptas esta política (como prueba de tu autorización) y
              registros de seguridad del sitio. No usamos la IP para rastrearte ni para publicidad.
            </li>
            <li>
              <strong>Comprobante de pago:</strong> si lo subes en el sitio, guardamos la foto o el PDF que envías. Puede incluir tu nombre, el
              medio de pago y el valor. Se usa solo para verificar tu anticipo, se guarda en un espacio privado al que solo accede el equipo de
              la tienda y se elimina automáticamente a los 12 meses. Si prefieres, puedes enviarlo por WhatsApp.
            </li>
            <li>
              <strong>Si compras fiado en la tienda física:</strong> tu nombre y, si nos lo das, tu número de celular, junto con el registro de lo
              que te llevaste fiado, los abonos que haces (valor, fecha y medio de pago) y tu saldo pendiente. Los registra el equipo en la caja
              de la tienda; no se recogen en el sitio web.
            </li>
            <li>
              <strong>No recogemos</strong> datos sensibles, datos de tarjetas ni claves bancarias.
            </li>
          </ul>

          <h2>3. Para qué usamos tus datos</h2>
          <ul>
            <li>Crear, gestionar y confirmar tu reserva, y verificar el pago del anticipo.</li>
            <li>Contactarte por teléfono o WhatsApp sobre tu reserva (confirmaciones, cambios o cancelaciones).</li>
            <li>
              Si compras fiado: llevar la cuenta de lo que debes y de tus abonos, y recordarte tu saldo pendiente por WhatsApp si nos diste tu
              celular.
            </li>
            <li>Atender tus peticiones, quejas o reclamos.</li>
            <li>Proteger el sitio frente a fraudes y accesos no autorizados.</li>
            <li>Cumplir obligaciones legales, contables y tributarias.</li>
          </ul>
          <p>
            <strong>No vendemos ni compartimos tus datos con terceros para publicidad</strong>, ni te enviaremos mensajes promocionales sin una
            autorización adicional y separada.
          </p>

          <h2>4. Con quién compartimos los datos</h2>
          <p>
            Para que el sitio funcione usamos proveedores tecnológicos que actúan como <strong>encargados</strong> y solo procesan los datos para
            prestarnos su servicio: alojamiento de la aplicación (Render y Vercel) y base de datos y almacenamiento (Supabase). Sus servidores
            pueden estar fuera de Colombia, por ejemplo en Estados Unidos, por lo que hay una transmisión internacional de datos con proveedores
            que ofrecen niveles adecuados de protección. También podemos entregar datos a autoridades cuando la ley lo exija.
          </p>

          <h2>5. Tus derechos</h2>
          <p>Como titular de los datos puedes, de forma gratuita:</p>
          <ul>
            <li>Conocer, actualizar y rectificar tus datos.</li>
            <li>Pedir prueba de la autorización que nos diste.</li>
            <li>Saber para qué se han usado tus datos.</li>
            <li>
              Revocar la autorización o pedir que eliminemos tus datos, cuando no exista un deber legal o contractual de conservarlos (por
              ejemplo, una reserva en curso).
            </li>
            <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC), después de haber hecho tu solicitud ante nosotros.</li>
          </ul>

          <h2>6. Cómo ejercer tus derechos</h2>
          <ul>
            <li>
              Escríbenos a {contactChannel(s)} indicando tu nombre, tu teléfono, lo que solicitas y, si aplica, tu número de reserva.
            </li>
            <li>
              <strong>Consultas:</strong> respondemos en un máximo de <strong>10 días hábiles</strong>, prorrogables por 5 días hábiles más
              avisándote el motivo.
            </li>
            <li>
              <strong>Reclamos</strong> (corrección, actualización, supresión o revocatoria): respondemos en un máximo de <strong>15 días
              hábiles</strong>, prorrogables por 8 días hábiles más avisándote el motivo.
            </li>
          </ul>

          <h2>7. Menores de edad</h2>
          <p>
            No recogemos de forma intencional datos de menores de 18 años. Si un menor necesita una reserva, debe hacerla su padre, madre o
            acudiente con sus propios datos.
          </p>

          <h2>8. Cuánto tiempo guardamos los datos</h2>
          <ul>
            <li>Los datos de las reservas, durante el tiempo necesario para las finalidades descritas y para cumplir obligaciones legales y contables.</li>
            <li>
              La dirección IP desde la que aceptaste esta política, <strong>12 meses</strong>. Después se elimina automáticamente y solo
              conservamos la fecha, la hora y la versión que aceptaste.
            </li>
            <li>Los comprobantes de pago que subas, 12 meses. Después se eliminan automáticamente.</li>
            <li>
              Los datos de compras fiadas, mientras tengas saldo pendiente y después durante el tiempo que exijan las obligaciones contables.
              Cuando quedes a paz y salvo puedes pedirnos que borremos tu celular.
            </li>
            <li>Los registros de seguridad, hasta 90 días.</li>
            <li>Cuando ya no sean necesarios, los eliminamos o anonimizamos.</li>
          </ul>

          <h2>9. Seguridad</h2>
          <p>
            Aplicamos medidas técnicas y administrativas para proteger tus datos: conexiones cifradas (HTTPS), acceso restringido al panel
            administrativo con usuario, contraseña y roles, registros de actividad y bloqueo automático de intentos de acceso no autorizado.
          </p>

          <h2>10. Autorización, vigencia y cambios</h2>
          <p>
            Al marcar la casilla de aceptación al reservar, nos das tu autorización previa, expresa e informada para tratar tus datos según esta
            política. Guardamos la fecha, la hora y la versión aceptada como prueba. Esta política rige desde su publicación; si la cambiamos de
            forma sustancial, lo informaremos en el sitio.
          </p>
          <p>
            Si compras fiado en la tienda, el equipo te pedirá en ese momento tu autorización para registrar tu nombre y, si quieres, tu
            celular, y te indicará dónde consultar esta política. Darnos tu celular es opcional: sin él igual podemos fiarte.
          </p>
        </>
      )}
    </LegalShell>
  );
}

export function Cookies() {
  return (
    <LegalShell title="Política de cookies" intro="Qué guarda este sitio en tu navegador y para qué.">
      {() => (
        <>
          <h2>Solo usamos almacenamiento técnico</h2>
          <p>
            Este sitio <strong>no usa cookies de publicidad, de analítica ni de redes sociales</strong>, y no te rastrea en otros sitios. Solo
            guarda la información mínima necesaria para funcionar:
          </p>
          <div className="table-wrap" style={{ margin: '12px 0' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Para qué</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono">avolar-theme</td>
                  <td>Almacenamiento local</td>
                  <td>Recordar si prefieres el modo Día o Noche.</td>
                  <td>Hasta que lo borres</td>
                </tr>
                <tr>
                  <td className="mono">avolar-last-reservation</td>
                  <td>Almacenamiento de sesión</td>
                  <td>Mostrar tu última reserva si recargas la página.</td>
                  <td>Hasta cerrar la pestaña</td>
                </tr>
                <tr>
                  <td className="mono">av_at, av_rt</td>
                  <td>Cookies de sesión</td>
                  <td>Mantener la sesión del panel administrativo (solo personal de la tienda).</td>
                  <td>Hasta cerrar el navegador o 30 min sin actividad</td>
                </tr>
                <tr>
                  <td className="mono">avolar-admin-*</td>
                  <td>Almacenamiento local y de sesión</td>
                  <td>Seguridad del panel: cierre por inactividad y al cerrar la pestaña.</td>
                  <td>Mientras dure la sesión</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Como son estrictamente necesarias para el funcionamiento del sitio, no requieren tu consentimiento. Puedes borrarlas desde la
            configuración de tu navegador; si lo haces, el sitio olvidará tu modo preferido.
          </p>
          <h2>Servicios externos</h2>
          <p>
            Las tipografías se cargan desde Google Fonts y las imágenes desde nuestro almacenamiento en Supabase. Al pulsar un botón de WhatsApp
            sales de este sitio, y aplican las políticas de WhatsApp.
          </p>
        </>
      )}
    </LegalShell>
  );
}
