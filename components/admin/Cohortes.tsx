"use client";

import { useEffect, useState } from "react";
import { cargarCohortes, type Cohorte } from "@/lib/estadisticas";

/**
 * Retorno a 7 y 28 días por semana de alta (dossier pág. 16: "cohortes
 * completas y denominador visible"). Una cohorte que aún no ha cumplido el
 * plazo se marca "en curso": su porcentaje todavía puede subir y no se debe
 * comparar con las cerradas. Sin equipo ni cuentas de prueba.
 */
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)} %` : "—");

export default function Cohortes() {
  const [filas, setFilas] = useState<Cohorte[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { cargarCohortes(12).then((r) => { setFilas(r.filas); setError(r.error); }); }, []);

  return (
    <section className="mt-6 rounded-2xl border border-linea bg-white p-5 shadow-tarjeta">
      <h2 className="text-lg font-bold">Retorno de cuentas nuevas (7 y 28 días)</h2>
      <p className="mb-3 mt-0.5 text-sm text-tinta-suave">
        De las cuentas creadas cada semana, cuántas vuelven a hacer algo útil (guardar, apuntarse, seguir, play, clic a entrada…) después del primer día.
      </p>
      {error && <p className="text-[15px] font-semibold text-error">{error}</p>}
      {!error && filas === null && <p className="text-[15px] text-tinta-suave">Cargando…</p>}
      {!error && filas?.length === 0 && <p className="text-[15px] text-tinta-suave">Aún no hay cuentas nuevas en las últimas 12 semanas.</p>}
      {!!filas?.length && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px] tabular-nums">
            <thead className="text-[13px] uppercase tracking-wide text-tinta-suave">
              <tr><th className="py-2 pr-3">Semana</th><th className="py-2 pr-3">Cuentas</th><th className="py-2 pr-3">Vuelven 7 d</th><th className="py-2">Vuelven 28 d</th></tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {filas.map((f) => (
                <tr key={f.semana}>
                  <td className="py-2 pr-3">{new Date(f.semana + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</td>
                  <td className="py-2 pr-3 font-semibold">{f.cuentas}</td>
                  <td className="py-2 pr-3">{f.volvieron_7} / {f.cuentas} · {pct(f.volvieron_7, f.cuentas)}{!f.madura_7 && <span className="text-tinta-suave"> (en curso)</span>}</td>
                  <td className="py-2">{f.volvieron_28} / {f.cuentas} · {pct(f.volvieron_28, f.cuentas)}{!f.madura_28 && <span className="text-tinta-suave"> (en curso)</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
