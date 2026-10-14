"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { getAdn, type AdnTardicola } from "@/lib/tardicola";
import { getAjustes } from "@/lib/ajustes";
import { encajaSegmento, enVentana, impactosHoy, apuntarImpacto } from "@/lib/segmentacion";
import { X, ArrowRight } from "lucide-react";

export type Popup = {
  id: string;
  titulo: string;
  mensaje: string | null;
  tipo: string | null;
  activo: boolean;
  /** null = una sola vez · 0 = cada visita · N = cada N horas */
  repetir_horas: number | null;
  publico: "todos" | "anonimos" | "registrados" | "locales" | "djs";
  desde: string | null;
  hasta: string | null;
  /** Segmentación por gustos (lote 23). Vacío = sin restricción. */
  seg_musica: string[] | null;
  seg_tipos_evento: string[] | null;
  seg_edades: string[] | null;
  seg_zonas: string[] | null;
  /** Lote 49. Si la columna no existe llegan undefined. */
  cta_texto?: string | null;
  cta_url?: string | null;
  imagen_url?: string | null;
  created_at?: string;
};

/** Tope de impactos al día si la tabla de ajustes no responde. */
const TOPE_POR_DEFECTO = 3;

/** El botón de siempre: es lo que llevaban todos los pop-ups antes del lote 49. */
export const CTA_POR_DEFECTO = { texto: "Ver tardeos", url: "/tardeos" };

/**
 * ¿Es un destino válido para el botón?
 *
 * Rutas internas ("/algo", nunca "//host", que el navegador lee como otra web)
 * o enlaces https. Un pop-up nuestro jamás debe mandar a http ni a javascript:.
 */
export function urlCtaValida(url: string): boolean {
  const u = url.trim();
  if (!u) return true; // vacío = el botón de siempre
  if (u.startsWith("/")) return u[1] !== "/" && u[1] !== "\\" && !/[\s\u0000-\u001f]/.test(u);
  try {
    const p = new URL(u);
    return p.protocol === "https:" && Boolean(p.hostname);
  } catch {
    return false;
  }
}

const CLAVE = (id: string) => `popup-visto-${id}`;

/**
 * ¿Toca enseñar este popup a este visitante?
 *
 * Guardamos la fecha del último visto, no un simple "ya lo vio": con un
 * booleano no había forma de repetirlo cada día o cada semana.
 * (Las marcas antiguas eran un "1", que se trata como "visto hace mucho".)
 */
function tocaEnsenar(p: Popup): boolean {
  // `?? null` y no `=== null` a secas: si el lote 17 todavía no está aplicado la
  // columna llega como undefined, y sin esto el popup saldría en CADA visita en
  // vez de una sola vez.
  const horas = p.repetir_horas ?? null;
  if (horas === null) return !localStorage.getItem(CLAVE(p.id));
  if (horas === 0) return true;

  const marca = localStorage.getItem(CLAVE(p.id));
  if (!marca) return true;
  const visto = Number(marca);
  if (!Number.isFinite(visto) || visto <= 1) return true; // marca vieja o corrupta
  return Date.now() - visto >= horas * 3600_000;
}

const segmentado = (p: Popup) =>
  Boolean(p.seg_musica?.length || p.seg_tipos_evento?.length || p.seg_edades?.length || p.seg_zonas?.length);

/**
 * La tarjeta del pop-up, sin lógica. La usa también la vista previa del admin
 * para que lo que se ve al montarlo sea exactamente lo que verá el cliente.
 */
export function TarjetaPopup({
  popup, onCerrar, onCta, idTitulo, refCerrar, previa = false,
}: {
  popup: Pick<Popup, "titulo" | "mensaje" | "tipo" | "cta_texto" | "cta_url" | "imagen_url">;
  onCerrar?: () => void;
  onCta?: () => void;
  idTitulo?: string;
  refCerrar?: React.Ref<HTMLButtonElement>;
  /** En la vista previa los botones no navegan. */
  previa?: boolean;
}) {
  const texto = popup.cta_texto?.trim() || CTA_POR_DEFECTO.texto;
  const url = popup.cta_url?.trim() || CTA_POR_DEFECTO.url;
  const externo = url.startsWith("https://");
  const claseCta =
    "flex min-h-tacto w-full items-center justify-center gap-2 rounded-xl bg-magenta px-5 py-3 text-[17px] font-bold text-white transition-colors hover:bg-magenta-600";

  return (
    <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-linea bg-white text-tinta shadow-elevada">
      {popup.imagen_url && (
        // eslint-disable-next-line @next/next/no-img-element -- la imagen puede venir de cualquier host https
        <img src={popup.imagen_url} alt="" className="aspect-[16/9] w-full bg-marfil-100 object-cover" />
      )}
      <button
        ref={refCerrar}
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        className={`absolute right-2 top-2 grid min-h-tacto min-w-tacto place-items-center rounded-full ${
          popup.imagen_url ? "bg-white/90 text-tinta shadow-tarjeta" : "text-tinta hover:bg-marfil-100"}`}
      >
        <X size={24} aria-hidden />
      </button>
      <div className="p-5 pt-4">
        {popup.tipo && (
          <span className="inline-flex rounded-full bg-magenta-50 px-2.5 py-0.5 text-[13px] font-semibold text-magenta-700">{popup.tipo}</span>
        )}
        <h2 id={idTitulo} className="mt-2 pr-10 text-2xl font-bold leading-tight">{popup.titulo || "Título del pop-up"}</h2>
        {popup.mensaje && <p className="mt-2 whitespace-pre-line text-base text-tinta-suave">{popup.mensaje}</p>}
        <div className="mt-5 flex flex-col gap-2">
          {previa ? (
            <span className={claseCta}>{texto} <ArrowRight size={18} aria-hidden /></span>
          ) : externo ? (
            <a href={url} target="_blank" rel="noopener noreferrer" onClick={onCta} className={claseCta}>
              {texto} <ArrowRight size={18} aria-hidden />
            </a>
          ) : (
            <Link href={url} onClick={onCta} className={claseCta}>
              {texto} <ArrowRight size={18} aria-hidden />
            </Link>
          )}
          <button type="button" onClick={onCerrar}
            className="min-h-tacto rounded-xl px-5 text-base font-semibold text-tinta-suave hover:bg-marfil-100">
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PopupCliente() {
  const { user, loading } = useAuth();
  const [popup, setPopup] = useState<Popup | null>(null);
  const idTitulo = useId();
  const refCaja = useRef<HTMLDivElement>(null);
  const refCerrar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (loading) return;
    let cancel = false;

    (async () => {
      try {
        // El tope del día va primero: si ya se le han enseñado bastantes, no
        // hace falta ni consultar.
        const ajustes = await getAjustes();
        const tope = Number(ajustes.popups_max_dia);
        const maximo = Number.isFinite(tope) && tope >= 0 ? tope : TOPE_POR_DEFECTO;
        if (impactosHoy() >= maximo) return;

        const { data, error } = await supabase
          .from("popups").select("*").eq("activo", true)
          .order("created_at", { ascending: false });
        if (cancel || error || !data?.length) return;

        // Primero lo barato: fechas y frecuencia se resuelven sin consultar nada.
        const candidatos = (data as Popup[]).filter((p) => enVentana(p) && tocaEnsenar(p));
        if (!candidatos.length) return;

        // Saber si es local o DJ cuesta dos consultas, así que solo se
        // averigua cuando algún candidato lo necesita de verdad.
        const necesitaRol = candidatos.some((p) => p.publico === "locales" || p.publico === "djs");
        let esLocal = false, esDj = false;
        if (necesitaRol && user) {
          const [l, d] = await Promise.all([
            supabase.from("locales").select("id").eq("owner_id", user.id).limit(1).maybeSingle(),
            supabase.from("djs").select("id").eq("profile_id", user.id).limit(1).maybeSingle(),
          ]);
          esLocal = !!l.data; esDj = !!d.data;
        }

        // Los gustos solo se leen si hay algún pop-up segmentado, y se leen de
        // su propia fila: la decisión se toma aquí y no sale del navegador.
        let adn: AdnTardicola | null = null;
        if (user && candidatos.some(segmentado)) adn = await getAdn(user.id);
        if (cancel) return;

        const elegido = candidatos.find((p) => {
          const encajaPublico = (() => {
            switch (p.publico) {
              case "anonimos": return !user;
              case "registrados": return !!user;
              case "locales": return esLocal;
              case "djs": return esDj;
              default: return true;
            }
          })();
          return encajaPublico && encajaSegmento(p, adn);
        });
        if (elegido) {
          apuntarImpacto();
          setPopup(elegido);
        }
      } catch {
        /* tabla aún no creada u otro error: no mostramos nada */
      }
    })();

    return () => { cancel = true; };
  }, [user, loading]);

  const cerrar = useCallback(() => {
    if (!popup) return;
    // La hora, no un "1": es lo que permite volver a enseñarlo pasado el plazo.
    try { localStorage.setItem(CLAVE(popup.id), String(Date.now())); } catch { /* modo privado */ }
    setPopup(null);
  }, [popup]);

  // Escape cierra, el foco entra en el diálogo y no se escapa con Tab, y al
  // cerrar vuelve a donde estaba. Sin esto, con teclado o lector de pantalla
  // el pop-up es una pared.
  useEffect(() => {
    if (!popup) return;
    const previo = document.activeElement as HTMLElement | null;
    refCerrar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { cerrar(); return; }
      if (e.key !== "Tab" || !refCaja.current) return;
      const focos = refCaja.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])");
      if (!focos.length) return;
      const primero = focos[0], ultimo = focos[focos.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    };
    window.addEventListener("keydown", tecla);
    return () => { window.removeEventListener("keydown", tecla); previo?.focus?.(); };
  }, [popup, cerrar]);

  if (!popup) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-tinta/50" onClick={cerrar} aria-hidden />
      <div ref={refCaja} role="dialog" aria-modal="true" aria-labelledby={idTitulo} className="relative flex w-full justify-center">
        <TarjetaPopup popup={popup} onCerrar={cerrar} onCta={cerrar} idTitulo={idTitulo} refCerrar={refCerrar} />
      </div>
    </div>
  );
}
