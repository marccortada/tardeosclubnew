import type { Metadata } from "next";
import PaginaLegal from "@/components/PaginaLegal";
import { RESPONSABLE, SUBENCARGADOS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de privacidad — TardeosClub",
  description: "Qué datos guardamos en TardeosClub, para qué, y cómo puedes borrarlos.",
};

export default function Privacidad() {
  const { nombreComercial, razonSocial, emailPrivacidad } = RESPONSABLE;

  return (
    <PaginaLegal
      titulo="Política de privacidad"
      entradilla="Qué datos guardamos, para qué los usamos y cómo puedes borrarlos. Sin letra pequeña."
    >
      <h2>En resumen</h2>
      <ul>
        <li>Guardamos tu email, lo que te gusta y qué usas de la web. Nada más.</li>
        <li>
          <strong>No usamos cookies de seguimiento</strong>, ni Google Analytics, ni guardamos tu IP.
        </li>
        <li><strong>No vendemos</strong> tus datos a nadie.</li>
        <li>Puedes <strong>borrar tu cuenta</strong> cuando quieras y desaparecen tus datos.</li>
        <li>Solo te enviamos emails de marketing si <strong>tú lo aceptas</strong>.</li>
      </ul>

      <h2>1. Quién trata tus datos</h2>
      <p>
        El responsable es <strong>{nombreComercial}</strong>
        {razonSocial ? ` (${razonSocial})` : " (entidad legal en constitución)"}. Para cualquier
        cosa relacionada con tus datos, escribe a{" "}
        <a href={`mailto:${emailPrivacidad}`}>{emailPrivacidad}</a>.
      </p>

      <h2>2. Qué datos guardamos y por qué</h2>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Qué</th>
              <th>Para qué</th>
              <th>Base legal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Email y nombre</td>
              <td>Que puedas entrar en tu cuenta y reconocerte</td>
              <td>Prestarte el servicio</td>
            </tr>
            <tr>
              <td>Tardeos a los que te apuntas y favoritos</td>
              <td>Enseñártelos y avisar al local de cuánta gente va</td>
              <td>Prestarte el servicio</td>
            </tr>
            <tr>
              <td>Reseñas que escribes</td>
              <td>Mostrarlas una vez aprobadas</td>
              <td>Prestarte el servicio</td>
            </tr>
            <tr>
              <td>Recordatorio del tardeo de mañana</td>
              <td>Que no se te olvide al que te apuntaste</td>
              <td>Prestarte el servicio</td>
            </tr>
            <tr>
              <td>Emails de ofertas y novedades</td>
              <td>Contarte promociones</td>
              <td>Tu consentimiento (puedes retirarlo)</td>
            </tr>
            <tr>
              <td>Datos del local o del DJ (si lo eres)</td>
              <td>Publicar tu ficha y gestionar tu suscripción</td>
              <td>Contrato</td>
            </tr>
            <tr>
              <td>Clic al comprar entrada</td>
              <td>Saber qué tardeos funcionan</td>
              <td>Interés legítimo</td>
            </tr>
            <tr>
              <td>Tus gustos: música, ambiente, tipo de plan, edad y zonas</td>
              <td>Proponerte tardeos que encajan y no mandarte avisos que no van contigo</td>
              <td>Tu consentimiento (los rellenas tú, y puedes vaciarlos)</td>
            </tr>
            <tr>
              <td>Qué pantallas abres, qué buscas y qué filtros usas</td>
              <td>Saber qué funciona, qué sobra y qué falta en la cartelera</td>
              <td>Interés legítimo</td>
            </tr>
            <tr>
              <td>Si activas los avisos, el identificador de tu dispositivo</td>
              <td>Poder enviarte la notificación al móvil</td>
              <td>Tu consentimiento (se retira desactivándolos)</td>
            </tr>
            <tr>
              <td>Si pides gestionar una ficha: tu nombre, cargo y teléfono</td>
              <td>Comprobar que eres quien dices antes de darte acceso</td>
              <td>Prestarte el servicio</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <strong>No pedimos</strong> tu DNI, ni tu dirección postal, ni datos bancarios. Los pagos
        de entradas los gestiona Fourvenues en su propia web.
      </p>

      <h2>3. Cómo medimos el uso</h2>
      <p>
        Medimos qué se usa de la web para saber qué funciona y qué falta.{" "}
        <strong>Sin cookies, sin Google Analytics y sin perfiles publicitarios</strong>, y por eso no
        te ponemos un banner de aceptación. La medición es nuestra: no se la vendemos ni se la
        cedemos a nadie.
      </p>
      <p>Guardamos qué pasó y cuándo:</p>
      <ul>
        <li>Qué pantalla abriste y qué ficha miraste.</li>
        <li>
          Qué buscaste y qué filtros usaste. <strong>El texto de la búsqueda se guarda</strong>,
          porque saber qué se busca sin encontrar nada es lo que nos dice qué cartelera falta.
        </li>
        <li>Si guardaste un tardeo, si te apuntaste y si pulsaste para comprar la entrada.</li>
      </ul>
      <p>
        <strong>
          No guardamos tu IP, ni qué navegador usas, ni nada que sirva para reconocerte entre visitas.
        </strong>{" "}
        Cada pestaña lleva un número al azar que se pierde al cerrarla, y solo sirve para no contarte
        diez veces si recargas.
      </p>
      <p>
        Si has entrado con tu cuenta, la acción queda asociada a ella y la usamos para afinar lo que
        te recomendamos. No la usamos para fabricar un perfil tuyo ni para enseñárselo a nadie: los
        locales solo ven <em>cuántas</em> personas han mirado su ficha, nunca quién.
      </p>
      <p>
        No escribas datos personales en el buscador: es texto libre y se guarda tal cual, recortado a
        80 caracteres.
      </p>

      <h2>4. Flyers e inteligencia artificial</h2>
      <p>
        Si eres un local y subes un flyer, lo enviamos a <strong>Anthropic (Claude)</strong> para
        leer automáticamente el título, la fecha y la hora. Si pides que te creemos un flyer, la
        descripción va a <strong>OpenAI</strong> para generar la imagen. Son proveedores de EE. UU.
        y sus APIs no usan ese contenido para entrenar sus modelos. Sube solo flyers de tus
        eventos: no envíes fotos con datos personales de terceros.
      </p>

      <h2>5. Quién más ve tus datos</h2>
      <p>
        Solo proveedores que trabajan para nosotros, con contrato de tratamiento de datos:
      </p>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Para qué</th>
              <th>Dónde</th>
            </tr>
          </thead>
          <tbody>
            {SUBENCARGADOS.map((s) => (
              <tr key={s.nombre}>
                <td>{s.nombre}</td>
                <td>{s.uso}</td>
                <td>{s.donde}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Los proveedores fuera de la UE tratan datos con las garantías que exige el RGPD
        (cláusulas contractuales tipo). <strong>Nunca vendemos ni cedemos tus datos</strong> a
        terceros con fines publicitarios.
      </p>

      <h2>6. Cuánto tiempo los guardamos</h2>
      <ul>
        <li>Mientras tengas la cuenta abierta.</li>
        <li>Si la borras, eliminamos tus datos personales en un plazo máximo de 30 días.</li>
        <li>
          Las facturas de suscripción se conservan los años que exige Hacienda, aunque cierres la
          cuenta.
        </li>
        <li>
          Los datos de uso (qué pantallas se abren, qué se busca) se conservan{" "}
          <strong>dos años</strong>: es lo que hace falta para comparar una temporada con la
          anterior. Si borras la cuenta, dejan de estar asociados a ti y se quedan como un número
          suelto, sin nada que apunte a ninguna persona.
        </li>
      </ul>

      <h2>7. Tus derechos</h2>
      <p>Puedes pedirnos en cualquier momento:</p>
      <ul>
        <li><strong>Ver</strong> qué datos tenemos sobre ti.</li>
        <li><strong>Corregir</strong> lo que esté mal.</li>
        <li><strong>Borrar</strong> tu cuenta y tus datos.</li>
        <li><strong>Llevártelos</strong> a otro sitio en un archivo.</li>
        <li><strong>Oponerte</strong> a que te enviemos comunicaciones.</li>
      </ul>
      <p>
        Escribe a <a href={`mailto:${emailPrivacidad}`}>{emailPrivacidad}</a> y te respondemos en
        menos de un mes. Si crees que no lo hacemos bien, puedes reclamar ante la{" "}
        <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">
          Agencia Española de Protección de Datos
        </a>
        .
      </p>

      <h2>8. Si vienes de la app anterior</h2>
      <p>
        {nombreComercial} sustituye a la web gratuita de tardeos del mismo responsable. Si tu
        local o tu ficha de DJ ya estaba allí, la hemos trasladado para que la app no nazca vacía,
        y puedes reclamarla o pedir que la quitemos escribiéndonos. Para enviarte emails
        promocionales te pediremos permiso otra vez.
      </p>

      <h2>9. Menores</h2>
      <p>
        TardeosClub es para mayores de 18 años. Si detectamos una cuenta de un menor, la
        eliminamos.
      </p>

      <h2>10. Cambios</h2>
      <p>
        Si cambiamos algo importante te avisaremos por email o con un aviso visible en la web.
      </p>
    </PaginaLegal>
  );
}
