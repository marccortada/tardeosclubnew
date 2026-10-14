"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Boton from "@/components/Boton";
import { claseCampo } from "@/components/ui/Campo";
import Hoja from "@/components/ui/Hoja";
import { traducirAuth } from "@/components/cuenta/traducirAuth";

/** Crear o cambiar la contraseña (también al volver del email de recuperación). */
export default function HojaContrasena({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const [clave, setClave] = useState("");
  const [repite, setRepite] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState(false);

  const cerrar = () => { setClave(""); setRepite(""); setError(""); setHecho(false); onCerrar(); };

  const guardar = async () => {
    setError("");
    if (clave.length < 8) { setError("Usa al menos 8 caracteres."); return; }
    if (clave !== repite) { setError("Las dos contraseñas no coinciden."); return; }
    setGuardando(true);
    const { error: e } = await supabase.auth.updateUser({ password: clave });
    setGuardando(false);
    if (e) { setError(traducirAuth(e.message)); return; }
    setHecho(true);
  };

  return (
    <Hoja
      abierta={abierta}
      onCerrar={cerrar}
      titulo="Tu contraseña"
      pie={hecho
        ? <Boton onClick={cerrar} ancho>Hecho</Boton>
        : <Boton onClick={guardar} cargando={guardando} ancho>Guardar contraseña</Boton>}
    >
      {hecho ? (
        <p className="flex items-center gap-2 text-[16px] font-semibold text-ok"><Check size={20} aria-hidden /> Contraseña guardada. Ya puedes entrar con ella.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="clave-nueva" className="text-[15px] font-semibold">Nueva contraseña</label>
            <input id="clave-nueva" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} className={claseCampo} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="clave-repite" className="text-[15px] font-semibold">Repítela</label>
            <input id="clave-repite" type="password" autoComplete="new-password" value={repite} onChange={(e) => setRepite(e.target.value)} className={claseCampo} />
          </div>
          {error && <p role="alert" className="text-[15px] font-semibold text-error">{error}</p>}
        </div>
      )}
    </Hoja>
  );
}
