-- TardeosClub · PAQUETE: lotes 70 y 71. Pegar entero en Supabase → SQL Editor → Run. Idempotente, no borra datos.


-- >>>>>>>>>> 70_indices_duplicados.sql <<<<<<<<<<
-- =============================================================
-- TardeosClub · LOTE 70: ÍNDICES DUPLICADOS
-- =============================================================
-- Tras el paquete 63-69 el Performance Advisor marcó "Duplicate Index" en
-- favoritos e inscripciones: los lotes nuevos crearon un índice que ya existía
-- en producción con otro nombre (esas tablas se crearon a mano antes de los
-- lotes). Dos índices iguales no aportan nada y ralentizan cada escritura.
--
-- Se borra el sobrante de cada pareja. Nunca uno que respalde una restricción
-- (clave primaria, única…): de cada grupo se queda primero el de restricción,
-- y si no hay, el más antiguo. Un índice no es dato: no se pierde nada.
-- Idempotente.
-- =============================================================
do $$
declare r record;
begin
  for r in
    with grupos as (
      select i.indexrelid, i.indrelid,
             exists (select 1 from pg_constraint c where c.conindid = i.indexrelid) as de_restriccion,
             row_number() over (
               partition by i.indrelid, i.indkey::text, i.indclass::text, coalesce(pg_get_expr(i.indexprs, i.indrelid), ''),
                            coalesce(pg_get_expr(i.indpred, i.indrelid), ''), i.indisunique
               order by (exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)) desc, i.indexrelid
             ) as n
      from pg_index i
      join pg_class t on t.oid = i.indrelid
      where t.relnamespace = 'public'::regnamespace
    )
    select indexrelid::regclass as indice from grupos where n > 1 and not de_restriccion
  loop
    execute format('drop index if exists %s', r.indice);
  end loop;
end $$;


-- >>>>>>>>>> 71_feed_djs_completo.sql <<<<<<<<<<
-- =============================================================
-- TardeosClub · LOTE 71: EL FEED DE DJs NO PUEDE SALIR VACÍO
-- =============================================================
-- feed_djs (lote 65) solo enseñaba DJs con un set o con un evento próximo. En
-- producción casi ningún DJ tiene aún sets subidos y la agenda está corta, así
-- que la pestaña DJs salía en negro. Ahora salen todos los DJs visibles: los
-- que tienen set o evento primero (como antes) y el resto detrás, con su foto,
-- para que se pueda descubrirlos y seguirlos. Mismo nombre, mismos parámetros
-- y mismas columnas: la app no cambia. Idempotente.
-- =============================================================

create or replace function public.feed_djs(
  p_siguiendo boolean default false, p_estilos text[] default '{}',
  p_desde integer default 0, p_limite integer default 8)
returns table (
  dj_id uuid, nombre text, avatar_url text, banner_url text, ciudad text, estilos text[],
  seguidores integer, siguiendo boolean,
  set_id uuid, set_titulo text, set_url text, set_plataforma text, set_portada text,
  set_estilos text[], set_likes integer, set_comentarios integer, me_gusta boolean, guardado boolean,
  evento_id uuid, evento_titulo text, evento_fecha date, evento_flyer text, evento_local text,
  afinidad integer)
language sql stable security invoker set search_path = public as $$
  with yo as (select auth.uid() as uid),
  base as (
    -- Columnas explícitas: con d.* entraría presskit_url, que anon no puede leer.
    select d.id, d.nombre_artistico, d.avatar_url, d.banner_url, d.ciudad, d.estilos,
      d.seguidores, d.destacado_orden,
      s.id as s_id, s.titulo as s_titulo, s.url as s_url, s.plataforma as s_plataforma,
      s.portada as s_portada, s.estilos as s_estilos, s.likes as s_likes, s.comentarios as s_comentarios,
      t.id as t_id, t.titulo as t_titulo, t.fecha as t_fecha, t.flyer_url as t_flyer, t.local_id as t_local
    from public.djs d
    left join lateral (
      select s.id, s.titulo, s.url, s.plataforma, s.portada, s.estilos, s.likes, s.comentarios
      from public.sets s where s.dj_id = d.id
      order by s.destacado desc, s.orden, s.created_at desc limit 1) s on true
    left join lateral (
      select t.id, t.titulo, t.fecha, t.flyer_url, t.local_id
      from public.tardeos t join public.tardeo_djs td on td.tardeo_id = t.id
      where td.dj_id = d.id and t.fecha >= (now() at time zone 'Europe/Madrid')::date
        and (t.estado = 'publicado' or (t.estado = 'programado' and t.publicar_en <= now()))
      order by t.fecha, t.id limit 1) t on true
    where not d.oculto
      and (not coalesce(p_siguiendo, false) or exists (
        select 1 from public.seguidores_dj f, yo where f.dj_id = d.id and f.profile_id = yo.uid))
  )
  select b.id, b.nombre_artistico, b.avatar_url, b.banner_url, b.ciudad, b.estilos,
    b.seguidores,
    exists (select 1 from public.seguidores_dj f, yo where f.dj_id = b.id and f.profile_id = yo.uid),
    b.s_id, b.s_titulo, b.s_url, b.s_plataforma, b.s_portada, b.s_estilos, b.s_likes, b.s_comentarios,
    exists (select 1 from public.sets_likes l, yo where l.set_id = b.s_id and l.profile_id = yo.uid),
    exists (select 1 from public.sets_guardados g, yo where g.set_id = b.s_id and g.profile_id = yo.uid),
    b.t_id, b.t_titulo, b.t_fecha::date, b.t_flyer,
    (select l.nombre from public.locales l where l.id = b.t_local),
    -- Afinidad: estilos en común, sin distinguir mayúsculas ("House" = "house").
    coalesce(cardinality(array(
      select lower(trim(x)) from unnest(coalesce(b.estilos, '{}') || coalesce(b.s_estilos, '{}')) x
      intersect select lower(trim(y)) from unnest(coalesce(p_estilos, '{}')) y)), 0)
  from base b
  -- (antes: solo DJs con set o evento; ahora todos, con esos primero)
  order by (b.s_id is not null or b.t_id is not null) desc, 24 desc, (b.t_id is not null) desc, b.destacado_orden nulls last,
           b.seguidores desc, b.id
  offset greatest(coalesce(p_desde, 0), 0)
  limit least(greatest(coalesce(p_limite, 8), 1), 30);
$$;

grant execute on function public.feed_djs(boolean, text[], integer, integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
