"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import AddressSearch, { type Direccion } from "@/components/AddressSearch";
import SelectorAdnLocal, { ADN_LOCAL_VACIO, type AdnLocal } from "@/components/SelectorAdnLocal";
import SelectorEstilos from "@/components/SelectorEstilos";
import {
  Check, ArrowLeft, ArrowRight, Loader2, Store, Megaphone, Disc3,
  MapPin, Phone, Mail, Instagram, Globe, FileText, Music, ListChecks,
} from "lucide-react";

export type TipoAlta = "local" | "promotor" | "dj";

/**
 * El alta de un local, un promotor o un DJ, por pasos.
 *
 * El formulario de antes pedía cuatro campos —nombre, teléfono y poco más— y
 * la ficha nacía vacía: sin música, sin ambiente, sin redes. Eso tiene un coste
 * que no se ve el primer día: una ficha sin ADN no aparece en las
 * recomendaciones, no encaja con ningún filtro y no se puede segmentar. Se
 * pedía poco para tardar poco, y salían fichas que no sirven.
 *
 * Por pasos y no en una pantalla larga: pedir veinte campos de golpe se
 * abandona a la mitad. Y con TODO opcional menos el nombre —y la dirección si
 * es un local—, porque quien está dando de alta a un tercero muchas veces no
 * tiene sus datos delante: mejor una ficha a medias que ninguna, y se completa
 * después desde su propio panel.
 *
 * LO QUE NO HACE, Y ES DELIBERADO: no crea cuentas ni contraseñas. El asistente
 * antiguo decía "al guardar, creamos la cuenta de login con este email", y eso
 * significa custodiar la credencial de otra persona. Aquí la ficha nace sin
 * dueño y se le manda un enlace de invitación para que se ponga la suya.
 */
export default function AsistenteAlta({
  tipo,
  onHecho,
  onCancelar,
}: {
  tipo: TipoAlta;
  onHecho: (nombre: string) => void;
  onCancelar: () => void;
}) {
  const esDj = tipo === "dj";
  const esLocal = tipo === "local";

  const PASOS = esDj
    ? ["Quién es", "Qué pincha", "Bio y redes", "Repasar"]
    : ["Datos básicos", "Descripción", "Música y ambiente", "Contacto y redes", "Repasar"];

  const [paso, setPaso] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // Comunes
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [instagram, setInstagram] = useState("");
  const [web, setWeb] = useState("");
  const [playlist, setPlaylist] = useState("");
  // Local / promotor
  const [dir, setDir] = useState<Direccion | null>(null);
  const [adn, setAdn] = useState<AdnLocal>(ADN_LOCAL_VACIO);
  // DJ
  const [estilos, setEstilos] = useState<string[]>([]);

  /** Lo mínimo para que la ficha sirva de algo. Todo lo demás es opcional. */
  const faltaAlgo = () => {
    if (!nombre.trim()) return "Pon el nombre.";
    if (esLocal && !dir) return "Busca la dirección del local.";
    return null;
  };

  const redes = () => {
    const r: Record<string, string> = {};
    if (instagram.trim()) r.instagram = instagram.trim();
    if (web.trim()) r.web = web.trim();
    return Object.keys(r).length ? r : null;
  };

  const crear = async () => {
    const falta = faltaAlgo();
    if (falta) { setError(falta); setPaso(0); return; }
    setGuardando(true); setError("");

    // `|| null` y no cadena vacía: "sin indicar" y "lo miró y lo dejó en
    // blanco" son cosas distintas, y en los filtros se nota.
    const comun = {
      nombre: nombre.trim(),
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      descripcion: descripcion.trim() || null,
      redes: redes(),
      playlist_url: playlist.trim() || null,
    };

    const { error: e } = esDj
      ? await supabase.from("djs").insert({
          profile_id: null,
          nombre_artistico: nombre.trim(),
          bio: descripcion.trim() || null,
          estilos,
          redes: redes(),
          contacto: email.trim() || telefono.trim() || null,
          playlist_url: playlist.trim() || null,
        })
      : await supabase.from("locales").insert({
          ...comun,
          owner_id: null,
          // Alta manual del admin: ya es la aprobación. La insignia de
          // verificado se da aparte, desde /admin/locales.
          estado: "activo",
          tipo,
          direccion: dir?.display ?? null,
          lat: dir?.lat ?? null,
          lng: dir?.lng ?? null,
          codigo_postal: dir?.cp ?? null,
          zona: dir?.zona ?? null,
          tipo_local: adn.tipoLocal || null,
          aforo: adn.aforo ? Number(adn.aforo) || null : null,
          espacios: adn.espacios.length ? adn.espacios : null,
          musica: adn.musica.length ? adn.musica : null,
          ambiente: adn.ambiente.length ? adn.ambiente : null,
          publico: adn.publico.length ? adn.publico : null,
          dress_code: adn.dressCode || null,
          horario_habitual: adn.horarioHabitual || null,
        });

    setGuardando(false);
    if (e) { setError(e.message); return; }
    onHecho(nombre.trim());
  };

  const Icono = esDj ? Disc3 : tipo === "promotor" ? Megaphone : Store;

  return (
    <div className="flex flex-col gap-4">
      {/* Los pasos, a la vista siempre: saber cuántos quedan es lo que hace que
          no se abandone a la mitad. Se puede volver atrás tocando el número,
          pero no saltar hacia delante. */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-black">
        {PASOS.map((p, i) => (
          <li key={p} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => i < paso && setPaso(i)}
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                i === paso ? "bg-magenta text-white" : i < paso ? "bg-oro text-tinta" : "bg-black/5 text-tinta/40"
              }`}
            >
              {i < paso ? <Check size={12} /> : i + 1}
            </button>
            <span className={i === paso ? "text-tinta" : "text-tinta/40"}>{p}</span>
            {i < PASOS.length - 1 && <span className="mx-1 text-tinta/20">·</span>}
          </li>
        ))}
      </ol>

      <div className="rounded-3xl bg-white p-5 shadow-tarjeta ring-1 ring-black/5">
        <p className="mb-4 flex items-center gap-2 font-display text-xl font-black">
          <Icono size={22} className="text-magenta" /> {PASOS[paso]}
        </p>

        {/* ---------- Paso 1: quién es ---------- */}
        {paso === 0 && (
          <div className="flex flex-col gap-3">
            <Campo icon={Icono} label={esDj ? "Nombre artístico" : "Nombre"} obligatorio
              valor={nombre} onChange={setNombre}
              placeholder={esDj ? "DJ Nando" : tipo === "promotor" ? "Tardeos del Maresme" : "Sala Blau"} />
            {esLocal && (
              <div>
                <p className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70">
                  <MapPin size={15} className="text-magenta" /> Dirección <span className="text-magenta">*</span>
                </p>
                <AddressSearch inicial={nombre} onSelect={setDir}
                  placeholder="Busca el local por su nombre o su calle…" />
                <p className="mt-1 text-xs font-semibold text-tinta/50">
                  {dir ? `Elegido: ${dir.display}` : "De aquí salen el punto del mapa y la zona de los filtros."}
                </p>
              </div>
            )}
            {tipo === "promotor" && (
              <p className="rounded-xl bg-magenta-50/60 p-3 text-xs font-semibold text-tinta/60">
                Un promotor no lleva dirección: el sitio se elige en cada tardeo.
              </p>
            )}
            <Campo icon={Mail} label="Email de contacto" valor={email} onChange={setEmail}
              type="email" placeholder="hola@ejemplo.com" />
            <Campo icon={Phone} label="Teléfono" valor={telefono} onChange={setTelefono}
              placeholder="+34 600 000 000" />
            <p className="rounded-xl bg-black/[0.03] p-3 text-xs font-semibold text-tinta/55">
              El email y el teléfono son para que <strong>tú</strong> puedas contactarle. No se crea
              ninguna cuenta: cuando la ficha esté lista podrás mandarle un enlace de invitación
              para que entre y se ponga su propia contraseña.
            </p>
          </div>
        )}

        {/* ---------- Paso 2: qué pincha (DJ) / descripción (local) ---------- */}
        {paso === 1 && (
          esDj ? (
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-black text-tinta/70">
                <Music size={15} className="text-magenta" /> Estilos que pincha
              </p>
              <SelectorEstilos valor={estilos} onChange={setEstilos} />
              <p className="mt-2 text-xs font-semibold text-tinta/50">
                Es lo que hace que salga en las búsquedas por música y en las recomendaciones.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <CampoLargo icon={FileText} label="Descripción" valor={descripcion} onChange={setDescripcion}
                placeholder="Qué se va a encontrar quien venga. Opcional." />
              <Campo icon={Music} label="Playlist (Spotify, SoundCloud…)" valor={playlist} onChange={setPlaylist}
                placeholder="https://open.spotify.com/…" />
            </div>
          )
        )}

        {/* ---------- Paso 3: ADN del local / bio del DJ ---------- */}
        {paso === 2 && (
          esDj ? (
            <div className="flex flex-col gap-3">
              <CampoLargo icon={FileText} label="Bio" valor={descripcion} onChange={setDescripcion}
                placeholder="Quién es, dónde ha pinchado. Opcional." />
              <Campo icon={Instagram} label="Instagram" valor={instagram} onChange={setInstagram} placeholder="@sunombre" />
              <Campo icon={Music} label="Playlist o sesiones" valor={playlist} onChange={setPlaylist}
                placeholder="https://soundcloud.com/…" />
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs font-semibold text-tinta/55">
                Esto es lo que hace que la ficha aparezca en los filtros y en las recomendaciones.
                Se puede dejar en blanco y completarlo luego, pero mientras esté vacía, la ficha
                no encaja con nada.
              </p>
              <SelectorAdnLocal adn={adn} onCambio={setAdn} />
            </>
          )
        )}

        {/* ---------- Paso 4: redes (local) / repasar (DJ) ---------- */}
        {paso === 3 && (
          esDj ? <Resumen {...{ tipo, nombre, email, telefono, dir, adn, estilos, descripcion, instagram, web }} />
            : (
              <div className="flex flex-col gap-3">
                <Campo icon={Instagram} label="Instagram" valor={instagram} onChange={setInstagram} placeholder="@sunombre" />
                <Campo icon={Globe} label="Web" valor={web} onChange={setWeb} placeholder="www.suweb.com" />
              </div>
            )
        )}

        {/* ---------- Paso 5: repasar (local) ---------- */}
        {paso === 4 && !esDj && (
          <Resumen {...{ tipo, nombre, email, telefono, dir, adn, estilos, descripcion, instagram, web }} />
        )}

        {error && <p className="mt-3 text-sm font-bold text-magenta">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => (paso === 0 ? onCancelar() : setPaso(paso - 1))}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-5 py-3.5 text-base font-extrabold text-tinta/60 ring-1 ring-magenta-100"
          >
            <ArrowLeft size={18} /> {paso === 0 ? "Cancelar" : "Atrás"}
          </button>
          {paso < PASOS.length - 1 ? (
            <button
              onClick={() => setPaso(paso + 1)}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-magenta py-3.5 text-lg font-extrabold text-white active:scale-[0.98]"
            >
              Siguiente <ArrowRight size={18} />
            </button>
          ) : (
            <button
              onClick={crear}
              disabled={guardando}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-marca py-3.5 text-lg font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
            >
              {guardando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Crear ficha
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * El repaso antes de crear.
 *
 * No es decoración: enseña lo que se queda EN BLANCO, que es lo que de verdad
 * hay que ver antes de darle. Una ficha sin música ni ambiente se crea igual,
 * pero conviene saber que se está creando así.
 */
function Resumen(p: {
  tipo: TipoAlta; nombre: string; email: string; telefono: string;
  dir: Direccion | null; adn: AdnLocal; estilos: string[];
  descripcion: string; instagram: string; web: string;
}) {
  const esDj = p.tipo === "dj";
  const filas: [string, string][] = esDj
    ? [
        ["Nombre", p.nombre || "—"],
        ["Estilos", p.estilos.length ? `${p.estilos.length} elegidos` : "sin elegir"],
        ["Bio", p.descripcion ? "puesta" : "sin poner"],
        ["Contacto", p.email || p.telefono || "sin poner"],
        ["Instagram", p.instagram || "sin poner"],
      ]
    : [
        ["Nombre", p.nombre || "—"],
        ["Dirección", p.dir?.display ?? (p.tipo === "promotor" ? "no lleva" : "sin buscar")],
        ["Contacto", [p.email, p.telefono].filter(Boolean).join(" · ") || "sin poner"],
        ["Descripción", p.descripcion ? "puesta" : "sin poner"],
        ["Música", p.adn.musica.length ? p.adn.musica.join(", ") : "sin poner"],
        ["Ambiente", p.adn.ambiente.length ? p.adn.ambiente.join(", ") : "sin poner"],
        ["Público", p.adn.publico.length ? p.adn.publico.join(", ") : "sin poner"],
        ["Horario", p.adn.horarioHabitual || "sin poner"],
        ["Redes", [p.instagram, p.web].filter(Boolean).join(" · ") || "sin poner"],
      ];

  const vacios = filas.filter(([, v]) => v.startsWith("sin ")).length;

  return (
    <div>
      <ul className="flex flex-col gap-1.5">
        {filas.map(([k, v]) => (
          <li key={k} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="shrink-0 font-black text-tinta/50">{k}</span>
            <span className={`min-w-0 truncate text-right font-semibold ${
              v.startsWith("sin ") ? "text-tinta/35" : "text-tinta"}`}>{v}</span>
          </li>
        ))}
      </ul>
      {vacios > 0 && (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
          <ListChecks size={14} className="mt-0.5 shrink-0" />
          Quedan {vacios} campos sin rellenar. La ficha se crea igual, pero cuanto más vacía,
          menos aparece en filtros y recomendaciones. Se puede completar después.
        </p>
      )}
    </div>
  );
}

function Campo({
  icon: Icon, label, valor, onChange, placeholder, type = "text", obligatorio,
}: {
  icon: typeof Mail; label: string; valor: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; obligatorio?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70">
        <Icon size={15} className="text-magenta" /> {label}
        {obligatorio && <span className="text-magenta">*</span>}
      </span>
      <input
        type={type} value={valor} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none transition focus:border-magenta"
      />
    </label>
  );
}

function CampoLargo({
  icon: Icon, label, valor, onChange, placeholder,
}: {
  icon: typeof Mail; label: string; valor: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70">
        <Icon size={15} className="text-magenta" /> {label}
      </span>
      <textarea
        value={valor} placeholder={placeholder} rows={3}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none transition focus:border-magenta"
      />
    </label>
  );
}
