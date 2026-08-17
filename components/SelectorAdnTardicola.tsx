"use client";

import { useState } from "react";
import { AMBIENTES, TIPOS_EVENTO, PUBLICOS, DRESS_CODES, mismoValor } from "@/lib/adn";
import { FAMILIAS, idEstilo } from "@/lib/musica";
import { ZONAS } from "@/lib/zonas";
import type { AdnTardicola } from "@/lib/tardicola";
import { Music, Sparkles, PartyPopper, Users, Shirt, MapPin, Ticket, ChevronDown } from "lucide-react";

/** Los mismos tramos que el filtro del listado, en forma de tope. */
const TOPES = [
  { k: "gratis", label: "Solo gratis" },
  { k: "hasta10", label: "Hasta 10 €" },
  { k: "de10a20", label: "Hasta 20 €" },
  { k: "mas20", label: "Me da igual" },
];

function Chip({ activo, children, onClick }: { activo: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-extrabold transition ${
        activo ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100 hover:ring-magenta"
      }`}
    >
      {children}
    </button>
  );
}

function Bloque({
  icono: Icono, titulo, pie, children,
}: {
  icono: typeof Music; titulo: string; pie?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-black text-tinta/70">
        <Icono size={15} className="text-magenta" /> {titulo}
      </p>
      {pie && <p className="-mt-1 mb-2 text-xs font-semibold text-tinta/45">{pie}</p>}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * Lo que le gusta a un tardícola, con los mismos criterios con los que se
 * describe un tardeo. Es lo que permite cruzarlos y recomendar.
 *
 * Todo es opcional a propósito. Esto sale justo después de registrarse, y un
 * formulario obligatorio de siete apartados en ese momento es la forma más
 * rápida de que alguien se vaya. Con un solo criterio ya se puede recomendar
 * algo mejor que nada.
 *
 * Ojo con la edad: es el único campo que no es un gusto sino un dato suyo, y por
 * eso admite una sola respuesta. Los demás van en plural porque a nadie le gusta
 * una única cosa.
 */
export default function SelectorAdnTardicola({
  adn,
  onCambio,
}: {
  adn: AdnTardicola;
  onCambio: (a: AdnTardicola) => void;
}) {
  // La música son 86 estilos: se abre por familias para no soltar un muro.
  const [familiaAbierta, setFamiliaAbierta] = useState<string | null>(null);

  const alternar = (campo: "musica" | "ambiente" | "tiposEvento" | "dressCodes" | "zonas", v: string) => {
    const lista = adn[campo];
    onCambio({
      ...adn,
      [campo]: lista.some((x) => mismoValor(x, v)) ? lista.filter((x) => !mismoValor(x, v)) : [...lista, v],
    });
  };
  const puesto = (campo: "musica" | "ambiente" | "tiposEvento" | "dressCodes" | "zonas", v: string) =>
    adn[campo].some((x) => mismoValor(x, v));

  return (
    <div className="flex flex-col gap-5">
      <Bloque icono={Music} titulo="Qué música te gusta" pie="Toca una familia para ver sus estilos. Puedes elegir la familia entera.">
        {FAMILIAS.map((fam) => (
          <div key={fam.id} className="w-full">
            <div className="flex items-center gap-2">
              <Chip activo={puesto("musica", fam.id)} onClick={() => alternar("musica", fam.id)}>
                {fam.nombre}
              </Chip>
              <button
                type="button"
                onClick={() => setFamiliaAbierta((a) => (a === fam.id ? null : fam.id))}
                aria-label={`Ver estilos de ${fam.nombre}`}
                className="grid h-9 w-9 place-items-center rounded-full text-tinta/40 transition hover:bg-black/5"
              >
                <ChevronDown size={17} className={familiaAbierta === fam.id ? "rotate-180" : ""} />
              </button>
              {/* Cuántos estilos suyos ha marcado, para no perderlo de vista al cerrar. */}
              {(() => {
                const n = fam.grupos.flatMap((g) => g.estilos).filter((e) => puesto("musica", idEstilo(fam.id, e))).length;
                return n ? <span className="text-xs font-black text-magenta">{n}</span> : null;
              })()}
            </div>

            {familiaAbierta === fam.id && (
              <div className="mt-2 rounded-2xl bg-magenta-50/60 p-3">
                {fam.grupos.map((g, i) => (
                  <div key={g.nombre ?? i} className={i ? "mt-3" : ""}>
                    {g.nombre && (
                      <p className="mb-1.5 text-xs font-black uppercase tracking-wide text-tinta/45">{g.nombre}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {g.estilos.map((e) => {
                        const id = idEstilo(fam.id, e);
                        return <Chip key={id} activo={puesto("musica", id)} onClick={() => alternar("musica", id)}>{e}</Chip>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </Bloque>

      <Bloque icono={Sparkles} titulo="Qué ambiente buscas">
        {AMBIENTES.map((v) => (
          <Chip key={v} activo={puesto("ambiente", v)} onClick={() => alternar("ambiente", v)}>{v}</Chip>
        ))}
      </Bloque>

      <Bloque icono={PartyPopper} titulo="Qué planes te van">
        {TIPOS_EVENTO.map((v) => (
          <Chip key={v} activo={puesto("tiposEvento", v)} onClick={() => alternar("tiposEvento", v)}>{v}</Chip>
        ))}
      </Bloque>

      <Bloque icono={MapPin} titulo="Por dónde te mueves">
        {ZONAS.map((z) => (
          <Chip key={z} activo={puesto("zonas", z)} onClick={() => alternar("zonas", z)}>{z}</Chip>
        ))}
      </Bloque>

      {/* Único campo de una sola respuesta: es su edad, no una preferencia. */}
      <Bloque icono={Users} titulo="Tu edad" pie="Sirve para no proponerte fiestas que no van contigo.">
        {PUBLICOS.map((v) => (
          <Chip
            key={v}
            activo={mismoValor(adn.publico, v)}
            onClick={() => onCambio({ ...adn, publico: mismoValor(adn.publico, v) ? "" : v })}
          >
            {v}
          </Chip>
        ))}
      </Bloque>

      <Bloque icono={Shirt} titulo="Cómo te gusta ir">
        {DRESS_CODES.map((v) => (
          <Chip key={v} activo={puesto("dressCodes", v)} onClick={() => alternar("dressCodes", v)}>{v}</Chip>
        ))}
      </Bloque>

      <Bloque icono={Ticket} titulo="Cuánto te quieres gastar">
        {TOPES.map((t) => (
          <Chip
            key={t.k}
            activo={adn.precioMax === t.k}
            onClick={() => onCambio({ ...adn, precioMax: adn.precioMax === t.k ? "" : t.k })}
          >
            {t.label}
          </Chip>
        ))}
      </Bloque>
    </div>
  );
}
