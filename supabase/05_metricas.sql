-- ============================================================
-- LOTE 5 · Métricas de tardeos (visitas + inscritos)
-- Aplica esto en el SQL Editor de Supabase.
-- ============================================================

-- Contador de visitas por tardeo
create table if not exists public.metricas_tardeo (
  tardeo_id uuid primary key references public.tardeos(id) on delete cascade,
  visitas bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.metricas_tardeo enable row level security;

-- El dueño del local puede LEER las métricas de sus tardeos
drop policy if exists "owner ve metricas" on public.metricas_tardeo;
create policy "owner ve metricas" on public.metricas_tardeo
for select using (
  exists (
    select 1
    from public.tardeos t
    join public.locales l on l.id = t.local_id
    where t.id = metricas_tardeo.tardeo_id
      and l.owner_id = auth.uid()
  )
);

-- Registrar una visita (cualquiera, incluso anónimo). SECURITY DEFINER.
create or replace function public.incrementar_visita(p_tardeo uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.metricas_tardeo (tardeo_id, visitas)
  values (p_tardeo, 1)
  on conflict (tardeo_id)
  do update set visitas = public.metricas_tardeo.visitas + 1,
                updated_at = now();
end;
$$;

grant execute on function public.incrementar_visita(uuid) to anon, authenticated;

-- Métricas agregadas de un local (solo su dueño). Visitas totales + inscritos activos.
create or replace function public.metricas_de_local(p_local uuid)
returns table(visitas bigint, inscritos bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.locales l
    where l.id = p_local and l.owner_id = auth.uid()
  ) then
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
