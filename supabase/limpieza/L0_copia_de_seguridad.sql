-- L0 · Copia de seguridad (HAZLO PRIMERO)
-- Proyecto TardeosClub · limpieza de la migración doble · revisado 17-oct-2026
-- Copia en tablas _bak_limpieza_* todo lo que tocan L1-L7. Quedan ocultas (RLS sin
-- políticas). Para deshacer, se recupera de aquí. Se pueden borrar semanas después.
-- Seguro de repetir: si la copia ya existe, NO la pisa (la primera es la buena).

do $$
declare t text;
begin
  foreach t in array array['tardeos','locales','djs','profiles','eventos_metrica','metricas_tardeo'] loop
    if to_regclass('public._bak_limpieza_' || t) is null then
      execute format('create table public.%I as table public.%I', '_bak_limpieza_' || t, t);
      execute format('alter table public.%I enable row level security', '_bak_limpieza_' || t);
    end if;
  end loop;
end $$;

-- COMPROBACIÓN: cada copia debe tener las mismas filas que su tabla.
select 'tardeos' as tabla, (select count(*) from public._bak_limpieza_tardeos) as copia, (select count(*) from public.tardeos) as real
union all select 'locales', (select count(*) from public._bak_limpieza_locales), (select count(*) from public.locales)
union all select 'djs', (select count(*) from public._bak_limpieza_djs), (select count(*) from public.djs)
union all select 'profiles', (select count(*) from public._bak_limpieza_profiles), (select count(*) from public.profiles)
union all select 'eventos_metrica', (select count(*) from public._bak_limpieza_eventos_metrica), (select count(*) from public.eventos_metrica)
union all select 'metricas_tardeo', (select count(*) from public._bak_limpieza_metricas_tardeo), (select count(*) from public.metricas_tardeo);
