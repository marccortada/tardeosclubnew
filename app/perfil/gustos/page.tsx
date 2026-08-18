"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import SelectorAdnTardicola from "@/components/SelectorAdnTardicola";
import { useAuth } from "@/lib/useAuth";
import { getAdn, guardarAdn, tieneAdn, ADN_VACIO, type AdnTardicola } from "@/lib/tardicola";
import { Loader2 } from "lucide-react";

/**
 * Editar los gustos cuando quieras.
 *
 * Es el ÚNICO sitio donde se piden. Antes salían nada más registrarse, y
 * soltarle siete apartados a alguien que acaba de llegar es la forma más rápida
 * de que se vaya: ahora entra, ve para qué sirve la app, y decide él cuándo
 * decir qué le gusta.
 */
export default function MisGustos() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [adn, setAdn] = useState<AdnTardicola>(ADN_VACIO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) { setCargando(false); return; }
    getAdn(user.id).then((a) => {
      // null = no se pudo leer. Se avisa en vez de enseñar una hoja en blanco,
      // que le haría creer que se han perdido sus respuestas.
      if (a) setAdn(a);
      else setError("No pudimos cargar tus gustos. Recarga la página antes de guardar, o los sobrescribirás.");
      setCargando(false);
    });
  }, [user, loading]);

  const guardar = async () => {
    if (!user) return;
    setGuardando(true); setError("");
    const { error: e } = await guardarAdn(user.id, adn);
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    // De vuelta a la cuenta. El botón está al final de siete apartados: dejarle
    // ahí obliga a subir hasta la flecha de salir, que es justo el momento en el
    // que uno cree que no ha guardado.
    router.push("/perfil");
  };

  if (loading || cargando) {
    return <main className="flex items-center justify-center gap-2 pt-24 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</main>;
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-16 text-center">
        <p className="text-lg font-bold text-tinta/70">Entra en tu cuenta para editar tus gustos.</p>
        <Link href="/perfil" className="mt-4 inline-block rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">Ir a entrar</Link>
      </main>
    );
  }

  return (
    <main className="pb-28 md:pb-12">
      <PanelHeader titulo="Mis gustos" volverHref="/perfil" />
      <div className="mx-auto max-w-lg px-4 pt-5 md:px-8">
        <p className="mb-4 font-semibold text-tinta/60">
          {tieneAdn(adn)
            ? "Cámbialo cuando quieras. Se usa para proponerte planes que encajan y para no llenarte de avisos que no te interesan."
            : "Marca lo que te suene y te propondremos planes que encajan, en vez de una lista sin más."}
        </p>

        <SelectorAdnTardicola adn={adn} onCambio={setAdn} />

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

        <button
          onClick={guardar}
          disabled={guardando}
          className="mt-5 w-full rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white transition hover:brightness-105 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar y volver"}
        </button>

      </div>
    </main>
  );
}
