import Link from "next/link";
import { AlertTriangle, Check, Circle, Pencil } from "lucide-react";
import { etiquetaPublicacion } from "@/lib/estados";

/**
 * Por qué esta ficha no se ve en la web, y qué falta para que se vea.
 *
 * Antes el panel solo ponía «Pendiente» en una etiqueta gris arriba a la
 * derecha. Nadie sabía pendiente de qué, ni si dependía de ellos o de nosotros,
 * ni cuánto tardaría. Un local que crea tardeos y no los ve publicados en
 * ningún sitio no vuelve.
 *
 * Se dicen las tres cosas por separado, porque son distintas:
 *   1. QUÉ PASA        — la ficha no se ve.
 *   2. DE QUIÉN DEPENDE— de que la revisemos nosotros, no de ellos.
 *   3. QUÉ PUEDEN HACER— completar los datos, que acelera la revisión.
 *
 * La lista de abajo NO es una lista de requisitos: publicar lo aprueba una
 * persona, no un contador de campos rellenos. Prometer que con cinco casillas
 * se publica sola sería mentir. Es lo que hace que la revisión sea rápida.
 */
export default function FichaPendiente({
  estado, local, hrefEditar = "/local/editar",
}: {
  estado: string | null | undefined;
  /** A dónde lleva "Completar la ficha" (con ?id= si hay varias fichas). */
  hrefEditar?: string;
  local: { nombre?: string; direccion?: string | null; descripcion?: string | null;
           logo_url?: string | null; telefono?: string | null; musica?: unknown[] | null;
           tipo?: string | null };
}) {
  // Publicada: no hay nada que explicar.
  if (estado === "activo") return null;

  const esPromotor = local.tipo === "promotor";
  const impago = estado === "oculto_impago";
  // Retirada por otro motivo: ni es un impago ni es "pendiente de revisar".
  const retirada = estado === "oculto";

  const puntos = [
    { ok: Boolean(local.nombre?.trim()), texto: "Nombre" },
    // Un promotor no tiene dirección fija: la pone en cada tardeo, así que
    // pedírsela aquí sería pedirle algo que no tiene.
    ...(esPromotor ? [] : [{ ok: Boolean(local.direccion?.trim()), texto: "Dirección" }]),
    { ok: Boolean(local.logo_url), texto: "Logo (es tu chincheta en el mapa)" },
    { ok: Boolean(local.descripcion?.trim()), texto: "Descripción" },
    { ok: Boolean(local.telefono?.trim()), texto: "Teléfono o WhatsApp" },
    { ok: Array.isArray(local.musica) && local.musica.length > 0, texto: "Qué música ponéis" },
  ];
  const faltan = puntos.filter((p) => !p.ok).length;

  return (
    <section className="rounded-2xl border border-aviso/25 bg-aviso-fondo p-5">
      <p className="flex items-center gap-2 text-lg font-bold">
        <AlertTriangle size={20} className="shrink-0 text-aviso" aria-hidden />
        Tu ficha todavía no se ve en la web
      </p>

      <p className="mt-1.5 text-[15px] text-tinta">
        {impago ? (
          <>
            Está <b>{etiquetaPublicacion(estado).toLowerCase()}</b> porque hay un recibo sin
            pagar. En cuanto se regularice vuelve a salir con todos sus tardeos, tal y como
            estaba.
          </>
        ) : retirada ? (
          <>
            La hemos <b>retirado de la web</b>. No es por ningún pago. Escríbenos y te
            contamos por qué: tus tardeos siguen guardados.
          </>
        ) : (
          <>
            Está <b>{etiquetaPublicacion(estado).toLowerCase()}</b>: la hemos recibido y la
            tenemos que revisar antes de sacarla. <b>No depende de ti</b>, y tus tardeos se
            guardan mientras tanto — se publicarán con la ficha.
          </>
        )}
      </p>

      {!impago && !retirada && (
        <>
          <p className="mt-4 text-[15px] font-semibold">
            {faltan === 0
              ? "Lo tienes todo puesto. Solo falta que la revisemos."
              : `Completar esto hace la revisión más rápida (${faltan} por poner):`}
          </p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {puntos.map((p) => (
              <li key={p.texto} className="flex items-center gap-2 text-[15px] text-tinta-suave">
                {p.ok
                  ? <Check size={16} className="shrink-0 text-ok" aria-label="Hecho" />
                  : <Circle size={16} className="shrink-0 text-aviso" aria-label="Falta" />}
                {p.texto}
              </li>
            ))}
          </ul>

          {faltan > 0 && (
            <Link
              href={hrefEditar}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-noche px-4 text-[15px] font-bold text-white hover:bg-noche/90"
            >
              <Pencil size={16} aria-hidden /> Completar la ficha
            </Link>
          )}
        </>
      )}
    </section>
  );
}
