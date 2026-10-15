"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, LogIn, Lock, Ticket, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { entrarYVolver } from "@/lib/volver";
import Boton, { claseBoton } from "@/components/Boton";
import { claseCampo } from "@/components/ui/Campo";
import { CabeceraApp, ChipSel, Estrellas, Mensaje } from "@/components/retorno/Piezas";
import {
  OPC_AMBIENTE, OPC_EDAD, OPC_MUSICA, OPC_ROPA, enviarEncuesta, estadoEncuesta, type EstadoEncuesta, type RespuestaEncuesta,
} from "@/lib/encuestas";

/**
 * "¿Qué tal el tardeo?" (dossier 2.0 pág. 10, vídeo hoja4). Solo quien tenía
 * plaza confirmada y hasta 72 h después del fin: lo comprueba la base.
 * Público: solo la valoración y el comentario.
 */
export default function EncuestaTardeo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const [titulo, setTitulo] = useState<string | null>(null);
  const [estadoBase, setEstado] = useState<EstadoEncuesta | "cargando" | "error">("cargando");
  // Sin sesión no hace falta preguntar a la base.
  const estado = !loading && !user ? "sin_sesion" : estadoBase;
  const [r, setR] = useState<RespuestaEncuesta>({ valoracion: 0, musica: [], ambiente: [], ropa: null, edad: null, volverias: null, comentario: "" });
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("tardeos").select("titulo").eq("id", id).maybeSingle().then(({ data }) => setTitulo(data?.titulo ?? ""));
  }, [id]);

  useEffect(() => {
    if (loading || !user) return;
    estadoEncuesta(id).then(setEstado).catch(() => setEstado("error"));
  }, [id, user, loading]);

  const alternar = (k: "musica" | "ambiente", v: string) =>
    setR((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));

  const enviar = async () => {
    if (!r.valoracion) { setError("Elige de 1 a 5 estrellas."); return; }
    setEnviando(true); setError(null);
    try {
      await enviarEncuesta(id, r);
      setEnviada(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar. Inténtalo otra vez.");
    } finally {
      setEnviando(false);
    }
  };

  const volver = `/tardeos/${id}`;
  const cuerpo = () => {
    if (estado === "cargando" || titulo === null) return <p className="py-10 text-center text-tinta-suave">Cargando…</p>;
    if (estado === "sin_sesion")
      return (
        <Mensaje icono={<LogIn size={26} aria-hidden />} titulo="Entra para valorar">
          <p>La valoración es para quien tenía plaza en este tardeo.</p>
          <Link href={entrarYVolver(`/tardeos/${id}/encuesta`)} className={claseBoton("primario", "normal", false, "mt-4")}>Entrar</Link>
        </Mensaje>
      );
    if (estado === "falta_lote") return <Mensaje icono={<Wrench size={26} aria-hidden />} titulo="Todavía no disponible"><p>Falta el lote 67 en la base de datos.</p></Mensaje>;
    if (estado === "error") return <Mensaje icono={<Wrench size={26} aria-hidden />} titulo="No se pudo cargar"><p>Recarga la página en un momento.</p></Mensaje>;
    if (estado === "no_existe" || estado === "cancelado")
      return <Mensaje icono={<Lock size={26} aria-hidden />} titulo={estado === "cancelado" ? "Este tardeo se canceló" : "Este tardeo no existe"} />;
    if (estado === "no_confirmado")
      return (
        <Mensaje icono={<Ticket size={26} aria-hidden />} titulo="No estuviste confirmado">
          <p>Solo pueden valorar quienes tenían plaza (Asistiré o lista confirmada).</p>
        </Mensaje>
      );
    if (estado === "aun_no") return <Mensaje icono={<Clock size={26} aria-hidden />} titulo="Aún no ha terminado"><p>Podrás valorarlo cuando acabe, durante 72 h.</p></Mensaje>;
    if (estado === "fuera_plazo") return <Mensaje icono={<Clock size={26} aria-hidden />} titulo="Fuera de plazo"><p>Se puede valorar hasta 72 h después del fin.</p></Mensaje>;
    if (estado === "ya_respondida")
      return <Mensaje icono={<CheckCircle2 size={26} aria-hidden />} titulo="Ya enviaste tu valoración"><p>¡Gracias! Nos ayuda a mejorar los próximos planes.</p></Mensaje>;

    return (
      <form className="flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); if (!enviada) enviar(); }}>
        <section>
          <h3 className="mb-2 text-[16px] font-bold">Tu valoración</h3>
          <Estrellas valor={r.valoracion} onCambiar={enviada ? undefined : (n) => setR((p) => ({ ...p, valoracion: n }))} />
        </section>
        <section>
          <h3 className="mb-2 text-[16px] font-bold">¿Qué música sonó?</h3>
          <div className="flex flex-wrap gap-2">{OPC_MUSICA.map((m) => <ChipSel key={m} activo={r.musica.includes(m)} onClick={() => alternar("musica", m)}>{m}</ChipSel>)}</div>
        </section>
        <section>
          <h3 className="mb-2 text-[16px] font-bold">Ambiente</h3>
          <div className="flex flex-wrap gap-2">{OPC_AMBIENTE.map((m) => <ChipSel key={m} activo={r.ambiente.includes(m)} onClick={() => alternar("ambiente", m)}>{m}</ChipSel>)}</div>
        </section>
        <section>
          <h3 className="mb-2 text-[16px] font-bold">Ropa y edad aproximada</h3>
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Ropa" className={claseCampo} value={r.ropa ?? ""} onChange={(e) => setR((p) => ({ ...p, ropa: e.target.value || null }))}>
              <option value="">Ropa…</option>{OPC_ROPA.map((o) => <option key={o}>{o}</option>)}
            </select>
            <select aria-label="Edad aproximada" className={claseCampo} value={r.edad ?? ""} onChange={(e) => setR((p) => ({ ...p, edad: e.target.value || null }))}>
              <option value="">Edad…</option>{OPC_EDAD.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-[16px] font-bold">¿Volverías?</h3>
          <div className="flex flex-wrap gap-2">
            {([["si", "Sí"], ["no", "No"], ["nose", "No lo sé"]] as const).map(([k, l]) =>
              <ChipSel key={k} activo={r.volverias === k} onClick={() => setR((p) => ({ ...p, volverias: p.volverias === k ? null : k }))}>{l}</ChipSel>)}
          </div>
        </section>
        <section>
          <label htmlFor="comentario" className="mb-2 block text-[16px] font-bold">Comentario</label>
          <textarea id="comentario" rows={3} maxLength={600} className={claseCampo} placeholder="Muy buena música y ambiente. ¡Repetiría!"
            value={r.comentario} onChange={(e) => setR((p) => ({ ...p, comentario: e.target.value }))} />
          <p className="mt-2 text-[14px] text-tinta-suave">Solo valoración y comentario serán públicos.</p>
        </section>
        {error && <p role="alert" className="rounded-xl bg-error-fondo p-3 text-[15px] font-semibold text-error">{error}</p>}
        <Boton type="submit" ancho cargando={enviando} disabled={enviada}>
          {enviada ? <><CheckCircle2 size={20} aria-hidden /> Valoración enviada</> : "Enviar valoración"}
        </Boton>
        {enviada && <Link href={volver} className="text-center text-[15px] font-semibold text-magenta">Volver al tardeo</Link>}
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-white pb-28">
      <CabeceraApp titulo="¿Qué tal el tardeo?" volver={volver} />
      <main className="mx-auto max-w-lg px-4 pt-5">
        {titulo && <h2 className="text-[22px] font-bold leading-tight">{titulo}</h2>}
        <p className="mb-5 text-[15px] text-tinta-suave">Tu experiencia · Hasta 72 h después del fin</p>
        {cuerpo()}
      </main>
    </div>
  );
}
