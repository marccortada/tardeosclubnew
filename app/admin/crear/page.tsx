"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Boton from "@/components/Boton";
import AsistenteAlta, { type TipoAlta } from "@/components/AsistenteAlta";
import { Store, CalendarPlus, ChevronRight, Check, Disc3, Megaphone, Link2, List, Plus } from "lucide-react";

type Modo = "elegir" | TipoAlta;

/**
 * El Suspense es obligatorio: useSearchParams() lo exige en una página de
 * cliente, y sin él Next falla al compilar, no en tiempo de ejecución.
 */
export default function AdminCrearPagina() {
  return <Suspense fallback={null}><AdminCrear /></Suspense>;
}

const OPCIONES: { modo: Modo | "tardeo"; titulo: string; sub: string; icono: typeof Store; href?: string }[] = [
  { modo: "tardeo", titulo: "Tardeo", sub: "Un evento con fecha, en el local que elijas. Con lectura del flyer por IA.", icono: CalendarPlus, href: "/local/crear" },
  { modo: "local", titulo: "Local", sub: "Bar, terraza o sala con dirección fija. Nace publicado y sin dueño.", icono: Store },
  { modo: "promotor", titulo: "Promotor", sub: "Organiza tardeos sin local fijo: el sitio se elige en cada tardeo.", icono: Megaphone },
  { modo: "dj", titulo: "DJ", sub: "Ficha de artista para asignarle tardeos. Nace sin dueño.", icono: Disc3 },
];

const LISTA: Record<TipoAlta, { href: string; texto: string }> = {
  local: { href: "/admin/locales", texto: "Ver locales" },
  promotor: { href: "/admin/promotores", texto: "Ver promotores" },
  dj: { href: "/admin/djs", texto: "Ver DJs" },
};

// El rol ya lo comprueba app/admin/layout.tsx: aquí solo llegan admins.
function AdminCrear() {
  /**
   * Se puede entrar directo con ?tipo=local|promotor|dj desde el panel. Se
   * valida contra la lista: un `modo` que no existe dejaría la pantalla en
   * blanco, sin menú y sin formulario.
   */
  const tipo = useSearchParams().get("tipo");
  const [modo, setModo] = useState<Modo>(
    tipo === "local" || tipo === "promotor" || tipo === "dj" ? tipo : "elegir",
  );
  const [hecho, setHecho] = useState<{ tipo: TipoAlta; nombre: string } | null>(null);

  if (hecho) {
    const t = hecho.tipo;
    const invitar = `/admin/enlaces?tipo=${t}&buscar=${encodeURIComponent(hecho.nombre)}`;
    return (
      <SeccionPanel titulo="Crear" ancho="estrecho">
        <div className="rounded-2xl border border-linea bg-white p-6 text-center shadow-tarjeta md:p-8">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ok-fondo text-ok"><Check size={36} aria-hidden /></span>
          <h2 className="mt-4 text-2xl font-bold">
            {t === "local" ? "Local creado" : t === "promotor" ? "Promotor creado" : "DJ creado"}
          </h2>
          <p className="mt-2 text-base text-tinta-suave">
            <strong className="text-tinta">{hecho.nombre}</strong> ya está guardado, todavía sin dueño.
          </p>
        </div>

        <h3 className="mb-3 mt-8 text-lg font-bold">Siguientes pasos</h3>
        <ol className="flex flex-col gap-3">
          <li className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
            <p className="font-bold">1. Mándale su enlace de invitación</p>
            <p className="mt-1 text-[15px] text-tinta-suave">
              Con él, la persona entra con su cuenta y la ficha pasa a su nombre. Se lo mandas tú por WhatsApp o email.
            </p>
            <Boton href={invitar} tamano="pequeno" className="mt-3"><Link2 size={18} aria-hidden /> Crear enlace de invitación</Boton>
          </li>
          <li className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
            <p className="font-bold">2. {t === "dj" ? "Asígnale tardeos" : "Publícale tardeos"}</p>
            <p className="mt-1 text-[15px] text-tinta-suave">
              {t === "local"
                ? "Ya sale en el mapa. Puedes crear sus tardeos tú mismo mientras su dueño no entra."
                : t === "promotor"
                  ? "Al crear un tardeo suyo te pedirá el sitio, porque no tiene local fijo."
                  : "Desde cada tardeo puedes añadirle como DJ."}
            </p>
            <Boton href="/local/crear" tamano="pequeno" variante="contorno" className="mt-3"><CalendarPlus size={18} aria-hidden /> Crear un tardeo</Boton>
          </li>
        </ol>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Boton variante="contorno" onClick={() => { setHecho(null); setModo(t); }}><Plus size={18} aria-hidden /> Crear otro</Boton>
          <Boton variante="contorno" href={LISTA[t].href}><List size={18} aria-hidden /> {LISTA[t].texto}</Boton>
        </div>
      </SeccionPanel>
    );
  }

  if (modo !== "elegir") {
    const op = OPCIONES.find((o) => o.modo === modo)!;
    return (
      <SeccionPanel titulo={`Nuevo ${op.titulo.toLowerCase()}`} descripcion="Solo el nombre es obligatorio (y la dirección si es un local). Lo demás se puede completar luego." ancho="estrecho">
        <AsistenteAlta
          tipo={modo}
          onCancelar={() => setModo("elegir")}
          onHecho={(nombre) => setHecho({ tipo: modo, nombre })}
        />
      </SeccionPanel>
    );
  }

  return (
    <SeccionPanel titulo="Crear" descripcion="¿Qué quieres dar de alta?" ancho="estrecho">
      <div className="grid gap-3 sm:grid-cols-2">
        {OPCIONES.map((o) => {
          const contenido = (
            <>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta"><o.icono size={24} aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold">{o.titulo}</span>
                <span className="mt-0.5 block text-[15px] text-tinta-suave">{o.sub}</span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-tinta-suave" aria-hidden />
            </>
          );
          const cls = "flex min-h-[96px] items-center gap-4 rounded-2xl border border-linea bg-white p-4 text-left shadow-tarjeta transition-colors hover:border-linea-fuerte hover:bg-marfil";
          return o.href
            ? <Link key={o.modo} href={o.href} className={cls}>{contenido}</Link>
            : <button key={o.modo} type="button" onClick={() => setModo(o.modo as TipoAlta)} className={cls}>{contenido}</button>;
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-linea bg-marfil-100 p-4">
        <p className="font-bold">¿La ficha ya existe?</p>
        <p className="mt-1 text-[15px] text-tinta-suave">
          Para darle una ficha a su dueño, crea un enlace de invitación. Para mandar el enlace de alta general, también está ahí.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Boton href="/admin/enlaces" tamano="pequeno" variante="contorno"><Link2 size={18} aria-hidden /> Enlaces para locales</Boton>
          <Boton href="/admin/locales" tamano="pequeno" variante="contorno">Locales</Boton>
          <Boton href="/admin/promotores" tamano="pequeno" variante="contorno">Promotores</Boton>
          <Boton href="/admin/djs" tamano="pequeno" variante="contorno">DJs</Boton>
        </div>
      </div>
    </SeccionPanel>
  );
}
