"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import AsistenteAlta, { type TipoAlta } from "@/components/AsistenteAlta";
import {
  Store, CalendarPlus, Mail, ArrowRight, Check, Disc3, Megaphone,
} from "lucide-react";

type Modo = "elegir" | "local" | "promotor" | "dj";

/**
 * El Suspense es obligatorio: useSearchParams() lo exige en una página de
 * cliente, y sin él Next falla al compilar, no en tiempo de ejecución.
 */
export default function AdminCrearPagina() {
  return <Suspense fallback={null}><AdminCrear /></Suspense>;
}

// El rol ya lo comprueba app/admin/layout.tsx: aquí solo llegan admins.
function AdminCrear() {
  /**
   * Se puede entrar directo con ?tipo=local|promotor|dj desde el panel, para
   * no pasar por el menú cuando ya se sabe qué se va a crear.
   *
   * Se valida contra la lista en vez de confiar en la URL: cualquiera puede
   * escribir ?tipo=loquesea, y un `modo` que no existe deja la pantalla en
   * blanco, sin menú y sin formulario.
   */
  const tipo = useSearchParams().get("tipo");
  const [modo, setModo] = useState<Modo>(
    tipo === "local" || tipo === "promotor" || tipo === "dj" ? tipo : "elegir",
  );

  const [hecho, setHecho] = useState<{ tipo: TipoAlta; nombre: string } | null>(null);

  if (hecho) {
    const esFicha = hecho.tipo !== "dj";  // local y promotor comparten panel
    return (
      <main className="pb-10">
        <PanelHeader titulo="Crear" volverHref="/admin" />
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 pt-16 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-oro text-tinta"><Check size={44} /></span>
          <h2 className="font-display text-3xl font-black">
            {hecho.tipo === "local" ? "Local creado" : hecho.tipo === "promotor" ? "Promotor creado" : "DJ creado"}
          </h2>
          <p className="font-semibold text-tinta/70">
            <b>{hecho.nombre}</b> ya está en la base de datos, todavía sin dueño.
          </p>
          <p className="-mt-2 text-sm font-semibold text-tinta/50">
            {hecho.tipo === "local"
              ? "Está activo y sale en el mapa. Cuando su dueño se registre, habrá que enlazarle la ficha."
              : hecho.tipo === "promotor"
                ? "Ya puedes publicarle tardeos: al crearlos te pedirá el sitio, porque no tiene local fijo."
                : "Ya se le puede asignar a un tardeo. Cuando la persona se registre, habrá que enlazarle la ficha."}
          </p>
          <div className="flex w-full flex-col gap-2">
            <button onClick={() => { setHecho(null); setModo(hecho.tipo); }}
              className="rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white active:scale-[0.98]">
              Crear otro
            </button>
            <Link href={esFicha ? "/admin/locales" : "/admin/djs"}
              className="rounded-2xl bg-white px-6 py-4 text-lg font-extrabold text-tinta ring-1 ring-black/10">
              Ver {esFicha ? "locales" : "DJs"}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-10">
      <PanelHeader titulo="Crear" volverHref="/admin" />
      <div className="mx-auto max-w-lg px-4 pt-5 md:px-8">
        {modo === "elegir" && (
          <div className="flex flex-col gap-4">
            <button onClick={() => { setModo("local"); }} className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-marca text-white"><Store size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Crear local</span><span className="text-sm font-semibold text-tinta/60">Alta manual, sin dueño</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </button>

            <button onClick={() => { setModo("promotor"); }} className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-magenta-600 text-white"><Megaphone size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Crear promotor</span><span className="text-sm font-semibold text-tinta/60">Organiza sin local fijo</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </button>

            <button onClick={() => { setModo("dj"); }} className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-magenta text-white"><Disc3 size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Crear DJ</span><span className="text-sm font-semibold text-tinta/60">Alta manual, sin dueño</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </button>

            <Link href="/local/crear" className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-oro text-tinta"><CalendarPlus size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Crear tardeo</span><span className="text-sm font-semibold text-tinta/60">Con IA, en el local que elijas</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </Link>

            <Link href="/admin/locales" className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-tinta text-white"><Mail size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Invitar</span><span className="text-sm font-semibold text-tinta/60">El enlace se genera desde la ficha, en Locales o DJs</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </Link>
          </div>
        )}

        {modo !== "elegir" && (
          <AsistenteAlta
            tipo={modo}
            onCancelar={() => { setModo("elegir"); }}
            onHecho={(nombre) => setHecho({ tipo: modo, nombre })}
          />
        )}
      </div>
    </main>
  );
}
