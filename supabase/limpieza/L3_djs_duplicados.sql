-- L3 · DJs duplicados: cuenta y métricas al bueno; borrar las copias
-- Proyecto TardeosClub · limpieza de la migración doble · revisado 17-oct-2026
-- 30 DJs existen dos veces. Se pasa la cuenta (profile_id), el orden de destacado y sus
-- métricas al bueno y se borra la copia. NO se copia 'redes' de la copia: ahí la migración
-- antigua metió el teléfono como WhatsApp, y es público.
-- Ejecutar DESPUÉS de L1.

begin;

-- El SQL Editor no tiene sesión de usuario: para la base no eres admin, y los disparadores
-- de protección (lotes 9, 19, 33, 37) DESHARÍAN EN SILENCIO los cambios de estado, orden de
-- destacados y planes. Esto marca la transacción como escritura del servidor (igual que la
-- service role) y solo dura hasta el commit.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select (select count(*) from public.djs d join public.djs g on g.origen_id = d.id where d.origen_id is null) as djs_a_borrar,
       (select count(*) from public.eventos_metrica where dj_id in (select d.id from public.djs d join public.djs g on g.origen_id = d.id where d.origen_id is null)) as metricas_a_reasignar;

update public.djs g set
  profile_id      = coalesce(g.profile_id, d.profile_id),
  destacado_orden = coalesce(g.destacado_orden, d.destacado_orden)
from public.djs d
where g.origen_id = d.id and d.origen_id is null;

delete from public.eventos_metrica m
using public.djs d, public.djs g
where d.origen_id is null and g.origen_id = d.id and m.dj_id = d.id
  and m.tardeo_id is null and m.local_id is null
  and m.dia is not null and coalesce(m.sesion, '') <> ''
  and exists (select 1 from public.eventos_metrica x
              where x.dj_id = g.id and x.tardeo_id is null and x.local_id is null
                and x.sesion = m.sesion and x.tipo = m.tipo
                and coalesce(x.detalle, '') = coalesce(m.detalle, '') and x.dia = m.dia);

update public.eventos_metrica m set dj_id = g.id
from public.djs d, public.djs g
where d.origen_id is null and g.origen_id = d.id and m.dj_id = d.id;

do $g$
declare t record; n int; total int := 0; detalle text := '';
begin
  for t in select * from (values
    ('eventos_metrica','dj_id',null::text),
    ('tardeo_djs','dj_id',null::text),
    ('dj_contenidos','dj_id',null::text),
    ('dj_invitaciones','dj_id',null::text),
    ('dj_solicitudes','dj_id',null::text),
    ('dj_mensajes_ajustes','dj_id',null::text),
    ('bloqueos','dj_id',null::text),
    ('nexo_envios','dj_id',null::text),
    ('seguidores_dj','dj_id',null::text),
    ('sets','dj_id',null::text),
    ('solicitudes_mensaje','dj_id',null::text),
    ('resenas','objetivo_id',$$objetivo_tipo = 'dj'$$),
    ('solicitudes_reclamacion','objetivo_id',$$tipo = 'dj'$$),
    ('invitaciones','ficha_id',$$tipo = 'dj'$$)
  ) as x(tabla, col, filtro)
  loop
    if to_regclass('public.' || t.tabla) is not null
       and exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = t.tabla and column_name = t.col) then
      execute format('select count(*) from public.%I where %I in (select d.id from public.djs d join public.djs g on g.origen_id = d.id where d.origen_id is null) %s',
                     t.tabla, t.col, coalesce('and ' || t.filtro, '')) into n;
      if n > 0 then total := total + n; detalle := detalle || format(' %s.%s=%s', t.tabla, t.col, n); end if;
    end if;
  end loop;
  if total > 0 then
    raise exception 'Cuelgan % filas de DJs duplicados. No se borra nada. Detalle:%', total, detalle;
  end if;
end $g$;

delete from public.djs d
using public.djs g
where d.origen_id is null and g.origen_id = d.id;

select (select count(*) from public.djs) as djs_ahora,
       (select count(*) from public.djs d join public.djs g on g.origen_id = d.id where d.origen_id is null) as duplicados_que_quedan;

commit;
