/**
 * Inyecta un bloque JSON-LD para Google.
 *
 * Va con `dangerouslySetInnerHTML` porque React escaparía las comillas del
 * JSON y el buscador no podría leerlo. El contenido lo generamos nosotros en
 * lib/seo.ts, nunca viene del usuario; aun así se neutraliza `<` por si algún
 * nombre de local trae un "</script>" dentro.
 */
export default function DatosEstructurados({ datos }: { datos: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(datos).replace(/</g, "\\u003c"),
      }}
    />
  );
}
