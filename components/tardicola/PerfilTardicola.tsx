"use client";

import { imagenParaSubir } from "@/app/local/_panel/reducirImagen";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Headphones, Play, SlidersHorizontal, CalendarDays, Gift, Moon, Bell, LifeBuoy, LogOut, ChevronRight,
  Camera, Loader2, Bookmark, Settings, Store, Disc3, Shield, Sparkles,
} from "lucide-react";
import CabeceraApp from "@/components/CabeceraApp";
import ReportarProblema from "@/components/ReportarProblema";
import { supabase } from "@/lib/supabase";
import { useRoles } from "@/lib/permisos";
import { getAdn, tieneAdn, guardarTema, temaActual, type Tema } from "@/lib/tardicola";

type Perfil = { alias: string; bio: string; avatar_url: string | null; display_name: string | null };

/**
 * Perfil propio (dossier pág. 9, vídeo 2:00): foto, alias y presentación;
 * Mis DJs, Mis sets, Mi ADN, Historial, Sorteos, modo claro/oscuro,
 * Notificaciones, Necesito ayuda y Cerrar sesión. El email y el teléfono no
 * salen nunca en lo público (perfil_publico, lote 63).
 */
export default function PerfilTardicola({ uid }: { uid: string }) {
  const router = useRouter();
  const roles = useRoles();
  const [p, setP] = useState<Perfil | null>(null);
  const [editando, setEditando] = useState(false);
  const [borr, setBorr] = useState({ alias: "", bio: "" });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [tema, setTema] = useState<Tema>("claro");
  const [sinAdn, setSinAdn] = useState(false);
  const [adnSaltado, setAdnSaltado] = useState(true);
  const fichero = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTema(temaActual());
    try { setAdnSaltado(localStorage.getItem("tc_adn_saltado") === "1"); } catch { setAdnSaltado(false); }
    supabase.from("profiles").select("alias,bio,avatar_url,display_name").eq("id", uid).maybeSingle().then(({ data, error }) => {
      // Sin el lote 63 no hay alias/bio: se lee lo básico.
      if (error) {
        supabase.from("profiles").select("avatar_url,display_name").eq("id", uid).maybeSingle()
          .then((r) => setP({ alias: "", bio: "", avatar_url: r.data?.avatar_url ?? null, display_name: r.data?.display_name ?? null }));
        return;
      }
      setP({ alias: data?.alias ?? "", bio: data?.bio ?? "", avatar_url: data?.avatar_url ?? null, display_name: data?.display_name ?? null });
    });
    getAdn(uid).then((a) => setSinAdn(Boolean(a) && !tieneAdn(a) && !a?.rellenadoEn));
  }, [uid]);

  const guardar = async () => {
    setMsg(null);
    const alias = borr.alias.trim();
    if (alias && (alias.length < 2 || alias.length > 30)) { setMsg({ ok: false, t: "El alias debe tener entre 2 y 30 letras." }); return; }
    const { error } = await supabase.from("profiles").update({ alias: alias || null, bio: borr.bio.trim() || null }).eq("id", uid);
    if (error) {
      setMsg({ ok: false, t: error.code === "23505" ? "Ese alias ya lo usa otra persona." : error.code === "42703" || error.code === "PGRST204" ? "Esta sección aún no está disponible." : "No se pudo guardar." });
      return;
    }
    setP((x) => x && { ...x, alias, bio: borr.bio.trim() });
    setEditando(false);
    setMsg({ ok: true, t: "Perfil guardado." });
  };

  /** La foto va al bucket de siempre (flyers), carpeta avatars/. */
  const subirFoto = async (original: File) => {
    if (!original.type.startsWith("image/") || original.size > 5_000_000) { setMsg({ ok: false, t: "Elige una imagen de menos de 5 MB." }); return; }
    let f: File;
    try { f = await imagenParaSubir(original); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); return; }
    setSubiendo(true); setMsg(null);
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
    const ruta = `avatars/${uid}-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("flyers").upload(ruta, f, { contentType: f.type, upsert: true });
    if (up.error) { setSubiendo(false); setMsg({ ok: false, t: "No se pudo subir la foto." }); return; }
    const url = supabase.storage.from("flyers").getPublicUrl(ruta).data.publicUrl;
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", uid);
    setSubiendo(false);
    if (error) { setMsg({ ok: false, t: "No se pudo guardar la foto." }); return; }
    setP((x) => x && { ...x, avatar_url: url });
  };

  const cambiarTema = async () => {
    const n: Tema = tema === "oscuro" ? "claro" : "oscuro";
    setTema(n);
    await guardarTema(uid, n);
  };

  const salir = async () => { await supabase.auth.signOut(); router.replace("/"); };
  const nombre = p?.alias || p?.display_name?.split(" ")[0] || "Tardícola";

  return (
    <main className="bg-fondo">
      {/* El h1 es el nombre de la persona (abajo): la cabecera no repite otro. */}
      <CabeceraApp titulo="Perfil" sinH1 />
      <div className="mx-auto max-w-xl px-4 pt-5 md:pt-10">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fichero.current?.click()} aria-label="Cambiar foto"
            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-marfil-100">
            {p?.avatar_url ? <Image src={p.avatar_url} alt="" fill sizes="96px" className="object-cover" />
              : <span className="grid h-full w-full place-items-center text-[32px] font-bold text-magenta-700 dark:text-magenta-400">{nombre.charAt(0)}</span>}
            <span className="absolute inset-x-0 bottom-0 grid h-7 place-items-center bg-black/45 text-white">
              {subiendo ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Camera size={15} aria-hidden />}
            </span>
          </button>
          <input ref={fichero} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && subirFoto(e.target.files[0])} />
          <div className="min-w-0">
            <h1 className="truncate text-[28px] font-bold text-tinta">{nombre}</h1>
            {p?.bio && <p className="text-[15px] text-tinta-suave">{p.bio}</p>}
            <button type="button" onClick={() => { setBorr({ alias: p?.alias ?? "", bio: p?.bio ?? "" }); setEditando((v) => !v); }}
              className="min-h-[44px] text-[15px] font-semibold text-magenta-700 dark:text-magenta-400">Editar perfil</button>
          </div>
        </div>

        {editando && (
          <div className="mt-3 flex flex-col gap-3 rounded-3xl border border-linea bg-superficie p-4">
            <label className="text-[15px] font-semibold text-tinta">Alias (lo que ven los demás)
              <input value={borr.alias} maxLength={30} onChange={(e) => setBorr({ ...borr, alias: e.target.value })}
                className="mt-1 min-h-[48px] w-full rounded-xl border border-linea-fuerte bg-superficie px-3 text-[16px] font-normal" />
            </label>
            <label className="text-[15px] font-semibold text-tinta">Presentación
              <textarea value={borr.bio} maxLength={300} rows={3} onChange={(e) => setBorr({ ...borr, bio: e.target.value })}
                className="mt-1 w-full rounded-xl border border-linea-fuerte bg-superficie px-3 py-2 text-[16px] font-normal" />
            </label>
            <button type="button" onClick={guardar} className="min-h-[48px] rounded-2xl bg-magenta font-bold text-white">Guardar</button>
          </div>
        )}
        {msg && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-[15px] font-semibold ${msg.ok ? "bg-ok-fondo text-ok" : "bg-error-fondo text-error"}`}>{msg.t}</p>}

        {/* ADN opcional tras crear la cuenta: se puede saltar y no bloquea nada. */}
        {sinAdn && !adnSaltado && (
          <div className="mt-4 rounded-3xl border border-magenta/30 bg-magenta-50 p-4">
            <p className="flex items-center gap-2 font-bold text-magenta-700"><Sparkles size={18} aria-hidden /> Cuéntanos qué te mueve</p>
            <p className="text-[15px] text-tinta-suave">Con tu ADN te enseñamos planes afines. Es opcional.</p>
            <div className="mt-3 flex gap-2">
              <Link href="/perfil/adn" className="inline-flex min-h-[44px] items-center rounded-2xl bg-magenta px-4 font-bold text-white">Rellenar mi ADN</Link>
              <button type="button" onClick={() => { setAdnSaltado(true); try { localStorage.setItem("tc_adn_saltado", "1"); } catch { /* nada */ } }}
                className="min-h-[44px] px-3 font-semibold text-tinta-suave">Ahora no</button>
            </div>
          </div>
        )}

        <ul className="mt-5 divide-y divide-linea">
          {/* Los paneles, lo primero: quien es DJ, local o admin entra sobre
              todo a trabajar (vídeo: el perfil del DJ empieza por sus cosas).
              Al final de la lista, tras «Ajustes», no los encontraba nadie. */}
          {(roles.esLocal || roles.esPromotor) && <Fila href="/local" icono={<Store size={20} />}>{`Mi panel de ${roles.esPromotor ? "eventos" : "local"}`}</Fila>}
          {roles.esDj && <Fila href="/dj" icono={<Disc3 size={20} />}>Mi panel de DJ</Fila>}
          {roles.esAdmin && <Fila href="/admin" icono={<Shield size={20} />}>Administración</Fila>}
          <Fila href="/perfil/djs" icono={<Headphones size={20} />}>Mis DJs</Fila>
          <Fila href="/perfil/sets" icono={<Play size={20} />}>Mis sets</Fila>
          <Fila href="/perfil/adn" icono={<SlidersHorizontal size={20} />}>Mi ADN</Fila>
          {roles.esProfesional && <Fila href="/proxima-parada" icono={<Bookmark size={20} />}>Próxima Parada</Fila>}
          <Fila href="/proxima-parada?pestana=pasados" icono={<CalendarDays size={20} />}>Historial de planes</Fila>
          <Fila href="/sorteos" icono={<Gift size={20} />}>Sorteos</Fila>
          <li>
            {/* Etiqueta fija: el estado lo dice el interruptor (on/off), no el texto.
                Antes ponía «Modo claro» estando apagado y no se sabía qué hacía. */}
            <button type="button" role="switch" aria-checked={tema === "oscuro"} aria-label="Modo oscuro" onClick={cambiarTema}
              className="flex min-h-[56px] w-full items-center gap-3 text-left text-[16px] font-medium text-tinta">
              <Moon size={20} className="text-tinta-suave" aria-hidden />
              <span className="flex-1">Modo oscuro</span>
              <span className={`relative h-7 w-12 rounded-full transition ${tema === "oscuro" ? "bg-magenta" : "bg-marfil-200"}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${tema === "oscuro" ? "left-6" : "left-1"}`} />
              </span>
            </button>
          </li>
          <Fila href="/perfil/notificaciones" icono={<Bell size={20} />}>Notificaciones</Fila>
          <li className="flex min-h-[56px] items-center gap-3 text-[16px] font-medium text-tinta">
            <LifeBuoy size={20} className="text-tinta-suave" aria-hidden />
            <ReportarProblema etiqueta="Necesito ayuda" className="min-h-[48px] flex-1 text-left" />
          </li>
          <Fila href="/perfil/ajustes" icono={<Settings size={20} />}>Ajustes de la cuenta</Fila>
          <li>
            <button type="button" onClick={salir} className="flex min-h-[56px] w-full items-center gap-3 text-left text-[16px] font-medium text-tinta">
              <LogOut size={20} className="text-tinta-suave" aria-hidden /> Cerrar sesión
            </button>
          </li>
        </ul>
      </div>
    </main>
  );
}

/** Fila del menú. El texto es también su nombre accesible (aria-label explícito:
 *  el lector no debe depender de cómo se pinte el icono o la flecha). */
function Fila({ href, icono, children }: { href: string; icono: ReactNode; children: string }) {
  return (
    <li>
      <Link href={href} aria-label={children} className="flex min-h-[56px] items-center gap-3 text-[16px] font-medium text-tinta">
        <span className="text-tinta-suave" aria-hidden>{icono}</span>
        <span className="flex-1">{children}</span>
        <ChevronRight size={18} className="text-tinta-suave" aria-hidden />
      </Link>
    </li>
  );
}
