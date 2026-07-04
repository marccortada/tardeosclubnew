"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import ServiciosExternos from "@/components/ServiciosExternos";
import { useAuth } from "@/lib/useAuth";
import { getMiDj } from "@/lib/tardeos";
import { Disc3, BadgeCheck, Star, Music, Loader2 } from "lucide-react";

export default function PanelDj() {
  const { user, loading } = useAuth();
  const [dj, setDj] = useState<any | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!user) { setCargando(false); return; }
    getMiDj(user.id).then((d) => { setDj(d); setCargando(false); });
  }, [user]);

  if (loading || cargando) {
    return (
      <main className="flex items-center justify-center gap-2 pt-24 text-tinta/50">
        <Loader2 className="animate-spin" /> Cargando…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-16 text-center">
        <p className="text-lg font-bold text-tinta/70">Entra para ver tu perfil de DJ.</p>
        <Link href="/perfil" className="mt-4 inline-block rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">Entrar</Link>
      </main>
    );
  }

  if (!dj) {
    return (
      <main className="pb-8">
        <PanelHeader titulo="Perfil de DJ" volverHref="/perfil" />
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 pt-16 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-tinta text-white"><Disc3 size={40} /></span>
          <h2 className="font-display text-2xl font-black">Aún no eres DJ</h2>
          <p className="font-semibold text-tinta/70">Crea tu perfil de DJ para ganar reputación y aparecer en los tardeos.</p>
          <Link href="/unirse?rol=dj" className="rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">Crear mi perfil DJ</Link>
        </div>
      </main>
    );
  }

  const estilos: string[] = Array.isArray(dj.estilos) ? dj.estilos : [];

  return (
    <main className="pb-8">
      <PanelHeader titulo="Perfil de DJ" volverHref="/perfil">
        {dj.verificado ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-oro/20 px-3 py-1 text-xs font-black text-oro-600"><BadgeCheck size={14} /> Verificado</span>
        ) : (
          <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-black text-tinta/50">Sin verificar</span>
        )}
      </PanelHeader>

      <div className="mx-auto max-w-2xl px-4 pt-5 md:px-8">
        <section className="relative overflow-hidden rounded-3xl bg-tinta p-6 text-white shadow-tarjeta md:p-8">
          <span className="bokeh" style={{ width: 120, height: 120, top: -20, right: 30, background: "#E10A5A", opacity: 0.5 }} />
          <div className="relative flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 font-display text-2xl font-black text-oro">
              {String(dj.nombre_artistico || "DJ").replace("DJ ", "").charAt(0)}
            </span>
            <div>
              <h2 className="font-display text-2xl font-black leading-tight md:text-3xl">{dj.nombre_artistico}</h2>
              <p className="inline-flex items-center gap-1 font-bold text-oro">
                <Star size={16} fill="currentColor" /> {Number(dj.reputacion_score ?? 0).toFixed(1)} de reputación
              </p>
            </div>
          </div>
        </section>

        {estilos.length > 0 && (
          <section className="mt-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-tinta/60"><Music size={16} className="text-magenta" /> Estilos</h3>
            <div className="flex flex-wrap gap-2">
              {estilos.map((e) => (
                <span key={e} className="rounded-full bg-magenta-50 px-4 py-2 text-sm font-extrabold text-magenta-700">{e}</span>
              ))}
            </div>
          </section>
        )}

        <section className="mt-5 rounded-2xl bg-white p-5 shadow-tarjeta ring-1 ring-black/5">
          <h3 className="mb-2 text-sm font-black text-tinta/60">Biografía</h3>
          <p className="font-semibold text-tinta/80">{dj.bio || "Aún no has escrito tu biografía."}</p>
        </section>

        <ServiciosExternos tipo="dj" />

        <p className="mt-6 text-center text-xs font-semibold text-tinta/40">
          Pronto podrás editar tu perfil, subir fotos y ver tu reputación por tardeo.
        </p>
      </div>
    </main>
  );
}
