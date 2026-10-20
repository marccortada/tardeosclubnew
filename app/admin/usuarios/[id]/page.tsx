"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { Etiqueta } from "@/components/ui/Chip";
import Hoja from "@/components/ui/Hoja";
import Boton, { claseBoton } from "@/components/Boton";
import Aviso from "@/components/admin/Aviso";
import AsignarDueno from "@/components/AsignarDueno";
import { claseCampo } from "@/components/ui/Campo";
import { Filtros } from "@/components/panel/Paginacion";
import {
  ArrowLeft, Shield, Store, Megaphone, Disc3, User, Mail, Phone, KeyRound, Trash2, Copy, Check,
  MessageCircle, Link2, Ticket, Heart, Star, Sparkles, ExternalLink, Pencil, Plus, Loader2, Search,
} from "lucide-react";

type Perfil = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  is_admin: boolean;
  created_at: string;
  acepta_ofertas?: boolean | null;
  acepta_ofertas_en?: string | null;
  musica?: string[] | null;
  ambiente?: string[] | null;
  tipos_evento?: string[] | null;
  dress_codes?: string[] | null;
  zonas?: string[] | null;
  publico?: string | null;
  precio_max?: string | null;
  adn_en?: string | null;
};
type Acceso = { existe: boolean; last_sign_in_at?: string | null; email_confirmed_at?: string | null; proveedores?: string[]; favoritos_total?: number | null };
type Ficha = { id: string; nombre: string; tipo: "local" | "promotor" | "dj"; estado: string | null };
type TardeoMini = { id: string; titulo: string; fecha: string } | null;
type Inscripcion = { id: string; estado: string; created_at: string; asistencia?: string | null; tardeo: TardeoMini };
type Favorito = { tardeo_id: string; created_at?: string | null; tardeo: TardeoMini };
type Resena = { id: string; objetivo_tipo: "local" | "dj"; objetivo_id: string; puntuacion: number; comentario: string | null; estado: string; created_at: string };
type Candidata = { id: string; nombre: string; tipo: "local" | "promotor" | "dj"; conDueno: boolean; esSuya: boolean };
type Accion = { tipo: "clave" } | { tipo: "borrar"; paso: 1 | 2 } | { tipo: "asignar" };
type Res<T> = { data: T[] | null; count: number | null; error: { message: string; code?: string } | null };

const PASO = 20;

/**
 * Estados de `inscripciones.estado` (lote 64 añadió 'espera'). Antes todo lo
 * que no era «cancelado» salía como «Apuntado», y uno en lista de espera
 * parecía tener plaza.
 */
type FiltroInscripcion = "todas" | "apuntado" | "espera" | "cancelado";
const ESTADO_INSCRIPCION: Record<string, { t: string; tono: "ok" | "aviso" | "error" }> = {
  apuntado: { t: "Confirmado", tono: "ok" },
  espera: { t: "En espera", tono: "aviso" },
  cancelado: { t: "Cancelado", tono: "error" },
};
const COLS_PERFIL = "id,display_name,email,phone,is_admin,created_at,acepta_ofertas,acepta_ofertas_en,musica,ambiente,tipos_evento,dress_codes,zonas,publico,precio_max,adn_en";
const limpiar = (s: string) => s.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();

const fechaHora = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
const fechaDia = (iso?: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Mensaje claro cuando la base no deja leer algo al admin (RLS). */
function textoError(e: { message: string; code?: string }) {
  if (e.code === "42501" || /permission|row-level|policy/i.test(e.message)) {
    return "La base de datos no deja al admin leer esto (permisos RLS). Hay que darle permiso de lectura por SQL.";
  }
  return `No se pudo cargar: ${e.message}`;
}

/** Teléfono para wa.me: solo dígitos y, si es un móvil español sin prefijo, con 34 delante. */
function telWhatsApp(tel: string) {
  const d = tel.replace(/\D/g, "").replace(/^00/, "");
  return d.length === 9 && /^[6789]/.test(d) ? `34${d}` : d;
}

/**
 * Lista "limitada a 20 con ver más": pide las primeras `limite` filas con su
 * total y, al pulsar «Ver más», 20 más. Para la actividad de un usuario es
 * más cómodo que paginar: casi siempre son pocas y se leen de un vistazo.
 */
function useListaCreciente<T>(consulta: (hasta: number) => PromiseLike<Res<T>>, deps: unknown[]) {
  const [limite, setLimite] = useState(PASO);
  const [filas, setFilas] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const clave = JSON.stringify(deps);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    Promise.resolve(consulta(limite - 1)).then(({ data, count, error }) => {
      if (!vivo) return;
      if (error) { setError(textoError(error)); setFilas([]); setTotal(0); }
      else { setError(null); setFilas(data ?? []); setTotal(count ?? data?.length ?? 0); }
      setCargando(false);
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limite, clave]);

  return { filas, total, cargando, error, verMas: () => setLimite((l) => l + PASO), hayMas: filas.length < total };
}

export default function FichaUsuario() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errPerfil, setErrPerfil] = useState<string | null>(null);
  const [acceso, setAcceso] = useState<Acceso | null>(null);
  const [errAcceso, setErrAcceso] = useState<string | null>(null);
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [errFichas, setErrFichas] = useState<string | null>(null);
  const [versionFichas, setVersionFichas] = useState(0);

  const [accion, setAccion] = useState<Accion | null>(null);
  const [obrando, setObrando] = useState(false);
  const [errHoja, setErrHoja] = useState("");
  const [confirmaTexto, setConfirmaTexto] = useState("");
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Asignar ficha
  const [buscaFicha, setBuscaFicha] = useState("");
  const [candidatas, setCandidatas] = useState<Candidata[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [elegida, setElegida] = useState<Candidata | null>(null);

  // Perfil
  useEffect(() => {
    let vivo = true;
    (async () => {
      setCargando(true);
      let r = await supabase.from("profiles").select(COLS_PERFIL).eq("id", id).maybeSingle();
      // Si falta alguna columna nueva (lote sin pegar), al menos lo básico.
      if (r.error?.code === "42703") r = await supabase.from("profiles").select("id,display_name,email,phone,is_admin,created_at").eq("id", id).maybeSingle();
      if (!vivo) return;
      if (r.error) setErrPerfil(textoError(r.error));
      else setPerfil(r.data as Perfil | null);
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, [id]);

  // Datos de acceso (auth.users) por la ruta de servidor.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const pedir = (tok?: string) => fetch(`/api/admin/usuario/${id}`, { headers: { Authorization: `Bearer ${tok ?? ""}` } });
      try {
        const { data: s } = await supabase.auth.getSession();
        let res = await pedir(s.session?.access_token);
        // El token guardado puede haber caducado sin refrescarse aún: se renueva y se reintenta una vez.
        if (res.status === 401) {
          const { data: r } = await supabase.auth.refreshSession();
          res = await pedir(r.session?.access_token);
        }
        const j = await res.json().catch(() => ({}));
        if (!vivo) return;
        if (res.status === 401) setErrAcceso("Tu sesión ha caducado: sal y vuelve a entrar para ver este dato.");
        else if (!res.ok) setErrAcceso(j.error || `Error ${res.status}`);
        else setAcceso(j as Acceso);
      } catch {
        if (vivo) setErrAcceso("Sin conexión con el servidor.");
      }
    })();
    return () => { vivo = false; };
  }, [id]);

  // Fichas: sin clave ajena declarada hacia profiles, se pregunta por owner_id / profile_id.
  useEffect(() => {
    let vivo = true;
    Promise.all([
      supabase.from("locales").select("id,nombre,tipo,estado").eq("owner_id", id).order("nombre"),
      supabase.from("djs").select("id,nombre_artistico,oculto").eq("profile_id", id).order("nombre_artistico"),
    ]).then(([l, d]) => {
      if (!vivo) return;
      const e = l.error || d.error;
      setErrFichas(e ? textoError(e) : null);
      setFichas([
        ...((l.data ?? []) as { id: string; nombre: string; tipo: string | null; estado: string | null }[])
          .map((x): Ficha => ({ id: x.id, nombre: x.nombre, tipo: x.tipo === "promotor" ? "promotor" : "local", estado: x.estado })),
        ...((d.data ?? []) as { id: string; nombre_artistico: string; oculto: boolean | null }[])
          .map((x): Ficha => ({ id: x.id, nombre: x.nombre_artistico, tipo: "dj", estado: x.oculto ? "oculto" : null })),
      ]);
    });
    return () => { vivo = false; };
  }, [id, versionFichas]);

  // Inscripciones. `asistencia` llega con el lote 48; si aún no está, se pide sin ella.
  // El filtro por estado va en la consulta (no se filtra lo ya cargado).
  const [filtroIns, setFiltroIns] = useState<FiltroInscripcion>("todas");
  const inscripciones = useListaCreciente<Inscripcion>(async (hasta) => {
    const pedir = (cols: string) => {
      let q = supabase.from("inscripciones").select(cols, { count: "exact" }).eq("profile_id", id);
      if (filtroIns !== "todas") q = q.eq("estado", filtroIns);
      return q.order("created_at", { ascending: false }).range(0, hasta);
    };
    let r = await pedir("id,estado,created_at,asistencia,tardeo:tardeos(id,titulo,fecha)");
    if (r.error?.code === "42703") r = await pedir("id,estado,created_at,tardeo:tardeos(id,titulo,fecha)");
    return r as unknown as Res<Inscripcion>;
  }, [id, filtroIns]);

  const favoritos = useListaCreciente<Favorito>((hasta) =>
    supabase.from("favoritos").select("tardeo_id,created_at,tardeo:tardeos(id,titulo,fecha)", { count: "exact" })
      .eq("profile_id", id).order("created_at", { ascending: false }).range(0, hasta) as unknown as PromiseLike<Res<Favorito>>, [id]);

  const resenas = useListaCreciente<Resena>((hasta) =>
    supabase.from("resenas").select("id,objetivo_tipo,objetivo_id,puntuacion,comentario,estado,created_at", { count: "exact" })
      .eq("autor_profile_id", id).order("created_at", { ascending: false }).range(0, hasta) as unknown as PromiseLike<Res<Resena>>, [id]);

  // Nombres de lo reseñado (objetivo_id no tiene clave ajena: va a locales o a djs).
  const [nombresResenas, setNombresResenas] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const loc = resenas.filas.filter((r) => r.objetivo_tipo === "local").map((r) => r.objetivo_id);
    const dj = resenas.filas.filter((r) => r.objetivo_tipo === "dj").map((r) => r.objetivo_id);
    if (!loc.length && !dj.length) return;
    Promise.all([
      loc.length ? supabase.from("locales").select("id,nombre").in("id", loc) : Promise.resolve({ data: [] }),
      dj.length ? supabase.from("djs").select("id,nombre_artistico").in("id", dj) : Promise.resolve({ data: [] }),
    ]).then(([l, d]) => {
      const m = new Map<string, string>();
      ((l.data ?? []) as { id: string; nombre: string }[]).forEach((x) => m.set(x.id, x.nombre));
      ((d.data ?? []) as { id: string; nombre_artistico: string }[]).forEach((x) => m.set(x.id, x.nombre_artistico));
      setNombresResenas(m);
    });
  }, [resenas.filas]);

  // Búsqueda de fichas para asignar (con retardo, para no consultar en cada tecla).
  useEffect(() => {
    if (accion?.tipo !== "asignar") return;
    const l = limpiar(buscaFicha);
    if (l.length < 2) return;
    let vivo = true;
    const t = setTimeout(async () => {
      setBuscando(true);
      const [lo, dj] = await Promise.all([
        supabase.from("locales").select("id,nombre,tipo,owner_id").ilike("nombre", `%${l}%`).order("nombre").limit(8),
        supabase.from("djs").select("id,nombre_artistico,profile_id").ilike("nombre_artistico", `%${l}%`).order("nombre_artistico").limit(8),
      ]);
      if (!vivo) return;
      setBuscando(false);
      if (lo.error || dj.error) { setErrHoja(textoError((lo.error || dj.error)!)); setCandidatas([]); return; }
      setCandidatas([
        ...((lo.data ?? []) as { id: string; nombre: string; tipo: string | null; owner_id: string | null }[]).map((x): Candidata => ({
          id: x.id, nombre: x.nombre, tipo: x.tipo === "promotor" ? "promotor" : "local", conDueno: !!x.owner_id, esSuya: x.owner_id === id,
        })),
        ...((dj.data ?? []) as { id: string; nombre_artistico: string; profile_id: string | null }[]).map((x): Candidata => ({
          id: x.id, nombre: x.nombre_artistico, tipo: "dj", conDueno: !!x.profile_id, esSuya: x.profile_id === id,
        })),
      ]);
    }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [buscaFicha, accion?.tipo, id]);

  const recargarFichas = useCallback(() => setVersionFichas((v) => v + 1), []);

  const cerrar = () => {
    if (obrando) return;
    setAccion(null); setErrHoja(""); setConfirmaTexto("");
    setBuscaFicha(""); setCandidatas(null); setElegida(null);
  };
  const abrir = (a: Accion) => { setAviso(null); setErrHoja(""); setAccion(a); };

  const enviarClave = async () => {
    if (!perfil?.email) return;
    setObrando(true); setErrHoja("");
    const { error } = await supabase.auth.resetPasswordForEmail(perfil.email, { redirectTo: `${window.location.origin}/perfil` });
    setObrando(false);
    if (error) { setErrHoja("No se pudo enviar: " + error.message); return; }
    setAccion(null);
    setAviso({ tono: "ok", texto: `Enlace enviado a ${perfil.email}. Le llegará un correo para poner una contraseña nueva.` });
  };

  const borrar = async () => {
    setObrando(true); setErrHoja("");
    const { data: s } = await supabase.auth.getSession();
    let r: { ok?: boolean; error?: string } = {};
    let estado = 0;
    try {
      const res = await fetch("/api/borrar-cuenta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: s.session?.access_token, uid: id }),
      });
      estado = res.status;
      r = await res.json().catch(() => ({}));
    } catch {
      r = { error: "Sin conexión con el servidor." };
    }
    setObrando(false);
    if (!(estado >= 200 && estado < 300 && r.ok)) {
      setErrHoja(r.error || `No se pudo borrar la cuenta (error ${estado || "de red"}).`);
      return;
    }
    router.push("/admin/usuarios");
  };

  const asignar = async (c: Candidata) => {
    setObrando(true); setErrHoja("");
    const tabla = c.tipo === "dj" ? "djs" : "locales";
    const campo = c.tipo === "dj" ? "profile_id" : "owner_id";
    // Se pide la fila de vuelta: si la RLS no deja, no hay error sino 0 filas.
    const { data, error } = await supabase.from(tabla).update({ [campo]: id }).eq("id", c.id).select("id");
    setObrando(false);
    if (error) { setErrHoja(textoError(error)); return; }
    if (!data?.length) { setErrHoja("La base no guardó el cambio (¿sesión de admin caducada?). Recarga y vuelve a probar."); return; }
    cerrar();
    recargarFichas();
    setAviso({ tono: "ok", texto: `«${c.nombre}» ahora es de ${perfil?.display_name || perfil?.email || "este usuario"}.` });
  };

  const copiarEmail = async () => {
    if (!perfil?.email) return;
    try {
      await navigator.clipboard.writeText(perfil.email);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setAviso({ tono: "error", texto: "No se pudo copiar. Selecciona el email a mano." });
    }
  };

  const volver = (
    <Link href="/admin/usuarios" className={claseBoton("contorno", "pequeno")}>
      <ArrowLeft size={18} aria-hidden /> Usuarios
    </Link>
  );

  if (cargando) {
    return (
      <SeccionPanel titulo="Usuario" acciones={volver} ancho="ancho">
        <div className="flex flex-col gap-3" aria-busy>
          {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-white ring-1 ring-linea" />)}
        </div>
      </SeccionPanel>
    );
  }
  if (errPerfil || !perfil) {
    return (
      <SeccionPanel titulo="Usuario" acciones={volver} ancho="ancho">
        <Aviso tono="error">{errPerfil || "Este usuario no existe o ya se borró."}</Aviso>
      </SeccionPanel>
    );
  }

  const esYo = perfil.id === user?.id;
  const roles: { label: string; icono: ReactNode; tono: "marca" | "neutro" | "ok" }[] = [];
  if (perfil.is_admin) roles.push({ label: "Admin", icono: <Shield size={13} aria-hidden />, tono: "marca" });
  if (fichas.some((f) => f.tipo === "local")) roles.push({ label: "Local", icono: <Store size={13} aria-hidden />, tono: "neutro" });
  if (fichas.some((f) => f.tipo === "promotor")) roles.push({ label: "Promotor", icono: <Megaphone size={13} aria-hidden />, tono: "neutro" });
  if (fichas.some((f) => f.tipo === "dj")) roles.push({ label: "DJ", icono: <Disc3 size={13} aria-hidden />, tono: "neutro" });
  if (!roles.length) roles.push({ label: "Tardícola", icono: <User size={13} aria-hidden />, tono: "neutro" });

  const adn: [string, string[]][] = ([
    ["Música", perfil.musica ?? []],
    ["Ambiente", perfil.ambiente ?? []],
    ["Tipo de evento", perfil.tipos_evento ?? []],
    ["Dress code", perfil.dress_codes ?? []],
    ["Zonas", perfil.zonas ?? []],
    ["Público", perfil.publico ? [perfil.publico] : []],
    ["Precio máximo", perfil.precio_max ? [perfil.precio_max] : []],
  ] as [string, string[]][]).filter(([, v]) => v.length > 0);

  const palabra = perfil.email || "BORRAR";
  const hayBusqueda = limpiar(buscaFicha).length >= 2;
  const btnAccion = "inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-linea-fuerte bg-white px-3.5 text-[15px] font-semibold hover:bg-marfil-100 disabled:opacity-50";

  return (
    <SeccionPanel
      titulo={perfil.display_name || "Sin nombre"}
      descripcion={perfil.email || "Sin email"}
      acciones={volver}
      ancho="ancho"
    >
      <div aria-live="polite">{aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}</div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Cuenta */}
        <Bloque titulo="Cuenta" icono={<User size={18} aria-hidden />}>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {roles.map((r) => <Etiqueta key={r.label} tono={r.tono}>{r.icono} {r.label}</Etiqueta>)}
            {esYo && <Etiqueta tono="ok">Eres tú</Etiqueta>}
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[15px]">
            <Dato t="Email">
              {perfil.email ? <a href={`mailto:${perfil.email}`} className="break-all hover:text-magenta-700">{perfil.email}</a> : <span className="text-tinta-suave">Sin email</span>}
            </Dato>
            <Dato t="Teléfono">{perfil.phone || <span className="text-tinta-suave">Sin teléfono</span>}</Dato>
            <Dato t="Alta">{fechaHora(perfil.created_at)}</Dato>
            <Dato t="Último acceso">
              {errAcceso ? <span className="text-error">{errAcceso}</span>
                : !acceso ? <span className="text-tinta-suave">Cargando…</span>
                : !acceso.existe ? <span className="text-tinta-suave">Sin cuenta de acceso (perfil migrado)</span>
                : fechaHora(acceso.last_sign_in_at) || <span className="text-tinta-suave">Nunca ha entrado</span>}
            </Dato>
            {acceso?.existe && (
              <>
                <Dato t="Email confirmado">
                  {acceso.email_confirmed_at ? <>Sí · {fechaDia(acceso.email_confirmed_at)}</> : <span className="text-aviso">No confirmado</span>}
                </Dato>
                <Dato t="Entra con">{acceso.proveedores?.length ? acceso.proveedores.map(nombreProveedor).join(", ") : "—"}</Dato>
              </>
            )}
            <Dato t="Acepta ofertas">
              {perfil.acepta_ofertas == null ? <span className="text-tinta-suave">—</span>
                : perfil.acepta_ofertas ? <>Sí{perfil.acepta_ofertas_en && ` · desde ${fechaDia(perfil.acepta_ofertas_en)}`}</>
                : "No"}
            </Dato>
          </dl>
        </Bloque>

        {/* Acciones */}
        <Bloque titulo="Acciones" icono={<Sparkles size={18} aria-hidden />}>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copiarEmail} disabled={!perfil.email} className={btnAccion}>
              {copiado ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />} {copiado ? "Copiado" : "Copiar email"}
            </button>
            {perfil.email && (
              <a href={`mailto:${perfil.email}`} className={btnAccion}><Mail size={18} aria-hidden /> Escribir email</a>
            )}
            {perfil.phone && (
              <>
                <a href={`https://wa.me/${telWhatsApp(perfil.phone)}`} target="_blank" rel="noopener noreferrer" className={btnAccion}>
                  <MessageCircle size={18} aria-hidden /> WhatsApp
                </a>
                <a href={`tel:${perfil.phone.replace(/\s/g, "")}`} className={btnAccion}><Phone size={18} aria-hidden /> Llamar</a>
              </>
            )}
            {/* Solo si tiene cuenta de acceso: a un perfil migrado sin cuenta el
                correo de recuperación no le llega nunca. */}
            {acceso?.existe !== false && (
              <button type="button" onClick={() => abrir({ tipo: "clave" })} disabled={!perfil.email}
                title={perfil.email ? undefined : "Sin email"} className={btnAccion}>
                <KeyRound size={18} aria-hidden /> Nueva contraseña
              </button>
            )}
            <button type="button" onClick={() => abrir({ tipo: "asignar" })} className={btnAccion}>
              <Plus size={18} aria-hidden /> Asignar ficha
            </button>
            <Link href="/admin/enlaces" className={btnAccion}><Link2 size={18} aria-hidden /> Enlaces de invitación</Link>
          </div>
          <div className="mt-4 border-t border-linea pt-4">
            {perfil.is_admin || esYo ? (
              <p className="text-sm text-tinta-suave">
                {esYo ? "No puedes borrar tu propia cuenta desde aquí." : "Es administrador: no se puede borrar desde el panel. Quítale antes el permiso de admin por SQL."}
              </p>
            ) : (
              <button type="button" onClick={() => abrir({ tipo: "borrar", paso: 1 })}
                className={`${btnAccion} border-error/40 text-error hover:bg-error-fondo`}>
                <Trash2 size={18} aria-hidden /> Borrar cuenta
              </button>
            )}
          </div>
        </Bloque>
      </div>

      {/* Fichas */}
      <div className="mt-4">
        <Bloque titulo="Sus fichas" icono={<Store size={18} aria-hidden />} n={fichas.length}
          acciones={<button type="button" onClick={() => abrir({ tipo: "asignar" })} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-magenta-700 hover:bg-magenta-50"><Plus size={16} aria-hidden /> Asignar ficha</button>}>
          {errFichas && <Aviso tono="error">{errFichas}</Aviso>}
          {fichas.length === 0 && !errFichas ? (
            <Vacio>No gestiona ninguna ficha. Puedes asignarle una con «Asignar ficha» o mandarle un enlace de invitación.</Vacio>
          ) : (
            <ul className="divide-y divide-linea">
              {fichas.map((f) => {
                const I = f.tipo === "dj" ? Disc3 : f.tipo === "promotor" ? Megaphone : Store;
                const editar = f.tipo === "dj" ? `/dj/perfil?id=${f.id}` : `/local/editar?id=${f.id}`;
                const publica = f.tipo === "dj" ? `/djs/${f.id}` : `/locales/${f.id}`;
                return (
                  <li key={`${f.tipo}-${f.id}`} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marfil-100 text-tinta-suave"><I size={18} aria-hidden /></span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{f.nombre}</p>
                        <p className="text-sm text-tinta-suave">
                          {f.tipo === "dj" ? "DJ" : f.tipo === "promotor" ? "Promotor" : "Local"}
                          {f.estado && f.estado !== "activo" && ` · ${f.estado}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <Link href={editar} className={claseBoton("contorno", "pequeno")}><Pencil size={16} aria-hidden /> Editar</Link>
                      <Link href={publica} target="_blank" className={claseBoton("suave", "pequeno")}><ExternalLink size={16} aria-hidden /> Ver</Link>
                      <div className="w-full md:w-auto md:max-w-[16rem]">
                        <AsignarDueno
                          tabla={f.tipo === "dj" ? "djs" : "locales"}
                          campo={f.tipo === "dj" ? "profile_id" : "owner_id"}
                          id={f.id}
                          duenoEmail={perfil.email || perfil.display_name || "este usuario"}
                          onAsignado={(email) => { recargarFichas(); setAviso({ tono: "ok", texto: `«${f.nombre}» ahora es de ${email}.` }); }}
                          onQuitado={() => { recargarFichas(); setAviso({ tono: "ok", texto: `«${f.nombre}» ya no es suya: queda sin dueño.` }); }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Bloque>
      </div>

      {/* Actividad */}
      <h2 className="mb-3 mt-8 text-xl font-bold">Actividad</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloque titulo="Inscripciones" icono={<Ticket size={18} aria-hidden />} n={inscripciones.total}>
          <div className="mb-3">
            <Filtros<FiltroInscripcion> valor={filtroIns} onCambiar={setFiltroIns} opciones={[
              { clave: "todas", label: "Todas" },
              { clave: "apuntado", label: "Confirmadas" },
              { clave: "espera", label: "En espera" },
              { clave: "cancelado", label: "Canceladas" },
            ]} />
          </div>
          <Lista l={inscripciones} vacio={filtroIns === "todas" ? "No se ha apuntado a ningún tardeo." : "Ninguna inscripción en ese estado."}>
            {inscripciones.filas.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <EnlaceTardeo t={i.tardeo} />
                  <p className="text-sm text-tinta-suave">Tardeo: {fechaDia(i.tardeo?.fecha)} · se apuntó el {fechaDia(i.created_at)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Etiqueta tono={ESTADO_INSCRIPCION[i.estado]?.tono ?? "neutro"}>{ESTADO_INSCRIPCION[i.estado]?.t ?? i.estado}</Etiqueta>
                  {i.asistencia && i.asistencia !== "pendiente" && (
                    <Etiqueta tono={i.asistencia === "asistio" ? "ok" : "aviso"}>{i.asistencia === "asistio" ? "Asistió" : "No vino"}</Etiqueta>
                  )}
                </div>
              </li>
            ))}
          </Lista>
        </Bloque>

        <Bloque titulo="Guardados" icono={<Heart size={18} aria-hidden />} n={favoritos.total || acceso?.favoritos_total || 0}>
          {favoritos.total === 0 && !favoritos.cargando && !favoritos.error && (acceso?.favoritos_total ?? 0) > 0 ? (
            <Aviso tono="aviso">
              Tiene {acceso!.favoritos_total === 1 ? "1 tardeo guardado" : `${acceso!.favoritos_total} tardeos guardados`}, pero la base de datos no deja al admin leerlos (permisos RLS).
              Hay que pegar en Supabase el lote supabase/56_admin_lee_favoritos.sql.
            </Aviso>
          ) : (
          <Lista l={favoritos} vacio="No ha guardado ningún tardeo.">
            {favoritos.filas.map((f) => (
              <li key={f.tardeo_id} className="py-2.5">
                <EnlaceTardeo t={f.tardeo} />
                <p className="text-sm text-tinta-suave">Tardeo: {fechaDia(f.tardeo?.fecha)}{f.created_at && ` · guardado el ${fechaDia(f.created_at)}`}</p>
              </li>
            ))}
          </Lista>
          )}
        </Bloque>

        <Bloque titulo="Reseñas que ha escrito" icono={<Star size={18} aria-hidden />} n={resenas.total}
          acciones={<Link href="/admin/moderacion" className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-magenta-700 hover:bg-magenta-50">Moderación</Link>}>
          <Lista l={resenas} vacio="No ha escrito ninguna reseña.">
            {resenas.filas.map((r) => (
              <li key={r.id} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={r.objetivo_tipo === "dj" ? `/djs/${r.objetivo_id}` : `/locales/${r.objetivo_id}`} target="_blank"
                    className="min-w-0 truncate font-semibold hover:text-magenta-700">
                    {nombresResenas.get(r.objetivo_id) || (r.objetivo_tipo === "dj" ? "DJ" : "Local")}
                  </Link>
                  <Etiqueta tono={r.estado === "aprobada" ? "ok" : r.estado === "rechazada" ? "error" : "aviso"}>
                    {r.estado === "aprobada" ? "Aprobada" : r.estado === "rechazada" ? "Rechazada" : "Pendiente"}
                  </Etiqueta>
                </div>
                <p className="text-sm text-tinta-suave">
                  <span className="font-semibold text-aviso" aria-label={`${r.puntuacion} de 5`}>{"★".repeat(r.puntuacion)}{"☆".repeat(5 - r.puntuacion)}</span>
                  {" · "}{fechaDia(r.created_at)}
                </p>
                {r.comentario && <p className="mt-1 line-clamp-3 text-[15px]">{r.comentario}</p>}
              </li>
            ))}
          </Lista>
        </Bloque>

        <Bloque titulo="Sus gustos (ADN)" icono={<Sparkles size={18} aria-hidden />}>
          {adn.length === 0 ? (
            <Vacio>Todavía no ha rellenado sus gustos.</Vacio>
          ) : (
            <dl className="flex flex-col gap-3">
              {adn.map(([t, v]) => (
                <div key={t}>
                  <dt className="mb-1 text-sm font-semibold text-tinta-suave">{t}</dt>
                  <dd className="flex flex-wrap gap-1.5">{v.map((x) => <Etiqueta key={x}>{x}</Etiqueta>)}</dd>
                </div>
              ))}
              {perfil.adn_en && <p className="text-sm text-tinta-suave">Actualizado el {fechaDia(perfil.adn_en)}</p>}
            </dl>
          )}
        </Bloque>
      </div>

      {/* Hojas de confirmación */}
      <Hoja abierta={!!accion} onCerrar={cerrar}
        titulo={accion?.tipo === "clave" ? "¿Enviar enlace para nueva contraseña?"
          : accion?.tipo === "asignar" ? "Asignar una ficha"
          : accion?.tipo === "borrar" && accion.paso === 2 ? "Confirma el borrado" : "¿Borrar esta cuenta?"}>
        {accion && (
          <div className="flex flex-col gap-3">
            <p className="text-lg font-bold leading-tight">{perfil.display_name || "Sin nombre"}</p>
            <p className="-mt-2 break-all text-[15px] text-tinta-suave">{perfil.email || "Sin email"}</p>
            {errHoja && <Aviso tono="error">{errHoja}</Aviso>}

            {accion.tipo === "clave" && (
              <>
                <p className="text-[16px]">Le llegará un correo con un enlace para elegir una contraseña nueva. Su contraseña actual sigue valiendo hasta que la cambie.</p>
                <Boton ancho cargando={obrando} onClick={enviarClave}>Sí, enviar enlace</Boton>
                <Boton variante="contorno" ancho disabled={obrando} onClick={cerrar}>Cancelar</Boton>
              </>
            )}

            {accion.tipo === "borrar" && accion.paso === 1 && (
              <>
                <p className="rounded-xl bg-error-fondo p-4 text-[15px] font-semibold text-error">
                  Se borra la cuenta para siempre, con sus guardados, inscripciones y avisos.
                  {fichas.length > 0 && ` Sus ${fichas.length} fichas no se borran: quedan sin dueño.`}
                  {" "}No se puede deshacer.
                </p>
                <Boton variante="peligro" ancho onClick={() => { setErrHoja(""); setAccion({ tipo: "borrar", paso: 2 }); }}>Continuar</Boton>
                <Boton variante="contorno" ancho onClick={cerrar}>Cancelar</Boton>
              </>
            )}

            {accion.tipo === "borrar" && accion.paso === 2 && (
              <>
                <label htmlFor="confirma-borrar" className="text-[16px]">
                  Para confirmar, escribe <b className="break-all">{palabra}</b>:
                </label>
                <input id="confirma-borrar" value={confirmaTexto} onChange={(e) => setConfirmaTexto(e.target.value)}
                  autoComplete="off" autoCapitalize="off" spellCheck={false} className={claseCampo} />
                <Boton variante="peligro" ancho cargando={obrando}
                  disabled={confirmaTexto.trim().toLowerCase() !== palabra.toLowerCase()} onClick={borrar}>
                  Borrar cuenta para siempre
                </Boton>
                <Boton variante="contorno" ancho disabled={obrando} onClick={cerrar}>Cancelar</Boton>
              </>
            )}

            {accion.tipo === "asignar" && (
              elegida ? (
                <>
                  <p className="text-[16px]">
                    ¿Dar <b>«{elegida.nombre}»</b> ({elegida.tipo === "dj" ? "DJ" : elegida.tipo === "promotor" ? "promotor" : "local"}) a esta cuenta?
                    Podrá gestionarla desde su panel.
                  </p>
                  {elegida.conDueno && (
                    <Aviso tono="aviso">Esta ficha ya tiene otro dueño. Si sigues, lo pierde y pasa a esta cuenta.</Aviso>
                  )}
                  <Boton ancho cargando={obrando} onClick={() => asignar(elegida)}>Sí, asignar</Boton>
                  <Boton variante="contorno" ancho disabled={obrando} onClick={() => { setElegida(null); setErrHoja(""); }}>Elegir otra</Boton>
                </>
              ) : (
                <>
                  <label htmlFor="busca-ficha" className="text-[16px] font-semibold">Busca el local, promotor o DJ por su nombre</label>
                  <div className="relative">
                    <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden />
                    <input id="busca-ficha" value={buscaFicha} onChange={(e) => setBuscaFicha(e.target.value)} autoFocus
                      placeholder="Mínimo 2 letras" autoComplete="off" className={`${claseCampo} !pl-10`} />
                  </div>
                  {buscando && <p className="flex items-center gap-2 text-sm text-tinta-suave"><Loader2 size={16} className="animate-spin" aria-hidden /> Buscando…</p>}
                  {hayBusqueda && candidatas && !buscando && candidatas.length === 0 && (
                    <p className="rounded-xl border border-dashed border-linea-fuerte p-4 text-center text-[15px] text-tinta-suave">
                      Ninguna ficha con ese nombre. Si aún no existe, créala en <Link href="/admin/crear" className="font-semibold text-magenta-700 underline">Crear</Link>.
                    </p>
                  )}
                  {hayBusqueda && candidatas && candidatas.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {candidatas.map((c) => {
                        const I = c.tipo === "dj" ? Disc3 : c.tipo === "promotor" ? Megaphone : Store;
                        return (
                          <li key={`${c.tipo}-${c.id}`}>
                            <button type="button" disabled={c.esSuya} onClick={() => { setErrHoja(""); setElegida(c); }}
                              className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-linea bg-white px-3 text-left hover:border-magenta hover:bg-magenta-50 disabled:opacity-60 disabled:hover:border-linea disabled:hover:bg-white">
                              <I size={18} className="shrink-0 text-tinta-suave" aria-hidden />
                              <span className="min-w-0 flex-1 truncate font-semibold">{c.nombre}</span>
                              <span className="shrink-0 text-sm text-tinta-suave">{c.esSuya ? "Ya es suya" : c.conDueno ? "Con dueño" : "Sin dueño"}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p className="text-sm text-tinta-suave">
                    ¿No tiene cuenta todavía la persona? Usa un <Link href="/admin/enlaces" className="font-semibold text-magenta-700 underline">enlace de invitación</Link>.
                  </p>
                </>
              )
            )}
          </div>
        )}
      </Hoja>
    </SeccionPanel>
  );
}

function nombreProveedor(p: string) {
  return ({ email: "Email", google: "Google", apple: "Apple", facebook: "Facebook", phone: "Teléfono" } as Record<string, string>)[p] ?? p;
}

function Bloque({ titulo, icono, n, acciones, children }: { titulo: string; icono: ReactNode; n?: number; acciones?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span className="text-magenta-700">{icono}</span> {titulo}
          {n != null && <span className="rounded-full bg-marfil-100 px-2 text-sm font-bold text-tinta-suave">{n.toLocaleString("es-ES")}</span>}
        </h2>
        {acciones}
      </div>
      {children}
    </section>
  );
}

function Dato({ t, children }: { t: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-tinta-suave">{t}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </>
  );
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-linea-fuerte p-5 text-center text-[15px] text-tinta-suave">{children}</p>;
}

function EnlaceTardeo({ t }: { t: TardeoMini }) {
  if (!t) return <p className="font-semibold text-tinta-suave">Tardeo borrado</p>;
  return (
    <Link href={`/tardeos/${t.id}`} target="_blank" className="block truncate font-semibold hover:text-magenta-700">{t.titulo}</Link>
  );
}

function Lista<T>({ l, vacio, children }: {
  l: { filas: T[]; total: number; cargando: boolean; error: string | null; verMas: () => void; hayMas: boolean };
  vacio: string;
  children: ReactNode;
}) {
  if (l.error) return <Aviso tono="error">{l.error}</Aviso>;
  if (l.cargando && l.filas.length === 0) {
    return <div className="flex flex-col gap-2" aria-busy>{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-marfil-100" />)}</div>;
  }
  if (l.filas.length === 0) return <Vacio>{vacio}</Vacio>;
  return (
    <>
      <ul className="divide-y divide-linea">{children}</ul>
      {l.hayMas && (
        <button type="button" onClick={l.verMas} disabled={l.cargando}
          className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-linea-fuerte bg-white text-[15px] font-semibold hover:bg-marfil-100 disabled:opacity-60">
          {l.cargando && <Loader2 size={16} className="animate-spin" aria-hidden />}
          Ver más ({(l.total - l.filas.length).toLocaleString("es-ES")} más)
        </button>
      )}
    </>
  );
}
