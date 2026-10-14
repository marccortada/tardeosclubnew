import Image from "next/image";
import { formatFecha, flyerSrc } from "@/lib/formato";
import { getTardeoById, getTardeosPublicadosDeLocal } from "@/lib/tardeos";
import AccionTardeo from "@/components/AccionTardeo";
import Resenas from "@/components/Resenas";
import CompartirBtn from "@/components/CompartirBtn";
import RegistrarVista from "@/components/RegistrarVista";
import MiniMapa from "@/components/MiniMapa";
import DestacarTardeo from "@/components/DestacarTardeo";
import TardeoCard from "@/components/TardeoCard";
import Footer from "@/components/Footer";
import { notFound } from "next/navigation";
import Link from "next/link";
import EnlaceExterno from "@/components/EnlaceExterno";
import DenunciarFlyer from "@/components/DenunciarFlyer";
import type { Metadata } from "next";
import type { Tardeo } from "@/lib/types";
import DatosEstructurados from "@/components/DatosEstructurados";
import { jsonLdEvento, urlAbsoluta } from "@/lib/seo";
import { getPromosDeTardeo } from "@/lib/promociones";
import {
  ArrowLeft, MapPin, Clock, Music, BadgeCheck, Star, CalendarPlus, Sparkles, Users, Shirt, PartyPopper, Tag, Car,
  ShieldCheck, CalendarDays, Gift, ListChecks, Ticket, History, Ban, ArrowRight,
} from "lucide-react";
import { claseBoton } from "@/components/Boton";
import { sinMarcas } from "@/lib/texto";
import { tieneValoracion, valoracion } from "@/lib/reputacion";
import { hoyEnEspana } from "@/lib/fechas";

export const dynamic = "force-dynamic";

function fmtCal(fecha: string, hora: string) {
  return fecha.replace(/-/g, "") + "T" + (hora || "00:00").replace(":", "") + "00";
}
/**
 * El día siguiente, para los tardeos que acaban de madrugada.
 *
 * TODO EN UTC, y no es purismo. Con `new Date(f + "T00:00:00")` el navegador
 * entiende medianoche LOCAL y el +1 no se aplicaba nunca: un tardeo de 22:00 a
 * 02:00 le mandaba a Google Calendar el fin antes que el inicio, y Google
 * descarta el evento sin avisar.
 */
function sumarDia(fechaISO: string) {
  const d = new Date(fechaISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** "12 €", "Gratis", "Por lista"… y debajo qué significa. */
function entradaDe(t: Tardeo): { grande: string; pie: string } {
  if (t.tipoEntrada === "gratis") return { grande: "Gratis", pie: "Entrada libre" };
  if (t.tipoEntrada === "lista") return { grande: t.precio ? `${t.precio} €` : "Por lista", pie: "Con lista" };
  return { grande: t.precio ? `${t.precio} €` : "De pago", pie: t.precio ? "Entrada" : "Precio en la web del evento o en el local" };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const tardeo = await getTardeoById(id);
  if (!tardeo) return { title: "Tardeo no encontrado · TardeosClub" };

  const desc = `${formatFecha(tardeo.fecha)} · ${tardeo.local.nombre} (${tardeo.zona})${tardeo.estilo ? ` · ${tardeo.estilo}` : ""}. Descúbrelo en TardeosClub.`;
  const img = flyerSrc(tardeo);

  return {
    title: `${tardeo.titulo} · TardeosClub`,
    description: desc,
    // Imprescindible: sin esto hereda la canónica de app/tardeos/layout.tsx y
    // la ficha le diría a Google que la página buena es el listado.
    alternates: { canonical: urlAbsoluta(`/tardeos/${id}`) },
    openGraph: {
      title: tardeo.titulo,
      description: desc,
      images: [{ url: img }],
      url: urlAbsoluta(`/tardeos/${id}`),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: tardeo.titulo,
      description: desc,
      images: [img],
    },
  };
}

export default async function FichaTardeo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tardeo = await getTardeoById(id);
  if (!tardeo) notFound();

  // Lo que ya pasó o se canceló no ofrece apuntarse, comprar ni calendario:
  // un botón de "Comprar entradas" de una fiesta de hace un mes es lo que
  // hace pensar que la web está abandonada.
  const cancelado = tardeo.estado === "cancelado";
  const pasado = tardeo.fecha < hoyEnEspana();
  const activo = !pasado && !cancelado;

  const [promos, delLocal] = await Promise.all([
    activo ? getPromosDeTardeo(id) : Promise.resolve([]),
    // Sin nombre de local, el local no es público: no hay "otros" que enseñar.
    tardeo.local.nombre ? getTardeosPublicadosDeLocal(tardeo.local.id) : Promise.resolve([] as Tardeo[]),
  ]);
  const otros = delLocal.filter((t) => t.id !== tardeo.id).slice(0, 4);

  /**
   * Las horas van SIN zona y con `ctz=Europe/Madrid` aparte, que es como lo
   * espera Google. Sin `ctz`, un tardeo de Mataró a las 18:00 le salía a las
   * 17:00 a alguien en Londres.
   */
  const ini = fmtCal(tardeo.fecha, tardeo.horaInicio || "18:00");
  const fechaFin = tardeo.horaFin && tardeo.horaFin < (tardeo.horaInicio || "18:00") ? sumarDia(tardeo.fecha) : tardeo.fecha;
  const fin = fmtCal(fechaFin, tardeo.horaFin || tardeo.horaInicio || "20:00");
  const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(tardeo.titulo)}&dates=${ini}/${fin}&location=${encodeURIComponent(tardeo.local.direccion || "")}&details=${encodeURIComponent(`Tardeo en ${tardeo.local.nombre} · TardeosClub`)}&ctz=Europe/Madrid`;

  const flyer = flyerSrc(tardeo);
  const hora = tardeo.horaInicio ? `${tardeo.horaInicio}${tardeo.horaFin ? ` a ${tardeo.horaFin}` : ""}` : "";
  const dondeTxt = [tardeo.local.nombre, tardeo.zona].filter(Boolean).join(" · ");
  const entrada = entradaDe(tardeo);
  const textoCompartir = `¡Mira este tardeo! ${tardeo.titulo} — ${formatFecha(tardeo.fecha)} en ${tardeo.local.nombre}`;
  const hayEtiquetas = Boolean(tardeo.tipoEvento) || (tardeo.ambiente?.length ?? 0) > 0
    || (tardeo.publico?.length ?? 0) > 0 || Boolean(tardeo.dressCode);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    tardeo.local.direccion || `${tardeo.lat},${tardeo.lng}`
  )}`;

  return (
    <main>
      {/* Para que Google lo enseñe como evento —con fecha, sitio y precio en
          el propio resultado— y no como un enlace más. */}
      <DatosEstructurados datos={jsonLdEvento(tardeo)} />
      <RegistrarVista tipo="tardeo" id={tardeo.id} />

      {/*
        Cabecera: el propio flyer, difuminado, de fondo. Cada fiesta tiñe su
        página con sus colores sin que nadie tenga que elegir nada, y el velo
        oscuro garantiza que el título en blanco se lea sobre cualquier flyer.
      */}
      <section className="relative isolate overflow-hidden bg-tinta text-white">
        <Image src={flyer} alt="" aria-hidden="true" fill sizes="64px" className="-z-10 scale-150 object-cover opacity-90 blur-3xl" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/50 to-black/75" aria-hidden />

        <div className="mx-auto max-w-6xl px-4 pb-8 pt-3 md:px-8 md:pb-14 md:pt-6">
          <div className="mb-4 flex items-center justify-between md:mb-8">
            <Link
              href="/tardeos"
              className="-ml-1 inline-flex min-h-tacto items-center gap-1.5 rounded-full bg-white/15 px-4 text-[15px] font-bold text-white backdrop-blur transition hover:bg-white/25"
            >
              <ArrowLeft size={20} aria-hidden /> Tardeos
            </Link>
            <CompartirBtn
              titulo={tardeo.titulo}
              texto={textoCompartir}
              className="grid h-12 w-12 place-items-center rounded-full bg-white text-tinta shadow-elevada transition hover:bg-marfil-100 active:scale-95"
            />
          </div>

          <div className="grid items-center gap-6 md:grid-cols-[minmax(0,420px)_1fr] md:gap-14">
            {/* El flyer, entero y grande: es lo que la gente reconoce. */}
            <div className="relative mx-auto aspect-[4/5] w-full max-w-[270px] overflow-hidden rounded-2xl bg-black/30 shadow-2xl ring-1 ring-white/15 md:max-w-none">
              <Image src={flyer} alt="" aria-hidden="true" fill sizes="32px" className="scale-125 object-cover opacity-60 blur-2xl" />
              <Image
                src={flyer}
                alt={`Flyer de ${tardeo.titulo}`}
                fill
                // Es la imagen principal de la página: que empiece a bajar ya.
                priority
                sizes="(max-width: 768px) 270px, 420px"
                className="relative z-10 object-contain"
              />
              {tardeo.destacado && (
                <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-oro px-3 py-1 text-[14px] font-bold text-tinta shadow-tarjeta">
                  <Star size={14} fill="currentColor" aria-hidden /> Destacado
                </span>
              )}
            </div>

            {/* En el móvil el título va antes que las etiquetas: es lo que hay
                que ver sin bajar. En escritorio, las etiquetas encabezan. */}
            <div className="flex min-w-0 flex-col text-center md:text-left">
              {/* Ambiente, público y outfit. Solo lo que esté puesto: los
                  migrados llegaron sin nada de esto. */}
              {hayEtiquetas && (
                <div className="order-3 mt-5 flex flex-wrap justify-center gap-1.5 md:order-none md:mb-4 md:mt-0 md:justify-start">
                  {tardeo.tipoEvento && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-oro px-3 py-1 text-[14px] font-bold text-tinta">
                      <PartyPopper size={14} aria-hidden /> {tardeo.tipoEvento}
                    </span>
                  )}
                  {tardeo.ambiente?.map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[14px] font-semibold text-white">
                      <Sparkles size={14} aria-hidden /> {a}
                    </span>
                  ))}
                  {tardeo.publico?.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[14px] font-semibold text-white">
                      <Users size={14} aria-hidden /> {p}
                    </span>
                  ))}
                  {tardeo.dressCode && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[14px] font-semibold text-white">
                      <Shirt size={14} aria-hidden /> {tardeo.dressCode}
                    </span>
                  )}
                </div>
              )}

              <h1 className="order-1 font-display text-[32px] font-bold leading-[1.1] md:order-none md:text-[56px]">{tardeo.titulo}</h1>

              {/* Lo esencial de un vistazo, antes de bajar a los detalles. */}
              <ul className="order-2 mt-4 flex flex-col items-center md:order-none md:mt-5 gap-2 text-[17px] font-semibold text-white/95 md:items-start md:text-[19px]">
                <li className="inline-flex items-center gap-2">
                  <CalendarDays size={20} className="shrink-0 text-oro" aria-hidden />
                  <span>{formatFecha(tardeo.fecha)}{hora ? ` · ${hora}` : ""}</span>
                </li>
                {dondeTxt && (
                  <li className="inline-flex items-center gap-2">
                    <MapPin size={20} className="shrink-0 text-oro" aria-hidden /> <span>{dondeTxt}</span>
                  </li>
                )}
                <li className="inline-flex items-center gap-2">
                  <Ticket size={20} className="shrink-0 text-oro" aria-hidden /> <span>{entrada.grande}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Aviso de que ya pasó o se canceló: arriba del todo, con a dónde ir. */}
      {!activo && (
        <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
          <div role="status" className="flex flex-col gap-3 rounded-2xl border border-aviso/30 bg-aviso-fondo p-4 md:flex-row md:items-center md:justify-between md:p-5">
            <p className="flex items-start gap-3">
              {cancelado ? <Ban size={24} className="mt-0.5 shrink-0 text-aviso" aria-hidden /> : <History size={24} className="mt-0.5 shrink-0 text-aviso" aria-hidden />}
              <span>
                <span className="block text-[18px] font-bold text-tinta">
                  {cancelado ? "Este tardeo se ha cancelado" : "Este tardeo ya pasó"}
                </span>
                <span className="block text-[16px] text-tinta-suave">
                  {otros.length > 0
                    ? `Abajo tienes lo próximo de ${tardeo.local.nombre}.`
                    : "Mira lo que hay en los próximos días."}
                </span>
              </span>
            </p>
            <Link href="/tardeos" className={claseBoton("oro", "normal", false, "shrink-0")}>
              Ver próximos tardeos <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </div>
      )}

      {/* Sin columna de entrada (ya pasó), el contenido no se queda a la
          izquierda con un hueco al lado: se estrecha a ancho de lectura. */}
      <div className={`mx-auto grid gap-8 px-4 pt-6 md:gap-12 md:px-8 md:pt-10 ${activo ? "max-w-6xl md:grid-cols-[minmax(0,1fr)_360px]" : "max-w-4xl"}`}>
        {/*
          La columna de la entrada. En escritorio va a la derecha y se queda
          fija mientras se lee; en el móvil va primero, y su botón principal
          baja a la barra fija de abajo (AccionTardeo).
        */}
        {activo && (
          <aside className="md:order-2 md:sticky md:top-24 md:self-start">
            <div className="rounded-2xl border border-linea bg-white p-4 shadow-elevada md:p-5">
              <p className="text-[14px] font-bold uppercase tracking-wide text-tinta-suave">{entrada.pie}</p>
              <p className="font-display text-[34px] font-bold leading-tight">{entrada.grande}</p>

              <AccionTardeo tardeo={tardeo} />

              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={calUrl} target="_blank" rel="noopener noreferrer" className={claseBoton("contorno", "pequeno", true, "!px-2 text-[15px]")}>
                  <CalendarPlus size={18} aria-hidden /> Calendario
                </a>
                <CompartirConTexto titulo={tardeo.titulo} texto={textoCompartir} />
              </div>
              {tardeo.urlPromos && (
                <EnlaceExterno href={tardeo.urlPromos} canal="reservas" localId={tardeo.local.id} tardeoId={tardeo.id}
                  className={claseBoton("contorno", "pequeno", true, "mt-2")}>
                  <Tag size={18} aria-hidden /> Promociones y reservas
                </EnlaceExterno>
              )}
            </div>
          </aside>
        )}

        <div className="min-w-0 md:order-1">
          {/* Lo práctico, en filas: cuándo, dónde, qué suena y la entrada. */}
          <h2 className="sr-only">Detalles</h2>
          <dl className="grid gap-px overflow-hidden rounded-2xl border border-linea bg-linea sm:grid-cols-2">
            <Fila icono={<CalendarDays size={22} aria-hidden />} etiqueta="Cuándo">
              <span className="font-bold">{formatFecha(tardeo.fecha)}</span>
              {hora && (
                <span className="block text-tinta-suave">
                  <Clock size={15} className="mr-1 inline align-[-2px]" aria-hidden />
                  De {hora}
                </span>
              )}
            </Fila>
            {/* Sin nombre de local no se enlaza: si está en borrador la
                consulta pública llega vacía y el enlace daría una ficha que
                tampoco se puede ver. */}
            <Fila icono={<MapPin size={22} aria-hidden />} etiqueta="Dónde">
              {tardeo.local.nombre ? (
                <Link href={`/locales/${tardeo.local.id}`} className="font-bold underline-offset-2 hover:text-magenta hover:underline">
                  {tardeo.local.nombre}
                  {tardeo.local.verificado && <BadgeCheck size={17} className="ml-1 inline align-[-3px] text-magenta" aria-label="Verificado" />}
                </Link>
              ) : (
                <span className="font-bold">{tardeo.zona || "Por confirmar"}</span>
              )}
              {(tardeo.local.direccion || tardeo.zona) && (
                <span className="block text-tinta-suave">{tardeo.local.direccion || tardeo.zona}</span>
              )}
            </Fila>
            {/* Solo si hay estilo: una fila sin nada parece que falta cargar. */}
            {tardeo.estilo && (
              <Fila icono={<Music size={22} aria-hidden />} etiqueta="Música">
                <span className="font-bold">{tardeo.estilo}</span>
              </Fila>
            )}
            <Fila
              icono={tardeo.tipoEntrada === "gratis" ? <Gift size={22} aria-hidden /> : tardeo.tipoEntrada === "lista" ? <ListChecks size={22} aria-hidden /> : <Ticket size={22} aria-hidden />}
              etiqueta="Entrada"
            >
              <span className="font-bold">
                {tardeo.tipoEntrada === "gratis" ? "Gratis" : tardeo.tipoEntrada === "lista" ? "Por lista" : "De pago"}
                {tardeo.precio ? ` · ${tardeo.precio} €` : ""}
              </span>
            </Fila>
          </dl>

          {/* Etiquetas: rótulos cortos (2x1, consumición incluida…). El `> 0`
              no sobra: un 0 suelto en JSX se PINTA. */}
          {(tardeo.etiquetas?.length ?? 0) > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tardeo.etiquetas!.map((e) => (
                <span key={e} className="rounded-full bg-oro/25 px-3 py-1 text-[14px] font-bold text-tinta">{e}</span>
              ))}
            </div>
          )}

          {tardeo.descripcion && (
            <section className="mt-10">
              <h2 className="mb-3 font-display text-[26px] font-bold">Sobre este tardeo</h2>
              <p className="whitespace-pre-line text-[17px] leading-relaxed text-tinta">{sinMarcas(tardeo.descripcion)}</p>
            </section>
          )}

          {/* La promoción del propio tardeo y las vigentes (la base solo
              devuelve esas). Las de un tardeo pasado ya no sirven a nadie. */}
          {activo && (tardeo.promoTitulo || promos.length > 0) && (
            <section className="mt-10 flex flex-col gap-3">
              {tardeo.promoTitulo && (
                <div className="rounded-2xl border border-oro bg-oro/15 p-4">
                  <p className="flex items-center gap-2 text-lg font-bold leading-tight">
                    <Tag size={19} className="shrink-0 text-oro-600" aria-hidden /> {tardeo.promoTitulo}
                  </p>
                  {tardeo.promoTexto && <p className="mt-1 text-tinta-suave">{tardeo.promoTexto}</p>}
                </div>
              )}
              {promos.map((p) => (
                <div key={p.id} className="rounded-2xl border border-oro bg-oro/15 p-4">
                  <p className="flex items-center gap-2 text-lg font-bold leading-tight">
                    <Tag size={19} className="shrink-0 text-oro-600" aria-hidden /> {p.nombre}
                  </p>
                  {p.beneficio && <p className="mt-1 text-tinta-suave">{p.beneficio}</p>}
                  {p.codigo && (
                    <p className="mt-2 text-[15px] text-tinta-suave">
                      Con el código{" "}
                      <span className="rounded-lg bg-tinta px-2 py-1 font-mono font-bold text-white">{p.codigo}</span>
                    </p>
                  )}
                  {p.hasta && (
                    <p className="mt-2 text-[14px] font-medium text-tinta-suave">
                      Hasta el {new Date(p.hasta).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" })}
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* DJs: solo si hay alguno. Un "DJs" con la lista vacía debajo
              parece un fallo de carga. */}
          {tardeo.djs.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 font-display text-[26px] font-bold">{tardeo.djs.length === 1 ? "Pincha" : "Pinchan"}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {tardeo.djs.map((dj) => (
                  <Link key={dj.id} href={`/djs/${dj.id}`} className="flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border border-linea bg-white p-3 transition hover:border-linea-fuerte hover:shadow-tarjeta">
                    <div className="flex min-w-0 items-center gap-3">
                      {dj.avatar ? (
                        <Image src={dj.avatar} alt="" width={52} height={52} className="h-[52px] w-[52px] shrink-0 rounded-full object-cover" />
                      ) : (
                        <div className="bg-fiesta grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full text-lg font-bold text-white">
                          {dj.nombre.replace("DJ ", "").charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[17px] font-bold">
                          {dj.nombre}
                          {dj.verificado && <BadgeCheck size={16} className="ml-1 inline align-[-3px] text-magenta" aria-label="Verificado" />}
                        </p>
                        {dj.estilos.length > 0 && <p className="truncate text-[15px] text-tinta-suave">{dj.estilos.join(" · ")}</p>}
                      </div>
                    </div>
                    {tieneValoracion(dj.reputacion) && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[15px] font-bold">
                        <Star size={15} className="text-oro" fill="currentColor" aria-hidden /> {valoracion(dj.reputacion)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Dónde es: mapa pequeño, cómo llegar y la tarjeta del local. */}
          <section className="mt-10">
            <h2 className="mb-3 font-display text-[26px] font-bold">Cómo llegar</h2>
            <div className="overflow-hidden rounded-2xl border border-linea bg-white">
              {tardeo.lat && tardeo.lng ? (
                <MiniMapa lat={tardeo.lat} lng={tardeo.lng} />
              ) : (
                <div className="grid h-40 place-items-center bg-marfil-100 text-tinta-suave">
                  <MapPin size={36} aria-hidden />
                </div>
              )}
              <div className="grid grid-cols-2 divide-x divide-linea border-t border-linea">
                <EnlaceExterno
                  href={mapsUrl}
                  canal="mapa" localId={tardeo.local.id} tardeoId={tardeo.id}
                  className="flex min-h-tacto items-center justify-center gap-2 bg-white text-[16px] font-bold text-tinta transition hover:bg-marfil"
                >
                  <MapPin size={18} className="text-magenta" aria-hidden /> Cómo llegar
                </EnlaceExterno>
                {/* Busca taxis CERCA DEL SITIO, no en una app concreta: elegir
                    una es una decisión comercial y aún no hay acuerdo. */}
                <EnlaceExterno
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`taxi ${tardeo.lat},${tardeo.lng}`)}`}
                  canal="taxi" localId={tardeo.local.id} tardeoId={tardeo.id}
                  className="flex min-h-tacto items-center justify-center gap-2 bg-white text-[16px] font-bold text-tinta transition hover:bg-marfil"
                >
                  <Car size={18} className="text-magenta" aria-hidden /> Pedir taxi
                </EnlaceExterno>
              </div>
            </div>

            {/* Vuelve seguro: después del taxi, y en tono tranquilo. */}
            {activo && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-marfil-100 p-3 text-[15px] text-tinta-suave">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ok" aria-hidden />
                <span>
                  <b className="font-bold text-tinta">Vuelve seguro.</b> Si has bebido, no cojas el
                  coche: pide un taxi o vuelve acompañado.
                </span>
              </p>
            )}

            {tardeo.local.nombre && (
              <Link
                href={`/locales/${tardeo.local.id}`}
                className="group mt-4 flex items-center gap-4 rounded-2xl border border-linea bg-white p-4 transition hover:border-linea-fuerte hover:shadow-tarjeta"
              >
                {tardeo.local.logo ? (
                  <Image src={tardeo.local.logo} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-xl border border-linea bg-white object-contain p-1" />
                ) : (
                  <span className="bg-fiesta grid h-16 w-16 shrink-0 place-items-center rounded-xl text-2xl font-bold text-white">
                    {tardeo.local.nombre.charAt(0)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold uppercase tracking-wide text-tinta-suave">
                    {tardeo.local.tipo === "promotor" ? "Organiza" : "El local"}
                  </span>
                  <span className="block truncate text-[18px] font-bold">
                    {tardeo.local.nombre}
                    {tardeo.local.verificado && <BadgeCheck size={17} className="ml-1 inline align-[-3px] text-magenta" aria-label="Verificado" />}
                  </span>
                  {(tardeo.local.zona || tardeo.zona) && (
                    <span className="block truncate text-[15px] text-tinta-suave">{tardeo.local.zona || tardeo.zona}</span>
                  )}
                </span>
                <span className="hidden shrink-0 items-center gap-1 text-[15px] font-bold text-magenta sm:inline-flex">
                  Ver ficha <ArrowRight size={17} className="transition group-hover:translate-x-0.5" aria-hidden />
                </span>
                <ArrowRight size={20} className="shrink-0 text-tinta-suave sm:hidden" aria-hidden />
              </Link>
            )}
          </section>

          <DestacarTardeo localId={tardeo.local.id} tardeoId={tardeo.id} titulo={tardeo.titulo} />

          <Resenas tipo="local" objetivoId={tardeo.local.id} nombre={tardeo.local.nombre} />

          {/* Lo último de la página, en letra pequeña. */}
          <DenunciarFlyer tardeoId={tardeo.id} flyerUrl={flyer} />
        </div>
      </div>

      {otros.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-14 md:px-8">
          <div className="mb-5 flex items-end justify-between gap-3">
            <h2 className="font-display text-[26px] font-bold leading-tight md:text-[32px]">
              {pasado || cancelado ? "Lo próximo de " : "Más tardeos de "}{tardeo.local.nombre}
            </h2>
            <Link href={`/locales/${tardeo.local.id}`} className="-mr-2 inline-flex min-h-tacto shrink-0 items-center gap-1 rounded-xl px-2 text-[15px] font-bold text-magenta hover:bg-magenta-50">
              Ver todos <ArrowRight size={17} aria-hidden />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 md:grid-cols-4">
            {otros.map((t) => <TardeoCard key={t.id} tardeo={t} />)}
          </div>
        </section>
      )}

      <Footer />
      {/* Hueco para la barra fija de la entrada en el móvil, que si no tapa
          el final del pie. */}
      {activo && <div className="h-24 md:hidden" aria-hidden />}
    </main>
  );
}

/** Una fila de datos de la ficha: icono, etiqueta pequeña y valor. */
function Fila({ icono, etiqueta, children }: { icono: React.ReactNode; etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 bg-white px-4 py-4 sm:odd:last:col-span-2">
      <span className="mt-0.5 shrink-0 text-magenta">{icono}</span>
      <div className="min-w-0">
        <dt className="text-[13px] font-bold uppercase tracking-wide text-tinta-suave">{etiqueta}</dt>
        <dd className="text-[17px] leading-snug">{children}</dd>
      </div>
    </div>
  );
}

/** Compartir con texto, para la columna de la entrada (el de la cabecera es
 *  solo icono). */
function CompartirConTexto({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <CompartirBtn
      titulo={titulo}
      texto={texto}
      etiqueta="Compartir"
      className={claseBoton("contorno", "pequeno", true, "!px-2 text-[15px]")}
    />
  );
}
