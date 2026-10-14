"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, EstadoLista } from "@/components/panel/Paginacion";
import Boton from "@/components/Boton";
import { claseCampo } from "@/components/ui/Campo";
import { Etiqueta } from "@/components/ui/Chip";
import Hoja from "@/components/ui/Hoja";
import Aviso from "@/components/admin/Aviso";
import { Plus, Trash2, Save } from "lucide-react";

type Promo = { id: string; nombre: string; tipo: string; precio: number | null; activo: boolean };

/** Los tipos que ya existen, como sugerencia. Se puede escribir cualquier otro. */
const TIPOS = ["Destacado", "Instagram", "Pack", "Combo"];

/**
 * Catálogo de extras con su precio (tabla `promociones_catalogo`, lote 3).
 *
 * Es INFORMATIVO: hoy no hay pasarela de pago y nada de lo que se ponga aquí
 * cobra a nadie. Lo único que lo lee es /admin/ofertas, para rellenar el texto
 * de un correo a locales con el nombre y el precio.
 */
export default function AdminPromociones() {
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const [creando, setCreando] = useState(false);
  const [borrando, setBorrando] = useState<Promo | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const p = usePaginado<Promo>(
    (desde, hasta) =>
      supabase.from("promociones_catalogo").select("id,nombre,tipo,precio,activo", { count: "exact" })
        .order("created_at").order("id").range(desde, hasta) as any,
    [],
    25,
  );

  const nueva = async () => {
    setCreando(true); setAviso(null);
    // Nace desactivada: así no aparece en /admin/ofertas a medio rellenar.
    const { data, error } = await supabase
      .from("promociones_catalogo")
      .insert({ nombre: "Nueva promoción", tipo: "Destacado", precio: null, activo: false })
      .select("id");
    setCreando(false);
    if (error || !data?.length) { setAviso({ tono: "error", texto: "No se pudo crear: " + (error?.message ?? "¿tu cuenta es admin?") }); return; }
    setAviso({ tono: "ok", texto: "Creada al final de la lista, desactivada. Rellénala y guárdala." });
    p.recargar();
  };

  const borrar = async () => {
    if (!borrando) return;
    setOcupado(true);
    const { data, error } = await supabase.from("promociones_catalogo").delete().eq("id", borrando.id).select("id");
    setOcupado(false);
    const { id, nombre } = borrando;
    setBorrando(null);
    if (error || !data?.length) { setAviso({ tono: "error", texto: "No se pudo borrar: " + (error?.message ?? "¿tu cuenta es admin?") }); return; }
    setAviso({ tono: "ok", texto: `«${nombre}» borrada.` });
    p.quitar((x) => x.id === id);
  };

  return (
    <SeccionPanel
      titulo="Catálogo de extras"
      descripcion="Nombres y precios de los extras (destacados, packs…). Se usan para redactar ofertas a locales."
      acciones={<Boton tamano="pequeno" cargando={creando} onClick={nueva}><Plus size={18} aria-hidden /> Nueva</Boton>}
    >
      <Aviso tono="aviso">Catálogo informativo. Los cobros están desactivados: nada de lo que pongas aquí cobra a nadie.</Aviso>
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      <EstadoLista cargando={p.cargando} error={p.error} filas={p.filas.length}
        vacio="El catálogo está vacío. Crea la primera con «Nueva»." />

      {p.filas.length > 0 && (
        <ul className="flex flex-col gap-3">
          {p.filas.map((x) => (
            <FilaPromo key={x.id} promo={x}
              onGuardada={(cambio, msg) => { p.cambiar((f) => f.id === x.id, cambio); setAviso({ tono: "ok", texto: msg }); }}
              onError={(msg) => setAviso({ tono: "error", texto: msg })}
              onBorrar={() => setBorrando(x)} />
          ))}
        </ul>
      )}

      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />

      <datalist id="tipos-promo">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist>

      <Hoja abierta={Boolean(borrando)} onCerrar={() => setBorrando(null)} titulo="¿Borrar del catálogo?"
        pie={
          <div className="grid gap-2">
            <Boton ancho variante="peligro" cargando={ocupado} onClick={borrar}><Trash2 size={18} aria-hidden /> Sí, borrar</Boton>
            <Boton ancho variante="contorno" onClick={() => setBorrando(null)}>Cancelar</Boton>
          </div>
        }>
        <p className="text-base">
          Se borrará <strong>«{borrando?.nombre}»</strong>. Si solo quieres que no se ofrezca, desactívala.
        </p>
      </Hoja>
    </SeccionPanel>
  );
}

/**
 * Una fila editable. Se guarda con un botón y no al salir del campo: antes se
 * guardaba en `onBlur` sin mirar si la base lo aceptaba, y un fallo pasaba
 * por bueno.
 */
function FilaPromo({
  promo, onGuardada, onError, onBorrar,
}: {
  promo: Promo;
  onGuardada: (cambio: Partial<Promo>, msg: string) => void;
  onError: (msg: string) => void;
  onBorrar: () => void;
}) {
  const [nombre, setNombre] = useState(promo.nombre);
  const [tipo, setTipo] = useState(promo.tipo);
  const [precio, setPrecio] = useState(promo.precio == null ? "" : String(promo.precio));
  const [guardando, setGuardando] = useState(false);

  const precioNum = precio.trim() === "" ? null : Number(precio.replace(",", "."));
  const precioMal = precioNum !== null && (!Number.isFinite(precioNum) || precioNum < 0);
  const sucio = nombre !== promo.nombre || tipo !== promo.tipo || precioNum !== promo.precio;
  const invalido = !nombre.trim() || !tipo.trim() || precioMal;

  const escribir = async (cambio: Partial<Promo>, msg: string) => {
    setGuardando(true);
    const { data, error } = await supabase.from("promociones_catalogo").update(cambio).eq("id", promo.id).select("id");
    setGuardando(false);
    if (error || !data?.length) { onError("No se pudo guardar: " + (error?.message ?? "¿tu cuenta es admin?")); return; }
    onGuardada(cambio, msg);
  };

  const id = `pr-${promo.id}`;
  return (
    <li className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Etiqueta tono={promo.activo ? "ok" : "neutro"}>{promo.activo ? "Se ofrece" : "Desactivada"}</Etiqueta>
        <Boton variante="contorno" tamano="pequeno" aria-label={`Borrar ${promo.nombre}`} onClick={onBorrar}>
          <Trash2 size={16} aria-hidden />
        </Boton>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_120px]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-n`} className="text-[15px] font-semibold">Nombre</label>
          <input id={`${id}-n`} value={nombre} onChange={(e) => setNombre(e.target.value)} className={claseCampo} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-t`} className="text-[15px] font-semibold">Tipo</label>
          <input id={`${id}-t`} value={tipo} onChange={(e) => setTipo(e.target.value)} list="tipos-promo" className={claseCampo} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-p`} className="text-[15px] font-semibold">Precio €</label>
          <input id={`${id}-p`} value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal"
            placeholder="—" className={claseCampo} aria-invalid={precioMal} />
        </div>
      </div>
      {precioMal && <p role="alert" className="mt-1 text-sm font-semibold text-error">El precio tiene que ser un número (por ejemplo 9,99) o quedar vacío.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Boton tamano="pequeno" disabled={!sucio || invalido} cargando={guardando}
          onClick={() => escribir({ nombre: nombre.trim(), tipo: tipo.trim(), precio: precioNum }, "Cambios guardados.")}>
          <Save size={18} aria-hidden /> Guardar
        </Boton>
        <Boton variante="contorno" tamano="pequeno" disabled={guardando}
          onClick={() => escribir({ activo: !promo.activo }, promo.activo ? "Desactivada." : "Activada: ya sale en Ofertas.")}>
          {promo.activo ? "Desactivar" : "Activar"}
        </Boton>
      </div>
    </li>
  );
}
