"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { invalidarDatosCuenta } from "@/components/panel/CuentaNav";
import SelectorEstilos from "@/components/SelectorEstilos";
import AddressSearch, { Direccion } from "@/components/AddressSearch";
import Boton, { claseBoton } from "@/components/Boton";
import Campo, { claseCampo } from "@/components/ui/Campo";
import AltaPortal from "@/components/cuenta/AltaPortal";
import {
  PartyPopper, Store, Disc3, ArrowRight, ArrowLeft, Check, Loader2, Megaphone, MapPin,
} from "lucide-react";
import { MARCA } from "@/lib/marca";

/**
 * Alta de colaborador en tres caminos: tardícola, DJ, o local/evento.
 *
 * "Local o evento" se abre en dos (con sitio fijo / en sitios distintos)
 * porque en la base son lo mismo (`locales`) con `tipo` distinto: lo único
 * que cambia es si se pide dirección.
 */
type Paso = "rol" | "local-tipo" | "local" | "promotor" | "dj" | "fin";

function pasoInicial(rol: string | null): Paso {
  if (rol === "local") return "local-tipo";
  if (rol === "promotor") return "promotor";
  if (rol === "dj") return "dj";
  return "rol";
}

function UnirseContent() {
  const { user, loading } = useAuth();
  const rolParam = useSearchParams().get("rol");
  const [paso, setPaso] = useState<Paso>(pasoInicial(rolParam));
  const [finRol, setFinRol] = useState("");

  // Local / promotor
  const [nombreLocal, setNombreLocal] = useState("");
  const [tel, setTel] = useState("");
  const [dir, setDir] = useState<Direccion | null>(null);
  // DJ
  const [nombreDj, setNombreDj] = useState("");
  const [estilos, setEstilos] = useState<string[]>([]);
  const [bio, setBio] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  // null = todavía no lo sabemos. Sin esto, si la consulta tarda o falla, la
  // página ofrece crear una ficha que ya existe y salen duplicados.
  // Se mira cada tipo por separado: tener local no impide ser también DJ (y al
  // revés). Lo que no se deja es crear un segundo local o un segundo DJ.
  const [yaTiene, setYaTiene] = useState<{ local: boolean; dj: boolean } | null>(null);

  useEffect(() => {
    // Mientras la sesión carga, `user` es null aunque haya cuenta: decidir ya
    // enseñaría el formulario a quien ya tiene ficha.
    if (loading) return;
    if (!user) { setYaTiene({ local: false, dj: false }); return; }
    setYaTiene(null);
    let vivo = true;
    (async () => {
      const [l, d] = await Promise.all([
        supabase.from("locales").select("id,tipo").eq("owner_id", user.id).limit(1).maybeSingle(),
        supabase.from("djs").select("id").eq("profile_id", user.id).limit(1).maybeSingle(),
      ]);
      // Ante la duda no dejamos crear: es más fácil recuperarse de "no puedo
      // crear" que de dos fichas duplicadas en la base.
      if (vivo) setYaTiene({ local: Boolean(l.error || l.data), dj: Boolean(d.error || d.data) });
    })();
    return () => { vivo = false; };
  }, [user, loading]);

  /** Volver un paso: lo que antes era un enlace a "#" que no hacía nada. */
  const pasoAnterior: Paso | null =
    paso === "local" || paso === "promotor" ? (rolParam === "promotor" && paso === "promotor" ? null : "local-tipo")
      : paso === "local-tipo" || paso === "dj" ? "rol"
      : null;

  if (!loading && !user) {
    // Sin cuenta no hay a quién colgar la ficha: se presenta el portal (o se
    // elige tipo) y se manda a crear la cuenta con el tipo ya marcado; al
    // terminar, /perfil devuelve aquí con ?rol= para seguir con la ficha.
    const rol = rolParam === "dj" || rolParam === "local" || rolParam === "promotor" ? rolParam : null;
    return <AltaPortal rol={rol} />;
  }

  // Mientras no sepamos si ya tiene ficha, no se enseña el formulario: por
  // ese hueco se colaba el duplicado.
  if (loading || yaTiene === null) {
    return <main className="flex items-center justify-center gap-2 pt-24 text-tinta-suave"><Loader2 className="animate-spin" aria-hidden /> Cargando…</main>;
  }

  // Ya tiene una ficha DEL MISMO TIPO que quiere crear: en vez de dejarle
  // hacer otra, se le lleva a la suya (y se le ofrece la otra).
  const quiereLocal = paso === "local-tipo" || paso === "local" || paso === "promotor";
  const quiereDj = paso === "dj";
  if (paso !== "fin" && ((quiereLocal && yaTiene.local) || (quiereDj && yaTiene.dj))) {
    return (
      <Final
        titulo={quiereLocal ? "Ya tienes tu local o evento" : "Ya tienes perfil de DJ"}
        texto={quiereLocal
          ? "Tu ficha ya existe: gestiónala desde tu panel, no hace falta crearla otra vez."
          : "Tu perfil de DJ ya existe: gestiónalo desde tu panel."}
        href={quiereLocal ? "/local" : "/dj"}
        boton="Ir a mi panel"
        otra={quiereLocal && !yaTiene.dj
          ? { label: "Crear también mi perfil de DJ", onClick: () => setPaso("dj") }
          : quiereDj && !yaTiene.local
            ? { label: "Crear también un local o evento", onClick: () => setPaso("local-tipo") }
            : undefined}
      />
    );
  }

  const crearLocal = async () => {
    if (!nombreLocal.trim()) { setError("Escribe el nombre del local."); return; }
    if (!dir) { setError("Busca la dirección y elígela de la lista."); return; }
    setGuardando(true); setError("");
    const { error } = await supabase.from("locales").insert({
      owner_id: user!.id, nombre: nombreLocal.trim(), telefono: tel.trim(),
      direccion: dir.display, lat: dir.lat, lng: dir.lng,
      codigo_postal: dir.cp, zona: dir.zona, estado: "borrador", tipo: "local",
    });
    setGuardando(false);
    if (error) setError("No se pudo crear: " + error.message);
    else { invalidarDatosCuenta(user!.id); setFinRol("local"); setPaso("fin"); }
  };

  /**
   * El promotor comparte tabla con el local: misma ficha con `tipo` distinto
   * y SIN dirección; el sitio lo pone cada tardeo al publicarlo.
   */
  const crearPromotor = async () => {
    if (!nombreLocal.trim()) { setError("Escribe el nombre con el que organizas."); return; }
    setGuardando(true); setError("");
    const { error } = await supabase.from("locales").insert({
      owner_id: user!.id, nombre: nombreLocal.trim(), telefono: tel.trim(),
      estado: "borrador", tipo: "promotor",
    });
    setGuardando(false);
    if (error) setError("No se pudo crear: " + error.message);
    else { invalidarDatosCuenta(user!.id); setFinRol("promotor"); setPaso("fin"); }
  };

  const crearDj = async () => {
    if (!nombreDj.trim()) { setError("Escribe tu nombre artístico."); return; }
    setGuardando(true); setError("");
    const { error } = await supabase.from("djs").insert({
      profile_id: user!.id, nombre_artistico: nombreDj.trim(), estilos, bio: bio.trim(),
    });
    setGuardando(false);
    if (error) setError("No se pudo crear: " + error.message);
    else { invalidarDatosCuenta(user!.id); setFinRol("dj"); setPaso("fin"); }
  };

  if (paso === "fin") {
    const titulo = finRol === "local" ? "¡Local creado!" : finRol === "promotor" ? "¡Perfil de eventos creado!" : "¡Perfil de DJ creado!";
    const texto = finRol === "local"
      ? `Aún no sale en la web: el equipo de ${MARCA.nombre} lo revisa y lo publica. Mientras, ya puedes preparar tus tardeos desde tu panel.`
      : finRol === "promotor"
        ? `Aún no sale en la web: el equipo de ${MARCA.nombre} lo revisa y lo publica. Al crear cada tardeo te pediremos dónde se hace.`
        : "Ya sales en el listado de DJs. Completa tu perfil (foto, estilos, sesiones) para que se vea bien.";
    // Local y promotor comparten panel; el DJ tiene el suyo.
    return <Final titulo={titulo} texto={texto} href={finRol === "dj" ? "/dj" : "/local"} boton="Ir a mi panel" />;
  }

  const numPaso = paso === "rol" ? 1 : paso === "local-tipo" ? 2 : 3;
  const totalPasos = paso === "dj" ? 2 : 3;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-12 pt-4 md:px-8 md:pt-10">
      <div className="mb-4 flex min-h-tacto items-center justify-between gap-2">
        {pasoAnterior ? (
          <button
            type="button"
            onClick={() => { setPaso(pasoAnterior); setError(""); }}
            className="-ml-2 inline-flex min-h-tacto items-center gap-1.5 rounded-xl px-2 text-[15px] font-bold text-tinta hover:bg-marfil-100"
          >
            <ArrowLeft size={20} aria-hidden /> Atrás
          </button>
        ) : (
          <Link href="/perfil" className="-ml-2 inline-flex min-h-tacto items-center gap-1.5 rounded-xl px-2 text-[15px] font-bold text-tinta hover:bg-marfil-100">
            <ArrowLeft size={20} aria-hidden /> Mi cuenta
          </Link>
        )}
        {paso !== "rol" && (
          <span className="text-[14px] font-semibold text-tinta-suave">Paso {paso === "dj" ? 2 : numPaso} de {totalPasos}</span>
        )}
      </div>

      {paso === "rol" && (
        <>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-[34px]">¿Cómo quieres usar {MARCA.nombre}?</h1>
          <p className="mt-1 text-[16px] text-tinta-suave">Elige una opción. Con la misma cuenta puedes tener local y perfil de DJ.</p>
          <div className="mt-6 flex flex-col gap-3">
            {/* Va a su cuenta, NO al formulario de gustos: primero ve para qué
                sirve la app y desde su cuenta decide cuándo contarlo. */}
            <Opcion href="/perfil" icono={<PartyPopper size={26} aria-hidden />} titulo="Soy Tardícola" texto="Voy a tardeos y quiero reservar plaza." />
            {yaTiene.dj
              ? <Opcion href="/dj" icono={<Disc3 size={26} aria-hidden />} titulo="Mi perfil de DJ" texto="Ya lo tienes. Toca para ir a tu panel." />
              : <Opcion onClick={() => { setPaso("dj"); setError(""); }} icono={<Disc3 size={26} aria-hidden />} titulo="Soy DJ" texto="Quiero dar a conocer mi música y que los locales me encuentren." />}
            {yaTiene.local
              ? <Opcion href="/local" icono={<Store size={26} aria-hidden />} titulo="Mi local o evento" texto="Ya lo tienes. Toca para ir a tu panel." />
              : <Opcion onClick={() => { setPaso("local-tipo"); setError(""); }} icono={<Store size={26} aria-hidden />} titulo="Soy un Local o Evento" texto={`Quiero publicar mis tardeos en ${MARCA.nombre}.`} />}
          </div>
        </>
      )}

      {paso === "local-tipo" && (
        <>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-[34px]">¿Tienes un sitio fijo?</h1>
          <p className="mt-1 text-[16px] text-tinta-suave">Así sabemos si pedirte la dirección ahora o en cada tardeo.</p>
          <div className="mt-6 flex flex-col gap-3">
            <Opcion onClick={() => { setPaso("local"); setError(""); }} icono={<MapPin size={26} aria-hidden />} titulo="Sí, tengo un local" texto="Bar, terraza, discoteca, club de playa… con dirección fija." />
            <Opcion onClick={() => { setPaso("promotor"); setError(""); }} icono={<Megaphone size={26} aria-hidden />} titulo="No, organizo eventos" texto="Monto fiestas en sitios distintos; el lugar lo pongo en cada tardeo." />
          </div>
        </>
      )}

      {paso === "local" && (
        <Formulario titulo="Datos de tu local" error={error}
          boton={<Boton onClick={crearLocal} cargando={guardando} ancho><Store size={20} aria-hidden /> Crear mi local</Boton>}>
          <Campo etiqueta="Nombre del local" htmlFor="u-nombre">
            <input id="u-nombre" value={nombreLocal} onChange={(e) => setNombreLocal(e.target.value)} placeholder="Sala Blau" className={claseCampo} />
          </Campo>
          <div className="flex flex-col gap-1.5">
            <p className="text-[15px] font-semibold">Dirección</p>
            <AddressSearch onSelect={setDir} />
            {dir ? (
              <p className="flex items-start gap-1.5 text-[15px] font-medium text-ok"><Check size={17} className="mt-0.5 shrink-0" aria-hidden /> {dir.display}</p>
            ) : (
              <p className="text-[14px] text-tinta-suave">Búscala y elígela de la lista. Será la dirección por defecto de tus tardeos.</p>
            )}
          </div>
          <Campo etiqueta="Teléfono (opcional)" htmlFor="u-tel" ayuda="Solo para que el equipo pueda contactarte.">
            <input id="u-tel" type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="600 000 000" className={claseCampo} />
          </Campo>
        </Formulario>
      )}

      {paso === "promotor" && (
        <Formulario titulo="Datos de tus eventos" error={error}
          boton={<Boton onClick={crearPromotor} cargando={guardando} ancho><Megaphone size={20} aria-hidden /> Crear mi perfil de eventos</Boton>}>
          <Campo etiqueta="Nombre con el que organizas" htmlFor="u-nombre-p" ayuda="Es el nombre que verá la gente en cada tardeo que publiques.">
            <input id="u-nombre-p" value={nombreLocal} onChange={(e) => setNombreLocal(e.target.value)} placeholder="Tardeos del Maresme" className={claseCampo} />
          </Campo>
          <Campo etiqueta="Teléfono (opcional)" htmlFor="u-tel-p">
            <input id="u-tel-p" type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="600 000 000" className={claseCampo} />
          </Campo>
          <p className="flex items-start gap-2 rounded-xl bg-marfil-100 p-3 text-[15px] text-tinta-suave">
            <MapPin size={18} className="mt-0.5 shrink-0" aria-hidden />
            No te pedimos dirección: como organizas en sitios distintos, el lugar se elige al crear cada tardeo.
          </p>
        </Formulario>
      )}

      {paso === "dj" && (
        <Formulario titulo="Tu perfil de DJ" error={error}
          boton={<Boton onClick={crearDj} cargando={guardando} ancho><Disc3 size={20} aria-hidden /> Crear mi perfil de DJ</Boton>}>
          <Campo etiqueta="Nombre artístico" htmlFor="u-dj">
            <input id="u-dj" value={nombreDj} onChange={(e) => setNombreDj(e.target.value)} placeholder="DJ Nando" className={claseCampo} />
          </Campo>
          <div className="flex flex-col gap-1.5">
            <p className="text-[15px] font-semibold">Estilos que pinchas</p>
            <div className="flex flex-wrap gap-2">
              <SelectorEstilos valor={estilos} onChange={setEstilos} />
            </div>
          </div>
          <Campo etiqueta="Biografía (opcional)" htmlFor="u-bio" ayuda="Dos o tres frases bastan. La puedes cambiar luego.">
            <textarea id="u-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Cuéntanos quién eres y qué pinchas…" className={claseCampo} />
          </Campo>
        </Formulario>
      )}
    </main>
  );
}

function Opcion({ href, onClick, icono, titulo, texto }: { href?: string; onClick?: () => void; icono: React.ReactNode; titulo: string; texto: string }) {
  const cls = "group flex w-full items-center gap-4 rounded-2xl border border-linea bg-white p-4 text-left shadow-tarjeta transition hover:border-tinta/30 hover:shadow-elevada md:p-5";
  const dentro = (
    <>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta">{icono}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold leading-tight">{titulo}</span>
        <span className="mt-0.5 block text-[15px] text-tinta-suave">{texto}</span>
      </span>
      <ArrowRight className="shrink-0 text-tinta-suave transition group-hover:translate-x-1 group-hover:text-magenta" aria-hidden />
    </>
  );
  return href ? <Link href={href} className={cls}>{dentro}</Link> : <button type="button" onClick={onClick} className={cls}>{dentro}</button>;
}

function Formulario({ titulo, error, boton, children }: { titulo: string; error: string; boton: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-linea bg-white p-5 shadow-tarjeta md:p-7">
      <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-[28px]">{titulo}</h1>
      <div className="mt-5 flex flex-col gap-4">{children}</div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-error-fondo px-3 py-2 text-[15px] font-semibold text-error">{error}</p>}
      <div className="mt-5">{boton}</div>
    </section>
  );
}

function Final({ titulo, texto, href, boton, otra }: { titulo: string; texto: string; href: string; boton: string; otra?: { label: string; onClick: () => void } }) {
  return (
    <main className="mx-auto max-w-lg px-4 pt-10 md:pt-16">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-linea bg-white p-6 text-center shadow-tarjeta md:p-8">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-ok-fondo text-ok"><Check size={34} aria-hidden /></span>
        <h1 className="text-2xl font-bold">{titulo}</h1>
        <p className="text-[16px] text-tinta-suave">{texto}</p>
        <Link href={href} className={claseBoton("primario", "normal", true, "mt-2")}>{boton} <ArrowRight size={20} aria-hidden /></Link>
        {otra && <button type="button" onClick={otra.onClick} className={claseBoton("contorno", "normal", true)}>{otra.label}</button>}
        <Link href="/perfil" className="inline-flex min-h-tacto items-center text-[15px] font-bold text-tinta-suave hover:text-tinta">Volver a mi cuenta</Link>
      </div>
    </main>
  );
}

export default function Unirse() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-semibold text-tinta-suave">Cargando…</div>}>
      <UnirseContent />
    </Suspense>
  );
}
