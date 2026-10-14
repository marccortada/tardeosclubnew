import { ReactNode } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

/** Mensaje bien visible. `error` y `aviso` se leen en voz alta al aparecer. */
export default function Aviso({ tono = "error", children }: { tono?: "error" | "aviso" | "ok"; children: ReactNode }) {
  const t = {
    error: "bg-error-fondo text-error",
    aviso: "bg-aviso-fondo text-aviso",
    ok: "bg-ok-fondo text-ok",
  }[tono];
  return (
    <p role={tono === "ok" ? "status" : "alert"} className={`mb-3 flex items-start gap-2 rounded-2xl p-4 text-base font-bold ${t}`}>
      {tono === "ok" ? <CheckCircle2 size={22} className="mt-0.5 shrink-0" aria-hidden /> : <AlertTriangle size={22} className="mt-0.5 shrink-0" aria-hidden />}
      <span>{children}</span>
    </p>
  );
}
