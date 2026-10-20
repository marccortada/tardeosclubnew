"use client";

import { imagenParaSubir } from "@/app/local/_panel/reducirImagen";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { Camera, Instagram, Youtube, Music2, Phone } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Campo, { claseCampo } from "@/components/ui/Campo";
import Chip from "@/components/ui/Chip";
import Aviso from "@/components/admin/Aviso";
import Boton from "@/components/Boton";
import SelectorEstilos from "@/components/SelectorEstilos";
import CampoPlaylist from "@/components/CampoPlaylist";
import { updateMiDj, subirAvatarDj } from "@/lib/tardeos";
import { ZONAS } from "@/lib/zonas";
import { useDj, type FichaDj, type Redes } from "../contexto";

const MAX_FOTO_MB = 8;
const SIN_PERMISO = "No se guardó: ¿tienes permiso para editar esta ficha? Si es tuya, escríbenos desde Ayuda.";

type Formulario = {
  nombre: string;
  bio: string;
  estilos: string[];
  zonas: string[];
  playlist: string;
  instagram: string;
  soundcloud: string;
  youtube: string;
  whatsapp: string;
};

const desdeFicha = (dj: FichaDj): Formulario => {
  const r = dj.redes ?? {};
  return {
    nombre: dj.nombre_artistico ?? "",
    bio: dj.bio ?? "",
    estilos: Array.isArray(dj.estilos) ? dj.estilos : [],
    zonas: Array.isArray(dj.zonas) ? dj.zonas : [],
    playlist: dj.playlist_url ?? "",
    instagram: r.instagram ?? "",
    soundcloud: r.soundcloud ?? "",
    youtube: r.youtube ?? "",
    whatsapp: r.whatsapp ?? "",
  };
};

const REDES = [
  { k: "instagram", etiqueta: "Instagram", icono: Instagram, ph: "@tuusuario o enlace" },
  { k: "soundcloud", etiqueta: "SoundCloud", icono: Music2, ph: "https://soundcloud.com/…" },
  { k: "youtube", etiqueta: "YouTube", icono: Youtube, ph: "https://youtube.com/@…" },
] as const;

/**
 * Editar la ficha del DJ. Un solo formulario con "Guardar" fijo abajo, que
 * aparece en cuanto hay algo cambiado. La foto se guarda sola al elegirla: es
 * lo que la gente espera de un selector de foto y así no se pierde si luego
 * olvidan pulsar Guardar.
 */
export default function PerfilDj() {
  const { dj } = useDj();
  // Con `key`, si el admin abre otra ficha el formulario empieza de cero.
  return <FormularioPerfil key={dj.id} />;
}

function FormularioPerfil() {
  const { dj, actualizar, modoAdmin } = useDj();
  const [base, setBase] = useState<Formulario>(() => desdeFicha(dj));
  const [f, setF] = useState<Formulario>(base);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<{ nombre?: string; whatsapp?: string }>({});
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [foto, setFoto] = useState<{ estado: "" | "subiendo" | "ok" | "error"; msg?: string }>({ estado: "" });
  const archivo = useRef<HTMLInputElement>(null);

  const cambiado = useMemo(() => JSON.stringify(f) !== JSON.stringify(base), [f, base]);
  const poner = <K extends keyof Formulario>(k: K, v: Formulario[K]) => { setF((p) => ({ ...p, [k]: v })); setOk(""); };

  const subirFoto = async (elegido?: File) => {
    if (archivo.current) archivo.current.value = "";
    if (!elegido) return;
    let file: File;
    try { file = elegido.type.startsWith("image/") ? await imagenParaSubir(elegido) : elegido; }
    catch (e) { setFoto({ estado: "error", msg: (e as Error).message }); return; }
    if (!file.type.startsWith("image/")) { setFoto({ estado: "error", msg: "Eso no es una imagen. Elige una foto JPG o PNG." }); return; }
    if (file.size > MAX_FOTO_MB * 1024 * 1024) {
      setFoto({ estado: "error", msg: `La foto pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${MAX_FOTO_MB} MB.` });
      return;
    }
    setFoto({ estado: "subiendo" });
    const url = await subirAvatarDj(dj.id, file);
    if (!url) { setFoto({ estado: "error", msg: "No se pudo subir la foto. Revisa la conexión y vuelve a probar." }); return; }
    const { data: filas, error: e } = await updateMiDj(dj.id, { avatar_url: url });
    if (e) { setFoto({ estado: "error", msg: "La foto se subió pero no se pudo guardar en tu ficha. Vuelve a probar." }); return; }
    // Sin permiso la base no da error: devuelve 0 filas.
    if (!filas?.length) { setFoto({ estado: "error", msg: SIN_PERMISO }); return; }
    actualizar({ avatar_url: url });
    setFoto({ estado: "ok", msg: "Foto cambiada." });
  };

  const guardar = async () => {
    const errs: typeof errores = {};
    if (!f.nombre.trim()) errs.nombre = "Pon tu nombre artístico: es lo que ve la gente.";
    const tel = f.whatsapp.replace(/[^0-9]/g, "");
    if (f.whatsapp.trim() && (tel.length < 9 || tel.length > 15)) errs.whatsapp = "Escribe el número con prefijo, por ejemplo 34600111222.";
    setErrores(errs);
    if (Object.keys(errs).length) { setError("Revisa los campos marcados."); return; }

    // Se respetan las redes que no se editan aquí (las de la migración).
    const redes: Redes = { ...(dj.redes ?? {}) };
    for (const k of ["instagram", "soundcloud", "youtube"] as const) {
      const v = f[k].trim();
      if (v) redes[k] = v; else delete redes[k];
    }
    if (tel) redes.whatsapp = tel; else delete redes.whatsapp;

    const cambios: Partial<FichaDj> = {
      nombre_artistico: f.nombre.trim(),
      bio: f.bio.trim() || null,
      estilos: f.estilos,
      zonas: f.zonas.length ? f.zonas : null,
      playlist_url: f.playlist.trim() || null,
      redes,
    };
    setGuardando(true); setError(""); setOk("");
    const { data: filas, error: e } = await updateMiDj(dj.id, cambios);
    setGuardando(false);
    if (e) { setError("No se pudieron guardar los cambios. Inténtalo de nuevo en un momento."); return; }
    if (!filas?.length) { setError(SIN_PERMISO); return; }
    actualizar(cambios);
    const nueva = desdeFicha({ ...dj, ...cambios });
    setBase(nueva); setF(nueva);
    setOk("Cambios guardados. Ya se ven en tu ficha pública.");
  };

  const inicial = (String(f.nombre || "DJ").replace(/^DJ /i, "").match(/\p{L}|\p{N}/u)?.[0] ?? "D").toUpperCase();

  return (
    <SeccionPanel titulo="Mi perfil" descripcion="Lo que ve la gente y los locales en tu ficha pública." ancho="estrecho">
      {modoAdmin && <Aviso tono="aviso">Editando la ficha de {dj.nombre_artistico} como administración.</Aviso>}

      <div className="flex flex-col gap-4 pb-24">
        {/* Foto */}
        <Bloque titulo="Foto">
          <div className="flex items-center gap-4">
            {dj.avatar_url ? (
              <Image src={dj.avatar_url} alt="Tu foto actual" width={88} height={88} className="h-[88px] w-[88px] shrink-0 rounded-2xl object-cover ring-1 ring-linea" />
            ) : (
              <span className="grid h-[88px] w-[88px] shrink-0 place-items-center rounded-2xl bg-marfil-100 text-3xl font-bold text-tinta-suave" aria-hidden>{inicial}</span>
            )}
            <div className="min-w-0 flex-1">
              <input ref={archivo} type="file" accept="image/*" className="hidden" onChange={(e) => subirFoto(e.target.files?.[0])} />
              <Boton variante="contorno" tamano="pequeno" cargando={foto.estado === "subiendo"} onClick={() => archivo.current?.click()}>
                {foto.estado !== "subiendo" && <Camera size={18} aria-hidden />} {dj.avatar_url ? "Cambiar foto" : "Subir foto"}
              </Boton>
              <p className="mt-1.5 text-sm text-tinta-suave">Cuadrada y con tu cara o tu logo. Máximo {MAX_FOTO_MB} MB. Se guarda al momento.</p>
            </div>
          </div>
          {foto.estado === "error" && <p role="alert" className="mt-3 text-[15px] font-semibold text-error">{foto.msg}</p>}
          {foto.estado === "ok" && <p role="status" className="mt-3 text-[15px] font-semibold text-ok">{foto.msg}</p>}
        </Bloque>

        {/* Lo básico */}
        <Bloque titulo="Quién eres">
          <div className="flex flex-col gap-4">
            <Campo etiqueta="Nombre artístico" htmlFor="dj-nombre" error={errores.nombre}>
              <input id="dj-nombre" value={f.nombre} onChange={(e) => poner("nombre", e.target.value)} maxLength={80} className={claseCampo} />
            </Campo>
            <Campo etiqueta="Biografía" htmlFor="dj-bio" ayuda={`Dónde pinchas, tu rollo, desde cuándo. ${f.bio.length}/1500`}>
              <textarea id="dj-bio" value={f.bio} onChange={(e) => poner("bio", e.target.value)} rows={5} maxLength={1500}
                placeholder="Ej.: Llevo 15 años pinchando remember y house en tardeos de la Costa Brava…" className={claseCampo} />
            </Campo>
          </div>
        </Bloque>

        <Bloque titulo="Estilos de música" ayuda="Abre una familia y toca los que pinchas. Puedes elegir de varias.">
          <SelectorEstilos valor={f.estilos} onChange={(v) => poner("estilos", v)} />
        </Bloque>

        <Bloque titulo="Zonas donde pinchas" ayuda="Así te encuentran los locales de tu zona.">
          <div className="flex flex-wrap gap-2">
            {ZONAS.map((z) => (
              <Chip key={z} activo={f.zonas.includes(z)}
                onClick={() => poner("zonas", f.zonas.includes(z) ? f.zonas.filter((x) => x !== z) : [...f.zonas, z])}>
                {z}
              </Chip>
            ))}
          </div>
        </Bloque>

        <Bloque titulo="Tu música">
          <CampoPlaylist valor={f.playlist} onCambio={(v) => poner("playlist", v)} />
        </Bloque>

        <Bloque titulo="Redes y contacto">
          <div className="flex flex-col gap-4">
            {REDES.map(({ k, etiqueta, icono: Icono, ph }) => (
              <Campo key={k} etiqueta={etiqueta} htmlFor={`dj-${k}`}>
                <div className="relative">
                  <Icono size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden />
                  <input id={`dj-${k}`} value={f[k]} onChange={(e) => poner(k, e.target.value)} placeholder={ph} className={`${claseCampo} pl-10`} />
                </div>
              </Campo>
            ))}
            <Campo etiqueta="WhatsApp para contrataciones" htmlFor="dj-whatsapp" error={errores.whatsapp}>
              <div className="relative">
                <Phone size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-suave" aria-hidden />
                <input id="dj-whatsapp" inputMode="tel" value={f.whatsapp} onChange={(e) => poner("whatsapp", e.target.value)}
                  placeholder="34600111222" className={`${claseCampo} pl-10`} />
              </div>
            </Campo>
            {/* El número sale en un botón "Contratar por WhatsApp" de la ficha
                pública: mejor que lo sepa antes de ponerlo. */}
            <p className="rounded-xl bg-aviso-fondo p-3 text-[15px] text-aviso">
              <b>Ojo:</b> tu WhatsApp será <b>público</b>. Aparece en tu ficha con un botón «Contratar por WhatsApp». Ponlo solo si quieres que te escriban.
            </p>
          </div>
        </Bloque>

        {error && <Aviso tono="error">{error}</Aviso>}
        {ok && !cambiado && <Aviso tono="ok">{ok}</Aviso>}
      </div>

      {/* Barra de guardar, fija abajo mientras haya cambios sin guardar. En
          el móvil va encima de la barra de pestañas (que está por delante):
          con bottom-0 quedaba tapada y no se podía guardar. */}
      {cambiado && (
        <div className="fixed inset-x-0 bottom-[calc(var(--alto-barra-inferior,4rem)+var(--alto-mini,0px))] z-[700] border-t border-linea bg-white/95 px-4 py-3 backdrop-blur md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:left-[264px]">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <p className="hidden flex-1 text-[15px] text-tinta-suave sm:block">Tienes cambios sin guardar.</p>
            <Boton variante="contorno" onClick={() => { setF(base); setErrores({}); setError(""); }} disabled={guardando}>Descartar</Boton>
            <Boton onClick={guardar} cargando={guardando} className="flex-1 sm:flex-none">
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Boton>
          </div>
        </div>
      )}
    </SeccionPanel>
  );
}

function Bloque({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-5">
      <h2 className="text-lg font-bold">{titulo}</h2>
      {ayuda && <p className="mt-0.5 text-[15px] text-tinta-suave">{ayuda}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
