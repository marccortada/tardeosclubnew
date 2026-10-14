-- ============================================================
-- LOTE 50 · El admin ve los apuntados y las visitas de cualquier local
--
-- El panel del local (/local?id=…) deja al admin abrir fichas ajenas para
-- ayudar a un dueño. Las dos funciones de abajo solo respondían al DUEÑO
-- (lotes 5 y 8), así que el admin veía "0 visitas" y "nadie apuntado" en
-- fichas que sí tienen datos, que es peor que no ver nada.
--
-- Mismo cuerpo que antes; solo cambia quién puede preguntar: el dueño o un
-- admin (public.is_admin(), lote 1). Idempotente: se puede pegar dos veces.
-- ============================================================

create or replace function public.inscritos_de_local(p_local uuid)
returns table(tardeo_id uuid, tardeo_titulo text, fecha date, nombre text, apuntado_en timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or exists (
    select 1 from public.locales l
    where l.id = p_local and l.owner_id = auth.uid()
  )) then
    return; -- vacío si no eres el dueño ni admin
  end if;

  return query
    select t.id, t.titulo, t.fecha,
           coalesce(p.display_name, 'Tardícola') as nombre,
           i.created_at
    from public.inscripciones i
    join public.tardeos t on t.id = i.tardeo_id
    left join public.profiles p on p.id = i.profile_id
    where t.local_id = p_local
      and i.estado = 'apuntado'
    order by t.fecha asc, i.created_at desc;
end;
$$;

grant execute on function public.inscritos_de_local(uuid) to authenticated;

create or replace function public.metricas_de_local(p_local uuid)
returns table(visitas bigint, inscritos bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or exists (
    select 1 from public.locales l
    where l.id = p_local and l.owner_id = auth.uid()
  )) then
    return query select 0::bigint, 0::bigint;
    return;
  end if;

  return query
    select
      coalesce((
        select sum(m.visitas)
        from public.metricas_tardeo m
        join public.tardeos t on t.id = m.tardeo_id
        where t.local_id = p_local
      ), 0)::bigint as visitas,
      coalesce((
        select count(*)
        from public.inscripciones i
        join public.tardeos t on t.id = i.tardeo_id
        where t.local_id = p_local and i.estado = 'apuntado'
      ), 0)::bigint as inscritos;
end;
$$;

grant execute on function public.metricas_de_local(uuid) to authenticated;
