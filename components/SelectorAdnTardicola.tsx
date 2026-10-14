"use client";

import { useState } from "react";
import { TIPOS_EVENTO, PUBLICOS, DRESS_CODES, mismoValor } from "@/lib/adn";
import { FAMILIAS, idEstilo } from "@/lib/musica";
import type { AdnTardicola } from "@/lib/tardicola";
import { Music, PartyPopper, Users, Shirt, ChevronDown } from "lucide-react";

function Chip({ activo, children, onClick }: { activo: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`min-h-[44px] rounded-full border px-4 py-2 text-[15px] font-semibold transition ${
        activo ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-white text-tinta hover:border-tinta/50"
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
    <div className="rounded-2xl border border-linea bg-white p-4 md:p-5">
      <p className="mb-1 flex items-center gap-2 text-[17px] font-bold">
        <Icono size={19} className="text-magenta" aria-hidden /> {titulo}
      </p>
      {pie && <p className="mb-3 text-[15px] text-tinta-suave">{pie}</p>}
      {!pie && <div className="mb-2" />}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * Lo que le gusta a un tardícola, con los mismos criterios con los que se
 * describe un tardeo. Es lo que permite cruzarlos y recomendar.
 *
 * Cuatro apartados y nada más: música, tipo de plan, edad y outfit. Esto sale
 * justo después de registrarse, y cada apartado extra es gente que cierra la
 * pestaña. Ambiente, zonas y precio existen en la base pero NO se preguntan
 * aquí: el ambiente se solapa mucho con el tipo de plan, la zona se saca de la
 * ubicación cuando la concede, y el precio se ve enseguida por lo que abre.
 *
 * La música va colapsada por familias. Son 86 estilos: sueltos de golpe
 * convierten el alta en un muro, y el muro es justo lo que hace que nadie
 * rellene nada.
 *
 * Todo opcional. Con un solo criterio ya se recomienda mejor que sin nada.
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

  type Multi = "musica" | "tiposEvento" | "dressCodes";

  const alternar = (campo: Multi, v: string) => {
    const lista = adn[campo];
    onCambio({
      ...adn,
      [campo]: lista.some((x) => mismoValor(x, v)) ? lista.filter((x) => !mismoValor(x, v)) : [...lista, v],
    });
  };
  const puesto = (campo: Multi, v: string) =>
    adn[campo].some((x) => mismoValor(x, v));

  return (
    <div className="flex flex-col gap-4">
      <Bloque icono={Music} titulo="Qué música te gusta" pie="Toca un grupo para ver sus estilos.">
        {FAMILIAS.map((fam) => {
          const estilosFam = fam.grupos.flatMap((g) => g.estilos);
          const nElegidos = estilosFam.filter((e) => puesto("musica", idEstilo(fam.id, e))).length;
          const familiaEntera = puesto("musica", fam.id);
          const abierta = familiaAbierta === fam.id;
          return (
            <div key={fam.id} className="w-full">
              {/* Tocar SOLO abre. Antes este chip seleccionaba y abría a la vez,
                  y no había forma de mirar qué hay dentro sin marcarlo todo. */}
              <button
                type="button"
                onClick={() => setFamiliaAbierta((a) => (a === fam.id ? null : fam.id))}
                aria-expanded={abierta}
                className={`flex min-h-[48px] w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-left text-[15px] font-semibold transition ${
                  familiaEntera || nElegidos
                    ? "border-magenta bg-magenta-50 text-magenta-700"
                    : "border-linea-fuerte bg-white text-tinta hover:border-tinta/50"
                }`}
              >
                <span className="flex-1">{fam.nombre}</span>
                {/* Lo elegido se ve con el grupo cerrado: si no, hay que abrir
                    los seis para recordar qué marcaste. */}
                {familiaEntera && <span className="text-[13px] font-bold">todo</span>}
                {!familiaEntera && nElegidos > 0 && <span className="text-[13px] font-bold">{nElegidos}</span>}
                <ChevronDown size={17} className={`shrink-0 transition ${abierta ? "rotate-180" : ""}`} />
              </button>

              {abierta && (
                <div className="mt-2 rounded-xl bg-marfil-100 p-3">
                  {/* Atajo para quien no quiere elegir estilo a estilo. */}
                  <Chip activo={familiaEntera} onClick={() => alternar("musica", fam.id)}>
                    Todo {fam.nombre.toLowerCase()}
                  </Chip>

                  {fam.grupos.map((g, i) => (
                    <div key={g.nombre ?? i} className="mt-3">
                      {g.nombre && (
                        <p className="mb-1.5 text-[13px] font-bold uppercase tracking-wide text-tinta-suave">{g.nombre}</p>
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
          );
        })}
      </Bloque>

      <Bloque icono={PartyPopper} titulo="Qué planes te van">
        {TIPOS_EVENTO.map((v) => (
          <Chip key={v} activo={puesto("tiposEvento", v)} onClick={() => alternar("tiposEvento", v)}>{v}</Chip>
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
    </div>
  );
}
