-- L0 · Copia de seguridad (HAZLO PRIMERO)
-- Proyecto TardeosClub · limpieza de datos tras la migración doble · 14-oct-2026
-- Copia las tablas que van a cambiar en tablas _bak_ (ocultas: RLS sin políticas).
-- Para deshacer algo, se recupera de aquí. Se pueden borrar semanas después.
-- Es seguro ejecutarlo varias veces: si ya existe la copia, no la pisa.


do $$ begin
  if to_regclass('public._bak_20261014_tardeos') is null then
    create table public._bak_20261014_tardeos as table public.tardeos;
    create table public._bak_20261014_locales  as table public.locales;
    create table public._bak_20261014_djs      as table public.djs;
    create table public._bak_20261014_profiles as table public.profiles;
    alter table public._bak_20261014_tardeos enable row level security;
    alter table public._bak_20261014_locales  enable row level security;
    alter table public._bak_20261014_djs      enable row level security;
    alter table public._bak_20261014_profiles enable row level security;
  end if;
end $$;

-- COMPROBACIÓN: deben salir las mismas cifras que las tablas reales (1613 / 129 / 62 / 263)
select (select count(*) from public._bak_20261014_tardeos) as tardeos,
       (select count(*) from public._bak_20261014_locales)  as locales,
       (select count(*) from public._bak_20261014_djs)      as djs,
       (select count(*) from public._bak_20261014_profiles) as profiles;
