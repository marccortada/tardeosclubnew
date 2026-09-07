"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import { supabase } from "@/lib/supabase";
import { plegar, contieneTexto } from "@/lib/texto";
import { PLANES, ETIQUETA, precioTexto, euroMes, vigente, diasRestantes, type Plan } from "@/lib/planes";
import { SUSCRIPCION, combinacionInvalida } from "@/lib/estados";
import { CLAVE_PLANES, setAjuste } from "@/lib/ajustes";
import { consumoDeTodos, type Consumo } from "@/lib/cuotas";
import { Store, Disc3, Loader2, Euro, AlertTriangle, Check, Power } from "lucide-react";

type Ficha = {
  id: string;
  nombre: string;
  rol: "local" | "dj";
  plan: Plan;
  plan_estado: string;
  plan_hasta: string | null;
  pago_proveedor: string | null;
  pago_referencia: string | null;
  plan_notas: string | null;
  /** Solo los locales tienen estado de publicación; en un DJ es null. */
  estado: string | null;
  reclamado: boolean;
};

// Los estados salen de `lib/estados.ts` y no de una lista propia: esta pantalla
// decía «Impago», el panel del local «pago pendiente» y colaboradores «oculto».
// Tres nombres para lo mismo hacen creer que son tres cosas distintas.

/**
 * Quién paga qué.
 *
 * Se marca A MANO, y es deliberado mientras sean pocos: con veinte locales la
 * comisión de la pasarela es calderilla y lo caro es el tiempo de montar altas
 * y bajas automáticas. Los campos `pago_proveedor` y `pago_referencia` están
 * para anotar dónde está el cobro de verdad (PayPal, una transferencia, lo que
 * sea) y para que el día que se automatice haya dónde enganchar.
 *
 * Esta pantalla ERA UNA MAQUETA: seis filas escritas en el código con nombres
 * inventados —"Sala Blau", "DJ Nando"— que parecían una cartera de clientes.
 */
export default function AdminSuscripciones() {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "pagando" | "impago" | "sin">("todas");
  const [reglas, setReglas] = useState<boolean | null>(null);
  const [cambiandoReglas, setCambiandoReglas] = useState(false);
  const [consumos, setConsumos] = useState<Record<string, Consumo>>({});

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    const cols = "id,plan,plan_estado,plan_hasta,pago_proveedor,pago_referencia,plan_notas";
    // `estado` solo lo tienen los locales; en DJs no existe y llega undefined.
    const colsLocal = `${cols},estado`;
    const [l, d] = await Promise.all([
      supabase.from("locales").select(`${colsLocal},nombre,owner_id`).order("nombre"),
      supabase.from("djs").select(`${cols},nombre_artistico,profile_id`).order("nombre_artistico"),
    ]);
    if (l.error || d.error) {
      const e = l.error ?? d.error;
      // 42703/PGRST204 = el lote 33 aún no está pegado.
      setError(e?.code === "42703" || e?.code === "PGRST204"
        ? "Falta pegar el lote 33 (supabase/33_planes.sql)."
        : (e?.message ?? "No se pudo cargar."));
      setCargando(false); return;
    }
    const map = (x: any, rol: "local" | "dj"): Ficha => ({
      id: x.id,
      nombre: x.nombre ?? x.nombre_artistico ?? "",
      rol,
      plan: x.plan ?? "basic",
      plan_estado: x.plan_estado ?? "sin_suscripcion",
      plan_hasta: x.plan_hasta ?? null,
      pago_proveedor: x.pago_proveedor ?? null,
      pago_referencia: x.pago_referencia ?? null,
      plan_notas: x.plan_notas ?? null,
      estado: x.estado ?? null,
      reclamado: Boolean(x.owner_id ?? x.profile_id),
    });
    const locales = (l.data ?? []).map((x) => map(x, "local"));
    setFichas([...locales, ...(d.data ?? []).map((x) => map(x, "dj"))]);
    setCargando(false);

    // Los extras del mes, para poder cobrarlos. Va después de pintar: es
    // información útil, no imprescindible, y no debe retrasar la pantalla.
    try {
      setConsumos(await consumoDeTodos(Object.fromEntries(locales.map((f) => [f.id, f.plan]))));
    } catch { /* si falla, la pantalla sigue valiendo */ }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    supabase.from("ajustes").select("valor").eq("clave", CLAVE_PLANES).maybeSingle()
      .then(({ data }) => setReglas(data?.valor === "true"));
  }, []);

  const alternarReglas = async () => {
    const nuevo = !reglas;
    if (nuevo && !confirm(
      "Vas a ACTIVAR las reglas de los planes.\n\n" +
      "A partir de ese momento, los locales en Basic dejan de enseñar su logo en " +
      "el mapa y su sello de verificado: llevarán la chincheta de TardeosClub.\n\n" +
      "Se puede volver a apagar cuando quieras. ¿Seguimos?"
    )) return;
    setCambiandoReglas(true); setError("");
    const { error: e } = await setAjuste(CLAVE_PLANES, nuevo ? "true" : "false");
    setCambiandoReglas(false);
    if (e) { setError("No se pudo cambiar: " + e.message); return; }
    setReglas(nuevo);
    // La web cachea los ajustes 30 s; se le avisa para que se entere ya.
    const { data: { session } } = await supabase.auth.getSession();
    fetch("/api/revalidar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: session?.access_token }),
    }).catch(() => {});
  };

  const guardar = async (f: Ficha, campos: Record<string, unknown>) => {
    // Se comprueba ANTES de mandarlo. El lote 41 también lo rechaza en la base
    // —que es quien manda—, pero un error de Postgres en pantalla no explica
    // qué hacer, y aquí sí se puede decir cuál de las dos casillas mover.
    const choque = combinacionInvalida(
      (campos.estado as string) ?? f.estado,
      (campos.plan_estado as string) ?? f.plan_estado
    );
    if (choque) { setError(choque); return; }
    setGuardando(f.id); setError("");
    const tabla = f.rol === "local" ? "locales" : "djs";
    const { data, error: e } = await supabase.from(tabla).update(campos).eq("id", f.id).select("id,plan,plan_estado");
    setGuardando(null);
    if (e) { setError(e.message); return; }
    // El trigger `proteger_plan` revierte sin dar error si no eres admin: hay
    // que mirar lo que devuelve, no si falló.
    const g = data?.[0] as any;
    if (!g) { setError("No se pudo guardar. ¿Tu cuenta es admin?"); return; }
    if (campos.plan && g.plan !== campos.plan) {
      setError("La base rechazó el cambio de plan. ¿Tu cuenta es admin?"); return;
    }
    setFichas((p) => p.map((x) => (x.id === f.id ? { ...x, ...campos } as Ficha : x)));
  };

  /**
   * «Al corriente» ahora significa al corriente Y dentro del periodo.
   *
   * `plan_hasta` se guardaba desde el lote 33 y no lo miraba nadie: una
   * suscripción que caducó en marzo seguía contando como activa aquí y
   * sumando al recurrente. El dinero que enseñaba esta pantalla incluía a
   * quien ya no paga.
   */
  const pagando = fichas.filter((f) => vigente(f.plan_estado, f.plan_hasta));
  const impagos = fichas.filter((f) => f.plan_estado === "impago");
  // Marcadas como activas pero con la fecha pasada. No es lo mismo que un
  // impago: nadie ha devuelto un recibo, es que se acabó el periodo y no se ha
  // renovado. Se enseñan aparte para poder ir a por ellas.
  const caducadas = fichas.filter((f) => f.plan_estado === "activa" && !vigente(f.plan_estado, f.plan_hasta));
  // El recurrente de verdad: el precio de siempre, no el de alta. Los 40 € de
  // los dos primeros meses del Fundador no son ingreso recurrente, y contarlos
  // como tal daría una previsión que baja sola sin que nadie se dé de baja.
  //
  // Se redondea porque la división puede dar decimales —un plan trimestral de
  // 50 € son 16,66 al mes— y un panel de dinero con seis decimales se lee mal.
  const mrr = Math.round(pagando.reduce((s, f) => s + euroMes(f.plan), 0));
  const extras = pagando.reduce((s, f) => s + (consumos[f.id]?.euros ?? 0), 0);

  const lista = fichas
    .filter((f) =>
      filtro === "todas" ? true
      : filtro === "pagando" ? f.plan_estado === "activa"
      : filtro === "impago" ? f.plan_estado === "impago"
      : f.plan_estado === "sin_suscripcion")
    .filter((f) => contieneTexto(f.nombre, plegar(busca.trim())));

  return (
    <main className="pb-10">
      <PanelHeader titulo="Suscripciones" volverHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8">

        {/* El interruptor general.
            Las reglas nacen APAGADAS: con 68 locales, 64 sin dueño y ninguno
            pagando, encenderlas hoy solo le quitaría el logo a fichas nuestras
            sin que nadie gane nada. Están escritas y probadas, esperando. */}
        {reglas !== null && (
          <section className={`mb-4 rounded-2xl p-4 ring-1 ${reglas ? "bg-oro/15 ring-oro/40" : "bg-white ring-black/5"}`}>
            <div className="flex items-center gap-3">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${reglas ? "bg-oro text-tinta" : "bg-magenta-50 text-magenta"}`}>
                <Power size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-black leading-tight">
                  Reglas de los planes: {reglas ? "activadas" : "apagadas"}
                </p>
                <p className="text-xs font-semibold text-tinta/60">
                  {reglas
                    ? "Los Basic no enseñan su logo ni el sello. Los Pro y superiores, sí."
                    : "Todos los locales enseñan logo y sello, paguen o no. Enciéndelo cuando tengas clientes."}
                </p>
              </div>
              <button onClick={alternarReglas} disabled={cambiandoReglas}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-extrabold disabled:opacity-50 ${
                  reglas ? "bg-white text-tinta/70 ring-1 ring-black/10" : "bg-magenta text-white"}`}>
                {cambiandoReglas ? <Loader2 size={16} className="animate-spin" /> : reglas ? "Apagar" : "Activar"}
              </button>
            </div>
          </section>
        )}

        <section className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
            <Euro size={20} className="text-magenta" />
            <p className="mt-1 font-display text-2xl font-black leading-none">{mrr} €</p>
            <p className="mt-1 text-xs font-bold text-tinta/60">
              al mes{extras > 0 && <span className="text-oro-600"> +{extras} € extras</span>}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
            <Check size={20} className="text-magenta" />
            <p className="mt-1 font-display text-2xl font-black leading-none">{pagando.length}</p>
            <p className="mt-1 text-xs font-bold text-tinta/60">al corriente</p>
          </div>
          <div className={`rounded-2xl p-4 shadow-tarjeta ring-1 ${impagos.length + caducadas.length ? "bg-oro/15 ring-oro/40" : "bg-white ring-black/5"}`}>
            <AlertTriangle size={20} className={impagos.length ? "text-oro-600" : "text-tinta/30"} />
            <p className="mt-1 font-display text-2xl font-black leading-none">{impagos.length}</p>
            <p className="mt-1 text-xs font-bold text-tinta/60">
              impagos
              {caducadas.length > 0 && (
                <span className="block text-oro-700">+{caducadas.length} caducadas</span>
              )}
            </p>
          </div>
        </section>

        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {([["todas","Todas"],["pagando","Al corriente"],["impago","Impagos"],["sin","Sin suscripción"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFiltro(k)}
              className={`min-h-[44px] shrink-0 rounded-xl px-4 text-sm font-extrabold transition ${filtro === k ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}>
              {l}
            </button>
          ))}
        </div>

        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca por nombre…"
          className="mb-3 w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 font-semibold outline-none focus:border-magenta" />

        {error && <p className="mb-3 rounded-xl bg-magenta-50 p-3 text-sm font-bold text-magenta">{error}</p>}

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</div>
        ) : lista.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">Nada aquí.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {lista.map((f) => (
              <div key={f.id} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta">
                    {f.rol === "local" ? <Store size={18} /> : <Disc3 size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={f.rol === "local" ? `/locales/${f.id}` : `/djs/${f.id}`}
                      className="block truncate font-black leading-tight hover:text-magenta">{f.nombre}</Link>
                    <p className="text-xs font-semibold text-tinta/50">
                      {f.reclamado ? "Perfil reclamado" : "Sin reclamar · ficha nuestra"}
                      {f.pago_referencia && ` · ${f.pago_proveedor ?? "pago"}: ${f.pago_referencia}`}
                    </p>
                    {/* Hasta cuándo está pagado. Solo se dice cuando importa:
                        una fecha a seis meses vista no es información. */}
                    {(() => {
                      const dias = diasRestantes(f.plan_hasta);
                      if (dias === null || f.plan_estado !== "activa") return null;
                      if (dias < 0) return (
                        <p className="mt-0.5 text-xs font-black text-magenta">
                          Caducó hace {Math.abs(dias)} {Math.abs(dias) === 1 ? "día" : "días"} · ya no cuenta como al corriente
                        </p>
                      );
                      if (dias <= 14) return (
                        <p className="mt-0.5 text-xs font-black text-oro-700">
                          {dias === 0 ? "Vence hoy" : `Vence en ${dias} ${dias === 1 ? "día" : "días"}`}
                        </p>
                      );
                      return null;
                    })()}
                    {consumos[f.id] && (consumos[f.id].eventosMes > 0 || consumos[f.id].promosActivas > 0) && (
                      <p className="mt-0.5 text-xs font-bold text-tinta/60">
                        {consumos[f.id].eventosMes} eventos · {consumos[f.id].promosActivas} promos
                        {consumos[f.id].euros > 0 && (
                          <span className="ml-1 rounded-full bg-oro/20 px-2 py-0.5 font-black text-oro-700">
                            +{consumos[f.id].euros} € a cobrar
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  {guardando === f.id && <Loader2 size={16} className="animate-spin text-magenta" />}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <select value={f.plan} onChange={(e) => guardar(f, { plan: e.target.value })}
                    className="min-h-[44px] rounded-xl border-2 border-magenta-100 bg-white px-3 text-sm font-extrabold outline-none focus:border-magenta">
                    {/* La frase ENTERA, no el importe recurrente.
                        Aquí es donde alguien elige un plan, así que tiene que
                        leer lo que cuesta: «Fundador · 30 € al mes (alta
                        aparte)» no dice que los dos primeros meses son 40. */}
                    {PLANES.map((p) => <option key={p} value={p}>{ETIQUETA[p]} · {precioTexto(p)}</option>)}
                  </select>
                  <select value={f.plan_estado} onChange={(e) => guardar(f, { plan_estado: e.target.value })}
                    className={`min-h-[44px] rounded-xl border-2 px-3 text-sm font-extrabold outline-none ${
                      f.plan_estado === "impago" ? "border-oro/60 bg-oro/10" : "border-magenta-100 bg-white"}`}>
                    {SUSCRIPCION.map((e) => <option key={e.k} value={e.k}>{e.label}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-5 text-center text-xs font-semibold text-tinta/50">
          Se marca a mano a propósito. Con este volumen, montar altas y bajas automáticas
          cuesta más de lo que ahorra.
        </p>
      </div>
    </main>
  );
}
