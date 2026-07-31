import type { Metadata } from "next";
import PaginaLegal from "@/components/PaginaLegal";
import { RESPONSABLE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Aviso legal — TardeosClub",
  description: "Quién está detrás de TardeosClub y condiciones de uso de la web.",
};

export default function AvisoLegal() {
  const { nombreComercial, razonSocial, nif, domicilio, emailContacto } = RESPONSABLE;

  return (
    <PaginaLegal
      titulo="Aviso legal"
      entradilla="Quién está detrás de TardeosClub y bajo qué condiciones puedes usar la web."
    >
      <h2>1. Quiénes somos</h2>
      <p>
        Esta web es <strong>{nombreComercial}</strong>, un servicio que reúne los
        &laquo;tardeos&raquo; (fiestas de tarde) de locales y DJs para que puedas encontrarlos
        fácilmente.
      </p>
      <ul>
        <li><strong>Nombre comercial:</strong> {nombreComercial}</li>
        <li>
          <strong>Titular:</strong>{" "}
          {razonSocial || <em>pendiente de constituir la entidad legal</em>}
        </li>
        <li><strong>NIF/CIF:</strong> {nif || <em>pendiente</em>}</li>
        <li><strong>Domicilio:</strong> {domicilio || <em>pendiente</em>}</li>
        <li><strong>Contacto:</strong> <a href={`mailto:${emailContacto}`}>{emailContacto}</a></li>
      </ul>
      {!razonSocial && (
        <p>
          <strong>Aviso:</strong> la entidad titular está en proceso de constitución. Estos datos
          se completarán antes del lanzamiento comercial. Mientras tanto, para cualquier asunto
          puedes escribirnos al correo de contacto y te responderemos.
        </p>
      )}

      <h2>2. Qué hacemos y qué no</h2>
      <p>
        {nombreComercial} es un <strong>escaparate</strong>: publicamos los tardeos que crean los
        locales y los DJs. No organizamos las fiestas ni somos responsables de lo que ocurra en
        ellas.
      </p>
      <ul>
        <li>
          <strong>Quien organiza es el local.</strong> El horario, el precio, el aforo, la música y
          las condiciones de entrada los pone el local, no nosotros.
        </li>
        <li>
          <strong>Las entradas se compran fuera.</strong> Cuando un tardeo es de pago o va por
          lista, te llevamos a <strong>Fourvenues</strong>, que es quien gestiona la venta. Ahí se
          aplican sus condiciones y su política de privacidad.
        </li>
        <li>
          <strong>Comprobamos, pero no garantizamos.</strong> Verificamos los locales y moderamos
          las reseñas, aunque la información de cada tardeo la introduce el local y puede cambiar
          o contener errores.
        </li>
      </ul>

      <h2>3. Uso de la web</h2>
      <p>Al usar TardeosClub te comprometes a:</p>
      <ul>
        <li>Dar datos verdaderos cuando te registres o publiques un tardeo.</li>
        <li>Ser mayor de edad. Los tardeos son eventos para adultos.</li>
        <li>No publicar contenido ofensivo, falso, ilegal o que no sea tuyo.</li>
        <li>No usar medios automáticos para extraer datos de la web ni intentar tumbarla.</li>
      </ul>
      <p>
        Si detectamos un uso indebido podemos retirar el contenido o cerrar la cuenta, avisándote
        del motivo.
      </p>

      <h2>4. Contenido de locales y DJs</h2>
      <p>
        Cuando un local o un DJ sube textos, fotos o flyers sigue siendo su propietario, pero nos
        autoriza a mostrarlos en TardeosClub y en nuestras redes para promocionar su tardeo. Si
        alguien sube algo sobre lo que no tiene derechos, debe retirarlo, y puede pedírnoslo
        escribiendo al correo de contacto.
      </p>

      <h2>5. Propiedad intelectual</h2>
      <p>
        La marca TardeosClub, el logotipo, el sello y el diseño de la web son nuestros. El resto
        de contenidos pertenece a quien los publica.
      </p>

      <h2>6. Enlaces a otras webs</h2>
      <p>
        Enlazamos a Fourvenues, a webs de locales, a redes sociales y a colaboradores como Nexo
        Radio. No controlamos esas páginas ni respondemos por ellas.
      </p>

      <h2>7. Disponibilidad</h2>
      <p>
        Intentamos que la web funcione siempre, pero puede haber cortes por mantenimiento o por
        fallos ajenos. No podemos garantizar que esté disponible el 100% del tiempo.
      </p>

      <h2>8. Ley aplicable</h2>
      <p>
        Se aplica la legislación española. Si eres consumidor, puedes reclamar ante los juzgados
        de tu domicilio.
      </p>
    </PaginaLegal>
  );
}
