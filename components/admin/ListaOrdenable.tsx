"use client";

import { ReactNode } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ArrowUp, ArrowDown } from "lucide-react";

type Props<T extends { id: string }> = {
  items: T[];
  /** Recibe la lista ya en su orden final. El padre guarda. */
  onOrden: (nuevo: T[]) => void;
  nombre: (it: T) => string;
  contenido: (it: T) => ReactNode;
  /** Botones extra (p. ej. Quitar) en la fila de abajo. */
  acciones?: (it: T) => ReactNode;
  deshabilitado?: boolean;
};

const BTN = "grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-linea-fuerte bg-white text-tinta transition-colors hover:bg-marfil-100 disabled:opacity-30";

function Fila<T extends { id: string }>({
  it, i, total, nombre, contenido, acciones, mover, deshabilitado,
}: {
  it: T; i: number; total: number; nombre: string; contenido: ReactNode; acciones?: ReactNode;
  mover: (delta: number) => void; deshabilitado?: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: it.id, disabled: deshabilitado });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-2xl border bg-white p-3 shadow-tarjeta ${isDragging ? "relative z-10 border-magenta shadow-elevada" : "border-linea"}`}
    >
      {/* En escritorio cabe todo en una línea; en móvil los botones bajan. */}
      <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
        <div className="flex min-w-0 flex-1 basis-full items-center gap-2 md:basis-auto">
          {/* Asa de 44 px. touch-none: solo ella captura el dedo, el resto de la
              fila deja hacer scroll con normalidad. */}
          <button
            type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
            disabled={deshabilitado}
            aria-label={`Arrastrar ${nombre} (posición ${i + 1} de ${total}). Con teclado: espacio y flechas.`}
            className="grid h-11 w-11 shrink-0 cursor-grab touch-none place-items-center rounded-xl bg-marfil-100 text-tinta-suave hover:text-tinta active:cursor-grabbing disabled:opacity-40"
          >
            <GripVertical size={22} aria-hidden />
          </button>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-oro/20 text-base font-bold tabular-nums">{i + 1}</span>
          <div className="min-w-0 flex-1">{contenido}</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {acciones}
          <button type="button" onClick={() => mover(-1)} disabled={deshabilitado || i === 0} aria-label={`Subir ${nombre}`} className={BTN}>
            <ArrowUp size={20} aria-hidden />
          </button>
          <button type="button" onClick={() => mover(1)} disabled={deshabilitado || i === total - 1} aria-label={`Bajar ${nombre}`} className={BTN}>
            <ArrowDown size={20} aria-hidden />
          </button>
        </div>
      </div>
    </li>
  );
}

/**
 * Lista que se reordena arrastrando (ratón y dedo) o con los botones
 * subir/bajar. El orden nuevo se entrega de una vez a `onOrden`.
 */
export default function ListaOrdenable<T extends { id: string }>({
  items, onOrden, nombre, contenido, acciones, deshabilitado,
}: Props<T>) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const alSoltar = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const de = items.findIndex((x) => x.id === active.id);
    const a = items.findIndex((x) => x.id === over.id);
    if (de < 0 || a < 0) return;
    onOrden(arrayMove(items, de, a));
  };

  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    onOrden(arrayMove(items, i, j));
  };

  return (
    <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
      <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {items.map((it, i) => (
            <Fila
              key={it.id} it={it} i={i} total={items.length} nombre={nombre(it)}
              contenido={contenido(it)} acciones={acciones?.(it)} mover={(d) => mover(i, d)} deshabilitado={deshabilitado}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
