"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { leerVolver } from "@/lib/volver";
import { rutaDeInicio, TRAS_LOGIN } from "@/lib/inicio";
import { FOTOS, foto } from "@/lib/fotos";
import Boton from "@/components/Boton";
import { claseCampo } from "@/components/ui/Campo";
import { traducirAuth as traducir, esCuentaInexistente } from "@/components/cuenta/traducirAuth";
import {
  Mail, Lock, Eye, EyeOff, PartyPopper, Disc3, Store, UserPlus, Check, Heart, BellRing, Ticket, KeyRound,
} from "lucide-react";

type Rol = "tardicola" | "local" | "promotor" | "dj";
type Modo = "login" | "signup";
type Metodo = "clave" | "codigo";
/** Dónde se pinta el error: debajo del campo que lo causa, o al final. */
type Fallo = { campo: "email" | "clave" | "otp" | "mayor" | "general"; texto: string } | null;

/** Bandera para aplicar el "quiero ofertas" cuando ya hay sesión (la lee /perfil). */
export const CLAVE_OFERTAS = "tc_ofertas_pendiente";

const ETIQUETA_ROL: Record<Rol, string> = { tardicola: "Tardícola", dj: "DJ", local: "Local", promotor: "organizador" };

const TIPOS = [
  { k: "tardicola", titulo: "Tardícola", texto: "Voy a tardeos y quiero guardar planes.", icono: PartyPopper },
  { k: "dj", titulo: "DJ", texto: "Pincho y quiero que me encuentren.", icono: Disc3 },
  { k: "local", titulo: "Local o evento", texto: "Organizo tardeos y quiero publicarlos.", icono: Store },
] as const;

/* ======================================================================
 * SIN SESIÓN: entrar o crear cuenta.
 *
 * Antes el método por defecto era el código por email y la contraseña era
 * un enlace pequeño debajo: quien tenía contraseña pulsaba "Enviarme un
 * código" sin querer y no entendía qué pasaba. Ahora son dos opciones del
 * mismo peso y por defecto la contraseña, que es lo que la gente espera.
 * ==================================================================== */
export default function Acceso() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("login");
  const [metodo, setMetodo] = useState<Metodo>("clave");
  const [rol, setRol] = useState<Rol>("tardicola");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [otp, setOtp] = useState("");
  const [mayor, setMayor] = useState(false);
  const [ofertas, setOfertas] = useState(false);
  // form → (codigo: escribir el código) | (revisa: mirar el correo)
  const [paso, setPaso] = useState<"form" | "codigo" | "revisa">("form");
  const [revisa, setRevisa] = useState<"recuperar" | "confirmar">("recuperar");
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState<Fallo>(null);
  const [info, setInfo] = useState("");
  // "Entrar" con código y un email sin cuenta: se ofrece crearla.
  const [noExiste, setNoExiste] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  // ?rol=dj|local|promotor|tardicola y ?modo=signup llegan desde /unirse y
  // los botones de "Únete": se abre directamente "Crear cuenta" con el tipo
  // ya marcado.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("rol");
    if (r === "dj" || r === "local" || r === "promotor" || r === "tardicola") { setRol(r); setModo("signup"); }
    if (q.get("modo") === "signup") setModo("signup");
  }, []);

  const limpiar = () => { setFallo(null); setInfo(""); setNoExiste(false); };
  const cambiarModo = (m: Modo) => { setModo(m); setPaso("form"); setOtp(""); limpiar(); };
  const cambiarMetodo = (m: Metodo) => { setMetodo(m); limpiar(); };

  // A dónde se va tras entrar. Al CREAR: el tardícola a su cuenta y los
  // demás a crear su ficha. Al ENTRAR: con ?volver= (vienes de un panel), a
  // él; si no, cada cuenta a su portal (lib/inicio.ts). Para Google y el
  // enlace del correo aún no sabemos quién es: se vuelve a /perfil?tras=login
  // y allí se decide.
  // ?volver= manda SIEMPRE, también al crear cuenta: quien llega con una
  // invitación (/reclamar?token=…) y elige "Local" tiene que volver a
  // reclamar SU ficha, no ir a /unirse a crear otra duplicada.
  // El tardícola recién llegado va al Inicio de la app: allí ve planes y el
  // bloque «ADN Tardícola» le invita (opcional) a contar qué le mueve.
  const destino = (alta: boolean) =>
    leerVolver() ?? (alta ? (rol !== "tardicola" ? `/unirse?rol=${rol}` : "/") : TRAS_LOGIN);

  const irTrasEntrar = async (uid: string) => {
    if (modo === "signup") { router.push(destino(true)); return; }
    router.push(leerVolver() ?? (await rutaDeInicio(uid)));
  };

  /** Lo común a crear cuenta por cualquier vía: mayor de edad y ofertas. */
  const prepararAlta = (): boolean => {
    if (!mayor) { setFallo({ campo: "mayor", texto: "Marca que eres mayor de 18 años para crear la cuenta." }); return false; }
    if (ofertas) { try { localStorage.setItem(CLAVE_OFERTAS, "1"); } catch { /* sin almacenamiento */ } }
    return true;
  };

  const google = async () => {
    limpiar();
    if (modo === "signup" && !prepararAlta()) return;
    setCargando(true);
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + destino(modo === "signup") },
    });
    // Si va bien, el navegador ya se ha ido a Google.
    if (e) { setCargando(false); setFallo({ campo: "general", texto: traducir(e.message) }); }
  };

  const emailValido = (): boolean => {
    if (!email.trim()) { setFallo({ campo: "email", texto: "Escribe tu email." }); emailRef.current?.focus(); return false; }
    return true;
  };

  const enviarCodigo = async () => {
    limpiar();
    if (!emailValido()) return;
    if (modo === "signup" && !prepararAlta()) return;
    setCargando(true);
    // En "Entrar" NO se crea la cuenta: antes un email mal escrito creaba
    // una cuenta nueva y vacía, y la persona no veía sus planes.
    const { error: e } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}${destino(modo === "signup")}`, shouldCreateUser: modo === "signup" },
    });
    setCargando(false);
    if (e && modo === "login" && esCuentaInexistente(e.message)) { setPaso("form"); setNoExiste(true); return; }
    if (e) { setFallo({ campo: "email", texto: traducir(e.message) }); return; }
    setPaso("codigo");
    setInfo(`Te hemos enviado un código de 6 cifras a ${email.trim()}. También puedes pulsar el enlace del correo.`);
  };

  const verificar = async () => {
    setFallo(null);
    if (!/^\d{6}$/.test(otp.trim())) { setFallo({ campo: "otp", texto: "El código tiene 6 cifras." }); return; }
    setCargando(true);
    const { data, error: e } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: "email" });
    setCargando(false);
    if (e || !data.session) { setFallo({ campo: "otp", texto: "Código incorrecto o caducado. Pide otro." }); return; }
    await irTrasEntrar(data.session.user.id);
  };

  const entrarConClave = async () => {
    limpiar();
    if (!emailValido()) return;
    if (!clave) { setFallo({ campo: "clave", texto: "Escribe tu contraseña." }); return; }
    setCargando(true);
    const { data, error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave });
    if (e || !data.user) {
      setCargando(false);
      const t = traducir(e?.message ?? "No se pudo entrar.");
      setFallo({ campo: /email/i.test(t) && !/contraseña/i.test(t) ? "email" : "clave", texto: t });
      return;
    }
    await irTrasEntrar(data.user.id);
  };

  /**
   * Crear cuenta con contraseña. Si el proyecto pide confirmar el email,
   * signUp no da sesión: se avisa de que mire el correo. Si el email ya
   * tenía cuenta, Supabase devuelve un usuario sin identidades (para no
   * revelar quién está registrado): lo decimos claro y le llevamos a entrar.
   */
  const crearConClave = async () => {
    limpiar();
    if (!emailValido()) return;
    if (clave.length < 6) { setFallo({ campo: "clave", texto: "La contraseña debe tener al menos 6 caracteres." }); return; }
    if (!prepararAlta()) return;
    setCargando(true);
    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim(), password: clave,
      options: { emailRedirectTo: window.location.origin + destino(true) },
    });
    if (e) {
      setCargando(false);
      const t = traducir(e.message);
      setFallo({ campo: /contraseña/i.test(t) ? "clave" : "email", texto: t });
      return;
    }
    if (data.user && data.user.identities?.length === 0) {
      setCargando(false);
      setFallo({ campo: "email", texto: "Ese email ya tiene cuenta. Pulsa «Entrar» arriba para acceder." });
      return;
    }
    if (data.session) { router.push(destino(true)); return; }
    setCargando(false);
    setRevisa("confirmar"); setPaso("revisa");
  };

  const recuperar = async () => {
    limpiar();
    if (!email.trim()) {
      setFallo({ campo: "email", texto: "Escribe tu email y te mandamos un enlace para crear una contraseña nueva." });
      emailRef.current?.focus();
      return;
    }
    setCargando(true);
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/perfil",
    });
    setCargando(false);
    if (e) { setFallo({ campo: "email", texto: traducir(e.message) }); return; }
    setRevisa("recuperar"); setPaso("revisa");
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    if (paso === "codigo") { verificar(); return; }
    if (metodo === "codigo") { enviarCodigo(); return; }
    if (modo === "login") entrarConClave(); else crearConClave();
  };

  const alta = modo === "signup";
  const textoBoton = alta
    ? `Crear cuenta de ${ETIQUETA_ROL[rol]}`
    : metodo === "clave" ? "Entrar" : "Enviarme un código";

  return (
    <main className="mx-auto max-w-6xl px-4 pb-14 pt-4 md:px-8 md:pt-10">
      <div className="grid overflow-hidden rounded-[28px] border border-linea bg-white shadow-elevada lg:grid-cols-[0.95fr_1.05fr]">
        <PanelMarca />

        {/* ---------- Formulario ---------- */}
        <section aria-labelledby="acceso-titulo" className="p-5 sm:p-8 lg:p-10">
          <h2 id="acceso-titulo" className="text-[26px] font-extrabold leading-tight tracking-tight md:text-[30px]">
            {alta ? "Crea tu cuenta" : "Hola de nuevo"}
          </h2>
          <p className="mt-1 text-[16px] text-tinta-suave">
            {alta ? "Gratis y en un minuto." : "Entra para ver tus planes y tus avisos."}
          </p>

          {/* Pestañas grandes: Entrar / Crear cuenta */}
          <div role="tablist" aria-label="Entrar o crear cuenta" className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-marfil-100 p-1.5">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m} type="button" role="tab" id={`tab-${m}`} aria-selected={modo === m} aria-controls="acceso-panel"
                onClick={() => cambiarModo(m)}
                className={`min-h-[52px] rounded-xl text-[17px] font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta ${
                  modo === m ? "bg-white text-tinta shadow-tarjeta" : "text-tinta-suave hover:text-tinta"
                }`}
              >
                {m === "login" ? "Entrar" : "Crear cuenta"}
              </button>
            ))}
          </div>

          <div id="acceso-panel" role="tabpanel" aria-labelledby={`tab-${modo}`}>
            {paso === "revisa" ? (
              <div className="mt-8 flex flex-col items-center gap-3 text-center" role="status">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-magenta-50 text-magenta"><Mail size={30} aria-hidden /></span>
                <p className="text-xl font-bold">Revisa tu email</p>
                <p className="text-[16px] text-tinta-suave">
                  {revisa === "recuperar"
                    ? <>Te hemos enviado a <b className="text-tinta">{email}</b> un enlace para crear una contraseña nueva.</>
                    : <>Te hemos enviado a <b className="text-tinta">{email}</b> un enlace para confirmar tu cuenta. Púlsalo y entrarás directamente.</>}
                </p>
                <p className="text-[15px] text-tinta-suave">Si no lo ves en un par de minutos, mira en «Correo no deseado».</p>
                <Boton variante="contorno" tamano="pequeno" onClick={() => setPaso("form")}>Volver</Boton>
              </div>
            ) : (
              <form onSubmit={enviar} noValidate className="mt-5 flex flex-col">
                {/* ---- Crear cuenta: primero, qué eres ---- */}
                {alta && paso === "form" && (
                  <fieldset className="mb-5">
                    <legend className="text-[16px] font-bold">¿Qué eres?</legend>
                    <div role="radiogroup" aria-label="Tipo de cuenta" className="mt-2 grid gap-2 sm:grid-cols-3">
                      {TIPOS.map((t) => {
                        const on = rol === t.k || (t.k === "local" && rol === "promotor");
                        const Icono = t.icono;
                        return (
                          <button
                            key={t.k} type="button" role="radio" aria-checked={on}
                            onClick={() => { setRol(t.k); setFallo(null); }}
                            className={`relative flex min-h-[56px] items-center gap-3 rounded-2xl border-2 p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta sm:flex-col sm:items-start sm:gap-2 ${
                              on ? "border-magenta bg-magenta-50" : "border-linea bg-white hover:border-tinta/30"
                            }`}
                          >
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${on ? "bg-magenta text-white" : "bg-marfil-100 text-tinta"}`}>
                              <Icono size={21} aria-hidden />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[16px] font-bold leading-tight">{t.titulo}</span>
                              <span className="mt-0.5 block text-[14px] leading-snug text-tinta-suave">{t.texto}</span>
                            </span>
                            {on && (
                              <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-magenta text-white">
                                <Check size={15} strokeWidth={3} aria-hidden />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {rol !== "tardicola" && (
                      <p className="mt-2 text-[15px] text-tinta-suave">
                        Al terminar te pedimos los datos de tu {rol === "dj" ? "perfil de DJ" : "local o evento"}.
                      </p>
                    )}
                  </fieldset>
                )}

                {/* ---- Entrar: Google arriba ---- */}
                {!alta && paso === "form" && (
                  <>
                    <BotonGoogle onClick={google} disabled={cargando} />
                    <Separador />
                  </>
                )}

                {/* ---- Email ---- */}
                <label htmlFor="acceso-email" className="text-[16px] font-bold">Email</label>
                <div className="relative mt-1.5">
                  <Mail size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden />
                  <input
                    id="acceso-email" ref={emailRef} type="email" name="email" autoComplete="email" inputMode="email"
                    value={email} onChange={(e) => setEmail(e.target.value)} disabled={paso === "codigo"}
                    placeholder="tucorreo@email.com"
                    aria-invalid={fallo?.campo === "email" || undefined}
                    aria-describedby={fallo?.campo === "email" ? "error-email" : undefined}
                    className={`${claseCampo} pl-11 ${fallo?.campo === "email" ? "!border-error" : ""}`}
                  />
                </div>
                <Error id="error-email" fallo={fallo} campo="email" />

                {paso === "codigo" ? (
                  <div className="mt-4 flex flex-col gap-3">
                    {info && <p role="status" className="rounded-xl bg-ok-fondo px-3 py-2.5 text-[15px] font-medium text-ok">{info}</p>}
                    <label htmlFor="acceso-otp" className="text-[16px] font-bold">Código de 6 cifras</label>
                    <input
                      id="acceso-otp" name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
                      value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="123456"
                      aria-invalid={fallo?.campo === "otp" || undefined}
                      aria-describedby={fallo?.campo === "otp" ? "error-otp" : undefined}
                      className={`${claseCampo} text-center text-2xl font-bold tracking-[0.4em] ${fallo?.campo === "otp" ? "!border-error" : ""}`}
                    />
                    <Error id="error-otp" fallo={fallo} campo="otp" />
                    <Boton type="submit" cargando={cargando} ancho>Verificar y entrar</Boton>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Boton variante="contorno" tamano="pequeno" onClick={() => { setPaso("form"); setOtp(""); limpiar(); }}>Cambiar email</Boton>
                      <Boton variante="contorno" tamano="pequeno" onClick={enviarCodigo} disabled={cargando}>Enviar otro código</Boton>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* ---- Método: dos opciones del mismo peso ---- */}
                    <p id="acceso-metodo" className="mt-5 text-[16px] font-bold">{alta ? "¿Cómo quieres entrar luego?" : "¿Cómo quieres entrar?"}</p>
                    {/* Apiladas en móvil: a 390 px, lado a lado, «Con código por email» se
                        partía en dos líneas y parecían dos botones de distinto tamaño. */}
                    <div role="radiogroup" aria-labelledby="acceso-metodo" className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <OpcionMetodo on={metodo === "clave"} onClick={() => cambiarMetodo("clave")} icono={<KeyRound size={19} aria-hidden />}>
                        Con contraseña
                      </OpcionMetodo>
                      <OpcionMetodo on={metodo === "codigo"} onClick={() => cambiarMetodo("codigo")} icono={<Mail size={19} aria-hidden />}>
                        Con código por email
                      </OpcionMetodo>
                    </div>

                    {metodo === "clave" ? (
                      <div className="mt-4">
                        <div className="flex flex-wrap items-end justify-between gap-x-3">
                          <label htmlFor="acceso-clave" className="text-[16px] font-bold">{alta ? "Crea una contraseña" : "Contraseña"}</label>
                          {!alta && (
                            <button type="button" onClick={recuperar} disabled={cargando}
                              className="-mr-2 min-h-[44px] rounded-lg px-2 text-[15px] font-bold text-magenta-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-magenta">
                              ¿Olvidaste tu contraseña?
                            </button>
                          )}
                        </div>
                        <div className="relative mt-1.5">
                          <Lock size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden />
                          <input
                            id="acceso-clave" name="password" type={verClave ? "text" : "password"}
                            autoComplete={alta ? "new-password" : "current-password"}
                            value={clave} onChange={(e) => setClave(e.target.value)}
                            aria-invalid={fallo?.campo === "clave" || undefined}
                            aria-describedby={[alta ? "ayuda-clave" : "", fallo?.campo === "clave" ? "error-clave" : ""].filter(Boolean).join(" ") || undefined}
                            className={`${claseCampo} pl-11 pr-14 ${fallo?.campo === "clave" ? "!border-error" : ""}`}
                          />
                          <button
                            type="button" onClick={() => setVerClave((v) => !v)}
                            aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={verClave}
                            className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-tinta-suave hover:bg-marfil-100 hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-magenta"
                          >
                            {verClave ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
                          </button>
                        </div>
                        {alta && <p id="ayuda-clave" className="mt-1.5 text-[14px] text-tinta-suave">Mínimo 6 caracteres.</p>}
                        <Error id="error-clave" fallo={fallo} campo="clave" />
                      </div>
                    ) : (
                      <p className="mt-3 rounded-xl bg-marfil-100 px-3.5 py-3 text-[15px] text-tinta-suave">
                        Sin contraseña: te mandamos un código de 6 cifras a tu email y lo escribes aquí.
                      </p>
                    )}

                    {alta && (
                      <div className="mt-4 flex flex-col gap-1">
                        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 text-[16px] font-medium">
                          <input
                            type="checkbox" checked={mayor} onChange={(e) => { setMayor(e.target.checked); if (fallo?.campo === "mayor") setFallo(null); }}
                            aria-invalid={fallo?.campo === "mayor" || undefined}
                            aria-describedby={fallo?.campo === "mayor" ? "error-mayor" : undefined}
                            className="h-6 w-6 shrink-0 accent-magenta"
                          />
                          Soy mayor de 18 años
                        </label>
                        <Error id="error-mayor" fallo={fallo} campo="mayor" />
                        <label className="flex cursor-pointer items-start gap-3 py-1 text-[16px] font-medium">
                          <input type="checkbox" checked={ofertas} onChange={(e) => setOfertas(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-magenta" />
                          <span>
                            Quiero recibir ofertas y novedades por email
                            <span className="block text-[14px] font-normal text-tinta-suave">Opcional. Lo cambias cuando quieras desde tu cuenta.</span>
                          </span>
                        </label>
                      </div>
                    )}

                    {noExiste && !alta && (
                      <div role="alert" className="mt-4 rounded-xl border border-aviso/30 bg-aviso-fondo p-4">
                        <p className="text-[16px] font-bold text-tinta">No hay ninguna cuenta con ese email.</p>
                        <p className="mt-0.5 text-[15px] text-tinta-suave">Revisa que esté bien escrito o, si es la primera vez, créala ahora.</p>
                        <Boton variante="oro" tamano="pequeno" onClick={() => cambiarModo("signup")} className="mt-3">
                          <UserPlus size={18} aria-hidden /> Crear una cuenta
                        </Boton>
                      </div>
                    )}

                    <Error id="error-general" fallo={fallo} campo="general" />

                    <Boton type="submit" cargando={cargando} ancho className="mt-5 !min-h-[54px] !text-[18px]">
                      {textoBoton}
                    </Boton>

                    {/* Al crear, Google va al final: la casilla de mayor de edad
                        tiene que estar marcada antes y así queda por encima. */}
                    {alta && (
                      <>
                        <Separador texto="o regístrate con" />
                        <BotonGoogle onClick={google} disabled={cargando} />
                      </>
                    )}
                  </>
                )}
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-[14px] text-tinta-suave">
            Al continuar aceptas el <Link href="/legal/aviso-legal" className="font-semibold underline">aviso legal</Link> y
            la <Link href="/legal/privacidad" className="font-semibold underline">política de privacidad</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}

/** El lado de marca: foto de ambiente, el titular de siempre y tres ventajas. */
function PanelMarca() {
  return (
    <aside className="relative isolate overflow-hidden text-white">
      <Image
        src={foto(FOTOS.concierto, 1100)} alt="" fill unoptimized priority
        sizes="(min-width: 1024px) 540px, 100vw" className="-z-20 object-cover"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-magenta/85 via-fuchsia-700/75 to-purple-900/90" />
      <div className="flex h-full flex-col gap-5 p-6 sm:p-8 lg:p-10">
        <Link href="/" aria-label="TardeosClub, inicio" className="w-fit">
          <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-white shadow-tarjeta">
            <Image src="/branding/logo-transp.png" alt="" width={120} height={70} className="h-auto w-11" />
          </span>
        </Link>
        <div className="lg:mt-auto">
          <h1 className="text-[30px] font-extrabold leading-[1.08] tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)] sm:text-[36px] lg:text-[42px]">
            El buscador de <span className="texto-oro">tardeos</span> que va contigo
          </h1>
          <p className="mt-2 font-script text-[24px] leading-tight text-white/95 lg:text-[28px]">Tu tarde empieza aquí</p>
        </div>
        {/* En el móvil se queda en titular: el formulario tiene que verse ya. */}
        <ul className="hidden flex-col gap-3 lg:flex">
          <Ventaja icono={<Ticket size={20} aria-hidden />} titulo="Es gratis" texto="Crear tu cuenta de tardícola no cuesta nada." />
          <Ventaja icono={<Heart size={20} aria-hidden />} titulo="Guarda tus planes" texto="Los tardeos que te gustan, a mano en «Mis planes»." />
          <Ventaja icono={<BellRing size={20} aria-hidden />} titulo="Avisos a tiempo" texto="Te recordamos tus tardeos para que no se te pasen." />
        </ul>
      </div>
    </aside>
  );
}

function Ventaja({ icono, titulo, texto }: { icono: ReactNode; titulo: string; texto: string }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-white/10 p-3.5 backdrop-blur-sm ring-1 ring-white/20">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-oro-400 text-sobre-oro">{icono}</span>
      <span>
        <span className="block text-[17px] font-bold leading-tight">{titulo}</span>
        <span className="mt-0.5 block text-[15px] leading-snug text-white/90">{texto}</span>
      </span>
    </li>
  );
}

function OpcionMetodo({ on, onClick, icono, children }: { on: boolean; onClick: () => void; icono: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button" role="radio" aria-checked={on} onClick={onClick}
      className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 px-2 text-center text-[15px] font-bold leading-tight transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta sm:text-[16px] ${
        on ? "border-magenta bg-magenta-50 text-magenta-700" : "border-linea bg-white text-tinta hover:border-tinta/30"
      }`}
    >
      <span className="shrink-0">{icono}</span>
      {children}
    </button>
  );
}

function Error({ id, fallo, campo }: { id: string; fallo: Fallo; campo: NonNullable<Fallo>["campo"] }) {
  if (fallo?.campo !== campo) return null;
  return <p id={id} role="alert" className="mt-1.5 text-[15px] font-semibold text-error">{fallo.texto}</p>;
}

function Separador({ texto = "o con tu email" }: { texto?: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[14px] font-medium text-tinta-suave">
      <span className="h-px flex-1 bg-linea" /> {texto} <span className="h-px flex-1 bg-linea" />
    </div>
  );
}

function BotonGoogle({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex min-h-tacto w-full items-center justify-center gap-3 rounded-xl border border-linea-fuerte bg-white px-4 text-[16px] font-bold text-tinta transition hover:bg-marfil focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-magenta disabled:opacity-60">
      <GoogleIcon /> Continuar con Google
    </button>
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
