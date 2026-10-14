"use client";
import { leerVolver } from "@/lib/volver";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { rutaDeInicio } from "@/lib/inicio";
import { CargandoCuenta, useDatosCuenta } from "@/components/panel/CuentaNav";
import HojaContrasena from "@/components/cuenta/HojaContrasena";
import InicioCuenta from "@/components/cuenta/InicioCuenta";
// Sin sesión: entrar o crear cuenta (con "quiero ofertas" pendiente de aplicar).
import Acceso, { CLAVE_OFERTAS } from "@/components/cuenta/Acceso";

/** ¿Venimos de Google o del enlace del correo (?tras=login)? */
const trasLogin = () =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tras") === "login";

export default function Perfil() {
  const { user, loading, datos } = useDatosCuenta();
  const router = useRouter();
  // La contraseña nueva: se abre sola al volver del email de recuperación.
  const [hojaClave, setHojaClave] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") setHojaClave(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // El "quiero ofertas" marcado al crear la cuenta se guarda en cuanto hay
  // sesión. Antes el check no hacía nada: no llegaba a ninguna parte.
  useEffect(() => {
    if (!user) return;
    let pendiente: string | null = null;
    try { pendiente = localStorage.getItem(CLAVE_OFERTAS); } catch { /* sin almacenamiento */ }
    if (pendiente !== "1") return;
    supabase.from("profiles").update({ acepta_ofertas: true }).eq("id", user.id).then(({ error }) => {
      // Si falla (p. ej. falta el lote 38) se deja la marca para otro intento.
      if (!error) { try { localStorage.removeItem(CLAVE_OFERTAS); } catch { /* nada */ } }
    });
  }, [user]);

  // Si se llegó con ?volver= (desde un panel) y ya hay sesión, se va allí.
  // Si se vuelve de Google o del enlace del correo (?tras=login), cada cuenta
  // va a SU portal: admin, local, DJ o, si no, se queda en su cuenta.
  useEffect(() => {
    if (loading || !user) return;
    const v = leerVolver();
    if (v) { router.replace(v); return; }
    if (trasLogin()) rutaDeInicio(user.id).then((r) => router.replace(r));
  }, [user, loading, router]);

  if (loading) return <CargandoCuenta />;
  if (user && (leerVolver() || trasLogin())) return <CargandoCuenta />;

  return (
    <>
      {user
        ? <InicioCuenta datos={datos} email={user.email ?? ""} uid={user.id} />
        : <Acceso />}
      <HojaContrasena abierta={hojaClave} onCerrar={() => setHojaClave(false)} />
    </>
  );
}
