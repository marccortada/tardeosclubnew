"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, Disc3 } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { Etiqueta } from "@/components/ui/Chip";
import Boton from "@/components/Boton";
import { supabase } from "@/lib/supabase";
import { faltaLote68 } from "@/lib/tardeos";
import { formatFecha } from "@/lib/formato";
import { useFicha } from "../_panel/PanelLocal";

type Fila = {
  id: string; estado: string; mensaje: string | null; created_at: string; dj_id: string; dj_nombre: string;
  dj_avatar: string | null; tardeo_id: string; titulo: string; fecha: string;
};

/**
 * Bandeja del organizador (dossier pág. 11): DJs que piden salir en el cartel
 * de un evento suyo. Al aprobar, el DJ entra en el cartel (lote 68,
 * `resolver_solicitud_dj`, que comprueba en la base que el tardeo es tuyo).
 */
export default function SolicitudesDeDjs() {
  const { ficha, enlace } = useFicha();
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [falta, setFalta] = useState(false);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("solicitudes_dj_de_local", { p_local: ficha.id });
    if (error) { setFalta(faltaLote68(error)); setFilas([]); if (!faltaLote68(error)) setMsg({ tono: "error", texto: error.message }); return; }
    setFilas((data ?? []) as Fila[]);
  }, [ficha.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  const resolver = async (f: Fila, estado: "aprobada" | "rechazada") => {
    setOcupada(f.id); setMsg(null);
    const { error } = await supabase.rpc("resolver_solicitud_dj", { p_id: f.id, p_estado: estado, p_nota: null });
    setOcupada(null);
    if (error) { setMsg({ tono: "error", texto: error.message }); return; }
    setMsg({ tono: "ok", texto: estado === "aprobada" ? `${f.dj_nombre} ya sale en «${f.titulo}».` : "Solicitud rechazada." });
    void cargar();
  };

  return (
    <SeccionPanel titulo="Solicitudes de DJs" descripcion="DJs que piden salir en el cartel de tus eventos." ancho="estrecho">
      {falta ? (
        <p className="rounded-2xl border border-aviso/25 bg-aviso-fondo p-4 text-[15px]">Esta bandeja llegará en breve (falta el lote 68).</p>
      ) : (
        <div className="flex flex-col gap-3">
          {msg && <p role="status" className={`rounded-xl p-3 text-[15px] font-semibold ${msg.tono === "ok" ? "bg-ok-fondo text-ok" : "bg-error-fondo text-error"}`}>{msg.texto}</p>}
          {filas === null ? <p className="text-[15px] text-tinta-suave">Cargando…</p> : filas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-6 text-center text-[15px] text-tinta-suave">
              No hay solicitudes. Cuando un DJ pida vincularse a uno de tus eventos, la verás aquí.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filas.map((f) => (
                <li key={f.id} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-magenta-50 text-magenta"><Disc3 size={20} aria-hidden /></span>
                      <span className="min-w-0">
                        <Link href={`/djs/${f.dj_id}`} target="_blank" className="font-bold hover:text-magenta-700">{f.dj_nombre}</Link>
                        <span className="block text-sm text-tinta-suave">
                          quiere salir en <Link href={enlace(`/local/tardeos/${f.tardeo_id}/editar`)} className="font-semibold underline">{f.titulo}</Link> · {formatFecha(f.fecha)}
                        </span>
                        {f.mensaje && <span className="block text-[15px]">«{f.mensaje}»</span>}
                      </span>
                    </div>
                    {f.estado !== "pendiente" && <Etiqueta tono={f.estado === "aprobada" ? "ok" : "neutro"}>{f.estado === "aprobada" ? "Aprobada" : f.estado === "rechazada" ? "Rechazada" : "Retirada"}</Etiqueta>}
                  </div>
                  {f.estado === "pendiente" && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <Boton tamano="pequeno" onClick={() => resolver(f, "aprobada")} cargando={ocupada === f.id} disabled={!!ocupada}><Check size={18} aria-hidden /> Aprobar</Boton>
                      <Boton tamano="pequeno" variante="contorno" onClick={() => resolver(f, "rechazada")} disabled={!!ocupada}><X size={18} aria-hidden /> Rechazar</Boton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </SeccionPanel>
  );
}
