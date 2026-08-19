"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { getAdn, tieneAdn, type AdnTardicola } from "@/lib/tardicola";
import { ordenarPorEncaje } from "@/lib/recomendar";
import TardeoCard from "@/components/TardeoCard";
import { FAMILIAS, familiasDe, normalizarEstilo, etiquetaDe, idEstilo } from "@/lib/musica";
import { AMBIENTES, TIPOS_EVENTO, PUBLICOS, DRESS_CODES, contiene, mismoValor } from "@/lib/adn";
import { zonaGrande, zonasDe } from "@/lib/zonas";
import { useUbicacion } from "@/lib/ubicacion";
import { distanciaKm } from "@/lib/geo";
import { Tardeo } from "@/lib/types";
import {
  SlidersHorizontal, X, Loader2, Search, Navigation, CalendarDays, Music, ChevronDown, Sparkles, Wand2,
} from "lucide-react";

/** Hoy en horario de España: el `min` del calendario y el corte de "Hoy" tienen
 *  que ser el mismo día que ve el usuario, no el del reloj del navegador. */
const hoyEnEspana = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

const CUANDOS = [
  { k: "hoy", label: "Hoy" },
  { k: "finde", label: "Este finde" },
  { k: "semana", label: "Esta semana" },
];

/**
 * Tramos de precio en vez de "gratis / entrada / por lista".
 *
 * Los 157 tardeos con importe van de 0,01 € a 39 €, con la mediana en 10: por
 * eso el corte está ahí y no en cifras redondas inventadas.
 *
 * OJO con los 361 de pago SIN importe: la app antigua deja publicar sin
 * ponerlo, y son el 55% de la cartelera. No se meten en "hasta 10 €" porque
 * sería adivinar —y quien filtra por precio lo hace justo porque lleva un
 * presupuesto—, pero tampoco pueden quedarse sin tramo: con cualquier filtro
 * puesto desaparecería más de la mitad del catálogo sin que se sepa por qué.
 * Van en su propio grupo, diciendo la verdad: hay que pagar, no sabemos cuánto.
 */
const PRECIOS = [
  { k: "gratis", label: "Gratis" },
  { k: "hasta10", label: "Hasta 10 €" },
  { k: "de10a20", label: "10–20 €" },
  { k: "mas20", label: "Más de 20 €" },
  { k: "sinprecio", label: "Con entrada", pie: "precio sin indicar" },
  { k: "lista", label: "Por lista" },
];

/**
 * `familia` y `estilo` son los dos niveles del filtro musical: se puede pedir
 * "Electrónica" entera o bajar a "Afro House". El estilo guarda el id de la
 * taxonomía (`electronica:afro house`), no la etiqueta, porque hay etiquetas
 * repetidas en dos familias —House está en Remember y en Electrónica— y con el
 * texto suelto no se distinguirían.
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

/** Qué panel está desplegado. Solo uno a la vez: en un móvil, dos abiertos
 *  empujan la cartelera fuera de la pantalla. */
type Panel = null | "cuando" | "musica" | "ambiente" | "mas";

function Chip({ activo, children, onClick }: { activo: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[44px] whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-extrabold transition ${
        activo
          ? "bg-magenta text-white"
          : "bg-white text-tinta/80 ring-1 ring-magenta-100 hover:ring-magenta"
      }`}
    >
      {children}
    </button>
  );
}

/** Botón de filtro principal: enseña si está puesto y qué lleva. */
function Principal({
  icono: Icono,
  texto,
  valor,
  activo,
  desplegable = true,
  onClick,
}: {
  icono: typeof Music;
  texto: string;
  /** Lo elegido, para verlo sin abrir el panel. */
  valor?: string | null;
  activo: boolean;
  desplegable?: boolean;
  onClick: () => void;
}) {
  const puesto = Boolean(valor) || activo;
  return (
    <button
      onClick={onClick}
      className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-extrabold transition ${
        puesto ? "bg-magenta text-white" : "bg-white text-tinta/80 ring-1 ring-magenta-100 hover:ring-magenta"
      }`}
    >
      <Icono size={17} />
      {valor || texto}
      {desplegable && <ChevronDown size={15} className={`transition ${activo ? "rotate-180" : ""}`} />}
    </button>
  );
}

/**
 * El listado con sus filtros.
 *
 * La estructura es la del documento: ¿cuándo? + ¿dónde? + ¿qué música? arriba,
 * y el resto detrás de "Más filtros". La idea es encontrar un plan en diez
 * segundos, no rellenar un formulario.
 *
 * Hay tres órdenes y se pisan en este orden: cercanía > encaje > fecha. La
 * cercanía gana porque es la más concreta —quien la pide quiere lo que tiene al
 * lado, y un encaje perfecto a 80 km no le sirve—, y "Para ti" solo aparece si
 * hay gustos que aplicar.
 *
 * Los tardeos llegan ya cargados del servidor (`todos`) en vez de pedirlos al
 * montar: así el HTML sale con las fichas dentro y Google no ve una página
 * vacía. Por lo mismo no se usa `useSearchParams` para leer ?zona=, que ese
 * hook saca la página del renderizado de servidor. Se lee al montar, que es
 * cuando se llega desde "Explora por zona".
 */
export default function ListaTardeos({ todos }: { todos: Tardeo[] }) {
  const [f, setF] = useState<Filtro>(VACIO);
  const [panel, setPanel] = useState<Panel>(null);
  const [q, setQ] = useState("");
  const [cuando, setCuando] = useState<string | null>(null);
  /**
   * Un día concreto (YYYY-MM-DD). Excluyente con los tres chips: una fecha ya
   * es un "cuándo", y tenerlos a la vez daría listas vacías sin que se entienda
   * por qué ("Hoy" + 30 de agosto no existe).
   */
  const [fechaExacta, setFechaExacta] = useState("");
  const [cerca, setCerca] = useState(false);
  const { coords, estado: estadoUbi, pedir: pedirUbicacion } = useUbicacion();

  // Gustos de quien mira, para poder ordenar por encaje. Sin sesión o sin
  // gustos, `adn` se queda a null y todo funciona igual que antes.
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
    const zona = new URLSearchParams(window.location.search).get("zona");
    if (zona) setF((p) => ({ ...p, zona }));
  }, []);

  const set = (k: keyof Filtro, v: string) => setF((p) => ({ ...p, [k]: p[k] === v ? null : v }));

  /** Al cambiar de familia se suelta el estilo: un "Afro House" no pinta nada
   *  dentro de Latina, y si se quedara pegado el listado saldría vacío sin que
   *  se vea por qué. */
  const elegirFamilia = (id: string) =>
    setF((p) => (p.familia === id ? { ...p, familia: null, estilo: null } : { ...p, familia: id, estilo: null }));

  const abrir = (p: Panel) => setPanel((actual) => (actual === p ? null : p));

  /** El permiso se pide con un gesto, no al entrar: el navegador solo enseña el
   *  diálogo si lo dispara el usuario. */
  const alternarCerca = () => {
    if (!coords) { pedirUbicacion(); setCerca(true); return; }
    setCerca((v) => !v);
  };

  // Agrupadas (Barcelona, Maresme, Costa Brava…) en vez de una por municipio.
  const zonasDisponibles = zonasDe(todos).map((z) => z.zona);

  // --- Búsqueda por texto (título, local, zona, estilo, DJ) ---
  const coincideTexto = (t: Tardeo) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      t.titulo.toLowerCase().includes(s) ||
      t.local.nombre.toLowerCase().includes(s) ||
      t.zona.toLowerCase().includes(s) ||
      (t.estilo || "").toLowerCase().includes(s) ||
      t.djs.some((d) => (d.nombre || "").toLowerCase().includes(s))
    );
  };

  // --- ¿CUÁNDO? (Hoy / Este finde / Esta semana) ---
  const enRango = (t: Tardeo) => {
    if (fechaExacta) return t.fecha === fechaExacta;
    if (!cuando) return true;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const d = new Date(t.fecha + "T00:00:00");
    const dias = Math.round((d.getTime() - hoy.getTime()) / 86400000);
    if (cuando === "hoy") return dias === 0;
    if (cuando === "semana") return dias >= 0 && dias <= 7;
    if (cuando === "finde") {
      const dow = d.getDay(); // 0 dom, 5 vie, 6 sab
      return dias >= 0 && dias <= 7 && (dow === 5 || dow === 6 || dow === 0);
    }
    return true;
  };

  /**
   * El estilo del tardeo se traduce al vocabulario común antes de comparar. Los
   * 662 migrados vienen escritos a mano ("Tecno", "Techouse", "80s",
   * "Latino + Salsa + Bachata"): comparando el texto a pelo, filtrar por Techno
   * dejaba fuera a los que pusieron "Tecno".
   */
  const encajaMusica = (t: Tardeo) => {
    if (f.estilo) return normalizarEstilo(t.estilo).includes(f.estilo);
    if (f.familia) return familiasDe(t.estilo).includes(f.familia);
    return true;
  };

  const encajaPrecio = (t: Tardeo) => {
    if (!f.precio) return true;
    if (f.precio === "gratis") return t.tipoEntrada === "gratis";
    if (f.precio === "lista") return t.tipoEntrada === "lista";
    if (f.precio === "sinprecio") return t.tipoEntrada === "pago" && t.precio == null;
    if (t.precio == null) return false; // de pago pero sin importe: no adivinamos
    if (f.precio === "hasta10") return t.precio <= 10;
    if (f.precio === "de10a20") return t.precio > 10 && t.precio <= 20;
    return t.precio > 20;
  };

  /**
   * Público y dress code se comparan sin mayúsculas ni acentos: los dos campos
   * llevan un "Otro…" de escritura libre, y si un local escribe "casual
   * elegante" en minúsculas tiene que seguir saliendo al filtrar por "Casual
   * Elegante". Es la misma lección que dejaron los 58 valores de estilo escritos
   * a mano en la app antigua.
   *
   * Los tardeos que no lo tienen puesto quedan fuera cuando el filtro está
   * activo: son la mayoría de los migrados, así que conviene que el filtro se
   * vea y se pueda quitar de un toque.
   */
  const encajaPublico = (t: Tardeo) => !f.publico || contiene(t.publico, f.publico);
  const encajaAmbiente = (t: Tardeo) => !f.ambiente || contiene(t.ambiente, f.ambiente);
  const encajaTipoEvento = (t: Tardeo) => !f.tipoEvento || mismoValor(t.tipoEvento, f.tipoEvento);
  const encajaDressCode = (t: Tardeo) => !f.dressCode || mismoValor(t.dressCode, f.dressCode);

  const filtrados = todos.filter(
    (t) =>
      (!f.zona || zonaGrande(t.zona) === f.zona) &&
      encajaMusica(t) &&
      encajaPrecio(t) &&
      encajaPublico(t) &&
      encajaAmbiente(t) &&
      encajaTipoEvento(t) &&
      encajaDressCode(t) &&
      coincideTexto(t) &&
      enRango(t)
  );

  /**
   * Con "Cerca de mí" puesto manda la cercanía: si estás en Mataró lo primero
   * que quieres ver es lo que tienes al lado, no lo que pasa antes en el
   * calendario. Los que no tienen coordenadas se van al final.
   */
  /**
   * Tres órdenes posibles y uno manda sobre otro: cercanía > encaje > fecha.
   *
   * La cercanía gana porque es la más concreta: quien la pide está diciendo
   * "enséñame lo que tengo al lado", y un encaje perfecto a 80 km no le sirve.
   */
  const porCercania = cerca && coords;
  const lista = porCercania
    ? [...filtrados].sort((a, b) => (distanciaDe(a) ?? Infinity) - (distanciaDe(b) ?? Infinity))
    : porEncaje && hayGustos
      ? ordenarPorEncaje(filtrados, adn)
      : filtrados;

  const etiquetaMusica = f.estilo ? etiquetaDe(f.estilo) : f.familia ? etiquetaDe(f.familia) : null;
  const nMas = [f.zona, f.precio, f.publico, f.dressCode, f.tipoEvento].filter(Boolean).length;
  /** "sáb, 30 ago" en vez de "2026-08-30", que no lo lee nadie de un vistazo. */
  const etiquetaFecha = fechaExacta
    ? new Date(fechaExacta + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
    : null;
  const etiquetaCuando = etiquetaFecha ?? (cuando ? CUANDOS.find((c) => c.k === cuando)!.label : null);

  const nTotal = nMas + (etiquetaMusica ? 1 : 0) + (etiquetaCuando ? 1 : 0) + (porCercania ? 1 : 0) + (f.ambiente ? 1 : 0) + (porEncaje && hayGustos && !porCercania ? 1 : 0);

  const activas: string[] = [
    etiquetaCuando,
    porCercania ? "Cerca de mí" : null,
    porEncaje && hayGustos && !porCercania ? "Para ti" : null,
    etiquetaMusica,
    f.ambiente,
    f.tipoEvento,
    f.zona,
    f.precio ? PRECIOS.find((p) => p.k === f.precio)!.label : null,
    f.publico,
    f.dressCode,
  ].filter(Boolean) as string[];

  const limpiar = () => { setF(VACIO); setCuando(null); setFechaExacta(""); setCerca(false); setPorEncaje(false); };

  return (
    <main className="mx-auto max-w-6xl px-4 pt-5 md:px-8 md:pt-8">
      <div className="mb-3">
        <p className="font-script text-xl leading-none text-magenta-600 md:text-2xl">Encuentra tu sitio</p>
        <h1 className="mt-1 font-display text-2xl font-black leading-tight md:text-3xl">
          {f.zona ? `Tardeos en ${f.zona}` : "Conecta con tu tardeo"}
        </h1>
      </div>

      {/* Buscador */}
      <div className="relative mb-3">
        <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta/40" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Busca por nombre, DJ, local o zona…"
          className="w-full rounded-2xl border-2 border-magenta-100 bg-white py-3.5 pl-12 pr-4 text-base font-semibold outline-none transition focus:border-magenta"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Borrar" className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-tinta/40 hover:bg-black/5">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Filtros principales: cuándo + dónde + qué música, y el resto detrás. */}
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        <Principal
          icono={CalendarDays}
          texto="Cuándo"
          valor={etiquetaCuando}
          activo={panel === "cuando"}
          onClick={() => abrir("cuando")}
        />
        <Principal
          icono={estadoUbi === "pidiendo" ? Loader2 : Navigation}
          texto="Cerca de mí"
          activo={Boolean(porCercania)}
          desplegable={false}
          onClick={alternarCerca}
        />
        {/* Solo si hay gustos que aplicar: un botón que no hace nada es peor
            que no tenerlo. Quien no los tenga no lo ve. */}
        {hayGustos && (
          <Principal
            icono={Wand2}
            texto="Para ti"
            activo={porEncaje}
            desplegable={false}
            onClick={() => setPorEncaje((v) => !v)}
          />
        )}
        <Principal
          icono={Music}
          texto="Música"
          valor={etiquetaMusica}
          activo={panel === "musica"}
          onClick={() => abrir("musica")}
        />
        <Principal
          icono={Sparkles}
          texto="Ambiente"
          valor={f.ambiente}
          activo={panel === "ambiente"}
          onClick={() => abrir("ambiente")}
        />
        <Principal
          icono={SlidersHorizontal}
          texto={nMas > 0 ? `Más filtros (${nMas})` : "Más filtros"}
          activo={panel === "mas"}
          onClick={() => abrir("mas")}
        />
      </div>

      {/* Lo que hay puesto, siempre a la vista aunque los paneles estén cerrados. */}
      {nTotal > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {activas.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-magenta-50 px-3 py-1.5 text-sm font-extrabold text-magenta-700">
              {v}
            </span>
          ))}
          <button onClick={limpiar} className="inline-flex items-center gap-1 text-sm font-bold text-magenta">
            <X size={14} /> Quitar filtros
          </button>
        </div>
      )}

      {panel === "cuando" && (
        <div className="mb-4 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-magenta-100">
          <div className="flex flex-wrap gap-2">
            {CUANDOS.map((c) => (
              <Chip
                key={c.k}
                activo={cuando === c.k}
                onClick={() => { setFechaExacta(""); setCuando((p) => (p === c.k ? null : c.k)); }}
              >
                {c.label}
              </Chip>
            ))}

            {/* En el móvil esto abre el calendario del sistema, que es lo que la
                gente ya sabe usar. `min` en hoy porque los tardeos pasados no
                se enseñan: dejar elegir ayer solo lleva a una lista vacía. */}
            <label className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-extrabold text-tinta/80 ring-1 ring-magenta-100 transition focus-within:ring-magenta hover:ring-magenta">
              <CalendarDays size={16} className="text-magenta" />
              <span className={fechaExacta ? "sr-only" : ""}>Otra fecha</span>
              <input
                type="date"
                value={fechaExacta}
                min={hoyEnEspana()}
                onChange={(e) => { setCuando(null); setFechaExacta(e.target.value); }}
                className={`bg-transparent font-extrabold outline-none ${fechaExacta ? "" : "w-0 opacity-0"}`}
              />
              {fechaExacta && (
                <button
                  type="button"
                  onClick={() => setFechaExacta("")}
                  aria-label="Quitar la fecha"
                  className="grid h-6 w-6 place-items-center rounded-full text-tinta/40 hover:bg-black/5"
                >
                  <X size={14} />
                </button>
              )}
            </label>
          </div>
        </div>
      )}

      {panel === "musica" && (
        <div className="mb-4 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-magenta-100">
          {/* Música en dos pasos. Las 86 etiquetas de golpe convierten esto en un
              muro: primero la familia y, dentro, sus estilos. */}
          <div className="flex flex-wrap gap-2">
            {FAMILIAS.map((fam) => (
              <Chip key={fam.id} activo={f.familia === fam.id} onClick={() => elegirFamilia(fam.id)}>
                {fam.nombre}
              </Chip>
            ))}
          </div>

          {f.familia && (
            <div className="mt-2 rounded-2xl bg-magenta-50/60 p-3">
              {FAMILIAS.find((x) => x.id === f.familia)!.grupos.map((g, i) => (
                <div key={g.nombre ?? i} className={i ? "mt-3" : ""}>
                  {/* El nombre del subgrupo solo lo tiene Electrónica. */}
                  {g.nombre && (
                    <p className="mb-1.5 text-xs font-black uppercase tracking-wide text-tinta/45">{g.nombre}</p>
                  )}
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
        </div>
      )}

      {panel === "ambiente" && (
        <div className="mb-4 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-magenta-100">
          <div className="flex flex-wrap gap-2">
            {AMBIENTES.map((v) => (
              <Chip key={v} activo={f.ambiente === v} onClick={() => set("ambiente", v)}>{v}</Chip>
            ))}
          </div>
        </div>
      )}

      {panel === "mas" && (
        <div className="mb-4 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-magenta-100">
          <p className="mb-1.5 text-sm font-black text-tinta/60">Tipo de evento</p>
          <div className="flex flex-wrap gap-2">
            {TIPOS_EVENTO.map((v) => (
              <Chip key={v} activo={f.tipoEvento === v} onClick={() => set("tipoEvento", v)}>{v}</Chip>
            ))}
          </div>

          <p className="mb-1.5 mt-3 text-sm font-black text-tinta/60">Zona</p>
          <div className="flex flex-wrap gap-2">
            {zonasDisponibles.length === 0 ? (
              <p className="text-sm font-bold text-tinta/40">No hay zonas que enseñar todavía.</p>
            ) : (
              zonasDisponibles.map((z) => (
                <Chip key={z} activo={f.zona === z} onClick={() => set("zona", z)}>{z}</Chip>
              ))
            )}
          </div>

          <p className="mb-1.5 mt-3 text-sm font-black text-tinta/60">Precio</p>
          <div className="flex flex-wrap gap-2">
            {PRECIOS.map((p) => (
              <Chip key={p.k} activo={f.precio === p.k} onClick={() => set("precio", p.k)}>
                {p.label}
                {p.pie && <span className={f.precio === p.k ? "text-white/70" : "text-tinta/40"}> {p.pie}</span>}
              </Chip>
            ))}
          </div>


          <p className="mb-1.5 mt-3 text-sm font-black text-tinta/60">Público</p>
          <div className="flex flex-wrap gap-2">
            {PUBLICOS.map((v) => (
              <Chip key={v} activo={f.publico === v} onClick={() => set("publico", v)}>{v}</Chip>
            ))}
          </div>

          <p className="mb-1.5 mt-3 text-sm font-black text-tinta/60">Outfit / Dress code</p>
          <div className="flex flex-wrap gap-2">
            {DRESS_CODES.map((v) => (
              <Chip key={v} activo={f.dressCode === v} onClick={() => set("dressCode", v)}>{v}</Chip>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-tinta/60">
          {lista.length} {lista.length === 1 ? "tardeo" : "tardeos"}
          {porCercania
            ? " · los más cercanos primero"
            : porEncaje && hayGustos
              ? " · los que más encajan primero"
              : ""}
        </p>
        {estadoUbi === "denegada" && cerca && (
          <p className="text-sm font-bold text-tinta/50">Sin permiso de ubicación no podemos ordenar por cercanía.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {lista.map((t) => (
          <TardeoCard key={t.id} tardeo={t} distanciaKm={distanciaDe(t)} />
        ))}
      </div>

      {lista.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/60 ring-1 ring-magenta-100">
          {todos.length === 0 ? "Aún no hay tardeos publicados. ¡Vuelve pronto! 🎉" : "No hay tardeos con esos filtros 😅"}
        </p>
      )}
    </main>
  );
}
