"use client";

import { ReactNode, useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import Hoja from "@/components/ui/Hoja";
import Boton from "@/components/Boton";
import Campo, { claseCampo } from "@/components/ui/Campo";
import { whatsappTardeos } from "@/components/ServiciosExternos";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

/**
 * «¿Algo no funciona?»: botón + hoja para que cualquiera (con o sin cuenta)
 * avise de un problema. Va a la tabla `incidencias` (lote 57) y el admin lo ve
 * en /admin/incidencias.
 *
 * Antes la única vía era un WhatsApp sin contexto («no me va»). Aquí se
 * adjunta solo lo que el admin necesita para reproducirlo: la página en la que
 * estaba, su papel (tardícola, local, DJ…) y el navegador.
 */
type Tipo = "error" | "duda" | "sugerencia" | "otro";
type Rol = "tardicola" | "local" | "dj" | "admin" | "anonimo";

const TIPOS: { clave: Tipo; label: string }[] = [
  { clave: "error", label: "Algo falla" },
  { clave: "duda", label: "Tengo una duda" },
  { clave: "sugerencia", label: "Sugerencia" },
  { clave: "otro", label: "Otra cosa" },
];

const NO_EXISTE = new Set(["42P01", "PGRST205", "PGRST204", "42703"]);
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Su papel en la web, para que el admin sepa desde qué panel escribe. */
async function rolDe(uid: string | undefined): Promise<Rol> {
  if (!uid) return "anonimo";
  try {
    const [p, l, d] = await Promise.all([
      supabase.from("profiles").select("is_admin").eq("id", uid).maybeSingle(),
      supabase.from("locales").select("id").eq("owner_id", uid).limit(1),
      supabase.from("djs").select("id").eq("profile_id", uid).limit(1),
    ]);
    if (p.data?.is_admin) return "admin";
    if (l.data?.length) return "local";
    if (d.data?.length) return "dj";
  } catch { /* si no se sabe, tardícola */ }
  return "tardicola";
}

export default function ReportarProblema({
  etiqueta = "¿Algo no funciona?", className, error,
}: {
  /** Lo que se ve en el botón que abre la hoja. */
  etiqueta?: ReactNode;
  className?: string;
  /** Error técnico ya ocurrido (pantalla de error): se adjunta solo. */
  error?: { mensaje: string; digest?: string } | null;
}) {
  const { user } = useAuth();
  const [abierta, setAbierta] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("error");
  const [mensaje, setMensaje] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<{ texto: string; whatsapp?: boolean } | null>(null);
  const [hecho, setHecho] = useState(false);

  const abrir = () => {
    setHecho(false); setFallo(null); setTipo("error");
    setMensaje(error ? "Me ha salido una pantalla de error al usar la web." : "");
    setAbierta(true);
  };

  const largo = mensaje.trim().length;
  const emailMal = !user && !EMAIL.test(email.trim());

  const enviar = async () => {
    if (largo < 10) { setFallo({ texto: "Cuéntanos un poco más (al menos 10 letras)." }); return; }
    if (emailMal) { setFallo({ texto: "Déjanos un email para poder contestarte." }); return; }
    setEnviando(true); setFallo(null);

    // El error técnico va al final del mensaje, recortado para no pasar de 2.000.
    const tecnico = error ? `\n\n— Error: ${error.mensaje}${error.digest ? ` (digest ${error.digest})` : ""}` : "";
    const texto = (mensaje.trim() + tecnico).slice(0, 2000);

    const { error: e } = await supabase.from("incidencias").insert({
      profile_id: user?.id ?? null,
      email_contacto: (user?.email ?? email.trim()) || null,
      rol: await rolDe(user?.id),
      tipo,
      mensaje: texto,
      url: window.location.href.slice(0, 500),
      user_agent: navigator.userAgent.slice(0, 400),
    });
    setEnviando(false);

    if (e) {
      if (NO_EXISTE.has(e.code ?? "")) setFallo({ texto: "Falta pegar el lote 57 en la base de datos, así que esto aún no se puede guardar.", whatsapp: true });
      else setFallo({ texto: `No se pudo enviar: ${e.message}`, whatsapp: true });
      return;
    }
    setHecho(true);
  };

  const whatsapp = whatsappTardeos(
    `Hola, tengo un problema en ${typeof window !== "undefined" ? window.location.href : "la web"}: ${mensaje.trim()}`.slice(0, 1500),
  );

  return (
    <>
      <button type="button" onClick={abrir} className={className}>{etiqueta}</button>

      {/* text-left: la hoja hereda la alineación de donde se monte (la
          pantalla de error va centrada). */}
      {abierta && <div className="text-left">
      <Hoja
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        titulo={hecho ? "Recibido" : "Avisar de un problema"}
        pie={hecho ? (
          <Boton ancho onClick={() => setAbierta(false)}>Cerrar</Boton>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Boton ancho onClick={enviar} cargando={enviando}>Enviar aviso</Boton>
            <Boton ancho variante="contorno" onClick={() => setAbierta(false)}>Cancelar</Boton>
          </div>
        )}
      >
        {hecho ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
            <CheckCircle2 size={44} className="text-ok" aria-hidden />
            <p className="text-lg font-bold">Recibido, te contestamos en cuanto lo veamos.</p>
            <p className="text-[15px] text-tinta-suave">
              Te escribiremos a <b className="text-tinta">{user?.email ?? email.trim()}</b>. Gracias por avisar: así lo arreglamos antes.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <fieldset>
              <legend className="mb-1.5 text-[15px] font-semibold">¿Qué pasa?</legend>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS.map((t) => (
                  <button key={t.clave} type="button" aria-pressed={tipo === t.clave} onClick={() => setTipo(t.clave)}
                    className={`min-h-[44px] rounded-xl border px-3 text-[15px] font-semibold transition-colors ${
                      tipo === t.clave ? "border-magenta bg-magenta-50 text-magenta-700" : "border-linea-fuerte bg-white text-tinta hover:bg-marfil"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <Campo etiqueta="Cuéntanoslo" htmlFor="rp-mensaje" ayuda={`Qué intentabas hacer y qué ha pasado. ${largo}/1800`}>
              <textarea id="rp-mensaje" value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={5} maxLength={1800}
                placeholder="Ej.: al pulsar «Me apunto» no pasa nada" className={claseCampo} />
            </Campo>

            {!user && (
              <Campo etiqueta="Tu email" htmlFor="rp-email" ayuda="Para poder contestarte. No lo usamos para nada más.">
                <input id="rp-email" type="email" inputMode="email" autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" className={claseCampo} />
              </Campo>
            )}

            <p className="text-sm text-tinta-suave">
              Se adjunta solo la página en la que estás{error ? ", el error que ha salido" : ""} y tu navegador, para poder reproducirlo.
            </p>

            {fallo && (
              <div role="alert" className="rounded-xl border border-error/20 bg-error-fondo p-4 text-[15px] font-semibold text-error">
                <p>{fallo.texto}</p>
                {fallo.whatsapp ? (
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex min-h-[44px] items-center gap-2 text-tinta underline underline-offset-2">
                    <MessageCircle size={18} aria-hidden /> Mejor avísanos por WhatsApp
                  </a>
                ) : null}
              </div>
            )}
          </div>
        )}
      </Hoja>
      </div>}
    </>
  );
}
