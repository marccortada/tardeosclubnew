-- ============================================================
-- LOTE 8 · El local puede ver QUIÉN se ha apuntado a sus tardeos
-- (con nombre). Solo el dueño del local. SECURITY DEFINER.
-- ============================================================

create or replace function public.inscritos_de_local(p_local uuid)
returns table(tardeo_id uuid, tardeo_titulo text, fecha date, nombre text, apuntado_en timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.locales l
    where l.id = p_local and l.owner_id = auth.uid()
  ) then
    return; -- vacío si no eres el dueño
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
