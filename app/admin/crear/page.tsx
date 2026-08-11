"use client";

import { useState } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import AddressSearch, { Direccion } from "@/components/AddressSearch";
import { supabase } from "@/lib/supabase";
import { ESTILOS } from "@/lib/mockData";
import {
  Store, CalendarPlus, Mail, ArrowRight, Check, ArrowLeft, Disc3, Loader2,
} from "lucide-react";

type Modo = "elegir" | "local" | "dj";

// El rol ya lo comprueba app/admin/layout.tsx: aquí solo llegan admins.
export default function AdminCrear() {
  const [modo, setModo] = useState<Modo>("elegir");

  // Local
  const [nombreLocal, setNombreLocal] = useState("");
  const [tel, setTel] = useState("");
  const [dir, setDir] = useState<Direccion | null>(null);
  // DJ
  const [nombreDj, setNombreDj] = useState("");
  const [estilos, setEstilos] = useState<string[]>([]);
  const [bio, setBio] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState<{ tipo: "local" | "dj"; nombre: string } | null>(null);

  const limpiar = () => {
    setNombreLocal(""); setTel(""); setDir(null);
    setNombreDj(""); setEstilos([]); setBio(""); setError("");
  };

  // El local nace sin dueño (owner_id null): lo crea el admin, no un usuario.
  // Queda 'activo' porque un alta manual del admin ya es la aprobación; la
  // insignia de verificado se da aparte, desde /admin/locales.
  const crearLocal = async () => {
    if (!nombreLocal.trim() || !dir) { setError("Pon el nombre y busca la dirección."); return; }
    setGuardando(true); setError("");
    const { error } = await supabase.from("locales").insert({
      owner_id: null, nombre: nombreLocal.trim(), telefono: tel.trim(),
      direccion: dir.display, lat: dir.lat, lng: dir.lng,
      codigo_postal: dir.cp, zona: dir.zona, estado: "activo",
    });
    setGuardando(false);
    if (error) { setError(error.message); return; }
    setHecho({ tipo: "local", nombre: nombreLocal.trim() });
    limpiar();
  };

  // Igual que el local: sin profile_id, el DJ queda huérfano hasta que le
  // asignes un dueño o la persona reclame su ficha.
  const crearDj = async () => {
    if (!nombreDj.trim()) { setError("Pon el nombre artístico."); return; }
    setGuardando(true); setError("");
    const { error } = await supabase.from("djs").insert({
      profile_id: null, nombre_artistico: nombreDj.trim(), estilos, bio: bio.trim(),
    });
    setGuardando(false);
    if (error) { setError(error.message); return; }
    setHecho({ tipo: "dj", nombre: nombreDj.trim() });
    limpiar();
  };

  if (hecho) {
    const esLocal = hecho.tipo === "local";
    return (
      <main className="pb-10">
        <PanelHeader titulo="Crear" volverHref="/admin" />
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 pt-16 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-oro text-tinta"><Check size={44} /></span>
          <h2 className="font-display text-3xl font-black">{esLocal ? "Local creado" : "DJ creado"}</h2>
          <p className="font-semibold text-tinta/70">
            <b>{hecho.nombre}</b> ya está en la base de datos, todavía sin dueño.
          </p>
          <p className="-mt-2 text-sm font-semibold text-tinta/50">
            {esLocal
              ? "Está activo y sale en el mapa. Cuando su dueño se registre, habrá que enlazarle la ficha."
              : "Ya se le puede asignar a un tardeo. Cuando la persona se registre, habrá que enlazarle la ficha."}
          </p>
          <div className="flex w-full flex-col gap-2">
            <button onClick={() => { setHecho(null); setModo(esLocal ? "local" : "dj"); }}
              className="rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white active:scale-[0.98]">
              Crear otro
            </button>
            <Link href={esLocal ? "/admin/locales" : "/admin/djs"}
              className="rounded-2xl bg-white px-6 py-4 text-lg font-extrabold text-tinta ring-1 ring-black/10">
              Ver {esLocal ? "locales" : "DJs"}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-10">
      <PanelHeader titulo="Crear" volverHref="/admin" />
      <div className="mx-auto max-w-lg px-4 pt-5 md:px-8">
        {modo === "elegir" && (
          <div className="flex flex-col gap-4">
            <button onClick={() => { setModo("local"); setError(""); }} className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-marca text-white"><Store size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Crear local</span><span className="text-sm font-semibold text-tinta/60">Alta manual, sin dueño</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </button>

            <button onClick={() => { setModo("dj"); setError(""); }} className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-magenta text-white"><Disc3 size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Crear DJ</span><span className="text-sm font-semibold text-tinta/60">Alta manual, sin dueño</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </button>

            <Link href="/local/crear" className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-oro text-tinta"><CalendarPlus size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Crear tardeo</span><span className="text-sm font-semibold text-tinta/60">Con IA, en el local que elijas</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </Link>

            <Link href="/admin/locales" className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-tinta text-white"><Mail size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Invitar</span><span className="text-sm font-semibold text-tinta/60">El enlace se genera desde la ficha, en Locales o DJs</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </Link>
          </div>
        )}

        {modo === "local" && (
          <div className="flex flex-col gap-3">
            <button onClick={() => { setModo("elegir"); setError(""); }} className="inline-flex items-center gap-1 self-start text-sm font-bold text-magenta"><ArrowLeft size={16} /> Volver</button>
            <h2 className="font-display text-2xl font-black">Datos del local</h2>

            <label className="text-sm font-black text-tinta/70">Nombre del local</label>
            <input value={nombreLocal} onChange={(e) => setNombreLocal(e.target.value)} placeholder="Sala Blau"
              className="rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />

            <label className="text-sm font-black text-tinta/70">Dirección (búscala en el mapa)</label>
            <AddressSearch onSelect={setDir} />
            <p className="-mt-1 text-xs font-semibold text-tinta/50">De aquí salen las coordenadas del mapa y la zona de los filtros. Sin dirección no se puede crear.</p>

            <label className="mt-1 text-sm font-black text-tinta/70">Teléfono (opcional)</label>
            <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="600 000 000"
              className="rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />

            {error && <p className="text-sm font-bold text-magenta">{error}</p>}
            <button onClick={crearLocal} disabled={guardando}
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white active:scale-[0.98] disabled:opacity-40">
              {guardando ? <Loader2 size={20} className="animate-spin" /> : <Store size={20} />} Crear local
            </button>
          </div>
        )}

        {modo === "dj" && (
          <div className="flex flex-col gap-3">
            <button onClick={() => { setModo("elegir"); setError(""); }} className="inline-flex items-center gap-1 self-start text-sm font-bold text-magenta"><ArrowLeft size={16} /> Volver</button>
            <h2 className="font-display text-2xl font-black">Datos del DJ</h2>

            <label className="text-sm font-black text-tinta/70">Nombre artístico</label>
            <input value={nombreDj} onChange={(e) => setNombreDj(e.target.value)} placeholder="DJ Nando"
              className="rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />

            <label className="text-sm font-black text-tinta/70">Estilos</label>
            <div className="flex flex-wrap gap-2">
              {ESTILOS.map((e) => {
                const on = estilos.includes(e);
                return (
                  <button key={e} onClick={() => setEstilos((p) => (on ? p.filter((x) => x !== e) : [...p, e]))}
                    className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-extrabold transition ${on ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"}`}>
                    {e}
                  </button>
                );
              })}
            </div>

            <label className="mt-1 text-sm font-black text-tinta/70">Biografía (opcional)</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Trayectoria, salas donde pincha…"
              className="rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />

            {error && <p className="text-sm font-bold text-magenta">{error}</p>}
            <button onClick={crearDj} disabled={guardando}
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white active:scale-[0.98] disabled:opacity-40">
              {guardando ? <Loader2 size={20} className="animate-spin" /> : <Disc3 size={20} />} Crear DJ
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
