"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import { useAuth } from "@/lib/useAuth";
import { getMiLocal, vincularDjsPorNombre, invalidarCacheTardeos } from "@/lib/tardeos";
import { supabase } from "@/lib/supabase";
import {
  Upload, Wand2, Sparkles, Loader2, Check, AlertTriangle,
  Calendar, Clock, Music, MapPin, Disc3, Ticket, ArrowRight, Store,
} from "lucide-react";

type Modo = "elegir" | "subir" | "crear";
type Estado = "inicio" | "procesando" | "revisar" | "publicado";

const EXTRAIDO = {
  titulo: "",
  fecha: "",
  horaInicio: "",
  horaFin: "",
  dj: "",
  estilo: "",
  ubicacion: "",
  zona: "",
  tipo: "gratis",
  precio: "",
};

function Campo({
  label, icon: Icon, valor, onChange, revisar, type = "text", placeholder,
}: {
  label: string; icon: any; valor: string; onChange: (v: string) => void;
  revisar?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70">
        <Icon size={16} className="text-magenta" /> {label}
        {revisar && (
          <span className="inline-flex items-center gap-1 rounded-full bg-oro/20 px-2 py-0.5 text-xs font-black text-oro-600">
            <AlertTriangle size={11} /> Revisar
          </span>
        )}
      </span>
      <input
        type={type}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border-2 bg-white px-4 py-3 text-base font-semibold outline-none transition focus:border-magenta ${
          revisar ? "border-oro/60 bg-oro/5" : "border-magenta-100"
        }`}
      />
    </label>
  );
}

export default function CrearTardeo() {
  const { user } = useAuth();
  const [modo, setModo] = useState<Modo>("elegir");
  const [estado, setEstado] = useState<Estado>("inicio");
  const [form, setForm] = useState(EXTRAIDO);
  const [prompt, setPrompt] = useState("");
  // El admin puede publicar en cualquier local; el resto, solo en el suyo.
  const [esAdmin, setEsAdmin] = useState(false);
  const [locales, setLocales] = useState<any[]>([]);
  const [localId, setLocalId] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState("");
  const [revisar, setRevisar] = useState<Set<string>>(new Set());
  const [flyerGen, setFlyerGen] = useState<string | null>(null);
  const [archivoSubido, setArchivoSubido] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: perfil } = await supabase
        .from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      const admin = !!perfil?.is_admin;
      setEsAdmin(admin);

      const propio = await getMiLocal(user.id);
      if (admin) {
        // RLS deja al admin ver todos los locales, tenga o no uno propio.
        const { data } = await supabase
          .from("locales").select("id,nombre,zona,direccion,lat,lng").order("nombre");
        const todos = data ?? [];
        setLocales(todos);
        setLocalId(propio?.id ?? todos[0]?.id ?? "");
      } else {
        setLocales(propio ? [propio] : []);
        setLocalId(propio?.id ?? "");
      }
    })();
  }, [user]);

  const local = locales.find((l) => l.id === localId) ?? null;

  // La dirección y la zona del tardeo salen del local elegido. Si el admin
  // cambia de local a media faena, hay que rehacerlas o publicaría en el sitio
  // equivocado con las coordenadas del anterior.
  useEffect(() => {
    if (!local) return;
    setForm((f) => ({ ...f, ubicacion: local.direccion ?? "", zona: local.zona ?? "" }));
  }, [localId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  // Vía "crear flyer con IA": gpt-image-1 genera + estampamos el sello
  const generarFlyer = async () => {
    setError("");
    setEstado("procesando");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/crear-flyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: prompt, titulo: form.titulo, estilo: form.estilo, dj: form.dj, fecha: form.fecha, hora: form.horaInicio, accessToken: session?.access_token }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "No se pudo generar el flyer.");
      setFlyerGen(j.image); // base64 jpg con sello
      const d = j.datos || {};
      setForm((f) => ({
        ...f,
        titulo: d.titulo || f.titulo,
        fecha: d.fecha || f.fecha,
        horaInicio: d.horaInicio || f.horaInicio,
        horaFin: d.horaFin || f.horaFin,
        dj: d.dj || f.dj,
        estilo: d.estilo || f.estilo,
        tipo: d.tipoEntrada || f.tipo,
        precio: d.precio || f.precio,
        ubicacion: local?.direccion ?? f.ubicacion,
        zona: local?.zona ?? f.zona,
      }));
      setEstado("revisar");
    } catch (e: any) {
      setError(e?.message || "Error al generar el flyer.");
      setEstado("inicio");
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]); // sin el prefijo data:
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const base64ToBlob = (b64: string, type: string): Blob => {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type });
  };

  // Vía "ya tengo el flyer": Claude LEE la imagen (IA real)
  const leerFlyer = async (file: File) => {
    setError("");
    setArchivoSubido(file);
    setEstado("procesando");
    try {
      const imageBase64 = await fileToBase64(file);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/leer-flyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mediaType: file.type, accessToken: session?.access_token }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "No se pudo leer el flyer.");
      const d = j.data;
      setForm((f) => ({
        ...f,
        titulo: d.titulo || f.titulo,
        fecha: d.fecha || f.fecha,
        horaInicio: d.horaInicio || f.horaInicio,
        horaFin: d.horaFin || f.horaFin,
        dj: d.dj || "",
        estilo: d.estilo || "",
        tipo: d.tipoEntrada || "gratis",
        precio: d.precio || "",
        ubicacion: local?.direccion ?? f.ubicacion,
        zona: local?.zona ?? f.zona,
      }));
      setRevisar(new Set(Array.isArray(d.revisar) ? d.revisar : []));
      setEstado("revisar");
    } catch (e: any) {
      setError(e?.message || "Error al leer el flyer.");
      setEstado("inicio");
    }
  };

  const publicar = async () => {
    if (!user || !local) {
      setError(
        esAdmin
          ? "Elige en qué local se publica el tardeo."
          : "Necesitas un local para publicar. Créalo primero."
      );
      return;
    }

    // --- Validación antes de publicar ---
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
    if (!form.titulo.trim()) { setError("Ponle un título al tardeo."); return; }
    if (!form.fecha) { setError("Falta la fecha del tardeo."); return; }
    if (form.fecha < hoy) { setError("La fecha ya ha pasado. Pon una fecha de hoy en adelante."); return; }
    if (!form.horaInicio) { setError("Falta la hora de inicio."); return; }
    if (form.tipo === "pago" && !(Number(form.precio) > 0)) { setError("Indica el precio de la entrada."); return; }

    setPublicando(true); setError("");

    // Guardar el flyer (generado o subido) en Supabase Storage
    let flyer_url = "/flyers/placeholder.jpg";
    try {
      if (flyerGen) {
        const blob = base64ToBlob(flyerGen, "image/jpeg");
        const p = `${user.id}/${Date.now()}.jpg`;
        const { error: up } = await supabase.storage.from("flyers").upload(p, blob, { contentType: "image/jpeg" });
        if (up) { setError("No se pudo subir el flyer. Inténtalo de nuevo."); setPublicando(false); return; }
        flyer_url = supabase.storage.from("flyers").getPublicUrl(p).data.publicUrl;
      } else if (archivoSubido) {
        const ext = (archivoSubido.name.split(".").pop() || "jpg").toLowerCase();
        const p = `${user.id}/${Date.now()}.${ext}`;
        const { error: up } = await supabase.storage.from("flyers").upload(p, archivoSubido, { contentType: archivoSubido.type || "image/jpeg" });
        if (up) { setError("No se pudo subir el flyer. Inténtalo de nuevo."); setPublicando(false); return; }
        flyer_url = supabase.storage.from("flyers").getPublicUrl(p).data.publicUrl;
      }
    } catch {
      setError("No se pudo subir el flyer. Inténtalo de nuevo."); setPublicando(false); return;
    }

    const { data: nuevo, error } = await supabase.from("tardeos").insert({
      local_id: local.id,
      titulo: form.titulo.trim(),
      fecha: form.fecha,
      hora_inicio: form.horaInicio,
      hora_fin: form.horaFin || null,
      direccion: form.ubicacion || local.direccion,
      lat: local.lat,
      lng: local.lng,
      zona: local.zona,
      estilo: form.estilo,
      es_de_pago: form.tipo === "pago",
      tiene_lista: form.tipo === "lista",
      precio: form.tipo === "pago" ? Number(form.precio) || null : null,
      flyer_url,
      flyer_origen: flyerGen ? "ia" : modo === "subir" ? "subido" : "ia",
      estado: "publicado",
      created_by: user.id,
    }).select("id").single();

    // Vincular los DJs del flyer (por nombre) para que aparezca en su perfil
    if (nuevo?.id && form.dj) {
      const nombres = form.dj.split(/[,·&]|\sy\s/i);
      try { await vincularDjsPorNombre(nuevo.id, nombres); } catch { /* no crítico */ }
    }

    setPublicando(false);
    if (error) setError(error.message);
    else {
      invalidarCacheTardeos(); // que el listado y el mapa lo vean ya
      setEstado("publicado");
    }
  };

  // El admin llega desde /admin/crear, así que ahí debe volver.
  const panelHref = esAdmin ? "/admin" : "/local";

  // ---------- Publicado ----------
  if (estado === "publicado") {
    return (
      <main className="pb-10">
        <PanelHeader titulo="Crear tardeo" volverHref={panelHref} />
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 pt-16 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-oro text-tinta">
            <Check size={44} />
          </span>
          <h2 className="font-display text-3xl font-black">¡Tardeo publicado!</h2>
          <p className="font-semibold text-tinta/70">
            «{form.titulo}» ya está visible para todos los tardícolas de {form.zona}.
          </p>
          {esAdmin && local && (
            <p className="-mt-2 text-sm font-semibold text-tinta/50">Publicado en {local.nombre}.</p>
          )}
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Link href={panelHref} className="rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">
              Ir al panel
            </Link>
            <Link href="/tardeos" className="rounded-2xl bg-white px-6 py-4 text-lg font-extrabold text-magenta ring-2 ring-magenta-100">
              Ver en la app
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-10">
      <PanelHeader titulo="Crear tardeo" volverHref={panelHref} />
      <div className="mx-auto max-w-lg px-4 pt-5 md:px-8">
        {/* Selector de local: solo para admin, que publica en nombre de otros.
            Va arriba y visible en todos los pasos porque de él salen la
            dirección y las coordenadas con las que acabará el tardeo. */}
        {esAdmin && (
          <div className="mb-4 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
            <label className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70">
              <Store size={16} className="text-magenta" /> Publicar en
            </label>
            {locales.length === 0 ? (
              <p className="text-sm font-bold text-tinta/50">
                No hay locales todavía.{" "}
                <Link href="/admin/crear" className="text-magenta underline">Crea uno primero</Link>.
              </p>
            ) : (
              <>
                <select
                  value={localId}
                  onChange={(e) => setLocalId(e.target.value)}
                  className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 font-semibold outline-none focus:border-magenta"
                >
                  {locales.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}{l.zona ? ` · ${l.zona}` : ""}
                    </option>
                  ))}
                </select>
                {local && !(local.lat && local.lng) && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs font-bold text-magenta">
                    <AlertTriangle size={14} className="mt-px shrink-0" />
                    Este local no tiene coordenadas: el tardeo no saldrá en el mapa.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Paso 1: elegir método */}
        {modo === "elegir" && (
          <section className="flex flex-col gap-4">
            <p className="text-center font-semibold text-tinta/70">
              La IA hace el trabajo. Elige cómo empezar:
            </p>
            <button
              onClick={() => { setModo("subir"); setEstado("inicio"); }}
              className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-marca text-white">
                <Upload size={28} />
              </span>
              <span className="flex-1">
                <span className="block font-display text-xl font-black">Ya tengo el flyer</span>
                <span className="text-sm font-semibold text-tinta/60">Súbelo y la IA saca fecha, DJ, hora…</span>
              </span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </button>

            <button
              onClick={() => { setModo("crear"); setEstado("inicio"); }}
              className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-tarjeta ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-oro text-tinta">
                <Wand2 size={28} />
              </span>
              <span className="flex-1">
                <span className="block font-display text-xl font-black">Créame el flyer</span>
                <span className="text-sm font-semibold text-tinta/60">Descríbelo y la IA lo diseña con el sello</span>
              </span>
              <ArrowRight className="text-magenta transition group-hover:translate-x-1" />
            </button>
          </section>
        )}

        {/* Paso 2a: subir flyer (IA real lo lee) */}
        {modo === "subir" && estado === "inicio" && (
          <section>
            <button onClick={() => setModo("elegir")} className="mb-3 text-sm font-bold text-magenta">← Cambiar método</button>
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-magenta-200 bg-white p-8 text-center transition hover:bg-magenta-50">
              <Upload size={44} className="text-magenta" />
              <p className="font-black">Sube tu flyer</p>
              <p className="text-sm font-semibold text-tinta/60">JPG o PNG · la IA sacará fecha, DJ, hora…</p>
              <span className="mt-1 rounded-2xl bg-magenta px-6 py-3 text-base font-extrabold text-white">Elegir imagen</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) leerFlyer(f); }} />
            </label>
            {error && <p className="mt-3 text-sm font-bold text-magenta">{error}</p>}
          </section>
        )}

        {/* Paso 2b: crear flyer con IA */}
        {modo === "crear" && estado === "inicio" && (
          <section>
            <button onClick={() => setModo("elegir")} className="mb-3 text-sm font-bold text-magenta">← Cambiar método</button>
            <label className="mb-1 block text-sm font-black text-tinta/70">Describe tu tardeo</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Ej: Tardeo remember de verano en la terraza, ambiente de atardecer, con DJ Nando…"
              className="w-full rounded-xl border-2 border-magenta-100 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-magenta"
            />
            <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-magenta-50 py-3 font-extrabold text-magenta">
              <Upload size={18} /> Adjuntar fotos / logo (opcional)
            </button>
            <button onClick={generarFlyer} disabled={!prompt.trim()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-oro py-4 text-lg font-extrabold text-tinta transition active:scale-[0.98] disabled:opacity-40">
              <Sparkles size={22} /> Generar flyer con IA
            </button>
            <p className="mt-2 text-center text-xs font-semibold text-tinta/50">Llevará el sello «Recomendado por TardeosClub».</p>
          </section>
        )}

        {/* Procesando */}
        {estado === "procesando" && (
          <section className="flex flex-col items-center gap-4 py-16 text-center">
            <Loader2 size={48} className="animate-spin text-magenta" />
            <p className="font-display text-xl font-black">
              {modo === "subir" ? "Leyendo tu flyer…" : "Diseñando tu flyer…"}
            </p>
            <p className="font-semibold text-tinta/60">La IA está sacando los datos. Un momento.</p>
          </section>
        )}

        {/* Revisar */}
        {estado === "revisar" && (
          <section className="flex flex-col gap-4">
            {flyerGen && (
              <div className="overflow-hidden rounded-2xl bg-tinta ring-1 ring-magenta-100">
                {/* eslint-disable-next-line @next/next/no-img-element -- llega en base64 desde la IA y vive solo en memoria: next/image no optimiza data URLs */}
                <img src={`data:image/jpeg;base64,${flyerGen}`} alt="Flyer generado por IA" className="mx-auto max-h-[420px] w-auto" />
              </div>
            )}
            <div className="flex items-center gap-2 rounded-2xl bg-oro/10 p-3 text-sm font-bold text-tinta/80">
              <Sparkles size={18} className="shrink-0 text-oro-600" />
              {flyerGen
                ? "¡Tu flyer está listo con el sello! Completa los datos y publica."
                : "La IA rellenó los datos. Revisa lo marcado en amarillo y publica."}
            </div>

            <Campo label="Título" icon={Music} valor={form.titulo} onChange={(v) => set("titulo", v)} />
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Fecha" icon={Calendar} type="date" valor={form.fecha} onChange={(v) => set("fecha", v)} revisar={revisar.has("fecha")} />
              <Campo label="Estilo" icon={Music} valor={form.estilo} onChange={(v) => set("estilo", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Empieza" icon={Clock} type="time" valor={form.horaInicio} onChange={(v) => set("horaInicio", v)} />
              <Campo label="Acaba" icon={Clock} type="time" valor={form.horaFin} onChange={(v) => set("horaFin", v)} revisar={revisar.has("horaFin")} />
            </div>
            <Campo label="DJ" icon={Disc3} valor={form.dj} onChange={(v) => set("dj", v)} />

            <Campo label="Ubicación" icon={MapPin} valor={form.ubicacion} onChange={(v) => set("ubicacion", v)} />
            <p className="-mt-2 flex items-center gap-1.5 text-xs font-semibold text-tinta/50">
              <MapPin size={13} /> Por defecto la de tu local. Si es una zona nueva, aparecerá sola en los filtros.
            </p>

            <div>
              <span className="mb-1 flex items-center gap-2 text-sm font-black text-tinta/70">
                <Ticket size={16} className="text-magenta" /> Entrada
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { k: "gratis", label: "Gratis" },
                  { k: "pago", label: "Entrada" },
                  { k: "lista", label: "Por lista" },
                ].map((o) => (
                  <button
                    key={o.k}
                    onClick={() => set("tipo", o.k)}
                    className={`min-h-[44px] rounded-xl py-3 text-sm font-extrabold transition ${
                      form.tipo === o.k ? "bg-magenta text-white" : "bg-white text-tinta/70 ring-1 ring-magenta-100"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {form.tipo !== "gratis" && (
                <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-magenta-50 p-3 text-xs font-semibold text-magenta-700">
                  <Ticket size={14} /> La venta se gestiona en Fourvenues (redirección con tu código RRPP).
                </p>
              )}
            </div>

            {error && <p className="text-sm font-bold text-magenta">{error}</p>}
            <button
              onClick={publicar}
              disabled={publicando}
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white shadow-tarjeta active:scale-[0.98] disabled:opacity-40"
            >
              {publicando ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} />} Publicar tardeo
            </button>
            <button onClick={() => { setModo("elegir"); setEstado("inicio"); }} className="pb-2 text-center text-sm font-bold text-tinta/50">
              Cancelar
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
