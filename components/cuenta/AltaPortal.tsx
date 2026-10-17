import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { FOTOS, foto } from "@/lib/fotos";
import { entrarYVolver } from "@/lib/volver";
import { claseBoton } from "@/components/Boton";
import {
  ArrowRight, Disc3, Store, PartyPopper, UserPlus, ClipboardList, BadgeCheck, LogIn,
  CalendarPlus, Users, LineChart, Images, FileText, Headphones, CalendarDays, Megaphone,
} from "lucide-react";

/**
 * /unirse SIN sesión. Antes era una tarjeta casi vacía con "Crear cuenta o
 * entrar"; ahora cada portal se presenta con lo que de verdad trae su panel
 * (app/local/_panel/PanelLocal.tsx y app/dj/contexto.tsx), cómo es el alta
 * y un botón claro para crear la cuenta con el tipo ya marcado.
 */
type RolAlta = "dj" | "local" | "promotor";

type Contenido = {
  foto: string;
  etiqueta: string;
  titulo: ReactNode;
  frase: string;
  intro: string;
  beneficios: { icono: ReactNode; titulo: string; texto: string }[];
  pasos: [string, string][];
  cta: string;
};

const LOCAL: Contenido = {
  foto: FOTOS.bar,
  etiqueta: "Para locales y organizadores",
  titulo: <>Llena tus <span className="texto-oro">tardeos</span></>,
  frase: "Que se enteren de tu fiesta",
  intro: "Con local fijo o montando eventos en sitios distintos: publicas tus tardeos y la gente que busca plan los encuentra.",
  beneficios: [
    { icono: <CalendarPlus size={22} aria-hidden />, titulo: "Publica tus tardeos", texto: "Sube el flyer y se rellenan los datos solos. Tú revisas y publicas." },
    { icono: <Users size={22} aria-hidden />, titulo: "Mira quién se apunta", texto: "La lista de apuntados de cada tardeo, para saber cuánta gente esperar." },
    { icono: <LineChart size={22} aria-hidden />, titulo: "Estadísticas", texto: "Cuántas visitas y apuntados tienen tus tardeos." },
    { icono: <Images size={22} aria-hidden />, titulo: "Tu ficha con fotos y reseñas", texto: "Una página de tu local o marca con fotos, dirección y lo que opina la gente." },
  ],
  pasos: [
    ["Crea tu cuenta", "Con tu email y una contraseña. Un minuto."],
    ["Completa tu ficha", "Nombre, teléfono y, si tienes sitio fijo, la dirección."],
    ["La revisamos y sales en la web", "El equipo la comprueba y la publica. Mientras, ya puedes preparar tus tardeos."],
  ],
  cta: "Crear mi cuenta de Local",
};

const PROMOTOR: Contenido = {
  ...LOCAL,
  intro: "Montas fiestas en sitios distintos: publicas cada tardeo con su lugar y la gente que busca plan los encuentra.",
  pasos: [
    ["Crea tu cuenta", "Con tu email y una contraseña. Un minuto."],
    ["Completa tu ficha", "El nombre con el que organizas. El sitio lo pones en cada tardeo."],
    ["La revisamos y sales en la web", "El equipo la comprueba y la publica. Mientras, ya puedes preparar tus tardeos."],
  ],
  cta: "Crear mi cuenta de organizador",
};

const DJ: Contenido = {
  foto: FOTOS.dj,
  etiqueta: "Para DJs",
  titulo: <>Que los locales te <span className="texto-oro">encuentren</span></>,
  frase: "Pon música a la tarde",
  intro: "Tu perfil de DJ en el listado de TardeosClub: lo ven los tardícolas y los locales que buscan quién les pinche.",
  beneficios: [
    { icono: <Disc3 size={22} aria-hidden />, titulo: "Tu ficha pública de DJ", texto: "Foto, estilos y biografía, en el listado de DJs de la web." },
    { icono: <Headphones size={22} aria-hidden />, titulo: "Sesiones y fotos", texto: "Enlaza tus sesiones y sube fotos para que se oiga y se vea cómo pinchas." },
    { icono: <FileText size={22} aria-hidden />, titulo: "Tu PressKit", texto: "Súbelo una vez y los locales lo descargan desde tu ficha." },
    { icono: <CalendarDays size={22} aria-hidden />, titulo: "Tus tardeos y reseñas", texto: "Dónde pinchas y lo que dice la gente, en tu panel." },
  ],
  pasos: [
    ["Crea tu cuenta", "Con tu email y una contraseña. Un minuto."],
    ["Completa tu ficha", "Nombre artístico, estilos y unas líneas sobre ti."],
    ["Ya sales en el listado", "Tu perfil aparece en el listado de DJs. Complétalo con foto y sesiones para que luzca."],
  ],
  cta: "Crear mi cuenta de DJ",
};

export default function AltaPortal({ rol }: { rol: RolAlta | null }) {
  if (!rol) return <ElegirTipo />;
  const c = rol === "dj" ? DJ : rol === "promotor" ? PROMOTOR : LOCAL;
  const volver = entrarYVolver(`/unirse?rol=${rol}`);

  return (
    <main className="bg-white pb-16">
      {/* ---------- Cabecera con foto ---------- */}
      <section className="relative isolate overflow-hidden text-white">
        <Image src={foto(c.foto, 1800)} alt="" fill unoptimized priority sizes="100vw" className="-z-20 object-cover" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-magenta/85 via-fuchsia-700/70 to-purple-900/90" />
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 md:px-8 md:pb-20 md:pt-16">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[14px] font-bold ring-1 ring-white/25 backdrop-blur-sm">
            {rol === "dj" ? <Disc3 size={16} aria-hidden /> : rol === "promotor" ? <Megaphone size={16} aria-hidden /> : <Store size={16} aria-hidden />}
            {c.etiqueta}
          </p>
          <h1 className="mt-4 max-w-2xl text-[36px] font-extrabold leading-[1.05] tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)] sm:text-[46px] md:text-[56px]">
            {c.titulo}
          </h1>
          <p className="mt-2 font-script text-[24px] text-white/95 md:text-[30px]">{c.frase}</p>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/95 md:text-[18px]">{c.intro}</p>
          <Ctas cta={c.cta} rol={rol} volver={volver} />
        </div>
      </section>

      {/* ---------- Lo que tendrás ---------- */}
      <section aria-labelledby="alta-beneficios" className="mx-auto max-w-6xl px-4 pt-12 md:px-8 md:pt-16">
        <h2 id="alta-beneficios" className="text-[26px] font-extrabold tracking-tight md:text-[32px]">Lo que tendrás en tu panel</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {c.beneficios.map((b) => (
            <li key={b.titulo} className="flex items-start gap-4 rounded-2xl border border-linea bg-white p-5 shadow-tarjeta">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta">{b.icono}</span>
              <span>
                <span className="block text-[18px] font-bold leading-tight">{b.titulo}</span>
                <span className="mt-1 block text-[16px] text-tinta-suave">{b.texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Cómo funciona ---------- */}
      <section aria-labelledby="alta-pasos" className="mx-auto max-w-6xl px-4 pt-12 md:px-8 md:pt-16">
        <p className="font-script text-[24px] text-magenta">Así de fácil</p>
        <h2 id="alta-pasos" className="text-[26px] font-extrabold tracking-tight md:text-[32px]">Cómo funciona</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {c.pasos.map(([t, d], i) => (
            <li key={t} className="rounded-2xl bg-marfil-100 p-5">
              <span className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-fiesta text-[18px] font-extrabold text-white">{i + 1}</span>
                {[<UserPlus key="a" size={22} aria-hidden />, <ClipboardList key="b" size={22} aria-hidden />, <BadgeCheck key="c" size={22} aria-hidden />][i]}
              </span>
              <span className="mt-3 block text-[18px] font-bold leading-tight">{t}</span>
              <span className="mt-1 block text-[16px] text-tinta-suave">{d}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Cierre ---------- */}
      <section className="mx-auto max-w-6xl px-4 pt-12 md:px-8 md:pt-16">
        <div className="flex flex-col items-start gap-4 rounded-[28px] bg-noche p-6 text-white md:flex-row md:items-center md:justify-between md:p-10">
          <div>
            <p className="text-[24px] font-extrabold leading-tight md:text-[28px]">¿Empezamos?</p>
            <p className="mt-1 text-[16px] text-white/85">Crea tu cuenta y en un minuto estás completando tu ficha.</p>
          </div>
          <Ctas cta={c.cta} rol={rol} volver={volver} oscuro />
        </div>
        <p className="mt-6 text-center text-[15px] text-tinta-suave">
          ¿Solo vas a ir de tardeo?{" "}
          <Link href="/perfil?modo=signup&rol=tardicola" className="font-bold text-magenta-700 underline underline-offset-2">Crea tu cuenta de Tardícola</Link>
        </p>
      </section>
    </main>
  );
}

function Ctas({ cta, rol, volver, oscuro = false }: { cta: string; rol: RolAlta; volver: string; oscuro?: boolean }) {
  return (
    <div className={`flex w-full flex-col gap-3 sm:w-auto sm:flex-row ${oscuro ? "" : "mt-7"}`}>
      <Link href={`/perfil?modo=signup&rol=${rol}`} className={claseBoton("oro", "normal", false, "w-full !min-h-[56px] !px-7 !text-[18px] shadow-lg sm:w-auto")}>
        {cta} <ArrowRight size={20} aria-hidden />
      </Link>
      <Link href={volver}
        className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl border-2 border-white/70 px-6 text-[17px] font-bold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto">
        <LogIn size={20} aria-hidden /> Ya tengo cuenta
      </Link>
    </div>
  );
}

/** Sin ?rol=: tres tarjetas grandes con foto para elegir el portal. */
function ElegirTipo() {
  const tipos = [
    { href: "/perfil?modo=signup&rol=tardicola", foto: FOTOS.atardecer, icono: <PartyPopper size={22} aria-hidden />, titulo: "Tardícola", texto: "Voy a tardeos: guardo planes, me apunto y recibo avisos.", cta: "Crear mi cuenta" },
    { href: "/unirse?rol=dj", foto: FOTOS.dj, icono: <Disc3 size={22} aria-hidden />, titulo: "DJ", texto: "Pincho y quiero que los locales y la gente me encuentren.", cta: "Ver portal de DJ" },
    { href: "/unirse?rol=local", foto: FOTOS.bar, icono: <Store size={22} aria-hidden />, titulo: "Local o evento", texto: "Organizo tardeos, con sitio fijo o en sitios distintos.", cta: "Ver portal de locales" },
  ];
  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 md:px-8 md:pt-14">
      <p className="font-script text-[26px] text-magenta">Únete al club</p>
      <h1 className="text-[32px] font-extrabold leading-tight tracking-tight md:text-[44px]">
        ¿Cómo vas a vivir <span className="bg-fiesta bg-clip-text text-transparent">TardeosClub</span>?
      </h1>
      <p className="mt-2 max-w-xl text-[17px] text-tinta-suave">Elige tu tipo de cuenta. Con la misma cuenta puedes tener local y perfil de DJ.</p>

      <ul className="mt-8 grid gap-5 md:grid-cols-3">
        {tipos.map((t) => (
          <li key={t.titulo}>
            <Link href={t.href}
              className="group relative isolate flex min-h-[300px] flex-col justify-end overflow-hidden rounded-[24px] p-5 text-white shadow-elevada transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-magenta md:min-h-[380px]">
              <Image src={foto(t.foto, 800)} alt="" fill unoptimized sizes="(min-width: 768px) 33vw, 100vw" className="-z-20 object-cover transition duration-500 group-hover:scale-105" />
              <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/40 to-magenta/20" />
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-oro-400 text-sobre-oro">{t.icono}</span>
              <span className="mt-3 text-[26px] font-extrabold leading-tight">{t.titulo}</span>
              <span className="mt-1 text-[16px] text-white/90">{t.texto}</span>
              <span className="mt-4 inline-flex min-h-[48px] w-fit items-center gap-2 rounded-xl bg-white px-4 text-[16px] font-bold text-tinta transition group-hover:bg-oro-400 group-hover:text-sobre-oro">
                {t.cta} <ArrowRight size={18} aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-center text-[16px] text-tinta-suave">
        ¿Ya tienes cuenta?{" "}
        <Link href={entrarYVolver("/unirse")} className="inline-flex min-h-[44px] items-center font-bold text-magenta-700 underline underline-offset-2">Entra aquí</Link>
      </p>
    </main>
  );
}
