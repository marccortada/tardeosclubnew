"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { enlaceInstagram, enlaceWeb, enlaceTelefono } from "@/lib/crm";
import { etiquetaPublicacion } from "@/lib/estados";
import { Check, X, Mail, Phone, Instagram, Globe, MapPin, CalendarDays, UserRound, Store, Megaphone } from "lucide-react";
import Boton from "@/components/Boton";
import Hoja from "@/components/ui/Hoja";
import Aviso from "@/components/admin/Aviso";
import { Etiqueta } from "@/components/ui/Chip";
import Paginacion, { usePaginado, useDiferido, Buscador, EstadoLista } from "@/components/panel/Paginacion";

/**
 * Locales y promotores a la espera de aprobación. Misma lógica que tenía el
 * panel (aprobar = estado activo + verificado; rechazar = BORRAR la ficha).
 *
 * Paginado en el servidor y con columnas explícitas: antes se pedía `select *`
 * de todas las fichas no activas y los emails de todos sus dueños de golpe.
 * Ahora solo la página visible, y los emails solo de esa página.
 */
type Fila = {
  id: string; nombre: string; direccion: string | null; zona: string | null; tipo: string | null;
  estado: string | null; created_at: string | null; owner_id: string | null; email: string | null;
  telefono: string | null; redes: Record<string, string> | null;
};

type Accion = { tipo: "aprobar" | "rechazar"; fila: Fila };

const limpiar = (s: string) => s.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();

export default function LocalesPorVerificar({ alCambiar }: { alCambiar?: () => void }) {
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  const [correos, setCorreos] = useState<Map<string, string>>(new Map());
  const [accion, setAccion] = useState<Accion | null>(null);
  const [obrando, setObrando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const p = usePaginado<Fila>(
    (desde, hasta) => {
      // Solo borradores: con `neq activo` entraban también los ocultos y los
      // dados de baja, que no esperan aprobación de nadie.
      let q = supabase.from("locales")
        .select("id,nombre,direccion,zona,tipo,estado,created_at,owner_id,email,telefono,redes", { count: "exact" })
        .eq("estado", "borrador");
      const l = limpiar(busca);
      if (l) q = q.or(`nombre.ilike.%${l}%,zona.ilike.%${l}%,direccion.ilike.%${l}%`);
      return q.order("created_at", { ascending: false }).order("id").range(desde, hasta) as unknown as PromiseLike<{ data: Fila[] | null; count: number | null; error: unknown }>;
    },
    [busca],
    10,
  );

  // Emails de los dueños, solo de la página visible.
  useEffect(() => {
    const ids = [...new Set(p.filas.map((f) => f.owner_id).filter(Boolean))] as string[];
    const faltan = ids.filter((i) => !correos.has(i));
    if (!faltan.length) return;
    supabase.from("profiles").select("id,email").in("id", faltan).then(({ data }) => {
      setCorreos((prev) => {
        const m = new Map(prev);
        (data ?? []).forEach((x) => m.set(x.id, x.email ?? ""));
        return m;
      });
    });
  }, [p.filas]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmar = async () => {
    if (!accion) return;
    const { tipo, fila: f } = accion;
    setObrando(true); setError(""); setOk("");
    // `.select("id")` para saber si de verdad se escribió: con seguridad de
    // fila, un update/delete que no alcanza nada responde sin error.
    const { data, error: e } = tipo === "aprobar"
      ? await supabase.from("locales").update({ estado: "activo", verificado: true }).eq("id", f.id).select("id")
      : await supabase.from("locales").delete().eq("id", f.id).select("id");
    setObrando(false);
    setAccion(null);
    if (e) { setError(`No se pudo ${tipo === "aprobar" ? "aprobar" : "borrar"}: ${e.message}`); return; }
    if (!data?.length) { setError("No se guardó nada. ¿Tu cuenta es admin?"); return; }
    p.quitar((x) => x.id === f.id);
    setOk(tipo === "aprobar" ? `«${f.nombre}» aprobado y publicado.` : `«${f.nombre}» borrado.`);
    alCambiar?.();
    // Si la página se ha quedado vacía y hay más, se pide la siguiente tanda.
    if (p.filas.length === 1 && p.total > 1) p.recargar();
  };

  return (
    <div>
      <div className="mb-3">
        <Buscador valor={texto} onCambiar={setTexto} placeholder="Buscar por nombre, zona o dirección…" />
      </div>

      {error && <Aviso>{error}</Aviso>}
      {ok && <Aviso tono="ok">{ok}</Aviso>}

      <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length}
        vacio={busca ? "Ninguna ficha pendiente con esa búsqueda." : "No hay fichas pendientes de verificar. Todo al día."} />

      <ul className={`flex flex-col gap-3 ${p.cargando ? "opacity-60" : ""}`}>
        {p.filas.map((v) => {
          const esPromotor = v.tipo === "promotor";
          const Icono = esPromotor ? Megaphone : Store;
          const dueno = v.owner_id ? correos.get(v.owner_id) : null;
          return (
            <li key={v.id} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-marfil-100 text-tinta-suave"><Icono size={20} aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[17px] font-bold leading-tight">{v.nombre}</p>
                    <Etiqueta tono="neutro">{esPromotor ? "Promotor" : "Local"}</Etiqueta>
                    <Etiqueta tono="aviso">{etiquetaPublicacion(v.estado)}</Etiqueta>
                  </div>
                  <dl className="mt-2 grid gap-1 text-[15px] text-tinta-suave">
                    <div className="flex items-start gap-2">
                      <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden />
                      <dd>{v.direccion || (esPromotor ? "Promotor: sin dirección fija" : "Sin dirección")}{v.zona ? ` · ${v.zona}` : ""}</dd>
                    </div>
                    <div className="flex items-start gap-2">
                      <UserRound size={16} className="mt-0.5 shrink-0" aria-hidden />
                      <dd>{v.owner_id ? <>Lo registró <span className="font-semibold text-tinta">{dueno ?? "…"}</span></> : "Sin cuenta asociada (alta manual)"}</dd>
                    </div>
                    {v.created_at && (
                      <div className="flex items-start gap-2">
                        <CalendarDays size={16} className="mt-0.5 shrink-0" aria-hidden />
                        <dd>Alta el {new Date(v.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</dd>
                      </div>
                    )}
                  </dl>
                  <Contacto local={v} />
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Boton tamano="pequeno" onClick={() => setAccion({ tipo: "aprobar", fila: v })}><Check size={18} aria-hidden /> Aprobar</Boton>
                <Boton tamano="pequeno" variante="contorno" onClick={() => setAccion({ tipo: "rechazar", fila: v })}><X size={18} aria-hidden /> Rechazar</Boton>
              </div>
            </li>
          );
        })}
      </ul>

      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />

      <Hoja
        abierta={!!accion}
        onCerrar={() => !obrando && setAccion(null)}
        titulo={accion?.tipo === "aprobar" ? "¿Aprobar esta ficha?" : "¿Borrar esta ficha?"}
        pie={
          <div className="grid gap-2">
            {accion?.tipo === "aprobar"
              ? <Boton ancho cargando={obrando} onClick={confirmar}>Sí, aprobar y publicar</Boton>
              : <Boton variante="peligro" ancho cargando={obrando} onClick={confirmar}>Sí, borrar la ficha</Boton>}
            <Boton variante="contorno" ancho disabled={obrando} onClick={() => setAccion(null)}>Cancelar</Boton>
          </div>
        }
      >
        {accion?.tipo === "aprobar" ? (
          <p className="text-base">
            <strong>{accion.fila.nombre}</strong> se publica en la web y recibe la insignia de verificado.
          </p>
        ) : (
          <>
            <p className="text-base">
              Se borra <strong>{accion?.fila.nombre}</strong> entera y <strong>no se puede deshacer</strong>.
            </p>
            <p className="mt-2 text-[15px] text-tinta-suave">
              Si solo quieres que no se vea, no la apruebes: así sigue guardada.
            </p>
          </>
        )}
      </Hoja>
    </div>
  );
}

function Contacto({ local }: { local: Fila }) {
  const redes = local.redes ?? {};
  const canales = [
    local.email ? { icono: Mail, url: `mailto:${local.email}`, texto: local.email } : null,
    local.telefono ? { icono: Phone, url: enlaceTelefono(local.telefono), texto: local.telefono } : null,
    redes.instagram ? { icono: Instagram, url: enlaceInstagram(redes.instagram), texto: "Instagram" } : null,
    redes.web ? { icono: Globe, url: enlaceWeb(redes.web), texto: "Web" } : null,
  ].filter((c): c is { icono: typeof Mail; url: string; texto: string } => !!c && !!c.url);

  if (canales.length === 0) return <p className="mt-2 text-[15px] text-tinta-suave">Sin forma de contacto en la ficha.</p>;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {canales.map((c) => (
        <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-linea-fuerte bg-white px-3.5 text-[15px] font-semibold text-tinta transition-colors hover:bg-marfil-100">
          <c.icono size={16} aria-hidden /> <span className="max-w-[13rem] truncate">{c.texto}</span>
        </a>
      ))}
    </div>
  );
}
