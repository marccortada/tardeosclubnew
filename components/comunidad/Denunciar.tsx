"use client";

import { useState } from "react";
import Hoja from "@/components/ui/Hoja";
import Boton from "@/components/Boton";
import { claseCampo } from "@/components/ui/Campo";
import { denunciarContenido, MOTIVOS_COMUNIDAD, type MotivoComunidad, type TipoObjeto } from "@/lib/denuncias";

/**
 * Hoja para denunciar un mensaje, hilo, respuesta o anuncio. Va a la cola
 * genérica (/admin/denuncias). Con 3 denuncias el contenido se retiene solo
 * hasta que alguien del equipo lo revisa (lote 66).
 */
export default function Denunciar({
  abierta, onCerrar, tipo, objetoId,
}: { abierta: boolean; onCerrar: () => void; tipo: TipoObjeto; objetoId: string }) {
  const [motivo, setMotivo] = useState<MotivoComunidad>("spam");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);

  async function enviar() {
    setEnviando(true);
    const r = await denunciarContenido(tipo, objetoId, motivo, mensaje);
    setEnviando(false);
    setEstado(r.error ? { ok: false, texto: r.error } : { ok: true, texto: "Gracias. El equipo lo revisará." });
  }

  function cerrar() { setEstado(null); setMensaje(""); onCerrar(); }

  return (
    <Hoja abierta={abierta} onCerrar={cerrar} titulo="Denunciar"
      pie={estado?.ok
        ? <Boton ancho onClick={cerrar}>Cerrar</Boton>
        : <Boton ancho cargando={enviando} onClick={enviar}>Enviar denuncia</Boton>}>
      {estado?.ok ? (
        <p className="text-[16px]">{estado.texto}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[15px] text-tinta-suave">¿Qué pasa con este contenido?</p>
          <div className="space-y-2" role="radiogroup">
            {MOTIVOS_COMUNIDAD.map((m) => (
              <label key={m.k} className={`flex min-h-tacto cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 text-[15px] ${motivo === m.k ? "border-magenta bg-magenta-50" : "border-linea"}`}>
                <input type="radio" name="motivo" checked={motivo === m.k} onChange={() => setMotivo(m.k)} className="accent-magenta" />
                {m.label}
              </label>
            ))}
          </div>
          <textarea aria-label="Detalles de la denuncia (opcional)" className={claseCampo} rows={2} maxLength={500} placeholder="Detalles (opcional)"
            value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
          {estado && !estado.ok && <p role="alert" className="text-[15px] font-semibold text-error">{estado.texto}</p>}
        </div>
      )}
    </Hoja>
  );
}
