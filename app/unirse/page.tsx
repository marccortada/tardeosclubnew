"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";
import SelectorEstilos from "@/components/SelectorEstilos";
import AddressSearch, { Direccion } from "@/components/AddressSearch";
import PanelHeader from "@/components/PanelHeader";
import {
  PartyPopper, Store, Disc3, ArrowRight, Check, Loader2, Store as StoreIcon, Megaphone,
} from "lucide-react";

type Paso = "rol" | "local" | "promotor" | "dj" | "fin";

function UnirseContent() {
  const { user, loading } = useAuth();
  const rolParam = useSearchParams().get("rol");
  const [paso, setPaso] = useState<Paso>(
    rolParam === "local" ? "local"
      : rolParam === "promotor" ? "promotor"
      : rolParam === "dj" ? "dj"
      : "rol"
  );
  const [finRol, setFinRol] = useState("");

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
  // null = todavía no lo sabemos. Sin esto, si la consulta tarda o falla, la
  // página ofrece crear una ficha que ya existe y salen duplicados.
  const [yaTiene, setYaTiene] = useState<"local" | "dj" | "no" | null>(null);

  useEffect(() => {
    if (!user) { setYaTiene("no"); return; }
    (async () => {
      const [l, d] = await Promise.all([
        supabase.from("locales").select("id,tipo").eq("owner_id", user.id).limit(1).maybeSingle(),
        supabase.from("djs").select("id").eq("profile_id", user.id).limit(1).maybeSingle(),
      ]);
      // Ante la duda no dejamos crear: es más fácil recuperarse de "no puedo
      // crear" que de dos fichas duplicadas en la base.
      if (l.error || d.error) { setYaTiene("local"); return; }
      setYaTiene(l.data ? "local" : d.data ? "dj" : "no");
    })();
  }, [user]);

  if (!loading && !user) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-16 text-center">
        <p className="text-lg font-bold text-tinta/70">Primero entra o crea tu cuenta.</p>
        <Link href="/perfil" className="mt-4 inline-block rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">Ir a entrar</Link>
      </main>
    );
  }

  // Mientras no sepamos si ya tiene ficha, no se enseña el formulario. Este
  // hueco es por donde se colaba el duplicado: la página ofrecía crear antes
  // de haber comprobado nada.
  if (loading || yaTiene === null) {
    return <main className="flex items-center justify-center gap-2 pt-24 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</main>;
  }

  // Ya tiene ficha: en vez de dejarle crear otra, se le lleva a la suya.
  if (yaTiene === "local" || yaTiene === "dj") {
    const esLocal = yaTiene === "local";
    return (
      <main className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 pt-16 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-oro text-tinta"><Check size={44} /></span>
        <h2 className="font-display text-2xl font-black">Ya estás dentro</h2>
        <p className="font-semibold text-tinta/70">
          {esLocal
            ? "Tu ficha ya existe. Si no la ves, entra en tu panel: no hace falta crearla otra vez."
            : "Ya tienes perfil de DJ."}
        </p>
        <Link href={esLocal ? "/local" : "/perfil"} className="mt-2 rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">
          {esLocal ? "Ir a mi panel" : "Ir a mi perfil"}
        </Link>
      </main>
    );
  }

  const crearLocal = async () => {
    if (!nombreLocal.trim() || !dir) { setError("Pon el nombre y busca la dirección."); return; }
    setGuardando(true); setError("");
    const { error } = await supabase.from("locales").insert({
      owner_id: user!.id, nombre: nombreLocal.trim(), telefono: tel.trim(),
      direccion: dir.display, lat: dir.lat, lng: dir.lng,
      codigo_postal: dir.cp, zona: dir.zona, estado: "borrador", tipo: "local",
    });
    setGuardando(false);
    if (error) setError(error.message);
    else { setFinRol("local"); setPaso("fin"); }
  };

  /**
   * El promotor comparte tabla con el local: es la misma ficha con `tipo`
   * distinto. Lo que cambia es que NO lleva dirección — organiza en sitios
   * distintos, así que el sitio lo pone cada tardeo al publicarlo.
   */
  const crearPromotor = async () => {
    if (!nombreLocal.trim()) { setError("Pon el nombre con el que organizas."); return; }
    setGuardando(true); setError("");
    const { error } = await supabase.from("locales").insert({
      owner_id: user!.id, nombre: nombreLocal.trim(), telefono: tel.trim(),
      estado: "borrador", tipo: "promotor",
    });
    setGuardando(false);
    if (error) setError(error.message);
    else { setFinRol("promotor"); setPaso("fin"); }
  };

  const crearDj = async () => {
    if (!nombreDj.trim()) { setError("Pon tu nombre artístico."); return; }
    setGuardando(true); setError("");
    const { error } = await supabase.from("djs").insert({
      profile_id: user!.id, nombre_artistico: nombreDj.trim(), estilos, bio: bio.trim(),
    });
    setGuardando(false);
    if (error) setError(error.message);
    else { setFinRol("dj"); setPaso("fin"); }
  };

  // ---------- FIN ----------
  if (paso === "fin") {
    // Local y promotor comparten panel: los dos son fichas de `locales`.
    const conPanel = finRol === "local" || finRol === "promotor";
    const titulo = finRol === "local" ? "¡Local creado!"
      : finRol === "promotor" ? "¡Ya eres promotor!"
      : "¡Perfil DJ creado!";
    const texto = finRol === "local"
      ? "Queda pendiente de verificación por el admin. Mientras, ya puedes preparar tus tardeos."
      : finRol === "promotor"
        ? "Queda pendiente de verificación. Al crear cada tardeo te pediremos dónde se hace, que es lo que te diferencia de un local fijo."
        : "Ya apareces como DJ. Los locales podrán añadirte a sus tardeos.";
    return (
      <main className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 pt-16 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-oro text-tinta"><Check size={44} /></span>
        <h2 className="font-display text-3xl font-black">{titulo}</h2>
        <p className="font-semibold text-tinta/70">{texto}</p>
        <Link href={conPanel ? "/local" : "/"} className="mt-2 rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">
          {conPanel ? "Ir a mi panel" : "Ir a la app"}
        </Link>
      </main>
    );
  }

  return (
    <main className="pb-10">
      <PanelHeader titulo="Únete a TardeosClub" volverHref={paso === "rol" ? "/perfil" : "#"} />
      <div className="mx-auto max-w-lg px-4 pt-5 md:px-8">
        {/* Paso 1: elegir rol */}
        {paso === "rol" && (
          <div className="flex flex-col gap-4">
            <p className="text-center font-semibold text-tinta/70">¿Cómo quieres unirte?</p>

            <Link href="/" className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-marca text-white"><PartyPopper size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Tardícola</span><span className="text-sm font-semibold text-tinta/60">Solo quiero descubrir tardeos e ir</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </Link>

            <button onClick={() => { setPaso("local"); setError(""); }} className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-oro text-tinta"><Store size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Soy un local</span><span className="text-sm font-semibold text-tinta/60">Quiero publicar mis tardeos</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </button>

            <button onClick={() => { setPaso("promotor"); setError(""); }} className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-magenta text-white"><Megaphone size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Soy promotor</span><span className="text-sm font-semibold text-tinta/60">Organizo fiestas en sitios distintos</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </button>

            <button onClick={() => { setPaso("dj"); setError(""); }} className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-tinta text-white"><Disc3 size={28} /></span>
              <span className="flex-1"><span className="block font-display text-xl font-black">Soy DJ</span><span className="text-sm font-semibold text-tinta/60">Quiero mi perfil y reputación</span></span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </button>
          </div>
        )}

        {/* Paso 2: LOCAL */}
        {paso === "local" && (
          <div className="flex flex-col gap-3">
            <button onClick={() => setPaso("rol")} className="text-sm font-bold text-magenta">← Cambiar rol</button>
            <h2 className="font-display text-2xl font-black">Datos de tu local</h2>

            <label className="text-sm font-black text-tinta/70">Nombre del local</label>
            <input value={nombreLocal} onChange={(e) => setNombreLocal(e.target.value)} placeholder="Sala Blau"
              className="rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />

            <label className="text-sm font-black text-tinta/70">Dirección (búscala en el mapa)</label>
            <AddressSearch onSelect={setDir} />
            <p className="-mt-1 text-xs font-semibold text-tinta/50">Guardamos calle, código postal, coordenadas y zona. Será la dirección por defecto de tus tardeos.</p>

            <label className="mt-1 text-sm font-black text-tinta/70">Teléfono (opcional)</label>
            <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="600 000 000"
              className="rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />

            {error && <p className="text-sm font-bold text-magenta">{error}</p>}
            <button onClick={crearLocal} disabled={guardando}
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white active:scale-[0.98] disabled:opacity-40">
              {guardando ? <Loader2 size={20} className="animate-spin" /> : <StoreIcon size={20} />} Crear mi local
            </button>
          </div>
        )}

        {/* Paso 2: PROMOTOR — igual que el local pero sin dirección fija */}
        {paso === "promotor" && (
          <div className="flex flex-col gap-3">
            <button onClick={() => setPaso("rol")} className="text-sm font-bold text-magenta">← Cambiar rol</button>
            <h2 className="font-display text-2xl font-black">Datos de promotor</h2>

            <label className="text-sm font-black text-tinta/70">Nombre con el que organizas</label>
            <input value={nombreLocal} onChange={(e) => setNombreLocal(e.target.value)} placeholder="Tardeos del Maresme"
              className="rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />
            <p className="-mt-1 text-xs font-semibold text-tinta/50">Es el nombre que verá la gente en cada tardeo que publiques.</p>

            <label className="mt-1 text-sm font-black text-tinta/70">Teléfono (opcional)</label>
            <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="600 000 000"
              className="rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />

            <div className="mt-1 flex items-start gap-2 rounded-2xl bg-oro/10 p-3 text-sm font-semibold text-tinta/80">
              <Megaphone size={18} className="mt-0.5 shrink-0 text-oro-600" />
              No te pedimos dirección: como organizas en sitios distintos, el lugar se elige
              al crear cada tardeo.
            </div>

            {error && <p className="text-sm font-bold text-magenta">{error}</p>}
            <button onClick={crearPromotor} disabled={guardando}
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white active:scale-[0.98] disabled:opacity-40">
              {guardando ? <Loader2 size={20} className="animate-spin" /> : <Megaphone size={20} />} Crear mi perfil de promotor
            </button>
          </div>
        )}

        {/* Paso 2: DJ */}
        {paso === "dj" && (
          <div className="flex flex-col gap-3">
            <button onClick={() => setPaso("rol")} className="text-sm font-bold text-magenta">← Cambiar rol</button>
            <h2 className="font-display text-2xl font-black">Tu perfil de DJ</h2>

            <label className="text-sm font-black text-tinta/70">Nombre artístico</label>
            <input value={nombreDj} onChange={(e) => setNombreDj(e.target.value)} placeholder="DJ Nando"
              className="rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />

            <label className="text-sm font-black text-tinta/70">Estilos (tus filtros e intereses)</label>
            <div className="flex flex-wrap gap-2">
              <SelectorEstilos valor={estilos} onChange={setEstilos} />
            </div>

            <label className="mt-1 text-sm font-black text-tinta/70">Biografía (opcional)</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Cuéntanos sobre ti…"
              className="rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />

            {error && <p className="text-sm font-bold text-magenta">{error}</p>}
            <button onClick={crearDj} disabled={guardando}
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white active:scale-[0.98] disabled:opacity-40">
              {guardando ? <Loader2 size={20} className="animate-spin" /> : <Disc3 size={20} />} Crear mi perfil DJ
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function Unirse() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-bold text-tinta/50">Cargando…</div>}>
      <UnirseContent />
    </Suspense>
  );
}
