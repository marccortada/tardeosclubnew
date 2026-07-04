"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import AddressSearch, { Direccion } from "@/components/AddressSearch";
import { useAuth } from "@/lib/useAuth";
import { getMiLocal, updateMiLocal } from "@/lib/tardeos";
import { Store, Phone, MapPin, FileText, Check, Loader2 } from "lucide-react";

export default function EditarLocal() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [local, setLocal] = useState<any | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [direccion, setDireccion] = useState("");
  const [zona, setZona] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cambiarDir, setCambiarDir] = useState(false);

  useEffect(() => {
    if (!user) { setCargando(false); return; }
    getMiLocal(user.id).then((l) => {
      if (l) {
        setLocal(l);
        setNombre(l.nombre || "");
        setTelefono(l.telefono || "");
        setDescripcion(l.descripcion || "");
        setDireccion(l.direccion || "");
        setZona(l.zona || "");
      }
      setCargando(false);
    });
  }, [user]);

  const onDireccion = (d: Direccion) => {
    setDireccion(d.display);
    setZona(d.zona);
    setCoords({ lat: d.lat, lng: d.lng });
    setCambiarDir(false);
  };

  const guardar = async () => {
    if (!local) return;
    if (!nombre.trim()) { setError("El local necesita un nombre."); return; }
    setGuardando(true); setError("");
    const fields: Record<string, unknown> = {
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      descripcion: descripcion.trim() || null,
      direccion,
      zona,
    };
    if (coords) { fields.lat = coords.lat; fields.lng = coords.lng; }
    const { error: e } = await updateMiLocal(local.id, fields);
    setGuardando(false);
    if (e) setError(e.message);
    else router.push("/local");
  };

  if (loading || cargando) {
    return <main className="flex items-center justify-center gap-2 pt-24 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</main>;
  }
  if (!user || !local) {
    return (
      <main className="pb-8">
        <PanelHeader titulo="Editar local" volverHref="/local" />
        <p className="mx-auto max-w-lg px-4 pt-16 text-center font-bold text-tinta/60">No tienes ningún local todavía.</p>
      </main>
    );
  }

  return (
    <main className="pb-10">
      <PanelHeader titulo="Editar local" volverHref="/local" />
      <div className="mx-auto max-w-lg px-4 pt-5 md:px-8">
        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70"><Store size={16} className="text-magenta" /> Nombre del local</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-magenta" />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70"><Phone size={16} className="text-magenta" /> Teléfono / WhatsApp</span>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="600 000 000" className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-magenta" />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70"><FileText size={16} className="text-magenta" /> Descripción</span>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} placeholder="Cuenta qué ofrece tu local…" className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-magenta" />
          </label>

          <div>
            <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70"><MapPin size={16} className="text-magenta" /> Dirección</span>
            {!cambiarDir ? (
              <div className="flex items-center gap-2 rounded-xl border-2 border-magenta-100 bg-white px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-base font-semibold text-tinta/80">{direccion || "Sin dirección"}</span>
                <button onClick={() => setCambiarDir(true)} className="shrink-0 text-sm font-extrabold text-magenta">Cambiar</button>
              </div>
            ) : (
              <AddressSearch onSelect={onDireccion} />
            )}
            {zona && <p className="mt-1 text-xs font-semibold text-tinta/50">Zona: <b>{zona}</b></p>}
          </div>

          {error && <p className="text-sm font-bold text-magenta">{error}</p>}

          <button onClick={guardar} disabled={guardando} className="flex items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white shadow-tarjeta active:scale-[0.98] disabled:opacity-40">
            {guardando ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} />} Guardar datos
          </button>
          <Link href="/local" className="pb-2 text-center text-sm font-bold text-tinta/50">Cancelar</Link>
        </div>
      </div>
    </main>
  );
}
