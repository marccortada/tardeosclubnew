"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Heart, MessageCircle, Bookmark, FileDown, BadgeCheck, Instagram } from "lucide-react";
import CompartirBtn from "@/components/CompartirBtn";
import TardeoCard from "@/components/TardeoCard";
import { AvatarDj } from "@/components/DjCard";
import { BotonPlay, BotonSeguir, HojaComentarios } from "@/components/musica/piezas";
import { useAuth } from "@/lib/useAuth";
import { useRoles } from "@/lib/permisos";
import { supabase } from "@/lib/supabase";
import { entrarYVolver } from "@/lib/volver";
import {
  sigoA, misMarcas, gustarSet, guardarSet, getPresskit, portadaDe, MENSAJE_FALTA_LOTE, type SetDj,
} from "@/lib/sets";
import type { Tardeo } from "@/lib/types";

type Dj = {
  id: string; nombre: string; bio: string | null; avatar: string | null; banner: string | null;
  ciudad: string | null; estilos: string[]; seguidores: number; verificado: boolean;
  sinDueno: boolean; playlist: string | null; instagram: string | null;
};
type Pestana = "sets" | "eventos" | "sobre";

export default function PerfilDj({
  dj, sets: setsIniciales, faltaLote, tardeos, volver, pestanaInicial, sobreExtra,
}: {
  dj: Dj; sets: SetDj[]; faltaLote: boolean; tardeos: Tardeo[]; volver: string | null;
  pestanaInicial: Pestana; sobreExtra?: ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const { esProfesional } = useRoles();
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial);
  const [sigo, setSigo] = useState(false);
  const [seguidores, setSeguidores] = useState(dj.seguidores);
  const [sets, setSets] = useState(setsIniciales);
  const [likes, setLikes] = useState<Set<string>>(new Set());
  const [guardados, setGuardados] = useState<Set<string>>(new Set());
  const [soyDj, setSoyDj] = useState(false);
  const [presskit, setPresskit] = useState<string | null>(null);
  const [comentando, setComentando] = useState<SetDj | null>(null);

  const destacado = sets.find((s) => s.destacado) ?? sets[0] ?? null;

  useEffect(() => {
    if (!user) return;
    let vivo = true;
    void sigoA(dj.id, user.id).then((v) => vivo && setSigo(v));
    void misMarcas(user.id, setsIniciales.map((s) => s.id)).then((m) => { if (vivo) { setLikes(m.likes); setGuardados(m.guardados); } });
    void supabase.from("djs").select("id").eq("id", dj.id).eq("profile_id", user.id).maybeSingle()
      .then(({ data }) => vivo && setSoyDj(!!data));
    return () => { vivo = false; };
  }, [user, dj.id, setsIniciales]);

  // Press kit: SOLO profesionales (dossier pág. 7). La base tampoco se lo da a
  // nadie más (presskit_de, lote 65): ocultar el botón no es la protección.
  useEffect(() => {
    if (!esProfesional) return;
    void getPresskit(dj.id).then(setPresskit);
  }, [esProfesional, dj.id]);

  async function marcar(s: SetDj, tipo: "like" | "guardar") {
    if (!user) { router.push(entrarYVolver(`/djs/${dj.id}`)); return; }
    const conj = tipo === "like" ? likes : guardados;
    const activar = !conj.has(s.id);
    const nuevo = new Set(conj); if (activar) nuevo.add(s.id); else nuevo.delete(s.id);
    (tipo === "like" ? setLikes : setGuardados)(nuevo);
    const campo = tipo === "like" ? "likes" : "guardados";
    setSets((xs) => xs.map((x) => (x.id === s.id ? { ...x, [campo]: Math.max(0, x[campo] + (activar ? 1 : -1)) } : x)));
    const e = await (tipo === "like" ? gustarSet : guardarSet)(s.id, user.id, activar);
    if (e) { (tipo === "like" ? setLikes : setGuardados)(conj); alert(e); }
  }

  const subtitulo = [dj.ciudad, dj.estilos.slice(0, 3).join(" / ")].filter(Boolean).join(" · ");
  const nombrePdf = `PressKit-${dj.nombre.replace(/[^\p{L}\p{N}]+/gu, "-")}.pdf`;

  return (
    <main className="mx-auto max-w-3xl bg-fondo pb-8">
      {/* Cabecera: volver (al evento si se vino de una ficha) · nombre · compartir */}
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-linea bg-superficie/95 px-2 py-1 backdrop-blur">
        <Link href={volver ?? "/djs"} aria-label={volver ? "Volver al evento" : "Volver a DJs"}
          className="grid h-12 w-12 place-items-center rounded-full hover:bg-fondo">
          <ArrowLeft size={22} aria-hidden />
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-[18px] font-bold">{dj.nombre}</p>
        <CompartirBtn titulo={dj.nombre} texto={`Escucha a ${dj.nombre} en TardeosClub`} url={`/djs/${dj.id}`}
          className="grid h-12 w-12 place-items-center rounded-full hover:bg-fondo" />
      </div>

      <div className="relative h-36 w-full overflow-hidden bg-tinta md:h-52">
        {dj.banner || dj.avatar ? (
          <Image src={(dj.banner || dj.avatar)!} alt="" fill priority sizes="768px" unoptimized
            className={`object-cover ${dj.banner ? "" : "scale-110 blur-md opacity-80"}`} />
        ) : <div className="h-full w-full bg-[linear-gradient(135deg,#141014,#930E72)]" />}
      </div>

      <section className="bg-superficie px-4 pb-4">
        <div className="flex items-end gap-4">
          <div className="relative -mt-10 h-24 w-24 shrink-0 overflow-hidden rounded-full ring-4 ring-superficie">
            <AvatarDj nombre={dj.nombre} url={dj.avatar} sizes="96px" textoClase="text-3xl" />
          </div>
          <div className="min-w-0 flex-1 pt-3 text-right">
            <h1 className="flex items-center justify-end gap-1.5 break-words text-[28px] font-bold leading-tight">
              {dj.nombre}{dj.verificado && <BadgeCheck size={22} className="shrink-0 text-magenta" aria-label="Verificado" />}
            </h1>
            {subtitulo && <p className="text-[15px] text-tinta-suave">{subtitulo}</p>}
          </div>
        </div>
        <p className="mt-2 text-[14px] text-tinta-suave">{seguidores} {seguidores === 1 ? "seguidor" : "seguidores"}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <BotonSeguir djId={dj.id} inicial={sigo} className="w-full !rounded-xl"
            onCambio={(v) => { setSigo(v); setSeguidores((n) => Math.max(0, n + (v ? 1 : -1))); }} />
          <Link href={`/djs/${dj.id}/mensaje`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-linea-fuerte bg-superficie text-[15px] font-bold">
            Mensaje
          </Link>
        </div>

        {destacado && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-linea bg-superficie p-3 shadow-tarjeta">
            <Portada src={portadaDe(destacado)} className="h-14 w-14 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-bold">{destacado.titulo}</p>
              <p className="truncate text-[14px] text-tinta-suave">{[dj.nombre, destacado.estilos?.[0] ?? dj.estilos[0]].filter(Boolean).join(" · ")}</p>
            </div>
            <BotonPlay set={destacado} autor={dj.nombre} className="border-2 border-magenta text-magenta" />
          </div>
        )}
      </section>

      <div role="tablist" aria-label="Secciones del DJ" className="sticky top-[57px] z-20 mx-4 mt-3 grid grid-cols-3 gap-1 rounded-xl bg-marfil-100 p-1">
        {([["sets", "Sets"], ["eventos", "Eventos"], ["sobre", "Sobre mí"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={pestana === k} type="button" onClick={() => setPestana(k)}
            className={`min-h-[44px] rounded-lg text-[15px] font-bold ${pestana === k ? "bg-magenta text-white" : "text-tinta"}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {pestana === "sets" && (
          faltaLote ? <Vacio texto={MENSAJE_FALTA_LOTE} />
          : sets.length === 0 ? <Vacio texto="Aún no ha publicado sets." />
          : (
            <ul className="grid grid-cols-2 gap-3">
              {sets.map((s) => (
                <li key={s.id} className="overflow-hidden rounded-2xl border border-linea bg-superficie shadow-tarjeta">
                  <div className="relative aspect-square">
                    <Portada src={portadaDe(s)} className="h-full w-full" />
                    <div className="absolute inset-0 grid place-items-center">
                      <BotonPlay set={s} autor={dj.nombre} className="bg-black/45 text-white backdrop-blur" />
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-[15px] font-bold leading-tight">{s.titulo}</p>
                    <div className="mt-1 flex items-center justify-between text-tinta-suave">
                      <button type="button" onClick={() => void marcar(s, "like")} aria-pressed={likes.has(s.id)} aria-label="Me gusta"
                        className="inline-flex min-h-[40px] items-center gap-1 text-[14px]">
                        <Heart size={18} className={likes.has(s.id) ? "fill-magenta text-magenta" : ""} aria-hidden /> {s.likes}
                      </button>
                      <button type="button" onClick={() => setComentando(s)} aria-label="Comentarios"
                        className="inline-flex min-h-[40px] items-center gap-1 text-[14px]">
                        <MessageCircle size={18} aria-hidden /> {s.comentarios}
                      </button>
                      <button type="button" onClick={() => void marcar(s, "guardar")} aria-pressed={guardados.has(s.id)} aria-label="Guardar set"
                        className="grid min-h-[40px] min-w-[40px] place-items-center">
                        <Bookmark size={18} className={guardados.has(s.id) ? "fill-magenta text-magenta" : ""} aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {pestana === "eventos" && (
          tardeos.length === 0 ? <Vacio texto="Sin fechas próximas. Síguele y te avisaremos." />
          : <div className="flex flex-col gap-3">{tardeos.map((t) => <TardeoCard key={t.id} tardeo={t} />)}</div>
        )}

        {pestana === "sobre" && (
          <div className="flex flex-col gap-6">
            {dj.bio ? <p className="whitespace-pre-line text-[16px] leading-relaxed">{dj.bio}</p>
              : <p className="text-[15px] text-tinta-suave">Este DJ aún no ha escrito su presentación.</p>}
            {dj.instagram && (
              <a href={dj.instagram.startsWith("http") ? dj.instagram : `https://instagram.com/${dj.instagram.replace(/^@/, "")}`}
                target="_blank" rel="noopener noreferrer" className="inline-flex min-h-tacto items-center gap-2 font-bold">
                <Instagram size={20} className="text-magenta" aria-hidden /> Instagram
              </a>
            )}
            {esProfesional && presskit && (
              <a href={`${presskit}${presskit.includes("?") ? "&" : "?"}download=${encodeURIComponent(nombrePdf)}`} rel="noopener noreferrer"
                className="flex min-h-tacto items-center gap-3 border-b border-linea py-2 text-[16px] font-bold">
                <FileDown size={20} className="text-magenta" aria-hidden />
                <span className="flex-1">Descargar press kit</span>
                <span className="text-[13px] font-normal text-tinta-suave">PDF</span>
              </a>
            )}
            {sobreExtra}
          </div>
        )}
      </div>

      <HojaComentarios
        setId={comentando?.id ?? null} titulo={comentando?.titulo ?? ""} abierta={!!comentando}
        onCerrar={() => setComentando(null)} soyDj={soyDj} nombreDj={dj.nombre}
        onTotal={(n) => comentando && setSets((xs) => xs.map((x) => (x.id === comentando.id ? { ...x, comentarios: n } : x)))}
      />
    </main>
  );
}

function Portada({ src, className = "" }: { src: string | null; className?: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden bg-[linear-gradient(135deg,#2B0A26,#D61AA8)] ${className}`}>
      {src && <Image src={src} alt="" fill sizes="(max-width: 768px) 50vw, 300px" className="object-cover" unoptimized />}
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="rounded-2xl border border-dashed border-linea-fuerte bg-superficie p-6 text-center text-[15px] text-tinta-suave">{texto}</p>;
}
