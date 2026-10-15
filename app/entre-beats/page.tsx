"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Loader2, MessageSquare, MoreVertical } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { useRoles } from "@/lib/permisos";
import { entrarYVolver } from "@/lib/volver";
import Boton from "@/components/Boton";
import Hoja from "@/components/ui/Hoja";
import { claseCampo } from "@/components/ui/Campo";
import Paginacion, { Buscador, usePaginado, useDiferido } from "@/components/panel/Paginacion";
import Denunciar from "@/components/comunidad/Denunciar";
import { autores, CATEGORIAS, consultaBusqueda, TEMAS, type Anuncio, type Autor, type Hilo, type Respuesta } from "@/lib/entreBeats";
import { fechaCorta, pareceContacto, textoError } from "@/lib/meet";
import type { TipoObjeto } from "@/lib/denuncias";

type Tab = "hilos" | "anuncios";

/**
 * Entre Beats: la pestaña profesional (dossier pág. 8). Hilos con búsqueda y
 * respuestas; anuncios con categoría y Abierto/Cerrado. Un tardícola ve una
 * explicación; aunque forzara la API, la base no le devuelve nada (lote 66).
 */
export default function EntreBeats() {
  const { user, loading } = useAuth();
  const roles = useRoles();
  const [tab, setTab] = useState<Tab>("hilos");
  const [q, setQ] = useState("");
  const qd = useDiferido(q);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (p.get("tab") === "anuncios") setTab("anuncios");
  }, []);

  const cabecera = (
    <div className="px-4 pb-2 pt-5">
      <h1 className="text-center text-2xl font-bold">Entre Beats</h1>
      <p className="mt-1 text-[15px] text-tinta-suave">DJs, locales y organizadores</p>
    </div>
  );

  if (loading || roles.cargando) {
    return <div className="min-h-[60vh] bg-fondo">{cabecera}<p className="grid place-items-center py-12 text-tinta-suave"><Loader2 className="animate-spin" aria-label="Cargando" /></p></div>;
  }
  if (!user || !roles.esProfesional) {
    return (
      <div className="min-h-[60vh] bg-fondo">{cabecera}
        <div className="mx-auto max-w-md px-4 py-8 text-center">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-magenta-50 text-magenta"><Lock size={24} aria-hidden /></span>
          <h2 className="text-xl font-bold">Solo para profesionales</h2>
          <p className="mt-2 text-[16px] text-tinta-suave">
            Entre Beats es el espacio de trabajo de DJs, locales y organizadores: hilos de la comunidad y anuncios de colaboración.
          </p>
          <div className="mt-6 space-y-3">
            {!user && <Boton href={entrarYVolver("/entre-beats")} ancho>Entrar con cuenta profesional</Boton>}
            <Boton href="/unirse" variante="contorno" ancho>Soy DJ, local u organizador</Boton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] bg-fondo">
      {cabecera}
      <main className="mx-auto max-w-2xl space-y-4 px-4 pb-24">
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-marfil-100 p-1">
          {(["hilos", "anuncios"] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`min-h-[44px] rounded-lg text-[15px] font-bold ${tab === t ? "bg-magenta text-white" : "text-tinta"}`}>
              {t === "hilos" ? "Hilos" : "Anuncios"}
            </button>
          ))}
        </div>
        <Buscador valor={q} onCambiar={setQ} placeholder={tab === "hilos" ? "Buscar conversaciones" : "Buscar anuncios"} />
        {tab === "hilos" ? <Hilos q={qd} yo={user.id} /> : <Anuncios q={qd} yo={user.id} />}
      </main>
    </div>
  );
}

function Fallo({ e }: { e: string | null }) {
  return e ? <p role="alert" className="rounded-xl bg-error-fondo p-3 text-[15px] font-semibold text-error">{e}</p> : null;
}

function MenuDenuncia({ tipo, id }: { tipo: TipoObjeto; id: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button type="button" aria-label="Denunciar" onClick={() => setAbierta(true)}
        className="grid min-h-[44px] min-w-[36px] place-items-center text-tinta-suave hover:text-error"><MoreVertical size={18} aria-hidden /></button>
      {abierta && <Denunciar abierta onCerrar={() => setAbierta(false)} tipo={tipo} objetoId={id} />}
    </>
  );
}

// ---- Hilos -------------------------------------------------------------------
function Hilos({ q, yo }: { q: string; yo: string }) {
  const [gente, setGente] = useState<Record<string, Autor>>({});
  const [crear, setCrear] = useState(false);
  const [abierto, setAbierto] = useState<Hilo | null>(null);
  const ts = consultaBusqueda(q);
  const { filas, total, pagina, setPagina, porPagina, cargando, error, recargar } = usePaginado<Hilo>((desde, hasta) => {
    let c = supabase.from("eb_hilos").select("id,autor,titulo,cuerpo,tema,zona,retenido,created_at,eb_respuestas(count)", { count: "exact" });
    if (ts) c = c.textSearch("busqueda", ts, { config: "spanish" });
    return c.order("created_at", { ascending: false }).order("id").range(desde, hasta);
  }, [ts], 20);

  useEffect(() => {
    autores(filas.map((h) => h.autor)).then((a) => setGente((p) => ({ ...p, ...a })));
  }, [filas]);

  useEffect(() => {
    // Enlace directo ?hilo=<id> (desde la cola de denuncias o compartido).
    const id = new URLSearchParams(window.location.search).get("hilo");
    if (!id) return;
    supabase.from("eb_hilos").select("id,autor,titulo,cuerpo,tema,zona,retenido,created_at").eq("id", id).maybeSingle()
      .then(({ data }) => { if (data) setAbierto(data as Hilo); });
  }, []);

  return (
    <div className="space-y-3">
      {error ? <Fallo e={textoError({ message: error, code: /does not exist|schema cache/.test(error) ? "42P01" : undefined })} />
        : cargando && filas.length === 0 ? <p className="grid place-items-center py-8 text-tinta-suave"><Loader2 className="animate-spin" aria-label="Cargando" /></p>
        : filas.length === 0 ? <p className="rounded-2xl border border-dashed border-linea p-6 text-center text-[15px] text-tinta-suave">{q ? "No hay hilos con esa búsqueda." : "Aún no hay hilos. Abre el primero."}</p>
        : filas.map((h) => (
          <article key={h.id} className="rounded-2xl border border-linea bg-superficie p-4">
            <div className="flex items-start gap-2">
              <button type="button" onClick={() => setAbierto(h)} className="min-w-0 flex-1 text-left">
                <p className="text-[12px] font-bold uppercase tracking-wide text-tinta-suave">Comunidad profesional{h.tema ? ` · ${h.tema}` : ""}</p>
                <h2 className="mt-1 text-lg font-bold">{h.titulo}</h2>
                <p className="text-[14px] text-tinta-suave">
                  {gente[h.autor]?.nombre ?? "…"} · {h.eb_respuestas?.[0]?.count ?? 0} respuestas{h.retenido && " · Retenido para revisión"}
                </p>
                <p className="mt-2 line-clamp-2 text-[15px] text-tinta-suave">{h.cuerpo}</p>
              </button>
              {h.autor !== yo && <MenuDenuncia tipo="eb_hilo" id={h.id} />}
            </div>
          </article>
        ))}
      <Paginacion pagina={pagina} total={total} porPagina={porPagina} onCambiar={setPagina} cargando={cargando} />
      <Boton variante="contorno" ancho onClick={() => setCrear(true)}>Crear hilo</Boton>
      <CrearHilo abierta={crear} onCerrar={() => setCrear(false)} onCreado={() => { setCrear(false); recargar(); }} />
      {abierto && <DetalleHilo hilo={abierto} yo={yo} gente={gente} onCerrar={() => { setAbierto(null); recargar(); }} />}
    </div>
  );
}

function CrearHilo({ abierta, onCerrar, onCreado }: { abierta: boolean; onCerrar: () => void; onCreado: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [tema, setTema] = useState(TEMAS[0]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (titulo.trim().length < 3 || !cuerpo.trim()) { setError("Pon un título (mínimo 3 letras) y el texto."); return; }
    if (pareceContacto(`${titulo} ${cuerpo}`)) { setError("No se pueden compartir teléfonos ni emails en los hilos."); return; }
    setEnviando(true); setError(null);
    const { error } = await supabase.from("eb_hilos").insert({ titulo: titulo.trim(), cuerpo: cuerpo.trim(), tema });
    setEnviando(false);
    if (error) { setError(textoError(error)); return; }
    setTitulo(""); setCuerpo(""); onCreado();
  }

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Crear hilo" pie={<Boton ancho cargando={enviando} onClick={guardar}>Publicar hilo</Boton>}>
      <div className="space-y-3">
        <input className={claseCampo} placeholder="Título" maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-label="Título" />
        <select className={claseCampo} value={tema} onChange={(e) => setTema(e.target.value)} aria-label="Tema">
          {TEMAS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <textarea className={claseCampo} rows={5} maxLength={3000} placeholder="¿De qué quieres hablar?" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} aria-label="Texto" />
        <Fallo e={error} />
      </div>
    </Hoja>
  );
}

function DetalleHilo({ hilo, yo, gente, onCerrar }: { hilo: Hilo; yo: string; gente: Record<string, Autor>; onCerrar: () => void }) {
  const [respuestas, setRespuestas] = useState<Respuesta[] | null>(null);
  const [nombres, setNombres] = useState<Record<string, Autor>>(gente);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("eb_respuestas").select("id,hilo_id,autor,cuerpo,retenido,created_at")
      .eq("hilo_id", hilo.id).order("created_at").limit(200);
    if (error) { setError(textoError(error)); setRespuestas([]); return; }
    const r = (data as Respuesta[]) ?? [];
    setRespuestas(r);
    const a = await autores([hilo.autor, ...r.map((x) => x.autor)]);
    setNombres((p) => ({ ...p, ...a }));
  }, [hilo.id, hilo.autor]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  async function responder() {
    if (!texto.trim()) return;
    if (pareceContacto(texto)) { setError("No se pueden compartir teléfonos ni emails."); return; }
    setEnviando(true); setError(null);
    const { error } = await supabase.from("eb_respuestas").insert({ hilo_id: hilo.id, cuerpo: texto.trim() });
    setEnviando(false);
    if (error) { setError(textoError(error)); return; }
    setTexto(""); cargar();
  }

  return (
    <Hoja abierta onCerrar={onCerrar} titulo={hilo.titulo}
      pie={<div className="flex w-full gap-2">
        <input className={claseCampo} placeholder="Escribe una respuesta…" maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Respuesta" />
        <Boton cargando={enviando} onClick={responder}>Responder</Boton>
      </div>}>
      <div className="space-y-3">
        <p className="text-[14px] text-tinta-suave">{nombres[hilo.autor]?.nombre ?? "…"} · {fechaCorta(hilo.created_at)}{hilo.tema ? ` · ${hilo.tema}` : ""}</p>
        <p className="whitespace-pre-wrap text-[16px]">{hilo.cuerpo}</p>
        <h3 className="flex items-center gap-2 border-t border-linea pt-3 text-[15px] font-bold"><MessageSquare size={16} aria-hidden /> Respuestas</h3>
        {respuestas === null ? <Loader2 className="animate-spin" aria-label="Cargando" />
          : respuestas.length === 0 ? <p className="text-[15px] text-tinta-suave">Nadie ha respondido todavía.</p>
          : respuestas.map((r) => (
            <div key={r.id} className="flex items-start gap-1 rounded-xl bg-marfil-100 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-magenta">{nombres[r.autor]?.nombre ?? "…"} <span className="font-normal text-tinta-suave">· {fechaCorta(r.created_at)}{r.retenido && " · Retenido"}</span></p>
                <p className="whitespace-pre-wrap text-[15px]">{r.cuerpo}</p>
              </div>
              {r.autor !== yo && <MenuDenuncia tipo="eb_respuesta" id={r.id} />}
            </div>
          ))}
        <Fallo e={error} />
      </div>
    </Hoja>
  );
}

// ---- Anuncios ----------------------------------------------------------------
function Anuncios({ q, yo }: { q: string; yo: string }) {
  const [gente, setGente] = useState<Record<string, Autor>>({});
  const [crear, setCrear] = useState(false);
  const [contactar, setContactar] = useState<Anuncio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ts = consultaBusqueda(q);
  const { filas, total, pagina, setPagina, porPagina, cargando, error: errLista, recargar, cambiar } = usePaginado<Anuncio>((desde, hasta) => {
    let c = supabase.from("eb_anuncios").select("id,autor,categoria,titulo,cuerpo,zona,estilos,contacto,estado,retenido,created_at", { count: "exact" });
    if (ts) c = c.textSearch("busqueda", ts, { config: "spanish" });
    return c.order("estado").order("created_at", { ascending: false }).order("id").range(desde, hasta);
  }, [ts], 20);

  useEffect(() => {
    autores(filas.map((h) => h.autor)).then((a) => setGente((p) => ({ ...p, ...a })));
  }, [filas]);

  async function cambiarEstado(a: Anuncio) {
    const nuevo = a.estado === "abierto" ? "cerrado" : "abierto";
    const { error } = await supabase.from("eb_anuncios").update({ estado: nuevo }).eq("id", a.id);
    if (error) { setError(textoError(error)); return; }
    cambiar((f) => f.id === a.id, { estado: nuevo });
  }

  return (
    <div className="space-y-3">
      <Fallo e={error} />
      {errLista ? <Fallo e={textoError({ message: errLista, code: /does not exist|schema cache/.test(errLista) ? "42P01" : undefined })} />
        : cargando && filas.length === 0 ? <p className="grid place-items-center py-8 text-tinta-suave"><Loader2 className="animate-spin" aria-label="Cargando" /></p>
        : filas.length === 0 ? <p className="rounded-2xl border border-dashed border-linea p-6 text-center text-[15px] text-tinta-suave">{q ? "No hay anuncios con esa búsqueda." : "Aún no hay anuncios."}</p>
        : filas.map((a) => (
          <article key={a.id} className="rounded-2xl border border-linea bg-superficie p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${a.estado === "abierto" ? "bg-magenta-50 text-magenta" : "bg-marfil-100 text-tinta-suave"}`}>
                    {a.estado === "abierto" ? "Abierto" : "Cerrado"}
                  </span>
                  <span className="text-[13px] text-tinta-suave">{CATEGORIAS.find((c) => c.k === a.categoria)?.label}</span>
                  {a.retenido && <span className="text-[13px] text-error">Retenido para revisión</span>}
                </div>
                <h2 className="mt-1 text-lg font-bold">{a.titulo}</h2>
                <p className="text-[14px] text-tinta-suave">{[a.zona, ...(a.estilos ?? [])].filter(Boolean).join(" · ") || "Sin zona"} · {gente[a.autor]?.nombre ?? "…"}</p>
                <p className="mt-2 whitespace-pre-wrap text-[15px]">{a.cuerpo}</p>
              </div>
              {a.autor !== yo && <MenuDenuncia tipo="eb_anuncio" id={a.id} />}
            </div>
            {a.autor === yo ? (
              <Boton variante="contorno" ancho className="mt-3" onClick={() => cambiarEstado(a)}>{a.estado === "abierto" ? "Cerrar anuncio" : "Reabrir anuncio"}</Boton>
            ) : a.estado === "abierto" ? (
              <Boton variante="contorno" ancho className="mt-3" onClick={() => setContactar(a)}>Contactar</Boton>
            ) : null}
          </article>
        ))}
      <Paginacion pagina={pagina} total={total} porPagina={porPagina} onCambiar={setPagina} cargando={cargando} />
      <Boton variante="contorno" ancho onClick={() => setCrear(true)}>Crear anuncio</Boton>
      <CrearAnuncio abierta={crear} onCerrar={() => setCrear(false)} onCreado={() => { setCrear(false); recargar(); }} />
      <Hoja abierta={!!contactar} onCerrar={() => setContactar(null)} titulo="Contactar">
        {contactar && (
          <div className="space-y-3">
            <p className="text-[15px] text-tinta-suave">{gente[contactar.autor]?.nombre} ha dejado este contacto para profesionales:</p>
            <p className="select-all rounded-xl bg-marfil-100 px-4 py-3 text-[17px] font-bold">{contactar.contacto}</p>
            {gente[contactar.autor]?.dj_id && (
              <Boton href={`/djs/${gente[contactar.autor]!.dj_id}/mensaje`} variante="contorno" ancho>Enviar solicitud de mensaje</Boton>
            )}
          </div>
        )}
      </Hoja>
    </div>
  );
}

function CrearAnuncio({ abierta, onCerrar, onCreado }: { abierta: boolean; onCerrar: () => void; onCreado: () => void }) {
  const [f, setF] = useState({ categoria: "busco_dj", titulo: "", cuerpo: "", zona: "", estilos: "", contacto: "" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function guardar() {
    if (f.titulo.trim().length < 3 || !f.cuerpo.trim()) { setError("Pon un título y la descripción."); return; }
    if (f.contacto.trim().length < 3) { setError("Indica cómo contactarte (Instagram, web, email o teléfono)."); return; }
    if (pareceContacto(`${f.titulo} ${f.cuerpo}`)) { setError("Pon el teléfono o email solo en el campo Contacto, no en el texto."); return; }
    setEnviando(true); setError(null);
    const { error } = await supabase.from("eb_anuncios").insert({
      categoria: f.categoria, titulo: f.titulo.trim(), cuerpo: f.cuerpo.trim(), zona: f.zona.trim() || null,
      estilos: f.estilos.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6), contacto: f.contacto.trim(),
    });
    setEnviando(false);
    if (error) { setError(textoError(error)); return; }
    setF({ categoria: "busco_dj", titulo: "", cuerpo: "", zona: "", estilos: "", contacto: "" });
    onCreado();
  }

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Crear anuncio" pie={<Boton ancho cargando={enviando} onClick={guardar}>Publicar anuncio</Boton>}>
      <div className="space-y-3">
        <select className={claseCampo} value={f.categoria} onChange={set("categoria")} aria-label="Categoría">
          {CATEGORIAS.map((c) => <option key={c.k} value={c.k}>{c.label}</option>)}
        </select>
        <input className={claseCampo} placeholder="Título (p. ej. DJ para sesión de tarde)" maxLength={120} value={f.titulo} onChange={set("titulo")} aria-label="Título" />
        <textarea className={claseCampo} rows={4} maxLength={2000} placeholder="Qué buscas u ofreces" value={f.cuerpo} onChange={set("cuerpo")} aria-label="Descripción" />
        <input className={claseCampo} placeholder="Zona (p. ej. Barcelona)" maxLength={60} value={f.zona} onChange={set("zona")} aria-label="Zona" />
        <input className={claseCampo} placeholder="Estilos, separados por comas" maxLength={120} value={f.estilos} onChange={set("estilos")} aria-label="Estilos" />
        <input className={claseCampo} placeholder="Contacto (solo lo ven profesionales)" maxLength={120} value={f.contacto} onChange={set("contacto")} aria-label="Contacto" />
        <p className="text-[13px] text-tinta-suave">El contacto solo lo ven DJs, locales y organizadores, al pulsar Contactar.</p>
        <Fallo e={error} />
      </div>
    </Hoja>
  );
}
