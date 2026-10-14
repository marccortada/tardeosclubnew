"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, Filtros, EstadoLista } from "@/components/panel/Paginacion";
import Boton from "@/components/Boton";
import Hoja from "@/components/ui/Hoja";
import Aviso from "@/components/admin/Aviso";
import { Etiqueta } from "@/components/ui/Chip";
import {
  consultaResenasPendientes, moderarResena, MOTIVOS_RECHAZO, etiquetaMotivo,
  type MotivoRechazo, type Resena,
} from "@/lib/resenas";
import { consultaDenunciasPendientes, resolverDenuncia, MOTIVOS, type Denuncia } from "@/lib/denuncias";
import { Check, X, Star, Flag, ExternalLink, Undo2 } from "lucide-react";

type Tab = "resenas" | "flyers";

/** useSearchParams() exige Suspense en una página de cliente. */
export default function AdminModeracionPagina() {
  return <Suspense fallback={null}><AdminModeracion /></Suspense>;
}

/**
 * Moderación: reseñas (pendientes + apeladas) y flyers denunciados, cada cola
 * paginada en el servidor. Se entra directo a flyers con ?tab=flyers.
 */
function AdminModeracion() {
  const router = useRouter();
  const tab: Tab = useSearchParams().get("tab") === "flyers" ? "flyers" : "resenas";
  const [cuentas, setCuentas] = useState<{ resenas?: number; flyers?: number }>({});

  const contar = () => {
    Promise.all([
      supabase.from("resenas").select("id", { count: "exact", head: true }).in("estado", ["pendiente", "apelada"]),
      supabase.from("denuncias_flyer").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    ]).then(([r, d]) => setCuentas({ resenas: r.error ? undefined : r.count ?? 0, flyers: d.error ? undefined : d.count ?? 0 }));
  };
  useEffect(contar, []);

  return (
    <SeccionPanel
      titulo="Reseñas y flyers"
      descripcion="Lo que la gente escribe o denuncia, antes de que salga (o siga) en la web."
    >
      <div className="mb-4">
        <Filtros<Tab>
          valor={tab}
          onCambiar={(t) => router.replace(t === "flyers" ? "/admin/moderacion?tab=flyers" : "/admin/moderacion", { scroll: false })}
          opciones={[
            { clave: "resenas", label: "Reseñas", n: cuentas.resenas },
            { clave: "flyers", label: "Flyers denunciados", n: cuentas.flyers },
          ]}
        />
      </div>
      {tab === "resenas" ? <ColaResenas alCambiar={contar} /> : <ColaFlyers alCambiar={contar} />}
    </SeccionPanel>
  );
}

/* ------------------------------ Reseñas ------------------------------ */

function ColaResenas({ alCambiar }: { alCambiar: () => void }) {
  const p = usePaginado<Resena>(consultaResenasPendientes, ["resenas"], 25);
  const [accion, setAccion] = useState<{ r: Resena; aprobar: boolean } | null>(null);
  const [motivo, setMotivo] = useState<MotivoRechazo | null>(null);
  const [obrando, setObrando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const abrir = (r: Resena, aprobar: boolean) => { setAccion({ r, aprobar }); setMotivo(null); };

  /**
   * NO se quita de la lista antes de tiempo. Con seguridad de fila, un update
   * que no alcanza ninguna fila responde bien sin escribir nada: la reseña
   * desaparecía de la pantalla y seguía pendiente para siempre.
   */
  const confirmar = async () => {
    if (!accion) return;
    if (!accion.aprobar && !motivo) return;
    setObrando(true); setError(""); setOk("");
    const res = await moderarResena(accion.r.id, accion.aprobar, motivo ?? undefined);
    setObrando(false);
    if (!res.ok) { setAccion(null); setError(res.error ?? "No se pudo moderar."); return; }
    setOk(accion.aprobar ? "Reseña aprobada: ya se ve en la ficha." : `Reseña rechazada por «${etiquetaMotivo(motivo)}». Su autor verá el motivo.`);
    p.quitar((x) => x.id === accion.r.id);
    setAccion(null);
    alCambiar();
    if (p.filas.length === 1 && p.total > 1) p.recargar();
  };

  return (
    <>
      {error && <Aviso>{error}</Aviso>}
      {ok && <Aviso tono="ok">{ok}</Aviso>}
      <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length} vacio="No hay reseñas por moderar. Todo al día." />

      <ul className={`flex flex-col gap-3 ${p.cargando ? "opacity-60" : ""}`}>
        {p.filas.map((r) => {
          const apelada = r.estado === "apelada";
          const enlace = r.objetivo_tipo === "dj" ? `/djs/${r.objetivo_id}` : `/locales/${r.objetivo_id}`;
          return (
            <li key={r.id} className={`rounded-2xl border bg-white p-4 shadow-tarjeta md:p-5 ${apelada ? "border-aviso/40" : "border-linea"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[17px] font-bold">{r.profiles?.display_name || "Tardícola"}</p>
                <span className="inline-flex items-center gap-0.5 text-[15px] font-bold" aria-label={`${r.puntuacion} de 5 estrellas`}>
                  {r.puntuacion} <Star size={15} className="text-oro" fill="currentColor" aria-hidden />
                </span>
                {apelada ? <Etiqueta tono="aviso"><Undo2 size={13} aria-hidden /> Apelada</Etiqueta> : <Etiqueta>Nueva</Etiqueta>}
              </div>
              <p className="mt-1 text-[15px] text-tinta-suave">
                Reseña a un {r.objetivo_tipo === "dj" ? "DJ" : "local"} · {new Date(r.created_at).toLocaleDateString("es-ES")} ·{" "}
                <Link href={enlace} target="_blank" className="inline-flex items-center gap-1 font-semibold text-magenta-700 hover:underline">
                  ver la ficha <ExternalLink size={13} aria-hidden />
                </Link>
              </p>
              <p className="mt-2 text-base">{r.comentario || <span className="text-tinta-suave">Sin comentario, solo puntuación.</span>}</p>

              {/* Una apelación llega con su historia: qué se decidió, por qué y
                  qué contesta. Sin eso se decide a ciegas. */}
              {apelada && (
                <div className="mt-3 rounded-xl bg-aviso-fondo p-3">
                  <p className="text-sm font-bold text-aviso">Apela el rechazo por «{etiquetaMotivo(r.motivo_rechazo)}»</p>
                  <p className="mt-1 text-[15px]">{r.apelacion}</p>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Boton tamano="pequeno" onClick={() => abrir(r, true)}><Check size={18} aria-hidden /> Aprobar</Boton>
                <Boton tamano="pequeno" variante="contorno" onClick={() => abrir(r, false)}><X size={18} aria-hidden /> Rechazar</Boton>
              </div>
            </li>
          );
        })}
      </ul>

      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />

      <Hoja
        abierta={!!accion}
        onCerrar={() => !obrando && setAccion(null)}
        titulo={accion?.aprobar ? "¿Aprobar la reseña?" : "¿Por qué se rechaza?"}
        pie={
          <div className="grid gap-2">
            {accion?.aprobar
              ? <Boton ancho cargando={obrando} onClick={confirmar}>Sí, publicarla</Boton>
              : <Boton variante="peligro" ancho cargando={obrando} disabled={!motivo} onClick={confirmar}>Rechazar la reseña</Boton>}
            <Boton variante="contorno" ancho disabled={obrando} onClick={() => setAccion(null)}>Cancelar</Boton>
          </div>
        }
      >
        {accion?.aprobar ? (
          <p className="text-base">La reseña de <strong>{accion.r.profiles?.display_name || "Tardícola"}</strong> se publica en la ficha y cuenta para la nota media.</p>
        ) : (
          <fieldset>
            <legend className="mb-3 text-[15px] text-tinta-suave">El autor verá este motivo y podrá apelar.</legend>
            <div className="flex flex-col gap-2">
              {MOTIVOS_RECHAZO.map((m) => (
                <label key={m.k}
                  className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-4 text-base font-semibold transition-colors ${
                    motivo === m.k ? "border-magenta bg-magenta-50" : "border-linea-fuerte bg-white hover:bg-marfil"}`}>
                  <input type="radio" name="motivo" value={m.k} checked={motivo === m.k} onChange={() => setMotivo(m.k)} className="h-5 w-5 accent-magenta" />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </Hoja>
    </>
  );
}

/* ------------------------------ Flyers ------------------------------ */

function ColaFlyers({ alCambiar }: { alCambiar: () => void }) {
  const p = usePaginado<Denuncia>(consultaDenunciasPendientes, ["flyers"], 25);
  const [accion, setAccion] = useState<{ d: Denuncia; estado: "retirado" | "desestimado" } | null>(null);
  const [obrando, setObrando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  /**
   * Se espera a que la base confirme: una denuncia que parece resuelta y no lo
   * está desaparece de la cola y nadie vuelve a mirarla.
   */
  const confirmar = async () => {
    if (!accion) return;
    setObrando(true); setError(""); setOk("");
    const r = await resolverDenuncia(accion.d.id, accion.estado, "");
    setObrando(false);
    if (!r.ok) { setAccion(null); setError(r.error ?? "No se pudo resolver."); return; }
    setOk(accion.estado === "retirado"
      ? "Denuncia aceptada. Avisa al local para que cambie el flyer."
      : "Denuncia desestimada: el flyer se queda como está.");
    p.quitar((x) => x.id === accion.d.id);
    setAccion(null);
    alCambiar();
    if (p.filas.length === 1 && p.total > 1) p.recargar();
  };

  return (
    <>
      {error && <Aviso>{error}</Aviso>}
      {ok && <Aviso tono="ok">{ok}</Aviso>}
      <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length} vacio="No hay flyers denunciados. Todo al día." />

      <ul className={`flex flex-col gap-3 ${p.cargando ? "opacity-60" : ""}`}>
        {p.filas.map((d) => {
          const motivo = MOTIVOS.find((m) => m.k === d.motivo);
          // La prueba es la que se guardó AL DENUNCIAR, no la de ahora: si el
          // local ha cambiado el flyer, hay que ver el denunciado.
          const prueba = d.flyer_url ?? d.tardeos?.flyer_url ?? null;
          const cambiado = Boolean(d.flyer_url && d.tardeos?.flyer_url && d.flyer_url !== d.tardeos.flyer_url);
          return (
            <li key={d.id} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-5">
              <div className="flex gap-4">
                {prueba ? (
                  <a href={prueba} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label="Ver el flyer denunciado a tamaño completo">
                    {/* eslint-disable-next-line @next/next/no-img-element -- es una prueba congelada, no una imagen del producto */}
                    <img src={prueba} alt="" className="h-32 w-24 rounded-xl object-cover ring-1 ring-linea" />
                  </a>
                ) : (
                  <span className="grid h-32 w-24 shrink-0 place-items-center rounded-xl bg-marfil-100 text-center text-sm text-tinta-suave">Sin imagen</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[17px] font-bold leading-tight">
                    <Flag size={16} className="shrink-0 text-magenta" aria-hidden /> {motivo?.label ?? d.motivo}
                  </p>
                  <p className="mt-1 text-[15px] font-semibold">{d.tardeos?.titulo ?? "Tardeo borrado"}</p>
                  <p className="text-sm text-tinta-suave">
                    Denunciado el {new Date(d.created_at).toLocaleDateString("es-ES")}
                    {d.tardeos?.fecha ? ` · tardeo del ${new Date(d.tardeos.fecha + "T12:00:00").toLocaleDateString("es-ES")}` : ""}
                  </p>
                  {d.mensaje && <p className="mt-2 rounded-xl bg-marfil-100 p-3 text-[15px]">«{d.mensaje}»</p>}
                  {cambiado && (
                    <p className="mt-2 text-sm font-semibold text-aviso">El local ha cambiado el flyer desde la denuncia. La imagen es la denunciada.</p>
                  )}
                  <Link href={`/tardeos/${d.tardeo_id}`} target="_blank"
                    className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 text-[15px] font-semibold text-magenta-700 hover:underline">
                    Ver el tardeo <ExternalLink size={14} aria-hidden />
                  </Link>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Boton tamano="pequeno" onClick={() => setAccion({ d, estado: "retirado" })}><Check size={18} aria-hidden /> Tienen razón</Boton>
                <Boton tamano="pequeno" variante="contorno" onClick={() => setAccion({ d, estado: "desestimado" })}><X size={18} aria-hidden /> El flyer está bien</Boton>
              </div>
            </li>
          );
        })}
      </ul>

      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />

      <Hoja
        abierta={!!accion}
        onCerrar={() => !obrando && setAccion(null)}
        titulo={accion?.estado === "retirado" ? "¿Dar la razón a la denuncia?" : "¿Desestimar la denuncia?"}
        pie={
          <div className="grid gap-2">
            <Boton ancho cargando={obrando} onClick={confirmar}>
              {accion?.estado === "retirado" ? "Sí, tienen razón" : "Sí, el flyer está bien"}
            </Boton>
            <Boton variante="contorno" ancho disabled={obrando} onClick={() => setAccion(null)}>Cancelar</Boton>
          </div>
        }
      >
        {accion?.estado === "retirado" ? (
          <p className="text-base">
            La denuncia se cierra como aceptada. El flyer <strong>no se quita solo</strong>: pide al local que lo cambie
            o edítalo tú desde el tardeo.
          </p>
        ) : (
          <p className="text-base">La denuncia se cierra y el flyer de <strong>{accion?.d.tardeos?.titulo ?? "este tardeo"}</strong> sigue publicado.</p>
        )}
      </Hoja>
    </>
  );
}
