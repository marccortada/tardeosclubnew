-- ============================================================
-- LOTE 7 · Reputación automática del DJ
-- La reputación del DJ = media de sus reseñas APROBADAS.
-- Se recalcula sola con un trigger al crear/aprobar/editar/borrar reseñas.
-- Si el DJ aún no tiene reseñas aprobadas, se mantiene su puntuación actual.
-- ============================================================

create or replace function public.recalc_reputacion_dj()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dj  uuid;
  v_avg numeric;
begin
  -- Solo nos interesan reseñas de DJ
  if coalesce(new.objetivo_tipo, old.objetivo_tipo) <> 'dj' then
    return coalesce(new, old);
  end if;

  v_dj := coalesce(new.objetivo_id, old.objetivo_id);

  select round(avg(r.puntuacion)::numeric, 2)
    into v_avg
  from public.resenas r
  where r.objetivo_tipo = 'dj'
    and r.objetivo_id = v_dj
    and r.estado = 'aprobada';

  -- Solo actualizamos si hay reseñas aprobadas (si no, dejamos la puntuación actual)
  if v_avg is not null then
    update public.djs
    set reputacion_score = v_avg
    where id = v_dj;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_resenas_reputacion on public.resenas;
create trigger trg_resenas_reputacion
after insert or update or delete on public.resenas
for each row execute function public.recalc_reputacion_dj();

-- Recalcular ahora los DJs que YA tengan reseñas aprobadas (backfill puntual)
update public.djs d
set reputacion_score = sub.avg
from (
  select r.objetivo_id as dj_id, round(avg(r.puntuacion)::numeric, 2) as avg
  from public.resenas r
  where r.objetivo_tipo = 'dj' and r.estado = 'aprobada'
  group by r.objetivo_id
) sub
where d.id = sub.dj_id;
