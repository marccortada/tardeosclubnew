"use client";

import Link from "next/link";
import ActivarNotificaciones from "@/components/ActivarNotificaciones";
import PermisoOfertas from "@/components/PermisoOfertas";
import { MarcoCuenta, CargandoCuenta, useDatosCuenta } from "@/components/panel/CuentaNav";
import { claseBoton } from "@/components/Boton";
import PreferenciasAvisos from "@/components/tardicola/PreferenciasAvisos";
import { Bell, ChevronRight } from "lucide-react";

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
    <MarcoCuenta titulo="Notificaciones" datos={datos}>
      <div className="flex flex-col divide-y divide-linea">
        <section className="pb-6">
          <h2 className="mb-1 text-lg font-bold">Avisos en este móvil</h2>
          <p className="mb-3 text-[15px] text-tinta-suave">Tus planes y tardeos afines.</p>
          <ActivarNotificaciones />
        </section>
        {/* Qué avisos quieres: antes estaba en la bandeja (/avisos) y aquí
            otra cosa; ahora todo lo que se elige vive en esta pantalla. */}
        <section className="py-6">
          <h2 className="mb-1 text-lg font-bold">Qué avisos quiero</h2>
          <PreferenciasAvisos uid={user.id} />
        </section>
        <section className="py-6">
          <h2 className="mb-1 text-lg font-bold">Ofertas por email</h2>
          <p className="mb-3 text-[15px] text-tinta-suave">Promociones y novedades, sin abusar.</p>
          <PermisoOfertas userId={user.id} />
        </section>
        <Link href="/avisos" className="flex min-h-[52px] items-center justify-between pt-2 text-[16px] font-semibold text-tinta">
          <span className="flex items-center gap-2"><Bell size={19} className="text-tinta-suave" aria-hidden /> Ver mis avisos</span>
          <ChevronRight size={18} className="text-tinta-suave" aria-hidden />
        </Link>
      </div>
    </MarcoCuenta>
  );
}
