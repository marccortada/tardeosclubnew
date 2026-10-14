-- ============================================================
-- LOTE 53 · Series de tardeos («cada semana hasta diciembre»)
--
-- Crear un tardeo que se repite inserta una fila por fecha, pero nada las
-- unía: cambiar la hora de los dieciséis obligaba a abrirlos uno a uno.
-- `serie_id` es un uuid común a todas las fechas creadas a la vez; el panel
-- lo usa para «Aplicar también a las siguientes fechas de esta serie».
--
-- Sin tabla aparte a propósito: la serie no tiene datos propios, solo
-- agrupa. Los tardeos sueltos y los migrados quedan con null.
--
-- RLS no cambia: un update por serie_id sigue pasando por las políticas de
-- `tardeos` (solo el dueño del local o un admin).
-- Idempotente: se puede pegar dos veces.
-- ============================================================

alter table public.tardeos add column if not exists serie_id uuid;

-- Las consultas son siempre «los de esta serie a partir de tal fecha».
create index if not exists idx_tardeos_serie on public.tardeos(serie_id, fecha)
  where serie_id is not null;

notify pgrst, 'reload schema';
