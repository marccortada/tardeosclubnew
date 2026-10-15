"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import CabeceraApp from "@/components/CabeceraApp";
import { useAuth } from "@/lib/useAuth";
import { getAdn, guardarAdn, getZonas, ADN_VACIO, type AdnTardicola, type Zona } from "@/lib/tardicola";
import { FAMILIAS } from "@/lib/musica";
import { TIPOS_EVENTO } from "@/lib/adn";

const PRECIOS = [{ k: "gratis", l: "Gratis" }, { k: "hasta20", l: "Hasta 20 €" }, { k: "", l: "Cualquier precio" }];

/**
 * Mi ADN (dossier pág. 4 y 9): música, planes, zona y precio de entrada.
 * Es la base de los filtros de Eventos; cambiar un filtro allí NO lo toca.
 * Privado: nadie más lo ve (RLS de profiles).
 */
export default function MiAdn() {
  const { user, loading } = useAuth();
  const [adn, setAdn] = useState<AdnTardicola | null>(null);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [estado, setEstado] = useState<"" | "guardando" | "ok" | "error">("");

  useEffect(() => { getZonas().then(setZonas); }, []);
  useEffect(() => { if (user) getAdn(user.id).then((a) => setAdn(a ?? { ...ADN_VACIO })); }, [user]);

  if (loading || (user && !adn)) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="animate-spin text-magenta" aria-label="Cargando" /></div>;
  if (!user || !adn) {
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-[18px] font-bold text-tinta">Entra para guardar tu ADN</p>
        <Link href="/perfil?volver=/perfil/adn" className="mt-4 inline-flex min-h-[48px] items-center rounded-2xl bg-magenta px-6 font-bold text-white">Entrar</Link>
      </main>
    );
  }

  // Familias elegidas (el ADN puede traer estilos sueltos "familia:estilo").
  const familias = new Set(adn.musica.map((m) => m.split(":")[0]));
  const alternarMusica = (id: string) => {
    const resto = adn.musica.filter((m) => m.split(":")[0] !== id);
    setAdn({ ...adn, musica: familias.has(id) ? resto : [...resto, id] });
  };
  const alternarTipo = (t: string) =>
    setAdn({ ...adn, tiposEvento: adn.tiposEvento.includes(t) ? adn.tiposEvento.filter((x) => x !== t) : [...adn.tiposEvento, t] });
  const precioSel = adn.precioMax === "gratis" ? "gratis" : ["hasta10", "de10a20", "hasta20"].includes(adn.precioMax) ? "hasta20" : "";

  const guardar = async () => {
    setEstado("guardando");
    const { data, error } = await guardarAdn(user.id, adn);
    setEstado(error || !data?.length ? "error" : "ok");
  };

  const pild = (on: boolean) => `min-h-[44px] rounded-full px-4 text-[15px] font-semibold ${on ? "bg-magenta-50 text-magenta-700 ring-1 ring-magenta/40" : "bg-marfil-100 text-tinta"}`;

  return (
    <main className="bg-fondo">
      <CabeceraApp titulo="Mi ADN" volver="/perfil" />
      <div className="mx-auto max-w-xl px-4 pt-4 md:pt-10">
        <h1 className="hidden text-[32px] font-bold text-tinta md:block">Mi ADN</h1>
        <p className="text-[16px] text-tinta-suave">Lo que te mueve. Puedes cambiarlo cuando quieras.</p>

        <h2 className="mt-5 text-[17px] font-bold text-tinta">Música</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {FAMILIAS.map((f) => <button key={f.id} type="button" aria-pressed={familias.has(f.id)} onClick={() => alternarMusica(f.id)} className={pild(familias.has(f.id))}>{f.nombre}</button>)}
        </div>

        <h2 className="mt-5 text-[17px] font-bold text-tinta">Planes</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIPOS_EVENTO.map((t) => <button key={t} type="button" aria-pressed={adn.tiposEvento.includes(t)} onClick={() => alternarTipo(t)} className={pild(adn.tiposEvento.includes(t))}>{t}</button>)}
        </div>

        <h2 className="mt-5 text-[17px] font-bold text-tinta">Zona</h2>
        <select value={adn.zonas[0] ?? ""} onChange={(e) => setAdn({ ...adn, zonas: e.target.value ? [e.target.value] : [] })}
          className="mt-2 min-h-[48px] w-full rounded-2xl border border-linea-fuerte bg-superficie px-4 text-[16px] text-tinta">
          <option value="">Cualquier zona</option>
          {zonas.map((z) => <option key={z.slug} value={z.nombre}>{z.nombre}</option>)}
        </select>

        <h2 className="mt-5 text-[17px] font-bold text-tinta">Precio de entrada</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRECIOS.map((p) => <button key={p.l} type="button" aria-pressed={precioSel === p.k} onClick={() => setAdn({ ...adn, precioMax: p.k })} className={pild(precioSel === p.k)}>{p.l}</button>)}
        </div>

        <p className="mt-6 flex items-center gap-2 rounded-2xl border border-linea bg-superficie p-4 text-[15px] text-tinta-suave">
          <Lock size={16} aria-hidden /> Tus preferencias completas son privadas.
        </p>
        {estado === "ok" && (
          <p role="status" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ok-fondo px-3 py-2 font-semibold text-ok">
            Guardado. Eventos partirá de tu ADN.
            {/* Tras rellenarlo (a menudo justo después de crear la cuenta), el
                siguiente paso natural es ver los planes, no quedarse aquí. */}
            <Link href="/" className="inline-flex min-h-[44px] items-center font-bold text-magenta-700">Ver mis planes →</Link>
          </p>
        )}
        {estado === "error" && <p role="alert" className="mt-3 rounded-xl bg-error-fondo px-3 py-2 font-semibold text-error">No se pudo guardar. Inténtalo otra vez.</p>}
        <button type="button" onClick={guardar} disabled={estado === "guardando"}
          className="mt-4 min-h-[52px] w-full rounded-2xl bg-magenta text-[17px] font-bold text-white disabled:opacity-60">
          {estado === "guardando" ? "Guardando…" : "Guardar preferencias"}
        </button>
      </div>
    </main>
  );
}
