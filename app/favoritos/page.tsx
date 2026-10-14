"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TardeoCard from "@/components/TardeoCard";
import ListaApuntados from "@/components/cuenta/ListaApuntados";
import { getFavoritos } from "@/lib/tardeos";
import { Tardeo } from "@/lib/types";
import { Heart, LogIn, Ticket } from "lucide-react";
import { MarcoCuenta, CargandoCuenta, useDatosCuenta } from "@/components/panel/CuentaNav";
import { claseBoton } from "@/components/Boton";
import { entrarYVolver } from "@/lib/volver";

type Ver = "apuntados" | "guardados";

/**
 * Mis planes, en DOS pestañas con nombres que no se confunden:
 *
 *  - «Me he apuntado»: tardeos donde tienes plaza (inscripción). Se pueden
 *    cancelar, y se ven los pasados y los cancelados.
 *  - «Guardados»: los que marcaste con el corazón para no perderlos.
 *
 * Antes había "Tus próximos planes", "Mis planes" y "Mis reservas" en tres
 * sitios distintos para dos cosas, y no se entendía cuál era cuál.
 */
export default function MisPlanes() {
  const { user, loading, datos } = useDatosCuenta();
  const [ver, setVer] = useState<Ver>("apuntados");
  const [favs, setFavs] = useState<Tardeo[]>([]);
  const [favsPasados, setFavsPasados] = useState<Tardeo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // ?ver=guardados|apuntados (enlaces desde Inicio y la antigua "Mis
  // reservas"). Sin parámetro: si no se ha apuntado a nada, abre Guardados.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("ver");
    if (p === "guardados" || p === "apuntados") setVer(p);
    else if (datos && datos.nInscripciones === 0) setVer("guardados");
  }, [datos]);

  const cambiar = (v: Ver) => {
    setVer(v);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("ver", v);
      window.history.replaceState(null, "", u);
    } catch { /* la pestaña cambia igual */ }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) { setCargando(false); return; }
    let vivo = true;
    getFavoritos(user.id)
      .then((f) => {
        if (!vivo) return;
        const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
        setFavs(f.filter((t) => t.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha)));
        setFavsPasados(f.filter((t) => t.fecha < hoy).sort((a, b) => b.fecha.localeCompare(a.fecha)));
      })
      .catch(() => { if (vivo) setError("No pudimos cargar tus guardados. Recarga la página o inténtalo en un rato."); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [user, loading]);

  if (loading) return <CargandoCuenta />;

  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-4 pt-8 md:pt-16">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-linea bg-white p-8 text-center shadow-tarjeta">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-magenta-50 text-magenta"><Heart size={28} aria-hidden /></span>
          <h1 className="font-display text-2xl font-bold">Tus planes, en un sitio</h1>
          <p className="text-[16px] text-tinta-suave">Entra para ver los tardeos a los que te has apuntado y los que has guardado con el corazón.</p>
          <Link href={entrarYVolver("/favoritos")} className={claseBoton("primario")}>
            <LogIn size={20} aria-hidden /> Entrar o crear cuenta
          </Link>
        </div>
      </main>
    );
  }

  const pestanas: { k: Ver; label: string; icono: typeof Heart; n?: number }[] = [
    { k: "apuntados", label: "Me he apuntado", icono: Ticket, n: datos?.nInscripciones },
    { k: "guardados", label: "Guardados", icono: Heart, n: cargando ? undefined : favs.length + favsPasados.length },
  ];

  return (
    <MarcoCuenta titulo="Mis planes" descripcion="Los tardeos a los que vas y los que tienes guardados." datos={datos}>
      <div role="tablist" className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-marfil-100 p-1.5 sm:inline-grid sm:w-auto">
        {pestanas.map((p) => (
          <button key={p.k} role="tab" aria-selected={ver === p.k} onClick={() => cambiar(p.k)}
            className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 text-[16px] font-semibold transition ${
              ver === p.k ? "bg-white text-tinta shadow-tarjeta" : "text-tinta-suave hover:text-tinta"}`}>
            <p.icono size={18} className={ver === p.k ? "text-magenta" : ""} aria-hidden /> {p.label}
            {p.n != null && <span className="rounded-full bg-marfil-200 px-2 text-[13px] font-bold">{p.n}</span>}
          </button>
        ))}
      </div>

      {ver === "apuntados" ? (
        <>
          <p className="mb-4 text-[15px] text-tinta-suave">Tardeos donde tienes plaza. Si no puedes ir, cancélala para dejársela a otra persona.</p>
          <ListaApuntados user={user} />
        </>
      ) : (
        <section>
          <p className="mb-4 text-[15px] text-tinta-suave">Los que marcaste con el corazón para no perderlos de vista. Guardar no reserva plaza.</p>
          {error && <p role="alert" className="mb-4 rounded-xl bg-error-fondo p-3 text-[15px] font-semibold text-error">{error}</p>}
          {cargando ? (
            <p className="text-tinta-suave">Cargando…</p>
          ) : favs.length === 0 && favsPasados.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-8 text-center">
              <Heart size={28} className="mx-auto text-magenta" aria-hidden />
              <p className="mt-2 font-semibold">Todavía no has guardado ningún tardeo.</p>
              <p className="mt-1 text-[15px] text-tinta-suave">En la ficha de un tardeo, toca el corazón para tenerlo aquí.</p>
              <Link href="/tardeos" className={claseBoton("primario", "pequeno", false, "mt-4")}>Ver tardeos</Link>
            </div>
          ) : favs.length === 0 ? (
            // Solo hay guardados que ya pasaron: sin esto la pestaña parecía
            // vacía y rota, con la lista escondida más abajo.
            <div className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-6 text-center">
              <p className="font-semibold">No tienes guardado ningún tardeo próximo.</p>
              <p className="mt-1 text-[15px] text-tinta-suave">
                {favsPasados.length === 1
                  ? "El que guardaste ya pasó: lo tienes justo debajo, por si quieres repetir local."
                  : `Los ${favsPasados.length} que guardaste ya pasaron: los tienes justo debajo, por si quieres repetir local.`}
              </p>
              <Link href="/tardeos" className={claseBoton("primario", "pequeno", false, "mt-4")}>Buscar próximos tardeos</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
              {favs.map((t) => <TardeoCard key={t.id} tardeo={t} />)}
            </div>
          )}
          {favsPasados.length > 0 && (
            <details className="mt-6 rounded-2xl border border-linea bg-white p-4">
              <summary className="min-h-[44px] cursor-pointer content-center text-[16px] font-bold">
                Guardados que ya pasaron ({favsPasados.length})
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
                {favsPasados.map((t) => <TardeoCard key={t.id} tardeo={t} />)}
              </div>
            </details>
          )}
        </section>
      )}
    </MarcoCuenta>
  );
}
