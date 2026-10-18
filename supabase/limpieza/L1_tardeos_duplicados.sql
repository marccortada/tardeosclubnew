-- L1 · Tardeos duplicados: fusionar, pasar sus métricas al gemelo y borrar las copias
-- Proyecto TardeosClub · limpieza de la migración doble · revisado 17-oct-2026
-- Cada copia (sin origen_id) tiene un gemelo bueno (origen_id = su id). Las copias traen la
-- hora desplazada 2 h, sin zona y publicadas aunque estuvieran ocultas, PERO guardan tipo
-- de evento, ambiente, público y dress code que el gemelo no tiene: se pasan ANTES.
-- De las copias cuelgan MÉTRICAS (visitas, clics) y, desde el 16-oct, 1 inscripción real
-- (alguien se apuntó a la copia publicada de «Fiesta Sevillanas»), y desde el 18-oct 2 favoritos: todo pasa al gemelo.
-- Las que el gemelo ya tiene de la misma visita (misma sesión, tipo y día) se quitan:
-- contarían doble y además chocarían con el índice que evita duplicados.
-- Cualquier OTRA cosa que colgara (favoritos, Meet Zone, sorteos…) PARA todo.
-- Ejecutar DESPUÉS de L0. Todo o nada: si algo falla, no cambia nada.

begin;

-- El SQL Editor no tiene sesión de usuario: para la base no eres admin, y los disparadores
-- de protección (lotes 9, 19, 33, 37) DESHARÍAN EN SILENCIO los cambios de estado, orden de
-- destacados y planes. Esto marca la transacción como escritura del servidor (igual que la
-- service role) y solo dura hasta el commit.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Lo que va a pasar (léelo antes de seguir):
select (select count(*) from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null) as tardeos_a_borrar,
       (select count(*) from public.eventos_metrica where tardeo_id in (select d.id from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null)) as metricas_a_reasignar,
       (select count(*) from public.metricas_tardeo where tardeo_id in (select d.id from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null)) as contadores_a_sumar,
       (select count(*) from public.inscripciones where tardeo_id in (select d.id from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null)) as inscripciones_a_mover;

-- 1) Lo que solo tiene la copia pasa al gemelo bueno
update public.tardeos g set
  tipo_evento = coalesce(g.tipo_evento, d.tipo_evento),
  ambiente    = case when g.ambiente is null or cardinality(g.ambiente) = 0 then d.ambiente else g.ambiente end,
  publico     = case when g.publico  is null or cardinality(g.publico)  = 0 then d.publico  else g.publico  end,
  dress_code  = coalesce(g.dress_code, d.dress_code)
from public.tardeos d
where g.origen_id = d.id and d.origen_id is null;

-- 2) Métricas por evento: quitar las que ya tiene el gemelo (misma visita) y mover el resto
delete from public.eventos_metrica m
using public.tardeos d, public.tardeos g
where d.origen_id is null and g.origen_id = d.id and m.tardeo_id = d.id
  and m.dia is not null and coalesce(m.sesion, '') <> ''
  and exists (select 1 from public.eventos_metrica x
              where x.tardeo_id = g.id and x.sesion = m.sesion and x.tipo = m.tipo
                and coalesce(x.detalle, '') = coalesce(m.detalle, '') and x.dia = m.dia);

update public.eventos_metrica m set tardeo_id = g.id
from public.tardeos d, public.tardeos g
where d.origen_id is null and g.origen_id = d.id and m.tardeo_id = d.id;

-- 3) Contador de visitas (una fila por tardeo): se suma al del gemelo
insert into public.metricas_tardeo as mt (tardeo_id, visitas, updated_at)
select g.id, m.visitas, m.updated_at
from public.metricas_tardeo m
join public.tardeos d on d.id = m.tardeo_id and d.origen_id is null
join public.tardeos g on g.origen_id = d.id
on conflict (tardeo_id) do update
  set visitas = mt.visitas + excluded.visitas,
      updated_at = greatest(mt.updated_at, excluded.updated_at);
delete from public.metricas_tardeo where tardeo_id in (select d.id from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null);

-- 3b) Inscripciones: pasan al gemelo con su estado y su fecha (es la misma fiesta). Si la
-- persona ya estuviera apuntada también al gemelo, la de la copia se queda y la guarda de
-- abajo lo para todo: que lo decida una persona, no el script. Va con la marca de servidor
-- de arriba porque el lote 48 impide "mudar" una inscripción si no eres admin.
update public.inscripciones i set tardeo_id = g.id
from public.tardeos d, public.tardeos g
where d.origen_id is null and g.origen_id = d.id and i.tardeo_id = d.id
  and not exists (select 1 from public.inscripciones x where x.tardeo_id = g.id and x.profile_id = i.profile_id);

-- 3c) Favoritos («guardados»): igual que las inscripciones. Clave (persona,
-- tardeo): si ya lo tenía guardado en el gemelo, el de la copia sobra y se va
-- con ella (es el mismo plan guardado dos veces, no se pierde nada).
update public.favoritos f set tardeo_id = g.id
from public.tardeos d, public.tardeos g
where d.origen_id is null and g.origen_id = d.id and f.tardeo_id = d.id
  and not exists (select 1 from public.favoritos x where x.tardeo_id = g.id and x.profile_id = f.profile_id);
delete from public.favoritos f
using public.tardeos d, public.tardeos g
where d.origen_id is null and g.origen_id = d.id and f.tardeo_id = d.id
  and exists (select 1 from public.favoritos x where x.tardeo_id = g.id and x.profile_id = f.profile_id);

-- 4) Guarda: si cuelga cualquier otra cosa de una copia, se para TODO (nada se pierde)
do $g$
declare t record; n int; total int := 0; detalle text := '';
begin
  for t in select * from (values
    ('eventos_metrica','tardeo_id',null::text),
    ('metricas_tardeo','tardeo_id',null::text),
    ('favoritos','tardeo_id',null::text),
    ('inscripciones','tardeo_id',null::text),
    ('tardeo_djs','tardeo_id',null::text),
    ('clics_atribucion','tardeo_id',null::text),
    ('coins_reservas','tardeo_id',null::text),
    ('denuncias_flyer','tardeo_id',null::text),
    ('dj_invitaciones','tardeo_id',null::text),
    ('dj_solicitudes','tardeo_id',null::text),
    ('encuestas','tardeo_id',null::text),
    ('meet_fijado','tardeo_id',null::text),
    ('meet_mensajes','tardeo_id',null::text),
    ('promociones','tardeo_id',null::text),
    ('resenas','tardeo_id',null::text),
    ('sorteos','tardeo_id',null::text)
  ) as x(tabla, col, filtro)
  loop
    if to_regclass('public.' || t.tabla) is not null
       and exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = t.tabla and column_name = t.col) then
      execute format('select count(*) from public.%I where %I in (select d.id from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null) %s',
                     t.tabla, t.col, coalesce('and ' || t.filtro, '')) into n;
      if n > 0 then total := total + n; detalle := detalle || format(' %s.%s=%s', t.tabla, t.col, n); end if;
    end if;
  end loop;
  if total > 0 then
    raise exception 'Cuelgan % filas de tardeos duplicados que no son métricas: no se borra nada. Avisa. Detalle:%', total, detalle;
  end if;
end $g$;

-- 5) Borrar las copias
delete from public.tardeos d
using public.tardeos g
where d.origen_id is null and g.origen_id = d.id;

-- COMPROBACIÓN: 0 duplicados y ninguna métrica perdida (compárala con la copia de L0)
select (select count(*) from public.tardeos) as tardeos_ahora,
       (select count(*) from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null) as duplicados_que_quedan,
       (select count(*) from public.eventos_metrica) as metricas_ahora,
       (select count(*) from public._bak_limpieza_eventos_metrica) as metricas_antes;

commit;
