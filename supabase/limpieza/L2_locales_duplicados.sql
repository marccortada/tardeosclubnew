-- L2 · Locales duplicados: dueño, fotos y métricas al bueno; borrar las copias
-- Proyecto TardeosClub · limpieza de la migración doble · revisado 17-oct-2026
-- 59 locales existen dos veces: el bueno (origen_id) sin dueño y la copia (con el dueño).
-- Se pasa al bueno el dueño, las fotos, el orden de destacado y sus métricas.
-- OJO: borrar un local borra en cascada sus tardeos, CRM, coins y promociones; por eso hay
-- una guarda que PARA si algo distinto de métricas cuelga aún de una copia.
-- Ejecutar DESPUÉS de L1 (que se lleva los tardeos duplicados).

begin;

-- El SQL Editor no tiene sesión de usuario: para la base no eres admin, y los disparadores
-- de protección (lotes 9, 19, 33, 37) DESHARÍAN EN SILENCIO los cambios de estado, orden de
-- destacados y planes. Esto marca la transacción como escritura del servidor (igual que la
-- service role) y solo dura hasta el commit.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select (select count(*) from public.locales d join public.locales g on g.origen_id = d.id where d.origen_id is null) as locales_a_borrar,
       (select count(*) from public.eventos_metrica where local_id in (select d.id from public.locales d join public.locales g on g.origen_id = d.id where d.origen_id is null)) as metricas_a_reasignar;

-- 1) Dueño, fotos y orden de destacado pasan al bueno
update public.locales g set
  owner_id        = coalesce(g.owner_id, d.owner_id),
  fotos           = case when g.fotos is null or g.fotos = '[]'::jsonb then d.fotos else g.fotos end,
  destacado_orden = coalesce(g.destacado_orden, d.destacado_orden)
from public.locales d
where g.origen_id = d.id and d.origen_id is null;

-- 2) Métricas: quitar las repetidas (misma visita ya apuntada en el bueno) y mover el resto.
--    Si la métrica también lleva tardeo, su clave de duplicado es el tardeo y no choca.
delete from public.eventos_metrica m
using public.locales d, public.locales g
where d.origen_id is null and g.origen_id = d.id and m.local_id = d.id and m.tardeo_id is null
  and m.dia is not null and coalesce(m.sesion, '') <> ''
  and exists (select 1 from public.eventos_metrica x
              where x.local_id = g.id and x.tardeo_id is null and x.sesion = m.sesion and x.tipo = m.tipo
                and coalesce(x.detalle, '') = coalesce(m.detalle, '') and x.dia = m.dia);

update public.eventos_metrica m set local_id = g.id
from public.locales d, public.locales g
where d.origen_id is null and g.origen_id = d.id and m.local_id = d.id;

-- 3) Guarda
do $g$
declare t record; n int; total int := 0; detalle text := '';
begin
  for t in select * from (values
    ('tardeos','local_id',null::text),
    ('eventos_metrica','local_id',null::text),
    ('seguimiento_comercial','local_id',null::text),
    ('promociones','local_id',null::text),
    ('campanas','local_id',null::text),
    ('coins_movimientos','local_id',null::text),
    ('coins_reservas','local_id',null::text),
    ('resenas','objetivo_id',$$objetivo_tipo = 'local'$$),
    ('solicitudes_reclamacion','objetivo_id',$$tipo = 'local'$$),
    ('invitaciones','ficha_id',$$tipo = 'local'$$)
  ) as x(tabla, col, filtro)
  loop
    if to_regclass('public.' || t.tabla) is not null
       and exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = t.tabla and column_name = t.col) then
      execute format('select count(*) from public.%I where %I in (select d.id from public.locales d join public.locales g on g.origen_id = d.id where d.origen_id is null) %s',
                     t.tabla, t.col, coalesce('and ' || t.filtro, '')) into n;
      if n > 0 then total := total + n; detalle := detalle || format(' %s.%s=%s', t.tabla, t.col, n); end if;
    end if;
  end loop;
  if total > 0 then
    raise exception 'Cuelgan % filas de locales duplicados (¿falta L1?). No se borra nada. Detalle:%', total, detalle;
  end if;
end $g$;

-- 4) Borrar las copias
delete from public.locales d
using public.locales g
where d.origen_id is null and g.origen_id = d.id;

-- COMPROBACIÓN
select (select count(*) from public.locales) as locales_ahora,
       (select count(*) from public.locales d join public.locales g on g.origen_id = d.id where d.origen_id is null) as duplicados_que_quedan,
       (select count(*) from public.locales where origen_id is not null and owner_id is not null) as buenos_con_dueno;

commit;
