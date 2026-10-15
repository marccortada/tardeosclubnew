"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { entrarYVolver } from "@/lib/volver";
import Boton from "@/components/Boton";
import { claseCampo } from "@/components/ui/Campo";
import { enviarSolicitud } from "@/lib/mensajes";
import { pareceContacto, textoError } from "@/lib/meet";

/**
 * "Mensaje a <DJ>": el tardícola envía UNA solicitud con un primer mensaje.
 * El DJ la acepta o no desde /dj/mensajes. Límites (1 pendiente por DJ, 5 al
 * día, bloqueos, pausa) y filtro de teléfonos los aplica la base (lote 66).
 */
export default function MensajeADj() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [dj, setDj] = useState<{ nombre_artistico: string; avatar_url: string | null } | null | undefined>(undefined);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);

  useEffect(() => {
    supabase.from("djs").select("nombre_artistico,avatar_url").eq("id", id).maybeSingle()
      .then(({ data }) => setDj((data as { nombre_artistico: string; avatar_url: string | null } | null) ?? null));
  }, [id]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) { setError("Escribe un mensaje."); return; }
    if (pareceContacto(texto)) { setError("No se pueden compartir teléfonos ni emails. Si el DJ acepta, podréis hablar aquí."); return; }
    setEnviando(true); setError(null);
    const r = await enviarSolicitud(id, texto);
    setEnviando(false);
    if (r.error) { setError(textoError(r.error)); return; }
    setHecho(true);
  }

  const nombre = dj?.nombre_artistico ?? "DJ";
  return (
    <div className="min-h-[70vh] bg-fondo">
      <header className="sticky top-0 z-[700] flex items-center gap-2 border-b border-linea bg-superficie/95 px-2 py-1.5 backdrop-blur">
        <Link href={`/djs/${id}`} aria-label="Volver al perfil" className="grid min-h-tacto min-w-tacto place-items-center rounded-full hover:bg-marfil-100">
          <ArrowLeft size={22} aria-hidden />
        </Link>
        <h1 className="flex-1 truncate text-lg font-bold">Mensaje a {nombre}</h1>
      </header>
      <main className="mx-auto max-w-md px-4 py-6">
        {dj === undefined || loading ? (
          <p className="grid place-items-center py-12 text-tinta-suave"><Loader2 className="animate-spin" aria-label="Cargando" /></p>
        ) : dj === null ? (
          <p className="text-[16px]">Este DJ no existe o no está visible.</p>
        ) : !user ? (
          <div className="space-y-4 rounded-2xl border border-linea bg-superficie p-5">
            <p className="text-[16px]">Entra en tu cuenta para escribir a {nombre}.</p>
            <Boton href={entrarYVolver(`/djs/${id}/mensaje`)} ancho>Entrar</Boton>
          </div>
        ) : hecho ? (
          <div className="space-y-4 rounded-2xl border border-linea bg-superficie p-5">
            <p className="text-lg font-bold">Solicitud enviada</p>
            <p className="text-[16px] text-tinta-suave">{nombre} la verá en su bandeja. Si la acepta, te avisaremos y podréis hablar en Mis mensajes.</p>
            <Boton href="/mensajes" ancho>Ver mis mensajes</Boton>
            <Boton href={`/djs/${id}`} variante="contorno" ancho>Volver al perfil</Boton>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-4 rounded-2xl border border-linea bg-superficie p-5">
            <div>
              <p className="text-lg font-bold">Mensaje a {nombre}</p>
              <p className="text-[15px] text-tinta-suave">El DJ recibirá una solicitud.</p>
            </div>
            <label htmlFor="sol-texto" className="sr-only">Tu mensaje</label>
            <textarea id="sol-texto" className={claseCampo} rows={4} maxLength={500} placeholder="¡Hola! Me ha encantado tu sesión."
              value={texto} onChange={(ev) => { setTexto(ev.target.value); setError(null); }} />
            <p className="text-[13px] text-tinta-suave">Sin teléfonos ni emails. Solo un mensaje hasta que lo acepte.</p>
            {error && <p role="alert" className="text-[15px] font-semibold text-error">{error}</p>}
            <Boton type="submit" ancho cargando={enviando}>Enviar solicitud</Boton>
          </form>
        )}
      </main>
    </div>
  );
}
