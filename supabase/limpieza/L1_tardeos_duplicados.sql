-- L1 · Borrar los tardeos duplicados (antes: fusionar lo que solo tienen las copias)
-- Proyecto TardeosClub · limpieza de datos tras la migración doble · 14-oct-2026
-- Cada tardeo duplicado (sin origen_id) tiene un gemelo bueno (origen_id = su id).
-- Las copias malas traen la hora desplazada 2 h, sin zona y publicadas aunque estuvieran
-- ocultas, PERO guardan tipo de evento, ambiente, público y dress code que el gemelo
-- bueno no tiene: se pasan al bueno ANTES de borrar.
-- Nada cuelga de los duplicados (favoritos, inscripciones, métricas, reseñas = 0, comprobado).
-- Ejecutar DESPUÉS de L0.


begin;

-- Resumen previo (esperado: 794 duplicados con gemelo)
select count(*) as duplicados_con_gemelo
from public.tardeos d join public.tardeos g on g.origen_id = d.id
where d.origen_id is null;

-- 1) Pasar al gemelo bueno lo que solo tiene la copia
update public.tardeos g set
  tipo_evento = coalesce(g.tipo_evento, d.tipo_evento),
  ambiente    = case when g.ambiente is null or cardinality(g.ambiente)=0 then d.ambiente else g.ambiente end,
  publico     = case when g.publico  is null or cardinality(g.publico)=0  then d.publico  else g.publico  end,
  dress_code  = coalesce(g.dress_code, d.dress_code)
from public.tardeos d
where g.origen_id = d.id and d.origen_id is null;

-- 2) Guarda de seguridad: si algo cuelga de un duplicado, se para TODO
do $$
declare t record; n int; total int := 0;
begin
  for t in select * from (values
    ('favoritos','tardeo_id',null::text),
    ('inscripciones','tardeo_id',null::text),
    ('tardeo_djs','tardeo_id',null::text),
    ('eventos_metrica','tardeo_id',null::text),
    ('metricas_tardeo','tardeo_id',null::text),
    ('resenas','objetivo_id','objetivo_tipo = ''tardeo''')
  ) as x(tabla, col, filtro)
  loop
    if to_regclass('public.' || t.tabla) is not null then
      execute format('select count(*) from public.%I where %I is not null and %I in (select d.id from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null) %s',
                     t.tabla, t.col, t.col, coalesce('and ' || t.filtro, '')) into n;
      total := total + n;
    end if;
  end loop;
  if total > 0 then raise exception 'Hay % filas colgando de tardeos duplicados: no se borra nada. Avisa.', total; end if;
end $$;

-- 3) Borrar los duplicados
delete from public.tardeos d
using public.tardeos g
where d.origen_id is null and g.origen_id = d.id;

-- COMPROBACIÓN: esperado 819 tardeos (801 buenos + 18 creados aquí) y 0 duplicados
select count(*) as tardeos_ahora,
       (select count(*) from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null) as duplicados_que_quedan
from public.tardeos;

commit;
