"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { getAdn, tieneAdn, type AdnTardicola } from "@/lib/tardicola";
import { ordenarPorEncaje } from "@/lib/recomendar";
import TardeoCard from "@/components/TardeoCard";
import Hoja from "@/components/ui/Hoja";
import { FAMILIAS, familiasDe, normalizarEstilo, etiquetaDe, idEstilo } from "@/lib/musica";
import { AMBIENTES, TIPOS_EVENTO, PUBLICOS, DRESS_CODES, contiene, mismoValor } from "@/lib/adn";
import { mismaZona, zonasDe } from "@/lib/zonas";
import { plegar, contieneTexto } from "@/lib/texto";
import { useUbicacion } from "@/lib/ubicacion";
import { distanciaKm } from "@/lib/geo";
import { Tardeo } from "@/lib/types";
import { medir } from "@/lib/metricas";
import { claseBoton } from "@/components/Boton";
import { claseCampo } from "@/components/ui/Campo";
import {
  SlidersHorizontal, X, Loader2, Search, Navigation, CalendarDays, Music, ChevronDown, Sparkles, Wand2,
  MapPin, Euro, MessageCircle, BellRing, Store, ArrowRight,
} from "lucide-react";
import { hoyEnEspana, proximoDia, diasEntre, diaDeLaSemana } from "@/lib/fechas";

/** La comunidad de WhatsApp de TardeosClub (la misma que enlaza la portada). */
const URL_COMUNIDAD = "https://chat.whatsapp.com/KMAxRPoj36w6cOSGGwnZhi?mode=ems_wa_c";

/**
 * Cuándo se sale.
 *
 * Arriba, a la vista, los cuatro que más se usan: todas, hoy, este finde y
 * esta semana. Los días sueltos —viernes, sábado y domingo— siguen (los pide
 * E-04: quien tiene libre el domingo no quiere ver lo del viernes) y van en
 * «Otro día» junto al calendario. Cada uno apunta a la PRÓXIMA vez que cae ese
 * día, contando hoy: un viernes por la tarde, «Viernes» es hoy.
 */
const DOW: Record<string, number> = { domingo: 0, viernes: 5, sabado: 6 };

const CUANDOS = [
  { k: "hoy", label: "Hoy" },
  { k: "finde", label: "Este finde" },
  { k: "semana", label: "Esta semana" },
  { k: "viernes", label: "Viernes" },
  { k: "sabado", label: "Sábado" },
  { k: "domingo", label: "Domingo" },
];
const RAPIDOS = ["hoy", "finde", "semana"];

/**
 * Tramos de precio en vez de "gratis / entrada / por lista".
 *
 * Los tardeos con importe van de 0,01 € a 39 €, con la mediana en 10: por eso
 * el corte está ahí y no en cifras redondas inventadas.
 *
 * OJO con los de pago SIN importe: la app antigua deja publicar sin ponerlo y
 * son más de la mitad. No se meten en "hasta 10 €" porque sería adivinar, pero
 * tampoco pueden quedarse sin tramo: van en el suyo, diciendo la verdad.
 */
const PRECIOS = [
  { k: "gratis", label: "Gratis" },
  { k: "hasta10", label: "Hasta 10 €" },
  { k: "de10a20", label: "10–20 €" },
  { k: "mas20", label: "Más de 20 €" },
  { k: "sinprecio", label: "Con entrada", pie: "precio sin indicar" },
  { k: "lista", label: "Por lista" },
];

/** ¿Cae este tardeo en ese tramo de precio? A nivel de módulo para poder
 *  preguntar por un tramo suelto al decidir cuáles enseñar. */
function enTramo(t: Tardeo, tramo: string): boolean {
  if (tramo === "gratis") return t.tipoEntrada === "gratis";
  if (tramo === "lista") return t.tipoEntrada === "lista";
  if (tramo === "sinprecio") return t.tipoEntrada === "pago" && t.precio == null;
  if (t.precio == null) return false; // de pago pero sin importe: no adivinamos
  if (tramo === "hasta10") return t.precio <= 10;
  if (tramo === "de10a20") return t.precio > 10 && t.precio <= 20;
  return t.precio > 20;
}

/** "Sábado 18 de octubre": el encabezado de cada día del listado. */
function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  const dia = f.toLocaleDateString("es-ES", { weekday: "long", timeZone: "UTC" });
  const mes = f.toLocaleDateString("es-ES", { month: "long", timeZone: "UTC" });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d} de ${mes}`;
}

/**
 * `familia` y `estilo` son los dos niveles del filtro musical. El estilo guarda
 * el id de la taxonomía (`electronica:afro house`), no la etiqueta, porque hay
 * etiquetas repetidas en dos familias y con el texto no se distinguirían.
 */
type Filtro = {
  zona: string | null;
  familia: string | null;
  estilo: string | null;
  precio: string | null;
  publico: string | null;
  dressCode: string | null;
  ambiente: string | null;
  tipoEvento: string | null;
};

const VACIO: Filtro = {
  zona: null, familia: null, estilo: null, precio: null,
  publico: null, dressCode: null, ambiente: null, tipoEvento: null,
};

/** Qué panel está desplegado en escritorio. Solo uno a la vez. */
type Panel = null | "cuando" | "zona" | "musica" | "precio" | "ambiente" | "mas";

function Chip({ activo, children, onClick }: { activo: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`min-h-[44px] whitespace-nowrap rounded-full border px-4 py-2 text-[15px] font-semibold transition ${
        activo
          ? "border-tinta bg-tinta text-white"
          : "border-linea-fuerte bg-white text-tinta hover:border-tinta/50"
      }`}
    >
      {children}
    </button>
  );
}

/** Pastilla de fecha de la fila de arriba. */
function Pastilla({ activo, children, onClick, expandido }: {
  activo: boolean; children: React.ReactNode; onClick: () => void; expandido?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={expandido === undefined ? activo : undefined}
      aria-expanded={expandido}
      className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[15px] font-bold transition active:scale-[0.98] ${
        activo ? "bg-oro text-sobre-oro shadow-tarjeta" : "border border-linea-fuerte bg-white text-tinta hover:border-tinta/40"
      }`}
    >
      {children}
    </button>
  );
}

/** Botón de la barra de filtros de escritorio: enseña qué lleva puesto. */
function BotonFiltro({
  icono: Icono, texto, valor, abierto, puesto, desplegable = true, onClick,
}: {
  icono: typeof Music;
  texto: string;
  valor?: string | null;
  abierto?: boolean;
  puesto?: boolean;
  desplegable?: boolean;
  onClick: () => void;
}) {
  const marcado = Boolean(valor) || Boolean(puesto);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={desplegable ? Boolean(abierto) : undefined}
      aria-pressed={desplegable ? undefined : Boolean(puesto)}
      className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold transition ${
        marcado ? "border-tinta bg-tinta text-white" : abierto ? "border-tinta bg-white text-tinta" : "border-linea-fuerte bg-white text-tinta hover:border-tinta/50"
      }`}
    >
      <Icono size={17} aria-hidden />
      <span className="max-w-[12rem] truncate">{valor || texto}</span>
      {desplegable && <ChevronDown size={15} className={`transition ${abierto ? "rotate-180" : ""}`} aria-hidden />}
    </button>
  );
}

/** Título de un grupo dentro de la hoja o de un panel. */
function Rotulo({ children, primero }: { children: React.ReactNode; primero?: boolean }) {
  return <p className={`mb-2 text-[15px] font-bold text-tinta ${primero ? "" : "mt-5"}`}>{children}</p>;
}

/**
 * Qué hacer cuando no hay nada que enseñar. Tres salidas reales: la comunidad
 * de WhatsApp (donde se anuncian los planes), los avisos y los locales.
 */
function SiguientesPasos() {
  const tarjetas = [
    { href: URL_COMUNIDAD, externo: true, icono: MessageCircle, titulo: "Únete a la comunidad", texto: "Los planes se cuentan antes en el grupo de WhatsApp." },
    { href: "/perfil/notificaciones", externo: false, icono: BellRing, titulo: "Activa los avisos", texto: "Te avisamos cuando haya tardeos nuevos." },
    { href: "/colaboradores", externo: false, icono: Store, titulo: "Mira los locales", texto: "Descubre quién organiza y sigue sus fichas." },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tarjetas.map(({ href, externo, icono: Icono, titulo, texto }) => {
        const contenido = (
          <>
            <Icono size={24} className="shrink-0 text-magenta" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold leading-tight">{titulo}</span>
              <span className="mt-0.5 block text-[15px] text-tinta-suave">{texto}</span>
            </span>
            <ArrowRight size={18} className="shrink-0 text-tinta-suave transition group-hover:translate-x-0.5 group-hover:text-tinta" aria-hidden />
          </>
        );
        const cls = "group flex min-h-[72px] items-center gap-3 rounded-2xl border border-linea bg-white p-4 text-left shadow-tarjeta transition hover:shadow-elevada";
        return externo ? (
          <a key={titulo} href={href} target="_blank" rel="noopener noreferrer" className={cls}>{contenido}</a>
        ) : (
          <Link key={titulo} href={href} className={cls}>{contenido}</Link>
        );
      })}
    </div>
  );
}

/** Rejilla de tarjetas: 2 en móvil, 3 en tableta, 4 en escritorio. */
function Rejilla({ tardeos, distancia }: { tardeos: Tardeo[]; distancia?: (t: Tardeo) => number | null }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 md:grid-cols-3 md:gap-y-8 lg:grid-cols-4">
      {tardeos.map((t) => (
        <TardeoCard key={t.id} tardeo={t} distanciaKm={distancia?.(t)} />
      ))}
    </div>
  );
}

/**
 * El listado con sus filtros.
 *
 * Móvil: buscador, fila de fechas y un botón «Filtros» que abre una hoja con
 * todo lo demás (zona, música, precio…). Escritorio: la misma fila de fechas y
 * una barra con los filtros a la vista, que despliegan su panel debajo.
 *
 * Hay tres órdenes y se pisan en este orden: cercanía > encaje > fecha. La
 * cercanía gana porque es la más concreta. Ordenado por fecha, el resultado
 * va agrupado por día, que es como se decide un plan.
 *
 * Los tardeos llegan ya cargados del servidor (`todos`) para que el HTML salga
 * con las fichas dentro. Por lo mismo no se usa `useSearchParams` para leer
 * ?zona=, que saca la página del renderizado de servidor: se lee al montar.
 */
export default function ListaTardeos({ todos, masAdelante = [] }: { todos: Tardeo[]; masAdelante?: Tardeo[] }) {
  const [f, setF] = useState<Filtro>(VACIO);
  const [panel, setPanel] = useState<Panel>(null);
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [q, setQ] = useState("");
  const [cuando, setCuando] = useState<string | null>(null);
  /** Un día concreto (YYYY-MM-DD). Excluyente con `cuando`: una fecha ya es un
   *  "cuándo", y tenerlos a la vez daría listas vacías sin que se entienda. */
  const [fechaExacta, setFechaExacta] = useState("");
  const [cerca, setCerca] = useState(false);
  const { coords, estado: estadoUbi, pedir: pedirUbicacion } = useUbicacion();

  // Gustos de quien mira, para poder ordenar por encaje. Sin sesión o sin
  // gustos, `adn` se queda a null y todo funciona igual.
  const { user } = useAuth();
  const [adn, setAdn] = useState<AdnTardicola | null>(null);
  const [porEncaje, setPorEncaje] = useState(false);
  useEffect(() => {
    if (!user) { setAdn(null); return; }
    getAdn(user.id).then(setAdn);
  }, [user]);
  const hayGustos = tieneAdn(adn);

  /** Distancia del tardeo a donde estás, o null si le faltan coordenadas. */
  const distanciaDe = (t: Tardeo) =>
    coords && t.lat && t.lng ? distanciaKm(coords, { lat: t.lat, lng: t.lng }) : null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zona = params.get("zona");
    if (zona) setF((p) => ({ ...p, zona }));
    // ?cuando=hoy|finde|semana… llega desde los atajos de la portada.
    const c = params.get("cuando");
    if (c && CUANDOS.some((x) => x.k === c)) setCuando(c);
    // ?q=… llega desde el buscador de la portada.
    const busq = params.get("q");
    if (busq) setQ(busq);
  }, []);

  const set = (k: keyof Filtro, v: string) => setF((p) => ({ ...p, [k]: p[k] === v ? null : v }));

  /** Al cambiar de familia se suelta el estilo: un "Afro House" no pinta nada
   *  dentro de Latina, y si se quedara pegado el listado saldría vacío. */
  const elegirFamilia = (id: string) =>
    setF((p) => (p.familia === id ? { ...p, familia: null, estilo: null } : { ...p, familia: id, estilo: null }));

  const abrir = (p: Panel) => setPanel((actual) => (actual === p ? null : p));
  const elegirCuando = (k: string | null) => { setFechaExacta(""); setCuando((p) => (k === null || p === k ? null : k)); };

  /** El permiso se pide con un gesto, no al entrar: el navegador solo enseña
   *  el diálogo si lo dispara el usuario. */
  const alternarCerca = () => {
    if (!coords) { pedirUbicacion(); setCerca(true); return; }
    setCerca((v) => !v);
  };

  // Agrupadas (Barcelona, Maresme, Costa Brava…) en vez de una por municipio.
  const zonasDisponibles = zonasDe(todos).map((z) => z.zona);

  /**
   * De cada lista fija de opciones, las que algún tardeo tiene de verdad. Los
   * migrados no traen ambiente, público ni outfit, y un filtro que nunca
   * encuentra nada no se lee como "aún no hay datos": se lee como "está roto".
   * Sobre `todos` y no sobre lo filtrado, para que el panel no cambie según lo
   * que lleves puesto.
   */
  const conDatos = useMemo(() => {
    const hay = (opciones: readonly string[], tiene: (t: Tardeo, v: string) => boolean) =>
      opciones.filter((v) => todos.some((t) => tiene(t, v)));
    return {
      ambiente: hay(AMBIENTES, (t, v) => contiene(t.ambiente, v)),
      tipoEvento: hay(TIPOS_EVENTO, (t, v) => mismoValor(t.tipoEvento, v)),
      publico: hay(PUBLICOS, (t, v) => contiene(t.publico, v)),
      dressCode: hay(DRESS_CODES, (t, v) => mismoValor(t.dressCode, v)),
      precio: PRECIOS.filter((p) => todos.some((t) => enTramo(t, p.k))),
    };
  }, [todos]);

  // --- Búsqueda por texto (título, local, zona, estilo, DJ), sin tildes ---
  const coincideTexto = (t: Tardeo) => {
    const s = plegar(q.trim());
    if (!s) return true;
    return (
      contieneTexto(t.titulo, s) ||
      contieneTexto(t.local.nombre, s) ||
      contieneTexto(t.zona, s) ||
      contieneTexto(t.estilo, s) ||
      t.djs.some((d) => contieneTexto(d.nombre, s))
    );
  };

  // --- ¿CUÁNDO? Días contados en hora de España, no en la del navegador ---
  const enRango = (t: Tardeo) => {
    if (fechaExacta) return t.fecha === fechaExacta;
    if (!cuando) return true;
    const dias = diasEntre(hoyEnEspana(), t.fecha);
    if (cuando === "hoy") return dias === 0;
    if (cuando in DOW) return t.fecha === proximoDia(DOW[cuando]);
    if (cuando === "semana") return dias >= 0 && dias <= 7;
    if (cuando === "finde") {
      // De viernes a domingo; si hoy ya es finde, lo que queda de él.
      const dow = diaDeLaSemana(t.fecha); // 0 dom, 5 vie, 6 sab
      const hastaDomingo = (7 - diaDeLaSemana(hoyEnEspana())) % 7;
      return dias >= 0 && dias <= hastaDomingo && (dow === 5 || dow === 6 || dow === 0);
    }
    return true;
  };

  /** El estilo se traduce al vocabulario común antes de comparar: los
   *  migrados vienen escritos a mano ("Tecno", "Techouse", "80s"…). */
  const encajaMusica = (t: Tardeo) => {
    if (f.estilo) return normalizarEstilo(t.estilo).includes(f.estilo);
    if (f.familia) return familiasDe(t.estilo).includes(f.familia);
    return true;
  };

  /** Todo menos la fecha. Se usa también para «Más adelante», donde la fecha
   *  de este mes no aplica pero la zona o la música sí. */
  const encajaSinFecha = (t: Tardeo) =>
    (!f.zona || mismaZona(t.zona, f.zona)) &&
    encajaMusica(t) &&
    (!f.precio || enTramo(t, f.precio)) &&
    (!f.publico || contiene(t.publico, f.publico)) &&
    (!f.ambiente || contiene(t.ambiente, f.ambiente)) &&
    (!f.tipoEvento || mismoValor(t.tipoEvento, f.tipoEvento)) &&
    (!f.dressCode || mismoValor(t.dressCode, f.dressCode)) &&
    coincideTexto(t);

  const filtrados = todos.filter((t) => encajaSinFecha(t) && enRango(t));

  /** Cercanía > encaje > fecha (ver arriba). */
  const porCercania = Boolean(cerca && coords);
  const ordenEspecial = porCercania || (porEncaje && hayGustos);
  const lista = porCercania
    ? [...filtrados].sort((a, b) => (distanciaDe(a) ?? Infinity) - (distanciaDe(b) ?? Infinity))
    : porEncaje && hayGustos
      ? ordenarPorEncaje(filtrados, adn)
      : filtrados;

  /** Por día, en el orden en que llegan (ya vienen por fecha del servidor). */
  const porDia = useMemo(() => {
    const grupos: { fecha: string; tardeos: Tardeo[] }[] = [];
    for (const t of lista) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.fecha === t.fecha) ultimo.tardeos.push(t);
      else grupos.push({ fecha: t.fecha, tardeos: [t] });
    }
    return grupos;
  }, [lista]);

  // «Más adelante» no tiene sentido si se ha pedido un día de este mes.
  const masAdelanteVisibles = cuando || fechaExacta ? [] : masAdelante.filter(encajaSinFecha);

  /**
   * Qué se busca, y sobre todo qué se busca SIN encontrar nada: una búsqueda
   * vacía es alguien diciendo qué cartelera le falta. Con espera de segundo y
   * medio y a partir de tres letras, para no medir cada tecla.
   */
  const cuantosSalen = useRef(0);
  // En un efecto y no en el render: tocar un ref mientras se pinta está mal en
  // React moderno (el render puede repetirse o descartarse).
  useEffect(() => { cuantosSalen.current = lista.length; });
  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 3) return;
    const t = setTimeout(() => {
      medir(cuantosSalen.current > 0 ? "busqueda" : "busqueda_vacia", { detalle: texto });
    }, 1500);
    return () => clearTimeout(t);
  }, [q]);

  /** Qué filtros se usan de verdad: se avisa solo de los que acaban de
   *  aparecer, así el filtro que se añada mañana se mide solo. */
  const filtrosPuestos = useRef<Set<string>>(new Set());
  useEffect(() => {
    const activos = [
      f.zona && `zona:${f.zona}`,
      (f.estilo || f.familia) && `musica:${f.estilo || f.familia}`,
      f.precio && `precio:${f.precio}`,
      f.publico && `publico:${f.publico}`,
      f.ambiente && `ambiente:${f.ambiente}`,
      f.tipoEvento && `tipo:${f.tipoEvento}`,
      f.dressCode && `outfit:${f.dressCode}`,
      cuando && `cuando:${cuando}`,
      fechaExacta && "fecha-exacta",
      cerca && "cerca-de-mi",
      porEncaje && "por-encaje",
    ].filter(Boolean) as string[];

    for (const a of activos) if (!filtrosPuestos.current.has(a)) medir("filtro", { detalle: a });
    filtrosPuestos.current = new Set(activos);
  }, [f, cuando, fechaExacta, cerca, porEncaje]);

  const etiquetaMusica = f.estilo ? etiquetaDe(f.estilo) : f.familia ? etiquetaDe(f.familia) : null;
  /** "sáb, 30 ago" en vez de "2026-08-30", que no lo lee nadie de un vistazo. */
  const etiquetaFecha = fechaExacta
    ? new Date(fechaExacta + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
    : null;
  const etiquetaCuando = etiquetaFecha ?? (cuando ? CUANDOS.find((c) => c.k === cuando)!.label : null);
  /** Lo elegido en «Otro día» (un día suelto o una fecha), para la pastilla. */
  const etiquetaOtroDia = etiquetaFecha ?? (cuando && !RAPIDOS.includes(cuando) ? etiquetaCuando : null);
  const etiquetaPrecio = f.precio ? PRECIOS.find((p) => p.k === f.precio)!.label : null;
  const nMas = [f.tipoEvento, f.publico, f.dressCode].filter(Boolean).length;

  /** Lo que hay puesto, cada cosa con su forma de quitarla. */
  const activas: { k: string; label: string; quitar: () => void }[] = [
    etiquetaCuando && { k: "cuando", label: etiquetaCuando, quitar: () => elegirCuando(null) },
    porCercania && { k: "cerca", label: "Cerca de mí", quitar: () => setCerca(false) },
    porEncaje && hayGustos && !porCercania && { k: "encaje", label: "Para ti", quitar: () => setPorEncaje(false) },
    f.zona && { k: "zona", label: f.zona, quitar: () => setF((p) => ({ ...p, zona: null })) },
    etiquetaMusica && { k: "musica", label: etiquetaMusica, quitar: () => setF((p) => ({ ...p, familia: null, estilo: null })) },
    etiquetaPrecio && { k: "precio", label: etiquetaPrecio, quitar: () => setF((p) => ({ ...p, precio: null })) },
    f.ambiente && { k: "ambiente", label: f.ambiente, quitar: () => setF((p) => ({ ...p, ambiente: null })) },
    f.tipoEvento && { k: "tipo", label: f.tipoEvento, quitar: () => setF((p) => ({ ...p, tipoEvento: null })) },
    f.publico && { k: "publico", label: f.publico, quitar: () => setF((p) => ({ ...p, publico: null })) },
    f.dressCode && { k: "outfit", label: f.dressCode, quitar: () => setF((p) => ({ ...p, dressCode: null })) },
  ].filter(Boolean) as { k: string; label: string; quitar: () => void }[];
  // En el botón «Filtros» del móvil no cuenta la fecha: esa se ve en su fila.
  const nEnHoja = activas.filter((a) => a.k !== "cuando").length;

  const limpiar = () => { setF(VACIO); setCuando(null); setFechaExacta(""); setCerca(false); setPorEncaje(false); };

  // ---------- Contenido de cada filtro (se usa en el panel y en la hoja) ----------
  const seccionOtroDia = (
    <div className="flex flex-wrap gap-2">
      {CUANDOS.filter((c) => !RAPIDOS.includes(c.k)).map((c) => (
        <Chip key={c.k} activo={cuando === c.k} onClick={() => elegirCuando(c.k)}>
          {c.label} <span className={cuando === c.k ? "text-white/75" : "text-tinta-suave"}>{Number(proximoDia(DOW[c.k]).slice(8))}</span>
        </Chip>
      ))}
      {/* En el móvil abre el calendario del sistema, que es lo que la gente ya
          sabe usar. `min` en hoy: elegir ayer solo lleva a una lista vacía. */}
      <label className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-linea-fuerte bg-white px-4 py-2 text-[15px] font-semibold text-tinta transition focus-within:border-magenta hover:border-tinta/50">
        <CalendarDays size={16} className="text-magenta" aria-hidden />
        <span className={fechaExacta ? "sr-only" : ""}>Elegir fecha</span>
        <input
          type="date"
          value={fechaExacta}
          min={hoyEnEspana()}
          onChange={(e) => { setCuando(null); setFechaExacta(e.target.value); }}
          className={`bg-transparent font-semibold outline-none ${fechaExacta ? "" : "w-0 opacity-0"}`}
        />
        {fechaExacta && (
          <button type="button" onClick={() => setFechaExacta("")} aria-label="Quitar la fecha"
            className="grid h-8 w-8 place-items-center rounded-full text-tinta-suave hover:bg-marfil-100">
            <X size={14} aria-hidden />
          </button>
        )}
      </label>
    </div>
  );

  const seccionZona = (
    <div className="flex flex-wrap gap-2">
      {zonasDisponibles.length === 0 ? (
        <p className="text-[15px] text-tinta-suave">No hay zonas que enseñar todavía.</p>
      ) : (
        zonasDisponibles.map((z) => <Chip key={z} activo={f.zona === z} onClick={() => set("zona", z)}>{z}</Chip>)
      )}
    </div>
  );

  // Música en dos pasos: las 86 etiquetas de golpe son un muro.
  const seccionMusica = (
    <>
      <div className="flex flex-wrap gap-2">
        {FAMILIAS.map((fam) => (
          <Chip key={fam.id} activo={f.familia === fam.id} onClick={() => elegirFamilia(fam.id)}>{fam.nombre}</Chip>
        ))}
      </div>
      {f.familia && (
        <div className="mt-3 rounded-xl bg-marfil-100 p-3">
          {FAMILIAS.find((x) => x.id === f.familia)!.grupos.map((g, i) => (
            <div key={g.nombre ?? i} className={i ? "mt-3" : ""}>
              {g.nombre && <p className="mb-1.5 text-[13px] font-bold uppercase tracking-wide text-tinta-suave">{g.nombre}</p>}
              <div className="flex flex-wrap gap-2">
                {g.estilos.map((e) => {
                  const id = idEstilo(f.familia!, e);
                  return <Chip key={id} activo={f.estilo === id} onClick={() => set("estilo", id)}>{e}</Chip>;
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const seccionPrecio = (
    <div className="flex flex-wrap gap-2">
      {conDatos.precio.map((p) => (
        <Chip key={p.k} activo={f.precio === p.k} onClick={() => set("precio", p.k)}>
          {p.label}
          {p.pie && <span className={f.precio === p.k ? "text-white/70" : "text-tinta-suave"}> · {p.pie}</span>}
        </Chip>
      ))}
    </div>
  );

  const seccionAmbiente = (
    <div className="flex flex-wrap gap-2">
      {conDatos.ambiente.map((v) => <Chip key={v} activo={f.ambiente === v} onClick={() => set("ambiente", v)}>{v}</Chip>)}
    </div>
  );

  const hayMas = conDatos.tipoEvento.length + conDatos.publico.length + conDatos.dressCode.length > 0;
  const seccionMas = (primero: boolean) => (
    <>
      {conDatos.tipoEvento.length > 0 && (
        <>
          <Rotulo primero={primero}>Tipo de evento</Rotulo>
          <div className="flex flex-wrap gap-2">
            {conDatos.tipoEvento.map((v) => <Chip key={v} activo={f.tipoEvento === v} onClick={() => set("tipoEvento", v)}>{v}</Chip>)}
          </div>
        </>
      )}
      {conDatos.publico.length > 0 && (
        <>
          <Rotulo primero={primero && conDatos.tipoEvento.length === 0}>Público</Rotulo>
          <div className="flex flex-wrap gap-2">
            {conDatos.publico.map((v) => <Chip key={v} activo={f.publico === v} onClick={() => set("publico", v)}>{v}</Chip>)}
          </div>
        </>
      )}
      {conDatos.dressCode.length > 0 && (
        <>
          <Rotulo primero={primero && conDatos.tipoEvento.length + conDatos.publico.length === 0}>Outfit / Dress code</Rotulo>
          <div className="flex flex-wrap gap-2">
            {conDatos.dressCode.map((v) => <Chip key={v} activo={f.dressCode === v} onClick={() => set("dressCode", v)}>{v}</Chip>)}
          </div>
        </>
      )}
    </>
  );

  const contenidoPanel: Record<Exclude<Panel, null>, React.ReactNode> = {
    cuando: seccionOtroDia,
    zona: seccionZona,
    musica: seccionMusica,
    precio: seccionPrecio,
    ambiente: seccionAmbiente,
    mas: seccionMas(true),
  };

  /** «Más adelante»: lo anunciado más allá del mes de vista, aparte y con la
   *  fecha bien a la vista en cada tarjeta. */
  const bloqueMasAdelante = masAdelanteVisibles.length > 0 && (
    <section className="mt-12 border-t border-linea pt-8 md:mt-16 md:pt-10">
      <h2 className="font-display text-[28px] font-bold leading-tight md:text-[36px]">Más adelante</h2>
      <p className="mb-5 mt-1 text-[16px] text-tinta-suave">Ya anunciados para dentro de más de un mes.</p>
      <Rejilla tardeos={masAdelanteVisibles} />
    </section>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 pb-8 pt-5 md:px-8 md:pt-10">
      <div className="mb-5 md:mb-6">
        <h1 className="font-display text-[34px] font-bold leading-tight md:text-[52px]">
          {f.zona ? `Tardeos en ${f.zona}` : "Tardeos"}
        </h1>
        <p className="mt-1 text-[16px] text-tinta-suave md:text-[18px]">
          Hoy, este finde o el día que te venga bien.
        </p>
      </div>

      {/*
        Si NO HAY NADA que filtrar este mes, no se enseña la maquinaria de
        filtrar. En la primera revisión del dueño se usaron 27 filtros y todos
        devolvieron una lista vacía: quien ve eso no concluye "no hay
        contenido", concluye "los filtros no funcionan". Se dice claro, se dan
        salidas y, si hay algo anunciado más adelante, se enseña.
      */}
      {todos.length === 0 ? (
        <>
          <div className="rounded-2xl border border-linea bg-white p-5 shadow-tarjeta md:p-8">
            <p className="font-display text-[24px] font-bold leading-tight md:text-[30px]">
              Este mes aún no hay tardeos anunciados
            </p>
            <p className="mt-2 max-w-2xl text-[16px] text-tinta-suave">
              Los locales los van publicando según se acercan las fechas.
              {masAdelante.length > 0 ? " Mientras tanto, abajo tienes los que ya están anunciados para más adelante." : ""}
            </p>
            <div className="mt-5">
              <SiguientesPasos />
            </div>
          </div>
          {bloqueMasAdelante}
        </>
      ) : (
        <>
          {/* Buscador + (en móvil) el botón que abre la hoja de filtros. */}
          <div className="mb-3 flex gap-2">
            <div className="relative flex-1">
              <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Buscar tardeos"
                placeholder="Busca DJ, local o zona"
                className={`${claseCampo} !min-h-[52px] !rounded-full pl-12 pr-12 shadow-tarjeta`}
              />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="Borrar la búsqueda"
                  className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-tinta-suave hover:bg-marfil-100">
                  <X size={18} aria-hidden />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setHojaAbierta(true)}
              className={`relative inline-flex min-h-[52px] shrink-0 items-center gap-2 rounded-full border px-4 text-[15px] font-bold shadow-tarjeta md:hidden ${
                nEnHoja > 0 ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-white text-tinta"}`}
            >
              <SlidersHorizontal size={18} aria-hidden />
              Filtros{nEnHoja > 0 ? ` (${nEnHoja})` : ""}
            </button>
          </div>

          {/* Fechas: lo que más se usa, a un toque en los dos tamaños. En el
              móvil se desliza en horizontal sin salirse del margen. */}
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
            <Pastilla activo={!cuando && !fechaExacta} onClick={() => elegirCuando(null)}>Todas las fechas</Pastilla>
            {RAPIDOS.map((k) => (
              <Pastilla key={k} activo={cuando === k} onClick={() => elegirCuando(k)}>
                {CUANDOS.find((c) => c.k === k)!.label}
              </Pastilla>
            ))}
            {/* «Otro día»: en móvil abre la hoja; en escritorio, su panel. */}
            <span className="md:hidden">
              <Pastilla activo={Boolean(etiquetaOtroDia)} onClick={() => setHojaAbierta(true)}>
                <CalendarDays size={16} aria-hidden /> {etiquetaOtroDia ?? "Otro día"}
              </Pastilla>
            </span>
            <span className="hidden md:inline-flex">
              <Pastilla activo={Boolean(etiquetaOtroDia)} expandido={panel === "cuando"} onClick={() => abrir("cuando")}>
                <CalendarDays size={16} aria-hidden /> {etiquetaOtroDia ?? "Otro día"}
                <ChevronDown size={15} className={`transition ${panel === "cuando" ? "rotate-180" : ""}`} aria-hidden />
              </Pastilla>
            </span>
          </div>

          {/* Barra de filtros de escritorio. */}
          <div className="mb-3 hidden flex-wrap items-center gap-2 border-t border-linea pt-3 md:flex">
            <BotonFiltro icono={MapPin} texto="Zona" valor={f.zona} abierto={panel === "zona"} onClick={() => abrir("zona")} />
            <BotonFiltro icono={Music} texto="Música" valor={etiquetaMusica} abierto={panel === "musica"} onClick={() => abrir("musica")} />
            <BotonFiltro icono={Euro} texto="Precio" valor={etiquetaPrecio} abierto={panel === "precio"} onClick={() => abrir("precio")} />
            {/* Solo si hay algún tardeo con ambiente puesto: si no, el botón
                lleva a un panel vacío. */}
            {conDatos.ambiente.length > 0 && (
              <BotonFiltro icono={Sparkles} texto="Ambiente" valor={f.ambiente} abierto={panel === "ambiente"} onClick={() => abrir("ambiente")} />
            )}
            {hayMas && (
              <BotonFiltro icono={SlidersHorizontal} texto={nMas > 0 ? `Más filtros (${nMas})` : "Más filtros"}
                abierto={panel === "mas"} puesto={nMas > 0} onClick={() => abrir("mas")} />
            )}
            <span className="mx-1 h-6 w-px bg-linea" aria-hidden />
            <BotonFiltro icono={estadoUbi === "pidiendo" ? Loader2 : Navigation} texto="Cerca de mí"
              puesto={porCercania} desplegable={false} onClick={alternarCerca} />
            {/* Solo si hay gustos que aplicar: un botón que no hace nada es
                peor que no tenerlo. */}
            {hayGustos && (
              <BotonFiltro icono={Wand2} texto="Para ti" puesto={porEncaje} desplegable={false} onClick={() => setPorEncaje((v) => !v)} />
            )}
          </div>

          {panel && (
            <div className="mb-4 hidden rounded-2xl border border-linea bg-white p-5 shadow-elevada md:block">
              {contenidoPanel[panel]}
            </div>
          )}

          {/* Lo que hay puesto, siempre a la vista y quitable de uno en uno. */}
          {activas.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {activas.map((a) => (
                <button
                  key={a.k}
                  type="button"
                  onClick={a.quitar}
                  aria-label={`Quitar ${a.label}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-magenta-50 pl-3.5 pr-2.5 text-[15px] font-semibold text-magenta-700 transition hover:bg-magenta-100"
                >
                  {a.label} <X size={15} aria-hidden />
                </button>
              ))}
              <button type="button" onClick={limpiar}
                className="inline-flex min-h-[44px] items-center rounded-xl px-2 text-[15px] font-bold text-tinta underline underline-offset-4 hover:text-magenta-700">
                Quitar todo
              </button>
            </div>
          )}

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-semibold text-tinta-suave" aria-live="polite">
              {lista.length} {lista.length === 1 ? "tardeo" : "tardeos"}
              {porCercania ? " · los más cercanos primero" : porEncaje && hayGustos ? " · los que más encajan primero" : ""}
            </p>
            {estadoUbi === "denegada" && cerca && (
              <p className="text-[15px] font-medium text-tinta-suave">Sin permiso de ubicación no podemos ordenar por cercanía.</p>
            )}
          </div>

          {lista.length === 0 ? (
            <div className="rounded-2xl border border-linea bg-white p-5 shadow-tarjeta md:p-8">
              <p className="text-[20px] font-bold leading-tight md:text-[24px]">No hay tardeos con esos filtros</p>
              <p className="mt-1 text-[16px] text-tinta-suave">Prueba con otro día o quita algún filtro.</p>
              <button type="button" onClick={() => { limpiar(); setQ(""); }} className={claseBoton("oro", "normal", false, "mt-4")}>
                Ver todos los tardeos
              </button>
              <div className="mt-6">
                <SiguientesPasos />
              </div>
            </div>
          ) : ordenEspecial ? (
            // Ordenado por cercanía o encaje, agrupar por día rompería el orden.
            <div className="pt-2"><Rejilla tardeos={lista} distancia={distanciaDe} /></div>
          ) : (
            porDia.map((g) => {
              const dias = diasEntre(hoyEnEspana(), g.fecha);
              return (
                <section key={g.fecha} className="pt-6 first:pt-3 md:pt-10">
                  <h2 className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[21px] font-bold leading-tight tracking-tight md:text-[26px]">{fechaLarga(g.fecha)}</span>
                    {(dias === 0 || dias === 1) && (
                      <span className="rounded-full bg-magenta px-2.5 py-0.5 text-[13px] font-bold text-white">
                        {dias === 0 ? "Hoy" : "Mañana"}
                      </span>
                    )}
                    <span className="text-[15px] font-medium text-tinta-suave">
                      {g.tardeos.length} {g.tardeos.length === 1 ? "tardeo" : "tardeos"}
                    </span>
                  </h2>
                  <Rejilla tardeos={g.tardeos} distancia={distanciaDe} />
                </section>
              );
            })
          )}

          {bloqueMasAdelante}

          {/* Hoja de filtros del móvil: todo en una sola pantalla que se
              recorre con el pulgar, y el resultado contado en el botón. */}
          <Hoja
            abierta={hojaAbierta}
            onCerrar={() => setHojaAbierta(false)}
            titulo="Filtros"
            pie={
              <div className="flex gap-2">
                <button type="button" onClick={limpiar} className={claseBoton("contorno", "normal", false, "shrink-0")}>
                  Quitar todo
                </button>
                <button type="button" onClick={() => setHojaAbierta(false)} className={claseBoton("primario", "normal", true)}>
                  Ver {lista.length} {lista.length === 1 ? "tardeo" : "tardeos"}
                </button>
              </div>
            }
          >
            <Rotulo primero>Otro día</Rotulo>
            {seccionOtroDia}

            <Rotulo>Orden</Rotulo>
            <div className="flex flex-wrap gap-2">
              <Chip activo={porCercania || (cerca && estadoUbi === "pidiendo")} onClick={alternarCerca}>
                <span className="inline-flex items-center gap-1.5">
                  {estadoUbi === "pidiendo" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Navigation size={16} aria-hidden />}
                  Cerca de mí
                </span>
              </Chip>
              {hayGustos && (
                <Chip activo={porEncaje} onClick={() => setPorEncaje((v) => !v)}>
                  <span className="inline-flex items-center gap-1.5"><Wand2 size={16} aria-hidden /> Para ti</span>
                </Chip>
              )}
            </div>
            {estadoUbi === "denegada" && cerca && (
              <p className="mt-2 text-[15px] text-tinta-suave">Sin permiso de ubicación no podemos ordenar por cercanía.</p>
            )}

            <Rotulo>Zona</Rotulo>
            {seccionZona}

            <Rotulo>Música</Rotulo>
            {seccionMusica}

            <Rotulo>Precio</Rotulo>
            {seccionPrecio}

            {conDatos.ambiente.length > 0 && (
              <>
                <Rotulo>Ambiente</Rotulo>
                {seccionAmbiente}
              </>
            )}

            {seccionMas(false)}
          </Hoja>
        </>
      )}
    </main>
  );
}
