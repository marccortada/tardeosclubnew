"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import AsignarDueno from "@/components/AsignarDueno";
import { supabase } from "@/lib/supabase";
import { plegar, contieneTexto } from "@/lib/texto";
import {
  Store, Disc3, Megaphone, BadgeCheck, Eye, EyeOff, Loader2, Plus, Search,
} from "lucide-react";

type Cual = "djs" | "locales" | "promotores";

type Ficha = {
  id: string;
  nombre: string;
  zona: string | null;
  verificado: boolean;
  /** Fuera de la parte pública. En locales es un estado; en DJs, un booleano. */
  oculto: boolean;
  duenoEmail: string | null;
};

/**
 * Locales, promotores y DJs en una sola pantalla.
 *
 * Antes eran dos: /admin/locales y /admin/djs, con el mismo código escrito dos
 * veces —cargar, buscar el email del dueño, verificar, ocultar— y los
 * promotores escondidos entre los locales. Tres cosas que son lo mismo
 * (colaboradores) repartidas en dos sitios y ninguno completo.
 *
 * Las diferencias entre las tres tablas se resuelven aquí y no se propagan:
 * los DJs guardan el nombre en `nombre_artistico` y el "oculto" en un booleano;
 * los locales lo guardan en `estado`. A partir de la carga, las tres son la
 * misma ficha.
 */
export default function AdminColaboradores() {
  const [cual, setCual] = useState<Cual>("locales");
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busca, setBusca] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async (c: Cual) => {
    setCargando(true); setError("");
    const r = c === "djs"
      ? await supabase.from("djs")
          .select("id,nombre_artistico,verificado,oculto,profile_id")
          .order("nombre_artistico")
      : await supabase.from("locales")
          .select("id,nombre,zona,verificado,estado,owner_id")
          .eq("tipo", c === "promotores" ? "promotor" : "local")
          .order("nombre");
    if (r.error) { setError(r.error.message); setCargando(false); return; }

    const filas = (r.data ?? []) as Record<string, unknown>[];
    // Los emails de los dueños en UNA consulta, no una por fila.
    const ids = [...new Set(filas.map((x) => x.owner_id ?? x.profile_id).filter(Boolean))] as string[];
    const correos = new Map<string, string>();
    if (ids.length) {
      const { data: perfiles } = await supabase.from("profiles").select("id,email").in("id", ids);
      (perfiles ?? []).forEach((p) => correos.set(p.id, p.email ?? "—"));
    }

    setFichas(filas.map((x) => {
      const dueno = (x.owner_id ?? x.profile_id) as string | null;
      return {
        id: String(x.id),
        nombre: String(x.nombre ?? x.nombre_artistico ?? ""),
        zona: (x.zona ?? null) as string | null,
        verificado: Boolean(x.verificado),
        // Cualquier estado que no sea 'activo' —salvo el borrador, que es
        // "todavía no publicada"— cuenta como oculta a efectos de este botón.
        oculto: c === "djs" ? Boolean(x.oculto) : String(x.estado ?? "").startsWith("oculto"),
        duenoEmail: dueno ? correos.get(dueno) ?? "—" : null,
      };
    }));
    setCargando(false);
  }, []);
  useEffect(() => { cargar(cual); }, [cargar, cual]);

  const tabla = cual === "djs" ? "djs" : "locales";

  const setVerificado = async (f: Ficha) => {
    const v = !f.verificado;
    setFichas((p) => p.map((x) => (x.id === f.id ? { ...x, verificado: v } : x)));
    await supabase.from(tabla).update({ verificado: v }).eq("id", f.id);
  };

  const setOculto = async (f: Ficha) => {
    const v = !f.oculto;
    setFichas((p) => p.map((x) => (x.id === f.id ? { ...x, oculto: v } : x)));
    /**
     * La diferencia entre tablas, en un solo sitio.
     *
     * Se escribe 'oculto' y NO 'oculto_impago', que es lo que hacía antes.
     * Hay muchas razones para retirar una ficha —un duplicado, una prueba, un
     * local cerrado, que lo pida el propio local— y solo una es un impago.
     * Escribir siempre la del impago dejaba en la base fichas «ocultas por no
     * pagar» que nunca habían contratado nada: se encontró una, «miraclee».
     *
     * El estado de impago lo pone la pantalla de Suscripciones, que es donde
     * se sabe si alguien debe dinero.
     */
    await supabase.from(tabla)
      .update(cual === "djs" ? { oculto: v } : { estado: v ? "oculto" : "activo" })
      .eq("id", f.id);
  };

  const lista = useMemo(() => {
    const q = plegar(busca.trim());
    return fichas.filter((f) =>
      !q || contieneTexto(f.nombre, q) || contieneTexto(f.zona ?? "", q) || contieneTexto(f.duenoEmail ?? "", q));
  }, [fichas, busca]);

  const Icono = cual === "djs" ? Disc3 : cual === "promotores" ? Megaphone : Store;

  return (
    <main className="pb-16">
      <PanelHeader titulo="Colaboradores" volverHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8">

        <div className="mb-3 flex gap-2">
          {(["locales", "promotores", "djs"] as Cual[]).map((c) => (
            <button
              key={c} onClick={() => { setCual(c); setBusca(""); }}
              className={`min-h-[44px] flex-1 rounded-xl px-2 text-sm font-extrabold transition ${
                cual === c ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}
            >
              {c === "locales" ? "Locales" : c === "promotores" ? "Promotores" : "DJs"}
            </button>
          ))}
        </div>

        {/* El buscador mira también la zona y el email del dueño: buscar "gmail"
            para ver quién tiene cuenta es tan legítimo como buscar por nombre. */}
        <label className="mb-3 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-tarjeta ring-1 ring-black/5">
          <Search size={16} className="shrink-0 text-tinta/40" />
          <input
            value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nombre, zona o email…"
            className="w-full bg-transparent font-semibold outline-none"
          />
        </label>

        {error && <p className="mb-3 rounded-xl bg-magenta-50 p-3 text-sm font-bold text-magenta">{error}</p>}

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-tinta/50">
            <Loader2 className="animate-spin" /> Cargando…
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-tinta/60">
                {lista.length === fichas.length
                  ? `${fichas.length} ${cual}`
                  : `${lista.length} de ${fichas.length}`}
              </p>
              <Link href={`/admin/crear?tipo=${cual === "djs" ? "dj" : cual === "promotores" ? "promotor" : "local"}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-magenta px-4 py-2 text-sm font-black text-white active:scale-[0.98]">
                <Plus size={16} /> Crear
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              {lista.map((f) => (
                <div key={f.id} className={`flex items-center gap-3 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5 ${f.oculto ? "opacity-60" : ""}`}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta">
                    <Icono size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="inline-flex items-center gap-1 truncate font-black leading-tight">
                      {f.nombre}
                      {f.verificado && <BadgeCheck size={16} className="shrink-0 text-oro-600" />}
                    </p>
                    <p className="text-sm font-semibold text-tinta/60">
                      {[f.zona, f.oculto ? "oculto" : null].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <AsignarDueno
                      tabla={tabla} campo={cual === "djs" ? "profile_id" : "owner_id"}
                      id={f.id} duenoEmail={f.duenoEmail}
                      onAsignado={(email) => setFichas((p) => p.map((x) => x.id === f.id ? { ...x, duenoEmail: email } : x))}
                    />
                  </div>
                  <button onClick={() => setVerificado(f)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
                      f.verificado ? "bg-oro/20 text-oro-600" : "bg-black/5 text-tinta/50"}`}>
                    {f.verificado ? "Verificado" : "Verificar"}
                  </button>
                  <button onClick={() => setOculto(f)} aria-label={f.oculto ? "Mostrar" : "Ocultar"}
                    className="shrink-0 text-tinta/40 hover:text-magenta">
                    {f.oculto ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              ))}
              {lista.length === 0 && (
                <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">
                  {busca ? "Ninguno con esa búsqueda." : `Todavía no hay ${cual}.`}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
