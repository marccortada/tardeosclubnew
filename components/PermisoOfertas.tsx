"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Mail, Loader2, Check } from "lucide-react";

/**
 * «Quiero recibir ofertas por email», donde se pueda cambiar de opinión.
 *
 * El permiso se pide al registrarse, pero la política de privacidad promete
 * que se puede retirar, y una promesa que solo se cumple escribiendo un email
 * a soporte no la cumple nadie. Aquí es un interruptor.
 *
 * Si la columna todavía no existe, el interruptor no se pinta en vez de
 * enseñar un error: quien entra en su perfil no tiene por qué enterarse de que
 * falta un lote de SQL por pegar.
 */
export default function PermisoOfertas({ userId }: { userId: string }) {
  const [valor, setValor] = useState<boolean | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles").select("acepta_ofertas").eq("id", userId).maybeSingle();
    if (error) { setValor(null); return; }   // falta el lote 38: no se pinta
    setValor(Boolean(data?.acepta_ofertas));
  }, [userId]);
  useEffect(() => { cargar(); }, [cargar]);

  if (valor === null) return null;

  const cambiar = async () => {
    const nuevo = !valor;
    setValor(nuevo); setGuardando(true); setError("");
    // Se comprueba lo que devuelve la base y no solo que no haya error: con
    // RLS, un update que no alcanza ninguna fila responde 204 sin haber
    // escrito, y quedaría marcado en pantalla sin estar guardado.
    const { data, error: e } = await supabase
      .from("profiles").update({ acepta_ofertas: nuevo }).eq("id", userId).select("acepta_ofertas");
    setGuardando(false);
    if (e || data?.[0]?.acepta_ofertas !== nuevo) {
      setValor(!nuevo);
      setError("No se pudo guardar. Inténtalo otra vez.");
      return;
    }
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1500);
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
      <label className="flex items-start gap-3">
        <input
          type="checkbox" checked={valor} onChange={cambiar} disabled={guardando}
          className="mt-0.5 h-5 w-5 shrink-0 accent-magenta"
        />
        <span className="flex-1">
          <span className="flex items-center gap-1.5 font-black leading-tight">
            <Mail size={16} className="text-magenta" /> Ofertas y novedades por email
            {guardando && <Loader2 size={14} className="animate-spin text-magenta" />}
            {guardado && <Check size={14} className="text-green-600" />}
          </span>
          <span className="text-sm font-semibold text-tinta/55">
            {valor
              ? "Te avisaremos de promociones. Puedes desmarcarlo cuando quieras."
              : "No te mandamos nada. Márcalo si quieres enterarte de las promociones."}
          </span>
        </span>
      </label>
      {error && <p className="mt-2 text-sm font-bold text-magenta">{error}</p>}
    </div>
  );
}
