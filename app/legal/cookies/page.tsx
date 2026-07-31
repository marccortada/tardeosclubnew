import type { Metadata } from "next";
import PaginaLegal from "@/components/PaginaLegal";
import { RESPONSABLE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de cookies — TardeosClub",
  description: "TardeosClub no usa cookies de publicidad ni de seguimiento. Aquí te explicamos qué guardamos.",
};

export default function Cookies() {
  const { emailPrivacidad } = RESPONSABLE;

  return (
    <PaginaLegal
      titulo="Política de cookies"
      entradilla="Buenas noticias: no usamos cookies de publicidad ni de seguimiento. Por eso no te damos la lata con un banner."
    >
      <h2>1. Qué guardamos en tu dispositivo</h2>
      <p>
        TardeosClub <strong>no usa cookies publicitarias ni de seguimiento</strong>. Lo único que
        guardamos en tu navegador es lo imprescindible para que la web funcione:
      </p>
      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th>Qué</th>
              <th>Para qué</th>
              <th>Cuánto dura</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sesión de acceso (Supabase)</td>
              <td>Que no tengas que entrar cada vez que abres la web</td>
              <td>Hasta que cierras sesión</td>
            </tr>
            <tr>
              <td>Avisos ya vistos</td>
              <td>No repetirte el mismo aviso una y otra vez</td>
              <td>Hasta que borras los datos del navegador</td>
            </tr>
            <tr>
              <td>Visita contada</td>
              <td>Que una misma visita a una ficha no se cuente dos veces</td>
              <td>Hasta que cierras la pestaña</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Técnicamente esto no son cookies: se guarda con{" "}
        <em>localStorage</em> y <em>sessionStorage</em>, que se quedan en tu dispositivo y no
        viajan a ningún anunciante. Son datos <strong>estrictamente necesarios</strong>, así que la
        ley no exige pedirte consentimiento por ellos.
      </p>

      <h2>2. Analítica</h2>
      <p>
        Cuando midamos visitas usaremos una herramienta <strong>sin cookies</strong> y sin perfiles
        de usuario, para no tener que ponerte un banner de aceptación. Si algún día eso cambiara,
        te lo pediríamos antes y lo actualizaríamos aquí.
      </p>

      <h2>3. Webs de terceros</h2>
      <p>
        Cuando compras una entrada te llevamos a <strong>Fourvenues</strong>, y desde algunas
        fichas puedes ir a webs de locales, a redes sociales o a Nexo Radio. Esas páginas tienen
        sus propias cookies y sus propias políticas, que no controlamos.
      </p>

      <h2>4. Cómo borrarlo</h2>
      <p>
        Cierra sesión desde tu perfil, o borra los datos del sitio desde los ajustes de tu
        navegador. Perderás la sesión iniciada, pero nada más.
      </p>

      <h2>5. Dudas</h2>
      <p>
        Escríbenos a <a href={`mailto:${emailPrivacidad}`}>{emailPrivacidad}</a>.
      </p>
    </PaginaLegal>
  );
}
