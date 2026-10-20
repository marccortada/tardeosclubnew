"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { UserPlus, UserMinus, Loader2, X, Link2, Copy, Check, MessageCircle } from "lucide-react";
import { claseCampo } from "@/components/ui/Campo";
import { MARCA } from "@/lib/marca";

/**
 * Enlaza una ficha creada por el admin (local o DJ) con la cuenta de su dueño.
 * Dos caminos, según si la persona ya está registrada:
 *
 *  - Asignar: buscas su cuenta por email y la enlazas al momento.
 *  - Invitar: generas un enlace con token que abre ella. Al abrirlo estando
 *    dentro, la ficha pasa a su nombre. Sirve cuando todavía no tiene cuenta.
 *
 * El enlace se copia y se manda por donde quieras (WhatsApp, email...). No lo
 * enviamos nosotros: eso necesitaría Resend configurado.
 *
 * Si la ficha YA tiene dueño se puede cambiar (mismo formulario) o quitar.
 * Todas las escrituras piden la fila de vuelta: si la RLS no deja, la base no
 * da error sino 0 filas, y eso no puede pasar por "asignado".
 */
export default function AsignarDueno({
  tabla,
  campo,
  id,
  duenoEmail,
  onAsignado,
  onQuitado,
}: {
  tabla: "locales" | "djs";
  campo: "owner_id" | "profile_id";
  id: string;
  duenoEmail: string | null;
  onAsignado: (email: string) => void;
  /** Se ha quitado el dueño. Sin esta prop no se ofrece quitarlo. */
  onQuitado?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [invitando, setInvitando] = useState(false);
  const [enlace, setEnlace] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState("");
  const [quitar, setQuitar] = useState<"" | "confirmar" | "quitando">("");

  const asignar = async () => {
    const buscado = email.trim();
    if (!buscado) { setError("Escribe el email."); return; }
    setGuardando(true); setError("");

    const { data: perfiles, error: eBusca } = await supabase
      .from("profiles").select("id,email").ilike("email", buscado).limit(1);

    if (eBusca) { setGuardando(false); setError(eBusca.message); return; }
    const perfil = perfiles?.[0];
    if (!perfil) {
      setGuardando(false);
      setError("No hay ninguna cuenta con ese email. Genera un enlace de invitación.");
      return;
    }

    const { data: filas, error: eUpd } = await supabase
      .from(tabla).update({ [campo]: perfil.id }).eq("id", id).select("id");
    setGuardando(false);
    if (eUpd) { setError(eUpd.message); return; }
    if (!filas?.length) { setError("La base no guardó el cambio (¿sesión de admin caducada?). Recarga y vuelve a probar."); return; }

    onAsignado(perfil.email ?? buscado);
    setAbierto(false);
    setEmail("");
  };

  const invitar = async () => {
    setInvitando(true); setError("");
    const { data: sesion } = await supabase.auth.getUser();
    const { data, error: eInv } = await supabase
      .from("invitaciones")
      .insert({
        tipo: tabla === "locales" ? "local" : "dj",
        ficha_id: id,
        email: email.trim() || null,
        creada_por: sesion.user?.id ?? null,
      })
      .select("token")
      .single();
    setInvitando(false);
    if (eInv) { setError(eInv.message); return; }
    setEnlace(`${window.location.origin}/reclamar?token=${data.token}`);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar. Selecciona el enlace a mano.");
    }
  };

  const quitarDueno = async () => {
    setQuitar("quitando"); setError("");
    const { data: filas, error: e } = await supabase.from(tabla).update({ [campo]: null }).eq("id", id).select("id");
    if (e || !filas?.length) {
      setQuitar("confirmar");
      setError(e ? e.message : "La base no guardó el cambio (¿sesión de admin caducada?).");
      return;
    }
    setQuitar("");
    onQuitado?.();
  };

  if (duenoEmail && !abierto) {
    const fino = "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold";
    return (
      <div className="min-w-0">
        <p className="truncate text-sm text-tinta-suave" title={duenoEmail}>Dueño: <span className="font-semibold text-tinta">{duenoEmail}</span></p>
        {quitar ? (
          <div className="mt-1 rounded-xl border border-error/30 bg-error-fondo p-2">
            <p className="text-sm font-semibold text-error">¿Quitar a {duenoEmail}? Dejará de poder gestionar la ficha.</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <button onClick={quitarDueno} disabled={quitar === "quitando"} className={`${fino} bg-error text-white disabled:opacity-60`}>
                {quitar === "quitando" && <Loader2 size={16} className="animate-spin" aria-hidden />} Sí, quitar
              </button>
              <button onClick={() => { setQuitar(""); setError(""); }} disabled={quitar === "quitando"} className={`${fino} text-tinta-suave hover:bg-superficie`}>No</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            <button onClick={() => { setAbierto(true); setError(""); }} className={`${fino} text-magenta-700 hover:bg-magenta-50`}>
              <UserPlus size={16} aria-hidden /> Cambiar
            </button>
            {onQuitado && (
              <button onClick={() => setQuitar("confirmar")} className={`${fino} text-tinta-suave hover:bg-marfil-100 hover:text-error`}>
                <UserMinus size={16} aria-hidden /> Quitar
              </button>
            )}
          </div>
        )}
        {error && <p role="alert" className="mt-1 text-sm font-semibold text-error">{error}</p>}
      </div>
    );
  }

  if (!abierto) {
    return (
      <button
        onClick={() => { setAbierto(true); setError(""); }}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-magenta-700 hover:bg-magenta-50"
      >
        <UserPlus size={16} aria-hidden /> Sin dueño · asignar o invitar
      </button>
    );
  }

  const btn = "inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:opacity-50";

  return (
    <div className="mt-1 rounded-xl border border-linea bg-marfil p-3">
      {enlace ? (
        <>
          <p className="mb-1.5 text-sm font-semibold">Enlace de invitación (caduca en 30 días):</p>
          <input
            readOnly
            value={enlace}
            aria-label="Enlace de invitación"
            onFocus={(e) => e.currentTarget.select()}
            className={`${claseCampo} !min-h-[44px] !px-3 !py-2 text-base`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={copiar} className={`${btn} bg-magenta text-white hover:bg-magenta-600`}>
              {copiado ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copiado ? "Copiado" : "Copiar"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hola. Este es tu enlace para gestionar tu ficha en ${MARCA.nombre} (entra con tu cuenta o créala): ${enlace}`)}`}
              target="_blank" rel="noopener noreferrer"
              className={`${btn} border border-linea-fuerte bg-white hover:bg-marfil-100`}
            >
              <MessageCircle size={16} aria-hidden /> WhatsApp
            </a>
            <button
              onClick={() => { setAbierto(false); setEnlace(""); setError(""); }}
              className={`${btn} text-tinta-suave hover:bg-marfil-100`}
            >
              <X size={16} aria-hidden /> Cerrar
            </button>
          </div>
          <p className="mt-2 text-sm text-tinta-suave">
            Al abrirlo con su cuenta, la ficha pasa a su nombre.
          </p>
        </>
      ) : (
        <>
          <label htmlFor={`dueno-${id}`} className="mb-1.5 block text-sm font-semibold">{duenoEmail ? "Email del nuevo dueño" : "Email de su cuenta"}</label>
          <div className="flex items-center gap-2">
            <input
              id={`dueno-${id}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && asignar()}
              placeholder="nombre@ejemplo.com"
              autoFocus
              className={`${claseCampo} !min-h-[44px] !px-3 !py-2 text-base`}
            />
            <button onClick={asignar} disabled={guardando} className={`${btn} bg-magenta text-white hover:bg-magenta-600`}>
              {guardando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : "Asignar"}
            </button>
            <button
              onClick={() => { setAbierto(false); setError(""); }}
              aria-label="Cancelar"
              className={`${btn} !px-2 text-tinta-suave hover:bg-marfil-100`}
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          <button
            onClick={invitar}
            disabled={invitando}
            className={`${btn} mt-1 !px-0 text-magenta-700 hover:underline`}
          >
            {invitando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Link2 size={16} aria-hidden />}
            ¿Todavía no tiene cuenta? Genera un enlace
          </button>
        </>
      )}
      {error && <p role="alert" className="mt-1.5 text-sm font-semibold text-error">{error}</p>}
    </div>
  );
}
