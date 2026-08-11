-- =========================================================
-- TardeosClub · LOTE 11: RASTRO DE LA MIGRACIÓN
-- Aplicar en Supabase → SQL Editor, en la base NUEVA.
--
-- Guarda el id que tenía cada ficha en la app vieja. Sin esto, volver a
-- ejecutar el script de migración duplicaría los 601 tardeos: con esto, la
-- segunda pasada reconoce lo ya importado y lo actualiza en su sitio.
--
-- El índice es único pero la columna admite null, y en Postgres una unique
-- deja pasar tantos nulls como quieras: las fichas creadas a mano desde la
-- app no se ven afectadas.
-- =========================================================

alter table public.locales add column if not exists origen_id uuid;
alter table public.djs     add column if not exists origen_id uuid;
alter table public.tardeos add column if not exists origen_id uuid;

create unique index if not exists idx_locales_origen on public.locales(origen_id);
create unique index if not exists idx_djs_origen     on public.djs(origen_id);
create unique index if not exists idx_tardeos_origen on public.tardeos(origen_id);
