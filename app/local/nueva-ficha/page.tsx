"use client";

import { useState } from "react";
import { Store, Megaphone, Check } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Boton from "@/components/Boton";
import Campo, { claseCampo } from "@/components/ui/Campo";
import AddressSearch, { type Direccion } from "@/components/AddressSearch";
import { supabase } from "@/lib/supabase";
import { useFicha } from "../_panel/PanelLocal";

type Tipo = "local" | "promotor";

/**
 * Añadir otra ficha a la misma cuenta: un segundo local, o la marca con la
 * que se organizan eventos fuera.
 *
 * Mismas columnas que el alta de /unirse (estado «borrador» hasta que la
 * revisemos). Está aquí porque /unirse, con buen criterio, a quien ya tiene
 * ficha le manda a su panel para que no se dupliquen por error; desde el
 * panel, en cambio, crear la segunda es una decisión consciente.
 */
export default function NuevaFicha() {
  const { user, fichas } = useFicha();
  const tienePromotor = fichas.some((f) => f.tipo === "promotor");
  const [tipo, setTipo] = useState<Tipo>(tienePromotor ? "local" : "promotor");
  const [nombre, setNombre] = useState("");
  const [tel, setTel] = useState("");
  const [dir, setDir] = useState<Direccion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const crear = async () => {
    setError("");
    if (!nombre.trim()) { setError(tipo === "local" ? "Escribe el nombre del local." : "Escribe el nombre con el que organizas."); return; }
    if (tipo === "local" && !dir) { setError("Busca la dirección del local y elígela de la lista."); return; }
    // Mismo nombre que una ficha propia: casi seguro es un duplicado por error.
    if (fichas.some((f) => f.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())) {
      setError("Ya tienes una ficha con ese nombre. Elígela en el selector de arriba.");
      return;
    }
    setGuardando(true);
    const base: Record<string, unknown> = { owner_id: user.id, nombre: nombre.trim(), telefono: tel.trim(), estado: "borrador", tipo };
    const { data, error: e } = await supabase.from("locales").insert(
      tipo === "local" && dir
        ? { ...base, direccion: dir.display, lat: dir.lat, lng: dir.lng, codigo_postal: dir.cp, zona: dir.zona }
        : base,
    ).select("id").single();
    if (e || !data) { setGuardando(false); setError("No se pudo crear: " + (e?.message ?? "sin respuesta")); return; }
    // Recarga completa: el panel lee las fichas una sola vez al entrar.
    window.location.href = `/local?id=${data.id}`;
  };

  return (
    <SeccionPanel titulo="Añadir otra ficha" ancho="estrecho"
      descripcion="Para un segundo local o para la marca con la que organizas eventos en otros sitios. Se gestiona desde este mismo panel.">
      <div className="flex flex-col gap-5 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-6">
        <fieldset>
          <legend className="mb-2 text-[15px] font-semibold">¿Qué quieres añadir?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["local", Store, "Un local", "Bar, terraza o discoteca con dirección fija."],
              ["promotor", Megaphone, "Eventos", "Organizas en sitios distintos: la dirección va en cada tardeo."],
            ] as const).map(([k, Icono, t, d]) => (
              <button key={k} type="button" onClick={() => setTipo(k)} aria-pressed={tipo === k}
                className={`flex min-h-[72px] items-start gap-3 rounded-xl border p-3 text-left transition ${
                  tipo === k ? "border-magenta bg-magenta-50" : "border-linea-fuerte hover:bg-marfil-100"}`}>
                <Icono size={22} className="mt-0.5 shrink-0 text-magenta" aria-hidden />
                <span>
                  <span className="flex items-center gap-1.5 text-[16px] font-bold">{t}{tipo === k && <Check size={16} aria-hidden />}</span>
                  <span className="text-sm text-tinta-suave">{d}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <Campo etiqueta={tipo === "local" ? "Nombre del local" : "Nombre de tus eventos"} htmlFor="nombre">
          <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className={claseCampo}
            placeholder={tipo === "local" ? "Ej. Terraza Mar Bella" : "Ej. Tardeos Remember"} />
        </Campo>
        <Campo etiqueta="Teléfono de contacto (opcional)" htmlFor="tel" ayuda="Solo para que podamos hablar contigo al revisarla.">
          <input id="tel" type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} className={claseCampo} />
        </Campo>
        {tipo === "local" && (
          <div>
            <p className="mb-1.5 text-[15px] font-semibold">Dirección</p>
            <AddressSearch onSelect={setDir} />
            {dir && <p className="mt-2 rounded-xl bg-marfil-100 px-4 py-3 text-[15px]">{dir.display}</p>}
          </div>
        )}

        <p className="rounded-xl bg-marfil-100 p-3 text-[15px] text-tinta">
          La ficha nueva no sale en la web hasta que la revisemos. Mientras, ya puedes preparar sus tardeos.
        </p>
        {error && <p role="alert" className="rounded-xl border border-error/20 bg-error-fondo p-3 text-[15px] font-semibold text-error">{error}</p>}
        <Boton ancho onClick={crear} cargando={guardando}>
          {!guardando && <Check size={20} aria-hidden />} Crear ficha
        </Boton>
      </div>
    </SeccionPanel>
  );
}
