"use client";

import { useState } from "react";
import { LifeBuoy, Check } from "lucide-react";
import Hoja from "@/components/ui/Hoja";
import Boton from "@/components/Boton";
import { claseCampo } from "@/components/ui/Campo";
import { supabase } from "@/lib/supabase";

/**
 * «Necesito ayuda» del formulario de publicar (dossier pág. 11 y 15): abre una
 * incidencia con la referencia del borrador (y una copia del borrador, lote 68)
 * sin perder lo escrito, que además queda guardado en este navegador.
 */
export default function AyudaBorrador({ userId, referencia, borrador }: {
  userId: string; referencia: string; borrador: Record<string, unknown>;
}) {
  const [abierta, setAbierta] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState("");

  const enviar = async () => {
    const mensaje = `Necesito ayuda publicando un evento («${String(borrador.titulo || "sin título")}»). ${texto.trim()}`.trim();
    setEnviando(true); setError("");
    const base = { profile_id: userId, tipo: "duda", mensaje: mensaje.slice(0, 2000), url: window.location.pathname + window.location.search };
    let { error: e } = await supabase.from("incidencias").insert({ ...base, referencia, borrador });
    // Sin el lote 68 no existen `referencia`/`borrador`: se manda sin ellas.
    if (e && /referencia|borrador/.test(e.message ?? "")) ({ error: e } = await supabase.from("incidencias").insert(base));
    setEnviando(false);
    if (e) { setError(e.message); return; }
    setHecho(true);
  };

  return (
    <>
      <button type="button" onClick={() => { setAbierta(true); setHecho(false); }}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 text-[15px] font-bold text-magenta-700">
        <LifeBuoy size={18} aria-hidden /> Necesito ayuda
      </button>
      <Hoja abierta={abierta} onCerrar={() => !enviando && setAbierta(false)} titulo="Necesito ayuda"
        pie={hecho ? <Boton ancho onClick={() => setAbierta(false)}>Volver al formulario</Boton> : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="contorno" onClick={() => setAbierta(false)} disabled={enviando}>Cancelar</Boton>
            <Boton onClick={enviar} cargando={enviando}>Enviar al equipo</Boton>
          </div>
        )}>
        {hecho ? (
          <p className="flex items-start gap-2 text-[16px]"><Check size={20} className="mt-0.5 shrink-0 text-ok" aria-hidden />
            Recibido. El equipo ve tu borrador y te contesta pronto. Lo que has escrito sigue aquí.</p>
        ) : (
          <>
            <p className="text-[15px] text-tinta-suave">Mandamos al equipo lo que llevas escrito para que te ayude. No pierdes nada: el borrador se queda guardado.</p>
            <label className="mt-3 block text-[15px] font-semibold" htmlFor="ayuda-texto">¿Con qué te ayudamos? (opcional)</label>
            <textarea id="ayuda-texto" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} className={`${claseCampo} mt-1`}
              placeholder="Ej.: no sé cómo poner el enlace de entradas" />
            {error && <p role="alert" className="mt-2 text-[15px] font-semibold text-error">{error}</p>}
          </>
        )}
      </Hoja>
    </>
  );
}
