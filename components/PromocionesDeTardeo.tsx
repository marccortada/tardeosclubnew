"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPromosDeTardeo, crearPromo, actualizarPromo, borrarPromo,
  vigente, porQueNoCorre, type Promocion,
} from "@/lib/promociones";
import { Tag, Plus, Trash2, Loader2, Check, Power } from "lucide-react";

const VACIA = {
  nombre: "", beneficio: "", codigo: "",
  desde: "", hasta: "", limiteUsos: "",
};

/** De un <input type="datetime-local"> a lo que espera la base, y al revés. */
const aISO = (v: string) => (v ? new Date(v).toISOString() : null);
const aInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * Las promociones de un tardeo, tal como las lleva su local.
 *
 * Vive en la pantalla de EDITAR y no en la de crear porque una promoción va
 * pegada a un tardeo por su id, y mientras se está creando ese id todavía no
 * existe. Se publica el tardeo y después se le cuelgan las promociones.
 *
 * Las fechas no son un adorno: la base solo deja LEER las vigentes, así que una
 * promoción caducada deja de verse sola. Aquí sí salen todas, con el motivo por
 * el que no está corriendo, que es lo que el dueño necesita saber.
 */
export default function PromocionesDeTardeo({ tardeoId }: { tardeoId: string }) {
  const [promos, setPromos] = useState<Promocion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(VACIA);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setPromos(await getPromosDeTardeo(tardeoId));
    setCargando(false);
  }, [tardeoId]);

  useEffect(() => { cargar(); }, [cargar]);

  const set = (k: keyof typeof VACIA, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!form.nombre.trim()) { setError("Ponle un nombre, aunque sea corto."); return; }
    if (form.desde && form.hasta && new Date(form.desde) > new Date(form.hasta)) {
      setError("La fecha de cierre es anterior a la de inicio.");
      return;
    }
    setGuardando(true); setError("");
    const { error: e } = await crearPromo({
      tardeo_id: tardeoId,
      nombre: form.nombre.trim(),
      beneficio: form.beneficio.trim() || null,
      codigo: form.codigo.trim().toUpperCase() || null,
      desde: aISO(form.desde),
      hasta: aISO(form.hasta),
      limite_usos: form.limiteUsos ? Number(form.limiteUsos) : null,
    });
    setGuardando(false);
    if (e) { setError("No se pudo guardar: " + e.message); return; }
    setForm(VACIA); setAbierto(false); cargar();
  };

  const alternar = async (p: Promocion) => {
    const { data, error: e } = await actualizarPromo(p.id, { activa: !p.activa });
    if (e) { setError(e.message); return; }
    // Sin permiso la base NO da error: filtra las filas y actualiza cero, así
    // que responde "correcto" sin haber cambiado nada. Hay que mirar lo que
    // devuelve, no si falló.
    if (!data || data.length === 0) { setError("No se pudo: este tardeo no es de tu local."); return; }
    cargar();
  };

  const eliminar = async (p: Promocion) => {
    if (!confirm(`¿Borrar «${p.nombre}»? No se puede deshacer.`)) return;
    const { data, error: e } = await borrarPromo(p.id);
    if (e) { setError(e.message); return; }
    if (!data || data.length === 0) { setError("No se pudo: este tardeo no es de tu local."); return; }
    cargar();
  };

  const Campo = ({ etiqueta, hijo }: { etiqueta: string; hijo: React.ReactNode }) => (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wide text-tinta/45">{etiqueta}</span>
      {hijo}
    </label>
  );
  const input = "w-full rounded-xl border-2 border-oro/40 bg-white px-4 py-3 font-semibold outline-none focus:border-oro";

  return (
    <div className="rounded-2xl bg-oro/10 p-4">
      <p className="flex items-center gap-1.5 text-sm font-black text-tinta/80">
        <Tag size={15} className="text-oro-600" /> Promociones
      </p>
      <p className="mt-0.5 text-xs font-semibold text-tinta/55">
        Con código, fechas y límite de usos. Se encienden y se apagan solas: cuando pasa la
        fecha de cierre dejan de verse sin que tengas que hacer nada.
      </p>

      {cargando ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-bold text-tinta/50">
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {promos.map((p) => {
            const motivo = porQueNoCorre(p);
            return (
              <div key={p.id} className={`rounded-xl bg-white p-3 ring-1 ${vigente(p) ? "ring-oro/50" : "ring-black/10"}`}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black leading-tight">{p.nombre}</p>
                    {p.beneficio && <p className="truncate text-sm font-semibold text-tinta/60">{p.beneficio}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold">
                      {p.codigo && <span className="rounded bg-tinta px-1.5 py-0.5 font-mono text-white">{p.codigo}</span>}
                      {p.limiteUsos != null && <span className="text-tinta/50">{p.usos}/{p.limiteUsos} usos</span>}
                      <span className={motivo ? "text-tinta/40" : "text-oro-600"}>
                        {motivo ?? "Corriendo"}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => alternar(p)} aria-label={p.activa ? "Apagar" : "Encender"}
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${p.activa ? "bg-oro text-tinta" : "bg-white text-tinta/40 ring-1 ring-black/10"}`}>
                    <Power size={16} />
                  </button>
                  <button onClick={() => eliminar(p)} aria-label="Borrar"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-tinta/40 ring-1 ring-black/10 hover:text-magenta">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}

          {promos.length === 0 && !abierto && (
            <p className="text-sm font-semibold text-tinta/50">Ninguna todavía.</p>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm font-bold text-magenta">{error}</p>}

      {abierto ? (
        <div className="mt-3 flex flex-col gap-3 rounded-xl bg-white/70 p-3">
          <Campo etiqueta="Nombre" hijo={
            <input value={form.nombre} onChange={(e) => set("nombre", e.target.value)}
              placeholder="2x1 en cócteles" className={input} />} />
          <Campo etiqueta="Qué se lleva" hijo={
            <textarea value={form.beneficio} onChange={(e) => set("beneficio", e.target.value)} rows={2}
              placeholder="Dos copas por el precio de una, hasta las 21 h" className={input} />} />
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Código (opcional)" hijo={
              <input value={form.codigo} onChange={(e) => set("codigo", e.target.value.toUpperCase())}
                placeholder="VERANO" className={`${input} font-mono`} />} />
            <Campo etiqueta="Límite de usos" hijo={
              <input value={form.limiteUsos} onChange={(e) => set("limiteUsos", e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric" placeholder="Sin límite" className={input} />} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Empieza" hijo={
              <input type="datetime-local" value={form.desde} onChange={(e) => set("desde", e.target.value)} className={input} />} />
            <Campo etiqueta="Termina" hijo={
              <input type="datetime-local" value={form.hasta} onChange={(e) => set("hasta", e.target.value)} className={input} />} />
          </div>
          <p className="text-xs font-semibold text-tinta/50">
            Deja las fechas en blanco si quieres que corra desde ya y hasta que la apagues.
          </p>
          <div className="flex gap-2">
            <button onClick={guardar} disabled={guardando}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-oro py-3 font-extrabold text-tinta disabled:opacity-50">
              {guardando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Guardar promoción
            </button>
            <button onClick={() => { setAbierto(false); setError(""); }}
              className="rounded-xl bg-white px-4 py-3 font-extrabold text-tinta/60 ring-1 ring-black/10">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAbierto(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-tinta/80 ring-1 ring-oro/40">
          <Plus size={16} /> Añadir promoción
        </button>
      )}
    </div>
  );
}
