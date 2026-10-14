"use client";

import Link from "next/link";
import ActivarNotificaciones from "@/components/ActivarNotificaciones";
import PermisoOfertas from "@/components/PermisoOfertas";
import { MarcoCuenta, CargandoCuenta, useDatosCuenta } from "@/components/panel/CuentaNav";
import { claseBoton } from "@/components/Boton";

/**
 * Avisos en el móvil y permiso de ofertas por email, juntos y en su sitio.
 * Antes estaban sueltos en mitad del perfil, entre el saludo y los paneles.
 */
export default function Notificaciones() {
  const { user, loading, datos } = useDatosCuenta();

  if (loading) return <CargandoCuenta />;
  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-16 text-center">
        <p className="text-lg font-semibold">Entra en tu cuenta para gestionar tus avisos.</p>
        <Link href="/perfil" className={claseBoton("primario", "normal", false, "mt-4")}>Entrar</Link>
      </main>
    );
  }

  return (
    <MarcoCuenta titulo="Notificaciones" descripcion="Elige cómo quieres enterarte de los tardeos." datos={datos}>
      <div className="flex max-w-2xl flex-col gap-6">
        <section>
          <h2 className="mb-1 text-lg font-bold">Avisos en este dispositivo</h2>
          <p className="mb-3 text-[15px] text-tinta-suave">Te avisamos de los tardeos que encajan contigo y de los planes a los que te has apuntado.</p>
          <ActivarNotificaciones />
        </section>
        <section>
          <h2 className="mb-1 text-lg font-bold">Ofertas por email</h2>
          <p className="mb-3 text-[15px] text-tinta-suave">Promociones de los locales y novedades de TardeosClub. Nunca más de lo necesario.</p>
          <PermisoOfertas userId={user.id} />
        </section>
      </div>
    </MarcoCuenta>
  );
}
