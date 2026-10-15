"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import MapaClient from "@/components/MapaClient";
import TarjetaPlan from "@/components/tardicola/TarjetaPlan";
import Hoja from "@/components/ui/Hoja";
import CabeceraApp, { useZona } from "@/components/CabeceraApp";
import { useAuth } from "@/lib/useAuth";
import { getAdn, getZonas, type AdnTardicola, type Zona } from "@/lib/tardicola";
import { encajeDe } from "@/lib/recomendar";
import { FAMILIAS, familiasDe } from "@/lib/musica";
import { TIPOS_EVENTO, mismoValor } from "@/lib/adn";
import { mismaZona } from "@/lib/zonas";
import { plegar, contieneTexto } from "@/lib/texto";
import { hoyEnEspana, diasEntre, diaDeLaSemana } from "@/lib/fechas";
import type { Tardeo } from "@/lib/types";

type Vista = "mapa" | "lista" | "mes";
type Cuando = "" | "finde" | "hoy" | "manana";
type Entrada = "" | "gratis" | "hasta20";
type Filtros = { zona: string; musica: string[]; tipo: string[]; entrada: Entrada };

const VACIOS: Filtros = { zona: "", musica: [], tipo: [], entrada: "" };

/** Lo del ADN que sirve de filtro por defecto (dossier pág. 4). */
function filtrosDeAdn(adn: AdnTardicola | null, zonaCabecera: string): Filtros {
  if (!adn) return { ...VACIOS, zona: zonaCabecera };
  const musica = [...new Set(adn.musica.map((m) => m.split(":")[0]))].filter((id) => FAMILIAS.some((f) => f.id === id));
  const entrada: Entrada = adn.precioMax === "gratis" ? "gratis"
    : ["hasta10", "de10a20", "hasta20"].includes(adn.precioMax) ? "hasta20" : "";
  // Los tipos del ADN pueden venir con otra grafía (ADN antiguo): se pasan a la
  // del catálogo para que la hoja de Filtros los enseñe marcados.
  const tipo = [...new Set(adn.tiposEvento.map((x) => TIPOS_EVENTO.find((t) => mismoValor(t, x)) ?? x))];
  return { zona: zonaCabecera || adn.zonas[0] || "", musica, tipo, entrada };
}

const iguales = (a: Filtros, b: Filtros) =>
  mismaZona(a.zona, b.zona) && a.entrada === b.entrada
  && [...a.musica].sort().join() === [...b.musica].sort().join()
  && [...a.tipo].sort().join() === [...b.tipo].sort().join();

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function enCuando(t: Tardeo, c: Cuando, hoy: string): boolean {
  if (!c) return true;
  const dias = diasEntre(hoy, t.fecha);
  if (c === "hoy") return dias === 0;
  if (c === "manana") return dias === 1;
  const dow = diaDeLaSemana(t.fecha);
  const hastaDomingo = (7 - diaDeLaSemana(hoy)) % 7;
  return dias >= 0 && dias <= hastaDomingo && (dow === 5 || dow === 6 || dow === 0);
}

function pasaFiltros(t: Tardeo, f: Filtros): boolean {
  if (f.zona && !mismaZona(t.zona, f.zona)) return false;
  if (f.musica.length && !familiasDe(t.estilo).some((x) => f.musica.includes(x))) return false;
  if (f.tipo.length && !f.tipo.some((x) => mismoValor(t.tipoEvento, x))) return false;
  if (f.entrada === "gratis" && t.tipoEntrada !== "gratis") return false;
  if (f.entrada === "hasta20" && !(t.tipoEntrada === "gratis" || (t.precio != null && t.precio <= 20))) return false;
  return true;
}

/**
 * El estado vive en la URL: volver de una ficha deja todo como estaba.
 * Los filtros solo se escriben si la persona los eligió (`explicitos`); si
 * salen del ADN no se escriben, para que al recargar se vuelva a partir del ADN
 * (y, si lo cambia en Mi ADN, Eventos lo note).
 */
function aUrl(v: Vista, c: Cuando, q: string, f: Filtros, dia: string, explicitos: boolean) {
  const p = new URLSearchParams();
  if (v !== "lista") p.set("vista", v);
  if (c) p.set("cuando", c);
  if (q) p.set("q", q);
  if (explicitos) {
    if (f.zona) p.set("zona", f.zona);
    if (f.musica.length) p.set("musica", f.musica.join(","));
    if (f.tipo.length) p.set("tipo", f.tipo.join(","));
    if (f.entrada) p.set("entrada", f.entrada);
    // «Sin filtros» elegido a propósito: hay que distinguirlo de «sin elegir».
    if (!f.zona && !f.musica.length && !f.tipo.length && !f.entrada) p.set("f", "1");
  }
  if (dia) p.set("dia", dia);
  const qs = p.toString();
  return qs ? `/eventos?${qs}` : "/eventos";
}

export default function EventosCliente({ todos }: { todos: Tardeo[] }) {
  const hoy = hoyEnEspana();
  const { user } = useAuth();
  const [zonaCabecera] = useZona();
  const [adn, setAdn] = useState<AdnTardicola | null>(null);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [vista, setVista] = useState<Vista>("lista");
  const [cuando, setCuando] = useState<Cuando>("");
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filtros>(VACIOS);
  const [dia, setDia] = useState(hoy);
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [hoja, setHoja] = useState(false);
  const [borrador, setBorrador] = useState<Filtros>(VACIOS);
  // `leido` es estado (no ref) para que el efecto 3 no escriba la URL con los
  // valores iniciales antes de que se apliquen los de la URL.
  const [leido, setLeido] = useState(false);
  const yaLeida = useRef(false);
  /** true = filtros elegidos por la persona (URL u hoja); false = salen del ADN. */
  const explicitos = useRef(false);

  // 1) Leer la URL al montar (sin useSearchParams: la lista sale ya en el HTML).
  //    Una sola vez: StrictMode re-ejecuta el efecto y no debe releer una URL ya reescrita.
  useEffect(() => {
    if (yaLeida.current) return;
    yaLeida.current = true;
    const p = new URLSearchParams(window.location.search);
    const v = p.get("vista");
    if (v === "mapa" || v === "mes" || v === "lista") setVista(v);
    const c = p.get("cuando");
    if (c === "finde" || c === "hoy" || c === "manana") setCuando(c);
    // Compatibilidad con los enlaces antiguos de /tardeos (?cuando=semana…).
    setQ(p.get("q") ?? "");
    const d = p.get("dia");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) { setDia(d); setMes(d.slice(0, 7)); }
    explicitos.current = p.get("f") === "1" || ["zona", "musica", "tipo", "entrada"].some((k) => p.has(k));
    if (explicitos.current) {
      setF({
        zona: p.get("zona") ?? "",
        musica: (p.get("musica") ?? "").split(",").filter(Boolean),
        tipo: (p.get("tipo") ?? "").split(",").filter(Boolean),
        entrada: (p.get("entrada") as Entrada) || "",
      });
    }
    getZonas().then(setZonas);
    setLeido(true);
  }, []);

  // 2) ADN: es el filtro por defecto, salvo que la URL traiga filtros elegidos.
  useEffect(() => {
    if (!user) { setAdn(null); return; }
    let vivo = true;
    getAdn(user.id).then((a) => {
      if (!vivo) return;
      setAdn(a);
      if (!explicitos.current) setF(filtrosDeAdn(a, leerZonaSegura()));
    });
    return () => { vivo = false; };
  }, [user]);

  // La zona de la cabecera manda sobre la del ADN mientras no haya filtros elegidos.
  useEffect(() => {
    if (!explicitos.current && zonaCabecera) setF((p) => ({ ...p, zona: zonaCabecera }));
  }, [zonaCabecera]);

  // 3) Guardar el estado en la URL (replace: no llena el historial).
  useEffect(() => {
    if (!leido) return;
    window.history.replaceState(window.history.state, "", aUrl(vista, cuando, q, f, vista === "mes" ? dia : "", explicitos.current));
  }, [leido, vista, cuando, q, f, dia]);

  /** Aplica filtros elegidos; si coinciden con el ADN vuelven a ser «del ADN». */
  const aplicar = (nuevos: Filtros) => {
    const porDefecto = adn ? filtrosDeAdn(adn, leerZonaSegura()) : { ...VACIOS, zona: leerZonaSegura() };
    explicitos.current = !iguales(nuevos, porDefecto);
    setF(nuevos);
  };

  // 4) Posición: se guarda al bajar y se recupera al volver de una ficha.
  useEffect(() => {
    const clave = "tc_scroll_eventos";
    try {
      const y = Number(sessionStorage.getItem(clave) || 0);
      if (y > 0) setTimeout(() => window.scrollTo(0, y), 60);
    } catch { /* nada */ }
    const guardar = () => { try { sessionStorage.setItem(clave, String(window.scrollY)); } catch { /* nada */ } };
    window.addEventListener("scroll", guardar, { passive: true });
    return () => window.removeEventListener("scroll", guardar);
  }, []);

  const texto = plegar(q.trim());
  const coincide = (t: Tardeo) => !texto || contieneTexto(t.titulo, texto) || contieneTexto(t.local.nombre, texto)
    || contieneTexto(t.zona, texto) || contieneTexto(t.estilo, texto) || t.djs.some((d) => contieneTexto(d.nombre, texto));

  const base = useMemo(() => todos.filter((t) => t.fecha >= hoy && coincide(t) && pasaFiltros(t, f)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todos, texto, f, hoy]);
  const lista = useMemo(() => base.filter((t) => enCuando(t, cuando, hoy)), [base, cuando, hoy]);
  const contarBorrador = useMemo(() => todos.filter((t) => t.fecha >= hoy && coincide(t) && pasaFiltros(t, borrador) && enCuando(t, cuando, hoy)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todos, borrador, cuando, texto, hoy]);
  const afin = (t: Tardeo) => adn ? encajeDe(t, adn).motivos.length > 0 : false;

  const abrirFiltros = () => { setBorrador(f); setHoja(true); };
  // El select de zona solo marca si el valor coincide con una opción: se busca
  // la del catálogo equivalente (el ADN o la URL pueden traer otra grafía).
  const zonaOpcion = zonas.find((z) => borrador.zona && mismaZona(z.nombre, borrador.zona))?.nombre ?? borrador.zona;
  const chip = (activo: boolean) =>
    `min-h-[44px] flex-1 whitespace-nowrap rounded-full px-3 text-[15px] font-semibold transition ${activo ? "bg-magenta-50 text-magenta-700" : "bg-marfil-100 text-tinta"}`;
  const seg = (activo: boolean) =>
    `inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[15px] font-semibold ${activo ? "bg-magenta text-white shadow-tarjeta" : "text-tinta"}`;

  return (
    <main className="bg-fondo">
      <CabeceraApp titulo="Eventos" />
      <div className="mx-auto max-w-3xl px-4 pt-4 md:pt-8">
        <h1 className="mb-4 hidden text-[34px] font-bold md:block">Eventos</h1>
        <label className="relative block">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar planes, locales, DJs…"
            className="min-h-[48px] w-full rounded-2xl border border-linea bg-marfil-100 pl-11 pr-4 text-[16px] text-tinta outline-none focus:border-magenta" />
        </label>

        <div className="mt-3 flex gap-2">
          {([["finde", "Este finde"], ["hoy", "Hoy"], ["manana", "Mañana"]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={cuando === k && vista !== "mes"} className={chip(cuando === k && vista !== "mes")}
              onClick={() => { setCuando((p) => (p === k ? "" : k)); if (vista === "mes") setVista("lista"); }}>{l}</button>
          ))}
          <button type="button" aria-pressed={vista === "mes"} className={chip(vista === "mes")}
            onClick={() => { setVista("mes"); setCuando(""); }}>Mes</button>
        </div>

        <div className="mt-3 flex gap-1 rounded-2xl bg-marfil-100 p-1" role="tablist" aria-label="Vista">
          <button role="tab" aria-selected={vista === "mapa"} className={seg(vista === "mapa")} onClick={() => setVista("mapa")}>Mapa</button>
          <button role="tab" aria-selected={vista === "lista"} className={seg(vista === "lista")} onClick={() => setVista("lista")}>Lista</button>
          <button type="button" className={seg(false)} onClick={abrirFiltros}><SlidersHorizontal size={17} aria-hidden /> Filtros</button>
        </div>

        <div className="mt-3 flex items-center justify-between text-[15px] text-tinta-suave">
          <span>{vista === "mes" ? `${plural(base.length, "plan", "planes")} en total` : plural(lista.length, "plan", "planes")}</span>
          <Link href="/directorio" className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-magenta-700 dark:text-magenta-400">
            <BookOpen size={17} aria-hidden /> Directorio
          </Link>
        </div>

        {vista === "mapa" && (
          <div className="relative mt-2 h-[60dvh] min-h-[360px] overflow-hidden rounded-3xl border border-linea">
            <MapaClient tardeos={lista} />
          </div>
        )}

        {vista === "lista" && <ListaPlanes lista={lista} afin={afin} vacio={() => { explicitos.current = true; setF(VACIOS); setCuando(""); setQ(""); }} />}

        {vista === "mes" && (
          <Calendario base={base} mes={mes} setMes={setMes} dia={dia} setDia={setDia} hoy={hoy} afin={afin} />
        )}
      </div>

      <Hoja abierta={hoja} onCerrar={() => setHoja(false)} titulo="Filtros"
        pie={
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => { aplicar(borrador); setHoja(false); }}
              className="min-h-[52px] w-full rounded-2xl bg-magenta text-[17px] font-bold text-white">
              Ver {plural(contarBorrador, "plan", "planes")}
            </button>
            {adn && (
              <button type="button" onClick={() => setBorrador(filtrosDeAdn(adn, leerZonaSegura()))}
                className="min-h-[44px] w-full text-[16px] font-semibold text-magenta-700 dark:text-magenta-400">Restaurar mi ADN</button>
            )}
          </div>
        }>
        <p className="text-[15px] text-tinta-suave">
          {adn ? "Partimos de tu ADN. Puedes cambiarlo: no se guarda en tu perfil." : "Elige qué te apetece."}
        </p>
        <Grupo titulo="¿Cuándo?">
          {([["hoy", "Hoy"], ["manana", "Mañana"], ["finde", "Este finde"]] as const).map(([k, l]) => (
            <Pildora key={k} on={cuando === k} onClick={() => setCuando((p) => (p === k ? "" : k))}>{l}</Pildora>
          ))}
          <Pildora on={vista === "mes"} onClick={() => { setVista("mes"); setCuando(""); }}>Elegir fecha</Pildora>
        </Grupo>
        <Grupo titulo="Zona">
          <select value={zonaOpcion} onChange={(e) => setBorrador({ ...borrador, zona: e.target.value })}
            className="min-h-[48px] w-full rounded-2xl border border-linea bg-superficie px-4 text-[16px] text-tinta">
            <option value="">Todas las zonas</option>
            {zonas.map((z) => <option key={z.slug} value={z.nombre}>{z.nombre}</option>)}
            {zonaOpcion && !zonas.some((z) => z.nombre === zonaOpcion) && <option value={zonaOpcion}>{zonaOpcion}</option>}
          </select>
        </Grupo>
        <Grupo titulo="Música">
          {FAMILIAS.map((m) => (
            <Pildora key={m.id} on={borrador.musica.includes(m.id)}
              onClick={() => setBorrador({ ...borrador, musica: alternar(borrador.musica, m.id) })}>{m.nombre}</Pildora>
          ))}
        </Grupo>
        <Grupo titulo="Tipo de plan">
          {TIPOS_EVENTO.map((x) => (
            <Pildora key={x} on={borrador.tipo.includes(x)} onClick={() => setBorrador({ ...borrador, tipo: alternar(borrador.tipo, x) })}>{x}</Pildora>
          ))}
        </Grupo>
        <Grupo titulo="Entrada">
          {([["gratis", "Gratis"], ["hasta20", "Hasta 20 €"], ["", "Cualquier precio"]] as const).map(([k, l]) => (
            <Pildora key={l} on={borrador.entrada === k} onClick={() => setBorrador({ ...borrador, entrada: k })}>{l}</Pildora>
          ))}
        </Grupo>
      </Hoja>
    </main>
  );
}

function leerZonaSegura() {
  try { return localStorage.getItem("tc_zona") ?? ""; } catch { return ""; }
}
const alternar = (l: string[], v: string) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-[16px] font-bold text-tinta">{titulo}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
function Pildora({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`min-h-[44px] rounded-full px-4 text-[15px] font-semibold transition ${on ? "bg-magenta-50 text-magenta-700 ring-1 ring-magenta/40" : "bg-marfil-100 text-tinta"}`}>
      {children}
    </button>
  );
}

function ListaPlanes({ lista, afin, vacio }: { lista: Tardeo[]; afin: (t: Tardeo) => boolean; vacio: () => void }) {
  if (!lista.length) {
    return (
      <div className="mt-6 rounded-3xl border border-linea bg-superficie p-6 text-center">
        <p className="text-[18px] font-bold text-tinta">No hay planes con esta combinación</p>
        <p className="mt-1 text-[15px] text-tinta-suave">Prueba otra fecha, otra zona o quita algún filtro.</p>
        <button type="button" onClick={vacio} className="mt-4 min-h-[48px] rounded-2xl bg-magenta px-6 font-bold text-white">Ampliar búsqueda</button>
      </div>
    );
  }
  return (
    <div className="mt-2 grid gap-4 sm:grid-cols-2">
      {lista.map((t) => <TarjetaPlan key={t.id} t={t} afin={afin(t)} patrocinado={t.destacado} />)}
    </div>
  );
}

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

/** Vista Mes: el mes entero con un punto en los días con planes, y debajo los del día elegido. */
function Calendario({ base, mes, setMes, dia, setDia, hoy, afin }: {
  base: Tardeo[]; mes: string; setMes: (m: string) => void; dia: string; setDia: (d: string) => void; hoy: string; afin: (t: Tardeo) => boolean;
}) {
  const [a, m] = mes.split("-").map(Number);
  const primero = new Date(Date.UTC(a, m - 1, 1));
  const nDias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const hueco = (primero.getUTCDay() + 6) % 7; // lunes primero
  const conPlan = new Set(base.map((t) => t.fecha));
  const nombreLargo = primero.toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
  // Solo la primera letra: la clase `capitalize` ponía «Octubre De 2026».
  const nombre = nombreLargo.charAt(0).toUpperCase() + nombreLargo.slice(1);
  const mover = (d: number) => {
    const n = new Date(Date.UTC(a, m - 1 + d, 1));
    setMes(n.toISOString().slice(0, 7));
  };
  const delDia = base.filter((t) => t.fecha === dia);
  const iso = (d: number) => `${mes}-${String(d).padStart(2, "0")}`;
  const titulo = new Date(dia + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", timeZone: "UTC" });

  return (
    <>
      <div className="mt-2 rounded-3xl border border-linea bg-superficie p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="Mes anterior" onClick={() => mover(-1)} disabled={mes <= hoy.slice(0, 7)}
            className="grid h-11 w-11 place-items-center rounded-full text-tinta disabled:opacity-30"><ChevronLeft size={20} aria-hidden /></button>
          <p className="text-[17px] font-bold text-tinta">{nombre}</p>
          <button type="button" aria-label="Mes siguiente" onClick={() => mover(1)}
            className="grid h-11 w-11 place-items-center rounded-full text-tinta"><ChevronRight size={20} aria-hidden /></button>
        </div>
        <div className="grid grid-cols-7 text-center text-[13px] font-semibold text-tinta-suave">
          {DIAS.map((d) => <span key={d} className="py-1">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {Array.from({ length: hueco }).map((_, i) => <span key={`h${i}`} />)}
          {Array.from({ length: nDias }).map((_, i) => {
            const d = iso(i + 1);
            const sel = d === dia;
            const pasado = d < hoy;
            return (
              <button key={d} type="button" disabled={pasado} onClick={() => setDia(d)} aria-pressed={sel}
                aria-label={`${i + 1}${conPlan.has(d) ? ", con planes" : ""}`}
                className={`relative mx-auto grid h-11 w-11 place-items-center rounded-xl text-[15px] font-semibold ${sel ? "bg-magenta text-white" : pasado ? "text-tinta-suave/50" : "text-tinta hover:bg-marfil-100"}`}>
                {i + 1}
                {conPlan.has(d) && <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${sel ? "bg-white" : "bg-magenta"}`} aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>
      <h2 className="mt-5 text-[22px] font-bold capitalize text-tinta">{titulo}</h2>
      {delDia.length ? (
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          {delDia.map((t) => <TarjetaPlan key={t.id} t={t} afin={afin(t)} patrocinado={t.destacado} />)}
        </div>
      ) : (
        <p className="mt-2 text-[15px] text-tinta-suave">Ese día no hay planes con tus filtros. Los días con punto sí tienen.</p>
      )}
    </>
  );
}
