"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, useDiferido, Buscador, Filtros, EstadoLista } from "@/components/panel/Paginacion";
import AsignarDueno from "@/components/AsignarDueno";
import Hoja from "@/components/ui/Hoja";
import Boton from "@/components/Boton";
import Aviso from "@/components/admin/Aviso";
import { Etiqueta } from "@/components/ui/Chip";
import { etiquetaPublicacion } from "@/lib/estados";
import { refrescarPortada } from "@/components/admin/revalidar";
import { descargarCsv, leerPorLotes, hoyFichero } from "@/components/admin/csv";
import { useFiltroZona, SelectorZona, esperar } from "@/components/admin/FiltroZona";
import { useAuth } from "@/lib/useAuth";
import {
  BadgeCheck, Eye, EyeOff, Plus, ExternalLink, Pencil, Store, Disc3, Megaphone, Trash2, Download, CheckCircle2, Loader2,
} from "lucide-react";

export type TipoFicha = "locales" | "promotores" | "djs";
type Filtro = "todos" | "publicados" | "pendientes" | "ocultos" | "sin_dueno" | "verificados";

type Fila = {
  id: string;
  nombre: string;
  zona: string | null;
  verificado: boolean;
  oculto: boolean;
  estado: string | null;
  dueno: string | null;
  imagen: string | null;
  created_at: string | null;
  zonas?: string[] | null;
  /** Zona normalizada (lote 69); solo locales/promotores y solo si el lote está. */
  zona_slug?: string | null;
};

/** Confirmaciones que abren la hoja. */
type Confirmar =
  | { tipo: "quitar_verificado"; f: Fila }
  | { tipo: "eliminar"; f: Fila; tardeos: number | null; error?: string };

/** Quita lo que rompe la sintaxis de los filtros de PostgREST. */
const limpiar = (s: string) => s.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();

const TXT: Record<TipoFicha, { titulo: string; uno: string; crear: string; icono: typeof Store }> = {
  locales: { titulo: "Locales", uno: "local", crear: "local", icono: Store },
  promotores: { titulo: "Promotores", uno: "promotor", crear: "promotor", icono: Megaphone },
  djs: { titulo: "DJs", uno: "DJ", crear: "dj", icono: Disc3 },
};

const MSG_SIN_FILAS = "La base no aceptó el cambio (puede que no tengas permiso o que la sesión haya caducado). No se ha modificado nada.";

/**
 * Locales, promotores y DJs del admin, paginados en el servidor.
 *
 * Las diferencias entre tablas se resuelven aquí: los DJs guardan el nombre en
 * `nombre_artistico` y el "oculto" en un booleano; los locales, en `estado`.
 * Toda escritura pide la fila de vuelta (`.select("id")`): con RLS, un "no"
 * de la base llega como 0 filas sin error, y antes se daba por guardado.
 */
export default function FichasAdmin({ tipo }: { tipo: TipoFicha }) {
  const t = TXT[tipo];
  const esDj = tipo === "djs";
  const tabla = esDj ? "djs" : "locales";
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [correos, setCorreos] = useState<Map<string, string>>(new Map());
  const [cuentas, setCuentas] = useState<Partial<Record<Filtro, number>>>({});
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const [confirmar, setConfirmar] = useState<Confirmar | null>(null);
  const [obrando, setObrando] = useState<string | null>(null);
  const [exportando, setExportando] = useState<number | null>(null);
  const { user } = useAuth();
  // Filtro de zona (lote 69). Los DJs no tienen `zona_slug` (guardan varias
  // zonas en un array): a ellos no se les aplica.
  const zona = useFiltroZona();
  const conZona = !esDj && zona.activo;
  const esperaZona = !esDj && !zona.listo;
  const claveZona = esDj ? "" : zona.clave;

  const base = (cuenta: boolean) => {
    const cols = esDj
      ? "id,nombre:nombre_artistico,zonas,verificado,oculto,dueno:profile_id,imagen:avatar_url,created_at"
      : `id,nombre,zona,verificado,estado,dueno:owner_id,imagen:logo_url,created_at${conZona ? ",zona_slug" : ""}`;
    let q = supabase.from(tabla).select(cols, cuenta ? { count: "exact" } : undefined);
    if (!esDj) q = q.eq("tipo", tipo === "promotores" ? "promotor" : "local");
    return q;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- el constructor de consultas de Supabase cambia de tipo en cada filtro
  type Q = any;
  const aplicarFiltro = (q: Q, f: Filtro): Q => {
    switch (f) {
      case "publicados": return (esDj ? q.eq("oculto", false) : q.eq("estado", "activo"));
      case "pendientes": return (esDj ? q.eq("verificado", false) : q.eq("estado", "borrador"));
      case "ocultos": return (esDj ? q.eq("oculto", true) : q.like("estado", "oculto%"));
      case "sin_dueno": return q.is(esDj ? "profile_id" : "owner_id", null);
      case "verificados": return q.eq("verificado", true);
      default: return q;
    }
  };

  /** Filtros + búsqueda + orden. La usan la lista y el CSV. */
  const filtrada = (cuenta: boolean): Q => {
    let q = aplicarFiltro(base(cuenta) as Q, filtro);
    if (!esDj) q = zona.aplicar(q);
    const l = limpiar(busca);
    if (l) q = (esDj ? q.ilike("nombre_artistico", `%${l}%`) : q.or(`nombre.ilike.%${l}%,zona.ilike.%${l}%`));
    return q.order(esDj ? "nombre_artistico" : "nombre").order("id");
  };

  const p = usePaginado<Fila>(
    (desde, hasta) => (esperaZona ? esperar() : filtrada(true).range(desde, hasta)),
    [tipo, filtro, busca, claveZona],
    25,
  );

  // Emails de los dueños, solo de la página visible.
  useEffect(() => {
    const ids = [...new Set(p.filas.map((f) => f.dueno).filter(Boolean))] as string[];
    const faltan = ids.filter((i) => !correos.has(i));
    if (!faltan.length) return;
    supabase.from("profiles").select("id,email").in("id", faltan).then(({ data }) => {
      setCorreos((prev) => {
        const m = new Map(prev);
        (data ?? []).forEach((x) => m.set(x.id, x.email ?? "—"));
        return m;
      });
    });
  }, [p.filas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Contadores de cada pestaña (solo recuento, sin filas). Con la misma zona
  // que la lista: si no, la pestaña dice 300 y al pulsarla salen 40.
  const contar = () => {
    if (esperaZona) return;
    const fs: Filtro[] = ["todos", "publicados", "pendientes", "ocultos", "sin_dueno", "verificados"];
    Promise.all(fs.map((f) => {
      let q = supabase.from(tabla).select("id", { count: "exact", head: true });
      if (!esDj) q = zona.aplicar(q.eq("tipo", tipo === "promotores" ? "promotor" : "local"));
      return aplicarFiltro(q as Q, f).then((r: { count: number | null }) => [f, r.count ?? 0] as const);
    })).then((rs) => setCuentas(Object.fromEntries(rs)));
  };
  useEffect(contar, [tipo, claveZona]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Guarda y comprueba que la base escribió la fila. Devuelve si fue bien. */
  const guardar = async (f: Fila, cambio: Record<string, unknown>, local: Partial<Fila>, msg: string) => {
    setObrando(f.id); setAviso(null);
    const { data, error } = await supabase.from(tabla).update(cambio).eq("id", f.id).select("id");
    setObrando(null);
    if (error) { setAviso({ tono: "error", texto: `«${f.nombre}»: no se pudo guardar: ${error.message}` }); return false; }
    if (!data?.length) { setAviso({ tono: "error", texto: `«${f.nombre}»: ${MSG_SIN_FILAS}` }); return false; }
    p.cambiar((x) => x.id === f.id, local);
    setAviso({ tono: "ok", texto: `«${f.nombre}»: ${msg}` }); contar(); refrescarPortada();
    return true;
  };

  const verificar = (f: Fila) => {
    // Quitar el sello se confirma: el dueño lo ve en su ficha y es fácil
    // tocarlo sin querer en una tabla larga.
    if (f.verificado) { setConfirmar({ tipo: "quitar_verificado", f }); return; }
    return guardar(f, { verificado: true }, { verificado: true }, "verificado.");
  };
  const ocultar = (f: Fila) => {
    const v = !f.oculto;
    // Se escribe 'oculto' y NO 'oculto_impago': retirar una ficha no es acusar de no pagar.
    return guardar(f, esDj ? { oculto: v } : { estado: v ? "oculto" : "activo" },
      { oculto: v, estado: esDj ? f.estado : v ? "oculto" : "activo" }, v ? "ocultado de la web." : "publicado en la web.");
  };
  const publicar = (f: Fila) => guardar(f, { estado: "activo" }, { estado: "activo", oculto: false }, "publicado en la web.");

  /** Abre la confirmación de borrado contando antes lo que cuelga de la ficha. */
  const pedirEliminar = async (f: Fila) => {
    setConfirmar({ tipo: "eliminar", f, tardeos: null });
    const r = esDj
      ? await supabase.from("tardeo_djs").select("tardeo_id", { count: "exact", head: true }).eq("dj_id", f.id)
      : await supabase.from("tardeos").select("id", { count: "exact", head: true }).eq("local_id", f.id);
    setConfirmar((c) => (c && c.tipo === "eliminar" && c.f.id === f.id
      ? { ...c, tardeos: r.error ? -1 : r.count ?? 0 } : c));
  };

  const eliminar = async (f: Fila) => {
    setObrando(f.id);
    const { data, error } = await supabase.from(tabla).delete().eq("id", f.id).select("id");
    setObrando(null);
    if (error || !data?.length) {
      const motivo = error ? error.message
        : esDj ? "La base no dejó borrarla: falta el permiso de borrar DJs (lote 55, supabase/55_invitaciones_dj.sql)."
        : MSG_SIN_FILAS;
      setConfirmar((c) => (c && c.tipo === "eliminar" ? { ...c, error: motivo } : c));
      return;
    }
    p.quitar((x) => x.id === f.id);
    setConfirmar(null);
    setAviso({ tono: "ok", texto: `«${f.nombre}» eliminado.` });
    contar(); refrescarPortada();
  };

  const exportarCsv = async () => {
    setExportando(0); setAviso(null);
    const { filas: todas, error } = await leerPorLotes<Fila>((d, h) => filtrada(false).range(d, h), setExportando);
    if (error) { setExportando(null); setAviso({ tono: "error", texto: "No se pudo exportar: " + error }); return; }
    // Emails de los dueños en tandas de 200 ids (una URL con 1000 uuids es
    // demasiado larga para algunos proxies).
    const ids = [...new Set(todas.map((f) => f.dueno).filter(Boolean))] as string[];
    const emails = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error: e } = await supabase.from("profiles").select("id,email").in("id", ids.slice(i, i + 200));
      if (e) { setExportando(null); setAviso({ tono: "error", texto: "No se pudieron leer los emails de los dueños: " + e.message }); return; }
      (data ?? []).forEach((x) => emails.set(x.id, x.email ?? ""));
    }
    setExportando(null);
    descargarCsv(`${tipo}-${hoyFichero()}.csv`,
      ["Nombre", "Zona", "Estado", "Verificado", "Email del dueño", "Alta", "Id"],
      todas.map((f) => [
        f.nombre, f.zona ?? (Array.isArray(f.zonas) ? f.zonas.join(", ") : ""),
        esDj ? (f.oculto ? "Oculto" : "Visible") : etiquetaPublicacion(f.estado),
        f.verificado ? "Sí" : "No", f.dueno ? emails.get(f.dueno) ?? "" : "",
        f.created_at ? new Date(f.created_at).toLocaleDateString("es-ES") : "", f.id,
      ]));
    setAviso({ tono: "ok", texto: `Exportadas ${todas.length.toLocaleString("es-ES")} fichas.` });
  };

  const filas = p.filas.map((f) => ({ ...f, zona: f.zona ?? (Array.isArray(f.zonas) ? f.zonas.join(", ") : null), oculto: esDj ? Boolean(f.oculto) : String(f.estado ?? "").startsWith("oculto") }));
  const btn = "inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors disabled:opacity-50";

  return (
    <SeccionPanel
      titulo={t.titulo}
      descripcion={`Fichas de ${t.titulo.toLowerCase()}: publicar, verificar, ocultar, cambiar el dueño o eliminar.`}
      acciones={
        <>
          <Boton variante="contorno" tamano="pequeno" onClick={exportarCsv} cargando={exportando !== null} disabled={p.total === 0}>
            {exportando === null && <Download size={18} aria-hidden />}
            {exportando !== null ? `Exportando… ${exportando}` : `Exportar CSV (${p.total.toLocaleString("es-ES")})`}
          </Boton>
          <Link href={`/admin/crear?tipo=${t.crear}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-magenta px-4 text-[15px] font-bold text-white hover:bg-magenta-600">
            <Plus size={18} aria-hidden /> Nuevo {t.uno}
          </Link>
        </>
      }
      ancho="ancho"
    >
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Buscador valor={texto} onCambiar={setTexto} placeholder={esDj ? "Buscar DJ por nombre…" : `Buscar ${t.uno} por nombre o zona…`} />
          {!esDj && <SelectorZona zona={zona} />}
        </div>
        <Filtros<Filtro>
          valor={filtro}
          onCambiar={setFiltro}
          opciones={[
            { clave: "todos", label: "Todos", n: cuentas.todos },
            { clave: "publicados", label: esDj ? "Visibles" : "Publicados", n: cuentas.publicados },
            { clave: "pendientes", label: esDj ? "Sin verificar" : "Borradores", n: cuentas.pendientes },
            { clave: "ocultos", label: "Ocultos", n: cuentas.ocultos },
            { clave: "sin_dueno", label: "Sin dueño", n: cuentas.sin_dueno },
            { clave: "verificados", label: "Verificados", n: cuentas.verificados },
          ]}
        />
      </div>

      <div aria-live="polite">{aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}</div>

      <EstadoLista cargando={p.cargando} error={p.error} filas={filas.length}
        vacio={busca || filtro !== "todos" || (!esDj && zona.filtra) ? "Nada con esos filtros." : `Todavía no hay ${t.titulo.toLowerCase()}.`} />

      {filas.length > 0 && (
        <div className={`overflow-hidden rounded-2xl border border-linea bg-white ${p.cargando ? "opacity-60" : ""}`}>
          <table className="w-full text-left text-[15px]">
            <thead className="hidden border-b border-linea bg-marfil text-[13px] font-semibold uppercase tracking-wide text-tinta-suave md:table-header-group">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Dueño</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {filas.map((f) => {
                const email = f.dueno ? correos.get(f.dueno) ?? "…" : null;
                const ocupada = obrando === f.id;
                // Fuera de su zona el admin de zona solo mira: la base no le
                // dejaría guardar (lote 69), así que no se le ofrecen botones.
                // El dueño de la ficha sí puede (caso local + admin de zona).
                const soloLectura = conZona && !zona.puedeEditar(f.zona_slug) && f.dueno !== user?.id;
                return (
                  <tr key={f.id} className="flex flex-col gap-2 p-4 md:table-row md:p-0">
                    <td className="md:px-4 md:py-3">
                      <div className="flex items-center gap-3">
                        {f.imagen ? (
                          <Image src={f.imagen} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-linea" />
                        ) : (
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-marfil-100 text-tinta-suave"><t.icono size={20} aria-hidden /></span>
                        )}
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 font-semibold leading-tight">
                            <span className="truncate">{f.nombre || "(sin nombre)"}</span>
                            {f.verificado && <BadgeCheck size={16} className="shrink-0 text-magenta" aria-label="Verificado" />}
                          </p>
                          <p className="text-sm text-tinta-suave">{f.zona || "Sin zona"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="md:px-4 md:py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {esDj
                          ? <Etiqueta tono={f.oculto ? "neutro" : "ok"}>{f.oculto ? "Oculto" : "Visible"}</Etiqueta>
                          : <Etiqueta tono={f.estado === "activo" ? "ok" : f.estado === "borrador" ? "aviso" : "neutro"}>{etiquetaPublicacion(f.estado)}</Etiqueta>}
                        {!f.verificado && <Etiqueta tono="aviso">Sin verificar</Etiqueta>}
                      </div>
                    </td>
                    <td className="max-w-[280px] md:px-4 md:py-3">
                      {soloLectura ? <span className="text-sm text-tinta-suave">{email ?? "Sin dueño"}</span> : <AsignarDueno key={`${f.id}-${f.dueno ?? ""}`} tabla={tabla} campo={esDj ? "profile_id" : "owner_id"} id={f.id} duenoEmail={email}
                        onAsignado={(em) => { setAviso({ tono: "ok", texto: `«${f.nombre}»: ahora es de ${em}.` }); p.recargar(); contar(); }}
                        onQuitado={() => { p.cambiar((x) => x.id === f.id, { dueno: null }); setAviso({ tono: "ok", texto: `«${f.nombre}»: dueño quitado.` }); contar(); }} />}
                    </td>
                    <td className="md:px-4 md:py-3">
                      <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                        {ocupada && <Loader2 size={18} className="animate-spin text-tinta-suave" aria-label="Guardando" />}
                        {soloLectura ? (
                          <>
                            <Etiqueta>{f.zona_slug ? "Solo lectura · otra zona" : "Solo lectura · sin zona"}</Etiqueta>
                            <Link href={`/locales/${f.id}`} target="_blank" aria-label={`Ver ficha pública de ${f.nombre}`}
                              className="grid min-h-[44px] min-w-[44px] place-items-center rounded-lg border border-linea-fuerte bg-white hover:bg-marfil-100">
                              <ExternalLink size={16} aria-hidden />
                            </Link>
                          </>
                        ) : (<>
                        {!esDj && f.estado === "borrador" && (
                          <button onClick={() => publicar(f)} disabled={ocupada}
                            className={`${btn} border-magenta bg-magenta text-white hover:bg-magenta-600`}>
                            <CheckCircle2 size={16} aria-hidden /> Publicar
                          </button>
                        )}
                        <button onClick={() => verificar(f)} disabled={ocupada}
                          className={`${btn} ${f.verificado ? "border-magenta/30 bg-magenta-50 text-magenta-700" : "border-linea-fuerte bg-white hover:bg-marfil-100"}`}>
                          <BadgeCheck size={16} aria-hidden /> {f.verificado ? "Verificado" : "Verificar"}
                        </button>
                        {(esDj || f.estado !== "borrador") && (
                          <button onClick={() => ocultar(f)} disabled={ocupada}
                            className={`${btn} border-linea-fuerte bg-white hover:bg-marfil-100`}>
                            {f.oculto ? <><Eye size={16} aria-hidden /> Mostrar</> : <><EyeOff size={16} aria-hidden /> Ocultar</>}
                          </button>
                        )}
                        <Link href={esDj ? `/dj/perfil?id=${f.id}` : `/local/editar?id=${f.id}`} aria-label={`Editar ${f.nombre}`}
                          className="grid min-h-[44px] min-w-[44px] place-items-center rounded-lg border border-linea-fuerte bg-white hover:bg-marfil-100">
                          <Pencil size={16} aria-hidden />
                        </Link>
                        <Link href={esDj ? `/djs/${f.id}` : `/locales/${f.id}`} target="_blank" aria-label={`Ver ficha pública de ${f.nombre}`}
                          className="grid min-h-[44px] min-w-[44px] place-items-center rounded-lg border border-linea-fuerte bg-white hover:bg-marfil-100">
                          <ExternalLink size={16} aria-hidden />
                        </Link>
                        <button onClick={() => pedirEliminar(f)} disabled={ocupada} aria-label={`Eliminar ${f.nombre}`}
                          className="grid min-h-[44px] min-w-[44px] place-items-center rounded-lg border border-linea-fuerte bg-white text-error hover:bg-error-fondo disabled:opacity-50">
                          <Trash2 size={16} aria-hidden />
                        </button>
                        </>)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />

      <Hoja
        abierta={!!confirmar}
        onCerrar={() => { if (!obrando) setConfirmar(null); }}
        titulo={confirmar?.tipo === "eliminar" ? "¿Eliminar esta ficha?" : "¿Quitar el sello de verificado?"}
      >
        {confirmar?.tipo === "quitar_verificado" && (
          <div className="flex flex-col gap-3">
            <p className="text-[16px]">
              <b>{confirmar.f.nombre}</b> dejará de mostrar el sello de verificado en su ficha pública.
            </p>
            <Boton variante="peligro" ancho cargando={obrando === confirmar.f.id}
              onClick={async () => { if (await guardar(confirmar.f, { verificado: false }, { verificado: false }, "verificación quitada.")) setConfirmar(null); }}>
              Sí, quitar verificado
            </Boton>
            <Boton variante="contorno" ancho disabled={!!obrando} onClick={() => setConfirmar(null)}>No, dejarlo</Boton>
          </div>
        )}
        {confirmar?.tipo === "eliminar" && (
          <div className="flex flex-col gap-3">
            <p className="text-lg font-bold leading-tight">{confirmar.f.nombre}</p>
            {confirmar.error && <Aviso tono="error">{confirmar.error}</Aviso>}
            {confirmar.tardeos === null ? (
              <p className="flex items-center gap-2 text-[15px] text-tinta-suave"><Loader2 size={18} className="animate-spin" aria-hidden /> Contando sus tardeos…</p>
            ) : esDj ? (
              <p className="rounded-xl bg-error-fondo p-4 text-[15px] font-semibold text-error">
                {confirmar.tardeos > 0
                  ? `Sale como DJ en ${confirmar.tardeos} ${confirmar.tardeos === 1 ? "tardeo" : "tardeos"}: desaparecerá de esos carteles (los tardeos se quedan).`
                  : confirmar.tardeos === 0 ? "No sale en ningún tardeo." : "No se pudo contar en cuántos tardeos sale."}
                {" "}También se borran sus sesiones, fotos y estadísticas. No se puede deshacer.
              </p>
            ) : (
              <p className="rounded-xl bg-error-fondo p-4 text-[15px] font-semibold text-error">
                {confirmar.tardeos > 0
                  ? `Tiene ${confirmar.tardeos} ${confirmar.tardeos === 1 ? "tardeo" : "tardeos"}. Al borrar la ficha SE BORRAN TAMBIÉN TODOS, con sus inscripciones y favoritos.`
                  : confirmar.tardeos === 0 ? "No tiene tardeos." : "No se pudo contar cuántos tardeos tiene: si tiene, se borrarán con ella."}
                {" "}No se puede deshacer. Si solo quieres que no se vea, mejor ocúltala.
              </p>
            )}
            <Boton variante="peligro" ancho cargando={obrando === confirmar.f.id} disabled={confirmar.tardeos === null}
              onClick={() => eliminar(confirmar.f)}>
              {confirmar.tardeos && confirmar.tardeos > 0 && !esDj ? `Sí, eliminar la ficha y sus ${confirmar.tardeos} tardeos` : "Sí, eliminar para siempre"}
            </Boton>
            <Boton variante="contorno" ancho disabled={!!obrando} onClick={() => setConfirmar(null)}>No, volver</Boton>
          </div>
        )}
      </Hoja>
    </SeccionPanel>
  );
}
