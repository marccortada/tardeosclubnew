"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { entrarYVolver } from "@/lib/volver";
import Boton, { claseBoton } from "@/components/Boton";
import { claseCampo } from "@/components/ui/Campo";
import Hoja from "@/components/ui/Hoja";
import HojaContrasena from "@/components/cuenta/HojaContrasena";
import { traducirAuth } from "@/components/cuenta/traducirAuth";
import { MarcoCuenta, CargandoCuenta, useDatosCuenta, useCerrarSesion, invalidarDatosCuenta } from "@/components/panel/CuentaNav";
import { Check, KeyRound, LogOut, Mail, Trash2, UserRound } from "lucide-react";

/**
 * Ajustes de la cuenta: nombre, email, contraseña, salir y borrar la cuenta.
 * Antes la contraseña y "Cerrar sesión" estaban al final del resumen, entre
 * los planes, y no se encontraban.
 */
export default function Ajustes() {
  const { user, loading, datos, recargar } = useDatosCuenta();
  const [hojaClave, setHojaClave] = useState(false);
  const [hojaBorrar, setHojaBorrar] = useState(false);
  const { salir, saliendo, error: errorSalir } = useCerrarSesion();
  // Tras borrar, la sesión desaparece: este aviso va antes que el "entra".
  const [borrada, setBorrada] = useState(false);

  if (borrada) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-16">
        <div role="status" className="flex flex-col items-center gap-3 rounded-2xl border border-linea bg-white p-8 text-center shadow-tarjeta">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-ok-fondo text-ok"><Check size={28} aria-hidden /></span>
          <h1 className="text-2xl font-bold">Tu cuenta se ha borrado</h1>
          <p className="text-[16px] text-tinta-suave">Hemos eliminado tus datos. Si algún día quieres volver, crea una cuenta nueva cuando quieras.</p>
          <Link href="/" className={claseBoton("primario", "normal", false, "mt-2")}>Ir a la portada</Link>
        </div>
      </main>
    );
  }
  if (loading) return <CargandoCuenta />;
  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-16 text-center">
        <p className="text-lg font-semibold">Entra en tu cuenta para ver tus ajustes.</p>
        <Link href={entrarYVolver("/perfil/ajustes")} className={claseBoton("primario", "normal", false, "mt-4")}>Entrar</Link>
      </main>
    );
  }

  return (
    <MarcoCuenta titulo="Ajustes" descripcion="Tus datos de acceso y tu cuenta." datos={datos} ancho="estrecho">
      <div className="flex flex-col gap-4">
        <Bloque icono={UserRound} titulo="Tu nombre">
          {/* key: los datos llegan tras el primer pintado; al llegar, el campo se rehace con el nombre real (y solo entonces: guardar no lo borra). */}
          <CampoNombre key={datos ? "con-datos" : "sin-datos"} uid={user.id} inicial={datos?.nombre ?? ""} onGuardado={recargar} />
        </Bloque>

        <Bloque icono={Mail} titulo="Email">
          <CampoEmail actual={user.email ?? ""} pendiente={user.new_email ?? null} />
        </Bloque>

        <Bloque icono={KeyRound} titulo="Contraseña">
          <p className="text-[15px] text-tinta-suave">Opcional. Sirve para entrar sin esperar el código por email. Si ya tienes, aquí la cambias.</p>
          <Boton variante="contorno" tamano="pequeno" onClick={() => setHojaClave(true)} className="mt-3">Crear o cambiar contraseña</Boton>
        </Bloque>

        <Bloque icono={LogOut} titulo="Cerrar sesión">
          <p className="text-[15px] text-tinta-suave">Sales de tu cuenta en este dispositivo. Tus planes y gustos se quedan guardados.</p>
          <Boton variante="contorno" tamano="pequeno" onClick={salir} cargando={saliendo} className="mt-3">
            <LogOut size={18} aria-hidden /> Cerrar sesión
          </Boton>
          {errorSalir && <p role="alert" className="mt-2 text-[15px] font-semibold text-error">{errorSalir}</p>}
        </Bloque>

        {/* Zona peligrosa: separada, en rojo y con doble confirmación. */}
        <section className="mt-4 rounded-2xl border border-error/30 bg-error-fondo/40 p-4 md:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-error"><Trash2 size={20} aria-hidden /> Zona peligrosa</h2>
          <p className="mt-1 text-[15px] text-tinta">
            Borrar tu cuenta elimina para siempre tus datos: guardados, plazas reservadas, gustos y avisos.
            {(datos?.ficha || datos?.esDj) && " Las fichas de local o DJ que lleves NO se borran: se quedan sin dueño y se pueden reclamar."}
          </p>
          <Boton variante="peligro" tamano="pequeno" onClick={() => setHojaBorrar(true)} className="mt-3">Borrar mi cuenta</Boton>
        </section>
      </div>

      <HojaContrasena abierta={hojaClave} onCerrar={() => setHojaClave(false)} />
      <HojaBorrar abierta={hojaBorrar} onCerrar={() => setHojaBorrar(false)} uid={user.id} onBorrada={() => setBorrada(true)} />
    </MarcoCuenta>
  );
}

function Bloque({ icono: Icono, titulo, children }: { icono: typeof Mail; titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex gap-3 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-6">
      <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl bg-marfil-100 text-tinta sm:grid"><Icono size={21} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold">{titulo}</h2>
        <div className="mt-1">{children}</div>
      </div>
    </section>
  );
}

function CampoNombre({ uid, inicial, onGuardado }: { uid: string; inicial: string; onGuardado: () => void }) {
  const [nombre, setNombre] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const guardar = async () => {
    const limpio = nombre.trim().replace(/\s+/g, " ");
    setError(""); setOk(false);
    if (limpio.length < 2) { setError("Escribe al menos 2 letras."); return; }
    if (limpio.length > 60) { setError("Máximo 60 caracteres."); return; }
    setGuardando(true);
    // Con .select(): si RLS no deja escribir, Supabase no da error pero no
    // devuelve filas. Sin comprobarlo diríamos "guardado" sin estarlo.
    const { data, error: e } = await supabase.from("profiles").update({ display_name: limpio }).eq("id", uid).select("display_name");
    setGuardando(false);
    if (e || !data?.length) { setError("No se pudo guardar el nombre. Inténtalo otra vez."); return; }
    setNombre(data[0].display_name ?? limpio);
    setOk(true);
    invalidarDatosCuenta(uid);
    onGuardado();
  };

  return (
    <>
      <p className="text-[15px] text-tinta-suave">Es el nombre que ven los locales en sus listas cuando te apuntas a un tardeo. Usa el tuyo de verdad para que te encuentren en la puerta.</p>
      <label htmlFor="ajustes-nombre" className="sr-only">Tu nombre</label>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input id="ajustes-nombre" value={nombre} maxLength={60} autoComplete="name"
          onChange={(e) => { setNombre(e.target.value); setOk(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") guardar(); }}
          className={claseCampo} placeholder="Nombre y apellido" />
        <Boton onClick={guardar} cargando={guardando} tamano="pequeno" disabled={nombre.trim() === inicial.trim()} className="sm:shrink-0">Guardar</Boton>
      </div>
      {error && <p role="alert" className="mt-2 text-[15px] font-semibold text-error">{error}</p>}
      {ok && <p role="status" className="mt-2 flex items-center gap-1.5 text-[15px] font-semibold text-ok"><Check size={18} aria-hidden /> Nombre guardado.</p>}
    </>
  );
}

function CampoEmail({ actual, pendiente }: { actual: string; pendiente: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState<string | null>(pendiente);

  const cambiar = async () => {
    const nuevo = email.trim().toLowerCase();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevo)) { setError("Ese email no parece válido. Revísalo."); return; }
    if (nuevo === actual.toLowerCase()) { setError("Es el mismo email que ya tienes."); return; }
    setEnviando(true);
    const { error: e } = await supabase.auth.updateUser(
      { email: nuevo },
      { emailRedirectTo: `${window.location.origin}/perfil/ajustes` },
    );
    setEnviando(false);
    if (e) { setError(traducirAuth(e.message)); return; }
    setEnviado(nuevo); setAbierto(false); setEmail("");
  };

  return (
    <>
      <p className="break-all text-[16px] font-semibold">{actual}</p>
      {enviado && (
        <p role="status" className="mt-2 rounded-xl bg-aviso-fondo px-3 py-2 text-[15px] text-tinta">
          Cambio pendiente a <b className="break-all">{enviado}</b>. Abre el correo que te hemos enviado (mira también en el email actual) y confirma. Hasta entonces sigues entrando con <b className="break-all">{actual}</b>.
        </p>
      )}
      {abierto ? (
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor="ajustes-email" className="text-[15px] font-semibold">Email nuevo</label>
          <input id="ajustes-email" type="email" inputMode="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") cambiar(); }}
            className={claseCampo} placeholder="tucorreo@email.com" />
          {error && <p role="alert" className="text-[15px] font-semibold text-error">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Boton onClick={cambiar} cargando={enviando} tamano="pequeno">Enviar confirmación</Boton>
            <Boton variante="contorno" tamano="pequeno" onClick={() => { setAbierto(false); setError(""); }}>Cancelar</Boton>
          </div>
        </div>
      ) : (
        <Boton variante="contorno" tamano="pequeno" onClick={() => setAbierto(true)} className="mt-3">Cambiar email</Boton>
      )}
    </>
  );
}

function HojaBorrar({ abierta, onCerrar, uid, onBorrada }: { abierta: boolean; onCerrar: () => void; uid: string; onBorrada: () => void }) {
  const [texto, setTexto] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState("");
  const listo = texto.trim().toUpperCase() === "BORRAR";

  const cerrar = () => { if (borrando) return; setTexto(""); setError(""); onCerrar(); };

  const borrar = async () => {
    if (!listo) return;
    setBorrando(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setError("Tu sesión ha caducado. Sal, vuelve a entrar y repite."); setBorrando(false); return; }
      const r = await fetch("/api/borrar-cuenta", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || "No se pudo borrar la cuenta. Inténtalo más tarde."); setBorrando(false); return; }
    } catch {
      setError("Sin conexión. Comprueba internet y vuelve a probar."); setBorrando(false); return;
    }
    // La cuenta ya no existe: aviso de "borrada" y se limpia la sesión local
    // (la del servidor ya no existe; "local" no intenta revocarla).
    invalidarDatosCuenta(uid);
    onBorrada();
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  };

  return (
    <Hoja
      abierta={abierta}
      onCerrar={cerrar}
      titulo="¿Borrar tu cuenta para siempre?"
      pie={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="contorno" onClick={cerrar} disabled={borrando}>No, mantenerla</Boton>
          <Boton variante="peligro" onClick={borrar} cargando={borrando} disabled={!listo}>Borrar mi cuenta</Boton>
        </div>
      }
    >
      <div className="flex flex-col gap-3 text-[16px]">
        <p>Se borran tu cuenta, tus guardados, tus plazas reservadas, tus gustos y tus avisos. <b>No se puede deshacer.</b></p>
        <p className="text-[15px] text-tinta-suave">Si llevas la ficha de un local o de un DJ, la ficha no se borra: se queda sin dueño.</p>
        <label htmlFor="confirmar-borrar" className="text-[15px] font-semibold">Para confirmar, escribe <b>BORRAR</b></label>
        <input id="confirmar-borrar" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off"
          autoCapitalize="characters" className={claseCampo} placeholder="BORRAR" />
        {error && <p role="alert" className="text-[15px] font-semibold text-error">{error}</p>}
      </div>
    </Hoja>
  );
}
