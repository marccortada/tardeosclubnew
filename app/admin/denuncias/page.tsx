"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, Filtros, EstadoLista } from "@/components/panel/Paginacion";
import Boton from "@/components/Boton";
import { MOTIVOS_COMUNIDAD, NOMBRE_TIPO, type TipoObjeto } from "@/lib/denuncias";
import { fechaCorta, horaCorta, textoError } from "@/lib/meet";

type Estado = "pendiente" | "retirado" | "desestimado";
type Fila = {
  id: string; denunciante: string | null; tipo_objeto: TipoObjeto; objeto_id: string;
  motivo: string; mensaje: string | null; estado: Estado; created_at: string; resuelta_en: string | null;
};
type Contenido = { tipo: string; id: string; texto: string | null; autor: string | null; autor_alias: string | null; contexto: string | null; url: string | null; retenido: boolean | null };

/**
 * Cola de denuncias GENÉRICAS (lote 63): Meet Zone, mensajes con DJs y Entre
 * Beats. Retirar oculta el contenido y cierra todas las denuncias de ese
 * objeto; desestimar las cierra y, si estaba retenido automáticamente (3
 * denuncias), lo vuelve a mostrar. Todo deja rastro en `auditoria` (lote 66,
 * resolver_denuncia). Las de flyers siguen en /admin/moderacion.
 */
export default function DenunciasAdmin() {
  const [estado, setEstado] = useState<Estado>("pendiente");
  const [contenidos, setContenidos] = useState<Record<string, Contenido>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const { filas, total, pagina, setPagina, porPagina, cargando, error, quitar } = usePaginado<Fila>((desde, hasta) =>
    supabase.from("denuncias").select("id,denunciante,tipo_objeto,objeto_id,motivo,mensaje,estado,created_at,resuelta_en", { count: "exact" })
      .eq("estado", estado).order("created_at", { ascending: estado !== "pendiente" ? false : true }).order("id").range(desde, hasta),
  [estado]);

  // El contenido denunciado de toda la página en una sola llamada.
  useEffect(() => {
    if (filas.length === 0) return;
    supabase.rpc("contenido_denunciado", { p_tipos: filas.map((f) => f.tipo_objeto), p_ids: filas.map((f) => f.objeto_id) })
      .then(({ data }) => {
        const m: Record<string, Contenido> = {};
        for (const c of (data as Contenido[] | null) ?? []) m[`${c.tipo}:${c.id}`] = c;
        setContenidos((p) => ({ ...p, ...m }));
      });
  }, [filas]);

  async function resolver(f: Fila, accion: "retirar" | "desestimar") {
    setOcupado(f.id); setAviso(null);
    const { error } = await supabase.rpc("resolver_denuncia", { p_denuncia: f.id, p_accion: accion });
    setOcupado(null);
    if (error) { setAviso({ ok: false, texto: textoError(error) }); return; }
    // Cierra todas las denuncias del mismo objeto: se quitan de la lista.
    quitar((x) => x.tipo_objeto === f.tipo_objeto && x.objeto_id === f.objeto_id);
    setAviso({ ok: true, texto: accion === "retirar" ? "Contenido retirado." : "Denuncia desestimada." });
  }

  return (
    <SeccionPanel titulo="Denuncias" descripcion="Chat de eventos, mensajes con DJs y Entre Beats. Revisión humana: retirar u olvidar.">
      <div className="space-y-4">
        <Filtros<Estado> valor={estado} onCambiar={setEstado}
          opciones={[{ clave: "pendiente", label: "Pendientes", n: estado === "pendiente" ? total : null }, { clave: "retirado", label: "Retiradas" }, { clave: "desestimado", label: "Desestimadas" }]} />
        {aviso && <p role="status" className={`rounded-xl p-3 text-[15px] font-semibold ${aviso.ok ? "bg-ok-fondo text-ok" : "bg-error-fondo text-error"}`}>{aviso.texto}</p>}
        <EstadoLista cargando={cargando} error={error ? textoError({ message: error, code: /does not exist|schema cache/.test(error) ? "42P01" : undefined }, "63/66") : null}
          vacio={estado === "pendiente" ? "No hay denuncias pendientes. Todo al día." : "No hay denuncias aquí."} filas={filas.length} />
        <ul className="space-y-3">
          {filas.map((f) => {
            const c = contenidos[`${f.tipo_objeto}:${f.objeto_id}`];
            return (
              <li key={f.id} className="rounded-2xl border border-linea bg-superficie p-4">
                <div className="flex flex-wrap items-center gap-2 text-[14px]">
                  <span className="rounded-full bg-marfil-100 px-2.5 py-0.5 font-bold">{NOMBRE_TIPO[f.tipo_objeto] ?? f.tipo_objeto}</span>
                  <span className="rounded-full bg-error-fondo px-2.5 py-0.5 font-bold text-error">{MOTIVOS_COMUNIDAD.find((m) => m.k === f.motivo)?.label ?? f.motivo}</span>
                  {c?.retenido && <span className="rounded-full bg-aviso-fondo px-2.5 py-0.5 font-bold text-aviso">Retenido</span>}
                  <span className="text-tinta-suave">{fechaCorta(f.created_at)} {horaCorta(f.created_at)}</span>
                </div>
                <div className="mt-3 rounded-xl bg-marfil-100 px-4 py-3">
                  <p className="text-[13px] text-tinta-suave">{c?.contexto ?? "…"}{c?.autor_alias && ` · de ${c.autor_alias}`}</p>
                  <p className="mt-1 whitespace-pre-wrap text-[15px]">{c ? (c.texto ?? "El contenido ya no existe.") : "Cargando…"}</p>
                  {c?.url && <Link href={c.url} className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-[14px] font-bold text-magenta underline">Ver en su sitio <ExternalLink size={14} aria-hidden /></Link>}
                </div>
                {f.mensaje && <p className="mt-2 text-[15px]"><span className="text-tinta-suave">Explicación: </span>{f.mensaje}</p>}
                {f.estado === "pendiente" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Boton tamano="pequeno" variante="peligro" cargando={ocupado === f.id} onClick={() => resolver(f, "retirar")}>Retirar contenido</Boton>
                    <Boton tamano="pequeno" variante="contorno" disabled={ocupado === f.id} onClick={() => resolver(f, "desestimar")}>Desestimar</Boton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <Paginacion pagina={pagina} total={total} porPagina={porPagina} onCambiar={setPagina} cargando={cargando} />
      </div>
    </SeccionPanel>
  );
}
