"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { Store, Disc3, Check, Loader2, AlertTriangle, LogIn } from "lucide-react";

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
    if (error) { setRes({ ok: false, error: error.message }); return; }
    setRes(data as Resultado);
  };

  if (loading) {
    return <main className="flex items-center justify-center gap-2 pt-24 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</main>;
  }

  if (!token) {
    return (
      <Aviso titulo="Enlace incompleto">
        A este enlace le falta el token. Pídele al equipo de TardeosClub que te mande uno nuevo.
      </Aviso>
    );
  }

  // Sin sesión no se puede enlazar la ficha a nadie. Que entre y vuelva aquí:
  // useAuth escucha los cambios de sesión, así que si entra en otra pestaña
  // esta se entera sola.
  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-16 text-center">
        <span className="mb-3 inline-grid h-16 w-16 place-items-center rounded-full bg-marca text-white"><LogIn size={30} /></span>
        <h1 className="font-display text-3xl font-black">Te han invitado</h1>
        <p className="mt-2 font-semibold text-tinta/70">
          Entra con tu cuenta (o créala) y vuelve a este enlace para quedarte con tu ficha.
        </p>
        <Link href="/perfil" className="mt-5 inline-block rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">
          Entrar o crear cuenta
        </Link>
        <p className="mt-4 text-xs font-semibold text-tinta/50">
          Guarda este enlace: lo necesitarás justo después de entrar.
        </p>
      </main>
    );
  }

  if (res?.ok) {
    const esLocal = res.tipo === "local";
    return (
      <main className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 pt-16 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-oro text-tinta"><Check size={44} /></span>
        <h1 className="font-display text-3xl font-black">¡Ya es tuya!</h1>
        <p className="font-semibold text-tinta/70">
          <b>{res.nombre}</b> está enlazada con tu cuenta. Desde tu panel puedes editarla
          {esLocal ? " y publicar tardeos." : " y ver en qué tardeos pinchas."}
        </p>
        <Link href={esLocal ? "/local" : "/dj"} className="mt-2 rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">
          Ir a mi panel
        </Link>
      </main>
    );
  }

  if (res && !res.ok) {
    return (
      <Aviso titulo="No se ha podido reclamar">
        {res.error}
      </Aviso>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 pt-16 text-center">
      <span className="mb-3 inline-grid h-16 w-16 place-items-center rounded-full bg-marca text-white"><Store size={30} /></span>
      <h1 className="font-display text-3xl font-black">Reclama tu ficha</h1>
      <p className="mt-2 font-semibold text-tinta/70">
        Vas a enlazar la ficha con <b>{user.email}</b>. A partir de ahí la gestionas tú.
      </p>
      <button
        onClick={reclamar}
        disabled={reclamando}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white active:scale-[0.98] disabled:opacity-40"
      >
        {reclamando ? <Loader2 size={20} className="animate-spin" /> : <Disc3 size={20} />} Reclamar
      </button>
      <p className="mt-4 text-xs font-semibold text-tinta/50">
        ¿No es tu cuenta? Sal de la sesión desde tu perfil y vuelve a abrir el enlace.
      </p>
    </main>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-lg px-4 pt-16 text-center">
      <span className="mb-3 inline-grid h-16 w-16 place-items-center rounded-full bg-tinta text-white"><AlertTriangle size={30} /></span>
      <h1 className="font-display text-2xl font-black">{titulo}</h1>
      <p className="mt-2 font-semibold text-tinta/70">{children}</p>
      <Link href="/" className="mt-5 inline-block rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">
        Volver al inicio
      </Link>
    </main>
  );
}

export default function Reclamar() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-bold text-tinta/50">Cargando…</div>}>
      <ReclamarContent />
    </Suspense>
  );
}
