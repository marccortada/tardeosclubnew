"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, useDiferido, Buscador, Filtros, EstadoLista } from "@/components/panel/Paginacion";
import Boton from "@/components/Boton";
import Hoja from "@/components/ui/Hoja";
import Aviso from "@/components/admin/Aviso";
import Campo, { claseCampo } from "@/components/ui/Campo";
import { Etiqueta } from "@/components/ui/Chip";
import PanelFiltros, { CampoFiltro, claseFiltro, RangoFechas } from "@/components/panel/PanelFiltros";
import { rangoTimestamp } from "@/lib/filtrosLista";
import { Copy, Check, MessageCircle, Plus, Store, Megaphone, Disc3, Link2, Loader2 } from "lucide-react";
import { MARCA } from "@/lib/marca";

/**
 * Enlaces para dar de alta locales, promotores y DJs: lo que en el admin
 * antiguo eran "Onb. Locales" y "Onb. DJs".
 *
 *  1. Enlaces públicos a /unirse?rol=…: para quien todavía no tiene ficha. Se
 *     registra y la rellena él; luego sale en "Por revisar".
 *  2. Invitaciones (lote 10): para una ficha que YA existe sin dueño. El enlace
 *     /reclamar?token=… la pasa a nombre de quien lo abra con su cuenta.
 *
 * No enviamos nada nosotros (haría falta Resend): se copia o se abre WhatsApp.
 */
type Tipo = "local" | "promotor" | "dj";
type Invitacion = {
  id: string; token: string; tipo: "local" | "dj"; ficha_id: string; email: string | null;
  usada_por: string | null; usada_en: string | null; expira_en: string; created_at: string;
};
type Filtro = "pendientes" | "usadas" | "caducadas" | "todas";
type Resultado = { id: string; nombre: string; zona: string | null };

const TIPOS: { k: Tipo; label: string; icono: typeof Store; texto: string }[] = [
  { k: "local", label: "Local", icono: Store, texto: `Da de alta tu local en ${MARCA.nombre} y publica tus tardeos gratis` },
  { k: "promotor", label: "Promotor", icono: Megaphone, texto: `Da de alta tus tardeos como promotor en ${MARCA.nombre}` },
  { k: "dj", label: "DJ", icono: Disc3, texto: `Crea tu ficha de DJ en ${MARCA.nombre}` },
];

const limpiar = (s: string) => s.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();
const wa = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
const fecha = (f: string) => new Date(f).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

export default function AdminEnlacesPagina() {
  return <Suspense fallback={null}><AdminEnlaces /></Suspense>;
}

function AdminEnlaces() {
  const params = useSearchParams();
  // Dentro del Suspense de useSearchParams esto solo se pinta en el navegador,
  // así que `window` existe y no hay desajuste de hidratación.
  const [origen] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));

  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [cuentas, setCuentas] = useState<Partial<Record<Filtro, number>>>({});
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  // Se puede llegar desde /admin/crear con ?tipo=…&buscar=… para invitar a la
  // ficha recién creada sin volver a buscarla.
  const tipoParam = params.get("tipo");
  const [nueva, setNueva] = useState<boolean>(!!params.get("buscar"));

  // Un "ahora" estable para que la consulta no cambie en cada render.
  const [ahora] = useState(() => new Date().toISOString());

  // Por `usada_en`, no por `usada_por`: este se vacía si se borra la cuenta que
  // la usó (on delete set null) y la invitación volvía a salir como pendiente.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- builder de supabase con filtros encadenados
  const aplicar = (q: any, f: Filtro) => {
    if (f === "pendientes") return q.is("usada_en", null).gt("expira_en", ahora);
    if (f === "usadas") return q.not("usada_en", "is", null);
    if (f === "caducadas") return q.is("usada_en", null).lt("expira_en", ahora);
    return q;
  };

  // Búsqueda (email o nombre de la ficha) y filtros plegables, en el servidor.
  const [textoInv, setTextoInv] = useState("");
  const buscaInv = useDiferido(textoInv);
  const [tipoInv, setTipoInv] = useState<"" | "local" | "dj">("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const activos = [tipoInv, fDesde, fHasta].filter(Boolean).length;
  const limpiarFiltros = () => { setTipoInv(""); setFDesde(""); setFHasta(""); };

  const p = usePaginado<Invitacion>(
    async (desde, hasta) => {
      let q = aplicar(supabase.from("invitaciones").select("id,token,tipo,ficha_id,email,usada_por,usada_en,expira_en,created_at", { count: "exact" }), filtro);
      if (tipoInv) q = q.eq("tipo", tipoInv);
      q = rangoTimestamp(q, "created_at", fDesde, fHasta);
      const l = limpiar(buscaInv);
      if (l) {
        // La invitación solo guarda el id de la ficha: primero se buscan las
        // fichas por nombre (locales y DJs) y luego sus invitaciones. Tope de
        // 100 fichas por tipo: para buscar algo concreto sobra.
        const [loc, dj] = await Promise.all([
          tipoInv === "dj" ? Promise.resolve({ data: [] }) : supabase.from("locales").select("id").ilike("nombre", `%${l}%`).limit(100),
          tipoInv === "local" ? Promise.resolve({ data: [] }) : supabase.from("djs").select("id").ilike("nombre_artistico", `%${l}%`).limit(100),
        ]);
        const ids = [...((loc.data ?? []) as { id: string }[]), ...((dj.data ?? []) as { id: string }[])].map((x) => x.id);
        q = q.or(ids.length ? `email.ilike.%${l}%,ficha_id.in.(${ids.join(",")})` : `email.ilike.%${l}%`);
      }
      return (q.order("created_at", { ascending: false }).order("id").range(desde, hasta)) as PromiseLike<{ data: Invitacion[] | null; count: number | null; error: unknown }>;
    },
    [filtro, buscaInv, tipoInv, fDesde, fHasta],
    25,
  );

  const contar = () => {
    const fs: Filtro[] = ["pendientes", "usadas", "caducadas", "todas"];
    Promise.all(fs.map((f) =>
      (aplicar(supabase.from("invitaciones").select("id", { count: "exact", head: true }), f) as PromiseLike<{ count: number | null }>)
        .then((r) => [f, r.count ?? 0] as const),
    )).then((rs) => setCuentas(Object.fromEntries(rs)));
  };
  useEffect(contar, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Nombre de la ficha de cada invitación, solo de la página visible.
  useEffect(() => {
    const faltan = p.filas.filter((i) => !nombres.has(i.ficha_id));
    if (!faltan.length) return;
    const loc = faltan.filter((i) => i.tipo === "local").map((i) => i.ficha_id);
    const djs = faltan.filter((i) => i.tipo === "dj").map((i) => i.ficha_id);
    Promise.all([
      loc.length ? supabase.from("locales").select("id,nombre").in("id", loc) : Promise.resolve({ data: [] }),
      djs.length ? supabase.from("djs").select("id,nombre_artistico").in("id", djs) : Promise.resolve({ data: [] }),
    ]).then(([l, d]) => setNombres((prev) => {
      const m = new Map(prev);
      ((l.data ?? []) as { id: string; nombre: string }[]).forEach((x) => m.set(x.id, x.nombre));
      ((d.data ?? []) as { id: string; nombre_artistico: string }[]).forEach((x) => m.set(x.id, x.nombre_artistico));
      // Las que no han vuelto es que la ficha ya no existe.
      faltan.forEach((i) => { if (!m.has(i.ficha_id)) m.set(i.ficha_id, "(ficha borrada)"); });
      return m;
    }));
  }, [p.filas]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SeccionPanel
      titulo="Enlaces para locales"
      descripcion="Enlaces para que locales, promotores y DJs se den de alta o se queden con su ficha."
      acciones={<Boton tamano="pequeno" onClick={() => setNueva(true)}><Plus size={18} aria-hidden /> Nuevo enlace de invitación</Boton>}
      ancho="ancho"
    >
      {/* ---------- 1. Enlaces públicos de alta ---------- */}
      <section aria-labelledby="t-publicos" className="mb-10">
        <h2 id="t-publicos" className="text-xl font-bold">Enlaces de alta</h2>
        <p className="mb-4 mt-1 text-[15px] text-tinta-suave">
          Para quien aún no tiene ficha. Se registra, rellena sus datos y te aparece en «Por revisar» para aprobarla.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {TIPOS.map((t) => {
            const url = origen ? `${origen}/unirse?rol=${t.k}` : "";
            return (
              <div key={t.k} className="flex flex-col rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
                <p className="flex items-center gap-2 text-[17px] font-bold"><t.icono size={20} className="text-magenta" aria-hidden /> {t.label}</p>
                <input readOnly value={url} aria-label={`Enlace de alta para ${t.label}`} onFocus={(e) => e.currentTarget.select()}
                  className={`${claseCampo} mt-3 !min-h-[44px] !py-2 text-sm`} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <BotonCopiar texto={url} />
                  <Boton tamano="pequeno" variante="contorno" href={wa(`${t.texto}: ${url}`)} externo>
                    <MessageCircle size={18} aria-hidden /> WhatsApp
                  </Boton>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- 2. Invitaciones a fichas existentes ---------- */}
      <section aria-labelledby="t-invitaciones">
        <h2 id="t-invitaciones" className="text-xl font-bold">Invitaciones a una ficha</h2>
        <p className="mb-4 mt-1 text-[15px] text-tinta-suave">
          Para fichas que ya existen sin dueño. Quien abra el enlace con su cuenta se queda con la ficha. Caducan a los 30 días y sirven una sola vez.
        </p>

        <div className="mb-4">
          <Filtros<Filtro>
            valor={filtro}
            onCambiar={setFiltro}
            opciones={[
              { clave: "pendientes", label: "Pendientes", n: cuentas.pendientes },
              { clave: "usadas", label: "Usadas", n: cuentas.usadas },
              { clave: "caducadas", label: "Caducadas", n: cuentas.caducadas },
              { clave: "todas", label: "Todas", n: cuentas.todas },
            ]}
          />
          <div className="mt-3 flex flex-col gap-3">
            <Buscador valor={textoInv} onCambiar={setTextoInv} placeholder="Buscar por ficha o email…" />
            <PanelFiltros clave="admin-enlaces" activos={activos} onLimpiar={limpiarFiltros}>
              <CampoFiltro etiqueta="Ficha de">
                <select value={tipoInv} onChange={(e) => setTipoInv(e.target.value as typeof tipoInv)} className={claseFiltro}>
                  <option value="">Locales y DJs</option>
                  <option value="local">Locales y promotores</option>
                  <option value="dj">DJs</option>
                </select>
              </CampoFiltro>
              <RangoFechas desde={fDesde} hasta={fHasta} onDesde={setFDesde} onHasta={setFHasta} etiqueta="Creada" />
            </PanelFiltros>
          </div>
        </div>

        <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length}
          vacio={activos || buscaInv ? "Ninguna invitación con estos filtros." : filtro === "pendientes" ? "No hay invitaciones pendientes. Crea una con «Nuevo enlace de invitación»." : "No hay invitaciones en este apartado."} />

        {p.filas.length > 0 && (
          <ul className={`flex flex-col gap-3 ${p.cargando ? "opacity-60" : ""}`}>
            {p.filas.map((i) => {
              const usada = !!i.usada_en;
              const caducada = !usada && i.expira_en < ahora;
              const url = origen ? `${origen}/reclamar?token=${i.token}` : "";
              const nombre = nombres.get(i.ficha_id) ?? "…";
              return (
                <li key={i.id} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:flex md:items-center md:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {i.tipo === "dj" ? <Disc3 size={18} className="text-tinta-suave" aria-hidden /> : <Store size={18} className="text-tinta-suave" aria-hidden />}
                      <p className="text-[17px] font-bold leading-tight">{nombre}</p>
                      {usada ? <Etiqueta tono="ok">Usada</Etiqueta> : caducada ? <Etiqueta tono="error">Caducada</Etiqueta> : <Etiqueta tono="aviso">Pendiente</Etiqueta>}
                    </div>
                    <p className="mt-1 text-sm text-tinta-suave">
                      Creada el {fecha(i.created_at)}
                      {i.email ? ` · para ${i.email}` : ""}
                      {usada && i.usada_en ? ` · usada el ${fecha(i.usada_en)}` : !usada ? ` · ${caducada ? "caducó" : "caduca"} el ${fecha(i.expira_en)}` : ""}
                    </p>
                  </div>
                  {!usada && !caducada && (
                    <div className="mt-3 grid grid-cols-2 gap-2 md:mt-0 md:flex">
                      <BotonCopiar texto={url} />
                      <Boton tamano="pequeno" variante="contorno" externo
                        href={wa(`Hola. Este es tu enlace para gestionar la ficha de ${nombre} en ${MARCA.nombre} (entra con tu cuenta o créala): ${url}`)}>
                        <MessageCircle size={18} aria-hidden /> WhatsApp
                      </Boton>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />
      </section>

      <NuevaInvitacion
        abierta={nueva}
        origen={origen}
        tipoInicial={tipoParam === "dj" || tipoParam === "promotor" ? tipoParam : "local"}
        buscarInicial={params.get("buscar") ?? ""}
        onCerrar={() => setNueva(false)}
        onCreada={() => { setFiltro("pendientes"); p.recargar(); contar(); }}
      />
    </SeccionPanel>
  );
}

/** Copiar al portapapeles con confirmación visible (y error si no deja). */
function BotonCopiar({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<"" | "ok" | "error">("");
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("ok");
    } catch {
      setEstado("error");
    }
    setTimeout(() => setEstado(""), 2500);
  };
  return (
    <Boton tamano="pequeno" variante={estado === "ok" ? "suave" : "contorno"} onClick={copiar} disabled={!texto}>
      {estado === "ok" ? <><Check size={18} aria-hidden /> Copiado</> : estado === "error" ? "Cópialo a mano" : <><Copy size={18} aria-hidden /> Copiar</>}
    </Boton>
  );
}

/**
 * Crear una invitación: elegir ficha SIN dueño, email opcional y generar el
 * enlace. Mismo insert que AsignarDueno. Solo se ofrecen fichas sin dueño
 * porque `reclamar_invitacion` rechaza las que ya lo tienen: un enlace a una
 * de esas sería un enlace que no funciona.
 */
function NuevaInvitacion({
  abierta, origen, tipoInicial, buscarInicial, onCerrar, onCreada,
}: {
  abierta: boolean; origen: string; tipoInicial: Tipo; buscarInicial: string;
  onCerrar: () => void; onCreada: () => void;
}) {
  const [tipo, setTipo] = useState<Tipo>(tipoInicial);
  const [texto, setTexto] = useState(buscarInicial);
  const busca = useDiferido(texto);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [elegida, setElegida] = useState<Resultado | null>(null);
  const [email, setEmail] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const [enlace, setEnlace] = useState("");

  useEffect(() => {
    if (!abierta || elegida) return;
    let vivo = true;
    setBuscando(true);
    const l = limpiar(busca);
    const q = tipo === "dj"
      ? (() => {
          let x = supabase.from("djs").select("id,nombre:nombre_artistico").is("profile_id", null);
          if (l) x = x.ilike("nombre_artistico", `%${l}%`);
          return x.order("nombre_artistico").limit(8);
        })()
      : (() => {
          let x = supabase.from("locales").select("id,nombre,zona").eq("tipo", tipo).is("owner_id", null);
          if (l) x = x.ilike("nombre", `%${l}%`);
          return x.order("nombre").limit(8);
        })();
    q.then(({ data, error: e }) => {
      if (!vivo) return;
      setBuscando(false);
      if (e) { setError("No se pudo buscar: " + e.message); setResultados([]); return; }
      setError("");
      setResultados(((data ?? []) as Partial<Resultado>[]).map((r) => ({ id: r.id!, nombre: r.nombre ?? "", zona: r.zona ?? null })));
    });
    return () => { vivo = false; };
  }, [abierta, tipo, busca, elegida]);

  const reiniciar = () => { setElegida(null); setEmail(""); setEnlace(""); setError(""); setTexto(""); };
  const cerrar = () => { if (creando) return; reiniciar(); onCerrar(); };

  const crear = async () => {
    if (!elegida) return;
    setCreando(true); setError("");
    const { data: sesion } = await supabase.auth.getUser();
    const { data, error: e } = await supabase
      .from("invitaciones")
      .insert({
        // Un promotor es una fila de `locales`: la invitación es de tipo local.
        tipo: tipo === "dj" ? "dj" : "local",
        ficha_id: elegida.id,
        email: email.trim() || null,
        creada_por: sesion.user?.id ?? null,
      })
      .select("token")
      .single();
    setCreando(false);
    if (e) { setError("No se pudo crear el enlace: " + e.message); return; }
    setEnlace(`${origen}/reclamar?token=${data.token}`);
    onCreada();
  };

  return (
    <Hoja
      abierta={abierta}
      onCerrar={cerrar}
      titulo={enlace ? "Enlace creado" : "Nuevo enlace de invitación"}
      pie={
        enlace ? (
          <div className="grid gap-2">
            <Boton variante="contorno" ancho onClick={reiniciar}>Crear otro</Boton>
            <Boton variante="contorno" ancho onClick={cerrar}>Cerrar</Boton>
          </div>
        ) : (
          <div className="grid gap-2">
            <Boton ancho cargando={creando} disabled={!elegida} onClick={crear}><Link2 size={18} aria-hidden /> Crear enlace</Boton>
            <Boton variante="contorno" ancho disabled={creando} onClick={cerrar}>Cancelar</Boton>
          </div>
        )
      }
    >
      {error && <Aviso>{error}</Aviso>}

      {enlace ? (
        <div>
          <Aviso tono="ok">Enlace para <strong>{elegida?.nombre}</strong>. Caduca en 30 días y sirve una vez.</Aviso>
          <input readOnly value={enlace} aria-label="Enlace de invitación" onFocus={(e) => e.currentTarget.select()} className={`${claseCampo} text-sm`} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <BotonCopiar texto={enlace} />
            <Boton tamano="pequeno" variante="contorno" externo
              href={wa(`Hola. Este es tu enlace para gestionar la ficha de ${elegida?.nombre ?? ""} en ${MARCA.nombre} (entra con tu cuenta o créala): ${enlace}`)}>
              <MessageCircle size={18} aria-hidden /> WhatsApp
            </Boton>
          </div>
        </div>
      ) : elegida ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-magenta/30 bg-magenta-50 p-3">
            <div className="min-w-0">
              <p className="text-sm text-magenta-700">Ficha elegida</p>
              <p className="truncate font-bold">{elegida.nombre}</p>
            </div>
            <button type="button" onClick={() => setElegida(null)}
              className="min-h-[44px] shrink-0 rounded-lg px-3 text-[15px] font-semibold text-magenta-700 hover:bg-superficie">Cambiar</button>
          </div>
          <Campo etiqueta="Email de la persona (opcional)" htmlFor="inv-email" ayuda="Solo para que recuerdes a quién se lo mandaste. No le enviamos nada.">
            <input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@ejemplo.com" className={claseCampo} />
          </Campo>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div role="group" aria-label="Tipo de ficha" className="grid grid-cols-3 gap-2">
            {TIPOS.map((t) => (
              <button key={t.k} type="button" onClick={() => setTipo(t.k)} aria-pressed={tipo === t.k}
                className={`flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border text-[15px] font-semibold transition-colors ${
                  tipo === t.k ? "border-tinta bg-tinta text-white" : "border-linea-fuerte bg-white hover:bg-marfil-100"}`}>
                <t.icono size={16} aria-hidden /> {t.label}
              </button>
            ))}
          </div>
          <Buscador valor={texto} onCambiar={setTexto} placeholder={`Buscar ${tipo === "dj" ? "DJ" : tipo} sin dueño…`} />
          <p className="text-sm text-tinta-suave">Solo salen fichas sin dueño: las que ya lo tienen no se pueden reclamar.</p>
          {buscando ? (
            <p className="flex items-center gap-2 py-3 text-[15px] text-tinta-suave"><Loader2 size={18} className="animate-spin" aria-hidden /> Buscando…</p>
          ) : resultados.length === 0 ? (
            <p className="rounded-xl border border-dashed border-linea-fuerte p-4 text-center text-[15px] text-tinta-suave">
              {busca ? "Ninguna ficha sin dueño con ese nombre." : "No hay fichas sin dueño de este tipo."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {resultados.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setElegida(r)}
                    className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border border-linea bg-white px-4 text-left hover:border-linea-fuerte hover:bg-marfil">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{r.nombre}</span>
                      {r.zona && <span className="block text-sm text-tinta-suave">{r.zona}</span>}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-magenta-700">Elegir</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Hoja>
  );
}
