"use client";

/* eslint-disable @next/next/no-img-element */
import { CalendarDays, MapPin, Disc3, Repeat } from "lucide-react";
import Hoja from "@/components/ui/Hoja";
import Boton from "@/components/Boton";
import type { Precio } from "@/components/PrecioTardeo";
import { fechaCorta } from "@/lib/periodicidad";

export type DatosVista = {
  titulo: string; descripcion: string; fecha: string; horaInicio: string; horaFin: string;
  lugar: string; zona: string; djs: string[]; precio: Precio; flyer: string | null; fechas: string[];
};

const fechaLarga = (f: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f);
  if (!m) return "Sin fecha";
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
};

/**
 * «Ver vista previa» (dossier pág. 11 y vídeo): la ficha tal como la verá la
 * gente, con los datos SIN guardar. Mismo orden que la ficha pública: portada,
 * nombre, fecha y horas, lugar con «Cómo llegar», precio en píldora, texto,
 * «Entrada y condiciones» y Line‑up. No se reutiliza la página de la ficha
 * porque esa lee de la base y aquí el tardeo aún no existe.
 */
export default function VistaPrevia({ abierta, onCerrar, d, onPublicar, textoPublicar }: {
  abierta: boolean; onCerrar: () => void; d: DatosVista; onPublicar?: () => void; textoPublicar?: string;
}) {
  const p = d.precio;
  const precio = p.modo === "gratis" ? "GRATIS" : p.modo === "lista" ? "Lista" : p.importe ? `${p.importe} €` : "De pago";
  const condiciones = p.modo === "gratis"
    ? "Entrada libre."
    : p.modo === "lista" ? "Apúntate a la lista y preséntala al llegar."
    : "Anticipada · Presenta tu entrada al acceder al evento.";
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Vista previa"
      pie={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="contorno" onClick={onCerrar}>Seguir editando</Boton>
          {onPublicar && <Boton onClick={onPublicar}>{textoPublicar ?? "Publicar"}</Boton>}
        </div>
      }>
      <p className="mb-3 rounded-xl bg-marfil-100 px-3 py-2 text-sm text-tinta-suave">Así se verá tu ficha. Aún no está guardada.</p>
      <article className="overflow-hidden rounded-2xl border border-linea bg-white">
        {d.flyer
          ? <img src={d.flyer} alt="" className="max-h-[320px] w-full object-cover" />
          : <div className="grid h-40 place-items-center bg-magenta-50 text-[15px] font-semibold text-magenta-700">Sin flyer (se usará la imagen por defecto)</div>}
        <div className="flex flex-col gap-3 p-4">
          <h3 className="text-2xl font-bold leading-tight">{d.titulo || "Sin título"}</h3>
          <p className="flex items-center gap-2 text-[15px]">
            <CalendarDays size={18} className="text-magenta" aria-hidden />
            <span className="first-letter:uppercase">{fechaLarga(d.fecha)}</span>
            {d.horaInicio && <span>· {d.horaInicio}{d.horaFin ? `–${d.horaFin}` : ""}</span>}
          </p>
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-start gap-2 text-[15px] text-tinta-suave">
              <MapPin size={18} className="mt-0.5 shrink-0 text-magenta" aria-hidden /> {d.lugar || "Sin dirección"}{d.zona ? ` · ${d.zona}` : ""}
            </p>
            <span className="shrink-0 rounded-full border border-linea px-3 py-1 text-sm">Cómo llegar</span>
          </div>
          <p><span className="inline-block rounded-full bg-oro px-3 py-1 text-[15px] font-bold text-tinta">{precio}</span></p>
          {d.descripcion && <p className="whitespace-pre-line text-[15px]">{d.descripcion}</p>}
          <div className="rounded-xl border border-linea p-3">
            <p className="font-bold">Entrada y condiciones</p>
            <p className="text-[15px] text-tinta-suave">{condiciones}</p>
          </div>
          {d.djs.length > 0 && (
            <div>
              <p className="mb-2 text-lg font-bold">Line-up</p>
              <ul className="flex flex-wrap gap-4">
                {d.djs.map((n) => (
                  <li key={n} className="flex w-20 flex-col items-center gap-1 text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-magenta-50 text-magenta"><Disc3 size={22} aria-hidden /></span>
                    <span className="text-sm font-semibold leading-tight">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.fechas.length > 1 && (
            <div className="rounded-xl bg-marfil-100 p-3 text-[15px]">
              <p className="flex items-center gap-2 font-bold"><Repeat size={16} aria-hidden /> Se repite: {d.fechas.length} fechas</p>
              <p className="text-tinta-suave">{d.fechas.map(fechaCorta).join(" · ")}</p>
            </div>
          )}
        </div>
      </article>
    </Hoja>
  );
}
