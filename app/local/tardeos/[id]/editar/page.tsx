"use client";
import Image from "next/image";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PanelHeader from "@/components/PanelHeader";
import { useAuth } from "@/lib/useAuth";
import { getTardeoById, updateTardeo, setDjsDeTardeo, borrarTardeo, setEstadoTardeo } from "@/lib/tardeos";
import SelectorAdn from "@/components/SelectorAdn";
import ProgramarPublicacion, { paraInput, type Cuando } from "@/components/ProgramarPublicacion";
import PromoTardeo, { PROMO_VACIA, type Promo } from "@/components/PromoTardeo";
import { flyerSrc } from "@/lib/formato";
import { Tardeo } from "@/lib/types";
import { Music, Calendar, Clock, Disc3, MapPin, Ticket, Check, Loader2, Trash2, EyeOff, Eye } from "lucide-react";
import PromocionesDeTardeo from "@/components/PromocionesDeTardeo";

export default function EditarTardeo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();

  const [tardeo, setTardeo] = useState<Tardeo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  // Nombres escritos en el campo DJ que no tienen ficha. Si los hay no se
  // vuelve al panel: el aviso se perdería en el salto y el tardeo se quedaría
  // sin salir en el perfil de ese DJ sin que nadie lo supiera.
  const [djsSinFicha, setDjsSinFicha] = useState<string[]>([]);

  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [estilo, setEstilo] = useState("");
  const [cuando, setCuando] = useState<Cuando>({ estado: "publicado", publicarEn: "" });
  const [promo, setPromo] = useState<Promo>(PROMO_VACIA);
  const [tipoEvento, setTipoEvento] = useState("");
  const [ambiente, setAmbiente] = useState<string[]>([]);
  const [publico, setPublico] = useState<string[]>([]);
  const [dressCode, setDressCode] = useState("");
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
        // Un finalizado o cancelado no se toca desde aquí: el selector solo
        // maneja los tres estados que decide el local.
        setCuando({
          estado: t.estado === "programado" ? "programado" : t.estado === "borrador" ? "borrador" : "publicado",
          publicarEn: t.publicarEn ? paraInput(new Date(t.publicarEn)) : "",
        });
        setPromo({ etiquetas: t.etiquetas ?? [] });
        setTipoEvento(t.tipoEvento ?? "");
        setAmbiente(t.ambiente ?? []);
        setPublico(t.publico ?? []);
        setDressCode(t.dressCode ?? "");
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
    const { data, error: e } = await updateTardeo(id, {
      titulo: titulo.trim(),
      fecha,
      hora_inicio: horaInicio,
      hora_fin: horaFin || null,
      estilo,
      estado: cuando.estado,
      publicar_en: cuando.estado === "programado" && cuando.publicarEn
        ? new Date(cuando.publicarEn).toISOString()
        : null,
      // null y no [] cuando está vacío: así "sin indicar" no se confunde con
      // "lo revisó y lo dejó a cero".
      etiquetas: promo.etiquetas.length ? promo.etiquetas : null,
      tipo_evento: tipoEvento || null,
      ambiente: ambiente.length ? ambiente : null,
      publico: publico.length ? publico : null,
      dress_code: dressCode || null,
      direccion,
      es_de_pago: tipo === "pago",
      tiene_lista: tipo === "lista",
      precio: tipo === "pago" ? Number(precio) || null : null,
    });
    if (e) { setGuardando(false); setError(e.message); return; }
    if (!data || data.length === 0) { setGuardando(false); setError("No se guardó: este tardeo no es de tu local (permisos)."); return; }
    let sinFicha: string[] = [];
    try { ({ sinFicha } = await setDjsDeTardeo(id, dj.split(/[,·&]|\sy\s/i))); } catch { /* no crítico: los cambios ya están guardados */ }
    setGuardando(false);
    setDjsSinFicha(sinFicha);
    if (sinFicha.length === 0) router.push("/local");
  };

  const cambiarEstado = async (nuevo: string) => {
    setError("");
    const { data, error: e } = await setEstadoTardeo(id, nuevo);
    if (e) { setError("No se pudo cambiar el estado: " + e.message); return; }
    if (!data || data.length === 0) { setError("No se pudo: este tardeo no es de tu local (permisos)."); return; }
    router.push("/local");
  };

  const eliminar = async () => {
    if (!confirm("¿Seguro que quieres borrar este tardeo? No se puede deshacer.")) return;
    setError("");
    const { error: e, count } = await borrarTardeo(id);
    if (e) { setError("No se pudo borrar: " + e.message); return; }
    // Si RLS no deja borrar, no da error pero tampoco borra nada
    if (count === 0) { setError("No se borró: parece que este tardeo no es de tu local (permisos)."); return; }
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
          <Image src={flyerSrc(tardeo)} alt="" width={52} height={64} className="h-16 w-[52px] shrink-0 rounded-xl object-cover" />
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

          <PromoTardeo valor={promo} onCambio={setPromo} />

          {/* Las promociones se guardan solas, aparte del resto del formulario:
              van en su propia tabla y cada una es una fila. Meterlas en el
              "Guardar cambios" de abajo obligaría a guardar el tardeo entero
              para añadir una oferta. */}
          <PromocionesDeTardeo tardeoId={id} />

          <ProgramarPublicacion valor={cuando} onCambio={setCuando} />

          {/* Ambiente, público y outfit. Es también la vía para rellenar los
              662 migrados, que llegaron sin ninguno de los tres. */}
          <SelectorAdn
            tipoEvento={tipoEvento} ambiente={ambiente} publico={publico} dressCode={dressCode}
            onTipoEvento={setTipoEvento} onAmbiente={setAmbiente}
            onPublico={setPublico} onDressCode={setDressCode}
          />

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

          {djsSinFicha.length > 0 && (
            <div className="rounded-2xl bg-oro/15 p-4 ring-1 ring-oro/40">
              <p className="font-black">Guardado, pero ojo:</p>
              <p className="mt-1 text-sm font-semibold text-tinta/75">
                {djsSinFicha.length === 1 ? "No hay ficha de " : "No hay ficha de "}
                <b>{djsSinFicha.join(", ")}</b>, así que este tardeo no saldrá en su perfil.
              </p>
              <Link href="/local" className="mt-2 inline-block text-sm font-black text-magenta">
                Volver al panel
              </Link>
            </div>
          )}

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
