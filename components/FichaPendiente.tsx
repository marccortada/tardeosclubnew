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
  estado, local,
}: {
  estado: string | null | undefined;
  local: { nombre?: string; direccion?: string | null; descripcion?: string | null;
           logo_url?: string | null; telefono?: string | null; musica?: unknown[] | null;
           tipo?: string | null };
}) {
  // Publicada: no hay nada que explicar.
  if (estado === "activo") return null;

  const esPromotor = local.tipo === "promotor";
  const impago = estado === "oculto_impago";

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
    <section className="mt-5 rounded-2xl bg-oro/10 p-5 ring-1 ring-oro/40">
      <p className="flex items-center gap-2 font-display text-lg font-black">
        <AlertTriangle size={19} className="shrink-0 text-oro-600" />
        Tu ficha todavía no se ve en la web
      </p>

      <p className="mt-1 text-sm font-semibold text-tinta/75">
        {impago ? (
          <>
            Está <b>{etiquetaPublicacion(estado).toLowerCase()}</b> porque hay un recibo sin
            pagar. En cuanto se regularice vuelve a salir con todos sus tardeos, tal y como
            estaba.
          </>
        ) : (
          <>
            Está <b>{etiquetaPublicacion(estado).toLowerCase()}</b>: la hemos recibido y la
            tenemos que revisar antes de sacarla. <b>No depende de ti</b>, y tus tardeos se
            guardan mientras tanto — se publicarán con la ficha.
          </>
        )}
      </p>

      {!impago && (
        <>
          <p className="mt-4 text-sm font-black text-tinta/70">
            {faltan === 0
              ? "Lo tienes todo puesto. Solo falta que la revisemos."
              : `Completar esto hace la revisión más rápida (${faltan} por poner):`}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {puntos.map((p) => (
              <li key={p.texto} className={`flex items-center gap-2 text-sm font-semibold ${p.ok ? "text-tinta/45" : "text-tinta/80"}`}>
                {p.ok
                  ? <Check size={15} className="shrink-0 text-green-600" />
                  : <Circle size={15} className="shrink-0 text-oro-600" />}
                {p.texto}
              </li>
            ))}
          </ul>

          {faltan > 0 && (
            <Link
              href="/local/editar"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-tinta px-4 py-2.5 text-sm font-black text-white active:scale-[0.98]"
            >
              <Pencil size={15} /> Completar la ficha
            </Link>
          )}
        </>
      )}
    </section>
  );
}
