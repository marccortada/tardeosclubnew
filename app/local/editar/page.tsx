"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import AddressSearch, { Direccion } from "@/components/AddressSearch";
import { useAuth } from "@/lib/useAuth";
import { getMiLocal, updateMiLocal, subirLogoLocal } from "@/lib/tardeos";
import CampoPlaylist from "@/components/CampoPlaylist";
import { Store, Phone, MapPin, FileText, Check, Loader2, ImagePlus, Megaphone } from "lucide-react";

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
  const [playlist, setPlaylist] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  const esPromotor = local?.tipo === "promotor";

  useEffect(() => {
    if (!user) { setCargando(false); return; }
    getMiLocal(user.id).then((l) => {
      if (l) {
        setLocal(l);
        setNombre(l.nombre || "");
        setTelefono(l.telefono || "");
        setDescripcion(l.descripcion || "");
        setPlaylist(l.playlist_url || "");
        setDireccion(l.direccion || "");
        setZona(l.zona || "");
        setLogo(l.logo_url || null);
      }
      setCargando(false);
    });
  }, [user]);

  /**
   * El logo se guarda en cuanto se sube, sin esperar al botón de Guardar: si
   * alguien sube la imagen y se va de la página, lo raro sería perderla.
   */
  const onLogo = async (file: File) => {
    if (!local) return;
    setSubiendoLogo(true); setError("");
    const url = await subirLogoLocal(local.id, file);
    if (!url) { setSubiendoLogo(false); setError("No se pudo subir el logo. Prueba con otra imagen."); return; }
    const { error: e } = await updateMiLocal(local.id, { logo_url: url });
    setSubiendoLogo(false);
    if (e) setError(e.message);
    else setLogo(url);
  };

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
      playlist_url: playlist.trim() || null,
    };
    // Al promotor no se le tocan dirección ni coordenadas: no tiene ninguna, y
    // guardarle cadenas vacías le sobreescribiría lo que ya hubiera.
    if (!esPromotor) {
      fields.direccion = direccion;
      fields.zona = zona;
      if (coords) { fields.lat = coords.lat; fields.lng = coords.lng; }
    }
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
          {/* El logo es lo que sale en la chincheta del mapa, así que va primero
              y se guarda solo al subirlo. */}
          <div>
            <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70">
              <ImagePlus size={16} className="text-magenta" /> Logo
            </span>
            <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
              <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-magenta-50 text-magenta ring-1 ring-black/5">
                {logo
                  // eslint-disable-next-line @next/next/no-img-element -- se reemplaza al vuelo tras subir; next/image cachearía la anterior
                  ? <img src={logo} alt="Logo del local" className="h-full w-full object-cover" />
                  : <Store size={32} />}
              </span>
              <div className="min-w-0 flex-1">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-magenta px-4 py-2.5 text-sm font-extrabold text-white active:scale-[0.98]">
                  {subiendoLogo ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                  {logo ? "Cambiar logo" : "Subir logo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={subiendoLogo}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogo(f); e.target.value = ""; }}
                  />
                </label>
                <p className="mt-1.5 text-xs font-semibold text-tinta/50">
                  Es la chincheta que verá la gente en el mapa. Cuadrada se ve mejor: se recorta al centro.
                </p>
              </div>
            </div>
          </div>

          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70">
              {esPromotor ? <Megaphone size={16} className="text-magenta" /> : <Store size={16} className="text-magenta" />}
              {esPromotor ? "Nombre con el que organizas" : "Nombre del local"}
            </span>
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

          <CampoPlaylist valor={playlist} onCambio={setPlaylist} />

          {/* El promotor no tiene dirección fija: la pone en cada tardeo. */}
          {esPromotor ? (
            <div className="flex items-start gap-2 rounded-2xl bg-oro/10 p-3 text-sm font-semibold text-tinta/80">
              <Megaphone size={18} className="mt-0.5 shrink-0 text-oro-600" />
              Como promotor no tienes dirección fija: el sitio se elige al crear cada tardeo.
            </div>
          ) : (
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
          )}

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
