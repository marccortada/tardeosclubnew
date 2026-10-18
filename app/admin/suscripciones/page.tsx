"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, useDiferido, Buscador, Filtros, EstadoLista } from "@/components/panel/Paginacion";
import { PLANES, ETIQUETA, precioTexto, euroMes, vigente, diasRestantes, type Plan } from "@/lib/planes";
import { SUSCRIPCION, combinacionInvalida } from "@/lib/estados";
import { CLAVE_PLANES, setAjuste, planesActivos } from "@/lib/ajustes";
import { consumoDeTodos, type Consumo } from "@/lib/cuotas";
import Boton from "@/components/Boton";
import Hoja from "@/components/ui/Hoja";
import { Etiqueta } from "@/components/ui/Chip";
import Aviso from "@/components/admin/Aviso";
import { Store, Disc3, Loader2, Power, PowerOff } from "lucide-react";
import PanelFiltros, { CampoFiltro, claseFiltro, SelectorOrden } from "@/components/panel/PanelFiltros";

type Rol = "local" | "dj";
type Filtro = "todas" | "activa" | "impago" | "sin_suscripcion" | "cancelada";
/** Orden de la lista: por nombre, o por cuándo se acaba el periodo marcado. */
type Orden = "nombre" | "hasta_asc" | "hasta_desc";

type Ficha = {
  id: string;
  nombre: string;
  plan: Plan;
  plan_estado: string;
  plan_hasta: string | null;
  pago_proveedor: string | null;
  pago_referencia: string | null;
  /** Solo los locales tienen estado de publicación; en un DJ es null. */
  estado: string | null;
  reclamado: boolean;
};

/** Quita lo que rompe la sintaxis de los filtros de PostgREST. */
const limpiar = (s: string) => s.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();

const COLS = "id,plan,plan_estado,plan_hasta,pago_proveedor,pago_referencia";
const tablaDe = (r: Rol) => (r === "local" ? "locales" : "djs");
const nombreDe = (r: Rol) => (r === "local" ? "nombre" : "nombre_artistico");

// Los estados salen de `lib/estados.ts` y no de una lista propia: esta pantalla
// decía «Impago», el panel del local «pago pendiente» y colaboradores «oculto».
// Tres nombres para lo mismo hacen creer que son tres cosas distintas.

/**
 * Quién paga qué.
 *
 * Se marca A MANO, y es deliberado mientras sean pocos. Los campos
 * `pago_proveedor` y `pago_referencia` están para anotar dónde está el cobro
 * de verdad y para que el día que se automatice haya dónde enganchar.
 *
 * HOY TODO ESTO ESTÁ APAGADO: no hay pasarela y las reglas de los planes
 * (`planesActivos()`) están desactivadas. La pantalla existe para tenerla lista;
 * por eso lo primero que se ve es el aviso de que no se cobra nada.
 */
export default function AdminSuscripciones() {
  const [rol, setRol] = useState<Rol>("local");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  // Filtros del bloque plegable. Solo deciden qué se VE: no tocan planes ni cobros.
  const [planFiltro, setPlanFiltro] = useState<Plan | "">("");
  const [caduca30, setCaduca30] = useState(false);
  const [orden, setOrden] = useState<Orden>("nombre");
  const [cuentas, setCuentas] = useState<Partial<Record<Filtro, number>>>({});
  const [totales, setTotales] = useState<{ local?: number; dj?: number }>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const [consumos, setConsumos] = useState<Record<string, Consumo>>({});
  const [resumen, setResumen] = useState<{ mrr: number; pagando: number; impagos: number; caducadas: number; extras: number } | null>(null);

  // El interruptor general de las reglas de los planes.
  const [reglas, setReglas] = useState<boolean | null>(null);
  const [paso, setPaso] = useState<0 | 1 | 2>(0); // 0 = cerrado; 1 y 2 = las dos confirmaciones
  const [cambiandoReglas, setCambiandoReglas] = useState(false);

  useEffect(() => { planesActivos().then(setReglas).catch(() => setReglas(false)); }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- el constructor de consultas de supabase-js no se deja tipar genérico
  const aplicar = (q: any, f: Filtro) => (f === "todas" ? q : q.eq("plan_estado", f));

  const p = usePaginado<Ficha>(
    (desde, hasta) => {
      // `estado` solo lo tienen los locales; en DJs no existe.
      const cols = rol === "local" ? `${COLS},estado,nombre,owner_id` : `${COLS},nombre_artistico,profile_id`;
      let q = aplicar(supabase.from(tablaDe(rol)).select(cols, { count: "exact" }), filtro);
      const l = limpiar(busca);
      if (l) q = q.ilike(nombreDe(rol), `%${l}%`);
      if (planFiltro) q = q.eq("plan", planFiltro);
      if (caduca30) {
        // De ahora a dentro de 30 días: las que hay que renovar pronto (las ya
        // caducadas no entran; para esas está la cifra «caducadas sin renovar»).
        const ahora = new Date();
        q = q.gte("plan_hasta", ahora.toISOString()).lte("plan_hasta", new Date(ahora.getTime() + 30 * 86400000).toISOString());
      }
      // Por fecha de fin: las que no tienen fecha, al final.
      q = orden === "nombre" ? q.order(nombreDe(rol)) : q.order("plan_hasta", { ascending: orden === "hasta_asc", nullsFirst: false });
      return q.order("id").range(desde, hasta).then((r: any) => ({
        ...r,
        data: (r.data ?? []).map((x: any): Ficha => ({
          id: x.id,
          nombre: x.nombre ?? x.nombre_artistico ?? "",
          plan: x.plan ?? "basic",
          plan_estado: x.plan_estado ?? "sin_suscripcion",
          plan_hasta: x.plan_hasta ?? null,
          pago_proveedor: x.pago_proveedor ?? null,
          pago_referencia: x.pago_referencia ?? null,
          estado: x.estado ?? null,
          reclamado: Boolean(x.owner_id ?? x.profile_id),
        })),
        // 42703/PGRST204 = el lote 33 aún no está pegado.
        error: r.error && (r.error.code === "42703" || r.error.code === "PGRST204")
          ? { message: "falta pegar el lote 33 (supabase/33_planes.sql)." }
          : r.error,
      }));
    },
    [rol, filtro, busca, planFiltro, caduca30, orden],
    25,
  );

  // Contadores de cada filtro, del tipo de ficha elegido.
  const contar = () => {
    const fs: Filtro[] = ["todas", "activa", "impago", "sin_suscripcion", "cancelada"];
    Promise.all(fs.map((f) =>
      aplicar(supabase.from(tablaDe(rol)).select("id", { count: "exact", head: true }), f)
        .then((r: { count: number | null }) => [f, r.count ?? 0] as const),
    )).then((rs) => setCuentas(Object.fromEntries(rs)));
  };
  useEffect(contar, [rol]);

  useEffect(() => {
    Promise.all((["local", "dj"] as Rol[]).map((r) =>
      supabase.from(tablaDe(r)).select("id", { count: "exact", head: true }).then((x) => [r, x.count ?? 0] as const),
    )).then((rs) => setTotales(Object.fromEntries(rs)));
  }, []);

  /**
   * Las cifras de arriba. Solo se piden las fichas marcadas al corriente (son
   * pocas), no las tablas enteras.
   *
   * «Al corriente» significa al corriente Y dentro del periodo: una suscripción
   * que caducó en marzo no puede seguir sumando al recurrente. Y el recurrente
   * es el precio de siempre, no el de alta.
   */
  const calcularResumen = async () => {
    const [l, d, il, id] = await Promise.all([
      supabase.from("locales").select("id,plan,plan_hasta").eq("plan_estado", "activa"),
      supabase.from("djs").select("id,plan,plan_hasta").eq("plan_estado", "activa"),
      supabase.from("locales").select("id", { count: "exact", head: true }).eq("plan_estado", "impago"),
      supabase.from("djs").select("id", { count: "exact", head: true }).eq("plan_estado", "impago"),
    ]);
    if (l.error || d.error) { setResumen(null); return; }
    const activas = [...(l.data ?? []).map((x) => ({ ...x, local: true })), ...(d.data ?? []).map((x) => ({ ...x, local: false }))];
    const pagando = activas.filter((f) => vigente("activa", f.plan_hasta));
    let extras = 0;
    try {
      const locPagando = pagando.filter((f) => f.local);
      if (locPagando.length) {
        const c = await consumoDeTodos(Object.fromEntries(locPagando.map((f) => [f.id, f.plan])));
        extras = Object.values(c).reduce((s, x) => s + x.euros, 0);
      }
    } catch { /* los extras son informativos: sin ellos la pantalla sigue valiendo */ }
    setResumen({
      mrr: Math.round(pagando.reduce((s, f) => s + euroMes((f.plan ?? "basic") as Plan), 0)),
      pagando: pagando.length,
      impagos: (il.count ?? 0) + (id.count ?? 0),
      caducadas: activas.length - pagando.length,
      extras,
    });
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; el estado se fija al llegar los datos
  useEffect(() => { calcularResumen(); }, []);

  // Los extras del mes de los locales de la página visible.
  useEffect(() => {
    if (rol !== "local" || !p.filas.length) return;
    consumoDeTodos(Object.fromEntries(p.filas.map((f) => [f.id, f.plan])))
      .then((c) => setConsumos((prev) => ({ ...prev, ...c })))
      .catch(() => { /* informativo */ });
  }, [rol, p.filas]);

  const guardar = async (f: Ficha, campos: Partial<Ficha>) => {
    // Se comprueba ANTES de mandarlo. El lote 41 también lo rechaza en la base
    // —que es quien manda—, pero un error de Postgres en pantalla no explica
    // qué hacer, y aquí sí se puede decir cuál de las dos casillas mover.
    const choque = combinacionInvalida(campos.estado ?? f.estado, campos.plan_estado ?? f.plan_estado);
    if (choque) { setAviso({ tono: "error", texto: choque }); return; }
    setGuardando(f.id); setAviso(null);
    const { data, error } = await supabase.from(tablaDe(rol)).update(campos).eq("id", f.id).select("id,plan,plan_estado");
    setGuardando(null);
    if (error) { setAviso({ tono: "error", texto: "No se pudo guardar: " + error.message }); return; }
    // El trigger `proteger_plan` revierte sin dar error si no eres admin: hay
    // que mirar lo que devuelve, no si falló.
    const g = data?.[0] as { plan?: string } | undefined;
    if (!g) { setAviso({ tono: "error", texto: "No se pudo guardar. ¿Tu cuenta es admin?" }); return; }
    if (campos.plan && g.plan !== campos.plan) {
      setAviso({ tono: "error", texto: "La base rechazó el cambio de plan. ¿Tu cuenta es admin?" }); return;
    }
    p.cambiar((x) => x.id === f.id, campos);
    setAviso({ tono: "ok", texto: `Guardado: ${f.nombre}.` });
    contar(); calcularResumen();
  };

  const cambiarReglas = async () => {
    const nuevo = !reglas;
    setCambiandoReglas(true); setAviso(null);
    const { error: e } = await setAjuste(CLAVE_PLANES, nuevo ? "true" : "false");
    setCambiandoReglas(false);
    setPaso(0);
    if (e) { setAviso({ tono: "error", texto: "No se pudo cambiar: " + e.message }); return; }
    setReglas(nuevo);
    setAviso({ tono: "ok", texto: nuevo ? "Reglas de los planes ACTIVADAS." : "Reglas de los planes apagadas. Todo vuelve a estar abierto para todos." });
    // La web cachea los ajustes 30 s; se le avisa para que se entere ya.
    const { data: { session } } = await supabase.auth.getSession();
    fetch("/api/revalidar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: session?.access_token }),
    }).catch(() => {});
  };

  const apagado = reglas === false;
  const activos = [planFiltro, caduca30, orden !== "nombre"].filter(Boolean).length;
  const quitarExtras = () => { setPlanFiltro(""); setCaduca30(false); setOrden("nombre"); };

  return (
    <SeccionPanel
      titulo="Suscripciones"
      descripcion="Planes de locales y DJs, marcados a mano."
      ancho="ancho"
    >
      {/* Lo primero que se ve, y sin ambigüedad: hoy aquí no se cobra nada. */}
      {apagado && (
        <section role="status" className="mb-5 flex items-start gap-3 rounded-2xl border-2 border-aviso/40 bg-aviso-fondo p-4 md:p-5">
          <PowerOff size={28} className="mt-0.5 shrink-0 text-aviso" aria-hidden />
          <div>
            <p className="text-lg font-extrabold text-aviso md:text-xl">Próximamente: nadie paga ni se cobra nada</p>
            <p className="mt-1 text-[15px] text-tinta">
              Todos tienen todas las funciones. Lo que marques abajo es solo una nota interna.
            </p>
          </div>
        </section>
      )}

      {/* El interruptor general. Nace APAGADO a propósito: encenderlo hoy solo
          le quitaría el logo a fichas nuestras sin que nadie gane nada. */}
      {reglas !== null && (
        <section className={`mb-5 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${reglas ? "border-oro/50 bg-oro/10" : "border-linea bg-white"}`}>
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${reglas ? "bg-oro text-sobre-oro" : "bg-marfil-100 text-tinta-suave"}`}>
            <Power size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Reglas de los planes: {reglas ? "ACTIVADAS" : "apagadas"}</p>
            <p className="text-[15px] text-tinta-suave">
              {reglas
                ? "Los Basic no enseñan su logo ni el sello de verificado. Los Pro y superiores, sí."
                : "Todos enseñan logo y sello. Solo se enciende el día que haya clientes pagando."}
            </p>
          </div>
          <Boton variante="contorno" tamano="pequeno" cargando={cambiandoReglas} onClick={() => setPaso(1)}>
            {reglas ? "Apagar reglas" : "Activar reglas…"}
          </Boton>
        </section>
      )}

      {/* Cifras. Con todo apagado se enseñan igual, pero dicen lo que son. */}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { n: resumen ? `${resumen.mrr} €` : "…", t: apagado ? "al mes anotados (no se cobran)" : "al mes" },
          { n: resumen?.pagando ?? "…", t: "al corriente" },
          { n: resumen?.impagos ?? "…", t: "con pago pendiente" },
          { n: resumen?.caducadas ?? "…", t: "caducadas sin renovar" },
        ].map((k) => (
          <div key={k.t} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
            <p className="text-2xl font-bold leading-none">{k.n}</p>
            <p className="mt-1.5 text-sm text-tinta-suave">{k.t}</p>
          </div>
        ))}
      </section>
      {resumen && resumen.extras > 0 && (
        <p className="-mt-3 mb-5 text-sm text-tinta-suave">
          Además, {resumen.extras} € en extras del mes por encima del plan{apagado ? " (no se cobran)" : ""}.
        </p>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <Filtros<Rol>
          valor={rol}
          onCambiar={(r) => { setRol(r); setConsumos({}); }}
          opciones={[
            { clave: "local", label: "Locales", n: totales.local },
            { clave: "dj", label: "DJs", n: totales.dj },
          ]}
        />
        <Buscador valor={texto} onCambiar={setTexto} placeholder={rol === "local" ? "Buscar local por nombre…" : "Buscar DJ por nombre…"} />
        <Filtros<Filtro>
          valor={filtro}
          onCambiar={setFiltro}
          opciones={[
            { clave: "todas", label: "Todas", n: cuentas.todas },
            { clave: "activa", label: "Al corriente", n: cuentas.activa },
            { clave: "impago", label: "Pago pendiente", n: cuentas.impago },
            { clave: "sin_suscripcion", label: "Sin suscripción", n: cuentas.sin_suscripcion },
            { clave: "cancelada", label: "Canceladas", n: cuentas.cancelada },
          ]}
        />
        <PanelFiltros clave="admin-suscripciones" activos={activos} onLimpiar={quitarExtras}>
          <CampoFiltro etiqueta="Plan">
            <select value={planFiltro} onChange={(e) => setPlanFiltro(e.target.value as Plan | "")} className={claseFiltro}>
              <option value="">Cualquier plan</option>
              {PLANES.map((x) => <option key={x} value={x}>{ETIQUETA[x]}</option>)}
            </select>
          </CampoFiltro>
          <SelectorOrden<Orden> valor={orden} onCambiar={setOrden} opciones={[
            { clave: "nombre", label: "Nombre (A-Z)" },
            { clave: "hasta_asc", label: "Acaban antes" },
            { clave: "hasta_desc", label: "Acaban más tarde" },
          ]} />
          {/* Casilla grande: con el dedo una casilla nativa de 16 px no se acierta. */}
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 self-end rounded-xl border border-linea-fuerte bg-white px-3 text-[15px] font-semibold">
            <input type="checkbox" checked={caduca30} onChange={(e) => setCaduca30(e.target.checked)} className="h-5 w-5 accent-magenta" />
            Caduca en los próximos 30 días
          </label>
        </PanelFiltros>
      </div>

      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length}
        vacio={busca || filtro !== "todas" || activos > 0 ? "Nada con esos filtros." : rol === "local" ? "No hay locales." : "No hay DJs."} />

      {p.filas.length > 0 && (
        <ul className={`flex flex-col gap-3 ${p.cargando ? "opacity-60" : ""}`}>
          {p.filas.map((f) => {
            const dias = diasRestantes(f.plan_hasta);
            const c = consumos[f.id];
            return (
              <li key={f.id} className="flex flex-col gap-3 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-marfil-100 text-tinta-suave">
                    {rol === "local" ? <Store size={20} aria-hidden /> : <Disc3 size={20} aria-hidden />}
                  </span>
                  <div className="min-w-0">
                    <Link href={rol === "local" ? `/locales/${f.id}` : `/djs/${f.id}`} target="_blank"
                      className="block truncate font-bold leading-tight hover:text-magenta-700">{f.nombre || "(sin nombre)"}</Link>
                    <p className="text-sm text-tinta-suave">
                      {f.reclamado ? "Perfil reclamado" : "Sin reclamar · ficha nuestra"}
                      {f.pago_referencia && ` · ${f.pago_proveedor ?? "pago"}: ${f.pago_referencia}`}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {/* Hasta cuándo está pagado. Solo se dice cuando importa:
                          una fecha a seis meses vista no es información. */}
                      {dias !== null && f.plan_estado === "activa" && dias < 0 && (
                        <Etiqueta tono="error">Caducó hace {Math.abs(dias)} {Math.abs(dias) === 1 ? "día" : "días"}</Etiqueta>
                      )}
                      {dias !== null && f.plan_estado === "activa" && dias >= 0 && dias <= 14 && (
                        <Etiqueta tono="aviso">{dias === 0 ? "Vence hoy" : `Vence en ${dias} ${dias === 1 ? "día" : "días"}`}</Etiqueta>
                      )}
                      {c && (c.eventosMes > 0 || c.promosActivas > 0) && (
                        <Etiqueta>{c.eventosMes} eventos · {c.promosActivas} promos{c.euros > 0 ? ` · +${c.euros} € extras${apagado ? " (no se cobran)" : ""}` : ""}</Etiqueta>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:w-[460px]">
                  <label className="flex flex-col gap-1">
                    <span className="text-[13px] font-semibold text-tinta-suave">Plan</span>
                    <select value={f.plan} disabled={guardando === f.id} onChange={(e) => guardar(f, { plan: e.target.value as Plan })}
                      className="min-h-[44px] rounded-xl border border-linea-fuerte bg-white px-3 text-[15px] font-semibold outline-none focus:border-magenta focus:ring-4 focus:ring-magenta/15">
                      {/* La frase ENTERA, no el importe recurrente: «Fundador ·
                          30 € al mes (alta aparte)» no dice que los dos primeros
                          meses son 40. */}
                      {PLANES.map((pl) => <option key={pl} value={pl}>{ETIQUETA[pl]} · {precioTexto(pl)}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[13px] font-semibold text-tinta-suave">Estado del pago</span>
                    <select value={f.plan_estado} disabled={guardando === f.id} onChange={(e) => guardar(f, { plan_estado: e.target.value })}
                      className={`min-h-[44px] rounded-xl border px-3 text-[15px] font-semibold outline-none focus:border-magenta focus:ring-4 focus:ring-magenta/15 ${
                        f.plan_estado === "impago" ? "border-aviso/50 bg-aviso-fondo" : "border-linea-fuerte bg-white"}`}>
                      {SUSCRIPCION.map((e) => <option key={e.k} value={e.k}>{e.label}</option>)}
                    </select>
                  </label>
                </div>
                {guardando === f.id && <Loader2 size={18} className="animate-spin text-magenta" aria-label="Guardando" />}
              </li>
            );
          })}
        </ul>
      )}

      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />

      <p className="mt-5 text-sm text-tinta-suave">
        Se marca a mano a propósito: con este volumen, montar altas y bajas automáticas cuesta más de lo que ahorra.
      </p>

      {/* Doble confirmación para ENCENDER: es lo que cambia lo que ve el público.
          Para apagar basta una: devuelve la app a como está hoy. */}
      <Hoja abierta={paso > 0} onCerrar={() => !cambiandoReglas && setPaso(0)}
        titulo={reglas ? "¿Apagar las reglas de los planes?" : paso === 1 ? "Activar las reglas de los planes" : "Última confirmación"}
        pie={
          <div className="grid gap-2">
            {reglas ? (
              <Boton ancho cargando={cambiandoReglas} onClick={cambiarReglas}>Sí, apagarlas</Boton>
            ) : paso === 1 ? (
              <Boton ancho variante="contorno" onClick={() => setPaso(2)}>Entiendo las consecuencias, continuar</Boton>
            ) : (
              <Boton ancho variante="peligro" cargando={cambiandoReglas} onClick={cambiarReglas}>Sí, activar las reglas ahora</Boton>
            )}
            <Boton ancho variante={reglas || paso === 2 ? "contorno" : "primario"} disabled={cambiandoReglas} onClick={() => setPaso(0)}>
              Cancelar
            </Boton>
          </div>
        }>
        {reglas ? (
          <p className="text-base">
            Todos los locales y DJs volverán a enseñar su logo y su sello, paguen o no. Es como funciona la app hoy y se
            puede volver a activar cuando quieras.
          </p>
        ) : paso === 1 ? (
          <div className="flex flex-col gap-3 text-base">
            <p>Si las activas, <strong>en cuanto guardes</strong>:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Los locales en <strong>Basic</strong> (hoy, casi todos) dejan de enseñar su logo en el mapa y su sello de verificado: llevarán la chincheta de TardeosClub.</li>
              <li>Lo que cada ficha puede usar (logo, sello y las funciones de pago del panel) pasa a depender del plan y del estado de pago marcados aquí.</li>
              <li>Nadie recibe un cobro: no hay pasarela. Pero lo que ve el público cambia para todos a la vez.</li>
            </ul>
          </div>
        ) : (
          <p className="text-base">
            ¿Seguro? Ahora mismo hay <strong>{resumen?.pagando ?? "…"}</strong> fichas al corriente. El resto pasa a funcionar
            como Basic desde este momento. Se puede apagar después.
          </p>
        )}
      </Hoja>
    </SeccionPanel>
  );
}
