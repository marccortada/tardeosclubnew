"use client";
import { enlacePropio } from "@/lib/volver";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, useDiferido, Buscador, Filtros, EstadoLista } from "@/components/panel/Paginacion";
import Hoja from "@/components/ui/Hoja";
import Boton, { claseBoton } from "@/components/Boton";
import Aviso from "@/components/admin/Aviso";
import { Etiqueta } from "@/components/ui/Chip";
import { claseCampo } from "@/components/ui/Campo";
import PanelFiltros, { CampoFiltro, claseFiltro, RangoFechas } from "@/components/panel/PanelFiltros";
import { rangoTimestamp } from "@/lib/filtrosLista";
import { Mail, MessageCircle, ExternalLink, UserRound, ChevronRight } from "lucide-react";
import { MARCA } from "@/lib/marca";

/**
 * Bandeja de lo que la gente avisa con «¿Algo no funciona?» (lote 57).
 *
 * El flujo es el de una bandeja de soporte mínima: llega «abierta», el admin
 * la pasa a «en curso» cuando se pone con ello y a «resuelta» al cerrarla. La
 * nota interna es para el equipo (la persona no la ve). Contestar se hace por
 * email o WhatsApp con el mensaje medio escrito: no se envía nada desde aquí.
 */
type Estado = "abierta" | "en_curso" | "resuelta";
type Filtro = Estado | "todas";
type Fila = {
  id: string;
  profile_id: string | null;
  email_contacto: string | null;
  rol: string;
  tipo: "error" | "duda" | "sugerencia" | "otro";
  mensaje: string;
  url: string | null;
  user_agent: string | null;
  estado: Estado;
  nota_admin: string | null;
  created_at: string;
  resuelta_en: string | null;
};
type Perfil = { display_name: string | null; email: string | null; phone: string | null };

const NO_EXISTE = new Set(["42P01", "PGRST205", "PGRST204", "42703"]);
const ESTADOS: { clave: Estado; label: string; tono: "error" | "aviso" | "ok" }[] = [
  { clave: "abierta", label: "Abierta", tono: "error" },
  { clave: "en_curso", label: "En curso", tono: "aviso" },
  { clave: "resuelta", label: "Resuelta", tono: "ok" },
];
const TIPO: Record<Fila["tipo"], string> = { error: "Algo falla", duda: "Duda", sugerencia: "Sugerencia", otro: "Otra cosa" };
const ROL: Record<string, string> = { tardicola: "Tardícola", local: "Local", dj: "DJ", admin: "Admin", anonimo: "Sin cuenta" };

/** Quita lo que rompe la sintaxis de los filtros de PostgREST. */
const limpiar = (s: string) => s.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();

/** «hace 5 min», «hace 3 h», «12 oct». */
function hace(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (min < 24 * 60) return `hace ${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" });
}
const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" });

/** Solo la ruta de la URL: el dominio es siempre el nuestro. */
const ruta = (url: string | null) => {
  if (!url) return null;
  try { const u = new URL(url); return u.pathname + u.search; } catch { return url; }
};

/** Navegador y sistema en dos palabras, para no pegar el user-agent entero. */
function navegador(ua: string | null): string {
  if (!ua) return "Desconocido";
  const so = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const nav = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Otro";
  return [nav, so].filter(Boolean).join(" · ");
}

/** Teléfono a formato wa.me: sin espacios ni +; si son 9 cifras, España. */
function telWhatsapp(tel: string | null): string | null {
  const d = (tel ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (d.length === 9) return "34" + d;
  return d.length >= 10 ? d : null;
}

export default function AdminIncidencias() {
  const [filtro, setFiltro] = useState<Filtro>("abierta");
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  const [cuentas, setCuentas] = useState<Partial<Record<Filtro, number | null>>>({});
  const [abierta, setAbierta] = useState<Fila | null>(null);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  // Filtros plegables (en el servidor, como la búsqueda).
  const [tipo, setTipo] = useState("");
  const [rol, setRol] = useState("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const activos = [tipo, rol, fDesde, fHasta].filter(Boolean).length;
  const limpiarFiltros = () => { setTipo(""); setRol(""); setFDesde(""); setFHasta(""); };

  const p = usePaginado<Fila>((desde, hasta) => {
    let q = supabase.from("incidencias")
      .select("id,profile_id,email_contacto,rol,tipo,mensaje,url,user_agent,estado,nota_admin,created_at,resuelta_en", { count: "exact" });
    if (filtro !== "todas") q = q.eq("estado", filtro);
    if (tipo) q = q.eq("tipo", tipo);
    if (rol) q = q.eq("rol", rol);
    q = rangoTimestamp(q, "created_at", fDesde, fHasta);
    const b = limpiar(busca);
    if (b) q = q.or(`mensaje.ilike.*${b}*,email_contacto.ilike.*${b}*,url.ilike.*${b}*`);
    return q.order("created_at", { ascending: filtro === "abierta" }).order("id").range(desde, hasta);
  }, [filtro, busca, tipo, rol, fDesde, fHasta]);

  const contar = useCallback(() => {
    const n = (e?: Estado) => {
      let q = supabase.from("incidencias").select("id", { count: "exact", head: true });
      if (e) q = q.eq("estado", e);
      return q.then((r) => (r.error ? null : r.count));
    };
    Promise.all([n("abierta"), n("en_curso"), n("resuelta"), n()]).then(([a, c, r, t]) =>
      setCuentas({ abierta: a, en_curso: c, resuelta: r, todas: t }));
  }, []);
  useEffect(() => { contar(); }, [contar]);

  const falta57 = !!p.error && /does not exist|could not find|schema cache/i.test(p.error);

  /** Tras guardar en la hoja: refresca la fila (o la quita si ya no encaja en el filtro). */
  const alGuardar = (f: Fila, texto: string) => {
    if (filtro !== "todas" && f.estado !== filtro) p.quitar((x) => x.id === f.id);
    else p.cambiar((x) => x.id === f.id, f);
    setAbierta(f);
    setAviso({ tono: "ok", texto });
    contar();
  };

  return (
    <SeccionPanel
      titulo="Incidencias"
      descripcion="Lo que la gente avisa desde «¿Algo no funciona?». Las abiertas, primero las más antiguas."
      ancho="ancho"
    >
      <div className="mb-4 flex flex-col gap-3">
        <Buscador valor={texto} onCambiar={setTexto} placeholder="Buscar en el mensaje, email o página…" />
        <PanelFiltros clave="admin-incidencias" activos={activos} onLimpiar={limpiarFiltros}>
          <CampoFiltro etiqueta="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={claseFiltro}>
              <option value="">Todos</option>
              {(Object.entries(TIPO) as [Fila["tipo"], string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </CampoFiltro>
          <CampoFiltro etiqueta="Quién avisa">
            <select value={rol} onChange={(e) => setRol(e.target.value)} className={claseFiltro}>
              <option value="">Todos</option>
              {Object.entries(ROL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </CampoFiltro>
          <RangoFechas desde={fDesde} hasta={fHasta} onDesde={setFDesde} onHasta={setFHasta} etiqueta="Recibida" />
        </PanelFiltros>
        <Filtros<Filtro>
          valor={filtro}
          onCambiar={setFiltro}
          opciones={[
            { clave: "abierta", label: "Abiertas", n: cuentas.abierta },
            { clave: "en_curso", label: "En curso", n: cuentas.en_curso },
            { clave: "resuelta", label: "Resueltas", n: cuentas.resuelta },
            { clave: "todas", label: "Todas", n: cuentas.todas },
          ]}
        />
      </div>

      <div aria-live="polite">{aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}</div>

      {falta57 ? (
        <Aviso tono="aviso">Falta pegar el lote 57 (supabase/57_incidencias_y_errores.sql) en Supabase. Hasta entonces no se guardan los avisos.</Aviso>
      ) : (
        <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length}
          vacio={busca || activos ? "Ningún aviso con esa búsqueda o filtros." : filtro === "abierta" ? "No hay avisos abiertos. Todo al día." : "No hay avisos aquí."} />
      )}

      {p.filas.length > 0 && (
        <ul className={`divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-white ${p.cargando ? "opacity-60" : ""}`}>
          {p.filas.map((f) => {
            const e = ESTADOS.find((x) => x.clave === f.estado);
            return (
              <li key={f.id}>
                <button type="button" onClick={() => { setAviso(null); setAbierta(f); }}
                  className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-marfil">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {filtro === "todas" && e && <Etiqueta tono={e.tono}>{e.label}</Etiqueta>}
                      <Etiqueta tono={f.tipo === "error" ? "marca" : "neutro"}>{TIPO[f.tipo] ?? f.tipo}</Etiqueta>
                      <span className="text-sm text-tinta-suave">{ROL[f.rol] ?? f.rol} · {hace(f.created_at)}</span>
                    </span>
                    <span className="mt-1.5 line-clamp-2 block text-[15px] font-semibold text-tinta">{f.mensaje}</span>
                    <span className="mt-1 block truncate text-sm text-tinta-suave">
                      {[f.email_contacto ?? "Sin email", ruta(f.url)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <ChevronRight size={20} className="mt-1 shrink-0 text-tinta-suave" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />

      {abierta && <Detalle key={abierta.id} f={abierta} onCerrar={() => setAbierta(null)} onGuardado={alGuardar} />}
    </SeccionPanel>
  );
}

function Detalle({ f, onCerrar, onGuardado }: { f: Fila; onCerrar: () => void; onGuardado: (f: Fila, texto: string) => void }) {
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(f.profile_id ? undefined : null);
  const [nota, setNota] = useState(f.nota_admin ?? "");
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!f.profile_id) return;
    supabase.from("profiles").select("display_name,email,phone").eq("id", f.profile_id).maybeSingle()
      .then(({ data }) => setPerfil(data ?? null));
  }, [f.profile_id]);

  const guardar = async (cambio: Partial<Pick<Fila, "estado" | "nota_admin">>, que: string, ok: string) => {
    setGuardando(que); setError("");
    const { data, error: e } = await supabase.from("incidencias").update(cambio).eq("id", f.id)
      .select("id,estado,nota_admin,resuelta_en");
    setGuardando(null);
    if (e) { setError(NO_EXISTE.has(e.code ?? "") ? "Falta pegar el lote 57." : "No se pudo guardar: " + e.message); return; }
    if (!data?.length) { setError("La base no aceptó el cambio (¿sesión caducada?). No se ha modificado nada."); return; }
    onGuardado({ ...f, ...data[0] } as Fila, ok);
  };

  const email = f.email_contacto ?? perfil?.email ?? null;
  const tel = telWhatsapp(perfil?.phone ?? null);
  const nombre = perfil?.display_name?.trim() || "";
  const saludo = `Hola${nombre ? ` ${nombre.split(" ")[0]}` : ""}, te escribimos de ${MARCA.nombre} por el aviso que nos mandaste`;
  const cita = f.mensaje.split("\n— Error:")[0].slice(0, 300);
  const mailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(`Tu aviso en ${MARCA.nombre}`)}&body=${encodeURIComponent(`${saludo}:\n\n«${cita}»\n\n`)}`
    : null;
  const wa = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(`${saludo}: «${cita}». `)}` : null;
  const cambioNota = (nota.trim() || null) !== (f.nota_admin ?? null);

  return (
    <Hoja abierta onCerrar={onCerrar} titulo={TIPO[f.tipo] ?? "Aviso"}>
      <div className="flex flex-col gap-5">
        <div>
          <p className="whitespace-pre-wrap break-words text-[16px] leading-relaxed">{f.mensaje}</p>
          <p className="mt-2 text-sm text-tinta-suave">{fechaLarga(f.created_at)}{f.resuelta_en ? ` · resuelta el ${fechaLarga(f.resuelta_en)}` : ""}</p>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-marfil p-4 text-[15px]">
          <dt className="text-tinta-suave">Quién</dt>
          <dd className="min-w-0 break-words font-semibold">
            {perfil === undefined ? "…" : nombre || (f.profile_id ? "Usuario sin nombre" : "Sin cuenta")} <span className="font-normal text-tinta-suave">({ROL[f.rol] ?? f.rol})</span>
          </dd>
          <dt className="text-tinta-suave">Email</dt>
          <dd className="min-w-0 break-all font-semibold">{email ?? "No lo dejó"}</dd>
          {perfil?.phone && (<><dt className="text-tinta-suave">Teléfono</dt><dd className="font-semibold">{perfil.phone}</dd></>)}
          <dt className="text-tinta-suave">Página</dt>
          <dd className="min-w-0 break-all">
            {f.url ? (
              enlacePropio(f.url) ? (<a href={enlacePropio(f.url)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-magenta-700 underline underline-offset-2">
                {ruta(f.url)} <ExternalLink size={14} aria-hidden />
              </a>) : <span className="break-all">{f.url}</span>
            ) : "—"}
          </dd>
          <dt className="text-tinta-suave">Navegador</dt>
          <dd className="min-w-0" title={f.user_agent ?? undefined}>{navegador(f.user_agent)}</dd>
        </dl>

        {f.profile_id && (
          <Link href={`/admin/usuarios/${f.profile_id}`} className={claseBoton("contorno", "pequeno", true)}>
            <UserRound size={18} aria-hidden /> Ver su ficha de usuario
          </Link>
        )}

        <div>
          <p className="mb-1.5 text-[15px] font-semibold">Contestar</p>
          {mailto || wa ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {mailto && <a href={mailto} className={claseBoton("suave", "pequeno", true)}><Mail size={18} aria-hidden /> Por email</a>}
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={claseBoton("suave", "pequeno", true)}><MessageCircle size={18} aria-hidden /> Por WhatsApp</a>}
            </div>
          ) : (
            <p className="text-[15px] text-tinta-suave">No dejó ni email ni teléfono: no hay forma de contestarle.</p>
          )}
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[15px] font-semibold">Estado</legend>
          <div className="grid grid-cols-3 gap-2">
            {ESTADOS.map((e) => (
              <button key={e.clave} type="button" aria-pressed={f.estado === e.clave} disabled={!!guardando || f.estado === e.clave}
                onClick={() => guardar({ estado: e.clave }, e.clave, `Marcada como «${e.label.toLowerCase()}».`)}
                className={`min-h-[44px] rounded-xl border px-2 text-[15px] font-semibold transition-colors disabled:cursor-default ${
                  f.estado === e.clave ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-white hover:bg-marfil disabled:opacity-50"}`}>
                {guardando === e.clave ? "Guardando…" : e.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="nota-admin" className="mb-1.5 block text-[15px] font-semibold">Nota interna</label>
          <textarea id="nota-admin" rows={3} maxLength={4000} value={nota} onChange={(e) => setNota(e.target.value)}
            placeholder="Solo la ve el equipo: qué se ha hecho, a quién se ha pasado…" className={claseCampo} />
          <Boton variante="contorno" tamano="pequeno" className="mt-2" disabled={!cambioNota} cargando={guardando === "nota"}
            onClick={() => guardar({ nota_admin: nota.trim() || null }, "nota", "Nota guardada.")}>
            Guardar nota
          </Boton>
        </div>

        {error && <p role="alert" className="rounded-xl bg-error-fondo p-4 text-[15px] font-semibold text-error">{error}</p>}
      </div>
    </Hoja>
  );
}
