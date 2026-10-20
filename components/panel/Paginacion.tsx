"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

/**
 * Paginación en el SERVIDOR para listas del panel.
 *
 * Antes el admin pedía las 1.600 filas de golpe y las pintaba todas: lento en
 * móvil y imposible de recorrer. Ahora se piden `porPagina` con `.range()` y
 * el total con `count: "exact"`.
 *
 * `consulta(desde, hasta)` debe devolver la consulta de Supabase YA filtrada y
 * con `.range(desde, hasta)` aplicado y `{ count: "exact" }` en el select.
 */
export function usePaginado<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; count: number | null; error: unknown }>,
  deps: unknown[],
  porPagina = 25,
) {
  const [pagina, setPagina] = useState(1);
  const [filas, setFilas] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const turno = useRef(0);

  // Al cambiar los filtros se vuelve a la primera página.
  const clave = JSON.stringify(deps);
  const claveAnterior = useRef(clave);
  useEffect(() => {
    if (claveAnterior.current !== clave) { claveAnterior.current = clave; setPagina(1); }
  }, [clave]);

  useEffect(() => {
    const yo = ++turno.current;
    setCargando(true);
    const desde = (pagina - 1) * porPagina;
    Promise.resolve(consulta(desde, desde + porPagina - 1)).then(({ data, count, error }) => {
      if (yo !== turno.current) return; // llegó tarde: hay otra más nueva
      if (error) {
        setError(typeof error === "object" && error && "message" in error ? String((error as { message: string }).message) : "No se pudo cargar");
        setFilas([]); setTotal(0);
      } else {
        const total = count ?? 0;
        // Página vacía pero quedan filas (p. ej. se aprobó el último de la
        // página): se va a la última página con contenido en vez de decir
        // "todo al día" con pendientes detrás.
        if ((data ?? []).length === 0 && total > 0 && pagina > 1) {
          setPagina(Math.max(1, Math.ceil(total / porPagina)));
          return;
        }
        setError(null);
        setFilas(data ?? []);
        setTotal(total);
      }
      setCargando(false);
    }).catch((e: unknown) => {
      // Si la consulta LANZA (red caída, fallo inesperado), que no se quede
      // "Cargando…" para siempre.
      if (yo !== turno.current) return;
      setError(e instanceof Error ? e.message : "No se pudo cargar");
      setFilas([]); setTotal(0); setCargando(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, clave, version, porPagina]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  /** Quita una fila sin volver a pedir la página (tras borrar/aprobar). */
  const quitar = useCallback((pred: (f: T) => boolean) => {
    setFilas((p) => {
      const quedan = p.filter((f) => !pred(f));
      // Se ha quitado la última de la página: se pide otra vez para traer las
      // siguientes (y, si ya no hay, saltar a la página anterior).
      if (quedan.length === 0 && p.length > 0) setTimeout(() => setVersion((v) => v + 1), 0);
      return quedan;
    });
    setTotal((t) => Math.max(0, t - 1));
  }, []);
  const cambiar = useCallback((pred: (f: T) => boolean, cambio: Partial<T>) => {
    setFilas((p) => p.map((f) => (pred(f) ? { ...f, ...cambio } : f)));
  }, []);

  return { filas, total, pagina, setPagina, porPagina, cargando, error, recargar, quitar, cambiar };
}

/** Texto con retardo para el buscador: no se consulta en cada tecla. */
export function useDiferido<T>(valor: T, ms = 300) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

export default function Paginacion({
  pagina, total, porPagina, onCambiar, cargando,
}: { pagina: number; total: number; porPagina: number; onCambiar: (p: number) => void; cargando?: boolean }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total === 0) return null;
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(total, pagina * porPagina);

  // 1 … 4 5 [6] 7 8 … 20
  const nums: (number | "…")[] = [];
  const add = (n: number | "…") => nums.push(n);
  const ventana = 1;
  for (let i = 1; i <= paginas; i++) {
    if (i === 1 || i === paginas || Math.abs(i - pagina) <= ventana) add(i);
    else if (nums[nums.length - 1] !== "…") add("…");
  }

  const ir = (p: number) => {
    onCambiar(Math.min(paginas, Math.max(1, p)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 44 px: mínimo de toque (WCAG 2.2 y público 30+).
  const btn = "grid min-h-[44px] min-w-[44px] place-items-center rounded-lg text-[15px] font-semibold transition-colors disabled:opacity-40";

  return (
    <nav aria-label="Paginación" className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-tinta-suave" aria-live="polite">
        {cargando ? "Cargando…" : <>Mostrando <b className="text-tinta">{desde}–{hasta}</b> de <b className="text-tinta">{total.toLocaleString("es-ES")}</b></>}
      </p>
      {paginas > 1 && (
        <div className="flex items-center gap-1">
          <button onClick={() => ir(pagina - 1)} disabled={pagina === 1} aria-label="Página anterior" className={`${btn} border border-linea bg-white hover:bg-marfil-100`}>
            <ChevronLeft size={18} />
          </button>
          {nums.map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className="px-1 text-tinta-suave">…</span>
            ) : (
              <button key={n} onClick={() => ir(n)} aria-current={n === pagina ? "page" : undefined}
                className={`${btn} ${n === pagina ? "bg-tinta text-white" : "hover:bg-marfil-100"} hidden sm:grid`}>
                {n}
              </button>
            ),
          )}
          <span className="px-2 text-sm font-semibold sm:hidden">{pagina} / {paginas}</span>
          <button onClick={() => ir(pagina + 1)} disabled={pagina === paginas} aria-label="Página siguiente" className={`${btn} border border-linea bg-white hover:bg-marfil-100`}>
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </nav>
  );
}

/** Buscador estándar de las listas del panel. */
export function Buscador({
  valor, onCambiar, placeholder = "Buscar…",
}: { valor: string; onCambiar: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full md:max-w-sm">
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden />
      <input
        type="search"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-[44px] w-full rounded-xl border border-linea-fuerte bg-white pl-10 pr-12 text-base outline-none transition focus:border-magenta focus:ring-4 focus:ring-magenta/15"
      />
      {valor && (
        <button onClick={() => onCambiar("")} aria-label="Borrar búsqueda"
          className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-tinta-suave hover:bg-marfil-100">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/** Pestañas de filtro con contador (Todos 812 · Pendientes 3 · …). */
export function Filtros<K extends string>({
  opciones, valor, onCambiar,
}: { opciones: { clave: K; label: string; n?: number | null }[]; valor: K; onCambiar: (k: K) => void }) {
  return (
    <div role="tablist" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
      {opciones.map((o) => {
        const on = o.clave === valor;
        return (
          <button key={o.clave} role="tab" aria-selected={on} onClick={() => onCambiar(o.clave)}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-3.5 text-[14px] font-semibold transition-colors ${
              on ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-white text-tinta hover:border-tinta/50"
            }`}>
            {o.label}
            {o.n != null && (
              <span className={`rounded-full px-1.5 text-xs font-bold ${on ? "bg-white/20" : "bg-marfil-100 text-tinta-suave"}`}>{o.n}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Estado vacío / error / cargando uniforme para listas. */
export function EstadoLista({ cargando, error, vacio, filas }: { cargando: boolean; error: string | null; vacio: string; filas: number }) {
  if (error) return <p className="rounded-xl border border-error/20 bg-error-fondo p-4 text-[15px] font-semibold text-error">No se pudo cargar: {error}</p>;
  if (cargando && filas === 0)
    return (
      <div className="flex flex-col gap-2" aria-busy>
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[68px] animate-pulse rounded-xl bg-white ring-1 ring-linea" />)}
      </div>
    );
  if (!cargando && filas === 0) return <p className="rounded-xl border border-dashed border-linea-fuerte bg-white p-8 text-center text-[15px] text-tinta-suave">{vacio}</p>;
  return null;
}
