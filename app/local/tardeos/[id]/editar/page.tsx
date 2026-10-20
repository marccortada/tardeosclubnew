"use client";
import Image from "next/image";

import { use, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { usePanelLocal } from "../../../_panel/PanelLocal";
import {
  getTardeoById, getTardeoRow, updateTardeo, setDjsDeTardeo, borrarTardeo, setEstadoTardeo,
  getInscritosTardeo, getInscritosLocal, type Inscrito,
  falloPorColumna, aplicarASerie, contarSiguientesDeSerie,
} from "@/lib/tardeos";
import { supabase } from "@/lib/supabase";
import SubirFlyer from "@/components/SubirFlyer";
import DjsCartel from "../../../_panel/DjsCartel";
import { leerFlyerConIA, subirFlyer } from "../../../_panel/leerFlyer";
import PasarLista from "../../../_panel/PasarLista";
import InvitarDj from "../../../_panel/InvitarDj";
import SelectorAdn from "@/components/SelectorAdn";
import AddressSearch, { type Direccion } from "@/components/AddressSearch";
import ProgramarPublicacion, { errorProgramacion, paraInput, type Cuando } from "@/components/ProgramarPublicacion";
import PromoTardeo, { PROMO_VACIA, type Promo } from "@/components/PromoTardeo";
import PrecioTardeo, { aColumnas, desdeColumnas, errorPrecio, type Precio } from "@/components/PrecioTardeo";
import CampoAforo from "@/components/CampoAforo";
import Boton from "@/components/Boton";
import Campo, { claseCampo } from "@/components/ui/Campo";
import Hoja from "@/components/ui/Hoja";
import { Etiqueta } from "@/components/ui/Chip";
import { NOMBRE_ESTADO } from "@/components/CalendarioLocal";
import { flyerSrc, formatFecha } from "@/lib/formato";
import { Tardeo } from "@/lib/types";
import { Check, Loader2, Trash2, EyeOff, Eye, ExternalLink, Users, Ban, Copy, Repeat, Sparkles, BellRing, AlertTriangle } from "lucide-react";
import PromocionesDeTardeo from "@/components/PromocionesDeTardeo";

/** Una tarjeta con título para cada bloque del formulario. */
function Bloque({ titulo, ayuda, children, id, plegable }: { titulo: string; ayuda?: string; children: ReactNode; id?: string; plegable?: boolean }) {
  // Plegable: los bloques largos (asistentes, invitar DJs) se pueden esconder
  // para llegar antes a lo de abajo; empiezan abiertos para no esconder nada.
  if (plegable) return (
    <details id={id} open className="group scroll-mt-20 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-6">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <span className="flex-1">
          <span className="block text-lg font-bold">{titulo}</span>
          {ayuda && <span className="mt-0.5 block text-sm text-tinta-suave">{ayuda}</span>}
        </span>
        <span className="text-[14px] font-semibold text-magenta-700 group-open:hidden">Mostrar</span>
        <span className="hidden text-[14px] font-semibold text-magenta-700 group-open:inline">Ocultar</span>
      </summary>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </details>
  );
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-6">
      <h2 className="text-lg font-bold">{titulo}</h2>
      {ayuda && <p className="mt-0.5 text-sm text-tinta-suave">{ayuda}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

export default function EditarTardeo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, esAdmin, ficha, ajena, enlace } = usePanelLocal();

  const [tardeo, setTardeo] = useState<Tardeo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);
  // Nombres escritos en el campo DJ que no tienen ficha. Se avisa junto al
  // "guardado": si no, el tardeo se quedaría sin salir en el perfil de ese DJ
  // sin que nadie lo supiera.
  const [djsSinFicha, setDjsSinFicha] = useState<string[]>([]);

  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [estilo, setEstilo] = useState("");
  const [cuando, setCuando] = useState<Cuando>({ estado: "publicado", publicarEn: "" });
  const [errorCuando, setErrorCuando] = useState("");
  const [promo, setPromo] = useState<Promo>(PROMO_VACIA);
  const [tipoEvento, setTipoEvento] = useState("");
  const [ambiente, setAmbiente] = useState<string[]>([]);
  const [publico, setPublico] = useState<string[]>([]);
  const [dressCode, setDressCode] = useState("");
  const [dj, setDj] = useState("");
  // Dirección tal como está guardada en el tardeo, y el sitio nuevo si se
  // busca otro. Escribir a mano no basta: sin coordenadas nuevas el tardeo
  // seguiría en el mapa en el sitio de antes.
  const [direccion, setDireccion] = useState("");
  const [dirNueva, setDirNueva] = useState<Direccion | null>(null);
  const [descripcion, setDescripcion] = useState("");
  /**
   * La entrada entera, con el mismo componente que al crear.
   *
   * Antes aquí había un `tipo` y un `precio` sueltos, y el guardado escribía
   * solo esas dos columnas. Consecuencia: **el enlace de entradas no se podía
   * editar ni añadir después de crear el tardeo.** Un local que publica el
   * cartel el lunes y recibe el enlace de la ticketera el miércoles no tenía
   * ninguna forma de meterlo, y ése es justo el enlace que da dinero.
   *
   * `desdeColumnas` y `aColumnas` ya existían —la segunda con el comentario
   * «y de vuelta, para el formulario de editar»— y nadie las había conectado.
   */
  const [precio, setPrecio] = useState<Precio>({ modo: "gratis", importe: "", urlEntradas: "", urlPromos: "" });
  // Los enlaces tal como venían: los migrados traen alguno en http://, y no se
  // bloquea guardar por un enlace que la persona ni ha tocado.
  const [precioInicial, setPrecioInicial] = useState<Precio | null>(null);
  const [aforo, setAforo] = useState("");
  // Si la columna aún no existe en la base (lote 48 sin pegar), no se intenta escribir.
  const [hayColumnaAforo, setHayColumnaAforo] = useState(false);
  const [inscritos, setInscritos] = useState<{ filas: Inscrito[]; error: string | null } | null>(null);
  // Confirmados según la lista (cambia al dar plaza o cancelar desde ella).
  const [nConf, setNConf] = useState<number | null>(null);
  // Sin el lote 48 no hay `inscritos_de_tardeo`: los nombres salen de la
  // función del lote 8 (por local) para no dejar la sección vacía.
  const [respaldo, setRespaldo] = useState<string[]>([]);

  // Confirmaciones en hoja propia (no confirm() del navegador).
  const [hoja, setHoja] = useState<null | "borrar" | "cancelar" | "avisar">(null);
  const [obrando, setObrando] = useState(false);

  // Flyer nuevo (se sube al guardar) y lectura con IA opcional.
  const [flyerNuevo, setFlyerNuevo] = useState<File | null>(null);
  const [flyerDecidido, setFlyerDecidido] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [notaIA, setNotaIA] = useState("");

  // Serie (lote 53): las fechas creadas juntas comparten `serie_id`.
  const [serieId, setSerieId] = useState<string | null>(null);
  const [siguientesSerie, setSiguientesSerie] = useState(0);
  const [aplicarSerie, setAplicarSerie] = useState(false);
  const [avisoGuardado, setAvisoGuardado] = useState<string[]>([]);

  // Cancelar y avisar: qué vías hay y a cuántos llegaría (lo dice el servidor).
  const [canales, setCanales] = useState<null | { apuntados: number; conEmail: number; conPush: number; email: boolean; push: boolean; error?: string }>(null);
  const [avisar, setAvisar] = useState(true);
  const [notaAviso, setNotaAviso] = useState("");
  const [resultadoAviso, setResultadoAviso] = useState<string>("");

  useEffect(() => {
    Promise.all([getTardeoById(id), getTardeoRow(id), getInscritosTardeo(id)]).then(([t, fila, ins]) => {
      if (t) {
        setTardeo(t);
        setTitulo(t.titulo);
        setFecha(t.fecha);
        setHoraInicio(t.horaInicio);
        setHoraFin(t.horaFin);
        setEstilo(t.estilo);
        // Un finalizado o cancelado no se toca desde aquí: el selector solo
        // maneja los tres estados que decide el local, y al guardar se
        // conserva el estado real (ver `cerrado` más abajo).
        setCuando({
          estado: t.estado === "programado" ? "programado" : t.estado === "borrador" ? "borrador" : "publicado",
          publicarEn: t.publicarEn ? paraInput(new Date(t.publicarEn)) : "",
        });
        setPromo({ etiquetas: t.etiquetas ?? [] });
        setTipoEvento(t.tipoEvento ?? "");
        setAmbiente(t.ambiente ?? []);
        setPublico(t.publico ?? []);
        setDressCode(t.dressCode ?? "");
        setDj(t.djs.map((d) => d.nombre).join(" · "));
        // La dirección del propio tardeo (puede ser distinta de la del local);
        // `t.local.direccion` es la del local y la pisaría al guardar.
        setDireccion(fila?.direccion ?? t.local.direccion);
        setDescripcion(t.descripcion ?? "");
        setHayColumnaAforo(!!fila && "aforo" in fila);
        // Sin el lote 53 la columna no existe y no hay serie que ofrecer.
        if (fila?.serie_id) {
          setSerieId(fila.serie_id);
          contarSiguientesDeSerie(fila.serie_id, t.fecha).then(setSiguientesSerie);
        }
        setAforo(fila?.aforo ? String(fila.aforo) : "");
        const p = desdeColumnas({
          tipoEntrada: t.tipoEntrada,
          precio: t.precio,
          fourvenues_url: t.urlEntradas ?? null,
          promo_url: t.urlPromos ?? null,
        });
        setPrecio(p);
        setPrecioInicial(p);
      }
      setInscritos(ins);
      if (ins.error && t) {
        getInscritosLocal(t.local.id).then((rs) => setRespaldo(rs.filas.filter((x) => x.tardeo_id === id).map((x) => x.nombre)));
      }
      setCargando(false);
    });
  }, [id]);

  // A dónde se vuelve: el admin que viene de /admin/tardeos, ahí; el local, a su lista.
  const volverHref = esAdmin && (!ficha || ajena || (tardeo && tardeo.local.id !== ficha.id)) ? "/admin/tardeos" : enlace("/local/tardeos");

  const guardar = async () => {
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
    setGuardado(false);
    if (!titulo.trim()) { setError("Ponle un título."); return; }
    if (!fecha) { setError("Falta la fecha."); return; }
    // Un tardeo pasado se puede corregir sin tocar su fecha. Solo se exige
    // fecha de hoy en adelante si se cambia la fecha.
    if (fecha !== tardeo?.fecha && fecha < hoy) { setError("La fecha nueva ya ha pasado. Elige una de hoy en adelante."); return; }
    // Igual que al crear: sin hora de inicio se mandaba "" y la base contestaba
    // con un error en inglés («invalid input syntax for type time»).
    if (!horaInicio) { setError("Falta la hora de inicio."); return; }
    const enlacesSinTocar = precioInicial
      && precio.urlEntradas === precioInicial.urlEntradas && precio.urlPromos === precioInicial.urlPromos;
    const ep = errorPrecio(enlacesSinTocar ? { ...precio, urlEntradas: "", urlPromos: "" } : precio);
    if (ep) { setError(ep); return; }

    const estaCerrado = tardeo?.estado === "cancelado" || tardeo?.estado === "finalizado";
    // Programado sin día y hora no saldría nunca: se pide junto al campo.
    const ec = estaCerrado ? null : errorProgramacion(cuando);
    if (ec) { setErrorCuando(ec); setError("Falta el día y la hora de publicación (en «Publicación»)."); return; }
    setGuardando(true); setError(""); setAvisoGuardado([]);

    // El flyer nuevo se sube ahora, no al elegirlo: si se arrepiente y no
    // guarda, no queda una imagen huérfana en el almacenamiento.
    let flyer: Record<string, unknown> = {};
    if (flyerNuevo) {
      if (!user) { setGuardando(false); setError("Vuelve a entrar para subir el flyer."); return; }
      const url = await subirFlyer(user.id, flyerNuevo);
      if (!url) { setGuardando(false); setError("No se pudo subir el flyer nuevo. Inténtalo de nuevo."); return; }
      flyer = { flyer_url: url, flyer_origen: notaIA ? "ia" : "subido" };
    }

    const campos: Record<string, unknown> = {
      titulo: titulo.trim(),
      fecha,
      hora_inicio: horaInicio,
      hora_fin: horaFin || null,
      estilo,
      // Cancelado o finalizado: no se tocan ni el estado ni la programación.
      ...(estaCerrado ? {} : {
        estado: cuando.estado,
        publicar_en: cuando.estado === "programado" && cuando.publicarEn
          ? new Date(cuando.publicarEn).toISOString()
          : null,
      }),
      // null y no [] cuando está vacío: así "sin indicar" no se confunde con
      // "lo revisó y lo dejó a cero".
      etiquetas: promo.etiquetas.length ? promo.etiquetas : null,
      tipo_evento: tipoEvento || null,
      ambiente: ambiente.length ? ambiente : null,
      publico: publico.length ? publico : null,
      dress_code: dressCode || null,
      // Sitio nuevo elegido con el buscador: dirección, coordenadas y zona
      // juntas. La zona solo si el buscador la trae, para no dejarla vacía.
      ...(dirNueva ? {
        direccion: dirNueva.display,
        lat: dirNueva.lat,
        lng: dirNueva.lng,
        ...(dirNueva.zona ? { zona: dirNueva.zona } : {}),
      } : {}),
      descripcion: descripcion.trim() || null,
      // Las cinco columnas de la entrada salen del componente, igual que al
      // crear: tipo, importe, enlace de entradas y enlace de promociones.
      ...aColumnas(precio),
      ...(hayColumnaAforo || Number(aforo) > 0
        ? { aforo: precio.modo === "gratis" && Number(aforo) > 0 ? Number(aforo) : null }
        : {}),
      ...flyer,
    };
    let { data, error: e } = await updateTardeo(id, campos);
    const avisos: string[] = [];
    // Sin el lote 48 no hay columna `aforo`: se guarda todo lo demás y se dice.
    if (e && "aforo" in campos && falloPorColumna(e, "aforo") && (e.message ?? "").includes("aforo")) {
      delete campos.aforo;
      ({ data, error: e } = await updateTardeo(id, campos));
      if (!e) avisos.push("Las plazas no se han guardado: falta pegar el lote 48 (supabase/48_reservas_aforo_asistencia.sql).");
    }
    if (e) { setGuardando(false); setError(e.message); return; }
    if (!data || data.length === 0) { setGuardando(false); setError("No se guardó: este tardeo no es de tu local (permisos)."); return; }
    let sinFicha: string[] = [];
    // Si fallan los DJs se dice: el resto ya está guardado, pero «Cambios
    // guardados» sería mentira a medias.
    let errorDjs = "";
    try { ({ sinFicha } = await setDjsDeTardeo(id, dj.split(/[,·&]|\sy\s/i))); }
    catch (err) { errorDjs = `Los demás datos se han guardado, pero los DJs no: ${(err as Error).message || "error desconocido"}. Vuelve a pulsar «Guardar cambios».`; }

    // Lo que tiene sentido igual en todas las fechas de la serie. La fecha, el
    // título o el flyer no: cada fecha puede tener los suyos.
    if (aplicarSerie && serieId && tardeo) {
      const r = await aplicarASerie(serieId, tardeo.fecha, {
        hora_inicio: horaInicio,
        hora_fin: horaFin || null,
        descripcion: descripcion.trim() || null,
        ...aColumnas(precio),
      });
      if (r.error) avisos.push(`Este tardeo está guardado, pero las demás fechas de la serie no: ${r.error}`);
      else avisos.push(`También se han actualizado ${r.n} ${r.n === 1 ? "fecha siguiente" : "fechas siguientes"} de la serie.`);
      setAplicarSerie(false);
    }

    setGuardando(false);
    setDjsSinFicha(sinFicha);
    setAvisoGuardado(avisos);
    if (errorDjs) setError(errorDjs);
    else setGuardado(true);
    if (flyer.flyer_url) {
      setTardeo((t) => (t ? { ...t, flyer: flyer.flyer_url as string } : t));
      setFlyerNuevo(null); setFlyerDecidido(false); setNotaIA("");
    }
    if (dirNueva) { setDireccion(dirNueva.display); setDirNueva(null); }
    setPrecioInicial(precio);
    // El estado de la cabecera sigue a lo guardado.
    setTardeo((t) => (t && !estaCerrado ? { ...t, titulo: titulo.trim(), fecha, estado: cuando.estado } : t));
  };

  const cambiarEstado = async (nuevo: string) => {
    setError(""); setGuardado(false); setObrando(true);
    const { data, error: e } = await setEstadoTardeo(id, nuevo);
    setObrando(false);
    if (e) { setError("No se pudo cambiar el estado: " + e.message); return; }
    if (!data || data.length === 0) { setError("No se pudo: este tardeo no es de tu local (permisos)."); return; }
    // Reabrir un cancelado: se borra la marca de «ya avisados» para que, si se
    // vuelve a cancelar, se pueda avisar otra vez. Sin el lote 57 la columna no
    // existe y el fallo se ignora (no hay marca que limpiar).
    if (tardeo?.estado === "cancelado" && nuevo !== "cancelado") {
      await supabase.from("tardeos").update({ avisado_cancelacion_en: null }).eq("id", id);
    }
    setTardeo((t) => (t ? { ...t, estado: nuevo } : t));
    if (nuevo === "publicado" || nuevo === "borrador") { setCuando({ estado: nuevo, publicarEn: "" }); setErrorCuando(""); }
  };

  const eliminar = async () => {
    setError(""); setObrando(true);
    const { error: e, count } = await borrarTardeo(id);
    setObrando(false);
    setHoja(null);
    if (e) { setError("No se pudo borrar: " + e.message); return; }
    // Si RLS no deja borrar, no da error pero tampoco borra nada
    if (count === 0) { setError("No se borró: parece que este tardeo no es de tu local (permisos)."); return; }
    router.push(volverHref);
  };

  /** Pregunta al servidor a cuántos llegaría el aviso y por qué vías. */
  const consultarCanales = async () => {
    setCanales(null); setResultadoAviso("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/avisar-apuntados", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tardeoId: id, soloContar: true, accessToken: session?.access_token }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setCanales({ apuntados: nApuntados, conEmail: 0, conPush: 0, email: false, push: false, error: j.error }); return; }
      setCanales(j);
    } catch {
      setCanales({ apuntados: nApuntados, conEmail: 0, conPush: 0, email: false, push: false, error: "Sin conexión con el servidor." });
    }
  };

  const mandarAviso = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/avisar-apuntados", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tardeoId: id, nota: notaAviso, accessToken: session?.access_token }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "No se pudo enviar el aviso.");
    const partes = [
      j.emails ? `${j.emails} por email` : "",
      j.push ? `${j.push} por notificación` : "",
    ].filter(Boolean);
    return partes.length ? `Aviso enviado: ${partes.join(" y ")}.` : "No había nadie a quien avisar por email ni notificación.";
  };

  const cancelarTardeo = async () => {
    setError(""); setGuardado(false); setObrando(true); setResultadoAviso("");
    const { data, error: e } = await setEstadoTardeo(id, "cancelado");
    if (e || !data?.length) {
      setObrando(false); setHoja(null);
      setError(e ? "No se pudo cancelar: " + e.message : "No se pudo: este tardeo no es de tu local (permisos).");
      return;
    }
    setTardeo((t) => (t ? { ...t, estado: "cancelado" } : t));
    let msg = "Tardeo cancelado. Ya no sale en la web como disponible.";
    if (avisar && nApuntados > 0 && canales && !canales.error && (canales.email || canales.push)) {
      try { msg += " " + (await mandarAviso()); }
      catch (err) { msg += ` No se pudo avisar: ${(err as Error).message}`; }
    }
    setObrando(false); setHoja(null); setResultadoAviso(msg);
  };

  const soloAvisar = async () => {
    setObrando(true);
    try { setResultadoAviso(await mandarAviso()); setHoja(null); }
    catch (err) { setCanales((c) => (c ? { ...c, error: (err as Error).message } : c)); }
    setObrando(false);
  };

  /** Lectura con IA del flyer nuevo: rellena lo que encuentre y lo dice. */
  const analizarFlyer = async () => {
    if (!flyerNuevo) return;
    setLeyendo(true); setError(""); setNotaIA("");
    try {
      const d = await leerFlyerConIA(flyerNuevo);
      const cambiados: string[] = [];
      if (d.titulo) { setTitulo(d.titulo); cambiados.push("título"); }
      if (d.fecha) { setFecha(d.fecha); cambiados.push("fecha"); }
      if (d.horaInicio) { setHoraInicio(d.horaInicio); cambiados.push("hora"); }
      if (d.horaFin) setHoraFin(d.horaFin);
      if (d.dj) { setDj(d.dj); cambiados.push("DJ"); }
      if (d.estilo) { setEstilo(d.estilo); cambiados.push("estilo"); }
      setFlyerDecidido(true);
      setNotaIA(cambiados.length
        ? `La IA ha cambiado: ${cambiados.join(", ")}. Revísalo antes de guardar.`
        : "La IA no ha encontrado datos nuevos. El flyer se cambiará al guardar.");
    } catch (err) {
      setError((err as Error).message);
    }
    setLeyendo(false);
  };

  if (cargando) {
    return <main className="flex items-center justify-center gap-2 pt-24 text-[15px] text-tinta-suave"><Loader2 className="animate-spin" aria-hidden /> Cargando…</main>;
  }
  if (!tardeo) {
    return (
      <SeccionPanel titulo="Editar tardeo" ancho="estrecho">
        <div className="rounded-2xl border border-linea bg-white p-6 text-center shadow-tarjeta">
          <p className="text-[15px] text-tinta-suave">No se encontró el tardeo o no es tuyo.</p>
          <Link href={volverHref} className="mt-3 inline-flex min-h-[44px] items-center font-bold text-magenta-700">Volver a mis tardeos</Link>
        </div>
      </SeccionPanel>
    );
  }

  const publicado = tardeo.estado === "publicado";
  // Cancelado o finalizado: se puede corregir el contenido, pero guardar no lo
  // reactiva. Para reabrirlo hay un botón aparte y explícito.
  const cerrado = tardeo.estado === "cancelado" || tardeo.estado === "finalizado";
  const est = NOMBRE_ESTADO[tardeo.estado ?? "publicado"] ?? NOMBRE_ESTADO.borrador;
  const apuntados = inscritos?.filas.filter((f) => f.estado === "apuntado") ?? [];
  // Confirmados AHORA: la lista de asistentes puede dar plaza o cancelar sin
  // recargar la página. Con el número de la carga inicial, cancelar el tardeo
  // dejaba sin aviso a quien acababa de recibir plaza (o decía «Avisar a 3»
  // cuando ya no quedaba nadie).
  const nApuntados = nConf ?? apuntados.length;
  // Hay lista si alguien se apuntó alguna vez (también en espera o cancelado):
  // antes el bloque solo salía con confirmados y la espera quedaba escondida.
  const hayLista = (inscritos?.filas.length ?? 0) > 0;

  return (
    <SeccionPanel
      titulo="Editar tardeo"
      ancho="estrecho"
      acciones={publicado ? (
        <Link href={`/tardeos/${id}`} target="_blank"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-linea-fuerte bg-white px-4 text-[15px] font-semibold hover:bg-marfil-100">
          <ExternalLink size={16} aria-hidden /> Ver en la web
        </Link>
      ) : undefined}
    >
      <div className="flex flex-col gap-4">
        {/* Cabecera: flyer, fecha y estado de un vistazo. */}
        <div className="flex items-center gap-4 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
          <Image src={flyerSrc(tardeo)} alt="" width={64} height={80} className="h-20 w-16 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-tinta-suave">{formatFecha(tardeo.fecha)} · {tardeo.local.nombre}</p>
            <p className="truncate text-lg font-bold leading-tight">{tardeo.titulo}</p>
            <div className="mt-1"><Etiqueta tono={est.tono}>{est.label}</Etiqueta></div>
          </div>
        </div>

        {cerrado && (
          <div className="rounded-2xl border border-aviso/25 bg-aviso-fondo p-4">
            <p className="font-bold">Este tardeo está {tardeo.estado === "cancelado" ? "cancelado" : "finalizado"}.</p>
            <p className="mt-1 text-[15px]">
              Puedes corregir sus datos y se quedará como está. Si quieres volver a usarlo, pásalo a borrador abajo.
            </p>
            {tardeo.estado === "cancelado" && nApuntados > 0 && (
              <Boton variante="contorno" tamano="pequeno" className="mt-3"
                onClick={() => { setHoja("avisar"); consultarCanales(); }}>
                <BellRing size={16} aria-hidden /> Avisar a los {nApuntados} apuntados
              </Boton>
            )}
          </div>
        )}

        <Bloque titulo="Flyer" ayuda="Sube el nuevo si ha cambiado el cartel. Se guarda al pulsar «Guardar cambios».">
          <SubirFlyer
            archivo={flyerNuevo}
            onArchivo={(f) => { setFlyerNuevo(f); setFlyerDecidido(false); setNotaIA(""); }}
            onAnalizar={analizarFlyer}
            analizando={leyendo}
            onSoloSubir={() => setFlyerDecidido(true)}
            decidido={flyerDecidido}
          />
          {notaIA && (
            <p className="flex items-start gap-2 rounded-xl bg-ok-fondo p-3 text-[15px] font-semibold text-ok">
              <Sparkles size={18} className="mt-0.5 shrink-0" aria-hidden /> {notaIA}
            </p>
          )}
        </Bloque>

        <Bloque titulo="Datos básicos">
          <Campo etiqueta="Título" htmlFor="titulo">
            <input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} className={claseCampo} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Fecha" htmlFor="fecha">
              <input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Estilo de música" htmlFor="estilo">
              <input id="estilo" value={estilo} onChange={(e) => setEstilo(e.target.value)} className={claseCampo} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Empieza" htmlFor="ini">
              <input id="ini" type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Acaba" htmlFor="fin">
              <input id="fin" type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className={claseCampo} />
            </Campo>
          </div>
          <DjsCartel valor={dj} onCambio={setDj} />
          <Campo etiqueta="Descripción (opcional)" htmlFor="desc">
            <textarea id="desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3}
              placeholder="Qué se va a encontrar quien venga." className={`${claseCampo} resize-y`} />
          </Campo>
        </Bloque>

        <Bloque titulo="Lugar">
          <p className="rounded-xl bg-marfil-100 px-4 py-3 text-[15px]">{dirNueva ? dirNueva.display : direccion || "Sin dirección"}</p>
          <div>
            <p className="mb-1.5 text-sm text-tinta-suave">
              ¿Es en otro sitio? Búscalo por su nombre o por la calle: así también se mueve en el mapa.
            </p>
            <AddressSearch onSelect={setDirNueva} placeholder="Busca el nuevo sitio…" />
            {dirNueva && (
              <button type="button" onClick={() => setDirNueva(null)} className="mt-1 min-h-[44px] text-[15px] font-bold text-magenta-700">
                Dejar la dirección como estaba
              </button>
            )}
          </div>
        </Bloque>

        <Bloque titulo="Entradas">
          <PrecioTardeo valor={precio} onCambio={setPrecio} />
          {precio.modo === "gratis" && <CampoAforo valor={aforo} onCambio={setAforo} />}
        </Bloque>

        {/* Quién viene. Usa la función del lote 48, que responde al local y
            también al admin. */}
        {(hayLista || respaldo.length > 0 || precio.modo === "gratis") && (
          <Bloque id="apuntados" plegable titulo={`Asistentes y lista de espera${nConf != null ? ` (${nConf})` : nApuntados || respaldo.length ? ` (${nApuntados || respaldo.length})` : ""}`}
            ayuda="Pasa lista, da plaza a quien espera o cancela. Cada cambio se guarda al tocar.">
            <PasarLista tardeoId={id} nombresRespaldo={respaldo} onCambio={(f) => setNConf(f.length)} />
            {!ajena && (nApuntados > 0 || respaldo.length > 0) && (
              <Link href={enlace(`/local/apuntados?tardeo=${id}`)} className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-bold text-magenta-700">
                <Users size={16} aria-hidden /> Exportar CSV
              </Link>
            )}
          </Bloque>
        )}

        {/* Invitaciones (lote 55): el DJ entra en el cartel solo si acepta. Se
            guardan al momento, aparte del "Guardar cambios". */}
        <Bloque plegable titulo="Invitar a un DJ" ayuda="Le llega a su panel. Si acepta, sale en el cartel y en su perfil.">
          <InvitarDj tardeoId={id} creadaPor={user?.id} />
        </Bloque>

        <Bloque titulo="Etiquetas y promociones" ayuda="Lo que hace que alguien elija este tardeo y no otro.">
          <PromoTardeo valor={promo} onCambio={setPromo} />
          {/* Las promociones se guardan solas, aparte del resto del formulario:
              van en su propia tabla y cada una es una fila. Meterlas en el
              "Guardar cambios" de abajo obligaría a guardar el tardeo entero
              para añadir una oferta. */}
          <PromocionesDeTardeo tardeoId={id} />
        </Bloque>

        <Bloque titulo="Cómo es el tardeo" ayuda="Ambiente, público y outfit. Con esto te encuentran en los filtros.">
          {/* Es también la vía para rellenar los 662 migrados, que llegaron
              sin ninguno de los tres. */}
          <SelectorAdn
            tipoEvento={tipoEvento} ambiente={ambiente} publico={publico} dressCode={dressCode}
            onTipoEvento={setTipoEvento} onAmbiente={setAmbiente}
            onPublico={setPublico} onDressCode={setDressCode}
          />
        </Bloque>

        {!cerrado && (
          <Bloque titulo="Publicación">
            <ProgramarPublicacion valor={cuando} error={errorCuando}
              onCambio={(c) => { setCuando(c); setErrorCuando(""); }} />
          </Bloque>
        )}

        {serieId && siguientesSerie > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
            <input type="checkbox" checked={aplicarSerie} onChange={(e) => setAplicarSerie(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-magenta" />
            <span>
              <span className="flex items-center gap-2 text-[16px] font-bold">
                <Repeat size={18} className="text-magenta" aria-hidden />
                Aplicar también a las {siguientesSerie} {siguientesSerie === 1 ? "fecha siguiente" : "fechas siguientes"} de esta serie
              </span>
              <span className="mt-0.5 block text-[15px] text-tinta-suave">
                Horas, entrada y precio, enlaces y descripción. La fecha, el título y el flyer de cada una no se tocan.
              </span>
            </span>
          </label>
        )}

        {/* Barra de guardar: pegada abajo en el móvil para no tener que bajar
            hasta el final después de cambiar una hora. */}
        {/* En el móvil se pega ENCIMA de la barra de abajo (64 px + zona segura):
            con bottom-0 quedaba debajo de ella y no se veía el botón de guardar. */}
        <div className="sticky bottom-[calc(var(--alto-barra-inferior,4rem)+var(--alto-mini,0px))] z-10 -mx-4 flex flex-col gap-2 border-t border-linea bg-marfil/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
          <div aria-live="polite">
            {error && <p role="alert" className="rounded-xl border border-error/20 bg-error-fondo p-3 text-[15px] font-semibold text-error">{error}</p>}
            {guardado && !error && (
              <div className="rounded-xl bg-ok-fondo p-3 text-[15px] text-ok">
                <p className="flex items-center gap-2 font-semibold"><Check size={18} aria-hidden /> Cambios guardados.</p>
                {avisoGuardado.map((a) => (
                  <p key={a} className="mt-1 flex items-start gap-1.5 text-tinta">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-aviso" aria-hidden /> {a}
                  </p>
                ))}
                {djsSinFicha.length > 0 && (
                  <p className="mt-1 text-tinta">
                    Ojo: no hay ficha de <b>{djsSinFicha.join(", ")}</b>, así que este tardeo no saldrá en su perfil.
                  </p>
                )}
                <Link href={volverHref} className="mt-1 inline-flex min-h-[40px] items-center font-bold text-ok underline underline-offset-2">
                  Volver a la lista
                </Link>
              </div>
            )}
          </div>
          <Boton ancho onClick={guardar} cargando={guardando}>
            {!guardando && <Check size={20} aria-hidden />} Guardar cambios
          </Boton>
        </div>

        {/* Acciones de estado */}
        <section className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-6">
          <h2 className="text-lg font-bold">Más acciones</h2>
          {resultadoAviso && (
            <p role="status" className="mt-3 rounded-xl bg-ok-fondo p-3 text-[15px] font-semibold text-ok">{resultadoAviso}</p>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {cerrado ? (
              <Boton variante="contorno" ancho onClick={() => cambiarEstado("borrador")} disabled={obrando}>
                <EyeOff size={18} aria-hidden /> Reabrir como borrador
              </Boton>
            ) : publicado ? (
              <Boton variante="contorno" ancho onClick={() => cambiarEstado("borrador")} disabled={obrando}>
                <EyeOff size={18} aria-hidden /> Despublicar (ocultar)
              </Boton>
            ) : (
              <Boton variante="suave" ancho onClick={() => cambiarEstado("publicado")} disabled={obrando}>
                <Eye size={18} aria-hidden /> Publicar ahora
              </Boton>
            )}
            <Link href={enlace(`/local/crear?desde=${id}`)}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-linea-fuerte bg-white px-4 text-[16px] font-bold hover:bg-marfil-100">
              <Copy size={18} aria-hidden /> Duplicar (otra fecha)
            </Link>
            {!cerrado && (
              <Boton variante="contorno" ancho onClick={() => { setAvisar(true); setNotaAviso(""); setHoja("cancelar"); consultarCanales(); }}>
                <Ban size={18} aria-hidden /> Cancelar tardeo…
              </Boton>
            )}
            <Boton variante="contorno" ancho onClick={() => setHoja("borrar")} className="!text-error">
              <Trash2 size={18} aria-hidden /> Borrar tardeo
            </Boton>
          </div>
        </section>
      </div>

      <Hoja abierta={hoja === "borrar"} onCerrar={() => !obrando && setHoja(null)} titulo="¿Borrar este tardeo?"
        pie={
          <div className="flex gap-2">
            <Boton variante="contorno" ancho onClick={() => setHoja(null)} disabled={obrando}>Cancelar</Boton>
            <Boton variante="peligro" ancho onClick={eliminar} cargando={obrando}>Borrar</Boton>
          </div>
        }>
        <p className="text-[15px]">
          «{tardeo.titulo}» del {formatFecha(tardeo.fecha).toLowerCase()} desaparecerá de la web y de tu panel.
          <b> No se puede deshacer.</b>
        </p>
        {nApuntados > 0 && (
          <p className="mt-2 rounded-xl bg-aviso-fondo p-3 text-[15px] text-aviso">
            Hay {nApuntados} {nApuntados === 1 ? "persona apuntada" : "personas apuntadas"}. Si al final no se hace, mejor despublícalo y avísales.
          </p>
        )}
      </Hoja>

      <Hoja abierta={hoja === "cancelar" || hoja === "avisar"} onCerrar={() => !obrando && setHoja(null)}
        titulo={hoja === "cancelar" ? "¿Cancelar este tardeo?" : "Avisar a los apuntados"}
        pie={
          <div className="flex gap-2">
            <Boton variante="contorno" ancho onClick={() => setHoja(null)} disabled={obrando}>Volver</Boton>
            {hoja === "cancelar" ? (
              <Boton variante="peligro" ancho onClick={cancelarTardeo} cargando={obrando}>Cancelar tardeo</Boton>
            ) : (
              <Boton ancho onClick={soloAvisar} cargando={obrando}
                disabled={!canales || (!canales.email && !canales.push)}>Enviar aviso</Boton>
            )}
          </div>
        }>
        {hoja === "cancelar" && (
          <p className="text-[15px]">
            «{tardeo.titulo}» del {formatFecha(tardeo.fecha).toLowerCase()} se marcará como <b>cancelado</b>: deja de
            salir como disponible y nadie más se podrá apuntar. No se borra; puedes reabrirlo como borrador.
          </p>
        )}
        {nApuntados === 0 ? (
          hoja === "cancelar" && <p className="mt-2 text-[15px] text-tinta-suave">No hay nadie apuntado, así que no hay a quién avisar.</p>
        ) : !canales ? (
          <p className="mt-3 flex items-center gap-2 text-[15px] text-tinta-suave"><Loader2 size={16} className="animate-spin" aria-hidden /> Comprobando cómo avisar…</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {/* Se dice la verdad sobre el aviso: si el servidor no tiene email
                ni notificaciones configurados, no se finge que se avisa. */}
            {canales.error && hoja === "cancelar" ? (
              <p className="rounded-xl bg-aviso-fondo p-3 text-[15px] text-tinta">
                No hemos podido comprobar cómo avisar ({canales.error}). Puedes cancelar igualmente y avisar después
                desde este tardeo, o a mano con la lista de «Apuntados».
              </p>
            ) : canales.error && !canales.email && !canales.push ? (
              // Falló la consulta: se enseña el error real y no «no está
              // configurado», que haría creer que falta algo en el servidor.
              <p role="alert" className="rounded-xl bg-error-fondo p-3 text-[15px] font-semibold text-error">
                No hemos podido comprobar cómo avisar: {canales.error} Inténtalo de nuevo en un rato o avisa a mano con la lista de «Apuntados».
              </p>
            ) : !canales.email && !canales.push ? (
              <p className="rounded-xl bg-aviso-fondo p-3 text-[15px] text-tinta">
                <b>El aviso automático no está configurado</b> (falta el envío de emails y de notificaciones en el servidor).
                Avisa tú a {nApuntados === 1 ? "la persona apuntada" : `las ${nApuntados} personas apuntadas`}: tienes la lista en «Apuntados».
              </p>
            ) : (
              <>
                {hoja === "cancelar" && (
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} className="mt-1 h-5 w-5 accent-magenta" />
                    <span className="text-[15px]">
                      <b>Avisar a {nApuntados === 1 ? "la persona apuntada" : `las ${nApuntados} personas apuntadas`}</b>
                    </span>
                  </label>
                )}
                <p className="text-sm text-tinta-suave">
                  Llegará {[canales.email ? `a ${canales.conEmail} por email` : "", canales.push ? `a ${canales.conPush} por notificación en el móvil` : ""].filter(Boolean).join(" y ")}.
                  {!canales.email && " El email no está configurado."}
                  {!canales.push && " Las notificaciones no están configuradas."}
                </p>
                {(hoja === "avisar" || avisar) && (
                  <Campo etiqueta="Mensaje para ellos (opcional)" htmlFor="nota-aviso" ayuda="Por ejemplo, si se pasa a otra fecha.">
                    <textarea id="nota-aviso" rows={2} maxLength={300} value={notaAviso} onChange={(e) => setNotaAviso(e.target.value)}
                      className={`${claseCampo} resize-y`} />
                  </Campo>
                )}
                {hoja === "avisar" && canales.error && (
                  <p role="alert" className="rounded-xl bg-error-fondo p-3 text-[15px] font-semibold text-error">{canales.error}</p>
                )}
              </>
            )}
          </div>
        )}
      </Hoja>
    </SeccionPanel>
  );
}
