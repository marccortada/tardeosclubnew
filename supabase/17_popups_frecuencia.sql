-- =========================================================
-- TardeosClub · LOTE 17: CADA CUÁNTO SALE UN POPUP Y A QUIÉN
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Hasta ahora el popup salía UNA vez y para siempre (se marcaba en el
-- localStorage del navegador) y lo veía todo el mundo. Eso sirve para un aviso
-- puntual, pero no para una oferta que quieres repetir, ni para hablarle solo a
-- los locales o solo a quien todavía no tiene cuenta.
-- =========================================================

-- Cada cuántas horas puede volver a salirle al mismo visitante.
--   null  -> una sola vez y no vuelve (el comportamiento de antes)
--   0     -> en cada visita
--   24    -> una vez al día · 168 -> una vez por semana
alter table public.popups add column if not exists repetir_horas integer;

-- A quién se le enseña.
alter table public.popups add column if not exists publico text not null default 'todos';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'popups_publico_check') then
    alter table public.popups
      add constraint popups_publico_check
      check (publico in ('todos', 'anonimos', 'registrados', 'locales', 'djs'));
  end if;
end $$;

-- Ventana de fechas: fuera de ella no se enseña aunque esté activo. Sirve para
-- dejar preparada una oferta de fin de semana sin tener que acordarse de
-- encenderla y apagarla a mano.
alter table public.popups add column if not exists desde timestamptz;
alter table public.popups add column if not exists hasta timestamptz;

create index if not exists idx_popups_activo on public.popups(activo, created_at desc);

notify pgrst, 'reload schema';
