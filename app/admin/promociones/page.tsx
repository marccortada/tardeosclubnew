"use client";

import { useEffect, useState } from "react";
import PanelHeader from "@/components/PanelHeader";
import { supabase } from "@/lib/supabase";
import { Plus, Megaphone, Trash2, Loader2 } from "lucide-react";

type Promo = { id: string; nombre: string; tipo: string; precio: number | null; activo: boolean };

export default function AdminPromociones() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.from("promociones_catalogo").select("*").order("created_at").then(({ data }) => {
      setPromos((data as Promo[]) ?? []);
      setCargando(false);
    });
  }, []);

  const setLocal = (id: string, campo: keyof Promo, valor: any) =>
    setPromos((p) => p.map((x) => (x.id === id ? { ...x, [campo]: valor } : x)));

  const persist = async (id: string, patch: Partial<Promo>) => {
    await supabase.from("promociones_catalogo").update(patch).eq("id", id);
  };

  const nueva = async () => {
    const { data } = await supabase
      .from("promociones_catalogo")
      .insert({ nombre: "Nueva promoción", tipo: "Destacado", precio: 0, activo: false })
      .select()
      .single();
    if (data) setPromos((p) => [...p, data as Promo]);
  };

  const borrar = async (id: string) => {
    setPromos((p) => p.filter((x) => x.id !== id));
    await supabase.from("promociones_catalogo").delete().eq("id", id);
  };

  return (
    <main className="pb-10">
      <PanelHeader titulo="Promociones y precios" volverHref="/admin" />
      <div className="mx-auto max-w-3xl px-4 pt-5 md:px-8">
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-oro/10 p-3 text-sm font-bold text-tinta/80">
          <Megaphone size={18} className="shrink-0 text-oro-600" />
          Edita precios, activa/desactiva o crea nuevas. Se guarda en la base de datos al instante.
        </div>

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-tinta/50"><Loader2 className="animate-spin" /> Cargando…</div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {promos.map((p) => (
                <div key={p.id} className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-magenta-50 px-2.5 py-1 text-xs font-black text-magenta-700">{p.tipo}</span>
                    <button onClick={() => borrar(p.id)} aria-label="Eliminar" className="text-tinta/30 hover:text-magenta"><Trash2 size={18} /></button>
                  </div>
                  <input
                    value={p.nombre}
                    onChange={(e) => setLocal(p.id, "nombre", e.target.value)}
                    onBlur={(e) => persist(p.id, { nombre: e.target.value })}
                    className="mt-2 w-full rounded-lg border-2 border-transparent bg-transparent text-lg font-black outline-none focus:border-magenta-100"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-bold text-tinta/70">
                      Precio €
                      <input
                        type="number" step="0.01"
                        value={p.precio ?? ""}
                        onChange={(e) => setLocal(p.id, "precio", e.target.value === "" ? null : Number(e.target.value))}
                        onBlur={() => persist(p.id, { precio: p.precio })}
                        className="w-24 rounded-lg border-2 border-magenta-100 px-3 py-2 text-base font-black outline-none focus:border-magenta"
                      />
                    </label>
                    <button
                      onClick={() => { const v = !p.activo; setLocal(p.id, "activo", v); persist(p.id, { activo: v }); }}
                      className={`relative h-8 w-14 rounded-full transition ${p.activo ? "bg-magenta" : "bg-black/15"}`}
                      aria-label={p.activo ? "Activa" : "Inactiva"}
                    >
                      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${p.activo ? "left-7" : "left-1"}`} />
                    </button>
                  </div>
                </div>
              ))}
              {promos.length === 0 && (
                <p className="rounded-2xl bg-white p-6 text-center font-bold text-tinta/50 ring-1 ring-black/5">
                  No hay promociones. Crea la primera 👇
                </p>
              )}
            </div>

            <button onClick={nueva} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-magenta-200 py-4 text-lg font-extrabold text-magenta transition hover:bg-magenta-50">
              <Plus size={22} /> Nueva promoción
            </button>
          </>
        )}
      </div>
    </main>
  );
}
