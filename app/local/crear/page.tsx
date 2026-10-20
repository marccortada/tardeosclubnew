"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { usePanelLocal } from "../_panel/PanelLocal";
import { vincularDjsPorNombre, invalidarCacheTardeos, falloPorColumna, getTardeoRow, getTardeoById, buscarDuplicados, type PosibleDuplicado } from "@/lib/tardeos";
import DjsCartel from "../_panel/DjsCartel";
import VistaPrevia from "../_panel/VistaPrevia";
import AyudaBorrador from "../_panel/AyudaBorrador";
import { leerFlyerConIA, subirFlyer } from "../_panel/leerFlyer";
import { supabase } from "@/lib/supabase";
import { mensajeAmable } from "@/lib/mensajeError";
import SelectorAdn from "@/components/SelectorAdn";
import SelectorLocal from "@/components/SelectorLocal";
import AddressSearch, { Direccion } from "@/components/AddressSearch";
import ProgramarPublicacion, { errorProgramacion, type Cuando } from "@/components/ProgramarPublicacion";
import PeriodicidadTardeo from "@/components/PeriodicidadTardeo";
import { fechasDeSerie, fechaCorta, SIN_REPETIR, type Periodicidad } from "@/lib/periodicidad";
import PrecioTardeo, { PRECIO_VACIO, aColumnas, desdeColumnas, errorPrecio, type Precio } from "@/components/PrecioTardeo";
import CampoAforo from "@/components/CampoAforo";
import PromoTardeo, { PROMO_VACIA, type Promo } from "@/components/PromoTardeo";
import SubirFlyer from "@/components/SubirFlyer";
import Boton, { claseBoton } from "@/components/Boton";
import Campo, { claseCampo } from "@/components/ui/Campo";
import {
  Sparkles, Loader2, Check, AlertTriangle, MapPin, ArrowRight, ArrowLeft, Store, Repeat, Copy, Clock, Eye,
} from "lucide-react";

/** Los mismos tres del admin antiguo, para que nadie tenga que reaprender. */
const PASOS = [
  { t: "Flyer y datos", d: "Qué, cuándo y quién pincha" },
  { t: "Lugar y entradas", d: "Dónde es y cómo se entra" },
  { t: "Detalles y publicar", d: "Ambiente y cuándo sale" },
];
/**
 * "revisar" es la pantalla del formulario, con flyer o sin él.
 *
 * Había un paso previo —"inicio"— donde primero se elegía entre subir flyer o
 * rellenar a mano. Sobraba: en el admin antiguo el recuadro del flyer está
 * DENTRO del primer paso, y así no hay que decidir nada antes de empezar. Se
 * escribe lo que se sepa y, si aparece un flyer, se suelta ahí mismo.
 */
type Estado = "procesando" | "revisar" | "publicado";

const EXTRAIDO = {
  titulo: "",
  descripcion: "",
  fecha: "",
  horaInicio: "",
  horaFin: "",
  dj: "",
  estilo: "",
  ubicacion: "",
  zona: "",
};

/** Lo que la IA no ha leído claro se marca para que se mire dos veces. */
const claseRevisar = (r: boolean) => (r ? `${claseCampo} !border-aviso !bg-aviso-fondo` : claseCampo);

export default function CrearTardeo() {
  const router = useRouter();
  const { user, esAdmin, ficha, ajena, enlace } = usePanelLocal();
  const [estado, setEstado] = useState<Estado>("revisar");
  const [form, setForm] = useState(EXTRAIDO);
  // Fuera de `form` porque no son texto: dos son listas y el formulario base
  // solo maneja cadenas.
  const [cuando, setCuando] = useState<Cuando>({ estado: "publicado", publicarEn: "" });
  const [errorCuando, setErrorCuando] = useState("");
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>(SIN_REPETIR);
  const [creados, setCreados] = useState(1);
  const [rellenoIA, setRellenoIA] = useState(false);
  const [precio, setPrecio] = useState<Precio>(PRECIO_VACIO);
  const [aforo, setAforo] = useState("");
  const [promo, setPromo] = useState<Promo>(PROMO_VACIA);
  // Ya se eligió qué hacer con el flyer subido (IA o tal cual).
  const [flyerDecidido, setFlyerDecidido] = useState(false);
  const [paso, setPaso] = useState(0);
  const [tipoEvento, setTipoEvento] = useState("");
  const [ambiente, setAmbiente] = useState<string[]>([]);
  const [publico, setPublico] = useState<string[]>([]);
  const [dressCode, setDressCode] = useState("");
  // El admin puede publicar en cualquier local; el resto, solo en el suyo
  // (el elegido en la barra lateral si tiene varios).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [locales, setLocales] = useState<any[]>(ficha ? [ficha] : []);
  const [localId, setLocalId] = useState(ficha?.id ?? "");
  const [publicando, setPublicando] = useState(false);
  // Nombres del flyer que no corresponden a ningún DJ fichado. Se avisa al
  // publicar: si no, el tardeo se queda sin salir en el perfil de ese DJ y
  // nadie se entera nunca.
  const [djsSinFicha, setDjsSinFicha] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [revisar, setRevisar] = useState<Set<string>>(new Set());
  const [archivoSubido, setArchivoSubido] = useState<File | null>(null);
  // Solo para promotores: su ficha no tiene dirección, así que el sitio se
  // elige aquí, en cada tardeo.
  const [dirTardeo, setDirTardeo] = useState<Direccion | null>(null);
  // Duplicar (?desde=<id>): el flyer del original se reutiliza tal cual si
  // no se sube otro, y se dice de qué tardeo viene.
  const [flyerOriginal, setFlyerOriginal] = useState<string | null>(null);
  const [duplicando, setDuplicando] = useState<{ titulo: string } | null>(null);
  // Avisos tras crear que no son error: aforo sin el lote 48, serie sin el 53.
  const [avisos, setAvisos] = useState<string[]>([]);
  // El admin necesita la lista completa de locales antes de duplicar (el
  // original puede ser de otro). Y al cambiar de local por duplicar, no se
  // borra la dirección copiada.
  const [listaAdmin, setListaAdmin] = useState(false);
  const conservarDir = useRef(false);
  // Dossier pág. 11: vista previa, duplicados y «Necesito ayuda» sin perder lo escrito.
  const [vista, setVista] = useState(false);
  const [duplicados, setDuplicados] = useState<PosibleDuplicado[] | null>(null);
  const [recuperado, setRecuperado] = useState(false);
  const borradorListo = useRef(false);

  useEffect(() => {
    if (!esAdmin) {
      setLocales(ficha ? [ficha] : []);
      setLocalId(ficha?.id ?? "");
      return;
    }
    // RLS deja al admin ver todos los locales, tenga o no uno propio.
    supabase.from("locales").select("id,nombre,zona,direccion,lat,lng,tipo,estado").order("nombre").then(({ data }) => {
      const todos = data ?? [];
      setLocales(todos);
      setLocalId(ficha?.id ?? todos[0]?.id ?? "");
      setListaAdmin(true);
    });
  }, [esAdmin, ficha]);

  const local = locales.find((l) => l.id === localId) ?? null;

  const esPromotor = local?.tipo === "promotor";

  // La dirección y la zona del tardeo salen del local elegido. Si el admin
  // cambia de local a media faena, hay que rehacerlas o publicaría en el sitio
  // equivocado con las coordenadas del anterior.
  //
  // Con un promotor no hay nada que heredar: su ficha no tiene dirección, así
  // que se limpia y se pide abajo con el buscador.
  useEffect(() => {
    if (!local) return;
    if (conservarDir.current) conservarDir.current = false;
    else setDirTardeo(null);
    setForm((f) => ({ ...f, ubicacion: local.direccion ?? "", zona: local.zona ?? "" }));
  }, [localId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Fecha que llega del calendario (?fecha=2026-08-30). Se lee al montar y no
   * con useSearchParams, que obligaría a envolver la página en un Suspense y
   * ya nos tiró un despliegue una vez.
   */
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("fecha");
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) setForm((p) => ({ ...p, fecha: f }));
  }, []);

  /**
   * «Duplicar» desde Mis tardeos (?desde=<id>): se copia todo menos la fecha,
   * que es justo lo que cambia. Se lee DESPUÉS de que el efecto del local haya
   * puesto su dirección, para que la del original no se pise.
   */
  useEffect(() => {
    const desde = new URLSearchParams(window.location.search).get("desde");
    if (!desde || !localId || (esAdmin && !listaAdmin)) return;
    let vivo = true;
    Promise.all([getTardeoRow(desde), getTardeoById(desde)]).then(([fila, t]) => {
      if (!vivo || !fila) return;
      // El admin puede duplicar en cualquier local: se va al del original.
      if (esAdmin && fila.local_id && fila.local_id !== localId && locales.some((l) => l.id === fila.local_id)) {
        conservarDir.current = true;
        setLocalId(fila.local_id);
      }
      setForm((p) => ({
        ...p,
        titulo: fila.titulo ?? "",
        descripcion: fila.descripcion ?? "",
        horaInicio: (fila.hora_inicio ?? "").slice(0, 5),
        horaFin: (fila.hora_fin ?? "").slice(0, 5),
        dj: t?.djs.map((d) => d.nombre).filter(Boolean).join(" · ") ?? "",
        estilo: fila.estilo ?? "",
      }));
      setPrecio(desdeColumnas({
        // La fila guarda dos banderas (ver aColumnas), no un «tipo_entrada».
        tipoEntrada: fila.tiene_lista ? "lista" : fila.es_de_pago ? "pago" : "gratis",
        precio: fila.precio ?? undefined,
        fourvenues_url: fila.fourvenues_url ?? null, promo_url: fila.promo_url ?? null,
      }));
      setAforo(fila.aforo ? String(fila.aforo) : "");
      setPromo({ etiquetas: fila.etiquetas ?? [] });
      setTipoEvento(fila.tipo_evento ?? "");
      setAmbiente(fila.ambiente ?? []);
      setPublico(fila.publico ?? []);
      setDressCode(fila.dress_code ?? "");
      // El sitio del original con sus coordenadas: un promotor no tiene que
      // volver a buscarlo, y un local que lo hizo fuera tampoco.
      if (fila.direccion && fila.lat != null && fila.lng != null) {
        setDirTardeo({ display: fila.direccion, lat: fila.lat, lng: fila.lng, cp: "", zona: fila.zona ?? "" });
      }
      if (fila.flyer_url && !String(fila.flyer_url).includes("placeholder")) setFlyerOriginal(fila.flyer_url);
      setDuplicando({ titulo: fila.titulo ?? "" });
    });
    return () => { vivo = false; };
    // Solo una vez, cuando ya se sabe el local (y la lista, en el admin).
  }, [esAdmin ? listaAdmin : !!localId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Borrador en este navegador: si se cierra la pestaña, se pide ayuda o se
   * va la conexión, lo escrito no se pierde. Solo el formulario nuevo (no al
   * duplicar, que ya trae sus datos). El flyer no se guarda: es un archivo.
   */
  const CLAVE_BORRADOR = "tc-borrador-crear";
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("desde")) { borradorListo.current = true; return; }
    try {
      const b = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) ?? "null");
      if (b?.form?.titulo || b?.form?.descripcion) {
        setForm((f) => ({ ...f, ...b.form, ubicacion: f.ubicacion, zona: f.zona }));
        if (b.precio) setPrecio(b.precio);
        if (b.periodicidad) setPeriodicidad(b.periodicidad);
        if (typeof b.aforo === "string") setAforo(b.aforo);
        setRecuperado(true);
      }
    } catch { /* sin almacenamiento: no pasa nada */ }
    borradorListo.current = true;
  }, []);
  useEffect(() => {
    if (!borradorListo.current || estado !== "revisar") return;
    try { localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ form, precio, periodicidad, aforo })); } catch { /* sin almacenamiento */ }
  }, [form, precio, periodicidad, aforo, estado]);
  const borrarBorrador = () => { try { localStorage.removeItem(CLAVE_BORRADOR); } catch { /* nada */ } };

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Vía "ya tengo el flyer": Claude LEE la imagen (IA real). La lectura, la
  // reducción de la imagen y los errores de red van en leerFlyerConIA, la
  // misma que usa el editor.
  const leerFlyer = async (file: File) => {
    setError("");
    setArchivoSubido(file);
    setEstado("procesando");
    try {
      const d = await leerFlyerConIA(file);
      setForm((f) => ({
        ...f,
        titulo: d.titulo || f.titulo,
        fecha: d.fecha || f.fecha,
        horaInicio: d.horaInicio || f.horaInicio,
        horaFin: d.horaFin || f.horaFin,
        // `|| f.dj` y no `|| ""`: si la IA no encuentra el DJ en el flyer, se
        // queda lo que hubiera escrito la persona. Antes lo vaciaba, así que
        // analizar un flyer podía BORRAR lo que ya habías puesto a mano.
        dj: d.dj || f.dj,
        estilo: d.estilo || f.estilo,
        ubicacion: local?.direccion ?? f.ubicacion,
        zona: local?.zona ?? f.zona,
      }));
      // Entrada y precio que ha leído la IA. Solo se aplican si la persona aún
      // no ha tocado la entrada (sigue en «gratis», el valor por defecto): así
      // no se pisa lo que ya hubiera elegido o escrito a mano.
      // Del texto del flyer se toma el PRIMER número: «10-15 €» daba 1015 €.
      const primerNumero = String(d.precio ?? "").match(/\d+(?:[.,]\d+)?/)?.[0] ?? "";
      const importe = primerNumero.replace(",", ".");
      if (d.tipoEntrada === "pago") {
        setPrecio((p) => p.modo !== "gratis" || p.importe ? p : {
          ...p, modo: Number(importe) > 0 ? "conprecio" : "sinprecio", importe: Number(importe) > 0 ? importe : "",
        });
      } else if (d.tipoEntrada === "lista") {
        setPrecio((p) => (p.modo !== "gratis" ? p : { ...p, modo: "lista" }));
      }
      setRevisar(new Set(Array.isArray(d.revisar) ? d.revisar : []));
      setRellenoIA(true);
      setFlyerDecidido(true);
      setEstado("revisar");
    } catch (e: unknown) {
      setError(e ? mensajeAmable(e) : "Error al leer el flyer.");
      setEstado("revisar");
    }
  };

  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

  /** Lo que falta en cada paso. Se comprueba al pulsar «Siguiente» para que
   *  el error salga donde está el campo, y no dos pantallas después. */
  const faltaEnPaso = (p: number): string | null => {
    if (p === 0) {
      if (!form.titulo.trim()) return "Ponle un título al tardeo.";
      if (!form.fecha) return "Falta la fecha del tardeo.";
      if (form.fecha < hoy) return "La fecha ya ha pasado. Pon una fecha de hoy en adelante.";
      if (!form.horaInicio) return "Falta la hora de inicio.";
      // Sin esto, elegir "cada semana" y no poner el hasta creaba UN tardeo sin
      // decir nada, que es lo contrario de lo que acaba de pedir.
      if (periodicidad.cada !== "una" && !periodicidad.hasta) return "Dinos hasta cuándo se repite, o elige «No se repite».";
    }
    if (p === 1) {
      // Sin sitio, el tardeo de un promotor entraría sin coordenadas y no saldría
      // en el mapa, que es medio producto.
      if (esPromotor && !dirTardeo) return "Busca dónde se hace este tardeo.";
      const e = errorPrecio(precio);
      if (e) return e;
    }
    return null;
  };

  const siguiente = () => {
    const e = faltaEnPaso(paso);
    if (e) { setError(e); return; }
    setError("");
    setPaso(paso + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const publicar = async (aunqueParezcaDuplicado = false) => {
    if (!user || !local) {
      setError(
        esAdmin
          ? "Elige en qué local se publica el tardeo."
          : "Necesitas un local para publicar. Créalo primero."
      );
      return;
    }

    // --- Validación antes de publicar (por si se volvió atrás y se cambió algo) ---
    for (const p of [0, 1]) {
      const e = faltaEnPaso(p);
      if (e) { setError(e); setPaso(p); return; }
    }

    const ec = errorProgramacion(cuando);
    if (ec) { setErrorCuando(ec); setError(""); return; }

    setPublicando(true); setError("");

    // Duplicados (dossier pág. 11): mismo local o sitio, misma fecha y nombre
    // parecido. Se avisa con enlace al existente; publicar igualmente es una
    // decisión explícita. Si no se puede comprobar (lote 68), no se bloquea.
    if (!aunqueParezcaDuplicado) {
      const dup = await buscarDuplicados({
        localId: local.id, fechas: fechasDeSerie(form.fecha, periodicidad), titulo: form.titulo,
        lat: dirTardeo?.lat ?? local.lat, lng: dirTardeo?.lng ?? local.lng,
      });
      if (dup.filas.length) { setDuplicados(dup.filas); setPublicando(false); return; }
    }
    setDuplicados(null);

    // Guardar el flyer en Supabase Storage
    let flyer_url = flyerOriginal ?? "/flyers/placeholder.jpg";
    if (archivoSubido) {
      // subirFlyer reduce la imagen antes (máx. 1600 px) y no lanza.
      const url = await subirFlyer(user.id, archivoSubido);
      if (!url) { setError("No se pudo subir el flyer. Inténtalo de nuevo."); setPublicando(false); return; }
      flyer_url = url;
    }

    /**
     * Una fila por fecha. Un tardeo que no se repite son las mismas líneas con
     * una sola fecha, así que no hay dos caminos que mantener.
     */
    const fechas = fechasDeSerie(form.fecha, periodicidad);
    const comun = {
      local_id: local.id,
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      hora_inicio: form.horaInicio,
      hora_fin: form.horaFin || null,
      // El promotor pone el sitio en cada tardeo; el local lo hereda del suyo.
      direccion: dirTardeo?.display ?? form.ubicacion ?? local.direccion,
      lat: dirTardeo?.lat ?? local.lat,
      lng: dirTardeo?.lng ?? local.lng,
      zona: dirTardeo?.zona ?? local.zona,
      estilo: form.estilo,
      // Las tres columnas de precio más los dos enlaces salen del componente.
      ...aColumnas(precio),
      // Plazas (lote 48): solo se manda si se ha puesto, para no romper el alta si el lote aún no está pegado.
      ...(precio.modo === "gratis" && Number(aforo) > 0 ? { aforo: Number(aforo) } : {}),
      etiquetas: promo.etiquetas.length ? promo.etiquetas : null,
      flyer_url,
      // 'ia' si el flyer pasó por la lectura con IA; 'subido' si se subió tal
      // cual; null si no hay flyer (la columna admite null, lote 1).
      flyer_origen: archivoSubido ? (rellenoIA ? "ia" : "subido") : flyerOriginal ? "subido" : null,
      // El ADN del paso 3. Se guardan igual que en el editor: null y no []
      // cuando está vacío, para que «sin indicar» no parezca «revisado».
      tipo_evento: tipoEvento || null,
      ambiente: ambiente.length ? ambiente : null,
      publico: publico.length ? publico : null,
      dress_code: dressCode || null,
      // Lo que dijo ProgramarPublicacion, que hasta ahora se recogía y se
      // tiraba: el insert ponía "publicado" fijo, así que elegir "Programar" o
      // "Guardar sin publicar" publicaba igual, en el acto. El botón hasta
      // cambiaba de nombre. La pantalla de editar sí lo hacía bien.
      estado: cuando.estado,
      publicar_en: cuando.estado === "programado" && cuando.publicarEn
        ? new Date(cuando.publicarEn).toISOString()
        : null,
      created_by: user.id,
    };

    // Las fechas de una serie comparten `serie_id` (lote 53): así luego se
    // pueden cambiar todas a la vez desde el editor.
    let filas: Record<string, unknown>[] = fechas.map((fecha) => ({ ...comun, fecha }));
    if (fechas.length > 1) {
      const serie = crypto.randomUUID();
      filas = filas.map((f) => ({ ...f, serie_id: serie }));
    }
    const insertar = (f: Record<string, unknown>[]) => supabase.from("tardeos").insert(f).select("id");
    const quitar = (f: Record<string, unknown>[], col: string) =>
      f.map((x) => { const y = { ...x }; delete y[col]; return y; });

    // El código de «columna inexistente» es el mismo para todas: se mira
    // también que el mensaje nombre ESA columna, para quitar la que toca.
    const faltaColumna = (e: { code?: string; message?: string } | null, col: string) =>
      falloPorColumna(e, col) && (e?.message ?? "").includes(col);
    let { data: nuevos, error } = await insertar(filas);
    const notas: string[] = [];
    // Columnas de lotes que pueden no estar pegados: se reintenta sin ellas y
    // se dice qué se ha perdido, en vez de no crear nada. Sin hablar de lotes:
    // quien lo lee es el local, no nosotros (eso lo avisa /admin/salud).
    for (let i = 0; i < 2 && error; i++) {
      if (faltaColumna(error, "serie_id") && "serie_id" in (filas[0] ?? {})) {
        filas = quitar(filas, "serie_id");
        notas.push("Las fechas se han creado sueltas: por ahora no se pueden cambiar todas a la vez.");
      } else if (faltaColumna(error, "aforo") && "aforo" in (filas[0] ?? {})) {
        filas = quitar(filas, "aforo");
        notas.push("Las plazas no se han guardado todavía: el tardeo queda sin límite de plazas.");
      } else break;
      ({ data: nuevos, error } = await insertar(filas));
    }

    if (error) { setPublicando(false); setError(mensajeAmable(error)); return; }
    setAvisos(notas);
    borrarBorrador();

    // Vincular los DJs (por nombre) en TODAS las fechas: si solo se enlazara la
    // primera, el DJ vería un tardeo suyo de cinco en su perfil. Una sola
    // llamada para toda la serie (antes, una por fecha).
    if (form.dj && nuevos?.length) {
      const nombres = form.dj.split(/[,·&]|\sy\s/i);
      try {
        const res = await vincularDjsPorNombre(nuevos.map((n) => n.id), nombres);
        setDjsSinFicha(res.sinFicha);
      } catch { /* no crítico: los tardeos ya están creados */ }
    }
    setCreados(fechas.length);

    setPublicando(false);
    invalidarCacheTardeos(); // que el listado y el mapa lo vean ya
    setEstado("publicado");
    window.scrollTo({ top: 0 });
  };

  // El admin que no trabaja sobre una ficha concreta llega desde /admin y
  // ahí debe volver.
  const panelHref = esAdmin && (!ficha || ajena) ? "/admin" : enlace("/local/tardeos");

  /**
   * Cuántos tardeos va a crear el botón.
   *
   * La previsualización de la serie está en el paso 1, y publicar es en el 3:
   * quien elige "cada semana hasta diciembre" ve las fechas, cruza dos
   * pantallas más y llega a un botón que pone «Publicar». Nada le recuerda
   * que son dieciséis, y dieciséis tardeos mal creados se borran uno a uno.
   *
   * Se recalcula aquí en vez de arrastrar el número desde el paso 1 porque el
   * usuario puede volver atrás y cambiar la fecha: un número guardado se
   * quedaría viejo y mentiría justo en el momento de pulsar.
   */
  const fechasSerie = fechasDeSerie(form.fecha, periodicidad);
  const enSerie = periodicidad.cada !== "una" && fechasSerie.length > 1;
  // La imagen elegida (aún sin subir) para la vista previa.
  const urlFlyer = useMemo(() => (archivoSubido ? URL.createObjectURL(archivoSubido) : flyerOriginal), [archivoSubido, flyerOriginal]);
  useEffect(() => () => { if (archivoSubido && urlFlyer) URL.revokeObjectURL(urlFlyer); }, [archivoSubido, urlFlyer]);

  const empezarOtro = () => {
    setForm({ ...EXTRAIDO, ubicacion: local?.direccion ?? "", zona: local?.zona ?? "" });
    setPeriodicidad(SIN_REPETIR); setPrecio(PRECIO_VACIO); setAforo(""); setPromo(PROMO_VACIA);
    setTipoEvento(""); setAmbiente([]); setPublico([]); setDressCode("");
    setArchivoSubido(null); setFlyerDecidido(false); setRellenoIA(false); setRevisar(new Set());
    setDjsSinFicha([]); setDirTardeo(null); setPaso(0); setCuando({ estado: "publicado", publicarEn: "" }); setErrorCuando("");
    setFlyerOriginal(null); setDuplicando(null); setAvisos([]); setDuplicados(null); setRecuperado(false);
    borrarBorrador();
    setEstado("revisar");
  };

  // ---------- Publicado ----------
  if (estado === "publicado") {
    // Un tardeo de una ficha sin aprobar no sale en la web aunque esté
    // «publicado». Antes se decía a la vez «ya está visible» y «se verá cuando
    // aprobemos»: ahora un solo mensaje, el que es verdad.
    const sinAprobar = cuando.estado !== "borrador" && !!local?.estado && local.estado !== "activo";
    return (
      <SeccionPanel titulo="Crear tardeo" ancho="estrecho">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-linea bg-white p-6 text-center shadow-tarjeta md:p-10">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-ok-fondo text-ok">
            <Check size={36} aria-hidden />
          </span>
          {/* El texto sigue a lo que ha pasado de verdad: cuántos y en qué
              estado. Antes decía "¡Tardeo publicado!" siempre, y con la
              programación arreglada eso sería mentira en dos de los tres
              caminos, además de contar mal las series. */}
          <h2 className="text-2xl font-bold">
            {sinAprobar
              ? (creados > 1 ? `${creados} tardeos listos` : "Tardeo listo")
              : creados > 1
              ? `${creados} tardeos ${cuando.estado === "borrador" ? "guardados" : cuando.estado === "programado" ? "programados" : "publicados"}`
              : cuando.estado === "borrador"
                ? "Tardeo guardado"
                : cuando.estado === "programado"
                  ? "Tardeo programado"
                  : "Tardeo publicado"}
          </h2>
          <p className="text-[16px] text-tinta-suave">
            {sinAprobar
              ? <>«{form.titulo}» {creados > 1 ? "están guardados" : "está guardado"}, pero aún no {creados > 1 ? "se ven" : "se ve"} en la web: {creados > 1 ? "saldrán" : "saldrá"} en cuanto aprobemos tu ficha. Lo revisamos a mano; mientras, solo lo ves tú en tu panel.</>
              : cuando.estado === "borrador"
              ? <>«{form.titulo}» queda guardado sin publicar. Puedes seguir cuando quieras.</>
              : cuando.estado === "programado"
                ? <>«{form.titulo}» {creados > 1 ? "saldrán solos" : "saldrá solo"} a la hora que has puesto.</>
                : <>«{form.titulo}» ya {creados > 1 ? "están visibles" : "está visible"} para la gente de {form.zona || "tu zona"}.</>}
          </p>
          {esAdmin && local && (
            <p className="-mt-2 text-[15px] text-tinta-suave">En {local.nombre}.</p>
          )}

          {/* Sin aprobar: además del texto, una marca visible para que el
              local no lo busque en la web y crea que ha fallado. */}
          {sinAprobar && (
            <p className="flex w-full items-center gap-2 rounded-xl border border-aviso/25 bg-aviso-fondo p-4 text-left text-[15px] font-semibold text-tinta">
              <Clock size={18} className="shrink-0 text-aviso" aria-hidden /> Pendiente de aprobar tu ficha
            </p>
          )}

          {avisos.map((a) => (
            <p key={a} className="flex w-full items-start gap-2 rounded-xl border border-aviso/25 bg-aviso-fondo p-4 text-left text-[15px] text-tinta">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-aviso" aria-hidden /> {a}
            </p>
          ))}

          {djsSinFicha.length > 0 && (
            <div className="w-full rounded-xl border border-aviso/25 bg-aviso-fondo p-4 text-left">
              <p className="font-bold">
                {djsSinFicha.length === 1 ? "Este DJ no tiene ficha" : "Estos DJs no tienen ficha"}:{" "}
                {djsSinFicha.join(", ")}
              </p>
              <p className="mt-1 text-[15px] text-tinta">
                El tardeo está guardado, pero no saldrá en su perfil hasta que exista.
                {esAdmin ? " Créala en Administración → Crear nuevo." : " Dínoslo desde Ayuda y la creamos."}
              </p>
            </div>
          )}
          <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href={panelHref} className={claseBoton("primario")}>
              {esAdmin && (!ficha || ajena) ? "Volver al admin" : "Ver mis tardeos"}
            </Link>
            <Boton variante="contorno" onClick={empezarOtro}>Crear otro</Boton>
          </div>
        </div>
      </SeccionPanel>
    );
  }

  return (
    <SeccionPanel
      titulo="Crear tardeo"
      descripcion="Tres pasos. Con el flyer y la IA, en un minuto."
      ancho="estrecho"
    >
      <div className="flex flex-col gap-5">
        {/* Selector de local: solo para admin, que publica en nombre de otros.
            Va arriba y visible en todos los pasos porque de él salen la
            dirección y las coordenadas con las que acabará el tardeo. */}
        {esAdmin && (
          <div className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
            <p className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
              <Store size={18} className="text-magenta" aria-hidden /> Publicar en
            </p>
            {locales.length === 0 ? (
              <p className="text-[15px] text-tinta-suave">
                No hay locales todavía.{" "}
                <Link href="/admin/crear" className="font-semibold text-magenta-700 underline">Crea uno primero</Link>.
              </p>
            ) : (
              <>
                <SelectorLocal locales={locales} valor={localId} onCambio={setLocalId} />
                {local && !esPromotor && !(local.lat && local.lng) && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-aviso">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                    Este local no tiene coordenadas: el tardeo no saldrá en el mapa.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Procesando */}
        {estado === "procesando" && (
          <section className="flex flex-col items-center gap-4 rounded-2xl border border-linea bg-white py-16 text-center shadow-tarjeta" aria-live="polite">
            <Loader2 size={44} className="animate-spin text-magenta" aria-hidden />
            <p className="text-xl font-bold">Leyendo tu flyer…</p>
            <p className="text-[15px] text-tinta-suave">La IA está sacando los datos. Un momento.</p>
          </section>
        )}

        {estado === "revisar" && (
          <>
            {/* Tres pasos en vez de un formulario de veinte campos: el que
                publica un tardeo lo hace desde el móvil y con prisa, y una
                pantalla que hay que recorrer entera antes de ver el botón se
                abandona a la mitad. */}
            <ol className="grid grid-cols-3 gap-2" aria-label="Pasos">
              {PASOS.map((p, i) => {
                const hecho = i < paso;
                const actual = i === paso;
                return (
                  <li key={p.t}>
                    <button
                      type="button"
                      // Se puede volver atrás tocando el paso, pero no saltar
                      // hacia delante sin pasar la comprobación del actual.
                      onClick={() => (i < paso ? setPaso(i) : i === paso + 1 ? siguiente() : undefined)}
                      aria-current={actual ? "step" : undefined}
                      className={`flex w-full flex-col items-start gap-1 rounded-xl border-t-4 bg-white p-2.5 text-left shadow-tarjeta ${
                        actual ? "border-magenta" : hecho ? "border-ok" : "border-linea"}`}
                    >
                      <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${actual ? "text-magenta-700" : "text-tinta-suave"}`}>
                        {hecho ? <Check size={14} aria-hidden /> : null} Paso {i + 1}
                      </span>
                      <span className="text-[14px] font-bold leading-tight sm:text-[15px]">{p.t}</span>
                      <span className="hidden text-[13px] text-tinta-suave sm:block">{p.d}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <section className="flex flex-col gap-5 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-6">
              {paso === 0 && (
                <>
                  {/* El flyer, aquí y no en una pantalla anterior. Es opcional:
                      se puede publicar sin él —se guarda un marcador— y se
                      puede añadir después de haber escrito medio formulario,
                      que es como pasa de verdad cuando el diseño llega tarde. */}
                  {recuperado && (
                    <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-marfil-100 p-3 text-[15px]">
                      <span>Hemos recuperado lo que estabas escribiendo.</span>
                      <button type="button" onClick={empezarOtro} className="min-h-[44px] font-bold text-magenta-700">Empezar de cero</button>
                    </p>
                  )}
                  {duplicando && (
                    <p className="flex items-start gap-2 rounded-xl bg-magenta-50 p-3 text-[15px] font-semibold text-magenta-700">
                      <Copy size={18} className="mt-0.5 shrink-0" aria-hidden />
                      Copia de «{duplicando.titulo}». Pon la fecha nueva y revisa lo demás.
                    </p>
                  )}
                  {flyerOriginal && !archivoSubido && (
                    <div className="flex items-center gap-3 rounded-xl bg-marfil-100 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={flyerOriginal} alt="" className="h-[70px] w-14 shrink-0 rounded-lg object-cover" />
                      <p className="text-[15px]">Se usará el mismo flyer. Si tienes uno nuevo, súbelo aquí debajo.</p>
                    </div>
                  )}
                  <SubirFlyer
                    archivo={archivoSubido}
                    onArchivo={(f) => { setArchivoSubido(f); setFlyerDecidido(false); setRellenoIA(false); }}
                    onAnalizar={() => archivoSubido && leerFlyer(archivoSubido)}
                    onSoloSubir={() => setFlyerDecidido(true)}
                    decidido={flyerDecidido}
                  />

                  {archivoSubido && flyerDecidido && (
                    <p className={`flex items-start gap-2 rounded-xl p-3 text-[15px] font-semibold ${rellenoIA ? "bg-ok-fondo text-ok" : "bg-marfil-100 text-tinta"}`}>
                      <Sparkles size={18} className="mt-0.5 shrink-0" aria-hidden />
                      {rellenoIA
                        ? revisar.size
                          ? "La IA ha rellenado lo que ha podido. Revisa lo marcado en amarillo."
                          : "La IA ha rellenado los datos. Échales un vistazo antes de seguir."
                        : "Flyer listo. Rellena los datos a mano."}
                    </p>
                  )}

                  <Campo etiqueta="Título" htmlFor="titulo">
                    <input id="titulo" value={form.titulo} onChange={(e) => set("titulo", e.target.value)}
                      placeholder="Ej: Tardeo Remember con DJ Nando" className={claseRevisar(revisar.has("titulo"))} />
                  </Campo>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo etiqueta="Fecha" htmlFor="fecha" ayuda={revisar.has("fecha") ? "Revísala: no se leía clara." : undefined}>
                      <input id="fecha" type="date" min={hoy} value={form.fecha} onChange={(e) => set("fecha", e.target.value)}
                        className={claseRevisar(revisar.has("fecha"))} />
                    </Campo>
                    <Campo etiqueta="Estilo de música" htmlFor="estilo">
                      <input id="estilo" value={form.estilo} onChange={(e) => set("estilo", e.target.value)}
                        placeholder="Remember, reggaeton…" className={claseRevisar(revisar.has("estilo"))} />
                    </Campo>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo etiqueta="Empieza" htmlFor="ini">
                      <input id="ini" type="time" value={form.horaInicio} onChange={(e) => set("horaInicio", e.target.value)}
                        className={claseRevisar(revisar.has("horaInicio"))} />
                    </Campo>
                    <Campo etiqueta="Acaba (opcional)" htmlFor="fin" ayuda={revisar.has("horaFin") ? "Revísala: no se leía clara." : undefined}>
                      <input id="fin" type="time" value={form.horaFin} onChange={(e) => set("horaFin", e.target.value)}
                        className={claseRevisar(revisar.has("horaFin"))} />
                    </Campo>
                  </div>
                  <DjsCartel valor={form.dj} onCambio={(v) => set("dj", v)} revisar={revisar.has("dj")} />
                  <Campo etiqueta="Descripción (opcional)" htmlFor="desc">
                    <textarea id="desc" value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} rows={3}
                      placeholder="Qué se va a encontrar quien venga." className={`${claseCampo} resize-y`} />
                  </Campo>
                  <PeriodicidadTardeo fecha={form.fecha} valor={periodicidad} onCambio={setPeriodicidad} />
                </>
              )}

              {paso === 1 && (
                <>
                  {/* Un local ya tiene dirección fija; un promotor cambia de
                      sitio cada finde, así que a él se le pide siempre buscarla
                      en el mapa y con coordenadas de verdad. */}
                  <div>
                    <p className="mb-1.5 flex items-center gap-2 text-[15px] font-semibold">
                      <MapPin size={18} className="text-magenta" aria-hidden /> {esPromotor ? "¿Dónde se hace este tardeo?" : "Sitio del tardeo"}
                    </p>
                    {esPromotor ? (
                      <>
                        <AddressSearch onSelect={setDirTardeo} />
                        <p className="mt-1.5 text-sm text-tinta-suave">
                          Como organizas en sitios distintos, cada tardeo lleva su dirección. De aquí salen
                          el punto del mapa y la zona de los filtros.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mb-2 rounded-xl bg-marfil-100 px-4 py-3 text-[15px]">
                          {dirTardeo?.display ?? (form.ubicacion || "Tu local no tiene dirección todavía.")}
                        </p>
                        <p className="mb-2 text-sm text-tinta-suave">
                          Por defecto, la dirección de tu local. Si este tardeo es en otro sitio, búscalo:
                        </p>
                        {/* Arranca con el nombre del local escrito: así al abrirlo
                            ya salen sus resultados y no hay que teclearlo. Es lo
                            que hace que un bar encuentre su propia ficha con la
                            calle y el número, en vez de escribirlos a mano. */}
                        <AddressSearch
                          inicial={local?.nombre ?? ""}
                          onSelect={setDirTardeo}
                          placeholder="Busca el sitio por su nombre o por la calle…"
                        />
                      </>
                    )}
                  </div>

                  <hr className="border-linea" />
                  <PrecioTardeo valor={precio} onCambio={setPrecio} />
                  {precio.modo === "gratis" && <CampoAforo valor={aforo} onCambio={setAforo} />}
                  <hr className="border-linea" />
                  <PromoTardeo valor={promo} onCambio={setPromo} />
                </>
              )}

              {paso === 2 && (
                <>
                  {/* Aquí se decidía nada de esto hasta ahora: los cuatro
                      criterios del ADN no llegaron nunca a este formulario, así
                      que un tardeo creado aquí nacía sin tipo, sin ambiente, sin
                      público y sin outfit — invisible para los filtros nuevos. */}
                  <div>
                    <p className="text-[17px] font-bold">Cómo es el tardeo</p>
                    <p className="mb-3 text-sm text-tinta-suave">Opcional, pero con esto te encuentran en los filtros y te recomendamos a quien encaja.</p>
                    <SelectorAdn
                      tipoEvento={tipoEvento} ambiente={ambiente} publico={publico} dressCode={dressCode}
                      onTipoEvento={setTipoEvento} onAmbiente={setAmbiente}
                      onPublico={setPublico} onDressCode={setDressCode}
                    />
                  </div>
                  <hr className="border-linea" />
                  <ProgramarPublicacion valor={cuando} error={errorCuando}
                    onCambio={(c) => { setCuando(c); setErrorCuando(""); }} />

                  {/* Lo que va a pasar al pulsar, en el paso en el que se
                      pulsa. No sustituye a la previsualización del paso 1:
                      allí se eligen las fechas, aquí se confirma el bulto. */}
                  {enSerie && (
                    <div className="rounded-xl border border-aviso/25 bg-aviso-fondo p-4">
                      <p className="flex items-center gap-2 text-lg font-bold">
                        <Repeat size={18} className="shrink-0 text-aviso" aria-hidden />
                        Se crearán {fechasSerie.length} tardeos
                      </p>
                      <p className="mt-1 text-[15px] leading-relaxed text-tinta">
                        {fechasSerie.map(fechaCorta).join(" · ")}
                      </p>
                      <p className="mt-2 text-sm text-tinta-suave">
                        Cada uno se crea por separado. Si no es lo que quieres, vuelve al
                        primer paso y cambia la repetición.
                      </p>
                    </div>
                  )}
                </>
              )}

              {error && <p role="alert" className="rounded-xl border border-error/20 bg-error-fondo p-3 text-[15px] font-semibold text-error">{error}</p>}

              {duplicados && duplicados.length > 0 && (
                <div role="alert" className="rounded-xl border border-aviso/25 bg-aviso-fondo p-4">
                  <p className="flex items-center gap-2 text-[16px] font-bold"><AlertTriangle size={18} className="text-aviso" aria-hidden /> Puede que ya exista</p>
                  <p className="mt-1 text-[15px]">Hay {duplicados.length === 1 ? "un evento parecido" : `${duplicados.length} eventos parecidos`} el mismo día y en el mismo sitio:</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {duplicados.map((d) => (
                      <li key={d.id}>
                        <Link href={d.mismo_local ? enlace(`/local/tardeos/${d.id}/editar`) : `/tardeos/${d.id}`} target="_blank"
                          className="text-[15px] font-semibold text-magenta-700 underline underline-offset-2">
                          {d.titulo}
                        </Link>
                        <span className="text-[15px] text-tinta-suave"> · {fechaCorta(d.fecha)}{d.hora_inicio ? ` ${d.hora_inicio.slice(0, 5)}` : ""} · {d.local_nombre}{d.estado === "borrador" ? " (borrador)" : ""}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Boton variante="contorno" tamano="pequeno" onClick={() => setDuplicados(null)}>Revisar mis datos</Boton>
                    <Boton tamano="pequeno" onClick={() => publicar(true)} cargando={publicando}>Es otro evento: publicar igualmente</Boton>
                  </div>
                </div>
              )}

              <div className="flex gap-2 border-t border-linea pt-4">
                <Boton
                  variante="contorno"
                  onClick={() => { setError(""); if (paso === 0) router.push(panelHref); else setPaso(paso - 1); }}
                >
                  {paso === 0 ? "Cancelar" : <><ArrowLeft size={18} aria-hidden /> Atrás</>}
                </Boton>
                {paso < PASOS.length - 1 ? (
                  <Boton ancho onClick={siguiente}>
                    Siguiente <ArrowRight size={20} aria-hidden />
                  </Boton>
                ) : (
                  <Boton ancho onClick={() => publicar()} cargando={publicando}>
                    {!publicando && <Check size={20} aria-hidden />}
                    {cuando.estado === "programado" ? "Programar" : cuando.estado === "borrador" ? "Guardar borrador" : "Publicar"}
                    {enSerie && ` ${fechasSerie.length} tardeos`}
                  </Boton>
                )}
              </div>
              {/* Como en el vídeo: «Ver vista previa» y «Necesito ayuda» en
                  cualquier paso, sin perder lo escrito. */}
              <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-between">
                <Boton variante="suave" onClick={() => setVista(true)}><Eye size={18} aria-hidden /> Ver vista previa</Boton>
                {user && (
                  <AyudaBorrador userId={user.id} referencia={`borrador:${local?.id ?? "sin-local"}`}
                    borrador={{ ...form, fechas: fechasSerie, precio, aforo, local: local?.nombre ?? null }} />
                )}
              </div>
            </section>
            <VistaPrevia abierta={vista} onCerrar={() => setVista(false)}
              d={{
                titulo: form.titulo, descripcion: form.descripcion, fecha: form.fecha, horaInicio: form.horaInicio, horaFin: form.horaFin,
                lugar: dirTardeo?.display ?? form.ubicacion, zona: dirTardeo?.zona ?? form.zona,
                djs: form.dj.split(/[,·&]|\sy\s/i).map((x) => x.trim()).filter(Boolean),
                precio, flyer: urlFlyer, fechas: fechasSerie,
              }}
              onPublicar={paso === PASOS.length - 1 ? () => { setVista(false); void publicar(); } : undefined}
              textoPublicar={cuando.estado === "programado" ? "Programar" : cuando.estado === "borrador" ? "Guardar borrador" : "Publicar"} />
          </>
        )}
      </div>
    </SeccionPanel>
  );
}
