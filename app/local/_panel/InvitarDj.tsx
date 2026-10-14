"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Image from "next/image";
import { BadgeCheck, Disc3, Search, Send, X } from "lucide-react";
import Boton from "@/components/Boton";
import Campo, { claseCampo } from "@/components/ui/Campo";
import Hoja from "@/components/ui/Hoja";
import { Etiqueta } from "@/components/ui/Chip";
import Aviso from "@/components/admin/Aviso";
import { useDiferido } from "@/components/panel/Paginacion";
import { supabase } from "@/lib/supabase";
import { buscarDjsDirectorio, type DjDirectorio } from "@/lib/tardeos";

type Estado = "pendiente" | "aceptada" | "rechazada";
type Invitacion = {
  id: string;
  dj_id: string;
  estado: Estado;
  created_at: string;
  djs: { nombre_artistico: string; avatar_url: string | null } | null;
};

const NOMBRE: Record<Estado, string> = { pendiente: "Pendiente", aceptada: "Aceptada", rechazada: "Rechazada" };
const TONO: Record<Estado, "aviso" | "ok" | "error"> = { pendiente: "aviso", aceptada: "ok", rechazada: "error" };

/** Postgres dice 42P01; PostgREST contesta antes con PGRST205 si no la tiene en caché. */
const faltaTabla = (code?: string) => code === "42P01" || code === "PGRST205";

/**
 * Invitar a un DJ a este tardeo (lote 55). El DJ ya no entra en el cartel sin
 * más: recibe la invitación y, si acepta, un disparador lo mete en `tardeo_djs`.
 * Aquí el local invita, ve en qué quedó cada invitación y retira las pendientes.
 */
export default function InvitarDj({ tardeoId, creadaPor }: { tardeoId: string; creadaPor?: string }) {
  const id = useId();
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinLote, setSinLote] = useState(false);
  const [errorLista, setErrorLista] = useState("");

  const [texto, setTexto] = useState("");
  const buscado = useDiferido(texto.trim(), 250);
  const [resultados, setResultados] = useState<DjDirectorio[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [elegido, setElegido] = useState<DjDirectorio | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  const [retirar, setRetirar] = useState<Invitacion | null>(null);
  const [retirando, setRetirando] = useState(false);
  const [errorRetirar, setErrorRetirar] = useState("");

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from("dj_invitaciones")
      .select("id,dj_id,estado,created_at,djs(nombre_artistico,avatar_url)")
      .eq("tardeo_id", tardeoId)
      .order("created_at", { ascending: false });
    if (error) {
      if (faltaTabla(error.code)) setSinLote(true);
      else setErrorLista(`No se pudieron cargar las invitaciones: ${error.message}`);
    } else {
      setSinLote(false);
      setErrorLista("");
      setInvitaciones((data ?? []) as unknown as Invitacion[]);
    }
    setCargando(false);
  }, [tardeoId]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    let vivo = true;
    if (buscado.length < 2) { setResultados([]); return; }
    setBuscando(true);
    buscarDjsDirectorio(buscado).then((r) => {
      if (!vivo) return;
      setResultados(r);
      setBuscando(false);
    });
    return () => { vivo = false; };
  }, [buscado]);

  // Un DJ con invitación pendiente o ya aceptada no se vuelve a ofrecer.
  const yaInvitado = new Set(invitaciones.filter((i) => i.estado !== "rechazada").map((i) => i.dj_id));

  const enviar = async () => {
    if (!elegido) return;
    setEnviando(true);
    setMensaje(null);
    const { data, error } = await supabase
      .from("dj_invitaciones")
      .insert({ tardeo_id: tardeoId, dj_id: elegido.id, ...(creadaPor ? { creada_por: creadaPor } : {}) })
      .select("id");
    setEnviando(false);
    if (error) {
      if (error.code === "23505") {
        setMensaje({ tono: "error", texto: `${elegido.nombre_artistico} ya tiene una invitación pendiente para este tardeo.` });
      } else if (faltaTabla(error.code)) {
        setSinLote(true);
      } else if (error.code === "42501") {
        setMensaje({ tono: "error", texto: "No tienes permiso para invitar DJs a este tardeo." });
      } else {
        setMensaje({ tono: "error", texto: `No se pudo enviar la invitación: ${error.message}` });
      }
      return;
    }
    if (!data || data.length === 0) {
      setMensaje({ tono: "error", texto: "La invitación no se guardó. Recarga la página e inténtalo de nuevo." });
      return;
    }
    setMensaje({ tono: "ok", texto: `Invitación enviada a ${elegido.nombre_artistico}. Saldrá en el cartel cuando la acepte.` });
    setElegido(null);
    setTexto("");
    setResultados([]);
    cargar();
  };

  const confirmarRetirar = async () => {
    if (!retirar) return;
    setRetirando(true);
    setErrorRetirar("");
    // Solo las pendientes: una ya respondida es histórico y no se toca.
    const { data, error } = await supabase
      .from("dj_invitaciones")
      .delete()
      .eq("id", retirar.id)
      .eq("estado", "pendiente")
      .select("id");
    setRetirando(false);
    if (error) { setErrorRetirar(`No se pudo retirar: ${error.message}`); return; }
    if (!data || data.length === 0) {
      setErrorRetirar("No se retiró: puede que el DJ ya haya respondido. Recargamos la lista.");
      cargar();
      return;
    }
    setInvitaciones((xs) => xs.filter((x) => x.id !== retirar.id));
    setMensaje({ tono: "ok", texto: "Invitación retirada." });
    setRetirar(null);
  };

  if (cargando) return <p className="text-[15px] text-tinta-suave">Cargando invitaciones…</p>;
  if (sinLote) {
    return <Aviso tono="aviso">Falta pegar el lote 55 en Supabase (supabase/55_invitaciones_dj.sql). Hasta entonces no se pueden invitar DJs.</Aviso>;
  }

  return (
    <div className="flex flex-col gap-4">
      {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}

      {/* Buscador: solo DJs públicos (no ocultos) del directorio. */}
      {elegido ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-magenta bg-magenta-50 p-3">
          <AvatarDj url={elegido.avatar_url} />
          <span className="flex-1 text-[16px] font-bold">{elegido.nombre_artistico}</span>
          <button type="button" onClick={() => setElegido(null)} aria-label="Elegir otro DJ"
            className="grid h-11 w-11 place-items-center rounded-xl text-tinta-suave hover:bg-white">
            <X size={20} aria-hidden />
          </button>
        </div>
      ) : (
        <div>
          <Campo etiqueta="Buscar DJ" htmlFor={id} ayuda="Escribe al menos 2 letras del nombre artístico.">
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden />
              <input id={id} value={texto} autoComplete="off" onChange={(e) => { setTexto(e.target.value); setMensaje(null); }}
                placeholder="DJ Nando" className={`${claseCampo} pl-10`} />
            </div>
          </Campo>
          {buscado.length >= 2 && (
            buscando ? <p className="mt-2 text-[15px] text-tinta-suave">Buscando…</p>
            : resultados.length === 0 ? <p className="mt-2 text-[15px] text-tinta-suave">Ningún DJ del directorio se llama así.</p>
            : (
              <ul className="mt-2 overflow-hidden rounded-xl border border-linea">
                {resultados.map((d) => {
                  const ya = yaInvitado.has(d.id);
                  return (
                    <li key={d.id} className="border-b border-linea last:border-b-0">
                      <button type="button" disabled={ya} onClick={() => setElegido(d)}
                        className="flex min-h-[48px] w-full items-center gap-3 px-3 py-1 text-left text-[16px] hover:bg-marfil-100 disabled:cursor-not-allowed disabled:opacity-60">
                        <AvatarDj url={d.avatar_url} />
                        <span className="flex-1 font-semibold">{d.nombre_artistico}</span>
                        {d.verificado && <BadgeCheck size={16} className="text-magenta" aria-label="Verificado" />}
                        {ya && <span className="text-[13px] text-tinta-suave">Ya invitado</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </div>
      )}

      <Boton onClick={enviar} disabled={!elegido} cargando={enviando}>
        <Send size={18} aria-hidden /> Enviar invitación
      </Boton>

      {/* Lo enviado para este tardeo, con su estado. */}
      <div>
        <h3 className="text-[16px] font-bold">Invitaciones enviadas</h3>
        {errorLista ? (
          <Aviso>{errorLista}</Aviso>
        ) : invitaciones.length === 0 ? (
          <p className="mt-1 text-[15px] text-tinta-suave">Aún no has invitado a ningún DJ a este tardeo.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {invitaciones.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-linea p-3">
                <AvatarDj url={i.djs?.avatar_url ?? null} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold">{i.djs?.nombre_artistico ?? "DJ"}</p>
                  <p className="text-[13px] text-tinta-suave">Enviada el {new Date(i.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}</p>
                </div>
                <Etiqueta tono={TONO[i.estado]}>{NOMBRE[i.estado]}</Etiqueta>
                {i.estado === "pendiente" && (
                  <Boton variante="contorno" tamano="pequeno" onClick={() => { setErrorRetirar(""); setRetirar(i); }}>
                    Retirar
                  </Boton>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Hoja abierta={!!retirar} onCerrar={() => !retirando && setRetirar(null)} titulo="¿Retirar la invitación?"
        pie={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="contorno" onClick={() => setRetirar(null)} disabled={retirando}>No, dejarla</Boton>
            <Boton variante="peligro" onClick={confirmarRetirar} cargando={retirando}>Sí, retirar</Boton>
          </div>
        }>
        <p className="text-[16px]">
          {retirar?.djs?.nombre_artistico ?? "El DJ"} dejará de ver esta invitación en su bandeja. Podrás volver a invitarle cuando quieras.
        </p>
        {errorRetirar && <div className="mt-3"><Aviso>{errorRetirar}</Aviso></div>}
      </Hoja>
    </div>
  );
}

function AvatarDj({ url }: { url: string | null }) {
  return url
    ? <Image src={url} alt="" width={36} height={36} unoptimized className="h-9 w-9 rounded-full object-cover" />
    : <span className="grid h-9 w-9 place-items-center rounded-full bg-magenta-50 text-magenta"><Disc3 size={18} aria-hidden /></span>;
}
