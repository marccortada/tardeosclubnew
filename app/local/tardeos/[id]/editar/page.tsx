"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import { useAuth } from "@/lib/useAuth";
import { getTardeoById, updateTardeo, setDjsDeTardeo, borrarTardeo, setEstadoTardeo } from "@/lib/tardeos";
import { flyerSrc } from "@/lib/mockData";
import { Tardeo } from "@/lib/types";
import { Music, Calendar, Clock, Disc3, MapPin, Ticket, Check, Loader2, Trash2, EyeOff, Eye } from "lucide-react";

export default function EditarTardeo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();

  const [tardeo, setTardeo] = useState<Tardeo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [estilo, setEstilo] = useState("");
  const [dj, setDj] = useState("");
  const [direccion, setDireccion] = useState("");
  const [tipo, setTipo] = useState("gratis");
  const [precio, setPrecio] = useState("");

  useEffect(() => {
    getTardeoById(id).then((t) => {
      if (t) {
        setTardeo(t);
        setTitulo(t.titulo);
        setFecha(t.fecha);
        setHoraInicio(t.horaInicio);
        setHoraFin(t.horaFin);
        setEstilo(t.estilo);
        setDj(t.djs.map((d) => d.nombre).join(" · "));
        setDireccion(t.local.direccion);
        setTipo(t.tipoEntrada);
        setPrecio(t.precio ? String(t.precio) : "");
      }
      setCargando(false);
    });
  }, [id]);

  const guardar = async () => {
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
    if (!titulo.trim()) { setError("Ponle un título."); return; }
    if (!fecha) { setError("Falta la fecha."); return; }
    if (fecha < hoy) { setError("La fecha ya ha pasado."); return; }
    if (tipo === "pago" && !(Number(precio) > 0)) { setError("Indica el precio."); return; }

    setGuardando(true); setError("");
    const { error: e } = await updateTardeo(id, {
      titulo: titulo.trim(),
      fecha,
      hora_inicio: horaInicio,
      hora_fin: horaFin || null,
      estilo,
      direccion,
      es_de_pago: tipo === "pago",
      tiene_lista: tipo === "lista",
      precio: tipo === "pago" ? Number(precio) || null : null,
    });
    try { await setDjsDeTardeo(id, dj.split(/[,·&]|\sy\s/i)); } catch { /* no crítico */ }
    setGuardando(false);
    if (e) setError(e.message);
    else router.push("/local");
  };

  const cambiarEstado = async (nuevo: string) => {
    await setEstadoTardeo(id, nuevo);
    router.push("/local");
  };

  const eliminar = async () => {
    if (!confirm("¿Seguro que quieres borrar este tardeo? No se puede deshacer.")) return;
    await borrarTardeo(id);
    router.push("/local");
  };

  if (loading || cargando) {
    return <main className="flex items-center justify-center gap-2 pt-24 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</main>;
  }
  if (!user || !tardeo) {
    return (
      <main className="pb-8">
        <PanelHeader titulo="Editar tardeo" volverHref="/local" />
        <p className="mx-auto max-w-lg px-4 pt-16 text-center font-bold text-tinta/60">No se encontró el tardeo o no es tuyo.</p>
      </main>
    );
  }

  const publicado = tardeo.estado === "publicado";

  return (
    <main className="pb-10">
      <PanelHeader titulo="Editar tardeo" volverHref="/local" />
      <div className="mx-auto max-w-lg px-4 pt-5 md:px-8">
        {/* Miniatura del flyer */}
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-tarjeta ring-1 ring-black/5">
          <img src={flyerSrc(tardeo)} alt="" className="h-16 w-[52px] shrink-0 rounded-xl object-cover" />
          <div>
            <p className="font-black leading-tight">{tardeo.titulo}</p>
            <span className={`text-xs font-black ${publicado ? "text-oro-600" : "text-tinta/50"}`}>
              {publicado ? "Publicado" : `Estado: ${tardeo.estado}`}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70"><Music size={16} className="text-magenta" /> Título</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-magenta" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70"><Calendar size={16} className="text-magenta" /> Fecha</span>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-magenta" />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70"><Music size={16} className="text-magenta" /> Estilo</span>
              <input value={estilo} onChange={(e) => setEstilo(e.target.value)} className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-magenta" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70"><Clock size={16} className="text-magenta" /> Empieza</span>
              <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-magenta" />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70"><Clock size={16} className="text-magenta" /> Acaba</span>
              <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-magenta" />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70"><Disc3 size={16} className="text-magenta" /> DJ(s)</span>
            <input value={dj} onChange={(e) => setDj(e.target.value)} placeholder="DJ Nando · DJ Kiko" className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-magenta" />
            <span className="mt-1 block text-xs font-semibold text-tinta/50">Separa varios con «·». Se vinculan a su perfil si están registrados.</span>
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70"><MapPin size={16} className="text-magenta" /> Dirección</span>
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-magenta" />
          </label>

          <div>
            <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70"><Ticket size={16} className="text-magenta" /> Entrada</span>
            <div className="grid grid-cols-3 gap-2">
              {[{ k: "gratis", label: "Gratis" }, { k: "pago", label: "Entrada" }, { k: "lista", label: "Por lista" }].map((o) => (
                <button key={o.k} onClick={() => setTipo(o.k)} className={`min-h-[44px] rounded-xl py-3 text-sm font-extrabold transition ${tipo === o.k ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}>
                  {o.label}
                </button>
              ))}
            </div>
            {tipo === "pago" && (
              <input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Precio en €" className="mt-2 w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-magenta" />
            )}
          </div>

          {error && <p className="text-sm font-bold text-magenta">{error}</p>}

          <button onClick={guardar} disabled={guardando} className="flex items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white shadow-tarjeta active:scale-[0.98] disabled:opacity-40">
            {guardando ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} />} Guardar cambios
          </button>

          {/* Acciones de estado */}
          <div className="mt-2 flex flex-col gap-2 border-t border-black/5 pt-4">
            {publicado ? (
              <button onClick={() => cambiarEstado("borrador")} className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3 font-extrabold text-tinta/70 ring-1 ring-black/10">
                <EyeOff size={18} /> Despublicar (ocultar)
              </button>
            ) : (
              <button onClick={() => cambiarEstado("publicado")} className="flex items-center justify-center gap-2 rounded-2xl bg-oro py-3 font-extrabold text-tinta">
                <Eye size={18} /> Publicar
              </button>
            )}
            <button onClick={eliminar} className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3 font-extrabold text-red-600 ring-1 ring-red-200">
              <Trash2 size={18} /> Borrar tardeo
            </button>
          </div>

          <Link href="/local" className="pb-2 text-center text-sm font-bold text-tinta/50">Cancelar</Link>
        </div>
      </div>
    </main>
  );
}
