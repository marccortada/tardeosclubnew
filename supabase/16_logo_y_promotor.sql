-- =========================================================
-- TardeosClub · LOTE 16: LOGO DEL LOCAL Y TIPO DE FICHA
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- 1) logo_url: la chincheta del mapa enseña el logo del local en vez del pin
--    genérico de TardeosClub. La app anterior ya tiene logo en 57 de sus 59
--    locales, así que la siguiente sincronización los trae y funciona sin que
--    nadie suba nada.
--
-- 2) tipo: aparece el promotor de eventos, que organiza fiestas pero no tiene
--    local fijo. No es un invento: 412 de los 611 eventos de la app vieja
--    cuelgan de promotores (TardeosClub, Tardeotgn, El Ritmo del Sonido...)
--    dados de alta como locales falsos porque no había otro sitio donde
--    ponerlos. Cada uno de sus eventos ya lleva su propia dirección.
--
--    Por eso un promotor es una ficha de local sin dirección: el tardeo pone
--    el sitio. Así se reaprovechan la propiedad de la ficha, la publicación,
--    las invitaciones y el panel de admin sin duplicar nada.
-- =========================================================

alter table public.locales add column if not exists logo_url text;

alter table public.locales add column if not exists tipo text not null default 'local';

-- La restricción se añade aparte para que el lote se pueda reejecutar.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'locales_tipo_check') then
    alter table public.locales
      add constraint locales_tipo_check check (tipo in ('local', 'promotor'));
  end if;
end $$;

create index if not exists idx_locales_tipo on public.locales(tipo);

-- IMPRESCINDIBLE: el lote 14 le quitó a `anon` el SELECT de tabla y le
-- concedió las columnas una a una. Una columna nueva NO queda incluida, así que
-- sin esto el mapa y las tarjetas dejarían de poder leer el logo.
grant select (logo_url, tipo) on public.locales to anon;

notify pgrst, 'reload schema';
