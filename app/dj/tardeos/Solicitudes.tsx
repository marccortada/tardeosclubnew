"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Plus, Search } from "lucide-react";
import Boton from "@/components/Boton";
import Campo, { claseCampo } from "@/components/ui/Campo";
import { Etiqueta } from "@/components/ui/Chip";
import Aviso from "@/components/admin/Aviso";
import { useDiferido } from "@/components/panel/Paginacion";
import { supabase } from "@/lib/supabase";
import { faltaLote68, hoyISO } from "@/lib/tardeos";
import { formatFecha } from "@/lib/formato";

type Sol = {
  id: string; tipo: "vinculo" | "propuesta"; estado: string; created_at: string; mensaje: string | null;
  nota_resolucion: string | null; propuesta: { titulo?: string; fecha?: string } | null;
  tardeos: { titulo: string; fecha: string } | null;
};
type Evento = { id: string; titulo: string; fecha: string; hora_inicio: string | null; locales: { nombre: string } | null };

const ESTADO: Record<string, { t: string; tono: "ok" | "aviso" | "neutro" | "error" | "marca" }> = {
  pendiente: { t: "Pendiente", tono: "marca" }, aprobada: { t: "Aprobada", tono: "ok" },
  rechazada: { t: "Rechazada", tono: "error" }, retirada: { t: "Retirada", tono: "neutro" },
};

/**
 * Dossier pág. 11: el DJ puede pedir vincularse a un evento que ya existe (lo
 * aprueba el organizador en su panel) o proponer uno nuevo si no existe (lo
 * revisa el equipo). Lote 68: `dj_solicitudes`.
 */
export default function SolicitudesDj({ djId }: { djId: string }) {
  const [lista, setLista] = useState<Sol[] | null>(null);
  const [falta, setFalta] = useState(false);
  const [msg, setMsg] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const [busca, setBusca] = useState("");
  const buscado = useDiferido(busca, 300);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [proponer, setProponer] = useState(false);
  const [p, setP] = useState({ titulo: "", fecha: "", hora: "", lugar: "", enlace: "", nota: "" });
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("dj_solicitudes")
      .select("id,tipo,estado,created_at,mensaje,nota_resolucion,propuesta,tardeos(titulo,fecha)")
      .eq("dj_id", djId).order("created_at", { ascending: false }).limit(50);
    if (error) { setFalta(faltaLote68(error)); setLista([]); if (!faltaLote68(error)) setMsg({ tono: "error", texto: error.message }); return; }
    setLista((data ?? []) as unknown as Sol[]);
  }, [djId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  // Eventos públicos próximos que encajan con lo escrito.
  useEffect(() => {
    let vivo = true;
    const t = buscado.trim().replace(/[%_,()*]/g, " ");
    if (t.length < 2) { setEventos([]); return; }
    supabase.from("tardeos").select("id,titulo,fecha,hora_inicio,locales(nombre)")
      .eq("estado", "publicado").gte("fecha", hoyISO()).ilike("titulo", `%${t}%`).order("fecha").limit(8)
      .then(({ data }) => vivo && setEventos((data ?? []) as unknown as Evento[]));
    return () => { vivo = false; };
  }, [buscado]);

  const vincular = async (e: Evento) => {
    setMsg(null);
    const { error } = await supabase.from("dj_solicitudes").insert({ tipo: "vinculo", dj_id: djId, tardeo_id: e.id });
    if (error) {
      setMsg({ tono: "error", texto: error.code === "23505" ? "Ya tienes una solicitud pendiente para ese evento." : faltaLote68(error) ? "Falta el lote 68." : error.message });
      return;
    }
    setMsg({ tono: "ok", texto: `Solicitud enviada al organizador de «${e.titulo}». Te avisaremos cuando responda.` });
    setBusca(""); setEventos([]);
    void cargar();
  };

  const enviarPropuesta = async () => {
    if (!p.titulo.trim() || !p.fecha || !p.lugar.trim()) { setMsg({ tono: "error", texto: "Pon al menos título, fecha y lugar." }); return; }
    setEnviando(true); setMsg(null);
    const { error } = await supabase.from("dj_solicitudes").insert({
      tipo: "propuesta", dj_id: djId, propuesta: { ...p, titulo: p.titulo.trim(), lugar: p.lugar.trim() }, mensaje: p.nota.trim() || null,
    });
    setEnviando(false);
    if (error) { setMsg({ tono: "error", texto: faltaLote68(error) ? "Falta el lote 68." : error.message }); return; }
    setMsg({ tono: "ok", texto: "Propuesta enviada. El equipo la revisa y, si encaja, la publica." });
    setP({ titulo: "", fecha: "", hora: "", lugar: "", enlace: "", nota: "" }); setProponer(false);
    void cargar();
  };

  const retirar = async (s: Sol) => {
    const { error } = await supabase.rpc("resolver_solicitud_dj", { p_id: s.id, p_estado: "retirada", p_nota: null });
    if (error) { setMsg({ tono: "error", texto: error.message }); return; }
    void cargar();
  };

  if (falta) return <Aviso tono="aviso">Solicitar vincularte a eventos llegará en breve (falta el lote 68).</Aviso>;

  return (
    <div className="flex flex-col gap-5">
      {msg && <Aviso tono={msg.tono}>{msg.texto}</Aviso>}

      <section className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Link2 size={18} className="text-magenta" aria-hidden /> ¿Pinchas en un evento que ya está publicado?</h2>
        <p className="text-[15px] text-tinta-suave">Búscalo y pide que te añadan al cartel. Lo aprueba el organizador.</p>
        <div className="relative mt-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nombre del evento…" aria-label="Buscar evento"
            className={`${claseCampo} pl-10`} />
        </div>
        {eventos.length > 0 && (
          <ul className="mt-2 flex flex-col gap-2">
            {eventos.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-marfil-100 p-3">
                <span className="min-w-0"><b>{e.titulo}</b><span className="block text-sm text-tinta-suave">{formatFecha(e.fecha)}{e.hora_inicio ? ` · ${e.hora_inicio.slice(0, 5)}` : ""}{e.locales?.nombre ? ` · ${e.locales.nombre}` : ""}</span></span>
                <Boton tamano="pequeno" onClick={() => vincular(e)}>Solicitar vincularme</Boton>
              </li>
            ))}
          </ul>
        )}
        {buscado.trim().length >= 2 && eventos.length === 0 && (
          <p className="mt-2 text-[15px] text-tinta-suave">No lo encontramos. Si no existe, propónlo abajo.</p>
        )}
      </section>

      <section className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Plus size={18} className="text-magenta" aria-hidden /> Proponer evento nuevo</h2>
        <p className="text-[15px] text-tinta-suave">Si el evento no está en TardeosClub, mándanoslo. El equipo lo revisa antes de publicarlo.</p>
        {!proponer ? (
          <Boton className="mt-3" variante="contorno" onClick={() => setProponer(true)}>Proponer evento</Boton>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <Campo etiqueta="Título" htmlFor="pr-t"><input id="pr-t" value={p.titulo} onChange={(e) => setP({ ...p, titulo: e.target.value })} className={claseCampo} /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Fecha" htmlFor="pr-f"><input id="pr-f" type="date" min={hoyISO()} value={p.fecha} onChange={(e) => setP({ ...p, fecha: e.target.value })} className={claseCampo} /></Campo>
              <Campo etiqueta="Hora" htmlFor="pr-h"><input id="pr-h" type="time" value={p.hora} onChange={(e) => setP({ ...p, hora: e.target.value })} className={claseCampo} /></Campo>
            </div>
            <Campo etiqueta="Lugar (local y ciudad)" htmlFor="pr-l"><input id="pr-l" value={p.lugar} onChange={(e) => setP({ ...p, lugar: e.target.value })} className={claseCampo} /></Campo>
            <Campo etiqueta="Enlace (entradas o Instagram, opcional)" htmlFor="pr-e"><input id="pr-e" type="url" value={p.enlace} onChange={(e) => setP({ ...p, enlace: e.target.value })} className={claseCampo} /></Campo>
            <Campo etiqueta="Nota para el equipo (opcional)" htmlFor="pr-n"><textarea id="pr-n" rows={2} value={p.nota} onChange={(e) => setP({ ...p, nota: e.target.value })} className={claseCampo} /></Campo>
            <div className="flex gap-2">
              <Boton variante="contorno" onClick={() => setProponer(false)}>Cancelar</Boton>
              <Boton ancho onClick={enviarPropuesta} cargando={enviando}>Enviar propuesta</Boton>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Mis solicitudes</h2>
        {!lista ? null : lista.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-5 text-center text-[15px] text-tinta-suave">Aún no has pedido nada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lista.map((s) => {
              const e = ESTADO[s.estado] ?? { t: s.estado, tono: "neutro" as const };
              const titulo = s.tipo === "vinculo" ? s.tardeos?.titulo ?? "Evento" : s.propuesta?.titulo ?? "Propuesta";
              const fecha = s.tipo === "vinculo" ? s.tardeos?.fecha : s.propuesta?.fecha;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
                  <span className="min-w-0">
                    <b>{titulo}</b>
                    <span className="block text-sm text-tinta-suave">{s.tipo === "vinculo" ? "Vincularme" : "Evento propuesto"}{fecha ? ` · ${formatFecha(fecha)}` : ""}{s.nota_resolucion ? ` · ${s.nota_resolucion}` : ""}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Etiqueta tono={e.tono}>{e.t}</Etiqueta>
                    {s.estado === "pendiente" && <Boton tamano="pequeno" variante="contorno" onClick={() => retirar(s)}>Retirar</Boton>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
