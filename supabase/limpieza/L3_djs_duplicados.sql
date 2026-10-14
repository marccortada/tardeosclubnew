-- L3 · Unificar DJs duplicados
-- Proyecto TardeosClub · limpieza de datos tras la migración doble · 14-oct-2026
-- 30 DJs existen dos veces. Se pasa la cuenta (profile_id) al bueno y se borra la copia.
-- No se copia 'redes' de la copia: ahí la migración antigua metió el teléfono como WhatsApp
-- y es público.
-- Ejecutar DESPUÉS de L1.


begin;

select count(*) as pares_de_djs
from public.djs d join public.djs g on g.origen_id = d.id
where d.origen_id is null;

do $$
declare t record; n int; total int := 0;
begin
  for t in select * from (values
    ('tardeo_djs','dj_id',null::text),
    ('eventos_metrica','dj_id',null::text),
    ('dj_contenidos','dj_id',null::text),
    ('resenas','objetivo_id','objetivo_tipo = ''dj''')
  ) as x(tabla, col, filtro)
  loop
    if to_regclass('public.' || t.tabla) is not null then
      execute format('select count(*) from public.%I where %I is not null and %I in (select d.id from public.djs d join public.djs g on g.origen_id = d.id where d.origen_id is null) %s',
                     t.tabla, t.col, t.col, coalesce('and ' || t.filtro, '')) into n;
      total := total + n;
    end if;
  end loop;
  if total > 0 then raise exception 'Hay % filas colgando de DJs duplicados. No se borra nada.', total; end if;
end $$;

update public.djs g set
  profile_id      = coalesce(g.profile_id, d.profile_id),
  destacado_orden = coalesce(g.destacado_orden, d.destacado_orden)
from public.djs d
where g.origen_id = d.id and d.origen_id is null;

delete from public.djs d
using public.djs g
where d.origen_id is null and g.origen_id = d.id;

-- COMPROBACIÓN: esperado 32 DJs (31 con origen + 1 sin gemelo) y 0 duplicados
select count(*) as djs_ahora,
       (select count(*) from public.djs d join public.djs g on g.origen_id = d.id where d.origen_id is null) as duplicados_que_quedan
from public.djs;

commit;
