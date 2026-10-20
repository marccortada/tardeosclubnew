"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { mensajeAmable } from "@/lib/mensajeError";
import { entrarYVolver } from "@/lib/volver";
import { Store, Check, Loader2, AlertTriangle, LogIn, BadgeCheck, ArrowRight } from "lucide-react";
import Boton, { claseBoton } from "@/components/Boton";
import { MARCA } from "@/lib/marca";

type Resultado = { ok: true; tipo: "local" | "dj"; nombre: string } | { ok: false; error: string };

function ReclamarContent() {
  const token = useSearchParams().get("token") ?? "";
  const { user, loading } = useAuth();
  const [reclamando, setReclamando] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  // La validación del token vive en la función de Postgres: aquí no se
  // comprueba nada porque el cliente no puede leer la tabla de invitaciones.
  const reclamar = async () => {
    setReclamando(true);
    const { data, error } = await supabase.rpc("reclamar_invitacion", { p_token: token });
    setReclamando(false);
    if (error) { setRes({ ok: false, error: mensajeAmable(error) }); return; }
    setRes(data as Resultado);
  };

  if (loading) {
    return <main className="flex items-center justify-center gap-2 pt-24 text-tinta-suave"><Loader2 className="animate-spin" aria-hidden /> Cargando…</main>;
  }

  if (!token) {
    return (
      <Aviso titulo="Enlace incompleto">
        A este enlace le falta el código de invitación. Pide al equipo de {MARCA.nombre} que te mande uno nuevo.
      </Aviso>
    );
  }

  // Sin sesión no se puede enlazar la ficha a nadie. Que entre y vuelva aquí:
  // useAuth escucha los cambios de sesión, así que si entra en otra pestaña
  // esta se entera sola.
  if (!user) {
    return (
      <Caja icono={<LogIn size={28} aria-hidden />} titulo={`Te han invitado a ${MARCA.nombre}`}>
        <p className="text-[16px] text-tinta-suave">
          Entra con tu cuenta (o créala) y te traemos de vuelta aquí para quedarte con tu ficha.
        </p>
        {/* Con ?volver= el acceso devuelve a esta misma invitación, token incluido. */}
        <Link href={entrarYVolver(`/reclamar?token=${encodeURIComponent(token)}`)} className={claseBoton("primario", "normal", true, "mt-5 !min-h-[54px] !text-[18px]")}>
          Entrar o crear cuenta <ArrowRight size={20} aria-hidden />
        </Link>
      </Caja>
    );
  }

  if (res?.ok) {
    const esLocal = res.tipo === "local";
    return (
      <Caja icono={<Check size={30} aria-hidden />} tono="ok" titulo="¡Ya es tuya!">
        <p className="text-[16px] text-tinta-suave">
          <b className="text-tinta">{res.nombre}</b> está enlazada con tu cuenta. Desde tu panel puedes editarla
          {esLocal ? " y publicar tardeos." : " y ver en qué tardeos pinchas."}
        </p>
        <Link href={esLocal ? "/local" : "/dj"} className={claseBoton("primario", "normal", true, "mt-5")}>Ir a mi panel</Link>
      </Caja>
    );
  }

  if (res && !res.ok) {
    return <Aviso titulo="No se ha podido reclamar">{res.error}</Aviso>;
  }

  return (
    <Caja icono={<Store size={28} aria-hidden />} titulo="Reclama tu ficha">
      <p className="text-[16px] text-tinta-suave">
        Vas a enlazar la ficha con <b className="text-tinta">{user.email}</b>. A partir de ahí la gestionas tú.
      </p>
      <Boton onClick={reclamar} cargando={reclamando} ancho className="mt-5">
        <BadgeCheck size={20} aria-hidden /> Reclamar mi ficha
      </Boton>
      <p className="mt-3 text-[14px] text-tinta-suave">
        ¿No es tu cuenta? Cierra sesión desde <Link href="/perfil" className="font-semibold underline">Mi cuenta</Link> y vuelve a abrir el enlace.
      </p>
    </Caja>
  );
}

function Caja({ icono, titulo, tono = "marca", children }: { icono: React.ReactNode; titulo: string; tono?: "marca" | "ok" | "error"; children: React.ReactNode }) {
  // Franja de color arriba con el icono: rosa→naranja de la marca para la
  // invitación, verde al terminar y rojo si algo falla.
  const franja = { marca: "bg-fiesta", ok: "bg-ok", error: "bg-error" }[tono];
  const color = { marca: "text-magenta", ok: "text-ok", error: "text-error" }[tono];
  return (
    <main className="mx-auto max-w-lg px-4 pb-12 pt-8 md:pt-16">
      <div className="overflow-hidden rounded-[24px] border border-linea bg-white text-center shadow-elevada">
        <div className={`${franja} flex justify-center px-6 pb-10 pt-7`}>
          {tono === "marca" && <p className="font-script text-[24px] leading-none text-white">Tu ficha te espera</p>}
        </div>
        <div className="-mt-9 flex flex-col items-center px-6 pb-7 md:px-8 md:pb-8">
          <span className={`grid h-[72px] w-[72px] place-items-center rounded-full border-4 border-superficie bg-white ${color} shadow-tarjeta`}>{icono}</span>
          <h1 className="mb-2 mt-3 text-[26px] font-extrabold leading-tight tracking-tight">{titulo}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Caja icono={<AlertTriangle size={28} aria-hidden />} tono="error" titulo={titulo}>
      <p className="text-[16px] text-tinta-suave">{children}</p>
      <Link href="/" className={claseBoton("contorno", "normal", true, "mt-5")}>Volver al inicio</Link>
    </Caja>
  );
}

export default function Reclamar() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-semibold text-tinta-suave">Cargando…</div>}>
      <ReclamarContent />
    </Suspense>
  );
}
