"use client";
import { enlacePropio } from "@/lib/volver";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, useDiferido, Buscador, Filtros, EstadoLista } from "@/components/panel/Paginacion";
import Hoja from "@/components/ui/Hoja";
import Boton from "@/components/Boton";
import Aviso from "@/components/admin/Aviso";
import { Etiqueta } from "@/components/ui/Chip";
import { Trash2, ChevronRight, Monitor, Server, CheckCircle2, RotateCcw } from "lucide-react";

/**
 * Errores que saltan solos (lote 57, tabla `errores_app`): pantallas que
 * revientan en el navegador y fallos que el servidor apunta con `registrar`.
 *
 * Agrupados por huella: el mismo fallo repetido es una fila con su contador.
 * Así se ve de un vistazo qué pasa MÁS, no qué pasó lo último. Al arreglar uno
 * se marca resuelto; si vuelve a salir, se reabre solo.
 */
type Filtro = "pendientes" | "cliente" | "servidor" | "24h" | "resueltos";
type Fila = {
  id: string;
  huella: string;
  mensaje: string;
  pila: string | null;
  url: string | null;
  ruta: string | null;
  origen: "cliente" | "servidor";
  user_agent: string | null;
  profile_id: string | null;
  veces: number;
  resuelto: boolean;
  primera_vez: string;
  ultima_vez: string;
};

const limpiar = (s: string) => s.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();
const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
function hace(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (min < 24 * 60) return `hace ${Math.round(min / 60)} h`;
  return fecha(iso);
}
const hace24h = () => new Date(Date.now() - 86_400_000).toISOString();

export default function AdminErrores() {
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  const [cuentas, setCuentas] = useState<Partial<Record<Filtro, number | null>>>({});
  const [detalle, setDetalle] = useState<Fila | null>(null);
  const [borrar, setBorrar] = useState<{ error?: string } | null>(null);
  const [obrando, setObrando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  const p = usePaginado<Fila>((desde, hasta) => {
    let q = supabase.from("errores_app")
      .select("id,huella,mensaje,pila,url,ruta,origen,user_agent,profile_id,veces,resuelto,primera_vez,ultima_vez", { count: "exact" });
    if (filtro === "resueltos") q = q.eq("resuelto", true);
    else q = q.eq("resuelto", false);
    if (filtro === "cliente" || filtro === "servidor") q = q.eq("origen", filtro);
    if (filtro === "24h") q = q.gte("ultima_vez", hace24h());
    const b = limpiar(busca);
    if (b) q = q.or(`mensaje.ilike.*${b}*,ruta.ilike.*${b}*`);
    return q.order("ultima_vez", { ascending: false }).range(desde, hasta);
  }, [filtro, busca]);

  const contar = useCallback(() => {
    const base = () => supabase.from("errores_app").select("id", { count: "exact", head: true });
    const n = (q: PromiseLike<{ count: number | null; error: unknown }>) => Promise.resolve(q).then((r) => (r.error ? null : r.count));
    Promise.all([
      n(base().eq("resuelto", false)),
      n(base().eq("resuelto", false).eq("origen", "cliente")),
      n(base().eq("resuelto", false).eq("origen", "servidor")),
      n(base().eq("resuelto", false).gte("ultima_vez", hace24h())),
      n(base().eq("resuelto", true)),
    ]).then(([pendientes, cliente, servidor, h24, resueltos]) => setCuentas({ pendientes, cliente, servidor, "24h": h24, resueltos }));
  }, []);
  useEffect(() => { contar(); }, [contar]);

  const falta57 = !!p.error && /does not exist|could not find|schema cache/i.test(p.error);

  const marcar = async (f: Fila, resuelto: boolean) => {
    setObrando(f.id); setAviso(null);
    const { data, error } = await supabase.from("errores_app").update({ resuelto }).eq("id", f.id).select("id");
    setObrando(null);
    if (error || !data?.length) {
      setAviso({ tono: "error", texto: error ? "No se pudo guardar: " + error.message : "La base no aceptó el cambio (¿sesión caducada?)." });
      return;
    }
    // Cambia de pestaña (pendientes ↔ resueltos): se quita de la lista actual.
    p.quitar((x) => x.id === f.id);
    setDetalle(null);
    setAviso({ tono: "ok", texto: resuelto ? "Marcado como resuelto. Si vuelve a salir, se reabre solo." : "Reabierto." });
    contar();
  };

  const borrarResueltos = async () => {
    setObrando("borrar");
    const { data, error } = await supabase.from("errores_app").delete().eq("resuelto", true).select("id");
    setObrando(null);
    if (error) { setBorrar({ error: "No se pudo borrar: " + error.message }); return; }
    setBorrar(null);
    setAviso({ tono: "ok", texto: `${data?.length ?? 0} ${data?.length === 1 ? "error resuelto borrado" : "errores resueltos borrados"}.` });
    p.recargar(); contar();
  };

  return (
    <SeccionPanel
      titulo="Errores"
      descripcion="Fallos que saltan solos en la web y en el servidor, agrupados. Los que más se repiten, arriba en cuanto vuelven a salir."
      acciones={
        <Boton variante="contorno" tamano="pequeno" disabled={!cuentas.resueltos} onClick={() => setBorrar({})}>
          <Trash2 size={18} aria-hidden /> Borrar resueltos{cuentas.resueltos ? ` (${cuentas.resueltos})` : ""}
        </Boton>
      }
      ancho="ancho"
    >
      <div className="mb-4 flex flex-col gap-3">
        <Buscador valor={texto} onCambiar={setTexto} placeholder="Buscar en el mensaje o la ruta…" />
        <Filtros<Filtro>
          valor={filtro}
          onCambiar={setFiltro}
          opciones={[
            { clave: "pendientes", label: "Sin resolver", n: cuentas.pendientes },
            { clave: "cliente", label: "Navegador", n: cuentas.cliente },
            { clave: "servidor", label: "Servidor", n: cuentas.servidor },
            { clave: "24h", label: "Últimas 24 h", n: cuentas["24h"] },
            { clave: "resueltos", label: "Resueltos", n: cuentas.resueltos },
          ]}
        />
      </div>

      <div aria-live="polite">{aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}</div>

      {falta57 ? (
        <Aviso tono="aviso">Falta pegar el lote 57 (supabase/57_incidencias_y_errores.sql) en Supabase. Hasta entonces no se guardan los errores.</Aviso>
      ) : (
        <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length}
          vacio={busca ? "Ningún error con esa búsqueda." : filtro === "resueltos" ? "No hay errores resueltos guardados." : "Ningún error por aquí. Buena señal."} />
      )}

      {p.filas.length > 0 && (
        <ul className={`divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-white ${p.cargando ? "opacity-60" : ""}`}>
          {p.filas.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => setDetalle(f)} className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-marfil">
                <span className={`grid h-11 min-w-[44px] shrink-0 place-items-center rounded-xl px-2 text-[15px] font-extrabold tabular-nums ${
                  f.veces >= 10 ? "bg-error-fondo text-error" : "bg-marfil-100 text-tinta"}`} aria-label={`${f.veces} veces`}>
                  ×{f.veces > 999 ? "999+" : f.veces}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block break-words font-mono text-[14px] font-semibold text-tinta">{f.mensaje}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-tinta-suave">
                    <Etiqueta tono={f.origen === "servidor" ? "marca" : "neutro"}>
                      {f.origen === "servidor" ? <Server size={13} aria-hidden /> : <Monitor size={13} aria-hidden />}
                      {f.origen === "servidor" ? "Servidor" : "Navegador"}
                    </Etiqueta>
                    {f.ruta && <span className="truncate font-mono">{f.ruta}</span>}
                    <span>· última {hace(f.ultima_vez)}</span>
                  </span>
                </span>
                <ChevronRight size={20} className="mt-3 shrink-0 text-tinta-suave" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />

      {detalle && (
        <Hoja abierta onCerrar={() => setDetalle(null)} titulo={detalle.origen === "servidor" ? "Error del servidor" : "Error en el navegador"}
          pie={
            <Boton ancho variante={detalle.resuelto ? "contorno" : "primario"} cargando={obrando === detalle.id} onClick={() => marcar(detalle, !detalle.resuelto)}>
              {detalle.resuelto ? <><RotateCcw size={18} aria-hidden /> Reabrir</> : <><CheckCircle2 size={18} aria-hidden /> Marcar como resuelto</>}
            </Boton>
          }>
          <div className="flex flex-col gap-4">
            <p className="break-words font-mono text-[14px] font-semibold leading-relaxed">{detalle.mensaje}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-marfil p-4 text-[15px]">
              <dt className="text-tinta-suave">Veces</dt><dd className="font-semibold">{detalle.veces.toLocaleString("es-ES")}</dd>
              <dt className="text-tinta-suave">Primera vez</dt><dd>{fecha(detalle.primera_vez)}</dd>
              <dt className="text-tinta-suave">Última vez</dt><dd>{fecha(detalle.ultima_vez)}</dd>
              <dt className="text-tinta-suave">Ruta</dt><dd className="min-w-0 break-all font-mono text-[14px]">{detalle.ruta ?? "—"}</dd>
              {detalle.url && (<><dt className="text-tinta-suave">Último caso</dt>
                <dd className="min-w-0 break-all">{enlacePropio(detalle.url) ? (<a href={enlacePropio(detalle.url)!} target="_blank" rel="noopener noreferrer" className="font-semibold text-magenta-700 underline underline-offset-2">{detalle.url}</a>) : <span>{detalle.url}</span>}</dd></>)}
              {detalle.user_agent && (<><dt className="text-tinta-suave">Navegador</dt><dd className="min-w-0 break-words text-[14px]">{detalle.user_agent}</dd></>)}
            </dl>
            {detalle.pila ? (
              <details>
                <summary className="min-h-[44px] cursor-pointer content-center text-[15px] font-semibold">Ver la pila (para el programador)</summary>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-tinta p-3 font-mono text-[12px] leading-relaxed text-white">{detalle.pila}</pre>
              </details>
            ) : (
              <p className="text-[15px] text-tinta-suave">Sin pila: el error no la traía.</p>
            )}
          </div>
        </Hoja>
      )}

      <Hoja abierta={!!borrar} onCerrar={() => setBorrar(null)} titulo="Borrar errores resueltos"
        pie={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Boton ancho variante="peligro" cargando={obrando === "borrar"} onClick={borrarResueltos}>Borrar {cuentas.resueltos ?? ""}</Boton>
            <Boton ancho variante="contorno" onClick={() => setBorrar(null)}>Cancelar</Boton>
          </div>
        }>
        <p className="text-[16px]">
          Se borran para siempre los <b>{cuentas.resueltos ?? 0}</b> errores marcados como resueltos. Los que sigan sin resolver no se tocan.
        </p>
        {borrar?.error && <p role="alert" className="mt-3 rounded-xl bg-error-fondo p-4 text-[15px] font-semibold text-error">{borrar.error}</p>}
      </Hoja>
    </SeccionPanel>
  );
}
