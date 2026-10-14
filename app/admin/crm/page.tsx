"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { Buscador, Filtros, useDiferido } from "@/components/panel/Paginacion";
import Aviso from "@/components/admin/Aviso";
import { Etiqueta } from "@/components/ui/Chip";
import { claseBoton } from "@/components/Boton";
import { plegar, contieneTexto } from "@/lib/texto";
import { ETIQUETA } from "@/lib/planes";
import { hoyISO } from "@/lib/tardeos";
import {
  cargarCrm, guardarSeguimiento, leToca, leerAutores, crmACsv, ESTADOS, CANALES,
  type FichaCrm, type EstadoCrm, type Seguimiento, type Canal,
} from "@/lib/crm";
import {
  Store, Instagram, Globe, Mail, Phone, Ticket, BadgeCheck, CalendarClock, Facebook, Check, Download, Loader2,
} from "lucide-react";

type Filtro = "toca" | "sin" | "interesados" | "clientes" | "todos";
const POR_PAGINA = 25;

const NOMBRE_CANAL: Record<Canal, string> = {
  instagram: "Instagram", email: "Email", telefono: "Teléfono", whatsapp: "WhatsApp", presencial: "En persona", otro: "Otro",
};

/**
 * El CRM comercial: los locales y a quién le toca hoy.
 *
 * ORDEN POR DEFECTO: primero los que tienen seguimiento vencido, después los
 * que no se han tocado nunca, y al final el resto. No es un capricho de
 * ordenación, es la pantalla entera: un CRM ordenado alfabéticamente obliga a
 * leérselos todos para saber qué hacer, y por eso nadie los usa.
 *
 * Se carga todo de una vez (son pocos cientos de locales, por lotes en
 * lib/crm.ts) porque el orden depende de datos derivados; la lista se pagina
 * de 25 en 25 en pantalla. Se guarda al momento, sin botón.
 *
 * El cliente quiere CONSERVAR este módulo y sus datos para compararlo con
 * HubSpot: de ahí "Exportar CSV". No borrar nada de aquí sin hablarlo.
 */
export default function AdminCrm() {
  const [fichas, setFichas] = useState<FichaCrm[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  const [filtro, setFiltro] = useState<Filtro>("toca");
  const [pagina, setPagina] = useState(1);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [okExport, setOkExport] = useState("");

  const hoy = hoyISO();

  const cargar = useCallback(async () => {
    setCargando(true);
    const { fichas, error } = await cargarCrm();
    setFichas(fichas);
    setAviso(error);
    setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  // Al cambiar filtro o búsqueda se vuelve a la primera página.
  const elegirFiltro = (k: Filtro) => { setFiltro(k); setPagina(1); };
  const escribir = (v: string) => { setTexto(v); setPagina(1); };

  /** Optimista: se pinta y luego se guarda. Si falla, se dice y se recarga. */
  const cambiar = async (f: FichaCrm, cambios: Partial<Seguimiento>) => {
    setFichas((p) => p.map((x) => (x.id === f.id ? { ...x, seg: { ...x.seg, ...cambios } } : x)));
    const err = await guardarSeguimiento(f.id, { ...f.seg, ...cambios });
    if (err) { setAviso(`No se guardó «${f.nombre}»: ${err}`); cargar(); return; }
    setGuardado(f.id);
    setTimeout(() => setGuardado((g) => (g === f.id ? null : g)), 1500);
  };

  const exportar = async () => {
    setExportando(true); setOkExport("");
    try {
      const autores = await leerAutores(fichas);
      const blob = new Blob([crmACsv(fichas, autores)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `crm-tardeosclub-${hoy}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setOkExport(`Exportados ${fichas.length} locales.`);
    } catch (e) {
      setAviso("No se pudo exportar: " + String(e));
    }
    setExportando(false);
  };

  const cuentas = useMemo(() => ({
    toca: fichas.filter((f) => leToca(f, hoy)).length,
    sin: fichas.filter((f) => f.seg.estado === "no_contactado").length,
    interesados: fichas.filter((f) => f.seg.estado === "interesado").length,
    clientes: fichas.filter((f) => f.planEstado === "activa").length,
    todos: fichas.length,
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

  // Al cambiar de estado una ficha puede salir del filtro: si la página se
  // queda vacía, se pinta la última que exista.
  const pag = Math.min(pagina, Math.max(1, Math.ceil(lista.length / POR_PAGINA)));
  const visibles = lista.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);

  return (
    <SeccionPanel
      titulo="CRM comercial"
      descripcion="Seguimiento de locales: a quién llamar hoy, qué dijo y cuándo volver."
      acciones={
        <button type="button" onClick={exportar} disabled={cargando || exportando || fichas.length === 0}
          className={claseBoton("contorno", "pequeno")}>
          {exportando ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Download size={18} aria-hidden />} Exportar CSV
        </button>
      }
    >
      <div aria-live="polite">
        {aviso && <Aviso tono="aviso">{aviso}</Aviso>}
        {okExport && <Aviso tono="ok">{okExport}</Aviso>}
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <Buscador valor={texto} onCambiar={escribir} placeholder="Buscar local o zona…" />
        <Filtros<Filtro>
          valor={filtro}
          onCambiar={elegirFiltro}
          opciones={[
            { clave: "toca", label: "Le toca hoy", n: cargando ? null : cuentas.toca },
            { clave: "sin", label: "Sin contactar", n: cargando ? null : cuentas.sin },
            { clave: "interesados", label: "Interesados", n: cargando ? null : cuentas.interesados },
            { clave: "clientes", label: "Clientes", n: cargando ? null : cuentas.clientes },
            { clave: "todos", label: "Todos", n: cargando ? null : cuentas.todos },
          ]}
        />
      </div>

      {cargando ? (
        <div className="flex flex-col gap-3" aria-busy>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[180px] animate-pulse rounded-2xl bg-white ring-1 ring-linea" />)}
        </div>
      ) : lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-8 text-center text-[15px] text-tinta-suave">
          {filtro === "toca" && !busca
            ? "Hoy no le toca a nadie. Pon una fecha de «Volver el» a los que hayas contactado."
            : "Ningún local con ese filtro."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visibles.map((f) => (
            <Tarjeta key={f.id} f={f} hoy={hoy} guardado={guardado === f.id} onCambio={(c) => cambiar(f, c)} />
          ))}
        </div>
      )}

      <Paginacion pagina={pag} total={lista.length} porPagina={POR_PAGINA} onCambiar={setPagina} />
    </SeccionPanel>
  );
}

/**
 * El color de cada estado, y no el de la marca para los cuatro: un "no le
 * interesa" y un "interesado" tienen que distinguirse de reojo.
 *
 * VIVE AQUÍ Y NO EN lib/crm.ts: Tailwind solo mira `app/` y `components/`, así
 * que una clase escrita en `lib/` se purgaría del CSS sin avisar.
 */
const COLOR: Record<EstadoCrm, string> = {
  no_contactado: "border-tinta-suave bg-tinta-suave text-white",
  contactado: "border-magenta bg-magenta text-white",
  interesado: "border-ok bg-ok text-white",
  no_interesado: "border-linea-fuerte bg-marfil-200 text-tinta",
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
    <article className={`rounded-2xl border bg-white p-4 shadow-tarjeta ${vencido ? "border-magenta/40" : "border-linea"}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta">
          <Store size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[16px] font-bold leading-tight">
            <span className="truncate">{f.nombre}</span>
            {guardado && <span className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-ok"><Check size={15} aria-hidden /> Guardado</span>}
          </p>
          <p className="text-sm text-tinta-suave">{f.zona || "Sin zona"} · {f.tardeos} {f.tardeos === 1 ? "tardeo" : "tardeos"}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {vencido && <Etiqueta tono="marca">Le toca</Etiqueta>}
            {f.reclamado && <Etiqueta tono="neutro"><BadgeCheck size={13} aria-hidden /> Reclamado</Etiqueta>}
            {f.planEstado === "activa" && <Etiqueta tono="ok">Cliente · {ETIQUETA[f.plan]}</Etiqueta>}
            {f.planEstado === "impago" && <Etiqueta tono="error">Impago</Etiqueta>}
            {f.ticketera && <Etiqueta>Vende en {f.ticketera}</Etiqueta>}
          </div>
        </div>
      </div>

      {/* Por dónde escribirle. Si no hay nada, se dice: es información. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {canales.length === 0 ? (
          <span className="text-sm text-tinta-suave">Sin forma de contacto</span>
        ) : canales.map((c) => (
          <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer" title={c.label}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-linea-fuerte bg-white px-3 text-sm font-semibold text-tinta transition-colors hover:bg-marfil-100">
            <c.icono size={15} aria-hidden /> <span className="max-w-[12rem] truncate">{c.label}</span>
          </a>
        ))}
      </div>

      <div role="group" aria-label={`Estado comercial de ${f.nombre}`} className="mt-3 flex flex-wrap gap-1.5">
        {ESTADOS.map((e) => {
          const on = f.seg.estado === e.k;
          return (
            <button key={e.k} type="button" aria-pressed={on} onClick={() => onCambio({ estado: e.k as EstadoCrm })}
              className={`min-h-[40px] rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                on ? COLOR[e.k] : "border-linea-fuerte bg-white text-tinta-suave hover:border-tinta/50 hover:text-tinta"}`}>
              {e.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${
          vencido ? "border-magenta/40 bg-magenta-50 text-magenta-700" : "border-linea-fuerte bg-white text-tinta-suave"}`}>
          <CalendarClock size={16} aria-hidden />
          Volver el
          <input type="date" value={f.seg.proximo_seguimiento ?? ""}
            onChange={(ev) => onCambio({ proximo_seguimiento: ev.target.value || null })}
            className="bg-transparent font-semibold text-tinta outline-none" />
        </label>
        <label className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-linea-fuerte bg-white px-3 text-sm font-semibold text-tinta-suave">
          Canal
          <select value={f.seg.canal ?? ""} onChange={(ev) => onCambio({ canal: (ev.target.value || null) as Canal | null })}
            className="bg-transparent font-semibold text-tinta outline-none">
            <option value="">—</option>
            {CANALES.map((c) => <option key={c} value={c}>{NOMBRE_CANAL[c]}</option>)}
          </select>
        </label>
        {f.seg.ultimo_contacto && (
          <span className="text-sm text-tinta-suave">
            Último contacto: {new Date(f.seg.ultimo_contacto).toLocaleDateString("es-ES")}
          </span>
        )}
      </div>

      {/*
        Sin estado propio: `defaultValue` con `key`. Las notas se guardan al
        salir del campo, no en cada tecla. La `key` hace que el campo se
        rellene cuando el valor cambia por fuera (al recargar tras un error).
      */}
      <textarea
        key={f.seg.notas ?? ""}
        defaultValue={f.seg.notas ?? ""}
        onBlur={(ev) => {
          const v = ev.currentTarget.value;
          if (v !== (f.seg.notas ?? "")) onCambio({ notas: v || null });
        }}
        aria-label={`Notas de ${f.nombre}`}
        placeholder="Notas: con quién hablaste, qué dijo, qué le preocupa…"
        rows={2}
        className="mt-3 w-full resize-y rounded-xl border border-linea-fuerte bg-white px-3 py-2 text-[15px] outline-none transition focus:border-magenta focus:ring-4 focus:ring-magenta/15"
      />
    </article>
  );
}
