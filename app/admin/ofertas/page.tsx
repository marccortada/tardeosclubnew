"use client";

import { useCallback, useEffect, useState } from "react";
import PanelHeader from "@/components/PanelHeader";
import { supabase } from "@/lib/supabase";
import { Mail, Send, Loader2, Tag, Check, Users, Search, AlertTriangle } from "lucide-react";
import { plegar, contieneTexto } from "@/lib/texto";

type Promo = { id: string; nombre: string; tipo: string; precio: number | null };
type Local = { id: string; nombre: string; registrado: boolean };
type Cuentas = { locales: number; registrados: number; conPermiso: number; sinPermiso: number };

export default function AdminOfertas() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");
  const [resultado, setResultado] = useState("");
  const [locales, setLocales] = useState<Local[]>([]);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [cuentas, setCuentas] = useState<Cuentas | null>(null);

  useEffect(() => {
    supabase.from("locales").select("id,nombre,owner_id").eq("estado", "activo").order("nombre")
      .then(({ data }) => setLocales((data ?? []).map((l) => ({
        id: l.id, nombre: l.nombre, registrado: Boolean(l.owner_id),
      }))));
  }, []);

  /**
   * A cuántos va a llegar de verdad, antes de darle.
   *
   * Se pregunta al servidor y no se calcula aquí porque el permiso vive en
   * `profiles`, y quién ha aceptado qué no es asunto del navegador de nadie:
   * lo cuenta quien puede leerlo y devuelve un número.
   */
  const contar = useCallback(async (ids: string[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/enviar-oferta", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soloContar: true, localIds: ids, accessToken: session?.access_token }),
    });
    setCuentas(res.ok ? await res.json() : null);
  }, []);
  useEffect(() => { contar([...elegidos]); }, [contar, elegidos]);

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
    setResultado(j.aviso ? j.aviso : `Enviado a ${j.enviados}.`);
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

          {/* A quién. Sin marcar nada va a todos los que hayan aceptado. */}
          <div className="mt-4 border-t border-black/5 pt-4">
            <p className="mb-1 text-sm font-black text-tinta/70">¿A quién?</p>
            <p className="mb-2 text-xs font-semibold text-tinta/50">
              Sin marcar ninguno, va a todos los que hayan aceptado recibir ofertas.
            </p>
            <label className="mb-2 flex items-center gap-2 rounded-xl bg-black/[0.03] px-3 py-2">
              <Search size={15} className="shrink-0 text-tinta/40" />
              <input
                value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder={`Buscar entre ${locales.length} locales…`}
                className="w-full bg-transparent text-sm font-semibold outline-none"
              />
            </label>
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {locales
                .filter((l) => contieneTexto(l.nombre, plegar(busca.trim())))
                .slice(0, 60)
                .map((l) => (
                  <label key={l.id} className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm font-semibold hover:bg-black/[0.03]">
                    <input
                      type="checkbox" checked={elegidos.has(l.id)}
                      onChange={() => setElegidos((p) => {
                        const n = new Set(p);
                        n.has(l.id) ? n.delete(l.id) : n.add(l.id);
                        return n;
                      })}
                      className="h-4 w-4 shrink-0 accent-magenta"
                    />
                    <span className="min-w-0 flex-1 truncate">{l.nombre}</span>
                    {/* Se marca quién NO puede recibirlo, para no elegirlo a ciegas. */}
                    {!l.registrado && (
                      <span className="shrink-0 text-xs font-black text-tinta/30">sin cuenta</span>
                    )}
                  </label>
                ))}
            </div>
            {elegidos.size > 0 && (
              <button onClick={() => setElegidos(new Set())} className="mt-2 text-xs font-black text-magenta">
                Quitar la selección ({elegidos.size})
              </button>
            )}
          </div>

          {/*
            Lo que va a pasar de verdad, con los que se quedan fuera y por qué.
            Un "enviado a 4" sin decir que 55 no lo reciben es un número que
            engaña al que lo lee.
          */}
          {cuentas && (
            <div className={`mt-4 rounded-xl p-3 text-sm font-bold ${
              cuentas.conPermiso === 0 ? "bg-amber-50 text-amber-900" : "bg-magenta-50 text-magenta-700"}`}>
              <p className="flex items-center gap-1.5 font-black">
                <Users size={15} className="shrink-0" />
                {cuentas.conPermiso === 0
                  ? "Ahora mismo no lo recibiría nadie"
                  : `Lo recibirán ${cuentas.conPermiso}`}
              </p>
              <p className="mt-1 text-xs font-semibold opacity-80">
                De {cuentas.locales} locales: {cuentas.registrados} tienen cuenta
                {cuentas.sinPermiso > 0 && `, y ${cuentas.sinPermiso} de esos no han aceptado recibir ofertas`}
                {cuentas.locales - cuentas.registrados > 0 &&
                  `. Los ${cuentas.locales - cuentas.registrados} sin cuenta no reciben nada`}.
              </p>
            </div>
          )}

          {estado === "error" && <p className="mt-2 text-sm font-bold text-magenta">{resultado}</p>}
          {estado === "ok" && (
            <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-oro/15 p-3 text-sm font-bold text-oro-600">
              <Check size={16} /> {resultado}
            </p>
          )}

          <button onClick={enviar} disabled={estado === "enviando" || !titulo.trim() || cuentas?.conPermiso === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-magenta py-4 text-lg font-extrabold text-white transition active:scale-[0.98] disabled:opacity-40">
            {estado === "enviando" ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />} {cuentas ? `Enviar a ${cuentas.conPermiso}` : "Enviar por email"}
          </button>
        </div>

        <p className="mt-4 text-center text-xs font-semibold text-tinta/50">
          Solo lo reciben quienes tienen cuenta <strong>y han aceptado</strong> recibir ofertas, en su
          perfil o al registrarse. Los locales que solo tienen email en su ficha no reciben nada:
          ese correo vino de la app antigua y no trae ningún permiso detrás.
          En pruebas, Resend solo entrega a tu propio email hasta verificar el dominio.
        </p>
      </div>
    </main>
  );
}
