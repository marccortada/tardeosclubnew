"use client";

import { useEffect, useState } from "react";
import PanelHeader from "@/components/PanelHeader";
import { supabase } from "@/lib/supabase";
import { Mail, Send, Loader2, Tag, Check } from "lucide-react";

type Promo = { id: string; nombre: string; tipo: string; precio: number | null };

export default function AdminOfertas() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");
  const [resultado, setResultado] = useState("");

  useEffect(() => {
    supabase.from("promociones_catalogo").select("id,nombre,tipo,precio").eq("activo", true).order("created_at")
      .then(({ data }) => setPromos((data as Promo[]) ?? []));
  }, []);

  const usarPromo = (p: Promo) => {
    setTitulo(`Oferta en ${p.nombre}`);
    setMensaje(
      `¡Aprovecha! ${p.nombre}${p.precio != null ? ` (normalmente ${p.precio} €)` : ""} con condiciones especiales esta semana. ` +
      `Entra en tu panel de TardeosClub y promociona tus tardeos.`
    );
  };

  const enviar = async () => {
    if (!titulo.trim()) return;
    setEstado("enviando"); setResultado("");
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/enviar-oferta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, mensaje, accessToken: session?.access_token }),
    });
    const j = await res.json();
    if (!res.ok) { setEstado("error"); setResultado(j.error || "No se pudo enviar."); return; }
    setEstado("ok");
    setResultado(j.aviso ? j.aviso : `Enviado a ${j.enviados} de ${j.total} locales.`);
  };

  return (
    <main className="pb-10">
      <PanelHeader titulo="Ofertas a locales" volverHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8">
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-oro/10 p-3 text-sm font-bold text-tinta/80">
          <Mail size={18} className="shrink-0 text-oro-600" />
          Crea una oferta sobre tus promociones y avisa por email a todos los locales registrados.
        </div>

        {/* Promos como base */}
        {promos.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-sm font-black text-tinta/60">Basar en una promoción</p>
            <div className="flex flex-wrap gap-2">
              {promos.map((p) => (
                <button key={p.id} onClick={() => usarPromo(p)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-extrabold text-tinta ring-1 ring-magenta-100 hover:ring-magenta">
                  <Tag size={14} className="text-magenta" /> {p.nombre}{p.precio != null ? ` · ${p.precio}€` : ""}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Formulario */}
        <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
          <label className="mb-1 block text-sm font-black text-tinta/70">Título de la oferta</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Destacado a mitad de precio esta semana"
            className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />
          <label className="mb-1 mt-3 block text-sm font-black text-tinta/70">Mensaje</label>
          <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={4} placeholder="Cuéntales la oferta…"
            className="w-full rounded-xl border-2 border-magenta-100 px-4 py-3 font-semibold outline-none focus:border-magenta" />

          {estado === "error" && <p className="mt-2 text-sm font-bold text-magenta">{resultado}</p>}
          {estado === "ok" && (
            <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-oro/15 p-3 text-sm font-bold text-oro-600">
              <Check size={16} /> {resultado}
            </p>
          )}

          <button onClick={enviar} disabled={estado === "enviando" || !titulo.trim()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white transition active:scale-[0.98] disabled:opacity-40">
            {estado === "enviando" ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />} Enviar a los locales por email
          </button>
        </div>

        <p className="mt-4 text-center text-xs font-semibold text-tinta/50">
          Solo lo reciben los locales registrados. En pruebas, Resend solo entrega a tu propio email hasta verificar el dominio.
        </p>
      </div>
    </main>
  );
}
