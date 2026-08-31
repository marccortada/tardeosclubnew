"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { plegar, contieneTexto } from "@/lib/texto";
import { hoyISO } from "@/lib/tardeos";
import { Star, Loader2, CalendarDays, MapPin, ArrowUp, ArrowDown } from "lucide-react";

type Fila = {
  id: string;
  titulo: string;
  fecha: string;
  zona: string | null;
  estilo: string | null;
  local: string | null;
  destacado_hasta: string | null;
  destacado_orden: number | null;
};

/**
 * Qué tardeos salen en 🔥 Destacados de la portada.
 *
 * Va aparte de la pestaña de locales y DJs porque la mecánica es otra: allí es
 * un orden manual (1, 2, 3…) que hay que mantener, y aquí basta un sí/no que
 * se apaga solo. Un tardeo destacado deja de estarlo cuando pasa su fecha, sin
 * que nadie tenga que acordarse: es la diferencia entre destacar un negocio,
 * que dura, y destacar un evento, que caduca.
 *
 * Escribe `destacado_hasta`, que en la base solo puede tocar un admin: el
 * trigger `proteger_tardeos` (lote 9) revierte el valor si lo intenta el dueño
 * del local, porque destacar es producto de pago.
 */
export default function DestacadosTardeos() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      // Solo de hoy en adelante: destacar algo que ya pasó no lo enseña en
      // ningún sitio, y llenaría la lista de ruido.
      const { data, error: e } = await supabase
        .from("tardeos")
        .select("id,titulo,fecha,zona,estilo,destacado_hasta,destacado_orden,locales(nombre)")
        .eq("estado", "publicado")
        .gte("fecha", hoyISO())
        .order("fecha", { ascending: true });
      if (cancel) return;
      if (e) { setError(e.message); setCargando(false); return; }
      setFilas((data ?? []).map((t: any) => ({
        id: t.id,
        titulo: t.titulo,
        fecha: t.fecha,
        zona: t.zona,
        local: t.locales?.nombre ?? null,
        destacado_hasta: t.destacado_hasta,
        destacado_orden: t.destacado_orden ?? null,
        estilo: t.estilo ?? null,
      })));
      setCargando(false);
    })();
    return () => { cancel = true; };
  }, []);

  const estaDestacado = (f: Fila) =>
    Boolean(f.destacado_hasta && new Date(f.destacado_hasta) > new Date());

  const alternar = async (f: Fila) => {
    setGuardando(f.id); setError("");
    // Hasta el final del día del tardeo. No hay que elegir fecha ni acordarse
    // de retirarlo: cuando pasa, deja de estar destacado y además ya no sale
    // en la parte pública.
    const valor = estaDestacado(f) ? null : `${f.fecha}T23:59:59Z`;
    const { data, error: e } = await supabase
      .from("tardeos").update({ destacado_hasta: valor }).eq("id", f.id).select("id,destacado_hasta");
    setGuardando(null);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    // El trigger puede revertir el valor sin dar error: se comprueba lo que
    // devolvió la base, no lo que pedimos.
    const guardado = data?.[0]?.destacado_hasta ?? null;
    if ((guardado === null) !== (valor === null)) {
      setError("La base no aceptó el cambio. ¿Seguro que tu cuenta es admin?");
      return;
    }
    setFilas((p) => p.map((x) => (x.id === f.id ? { ...x, destacado_hasta: guardado } : x)));
    // Que la portada lo enseñe ya y no dentro de un minuto, que es lo que dura
    // la caché en memoria del servidor.
    const { data: { session } } = await supabase.auth.getSession();
    fetch("/api/revalidar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: session?.access_token }),
    }).catch(() => { /* no crítico: en un minuto se refresca solo */ });
  };

  const destacados = filas
    .filter(estaDestacado)
    .sort((a, b) =>
      (a.destacado_orden ?? Infinity) - (b.destacado_orden ?? Infinity)
      || a.fecha.localeCompare(b.fecha));

  /**
   * Reescribe 1..N y guarda, igual que en locales y DJs.
   *
   * Se reescribe la lista entera en vez de intercambiar dos números sueltos:
   * si un tardeo deja de estar destacado por otro lado —porque caducó—, los
   * números que quedan siguen siendo consecutivos y no hay huecos que nadie
   * entiende.
   */
  const guardarOrden = async (ordenados: Fila[]) => {
    setFilas((p) => p.map((f) => {
      const i = ordenados.findIndex((o) => o.id === f.id);
      return i === -1 ? f : { ...f, destacado_orden: i + 1 };
    }));
    for (let i = 0; i < ordenados.length; i++) {
      const { data, error: e } = await supabase
        .from("tardeos").update({ destacado_orden: i + 1 }).eq("id", ordenados[i].id).select("id,destacado_orden");
      // Igual que al destacar: el disparador puede revertir sin dar error.
      if (e || data?.[0]?.destacado_orden !== i + 1) {
        setError("La base no aceptó el orden. ¿Seguro que tu cuenta es admin?");
        return;
      }
    }
    setError("");
  };

  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= destacados.length) return;
    const nuevo = [...destacados];
    [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
    guardarOrden(nuevo);
  };
  const resto = filas.filter((f) => !estaDestacado(f));
  const filtrado = resto.filter(
    (f) => contieneTexto(f.titulo, plegar(busca.trim())) || contieneTexto(f.local, plegar(busca.trim()))
  );

  const Tarjeta = ({ f, destacado, i }: { f: Fila; destacado: boolean; i?: number }) => (
    <div className={`flex items-center gap-3 rounded-2xl bg-white p-3 shadow-tarjeta ring-1 ${destacado ? "ring-oro/40" : "ring-black/5"}`}>
      {/* El número y las flechas solo en los destacados: en la lista de abajo
          no hay orden que cambiar y ocuparían sitio sin significar nada. */}
      {destacado && i !== undefined && (
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir"
            className="grid h-6 w-6 place-items-center rounded-md bg-black/5 text-tinta/60 disabled:opacity-25">
            <ArrowUp size={13} />
          </button>
          <span className="text-xs font-black text-tinta/40">{i + 1}</span>
          <button onClick={() => mover(i, 1)} disabled={i === destacados.length - 1} aria-label="Bajar"
            className="grid h-6 w-6 place-items-center rounded-md bg-black/5 text-tinta/60 disabled:opacity-25">
            <ArrowDown size={13} />
          </button>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Link href={`/tardeos/${f.id}`} className="block truncate font-black leading-tight hover:text-magenta">
          {f.titulo}
        </Link>
        <p className="mt-0.5 flex items-center gap-2 truncate text-xs font-semibold text-tinta/60">
          <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {f.fecha}</span>
          {f.local && <span className="inline-flex items-center gap-1 truncate"><MapPin size={12} /> {f.local}</span>}
        </p>
      </div>
      <button
        onClick={() => alternar(f)}
        disabled={guardando === f.id}
        aria-label={destacado ? "Quitar de destacados" : "Destacar"}
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition disabled:opacity-40 ${
          destacado ? "bg-oro text-tinta" : "bg-magenta-50 text-magenta hover:bg-magenta-100"
        }`}
      >
        {guardando === f.id ? <Loader2 size={18} className="animate-spin" /> : <Star size={18} fill={destacado ? "currentColor" : "none"} />}
      </button>
    </div>
  );

  if (cargando) {
    return <div className="flex items-center justify-center gap-2 py-16 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</div>;
  }

  return (
    <>
      {error && <p className="mb-3 rounded-xl bg-magenta-50 p-3 text-sm font-bold text-magenta">{error}</p>}

      <div className="mb-2 flex items-center gap-2">
        <Star size={16} className="text-oro-600" />
        <p className="text-sm font-black text-tinta/70">Destacados ({destacados.length})</p>
      </div>

      {destacados.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-center text-sm font-bold text-tinta/50 ring-1 ring-black/5">
          Ninguno destacado. La portada enseñará los próximos por fecha.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {destacados.map((f, i) => <Tarjeta key={f.id} f={f} destacado i={i} />)}
        </div>
      )}

      <p className="mb-2 mt-6 text-sm font-black text-tinta/70">Próximos tardeos ({resto.length})</p>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Busca por título o local…"
        className="mb-3 w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 font-semibold outline-none focus:border-magenta"
      />
      {filtrado.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-center text-sm font-bold text-tinta/50 ring-1 ring-black/5">
          {resto.length === 0 ? "No hay tardeos publicados de hoy en adelante." : "Nada con esa búsqueda."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrado.map((f) => <Tarjeta key={f.id} f={f} destacado={false} />)}
        </div>
      )}
    </>
  );
}
