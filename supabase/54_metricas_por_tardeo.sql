-- ============================================================
-- LOTE 54 · Estadísticas por tardeo en el panel del local
--
-- «Cómo va» (lote 39) suma el local entero por día. Lo que el local quiere
-- saber después es CUÁL de sus tardeos funciona: visitas, clics a comprar y
-- guardados de cada uno en el periodo elegido.
--
-- En función y no desde el navegador: contar en cliente obligaría a bajarse
-- todas las filas de eventos_metrica (PostgREST corta a 1000). Sin la función
-- el panel cuenta a mano con un tope y lo avisa como aproximado.
--
-- security definer con la comprobación dentro, igual que metricas_local:
-- solo el dueño o un admin. Idempotente.
-- ============================================================

create or replace function public.metricas_por_tardeo(
  p_local uuid,
  p_dias int default 30
)
returns table (tardeo_id uuid, titulo text, fecha date, visitas bigint, clics bigint, guardados bigint)
language sql stable security definer set search_path = public as $$
  select t.id, t.titulo, t.fecha,
         count(*) filter (where e.tipo = 'vista_tardeo')                   as visitas,
         count(*) filter (where e.tipo in ('clic_entrada', 'clic_lista'))  as clics,
         count(*) filter (where e.tipo = 'favorito')                       as guardados
    from public.eventos_metrica e
    join public.tardeos t on t.id = e.tardeo_id
   where t.local_id = p_local
     and e.created_at >= now() - (greatest(p_dias, 1) || ' days')::interval
     and (public.is_admin() or public.owns_tardeo(p_local))
   group by t.id, t.titulo, t.fecha
   order by 4 desc, t.fecha desc
   limit 200;
$$;

revoke all on function public.metricas_por_tardeo(uuid, int) from public;
grant execute on function public.metricas_por_tardeo(uuid, int) to authenticated;

notify pgrst, 'reload schema';
