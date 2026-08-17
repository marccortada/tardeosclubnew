"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import SelectorAdnTardicola from "@/components/SelectorAdnTardicola";
import { useAuth } from "@/lib/useAuth";
import { getAdn, guardarAdn, tieneAdn, ADN_VACIO, type AdnTardicola } from "@/lib/tardicola";
import { Loader2, Check } from "lucide-react";

/**
 * Editar los gustos cuando quieras.
 *
 * Existe por dos motivos. Uno, /unirse solo los pide al registrarse, y a nadie
 * le gusta lo mismo en marzo que en agosto. Y dos, quien ya tiene ficha de local
 * o de DJ no puede volver a pasar por /unirse —le corta antes para que no cree
 * duplicados—, y también es un tardícola que sale por ahí.
 */
export default function MisGustos() {
  const { user, loading } = useAuth();
  const [adn, setAdn] = useState<AdnTardicola>(ADN_VACIO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

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
    setGuardando(true); setError(""); setGuardado(false);
    const { error: e } = await guardarAdn(user.id, adn);
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    setGuardado(true);
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

        <SelectorAdnTardicola adn={adn} onCambio={(a) => { setAdn(a); setGuardado(false); }} />

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

        <button
          onClick={guardar}
          disabled={guardando}
          className="mt-5 w-full rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white transition hover:brightness-105 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : guardado ? "Guardado ✓" : "Guardar"}
        </button>

        {guardado && (
          <p className="mt-3 flex items-center justify-center gap-1.5 font-bold text-oro-600">
            <Check size={18} /> Listo, lo tenemos en cuenta.
          </p>
        )}
      </div>
    </main>
  );
}
