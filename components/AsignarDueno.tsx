"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { UserPlus, Loader2, X, Link2, Copy, Check } from "lucide-react";

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
 */
export default function AsignarDueno({
  tabla,
  campo,
  id,
  duenoEmail,
  onAsignado,
}: {
  tabla: "locales" | "djs";
  campo: "owner_id" | "profile_id";
  id: string;
  duenoEmail: string | null;
  onAsignado: (email: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [invitando, setInvitando] = useState(false);
  const [enlace, setEnlace] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState("");

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

    const { error: eUpd } = await supabase
      .from(tabla).update({ [campo]: perfil.id }).eq("id", id);
    setGuardando(false);
    if (eUpd) { setError(eUpd.message); return; }

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

  if (duenoEmail) {
    return <p className="mt-1 truncate text-xs font-bold text-oro-600">Dueño: {duenoEmail}</p>;
  }

  if (!abierto) {
    return (
      <button
        onClick={() => { setAbierto(true); setError(""); }}
        className="mt-1 inline-flex items-center gap-1 text-xs font-black text-magenta"
      >
        <UserPlus size={13} /> Sin dueño · asignar o invitar
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl bg-magenta-50 p-2">
      {enlace ? (
        <>
          <p className="mb-1 text-xs font-black text-tinta/70">
            Enlace de invitación (caduca en 30 días):
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={enlace}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border-2 border-magenta-100 bg-white px-2 py-1.5 text-xs font-semibold outline-none"
            />
            <button
              onClick={copiar}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-magenta px-3 py-1.5 text-xs font-black text-white"
            >
              {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? "Copiado" : "Copiar"}
            </button>
            <button
              onClick={() => { setAbierto(false); setEnlace(""); setError(""); }}
              aria-label="Cerrar"
              className="shrink-0 text-tinta/40 hover:text-magenta"
            >
              <X size={16} />
            </button>
          </div>
          <p className="mt-1 text-xs font-semibold text-tinta/50">
            Mándaselo por WhatsApp o email. Al abrirlo con su cuenta, la ficha pasa a su nombre.
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && asignar()}
              placeholder="email de la cuenta"
              autoFocus
              className="min-w-0 flex-1 rounded-lg border-2 border-magenta-100 bg-white px-2 py-1.5 text-sm font-semibold outline-none focus:border-magenta"
            />
            <button
              onClick={asignar}
              disabled={guardando}
              className="shrink-0 rounded-lg bg-magenta px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
            >
              {guardando ? <Loader2 size={14} className="animate-spin" /> : "Asignar"}
            </button>
            <button
              onClick={() => { setAbierto(false); setError(""); }}
              aria-label="Cancelar"
              className="shrink-0 text-tinta/40 hover:text-magenta"
            >
              <X size={16} />
            </button>
          </div>
          <button
            onClick={invitar}
            disabled={invitando}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-black text-magenta disabled:opacity-40"
          >
            {invitando ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
            ¿Todavía no tiene cuenta? Genera un enlace
          </button>
        </>
      )}
      {error && <p className="mt-1 text-xs font-bold text-magenta">{error}</p>}
    </div>
  );
}
