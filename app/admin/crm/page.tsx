"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PanelHeader from "@/components/PanelHeader";
import { plegar, contieneTexto } from "@/lib/texto";
import { ETIQUETA } from "@/lib/planes";
import {
  cargarCrm, guardarSeguimiento, leToca, ESTADOS,
  type FichaCrm, type EstadoCrm, type Seguimiento,
} from "@/lib/crm";
import {
  Store, Loader2, Instagram, Globe, Mail, Phone, Ticket, BadgeCheck,
  CalendarClock, Facebook, AlertTriangle, Check,
} from "lucide-react";

/**
 * El CRM comercial: los 68 locales y a quién le toca hoy.
 *
 * ORDEN POR DEFECTO: primero los que tienen seguimiento vencido, después los
 * que no se han tocado nunca, y al final el resto. No es un capricho de
 * ordenación, es la pantalla entera: un CRM ordenado alfabéticamente obliga a
 * leerse los 68 para saber qué hacer, y por eso nadie los usa.
 *
 * Se guarda al momento, sin botón. Con 68 fichas y llamadas de dos minutos,
 * un "Guardar" por tarjeta es una cosa más que se olvida a media llamada.
 */
export default function AdminCrm() {
  const [fichas, setFichas] = useState<FichaCrm[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"toca" | "sin" | "interesados" | "clientes" | "todos">("toca");
  const [guardado, setGuardado] = useState<string | null>(null);

  const hoy = new Date().toISOString().slice(0, 10);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { fichas, error } = await cargarCrm();
    setFichas(fichas);
    setAviso(error);
    setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  /** Optimista: se pinta y luego se guarda. Si falla, se dice y se recarga. */
  const cambiar = async (f: FichaCrm, cambios: Partial<Seguimiento>) => {
    setFichas((p) => p.map((x) => (x.id === f.id ? { ...x, seg: { ...x.seg, ...cambios } } : x)));
    const err = await guardarSeguimiento(f.id, { ...f.seg, ...cambios });
    if (err) { setAviso(err); cargar(); return; }
    setGuardado(f.id);
    setTimeout(() => setGuardado((g) => (g === f.id ? null : g)), 1200);
  };

  const cuentas = useMemo(() => ({
    toca: fichas.filter((f) => leToca(f, hoy)).length,
    sin: fichas.filter((f) => f.seg.estado === "no_contactado").length,
    interesados: fichas.filter((f) => f.seg.estado === "interesado").length,
    clientes: fichas.filter((f) => f.planEstado === "activa").length,
  }), [fichas, hoy]);

  const lista = useMemo(() => {
    const q = plegar(busca);
    const filtrada = fichas.filter((f) => {
      if (q && !contieneTexto(f.nombre, q) && !contieneTexto(f.zona ?? "", q)) return false;
      if (filtro === "toca") return leToca(f, hoy);
      if (filtro === "sin") return f.seg.estado === "no_contactado";
      if (filtro === "interesados") return f.seg.estado === "interesado";
      if (filtro === "clientes") return f.planEstado === "activa";
      return true;
    });
    // Vencidos primero (el más atrasado arriba), después los nunca tocados, y
    // dentro de cada grupo el que más tardeos tiene: es el que más te interesa.
    const rango = (f: FichaCrm) => (leToca(f, hoy) ? 0 : f.seg.estado === "no_contactado" ? 1 : 2);
    return [...filtrada].sort((a, b) =>
      rango(a) - rango(b)
      || (a.seg.proximo_seguimiento ?? "9999").localeCompare(b.seg.proximo_seguimiento ?? "9999")
      || b.tardeos - a.tardeos);
  }, [fichas, busca, filtro, hoy]);

  return (
    <main className="pb-16">
      <PanelHeader titulo="CRM comercial" volverHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8">

        {aviso && (
          <p className="mb-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {aviso}
          </p>
        )}

        <input
          value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar local o zona…"
          className="mb-3 w-full rounded-2xl bg-white px-4 py-3 font-semibold shadow-tarjeta ring-1 ring-black/5 outline-none focus:ring-2 focus:ring-magenta"
        />

        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
          {([
            ["toca", `Le toca (${cuentas.toca})`],
            ["sin", `Sin contactar (${cuentas.sin})`],
            ["interesados", `Interesados (${cuentas.interesados})`],
            ["clientes", `Clientes (${cuentas.clientes})`],
            ["todos", `Todos (${fichas.length})`],
          ] as const).map(([k, label]) => (
            <button
              key={k} onClick={() => setFiltro(k)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${
                filtro === k ? "bg-marca text-white" : "bg-white text-tinta/60 ring-1 ring-black/5"}`}
            >{label}</button>
          ))}
        </div>

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-tinta/50">
            <Loader2 className="animate-spin" /> Cargando…
          </div>
        ) : lista.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">
            {filtro === "toca"
              ? "Hoy no le toca a nadie. Pon una fecha de seguimiento a los que hayas contactado."
              : "Ninguno con ese filtro."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {lista.map((f) => (
              <Tarjeta
                key={f.id} f={f} hoy={hoy} guardado={guardado === f.id}
                onCambio={(c) => cambiar(f, c)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * El color de cada estado, y no el de la marca para los cuatro.
 *
 * Con el magenta en todos, un "no le interesa" y un "interesado" se ven iguales
 * de reojo, que es como se lee una lista de 68. El color tiene que decir lo
 * mismo que la palabra: verde el que compra, gris el que no, y el "sin
 * contactar" apagado, porque es el estado de 64 de ellos y no significa que
 * hayas hecho nada.
 *
 * VIVE AQUÍ Y NO EN lib/crm.ts, aunque su sitio natural sería junto a ESTADOS:
 * Tailwind solo mira `app/` y `components/` (tailwind.config.ts), así que una
 * clase escrita en `lib/` se purga del CSS y llega al navegador sin existir.
 * No avisa nadie: compila, pasa los tipos, y el botón sale transparente.
 */
const COLOR: Record<EstadoCrm, string> = {
  no_contactado: "bg-tinta/70 text-white",
  contactado: "bg-marca text-white",
  interesado: "bg-green-700 text-white",
  // Relleno gris con la tinta a plena opacidad. Apagado sí, ilegible no: con
  // el texto blanco daba 1,7:1 y con la tinta al 60 % se quedaba en 4,0, por
  // debajo del 4,5:1 que pide un texto de 12 px en negrita.
  no_interesado: "bg-tinta/20 text-tinta",
};

function Tarjeta({
  f, hoy, guardado, onCambio,
}: {
  f: FichaCrm; hoy: string; guardado: boolean;
  onCambio: (c: Partial<Seguimiento>) => void;
}) {
  const vencido = leToca(f, hoy);
  const canales = [
    f.instagram && { icono: Instagram, url: f.instagram, label: "Instagram" },
    f.web && { icono: Globe, url: f.web, label: "Web" },
    f.facebook && { icono: Facebook, url: f.facebook, label: "Facebook" },
    f.email && { icono: Mail, url: `mailto:${f.email}`, label: f.email },
    f.telefono && { icono: Phone, url: `tel:${f.telefono}`, label: f.telefono },
    f.entradas && { icono: Ticket, url: f.entradas, label: f.ticketera ?? "Entradas" },
  ].filter(Boolean) as { icono: typeof Globe; url: string; label: string }[];

  return (
    <div className={`rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ${vencido ? "ring-magenta/40" : "ring-black/5"}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta">
          <Store size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-black leading-tight">
            <span className="truncate">{f.nombre}</span>
            {guardado && <Check size={15} className="shrink-0 text-green-600" />}
          </p>
          <p className="text-sm font-semibold text-tinta/60">
            {f.zona || "Sin zona"} · {f.tardeos} tardeos
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {f.reclamado && (
              <span className="inline-flex items-center gap-1 rounded-full bg-oro/15 px-2 py-0.5 text-xs font-black text-oro-600">
                <BadgeCheck size={12} /> Reclamado
              </span>
            )}
            {f.planEstado === "activa" && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-black text-green-800">
                Cliente · {ETIQUETA[f.plan]}
              </span>
            )}
            {f.planEstado === "impago" && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-black text-red-800">Impago</span>
            )}
            {f.ticketera && (
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-black text-tinta/60">
                Vende en {f.ticketera}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Por dónde escribirle. Si no hay nada, se dice: es información. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {canales.length === 0 ? (
          <span className="text-sm font-bold text-tinta/40">Sin forma de contacto</span>
        ) : canales.map((c) => (
          <a
            key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" title={c.label}
            className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1.5 text-xs font-black text-tinta/70 transition hover:bg-magenta hover:text-white"
          >
            <c.icono size={14} /> <span className="max-w-[11rem] truncate">{c.label}</span>
          </a>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ESTADOS.map((e) => (
          <button
            key={e.k} onClick={() => onCambio({ estado: e.k as EstadoCrm })}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
              f.seg.estado === e.k ? COLOR[e.k] : "bg-black/5 text-tinta/50 hover:bg-black/10"}`}
          >{e.label}</button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black ring-1 ${
          vencido ? "bg-magenta-50 text-magenta ring-magenta/30" : "bg-black/5 text-tinta/60 ring-transparent"}`}>
          <CalendarClock size={14} />
          Volver el
          <input
            type="date" value={f.seg.proximo_seguimiento ?? ""}
            onChange={(ev) => onCambio({ proximo_seguimiento: ev.target.value || null })}
            className="bg-transparent font-black outline-none"
          />
        </label>
        {f.seg.ultimo_contacto && (
          <span className="text-xs font-bold text-tinta/40">
            Último contacto: {new Date(f.seg.ultimo_contacto).toLocaleDateString("es-ES")}
          </span>
        )}
      </div>

      {/*
        Sin estado propio: `defaultValue` con `key`. Las notas no se guardan en
        cada tecla —serían cincuenta escrituras por nota— sino al salir del
        campo, así que aquí no hace falta seguir lo que se teclea. La `key` es
        lo que hace que el campo se rellene solo cuando el valor cambia por
        fuera, por ejemplo al recargar después de un error.
      */}
      <textarea
        key={f.seg.notas ?? ""}
        defaultValue={f.seg.notas ?? ""}
        onBlur={(ev) => {
          const v = ev.currentTarget.value;
          if (v !== (f.seg.notas ?? "")) onCambio({ notas: v || null });
        }}
        placeholder="Notas: con quién hablaste, qué dijo, qué le preocupa…"
        rows={2}
        className="mt-3 w-full resize-y rounded-xl bg-black/[0.03] px-3 py-2 text-sm font-semibold outline-none ring-1 ring-black/5 focus:ring-2 focus:ring-magenta"
      />
    </div>
  );
}
