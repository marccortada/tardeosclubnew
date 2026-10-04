"use client";
import ActivarNotificaciones from "@/components/ActivarNotificaciones";
import PermisoOfertas from "@/components/PermisoOfertas";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { getMiLocal, getMiDj } from "@/lib/tardeos";
import { User, CalendarCheck, ShieldAlert, LogOut, Loader2, Store, Mail, Lock, Disc3, Sparkles } from "lucide-react";

export default function Perfil() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasLocal, setHasLocal] = useState(false);
  const [hasDj, setHasDj] = useState(false);

  const [modo, setModo] = useState<"login" | "signup">("login");
  const [rol, setRol] = useState<"tardicola" | "local" | "promotor" | "dj">("tardicola");
  const [ofertas, setOfertas] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [mayor, setMayor] = useState(false);
  const [estado, setEstado] = useState<"idle" | "cargando" | "confirmar" | "verificando" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) { setIsAdmin(false); setHasLocal(false); setHasDj(false); return; }
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
      .then(({ data }) => setIsAdmin(!!data?.is_admin));
    getMiLocal(user.id).then((l) => setHasLocal(!!l));
    getMiDj(user.id).then((d) => setHasDj(!!d));
  }, [user]);

  const google = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/unirse" },
    });
  };

  const recuperar = async () => {
    if (!email.trim()) { setEstado("error"); setMsg("Escribe tu email arriba y le damos a recuperar."); return; }
    setEstado("cargando");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/perfil",
    });
    if (error) { setEstado("error"); setMsg(error.message); }
    else { setEstado("confirmar"); setMsg("Te hemos enviado un email para restablecer tu contraseña."); }
  };

  const enviar = async () => {
    if (!email.trim()) { setEstado("error"); setMsg("Escribe tu email."); return; }
    if (modo === "signup" && !mayor) { setEstado("error"); setMsg("Debes confirmar que eres mayor de 18."); return; }

    setEstado("cargando");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/unirse?rol=${rol}`,
      },
    });

    setEstado("idle");
    if (error) {
      setEstado("error");
      setMsg(error.message);
    } else {
      setEstado("verificando");
      setMsg("Te hemos enviado un código de 6 dígitos a tu email.");
    }
  };

  const verificarOtp = async () => {
    if (otp.length !== 6) { setEstado("error"); setMsg("El código debe tener 6 dígitos."); return; }
    setEstado("cargando");
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp,
      type: "email",
    });

    setEstado("idle");
    if (error) {
      setEstado("error");
      setMsg("Código incorrecto o caducado.");
    } else if (data.session) {
      router.push(modo === "signup" ? `/unirse?rol=${rol}` : "/perfil");
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 md:pt-6">
      <header className="flex flex-col items-center pt-6 pb-2 md:hidden">
        <Image src="/branding/logo-transp.png" alt="TardeosClub" width={170} height={110} priority className="h-auto w-[150px]" />
      </header>

      {loading ? (
        <div className="mt-2 flex items-center justify-center gap-2 rounded-3xl bg-white p-8 text-tinta/50 shadow-tarjeta ring-1 ring-black/5">
          <Loader2 className="animate-spin" /> Cargando…
        </div>
      ) : user ? (
        <>
          <div className="mt-2 flex flex-col items-center rounded-3xl bg-marca p-6 text-center text-white shadow-tarjeta">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-white/20"><User size={44} /></div>
            <p className="mt-3 text-xl font-black">¡Hola, tardícola!</p>
            <p className="text-sm font-semibold text-white/90">{user.email}</p>
            <button onClick={() => supabase.auth.signOut()}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/15 px-6 py-3 font-extrabold text-white ring-1 ring-white/30 active:scale-[0.98]">
              <LogOut size={20} /> Cerrar sesión
            </button>
          </div>

          <div className="mt-4">
            <ActivarNotificaciones />
          </div>

          <div className="mt-3">
            <PermisoOfertas userId={user.id} />
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {hasLocal && (
              <Link href="/local" className="flex items-center gap-3 rounded-2xl bg-marca p-4 text-white shadow-tarjeta transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/20"><Store size={24} /></div>
                <span className="text-lg font-black">Mi panel de local</span>
              </Link>
            )}
            {hasDj && (
              <Link href="/dj" className="flex items-center gap-3 rounded-2xl bg-tinta p-4 text-white shadow-tarjeta transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-oro"><Disc3 size={24} /></div>
                <span className="text-lg font-black">Mi perfil de DJ</span>
              </Link>
            )}
            <Link href="/perfil/gustos" className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-magenta-100 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-magenta-50 text-magenta"><Sparkles size={24} /></div>
              <span className="flex-1">
                <span className="block text-lg font-black">Mis gustos</span>
                <span className="text-sm font-semibold text-tinta/55">Música, ambiente, zonas… para proponerte lo que encaja</span>
              </span>
            </Link>
            <Link href="/favoritos" className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-magenta-100 transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-magenta-50 text-magenta"><CalendarCheck size={24} /></div>
              <span className="flex-1">
                <span className="block text-lg font-black">Mis planes</span>
                <span className="text-sm font-semibold text-tinta/55">A los que vas y los que has guardado</span>
              </span>
            </Link>
            {isAdmin && (
              <Link href="/admin" className="flex items-center gap-3 rounded-2xl bg-tinta p-4 text-white shadow-tarjeta transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-oro"><ShieldAlert size={24} /></div>
                <span className="text-lg font-black">Administración</span>
              </Link>
            )}
          </div>

          {!hasLocal && !hasDj && (
            <Link href="/unirse" className="mt-4 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-magenta-200 py-3 text-sm font-extrabold text-magenta transition hover:bg-magenta-50">
              <Store size={16} /> ¿Gestionas un local o eres DJ?
            </Link>
          )}
        </>
      ) : estado === "confirmar" ? (
        <div className="mt-2 flex flex-col items-center gap-3 rounded-3xl bg-white p-8 text-center shadow-tarjeta ring-1 ring-black/5">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-oro text-tinta"><Mail size={36} /></span>
          <p className="text-xl font-black">Revisa tu email</p>
          <p className="font-semibold text-tinta/70">{msg || <>Te enviamos un correo a <b>{email}</b> para activar tu cuenta.</>}</p>
          <button onClick={() => { setEstado("idle"); setModo("login"); }} className="mt-1 text-sm font-bold text-magenta">Volver</button>
        </div>
      ) : (
        <div className="mt-2 rounded-3xl bg-white p-6 shadow-tarjeta ring-1 ring-black/5">
          <div className="mb-4 text-center">
            <h1 className="font-display text-2xl font-black">Entra o únete</h1>
            <p className="font-semibold text-tinta/60">Tu comunidad tardícola te espera.</p>
          </div>

          <button onClick={google}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-black/10 bg-white py-3.5 text-lg font-extrabold text-tinta transition hover:bg-black/5 active:scale-[0.98]">
            <GoogleIcon /> Continuar con Google
          </button>

          <div className="my-4 flex items-center gap-3 text-sm font-bold text-tinta/40">
            <span className="h-px flex-1 bg-black/10" /> o con email <span className="h-px flex-1 bg-black/10" />
          </div>

          <div className="mb-3 flex gap-2">
            {(["login", "signup"] as const).map((m) => (
              <button key={m} onClick={() => { setModo(m); setEstado("idle"); }}
                className={`min-h-[44px] flex-1 rounded-xl text-sm font-extrabold transition ${modo === m ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}>
                {m === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </button>
            ))}
          </div>

          {modo === "signup" && (
            <div className="mb-3">
              <label className="mb-1.5 block text-sm font-black text-tinta/70">¿Cómo te unes?</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  { k: "tardicola", label: "Tardícola" },
                  { k: "local", label: "Local" },
                  { k: "promotor", label: "Promotor" },
                  { k: "dj", label: "DJ" },
                ] as const).map((o) => (
                  <button key={o.k} type="button" onClick={() => setRol(o.k)}
                    className={`min-h-[44px] rounded-xl text-sm font-extrabold transition ${rol === o.k ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="mb-1 block text-sm font-black text-tinta/70"><Mail size={14} className="mr-1 inline text-magenta" /> Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@email.com"
            className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 text-base font-semibold outline-none focus:border-magenta" />

          {estado === "verificando" ? (
            <div className="mt-3 flex flex-col gap-3">
              <label className="text-sm font-black text-tinta/70">Código de verificación</label>
              <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" maxLength={6}
                className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 text-center text-2xl font-black tracking-widest outline-none focus:border-magenta" />
              <button onClick={verificarOtp} disabled={estado === "cargando"}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white transition active:scale-[0.98] disabled:opacity-40">
                {estado === "cargando" ? <Loader2 size={20} className="animate-spin" /> : "Verificar código"}
              </button>
              <button onClick={() => setEstado("idle")} className="text-center text-sm font-bold text-tinta/50">Cambiar email</button>
            </div>
          ) : (
            <>
              {modo === "signup" && (
                <>
                <label className="mt-3 flex items-center gap-2 text-sm font-bold text-tinta/70">
                  <input type="checkbox" checked={mayor} onChange={(e) => setMayor(e.target.checked)} className="h-5 w-5 accent-magenta" />
                  Soy mayor de 18 años
                </label>
                <label className="mt-2 flex items-start gap-2 text-sm font-bold text-tinta/70">
                  <input
                    type="checkbox" checked={ofertas}
                    onChange={(e) => setOfertas(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-magenta"
                  />
                  <span>
                    Quiero recibir ofertas y novedades por email.
                    <span className="block text-xs font-semibold text-tinta/45">
                      Opcional. Puedes cambiarlo cuando quieras desde tu perfil.
                    </span>
                  </span>
                </label>
              </>
            )}

            {estado === "error" && <p className="mt-2 text-sm font-bold text-magenta">{msg}</p>}

            <button onClick={enviar} disabled={estado === "cargando"}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white transition active:scale-[0.98] disabled:opacity-40">
              {estado === "cargando" ? <Loader2 size={20} className="animate-spin" /> : null}
              {modo === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </>
          )}

          {modo === "login" && (
            <button onClick={recuperar} className="mt-3 text-center text-sm font-bold text-magenta">
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-xs font-semibold text-tinta/40">TardeosClub · Tu comunidad tardícola</p>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.29 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
