"use client";

import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { EyeOff, Loader2, MapPin, Pencil, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { getLocalById } from "@/lib/tardeos";
import { LogoLocal, tipoDeLocal } from "@/components/LocalCard";
import { optimizable } from "@/lib/fotos";
import { claseBoton } from "@/components/Boton";
import { MARCA } from "@/lib/marca";

/**
 * Ficha de un local que el servidor no ve: o no existe o aún no está publicada.
 *
 * El servidor lee como anónimo (la sesión vive en el navegador) y la política
 * `locales_select` (lote 01) solo enseña los locales activos… salvo a su dueño y
 * al admin. Así que «Ver mi ficha» del panel, con la ficha en revisión, daba
 * «No encontramos esta página» y parecía que la ficha se había perdido. Aquí se
 * pide otra vez CON la sesión: si la base la devuelve, es suya (o es admin) y se
 * le enseña una vista previa con lo que ya tiene y lo que falta; si no, 404.
 * (Lo mismo que FichaOcultaPropia hace con los DJs.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la fila viene tal cual de getLocalById
type Fila = Record<string, any>;

export default function FichaNoPublicaPropia({ id }: { id: string }) {
  const { user, loading } = useAuth();
  const [estado, setEstado] = useState<"cargando" | "nada" | Fila>("cargando");

  useEffect(() => {
    if (loading) return;
    if (!user) { setEstado("nada"); return; } // eslint-disable-line react-hooks/set-state-in-effect
    let vivo = true;
    getLocalById(id).then((l) => { if (vivo) setEstado(l ?? "nada"); });
    return () => { vivo = false; };
  }, [id, user, loading]);

  const nombre = typeof estado === "object" ? String(estado.nombre ?? "") : "";
  useEffect(() => { if (nombre) document.title = `${nombre} (vista previa) · ${MARCA.nombre}`; }, [nombre]);

  if (estado === "nada") notFound();
  if (estado === "cargando") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center gap-2 bg-fondo text-[15px] text-tinta-suave" aria-busy>
        <Loader2 size={20} className="animate-spin" aria-hidden /> Cargando ficha…
      </main>
    );
  }

  const l = estado;
  const fotos: string[] = (Array.isArray(l.fotos) ? l.fotos : []).filter((f: unknown) => typeof f === "string" && f);
  const motivo = l.estado === "borrador"
    ? "Está en revisión: el equipo la mira antes de publicarla. Tus tardeos se guardan y saldrán con ella."
    : l.estado === "oculto_impago" ? "Está oculta por un pago pendiente."
    : "Está oculta: ahora no la ve nadie más.";
  const falta = [
    !l.logo_url && "Logo",
    !l.descripcion && "Descripción",
    !l.telefono && "Teléfono o WhatsApp",
    !fotos.length && "Fotos del local",
    !(Array.isArray(l.musica) && l.musica.length) && "Qué música ponéis",
  ].filter(Boolean) as string[];

  return (
    <main className="min-h-dvh bg-fondo pb-10">
      <div role="status" className="border-b border-aviso/30 bg-aviso-fondo">
        <div className="mx-auto flex max-w-3xl items-start gap-3 px-4 py-3">
          <EyeOff size={20} className="mt-0.5 shrink-0 text-aviso" aria-hidden />
          <div className="text-[15px]">
            <p className="font-bold text-tinta">Vista previa: tu ficha aún no es pública</p>
            <p className="text-tinta-suave">{motivo} Solo la ves tú (y el equipo).</p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-5">
        <Link href="/local" className="inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-semibold text-tinta-suave">
          <ArrowLeft size={18} aria-hidden /> Volver a mi panel
        </Link>

        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-linea bg-superficie">
            <LogoLocal local={l} sizes="80px" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[26px] font-extrabold leading-tight">{l.nombre}</h1>
            <p className="text-[15px] text-tinta-suave">{tipoDeLocal(l)}{l.zona ? ` · ${l.zona}` : ""}</p>
          </div>
        </div>

        {l.direccion && (
          <p className="flex items-start gap-2 text-[16px]"><MapPin size={18} className="mt-1 shrink-0 text-magenta" aria-hidden /> {l.direccion}</p>
        )}
        {l.descripcion && <p className="whitespace-pre-line text-[16px] leading-relaxed">{l.descripcion}</p>}

        {fotos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {fotos.slice(0, 6).map((f) => (
              <div key={f} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-noche">
                <Image src={f} alt="" fill sizes="(max-width: 640px) 50vw, 240px" unoptimized={!optimizable(f)} className="object-cover" />
              </div>
            ))}
          </div>
        )}

        {falta.length > 0 && (
          <section className="rounded-2xl border border-linea bg-superficie p-4">
            <h2 className="text-[18px] font-bold">Para que la ficha luzca, falta:</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {falta.map((f) => <li key={f} className="rounded-full bg-marfil-100 px-3 py-1.5 text-[15px] font-medium">{f}</li>)}
            </ul>
          </section>
        )}

        <Link href="/local/editar" className={claseBoton("primario", "normal", true)}>
          <Pencil size={18} aria-hidden /> Completar mi ficha
        </Link>
      </div>
    </main>
  );
}
