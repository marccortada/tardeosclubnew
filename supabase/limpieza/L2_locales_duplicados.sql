-- L2 · Unificar locales duplicados
-- Proyecto TardeosClub · limpieza de datos tras la migración doble · 14-oct-2026
-- 59 locales existen dos veces: el bueno (origen_id) sin dueño y la copia (con el dueño).
-- Se pasa al bueno el dueño, las fotos y el orden de destacado, y se borra la copia.
-- OJO: borrar un local borra en cascada sus tardeos, métricas, CRM y promociones, por eso
-- hay una guarda que PARA si algo cuelga todavía de una copia.
-- Ejecutar DESPUÉS de L1.


begin;

select count(*) as pares_de_locales
from public.locales d join public.locales g on g.origen_id = d.id
where d.origen_id is null;

do $$
declare t record; n int; total int := 0;
begin
  for t in select * from (values
    ('tardeos','local_id',null::text),
    ('eventos_metrica','local_id',null::text),
    ('seguimiento_comercial','local_id',null::text),
    ('promociones','local_id',null::text),
    ('campanas','local_id',null::text),
    ('resenas','objetivo_id','objetivo_tipo = ''local'''),
    ('solicitudes_reclamacion','objetivo_id','tipo = ''local''')
  ) as x(tabla, col, filtro)
  loop
    if to_regclass('public.' || t.tabla) is not null then
      execute format('select count(*) from public.%I where %I is not null and %I in (select d.id from public.locales d join public.locales g on g.origen_id = d.id where d.origen_id is null) %s',
                     t.tabla, t.col, t.col, coalesce('and ' || t.filtro, '')) into n;
      total := total + n;
    end if;
  end loop;
  if total > 0 then raise exception 'Hay % filas colgando de locales duplicados (¿falta ejecutar L1?). No se borra nada.', total; end if;
end $$;

-- Dueño, fotos y orden de destacado pasan al local bueno
update public.locales g set
  owner_id        = coalesce(g.owner_id, d.owner_id),
  fotos           = case when g.fotos is null or g.fotos = '[]'::jsonb then d.fotos else g.fotos end,
  destacado_orden = coalesce(g.destacado_orden, d.destacado_orden)
from public.locales d
where g.origen_id = d.id and d.origen_id is null;

delete from public.locales d
using public.locales g
where d.origen_id is null and g.origen_id = d.id;

-- Dueños de locales buenos que no tenían copia (según venues.user_id de la web antigua)


-- COMPROBACIÓN: esperado 70 locales (66 con origen + 4 creados a mano) y 0 duplicados
select count(*) as locales_ahora,
       (select count(*) from public.locales d join public.locales g on g.origen_id = d.id where d.origen_id is null) as duplicados_que_quedan,
       (select count(*) from public.locales where origen_id is not null and owner_id is null) as buenos_sin_dueno
from public.locales;

commit;
