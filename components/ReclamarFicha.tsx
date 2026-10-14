"use client";

import { useEffect, useState } from "react";
import { claseCampo } from "@/components/ui/Campo";
import { claseBoton } from "@/components/Boton";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { entrarYVolver } from "@/lib/volver";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import { BadgeCheck, Loader2, ShieldQuestion, Check } from "lucide-react";

type Estado = "cargando" | "puede" | "pendiente" | "enviada" | "sinSesion" | "sinTabla";

const Caja = ({ children }: { children: React.ReactNode }) => (
  <section className="rounded-2xl border border-magenta-100 bg-magenta-50/60 p-5 md:p-6">{children}</section>
);

/**
 * «¿Eres el responsable de este perfil?» en las fichas que aún no tiene nadie.
 *
 * TardeosClub publica locales y DJs antes de que ellos lleguen —hoy 62 de 66
 * locales y los 31 DJs— y hasta ahora la única forma de quedarse con la ficha
 * era que el admin mandara un enlace de invitación. Esto es la otra puerta: la
 * que puede empujar el interesado cuando se encuentra a sí mismo publicado.
 *
 * No asigna nada. Deja una solicitud en cola y la aprueba un admin después de
 * comprobar quién es: cualquiera podría decir que lleva el Miracle.
 */
export default function ReclamarFicha({
  tipo,
  objetivoId,
  nombre,
}: {
  tipo: "local" | "dj";
  objetivoId: string;
  nombre: string;
}) {
  const { user, loading } = useAuth();
  // Tras entrar, de vuelta a esta misma ficha para terminar de reclamarla.
  const pathname = usePathname();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [abierto, setAbierto] = useState(false);
  const [cargo, setCargo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    // Sin sesión no hay nada que consultar, pero el reclamo SÍ se enseña: es
    // justo a quien se encuentra publicado sin tener cuenta a quien hay que
    // convencer de que se la haga.
    if (!user) { setEstado("sinSesion"); return; }
    supabase
      .from("solicitudes_reclamacion")
      .select("id,estado")
      .eq("tipo", tipo).eq("objetivo_id", objetivoId).eq("solicitante", user.id)
      .eq("estado", "pendiente")
      .maybeSingle()
      .then(({ data, error }) => {
        // 42P01 = la tabla no existe todavía. Mientras el lote 30 no esté
        // pegado, esto no se enseña en vez de ofrecer un botón que reventaría.
        // Misma convención que el resto de columnas nuevas del proyecto.
        if (error?.code === "42P01") { setEstado("sinTabla"); return; }
        setEstado(data ? "pendiente" : "puede");
      });
  }, [user, loading, tipo, objetivoId]);

  const enviar = async () => {
    if (!user) return;
    setEnviando(true); setError("");
    const { error: e } = await supabase.from("solicitudes_reclamacion").insert({
      tipo, objetivo_id: objetivoId, solicitante: user.id,
      cargo: cargo.trim() || null,
      telefono: telefono.trim() || null,
      mensaje: mensaje.trim() || null,
    });
    setEnviando(false);
    if (e) {
      // El índice único salta si ya hay una pendiente: eso no es un fallo,
      // es que ya está pedida.
      setError(e.code === "23505" ? "Ya tienes una solicitud pendiente para esta ficha." : "No se pudo enviar: " + e.message);
      return;
    }
    setEstado("enviada");
  };

  if (estado === "cargando" || estado === "sinTabla") return null;

  if (estado === "pendiente" || estado === "enviada") {
    return (
      <Caja>
        <p className="flex items-center gap-2 text-lg font-bold">
          <Check size={20} className="shrink-0 text-ok" aria-hidden /> Solicitud enviada
        </p>
        <p className="mt-1 text-tinta-suave">
          Estamos comprobando que llevas {nombre}. Te escribimos en cuanto esté.
        </p>
      </Caja>
    );
  }

  return (
    <Caja>
      <p className="flex items-center gap-2 text-lg font-bold">
        <ShieldQuestion size={20} className="shrink-0 text-magenta" /> ¿Eres el responsable de este perfil?
      </p>
      <p className="mt-1 text-tinta-suave">
        Ya te estamos publicando en TardeosClub. Reclámalo y podrás subir tus tardeos, editar la
        ficha y ver quién te sigue.
      </p>

      {estado === "sinSesion" ? (
        <Link href={entrarYVolver(pathname)} className={claseBoton("primario", "pequeno", false, "mt-3")}>
          Entra para reclamarlo
        </Link>
      ) : !abierto ? (
        <button onClick={() => setAbierto(true)} className={claseBoton("primario", "pequeno", false, "mt-3")}>
          <BadgeCheck size={18} /> Reclamar este perfil
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <input
            value={cargo} onChange={(e) => setCargo(e.target.value)}
            placeholder={tipo === "local" ? "¿Qué eres del local? Propietario, encargado…" : "¿Eres tú? ¿Su representante?"}
            className={claseCampo}
          />
          <input
            value={telefono} onChange={(e) => setTelefono(e.target.value)}
            placeholder="Teléfono de contacto (para verificarlo)"
            className={claseCampo}
          />
          <textarea
            value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={2}
            placeholder="Lo que quieras contarnos (opcional)"
            className={claseCampo}
          />
          {error && <p role="alert" className="text-[15px] font-semibold text-error">{error}</p>}
          <div className="flex gap-2">
            <button onClick={enviar} disabled={enviando} className={claseBoton("primario", "pequeno", false, "flex-1")}>
              {enviando ? <Loader2 size={18} className="animate-spin" /> : <BadgeCheck size={18} />} Enviar solicitud
            </button>
            <button onClick={() => setAbierto(false)} className={claseBoton("contorno", "pequeno")}>
              Cancelar
            </button>
          </div>
          <p className="text-[14px] text-tinta-suave">
            Lo revisa una persona: no se asigna solo.
          </p>
        </div>
      )}
    </Caja>
  );
}
