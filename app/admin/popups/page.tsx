"use client";

import { imagenParaSubir } from "@/app/local/_panel/reducirImagen";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, Filtros, EstadoLista, Buscador, useDiferido } from "@/components/panel/Paginacion";
import PanelFiltros, { CampoFiltro, claseFiltro } from "@/components/panel/PanelFiltros";
import { limpiarBusqueda } from "@/lib/filtrosLista";
import SegmentadorPopup, { SIN_SEGMENTAR, type Segmentacion } from "@/components/SegmentadorPopup";
import { TarjetaPopup, urlCtaValida, CTA_POR_DEFECTO, type Popup } from "@/components/PopupCliente";
import Boton from "@/components/Boton";
import Campo, { claseCampo } from "@/components/ui/Campo";
import Chip, { Etiqueta } from "@/components/ui/Chip";
import Hoja from "@/components/ui/Hoja";
import Tarjeta from "@/components/ui/Tarjeta";
import Aviso from "@/components/admin/Aviso";
import { Plus, Pencil, Pause, Play, Trash2, ImagePlus, X, ArrowLeft } from "lucide-react";
import { MARCA } from "@/lib/marca";

const TIPOS = ["Oferta", "Promo", "Noticia"];

// null = una sola vez y no vuelve. 0 = cada visita.
const FRECUENCIAS: { valor: number | null; label: string }[] = [
  { valor: null, label: "Una vez" },
  { valor: 24, label: "Cada día" },
  { valor: 168, label: "Cada semana" },
  { valor: 0, label: "Cada visita" },
];

const PUBLICOS: { valor: Popup["publico"]; label: string; pista: string }[] = [
  { valor: "todos", label: "Todos", pista: "Cualquiera que entre en la portada." },
  { valor: "anonimos", label: "Sin cuenta", pista: "Solo visitantes sin sesión: sirve para empujar al registro." },
  { valor: "registrados", label: "Registrados", pista: "Solo quien ya tiene cuenta." },
  { valor: "locales", label: "Locales", pista: "Dueños de un local o promotores." },
  { valor: "djs", label: "DJs", pista: "Solo perfiles de DJ." },
];

const etiquetaFrec = (h: number | null) => FRECUENCIAS.find((f) => f.valor === h)?.label ?? `Cada ${h} h`;
const etiquetaPublico = (p: string) => PUBLICOS.find((x) => x.valor === p)?.label ?? p;

type Estado = "activo" | "programado" | "caducado" | "pausado";
type Filtro = "todos" | Estado;

/** El estado que ve el admin. Pausado manda: es una decisión explícita suya. */
function estadoDe(p: Popup, ahora = Date.now()): Estado {
  if (!p.activo) return "pausado";
  if (p.desde && new Date(p.desde).getTime() > ahora) return "programado";
  if (p.hasta && new Date(p.hasta).getTime() < ahora) return "caducado";
  return "activo";
}
const ESTADO: Record<Estado, { label: string; tono: "ok" | "aviso" | "neutro" | "error" }> = {
  activo: { label: "Activo", tono: "ok" },
  programado: { label: "Programado", tono: "aviso" },
  caducado: { label: "Caducado", tono: "error" },
  pausado: { label: "Pausado", tono: "neutro" },
};

/** ISO → valor de <input type="datetime-local"> en la hora del navegador. */
function aLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}
const aIso = (v: string) => (v ? new Date(v).toISOString() : null);
const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

type Form = {
  id: string | null;
  titulo: string; mensaje: string; tipo: string;
  imagen: string; ctaTexto: string; ctaUrl: string;
  publico: Popup["publico"]; seg: Segmentacion;
  desde: string; hasta: string; repetir: number | null; activo: boolean;
};
const VACIO: Form = {
  id: null, titulo: "", mensaje: "", tipo: "Oferta", imagen: "", ctaTexto: "", ctaUrl: "",
  publico: "todos", seg: SIN_SEGMENTAR, desde: "", hasta: "", repetir: null, activo: true,
};
const desdeFila = (p: Popup): Form => ({
  id: p.id, titulo: p.titulo ?? "", mensaje: p.mensaje ?? "", tipo: p.tipo ?? "Oferta",
  imagen: p.imagen_url ?? "", ctaTexto: p.cta_texto ?? "", ctaUrl: p.cta_url ?? "",
  publico: p.publico ?? "todos",
  seg: { musica: p.seg_musica ?? [], tiposEvento: p.seg_tipos_evento ?? [], edades: p.seg_edades ?? [], zonas: p.seg_zonas ?? [] },
  desde: aLocal(p.desde), hasta: aLocal(p.hasta), repetir: p.repetir_horas ?? null, activo: p.activo,
});

/** ¿El error es que falta una columna del lote 49? */
const faltaColumna = (e: { code?: string; message?: string }) =>
  e.code === "PGRST204" || e.code === "42703" || /cta_|imagen_url/.test(e.message ?? "");

/**
 * Pop-ups de la portada: crear, editar, pausar y borrar.
 *
 * La lógica de a quién le sale (público, gustos, fechas, frecuencia y tope
 * diario) vive en `PopupCliente`; aquí solo se guarda lo que esa pieza lee.
 */
export default function AdminPopups() {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [cuentas, setCuentas] = useState<Partial<Record<Filtro, number>>>({});
  const [form, setForm] = useState<Form | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");
  const [aviso, setAviso] = useState<{ tono: "ok" | "error" | "aviso"; texto: string } | null>(null);
  const [borrando, setBorrando] = useState<Popup | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  // Se pone a true si al guardar la base dice que faltan las columnas.
  const [sinColumnas, setSinColumnas] = useState(false);
  const refArchivo = useRef<HTMLInputElement>(null);

  const ahoraIso = () => new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- el constructor de consultas de supabase-js no se deja tipar genérico
  const aplicar = (q: any, f: Filtro) => {
    const ya = ahoraIso();
    switch (f) {
      case "pausado": return q.eq("activo", false);
      case "programado": return q.eq("activo", true).gt("desde", ya);
      case "caducado": return q.eq("activo", true).or(`desde.is.null,desde.lte.${ya}`).lt("hasta", ya);
      case "activo": return q.eq("activo", true).or(`desde.is.null,desde.lte.${ya}`).or(`hasta.is.null,hasta.gte.${ya}`);
      default: return q;
    }
  };

  // Búsqueda y filtros plegables (en el servidor, sobre la misma consulta).
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  const [tipoF, setTipoF] = useState("");
  const [publicoF, setPublicoF] = useState("");
  const activos = [tipoF, publicoF].filter(Boolean).length;
  const limpiarFiltros = () => { setTipoF(""); setPublicoF(""); };

  const p = usePaginado<Popup>(
    (desde, hasta) => {
      let q = aplicar(supabase.from("popups").select("*", { count: "exact" }), filtro);
      if (tipoF) q = q.eq("tipo", tipoF);
      if (publicoF) q = q.eq("publico", publicoF);
      const l = limpiarBusqueda(busca);
      if (l) q = q.or(`titulo.ilike.%${l}%,mensaje.ilike.%${l}%`);
      return q.order("created_at", { ascending: false }).order("id").range(desde, hasta);
    },
    [filtro, busca, tipoF, publicoF],
    25,
  );

  // ¿Está pegado el lote 49? Se ve en si las filas traen la columna; sin filas
  // no se sabe (null) y se intenta guardar con ella.
  const hayLote49: boolean | null = sinColumnas ? false : p.filas.length ? "cta_url" in p.filas[0] : null;

  const contar = () => {
    const fs: Filtro[] = ["todos", "activo", "programado", "caducado", "pausado"];
    Promise.all(fs.map((f) =>
      aplicar(supabase.from("popups").select("id", { count: "exact", head: true }), f)
        .then((r: { count: number | null }) => [f, r.count ?? 0] as const),
    )).then((rs) => setCuentas(Object.fromEntries(rs)));
  };
  useEffect(contar, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  // ---------- Validación ----------
  const errores = (f: Form): string | null => {
    if (!f.titulo.trim()) return "Pon un título.";
    if (!urlCtaValida(f.ctaUrl)) return `El enlace del botón debe empezar por «/» (una página de ${MARCA.nombre}) o por «https://».`;
    if (f.desde && f.hasta && new Date(f.hasta) <= new Date(f.desde)) return "La fecha de fin tiene que ser posterior a la de inicio.";
    return null;
  };

  const guardar = async () => {
    if (!form) return;
    const e = errores(form);
    if (e) { setErrorForm(e); return; }
    setGuardando(true); setErrorForm("");
    const base = {
      titulo: form.titulo.trim(), mensaje: form.mensaje.trim() || null, tipo: form.tipo, activo: form.activo,
      repetir_horas: form.repetir, publico: form.publico,
      desde: aIso(form.desde), hasta: aIso(form.hasta),
      // Vacío se guarda como null: así "sin acotar" no se confunde con "lo
      // miró y no eligió", y el cliente lo trata igual.
      seg_musica: form.seg.musica.length ? form.seg.musica : null,
      seg_tipos_evento: form.seg.tiposEvento.length ? form.seg.tiposEvento : null,
      seg_edades: form.seg.edades.length ? form.seg.edades : null,
      seg_zonas: form.seg.zonas.length ? form.seg.zonas : null,
    };
    const extra = {
      cta_texto: form.ctaTexto.trim() || null,
      cta_url: form.ctaUrl.trim() || null,
      imagen_url: form.imagen.trim() || null,
    };
    const escribir = (campos: Record<string, unknown>) =>
      form.id
        ? supabase.from("popups").update(campos).eq("id", form.id).select("id")
        : supabase.from("popups").insert(campos).select("id");

    let r = await escribir(hayLote49 === false ? base : { ...base, ...extra });
    let sinLote49 = hayLote49 === false;
    // Sin el lote 49 pegado se guarda igual, sin botón ni imagen, y se avisa:
    // perder la campaña entera por un campo opcional sería peor.
    if (r.error && faltaColumna(r.error)) {
      sinLote49 = true;
      setSinColumnas(true);
      r = await escribir(base);
    }
    setGuardando(false);
    if (r.error) { setErrorForm("No se pudo guardar: " + r.error.message); return; }
    // Sin permiso la base no da error: devuelve cero filas.
    if (!r.data?.length) { setErrorForm("No se guardó nada. ¿Tu cuenta es admin?"); return; }

    const usaExtra = Boolean(extra.cta_texto || extra.cta_url || extra.imagen_url);
    setAviso(sinLote49 && usaExtra
      ? { tono: "aviso", texto: "Guardado, pero SIN botón personalizado ni imagen: falta pegar supabase/49_popups.sql en Supabase." }
      : { tono: "ok", texto: form.id ? "Pop-up actualizado." : "Pop-up creado." });
    setForm(null);
    p.recargar(); contar();
  };

  const pausar = async (u: Popup) => {
    setOcupado(u.id); setAviso(null);
    const { data, error } = await supabase.from("popups").update({ activo: !u.activo }).eq("id", u.id).select("id");
    setOcupado(null);
    if (error || !data?.length) {
      setAviso({ tono: "error", texto: "No se pudo cambiar: " + (error?.message ?? "la base no lo aceptó. ¿Tu cuenta es admin?") });
      return;
    }
    setAviso({ tono: "ok", texto: u.activo ? `«${u.titulo}» pausado.` : `«${u.titulo}» reactivado.` });
    p.recargar(); contar();
  };

  const borrar = async () => {
    if (!borrando) return;
    const u = borrando;
    setOcupado(u.id);
    const { data, error } = await supabase.from("popups").delete().eq("id", u.id).select("id");
    setOcupado(null); setBorrando(null);
    if (error || !data?.length) {
      setAviso({ tono: "error", texto: "No se pudo borrar: " + (error?.message ?? "la base no lo aceptó. ¿Tu cuenta es admin?") });
      return;
    }
    setAviso({ tono: "ok", texto: `«${u.titulo}» borrado.` });
    p.quitar((x) => x.id === u.id); contar();
  };

  const subirImagen = async (elegido: File) => {
    if (!elegido.type.startsWith("image/")) { setErrorForm("El archivo tiene que ser una imagen."); return; }
    let archivo: File;
    try { archivo = await imagenParaSubir(elegido); } catch (e) { setErrorForm((e as Error).message); return; }
    if (archivo.size > 5 * 1024 * 1024) { setErrorForm("La imagen pesa más de 5 MB. Redúcela antes de subirla."); return; }
    setSubiendo(true); setErrorForm("");
    const ext = (archivo.name.split(".").pop() || "jpg").toLowerCase();
    const ruta = `popups/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("flyers").upload(ruta, archivo, { contentType: archivo.type, upsert: false });
    setSubiendo(false);
    if (error) { setErrorForm("No se pudo subir la imagen: " + error.message); return; }
    cambiar("imagen", supabase.storage.from("flyers").getPublicUrl(ruta).data.publicUrl);
  };

  // ---------- Editor ----------
  if (form) {
    const err = errores(form);
    const urlMal = !urlCtaValida(form.ctaUrl);
    return (
      <SeccionPanel
        titulo={form.id ? "Editar pop-up" : "Nuevo pop-up"}
        descripcion="Sale en la portada a quien encaje. Revisa la vista previa antes de guardar."
        acciones={<Boton variante="contorno" tamano="pequeno" onClick={() => { setForm(null); setErrorForm(""); }}><ArrowLeft size={18} aria-hidden /> Volver</Boton>}
        ancho="ancho"
      >
        {hayLote49 === false && (
          <Aviso tono="aviso">Falta pegar supabase/49_popups.sql: hasta entonces el botón será siempre «Ver tardeos» y no se guarda la imagen.</Aviso>
        )}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-4">
            <Tarjeta className="flex flex-col gap-4">
              <h2 className="text-lg font-bold">Contenido</h2>
              <Campo etiqueta="Título" htmlFor="pp-titulo">
                <input id="pp-titulo" value={form.titulo} onChange={(e) => cambiar("titulo", e.target.value)} maxLength={80}
                  placeholder="2x1 en vermut este sábado" className={claseCampo} />
              </Campo>
              <Campo etiqueta="Texto" htmlFor="pp-mensaje" ayuda="Corto: dos frases como mucho.">
                <textarea id="pp-mensaje" value={form.mensaje} onChange={(e) => cambiar("mensaje", e.target.value)} rows={3} maxLength={280}
                  placeholder="Enseña el pop-up en la barra y te lo aplican." className={claseCampo} />
              </Campo>
              <div>
                <p className="mb-1.5 text-[15px] font-semibold">Etiqueta</p>
                <div className="flex flex-wrap gap-2">
                  {TIPOS.map((t) => <Chip key={t} activo={form.tipo === t} onClick={() => cambiar("tipo", t)}>{t}</Chip>)}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[15px] font-semibold">Imagen (opcional)</p>
                {form.imagen ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.imagen} alt="" className="h-16 w-28 rounded-lg object-cover ring-1 ring-linea" />
                    <Boton variante="contorno" tamano="pequeno" onClick={() => cambiar("imagen", "")}><X size={18} aria-hidden /> Quitar</Boton>
                  </div>
                ) : (
                  <>
                    <input ref={refArchivo} type="file" accept="image/*" className="sr-only" tabIndex={-1}
                      onChange={(e) => { const a = e.target.files?.[0]; if (a) subirImagen(a); e.target.value = ""; }} />
                    <Boton variante="contorno" tamano="pequeno" cargando={subiendo} disabled={hayLote49 === false}
                      onClick={() => refArchivo.current?.click()}>
                      <ImagePlus size={18} aria-hidden /> Subir imagen
                    </Boton>
                  </>
                )}
                <p className="mt-1 text-sm text-tinta-suave">Horizontal (16:9) queda mejor. Máximo 5 MB.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Texto del botón" htmlFor="pp-cta" ayuda={`Si lo dejas vacío: «${CTA_POR_DEFECTO.texto}».`}>
                  <input id="pp-cta" value={form.ctaTexto} onChange={(e) => cambiar("ctaTexto", e.target.value)} maxLength={30}
                    placeholder={CTA_POR_DEFECTO.texto} className={claseCampo} disabled={hayLote49 === false} />
                </Campo>
                <Campo etiqueta="A dónde lleva" htmlFor="pp-url"
                  error={urlMal ? `Empieza por «/» (página de ${MARCA.nombre}) o por «https://».` : null}
                  ayuda={`Ej.: /tardeos/123 o https://… Vacío: ${CTA_POR_DEFECTO.url}.`}>
                  <input id="pp-url" value={form.ctaUrl} onChange={(e) => cambiar("ctaUrl", e.target.value)} inputMode="url"
                    placeholder={CTA_POR_DEFECTO.url} className={claseCampo} disabled={hayLote49 === false} aria-invalid={urlMal} />
                </Campo>
              </div>
            </Tarjeta>

            <Tarjeta className="flex flex-col gap-4">
              <h2 className="text-lg font-bold">A quién</h2>
              <div className="flex flex-wrap gap-2">
                {PUBLICOS.map((x) => <Chip key={x.valor} activo={form.publico === x.valor} onClick={() => cambiar("publico", x.valor)}>{x.label}</Chip>)}
              </div>
              <p className="-mt-2 text-sm text-tinta-suave">{PUBLICOS.find((x) => x.valor === form.publico)?.pista}</p>
              <SegmentadorPopup valor={form.seg} onCambio={(s) => cambiar("seg", s)} />
            </Tarjeta>

            <Tarjeta className="flex flex-col gap-4">
              <h2 className="text-lg font-bold">Cuándo</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Desde (opcional)" htmlFor="pp-desde" ayuda="Vacío: desde ya.">
                  <input id="pp-desde" type="datetime-local" value={form.desde} onChange={(e) => cambiar("desde", e.target.value)} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Hasta (opcional)" htmlFor="pp-hasta" ayuda="Vacío: hasta que lo pauses.">
                  <input id="pp-hasta" type="datetime-local" value={form.hasta} onChange={(e) => cambiar("hasta", e.target.value)} className={claseCampo} />
                </Campo>
              </div>
              <div>
                <p className="mb-1.5 text-[15px] font-semibold">Cada cuánto le sale</p>
                <div className="flex flex-wrap gap-2">
                  {FRECUENCIAS.map((f) => <Chip key={f.label} activo={form.repetir === f.valor} onClick={() => cambiar("repetir", f.valor)}>{f.label}</Chip>)}
                </div>
                <p className="mt-1 text-sm text-tinta-suave">
                  Se cuenta desde que esa persona lo cierra. Además, nadie ve más pop-ups al día que el tope general (3 por defecto).
                </p>
              </div>
              <label className="flex min-h-tacto items-center gap-3 text-[15px] font-semibold">
                <input type="checkbox" checked={form.activo} onChange={(e) => cambiar("activo", e.target.checked)} className="h-6 w-6 accent-magenta" />
                Activo (si lo desmarcas, se guarda pausado)
              </label>
            </Tarjeta>
          </div>

          <div className="lg:sticky lg:top-4 lg:self-start">
            <p className="mb-2 text-[15px] font-semibold text-tinta-suave">Vista previa</p>
            <div className="grid place-items-center rounded-2xl bg-noche/60 p-4">
              <TarjetaPopup previa popup={{
                titulo: form.titulo, mensaje: form.mensaje, tipo: form.tipo,
                cta_texto: hayLote49 === false ? null : form.ctaTexto,
                cta_url: hayLote49 === false ? null : form.ctaUrl,
                imagen_url: hayLote49 === false ? null : form.imagen,
              }} />
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {errorForm && <Aviso tono="error">{errorForm}</Aviso>}
              <Boton ancho cargando={guardando} disabled={Boolean(err) || subiendo} onClick={guardar}>
                {form.id ? "Guardar cambios" : form.activo ? "Crear y activar" : "Crear pausado"}
              </Boton>
              {err && !errorForm && <p className="text-center text-sm text-tinta-suave">{err}</p>}
            </div>
          </div>
        </div>
      </SeccionPanel>
    );
  }

  // ---------- Lista ----------
  return (
    <SeccionPanel
      titulo="Pop-ups"
      descripcion="Avisos y promociones que salen al entrar en la portada. Como mucho uno por visita."
      acciones={<Boton tamano="pequeno" onClick={() => { setForm({ ...VACIO }); setAviso(null); }}><Plus size={18} aria-hidden /> Nuevo pop-up</Boton>}
    >
      <div className="mb-4">
        <Filtros<Filtro>
          valor={filtro}
          onCambiar={setFiltro}
          opciones={[
            { clave: "todos", label: "Todos", n: cuentas.todos },
            { clave: "activo", label: "Activos", n: cuentas.activo },
            { clave: "programado", label: "Programados", n: cuentas.programado },
            { clave: "caducado", label: "Caducados", n: cuentas.caducado },
            { clave: "pausado", label: "Pausados", n: cuentas.pausado },
          ]}
        />
        <div className="mt-3 flex flex-col gap-3">
          <Buscador valor={texto} onCambiar={setTexto} placeholder="Buscar por título o mensaje…" />
          <PanelFiltros clave="admin-popups" activos={activos} onLimpiar={limpiarFiltros}>
            <CampoFiltro etiqueta="Tipo">
              <select value={tipoF} onChange={(e) => setTipoF(e.target.value)} className={claseFiltro}>
                <option value="">Todos</option>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </CampoFiltro>
            <CampoFiltro etiqueta="A quién sale">
              <select value={publicoF} onChange={(e) => setPublicoF(e.target.value)} className={claseFiltro}>
                <option value="">Cualquier público</option>
                {PUBLICOS.map((x) => <option key={x.valor} value={x.valor}>{x.label}</option>)}
              </select>
            </CampoFiltro>
          </PanelFiltros>
        </div>
      </div>

      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length}
        vacio={activos || busca ? "Ningún pop-up con estos filtros." : filtro === "todos" ? "Todavía no hay pop-ups. Crea el primero con «Nuevo pop-up»." : "Ninguno en este estado."} />

      {p.filas.length > 0 && (
        <ul className={`flex flex-col gap-3 ${p.cargando ? "opacity-60" : ""}`}>
          {p.filas.map((u) => {
            const est = ESTADO[estadoDe(u)];
            const seg = [u.seg_musica, u.seg_tipos_evento, u.seg_edades, u.seg_zonas].some((x) => x?.length);
            const desde = fecha(u.desde), hasta = fecha(u.hasta);
            return (
              <li key={u.id} className="flex flex-col gap-3 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Etiqueta tono={est.tono}>{est.label}</Etiqueta>
                    <Etiqueta>{etiquetaPublico(u.publico)}</Etiqueta>
                    <Etiqueta>{etiquetaFrec(u.repetir_horas ?? null)}</Etiqueta>
                    {seg && <Etiqueta tono="marca">Por gustos</Etiqueta>}
                  </div>
                  <p className="mt-2 truncate text-base font-bold">{u.titulo}</p>
                  {u.mensaje && <p className="truncate text-[15px] text-tinta-suave">{u.mensaje}</p>}
                  {(desde || hasta) && (
                    <p className="mt-1 text-sm text-tinta-suave">
                      {desde ? `Desde ${desde}` : "Desde ya"}{hasta ? ` · hasta ${hasta}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Boton variante="contorno" tamano="pequeno" onClick={() => { setForm(desdeFila(u)); setAviso(null); }}>
                    <Pencil size={16} aria-hidden /> Editar
                  </Boton>
                  <Boton variante="contorno" tamano="pequeno" cargando={ocupado === u.id} onClick={() => pausar(u)}>
                    {u.activo ? <><Pause size={16} aria-hidden /> Pausar</> : <><Play size={16} aria-hidden /> Activar</>}
                  </Boton>
                  <Boton variante="contorno" tamano="pequeno" aria-label={`Borrar ${u.titulo}`} onClick={() => setBorrando(u)}>
                    <Trash2 size={16} aria-hidden />
                  </Boton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />

      <Hoja abierta={Boolean(borrando)} onCerrar={() => setBorrando(null)} titulo="¿Borrar este pop-up?"
        pie={
          <div className="grid gap-2">
            <Boton ancho variante="peligro" cargando={ocupado === borrando?.id} onClick={borrar}><Trash2 size={18} aria-hidden /> Sí, borrar</Boton>
            <Boton ancho variante="contorno" onClick={() => setBorrando(null)}>Cancelar</Boton>
          </div>
        }>
        <p className="text-base">
          Se borrará <strong>«{borrando?.titulo}»</strong> para siempre. Si solo quieres que deje de salir, usa <strong>Pausar</strong>.
        </p>
      </Hoja>
    </SeccionPanel>
  );
}
