"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MarcoCuenta, CargandoCuenta, useDatosCuenta } from "@/components/panel/CuentaNav";
import Boton, { claseBoton } from "@/components/Boton";
import SelectorAdnTardicola from "@/components/SelectorAdnTardicola";
import { getAdn, guardarAdn, tieneAdn, ADN_VACIO, type AdnTardicola } from "@/lib/tardicola";

/**
 * Editar los gustos cuando quieras.
 *
 * Es el ÚNICO sitio donde se piden. Antes salían nada más registrarse, y
 * soltarle siete apartados a alguien que acaba de llegar es la forma más rápida
 * de que se vaya: ahora entra, ve para qué sirve la app, y decide él cuándo
 * decir qué le gusta.
 */
export default function MisGustos() {
  const { user, loading, datos } = useDatosCuenta();
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
    // De vuelta a la cuenta: el botón está al final de varios apartados y
    // quedarse aquí hace dudar de si se guardó.
    router.push("/perfil");
  };

  if (loading || cargando) return <CargandoCuenta />;

  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-16 text-center">
        <p className="text-lg font-semibold">Entra en tu cuenta para editar tus gustos.</p>
        <Link href="/perfil" className={claseBoton("primario", "normal", false, "mt-4")}>Entrar</Link>
      </main>
    );
  }

  return (
    <MarcoCuenta
      titulo="Mis gustos"
      descripcion={tieneAdn(adn)
        ? "Cámbialos cuando quieras. Sirven para proponerte planes que encajan y no llenarte de avisos."
        : "Marca lo que te suene y te propondremos planes que encajan, en vez de una lista sin más."}
      datos={datos}
    >
      <div className="max-w-2xl">
        <SelectorAdnTardicola adn={adn} onCambio={setAdn} />

        {error && <p role="alert" className="mt-4 rounded-xl bg-error-fondo p-3 text-[15px] font-semibold text-error">{error}</p>}

        {/* Fijo abajo en el móvil (encima de la barra de navegación) para no
            tener que bajar hasta el final para guardar. */}
        <div className="sticky bottom-[76px] z-10 mt-6 rounded-2xl border border-linea bg-white/95 p-3 shadow-elevada backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          <Boton onClick={guardar} cargando={guardando} ancho>Guardar mis gustos</Boton>
        </div>
      </div>
    </MarcoCuenta>
  );
}
