"use client";
import Image from "next/image";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import ServiciosExternos from "@/components/ServiciosExternos";
import { useAuth } from "@/lib/useAuth";
import { getMiDj, updateMiDj, subirAvatarDj } from "@/lib/tardeos";
import ContenidoDj from "@/components/ContenidoDj";
import CampoPlaylist from "@/components/CampoPlaylist";
import SelectorEstilos from "@/components/SelectorEstilos";
import { Disc3, BadgeCheck, Star, Music, Loader2, Pencil, Camera, Check, X, Instagram, Youtube, Music2, Phone } from "lucide-react";

type Redes = { instagram?: string; soundcloud?: string; youtube?: string; whatsapp?: string };

export default function PanelDj() {
  const { user, loading } = useAuth();
  const [dj, setDj] = useState<any | null>(null);
  const [cargando, setCargando] = useState(true);

  // edición
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [bio, setBio] = useState("");
  const [estilos, setEstilos] = useState<string[]>([]);
  const [redes, setRedes] = useState<Redes>({});
  const [playlist, setPlaylist] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) { setCargando(false); return; }
    getMiDj(user.id).then((d) => { setDj(d); setCargando(false); });
  }, [user]);

  const abrirEdicion = () => {
    setNombre(dj.nombre_artistico || "");
    setBio(dj.bio || "");
    setEstilos(Array.isArray(dj.estilos) ? dj.estilos : []);
    setRedes(dj.redes && typeof dj.redes === "object" ? dj.redes : {});
    setPlaylist(dj.playlist_url || "");
    setAvatar(dj.avatar_url || null);
    setEditando(true);
  };

  const toggleEstilo = (e: string) =>
    setEstilos((p) => (p.includes(e) ? p.filter((x) => x !== e) : [...p, e]));

  const onFoto = async (file: File) => {
    if (!dj) return;
    setSubiendo(true);
    const url = await subirAvatarDj(dj.id, file);
    if (url) setAvatar(url);
    setSubiendo(false);
  };

  const guardar = async () => {
    if (!dj) return;
    setGuardando(true);
    const redesLimpias: Redes = {};
    (Object.keys(redes) as (keyof Redes)[]).forEach((k) => {
      const v = (redes[k] || "").trim();
      if (v) redesLimpias[k] = v;
    });
    const fields: Record<string, unknown> = {
      playlist_url: playlist.trim() || null,
      nombre_artistico: nombre.trim() || dj.nombre_artistico,
      bio: bio.trim() || null,
      estilos,
      redes: redesLimpias,
      avatar_url: avatar,
    };
    const { error } = await updateMiDj(dj.id, fields);
    setGuardando(false);
    if (!error) {
      setDj({ ...dj, ...fields });
      setEditando(false);
    } else {
      alert("No se pudo guardar. ¿Has aplicado el SQL del avatar? " + error.message);
    }
  };

  if (loading || cargando) {
    return (
      <main className="flex items-center justify-center gap-2 pt-24 text-tinta/50">
        <Loader2 className="animate-spin" /> Cargando…
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-16 text-center">
        <p className="text-lg font-bold text-tinta/70">Entra para ver tu perfil de DJ.</p>
        <Link href="/perfil" className="mt-4 inline-block rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">Entrar</Link>
      </main>
    );
  }

  if (!dj) {
    return (
      <main className="pb-8">
        <PanelHeader titulo="Perfil de DJ" volverHref="/perfil" />
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 pt-16 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-tinta text-white"><Disc3 size={40} /></span>
          <h2 className="font-display text-2xl font-black">Aún no eres DJ</h2>
          <p className="font-semibold text-tinta/70">Crea tu perfil de DJ para ganar reputación y aparecer en los tardeos.</p>
          <Link href="/unirse?rol=dj" className="rounded-2xl bg-magenta px-6 py-4 text-lg font-extrabold text-white">Crear mi perfil DJ</Link>
        </div>
      </main>
    );
  }

  const inicial = String(dj.nombre_artistico || "DJ").replace("DJ ", "").charAt(0);
  const avatarActual = editando ? avatar : dj.avatar_url;
  const estilosActuales: string[] = Array.isArray(dj.estilos) ? dj.estilos : [];

  return (
    <main className="pb-8">
      <PanelHeader titulo="Perfil de DJ" volverHref="/perfil">
        {dj.verificado ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-oro/20 px-3 py-1 text-xs font-black text-oro-600"><BadgeCheck size={14} /> Verificado</span>
        ) : (
          <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-black text-tinta/50">Sin verificar</span>
        )}
      </PanelHeader>

      <div className="mx-auto max-w-2xl px-4 pt-5 md:px-8">
        {/* Tarjeta principal */}
        <section className="relative overflow-hidden rounded-3xl bg-tinta p-6 text-white shadow-tarjeta md:p-8">
          <span className="bokeh" style={{ width: 120, height: 120, top: -20, right: 30, background: "#E10A5A", opacity: 0.5 }} />
          <div className="relative flex items-center gap-4">
            <div className="relative">
              {avatarActual ? (
                <Image src={avatarActual} alt="" width={64} height={64} className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/20" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 font-display text-2xl font-black text-oro">{inicial}</span>
              )}
              {editando && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-magenta text-white ring-2 ring-tinta"
                  aria-label="Cambiar foto"
                >
                  {subiendo ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFoto(e.target.files[0])}
              />
            </div>

            <div className="flex-1">
              {editando ? (
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre artístico"
                  className="w-full rounded-xl bg-white/10 px-3 py-2 font-display text-xl font-black text-white outline-none ring-1 ring-white/20 placeholder:text-white/40"
                />
              ) : (
                <h2 className="font-display text-2xl font-black leading-tight md:text-3xl">{dj.nombre_artistico}</h2>
              )}
              <p className="mt-1 inline-flex items-center gap-1 font-bold text-oro">
                <Star size={16} fill="currentColor" /> {Number(dj.reputacion_score ?? 0).toFixed(1)} de reputación
              </p>
            </div>

            {!editando && (
              <button
                onClick={abrirEdicion}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-extrabold text-white transition hover:bg-white/25"
              >
                <Pencil size={15} /> Editar
              </button>
            )}
          </div>
        </section>

        {/* Estilos */}
        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-tinta/60"><Music size={16} className="text-magenta" /> Estilos</h3>
          {editando ? (
            <div className="flex flex-wrap gap-2">
              <SelectorEstilos valor={estilos} onChange={setEstilos} />
            </div>
          ) : estilosActuales.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {estilosActuales.map((e) => (
                <span key={e} className="rounded-full bg-magenta-50 px-4 py-2 text-sm font-extrabold text-magenta-700">{e}</span>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold text-tinta/50">Aún no has elegido estilos.</p>
          )}
        </section>

        {/* Biografía */}
        <section className="mt-5 rounded-2xl bg-white p-5 shadow-tarjeta ring-1 ring-black/5">
          <h3 className="mb-2 text-sm font-black text-tinta/60">Biografía</h3>
          {editando ? (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Cuéntale a la gente quién eres, dónde pinchas, tu rollo…"
              className="w-full rounded-xl border-2 border-magenta-100 px-3 py-2 font-semibold outline-none transition focus:border-magenta"
            />
          ) : (
            <p className="font-semibold text-tinta/80">{dj.bio || "Aún no has escrito tu biografía."}</p>
          )}

          {/* La playlist va con la bio: es parte de presentarse, no un dato de
              contacto. Solo en modo edición, como el resto. */}
          {editando && <div className="mt-3"><CampoPlaylist valor={playlist} onCambio={setPlaylist} /></div>}
        </section>

        {/* Redes y contacto (solo en edición) */}
        {editando && (
          <section className="mt-5 rounded-2xl bg-white p-5 shadow-tarjeta ring-1 ring-black/5">
            <h3 className="mb-3 text-sm font-black text-tinta/60">Redes y contacto</h3>
            <div className="flex flex-col gap-3">
              {([
                { k: "instagram", label: "Instagram", icon: Instagram, ph: "usuario o enlace" },
                { k: "soundcloud", label: "SoundCloud", icon: Music2, ph: "enlace a tu perfil" },
                { k: "youtube", label: "YouTube", icon: Youtube, ph: "enlace a tu canal" },
                { k: "whatsapp", label: "WhatsApp (contratación)", icon: Phone, ph: "34600000000" },
              ] as const).map(({ k, label, icon: Ic, ph }) => (
                <label key={k} className="flex items-center gap-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-magenta-50 text-magenta"><Ic size={18} /></span>
                  <input
                    value={redes[k] || ""}
                    onChange={(e) => setRedes((p) => ({ ...p, [k]: e.target.value }))}
                    placeholder={`${label}: ${ph}`}
                    className="w-full rounded-xl border-2 border-magenta-100 px-3 py-2.5 text-sm font-semibold outline-none focus:border-magenta"
                  />
                </label>
              ))}
            </div>
          </section>
        )}

        {/* Botones de edición */}
        {editando && (
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setEditando(false)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-extrabold text-tinta/70 ring-1 ring-black/10"
            >
              <X size={18} /> Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando || subiendo}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-magenta px-5 py-3.5 font-extrabold text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              {guardando ? <Loader2 size={20} className="animate-spin" /> : <><Check size={20} /> Guardar cambios</>}
            </button>
          </div>
        )}

        {!editando && <ServiciosExternos tipo="dj" />}
      </div>
      {/* Sesiones, vídeos, flyers y fotos: §5.2 del documento. Es lo
          que convierte la ficha de un DJ en algo que merezca
          visitarse, más allá de su nombre y sus estilos. */}
      <ContenidoDj djId={dj.id} />
    </main>
  );
}
