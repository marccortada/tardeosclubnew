-- =========================================================
-- TardeosClub · LOTE 19: DESTACADOS CON ORDEN MANUAL
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Hasta ahora lo único destacable era un tardeo (`tardeos.destacado_hasta`).
-- Los locales, promotores y DJs no tenían forma de aparecer arriba, y el orden
-- lo decidía la reputación o la fecha de alta.
--
-- Esto es la base de un producto de pago (§21.1 del análisis): quién sale
-- primero, segundo y tercero. Hoy lo pone el admin a mano y es gratis; cuando
-- se cobre, solo cambia quién decide el número, no el mecanismo.
-- =========================================================

-- Orden dentro de los destacados: 1 sale antes que 2. Null = no destacado.
-- Se usa el mismo nombre en las dos tablas para que el panel sea uno solo.
alter table public.locales add column if not exists destacado_orden integer;
alter table public.djs     add column if not exists destacado_orden integer;

-- Filtrado y ordenado van siempre juntos, así que el índice cubre las dos
-- cosas. Parcial, porque la inmensa mayoría de filas no está destacada.
create index if not exists idx_locales_destacado
  on public.locales(destacado_orden) where destacado_orden is not null;
create index if not exists idx_djs_destacado
  on public.djs(destacado_orden) where destacado_orden is not null;

-- El lote 14 dejó a `anon` con permisos columna a columna en `locales`: una
-- columna nueva nace invisible para los visitantes y la home no podría ordenar.
grant select (destacado_orden) on public.locales to anon;

-- Destacar es dinero: que no se lo pueda regalar el propio interesado. Los
-- triggers del lote 9 ya protegen `verificado`; se les añade esta columna.
create or replace function public.proteger_locales()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.verificado       := false;
    new.estado           := 'borrador';
    new.destacado_orden  := null;
  else
    new.verificado       := old.verificado;
    new.estado           := old.estado;
    new.destacado_orden  := old.destacado_orden;
  end if;
  return new;
end; $$;

create or replace function public.proteger_djs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.verificado       := false;
    new.reputacion_score := 0;
    new.destacado_orden  := null;
  else
    new.verificado       := old.verificado;
    new.destacado_orden  := old.destacado_orden;
    -- Solo el recálculo automático del Lote 7 puede tocar la reputación.
    if coalesce(current_setting('app.recalc_reputacion', true), '') <> 'on' then
      new.reputacion_score := old.reputacion_score;
    end if;
  end if;
  return new;
end; $$;

notify pgrst, 'reload schema';
