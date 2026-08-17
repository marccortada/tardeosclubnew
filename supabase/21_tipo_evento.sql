-- =========================================================
-- TardeosClub · LOTE 21: TIPO DE EVENTO
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- El cuarto criterio del documento, después de ambiente, público y dress code
-- (lote 20). Mismo planteamiento: vive en lib/adn.ts para que formularios y
-- filtros compartan los valores, y va como texto para admitir el "Otro…".
--
-- Uno solo por tardeo: un brunch no es a la vez un nocheo. Se solapa a medias
-- con la franja horaria (un mañaneo es de mañana), pero no se deduce de la hora
-- a propósito: un "Coffee Rave" y un "Vermuteo" pueden empezar a la misma hora
-- y no son lo mismo.
-- =========================================================

alter table public.tardeos add column if not exists tipo_evento text;

grant select (tipo_evento) on public.tardeos to anon;
grant select (tipo_evento) on public.tardeos to authenticated;

notify pgrst, 'reload schema';
