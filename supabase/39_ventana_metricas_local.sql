-- =========================================================
-- TardeosClub · LOTE 39: LA VENTANA DE «CÓMO VA» LA CALCULA LA BASE
-- Aplicar en Supabase → SQL Editor.
--
-- El panel del local tiene tres botones —7, 30 y 90 días— y hasta ahora el
-- navegador mandaba las dos fechas: `p_desde` restando días a su reloj y
-- `p_hasta` con `new Date()`.
--
-- Es el MISMO fallo que se corrigió en el lote 36 para las estadísticas del
-- admin, y allí se midió: las filas las sella la base con su reloj, que iba
-- hasta 74 ms por delante del del navegador, así que las recién escritas
-- caían fuera de la ventana y no se contaban. Se vio metiendo diecisiete
-- filas y viendo que la función contaba una.
--
-- 74 ms no se nota, pero el reloj de un móvil cualquiera puede ir minutos
-- desviado, y entonces el síntoma es el peor posible: un panel que casi
-- acierta. El local mira sus visitas, ve un número creíble, y está mal.
--
-- Se arregla igual que allí: se manda el NÚMERO DE DÍAS y la ventana la
-- calcula la base con su propio reloj. Un solo reloj, ningún desfase posible.
-- =========================================================

-- La firma cambia (uuid, timestamptz, timestamptz) -> (uuid, int), así que la
-- antigua se retira. Si se dejara, PostgREST tendría dos funciones con el
-- mismo nombre y resolvería por los parámetros que le llegan: el día que
-- alguien llame con las fechas viejas volvería el fallo sin avisar.
drop function if exists public.metricas_local(uuid, timestamptz, timestamptz);

create or replace function public.metricas_local(
  p_local uuid,
  p_dias int default 30
)
returns table (dia date, tipo text, total bigint)
language sql stable security definer set search_path = public as $$
  select date_trunc('day', e.created_at)::date as dia, e.tipo, count(*) as total
    from public.eventos_metrica e
    left join public.tardeos t on t.id = e.tardeo_id
   where (e.local_id = p_local or t.local_id = p_local)
     -- `greatest(...,1)` para que un 0 o un negativo no devuelvan una ventana
     -- vacía o del futuro: ante un valor absurdo, el día de hoy.
     and e.created_at >= now() - (greatest(p_dias, 1) || ' days')::interval
     -- Sin tope superior a propósito: el tope es «ahora», y «ahora» ya lo
     -- pone `now()` al abrir la ventana. Poner `<= now()` no añade nada y es
     -- justo por donde se colaba el desfase.
     --
     -- El dueño o un admin. Va DENTRO de la función porque es security
     -- definer: sin esto, cualquiera podría pedir las métricas de cualquier
     -- local.
     and (public.is_admin() or public.owns_tardeo(p_local))
   group by 1, 2
   order by 1;
$$;

revoke all on function public.metricas_local(uuid, int) from public;
grant execute on function public.metricas_local(uuid, int) to authenticated;

notify pgrst, 'reload schema';
