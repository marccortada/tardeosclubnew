"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Heart, ExternalLink, Loader2, Clock, MessageCircle } from "lucide-react";
import type { Tardeo } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { esFavorito, setFavorito } from "@/lib/tardeos";
import { asistire, retirarAsistencia, getMiAsistencia, getQuienesVan, type MiAsistencia, type QuienesVan } from "@/lib/tardicola";
import { medir } from "@/lib/metricas";

/**
 * Lo que quería hacer quien pulsó Asistiré/Guardar sin sesión. Se guarda en
 * sessionStorage (solo esta pestaña) con el id del tardeo y caducidad corta:
 * al volver a la ficha ya con cuenta se hace una sola vez, y si vuelve mucho
 * más tarde no se apunta a nada que ya no recuerde.
 */
type Accion = "asistire" | "guardar";
const CLAVE_INTENCION = "tc_intencion_tardeo";
const VIDA_INTENCION_MS = 15 * 60 * 1000;

function guardarIntencion(id: string, accion: Accion) {
  try { sessionStorage.setItem(CLAVE_INTENCION, JSON.stringify({ id, accion, hasta: Date.now() + VIDA_INTENCION_MS })); } catch { /* sin almacenamiento: se pulsa a mano */ }
}
/** La lee y la borra (una sola vez). Solo si es de este tardeo y no ha caducado. */
function tomarIntencion(id: string): Accion | null {
  try {
    const raw = sessionStorage.getItem(CLAVE_INTENCION);
    if (!raw) return null;
    const v = JSON.parse(raw) as { id?: string; accion?: string; hasta?: number };
    if (v.id !== id) return null; // es de otro tardeo: se deja para su ficha
    sessionStorage.removeItem(CLAVE_INTENCION);
    if (!v.hasta || v.hasta < Date.now()) return null;
    return v.accion === "asistire" || v.accion === "guardar" ? v.accion : null;
  } catch { return null; }
}

/**
 * Quiénes van + Meet Zone + Asistiré / Guardar / Comprar (dossier pág. 5).
 *
 * Asistiré vale para TODOS los eventos: confirma al momento si hay plaza o
 * deja en lista de espera (lo decide la base, lote 64). Comprar abre el
 * enlace autorizado: un clic no es una venta ni una confirmación. Guardar es
 * interés privado (Próxima Parada) y no confirma nada.
 */
export default function AccionTardeo({ tardeo, activo = true }: { tardeo: Tardeo; activo?: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const [mia, setMia] = useState<MiAsistencia>({ estado: null, puesto: null });
  const [fav, setFav] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [hecho, setHecho] = useState("");
  const [van, setVan] = useState<QuienesVan | null>(null);
  const [verLista, setVerLista] = useState(false);

  useEffect(() => {
    if (!user) { setFav(false); setMia({ estado: null, puesto: null }); return; }
    // Se toma aquí (y se borra) para que StrictMode, que repite el efecto, no la haga dos veces.
    const pendiente = activo ? tomarIntencion(tardeo.id) : null;
    Promise.all([esFavorito(user.id, tardeo.id), getMiAsistencia(user.id, tardeo.id)]).then(async ([f, m]) => {
      setFav(f); setMia(m);
      if (pendiente === "guardar") {
        if (f) { setHecho("Ya lo tenías guardado en Próxima Parada."); return; }
        const { error } = await setFavorito(user.id, tardeo.id, true);
        if (error) { setAviso("No se pudo guardar. Inténtalo otra vez."); return; }
        setFav(true); setHecho("Guardado en tu Próxima Parada.");
        medir("favorito", { tardeoId: tardeo.id });
      } else if (pendiente === "asistire") {
        if (m.estado === "apuntado" || m.estado === "espera") { setHecho("Ya tenías tu Asistiré en este plan."); return; }
        setOcupado(true);
        const { r, error } = await asistire(user.id, tardeo.id);
        setOcupado(false);
        if (error || !r) { setAviso("No se pudo guardar tu Asistiré. Pulsa Asistiré otra vez."); return; }
        setMia(r);
        setHecho(r.estado === "espera"
          ? `El plan está lleno: estás en la lista de espera${r.puesto ? ` (puesto ${r.puesto})` : ""}.`
          : "¡Hecho! Asistiré confirmado.");
        medir("inscripcion", { tardeoId: tardeo.id, detalle: r.estado ?? undefined });
        getQuienesVan(tardeo.id).then(setVan);
      }
    });
  }, [user, tardeo.id, activo]);
  useEffect(() => { getQuienesVan(tardeo.id).then(setVan); }, [tardeo.id]);

  // Tras pedir cuenta se vuelve a esta ficha y la acción pendiente se hace sola.
  const pedirLogin = (accion: Accion) => {
    guardarIntencion(tardeo.id, accion);
    router.push(`/perfil?volver=${encodeURIComponent(`/tardeos/${tardeo.id}`)}`);
  };
  const confirmado = mia.estado === "apuntado";
  const enEspera = mia.estado === "espera";

  const pulsarAsistire = async () => {
    if (!user) return pedirLogin("asistire");
    if (confirmado || enEspera) return;
    setOcupado(true); setAviso(""); setHecho("");
    const { r, error } = await asistire(user.id, tardeo.id);
    if (error) setAviso(error === "Lista llena. La lista de espera llega con el lote 64." ? error : "No se pudo guardar tu Asistiré. Inténtalo otra vez.");
    else if (r) {
      setMia(r);
      medir("inscripcion", { tardeoId: tardeo.id, detalle: r.estado ?? undefined });
      getQuienesVan(tardeo.id).then(setVan);
    }
    setOcupado(false);
  };

  const retirar = async () => {
    if (!user) return;
    setOcupado(true); setAviso(""); setHecho("");
    const { error } = await retirarAsistencia(user.id, tardeo.id);
    if (error) setAviso("No se pudo retirar. Inténtalo otra vez.");
    else { setMia({ estado: "cancelado", puesto: null }); getQuienesVan(tardeo.id).then(setVan); }
    setOcupado(false);
  };

  const toggleFav = async () => {
    if (!user) return pedirLogin("guardar");
    const n = !fav;
    setFav(n); setAviso(""); setHecho("");
    const { error } = await setFavorito(user.id, tardeo.id, n);
    if (error) { setFav(!n); setAviso("No se pudo guardar. Inténtalo otra vez."); return; }
    if (n) medir("favorito", { tardeoId: tardeo.id });
  };

  const comprar = () => {
    if (!tardeo.urlEntradas) return;
    medir(tardeo.tipoEntrada === "lista" ? "clic_lista" : "clic_entrada", { tardeoId: tardeo.id, destino: tardeo.urlEntradas });
    window.open(tardeo.urlEntradas, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Quiénes van: solo alias y foto (perfil_publico). */}
      {van && !van.falta && (
        <section aria-labelledby="quienes">
          <div className="flex items-center justify-between">
            <h2 id="quienes" className="text-[22px] font-bold text-tinta">Quiénes van</h2>
            {van.total > 0 && (
              <button type="button" onClick={() => setVerLista((v) => !v)} className="min-h-[44px] px-1 text-[15px] font-semibold text-magenta-700 dark:text-magenta-400">
                {verLista ? "Ocultar" : "Ver lista"}
              </button>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3">
            {van.perfiles.length > 0 && (
              <div className="flex -space-x-2">
                {van.perfiles.slice(0, 3).map((p, i) => <Avatar key={i} alias={p.alias} url={p.avatar_url} />)}
              </div>
            )}
            <p className="text-[15px] text-tinta-suave">
              {van.total === 0 ? "Aún no hay nadie confirmado. ¡Sé el primero!" : `${van.total} ${van.total === 1 ? "persona confirmada" : "personas confirmadas"}`}
            </p>
          </div>
          {verLista && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {van.perfiles.map((p, i) => (
                <li key={i} className="inline-flex items-center gap-2 rounded-full bg-marfil-100 py-1 pl-1 pr-3 text-[15px] text-tinta">
                  <Avatar alias={p.alias} url={p.avatar_url} /> {p.alias}
                </li>
              ))}
              {van.total > van.perfiles.length && <li className="self-center text-[15px] text-tinta-suave">y {van.total - van.perfiles.length} más</li>}
            </ul>
          )}
        </section>
      )}

      {/* Meet Zone (equipo C): solo con Asistiré confirmado. La espera no la abre. */}
      <section className="rounded-3xl border border-linea bg-superficie p-4">
        <p className="flex items-center gap-2 text-[17px] font-bold text-tinta"><MessageCircle size={19} className="text-magenta" aria-hidden /> Meet Zone</p>
        <p className="text-[15px] text-tinta-suave">Conecta con quienes van a este plan</p>
        {confirmado ? (
          <Link href={`/tardeos/${tardeo.id}/meet`} className="mt-3 flex min-h-[48px] items-center justify-center rounded-2xl border border-linea-fuerte bg-superficie text-[16px] font-bold text-tinta hover:bg-marfil-100">
            Entrar a Meet Zone
          </Link>
        ) : (
          <p className="mt-3 flex min-h-[48px] items-center justify-center rounded-2xl border border-dashed border-linea-fuerte text-center text-[15px] font-semibold text-tinta-suave">
            {enEspera ? "Se abre cuando pases a confirmado" : "Confirma Asistiré para entrar"}
          </p>
        )}
      </section>

      {aviso && <p role="alert" className="rounded-xl bg-error-fondo px-3 py-2 text-[15px] font-semibold text-error">{aviso}</p>}
      {hecho && <p role="status" className="rounded-xl bg-ok-fondo px-3 py-2 text-[15px] font-semibold text-ok">{hecho}</p>}

      {activo && (
        <>
          <div className="grid grid-cols-[1.4fr_1fr] gap-3">
            <button type="button" onClick={pulsarAsistire} disabled={ocupado} aria-pressed={confirmado || enEspera}
              className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-3 text-[16px] font-bold transition active:scale-[0.98] disabled:opacity-70 ${
                enEspera ? "border border-aviso/40 bg-aviso-fondo text-aviso" : "bg-magenta text-white"}`}>
              {ocupado ? <Loader2 size={20} className="animate-spin" aria-hidden />
                : confirmado ? <><Check size={19} aria-hidden /> Asistiré · Confirmado</>
                : enEspera ? <><Clock size={18} aria-hidden /> En lista de espera{mia.puesto ? ` (puesto ${mia.puesto})` : ""}</>
                : "Asistiré"}
            </button>
            <button type="button" onClick={toggleFav} aria-pressed={fav}
              className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border text-[16px] font-bold transition ${fav ? "border-magenta bg-magenta-50 text-magenta-700" : "border-linea-fuerte bg-superficie text-tinta"}`}>
              <Heart size={18} fill={fav ? "currentColor" : "none"} aria-hidden /> {fav ? "Guardado" : "Guardar"}
            </button>
          </div>
          {(confirmado || enEspera) && (
            <button type="button" onClick={retirar} disabled={ocupado} className="-mt-2 min-h-[44px] self-center text-[15px] font-semibold text-tinta-suave underline underline-offset-2">
              {confirmado ? "Ya no puedo ir: retirar mi Asistiré" : "Salir de la lista de espera"}
            </button>
          )}
          {tardeo.urlEntradas && (
            <button type="button" onClick={comprar}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-linea-fuerte bg-superficie text-[16px] font-bold text-tinta hover:bg-marfil-100">
              {tardeo.tipoEntrada === "lista" ? "Apuntarme a la lista" : "Comprar entrada"} <ExternalLink size={16} aria-hidden />
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Avatar({ alias, url }: { alias: string; url: string | null }) {
  return url ? (
    <Image src={url} alt={alias} width={36} height={36} className="h-9 w-9 rounded-full border-2 border-superficie object-cover" />
  ) : (
    <span aria-label={alias} className="grid h-9 w-9 place-items-center rounded-full border-2 border-superficie bg-magenta-100 text-[14px] font-bold text-magenta-700">
      {alias.charAt(0).toUpperCase()}
    </span>
  );
}
