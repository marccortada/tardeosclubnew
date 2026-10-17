"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { entrarYVolver } from "@/lib/volver";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { Loader2, ShieldAlert } from "lucide-react";

/**
 * Guardia única para todo /admin.
 *
 * Los datos ya los protege RLS, pero sin esto cualquiera podía abrir las
 * pantallas de administración y ver los controles (verificar, ocultar,
 * asignar dueño) aunque al pulsarlos fallaran. Antes solo /admin comprobaba
 * el rol; las subpáginas estaban a la vista.
 *
 * Vive aquí y no en app/admin/layout.tsx porque un layout de cliente no puede
 * exportar `metadata`, y el panel necesita decirle a Google que no lo indexe.
 */
export default function GuardiaAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  // Un fallo al leer el perfil (red, caída de Supabase) no es «no eres admin»:
  // antes se pintaba «Acceso restringido» y el admin creía que le habían quitado
  // el permiso. Se enseña el fallo y se deja reintentar.
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) { setIsAdmin(false); setFallo(false); return; }
    let vivo = true;
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) { setFallo(true); setIsAdmin(null); return; }
        setFallo(false);
        setIsAdmin(!!data?.is_admin);
      });
    return () => { vivo = false; };
  }, [user, loading, intento]);

  if (fallo && !loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-error-fondo text-error">
          <ShieldAlert size={28} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold">No se pudo comprobar tu acceso</h1>
        <p className="mt-1 text-[15px] text-tinta-suave">Revisa la conexión y vuelve a intentarlo.</p>
        <div className="mt-5 flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => { setFallo(false); setIntento((n) => n + 1); }}
            className="inline-flex min-h-tacto items-center justify-center rounded-xl bg-magenta px-5 text-[17px] font-bold text-white hover:bg-magenta-600"
          >
            Reintentar
          </button>
          <Link href="/" className="inline-flex min-h-tacto items-center justify-center rounded-xl border border-linea-fuerte bg-white px-5 text-[17px] font-bold hover:bg-marfil-100">
            Volver a la web
          </Link>
        </div>
      </main>
    );
  }

  if (loading || isAdmin === null) {
    return (
      <main className="flex items-center justify-center gap-2 pt-24 text-tinta-suave">
        <Loader2 className="animate-spin" /> Cargando…
      </main>
    );
  }

  if (!isAdmin) {
    // Sin sesión, lo útil es entrar; con sesión de no-admin, volver a la web.
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-noche text-white">
          <ShieldAlert size={28} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold">{user ? "Acceso restringido" : "Entra para administrar"}</h1>
        <p className="mt-1 text-[15px] text-tinta-suave">
          {user ? "Esta zona es solo para administradores." : "Inicia sesión con tu cuenta de administración."}
        </p>
        <div className="mt-5 flex w-full flex-col gap-2">
          {!user && (
            <Link href={entrarYVolver(pathname)} className="inline-flex min-h-tacto items-center justify-center rounded-xl bg-magenta px-5 text-[17px] font-bold text-white hover:bg-magenta-600">
              Entrar
            </Link>
          )}
          <Link href="/" className="inline-flex min-h-tacto items-center justify-center rounded-xl border border-linea-fuerte bg-white px-5 text-[17px] font-bold hover:bg-marfil-100">
            Volver a la web
          </Link>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
