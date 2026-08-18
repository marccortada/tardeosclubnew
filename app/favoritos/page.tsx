"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import TardeoCard from "@/components/TardeoCard";
import { useAuth } from "@/lib/useAuth";
import { getFavoritos, getInscripciones } from "@/lib/tardeos";
import { Tardeo } from "@/lib/types";
import { Heart, CalendarCheck, Loader2, LogIn } from "lucide-react";

export default function Favoritos() {
  const { user, loading } = useAuth();
  const [favs, setFavs] = useState<Tardeo[]>([]);
  const [inscr, setInscr] = useState<Tardeo[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!user) { setCargando(false); return; }
    (async () => {
      const [f, i] = await Promise.all([getFavoritos(user.id), getInscripciones(user.id)]);
      setFavs(f); setInscr(i); setCargando(false);
    })();
  }, [user]);

  if (loading || cargando) {
    return <main className="flex items-center justify-center gap-2 pt-24 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-6 text-center md:pt-16">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-8 shadow-tarjeta ring-1 ring-magenta-100">
          <Heart size={48} className="text-magenta" />
          <p className="text-lg font-bold text-tinta/70">Entra para guardar tus tardeos y ver tus inscripciones.</p>
          <Link href="/perfil" className="inline-flex items-center gap-2 rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">
            <LogIn size={20} /> Entrar
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 md:px-8 md:pt-10">
      <header className="mb-4 flex flex-col items-center md:hidden">
        <Image src="/branding/logo-transp.png" alt="TardeosClub" width={150} height={90} className="h-11 w-auto" />
      </header>

      {/* Inscripciones */}
      <section className="mb-8">
        <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-black md:text-3xl">
          <CalendarCheck className="text-magenta" /> Voy a ir
        </h2>
        {inscr.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">
            Aún no te has apuntado a ningún tardeo gratis.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {inscr.map((t) => <TardeoCard key={t.id} tardeo={t} />)}
          </div>
        )}
      </section>

      {/* Favoritos */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-black md:text-3xl">
          <Heart className="text-magenta" /> Mis favoritos
        </h2>
        {favs.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">
            Toca el corazón en un tardeo para guardarlo aquí.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {favs.map((t) => <TardeoCard key={t.id} tardeo={t} />)}
          </div>
        )}
      </section>
    </main>
  );
}
