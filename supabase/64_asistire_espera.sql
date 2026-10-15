-- =============================================================
-- TardeosClub · LOTE 64: ASISTIRÉ, LISTA DE ESPERA, POP-UPS VISTOS (equipo A)
-- =============================================================
-- Dossier 14‑oct, pág. 5: "Asistiré" confirma al momento si hay plaza; si la
-- lista está llena, se entra en ESPERA con estado diferenciado. Al liberarse
-- una plaza sube el primero de la espera y se le avisa (campana, lote 63).
--
--  1) inscripciones.estado admite 'espera' + espera_desde (orden de la cola).
--     'apuntado' sigue siendo "confirmado": el panel del local, el aforo
--     (lote 48) y las métricas ya cuentan con ese valor y no cambian.
--  2) public.asistire(tardeo): atómica (candado por tardeo, el MISMO que usa
--     el disparador de aforo del lote 48), sin duplicados (unique existente).
--  3) public.retirar_asistencia(tardeo).
--  4) Disparador: al dejar libre una plaza (cancelar, borrar) sube el primero
--     en espera y recibe un aviso. Va en disparador y no solo en la RPC para
--     que funcione igual si cancela el admin o el código antiguo.
--  5) public.mi_asistencia(tardeo): estado y puesto en la espera.
--  6) public.quienes_van(tardeo): nº de confirmados + hasta 8 alias/fotos.
--     Nunca email, teléfono ni id.
--  7) popups_vistos: "una vez por usuario y campaña" guardado en la base.
--  8) profiles.zonas / precio_max (ADN): ya los crea el lote 22; por si acaso.
--
-- Idempotente. No borra datos.
-- =============================================================

-- 1) Estado 'espera' --------------------------------------------------------
alter table public.inscripciones add column if not exists espera_desde timestamptz;

do $$
declare r record;
begin
  -- El check del lote 1 se llama solo (inscripciones_estado_check). Se cambia
  -- por uno con 'espera' solo si aún no lo admite.
  for r in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.inscripciones'::regclass and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%estado%'
      and pg_get_constraintdef(c.oid) not ilike '%espera%'
  loop
    execute format('alter table public.inscripciones drop constraint %I', r.conname);
  end loop;
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.inscripciones'::regclass and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%espera%'
  ) then
    alter table public.inscripciones add constraint inscripciones_estado_check
      check (estado in ('apuntado', 'cancelado', 'espera'));
  end if;
end $$;

create index if not exists idx_inscripciones_espera
  on public.inscripciones (tardeo_id, espera_desde, id) where estado = 'espera';
create index if not exists idx_fk_inscripciones_profile on public.inscripciones (profile_id);

-- El orden de la cola lo pone la base, no el navegador: sin esto alguien
-- podría escribirse 'espera' con una fecha antigua y colarse.
create or replace function public.inscripcion_sello_espera()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or coalesce(current_setting('app.sistema_espera', true), '') = 'on' then
    return new;
  end if;
  if new.estado = 'espera' then
    if tg_op = 'INSERT' or old.estado is distinct from 'espera' then
      new.espera_desde := now();
    else
      new.espera_desde := old.espera_desde;
    end if;
  elsif tg_op = 'UPDATE' then
    new.espera_desde := old.espera_desde;
  end if;
  return new;
end $$;
revoke execute on function public.inscripcion_sello_espera() from public, anon, authenticated;
drop trigger if exists trg_inscripcion_sello_espera on public.inscripciones;
create trigger trg_inscripcion_sello_espera
  before insert or update on public.inscripciones
  for each row execute function public.inscripcion_sello_espera();

-- 4) Promover al primero de la espera ----------------------------------------
create or replace function private.promover_espera(p_tardeo uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_aforo int; v_n int; v_sig record; v_titulo text;
begin
  perform pg_advisory_xact_lock(hashtext(p_tardeo::text));
  select t.aforo, t.titulo into v_aforo, v_titulo from public.tardeos t where t.id = p_tardeo;
  loop
    select count(*) into v_n from public.inscripciones
     where tardeo_id = p_tardeo and estado = 'apuntado';
    exit when v_aforo is not null and v_n >= v_aforo;
    select i.id, i.profile_id into v_sig from public.inscripciones i
     where i.tardeo_id = p_tardeo and i.estado = 'espera'
     order by i.espera_desde nulls last, i.created_at, i.id
     limit 1 for update;
    exit when not found;
    perform set_config('app.sistema_espera', 'on', true);
    update public.inscripciones set estado = 'apuntado' where id = v_sig.id;
    perform set_config('app.sistema_espera', 'off', true);
    perform private.crear_aviso(v_sig.profile_id, 'espera',
      'Ya tienes plaza: ' || coalesce(v_titulo, 'tu tardeo'),
      'Se ha liberado una plaza y has pasado de la lista de espera a confirmado.',
      '/tardeos/' || p_tardeo::text, 'espera:' || p_tardeo::text || ':' || v_sig.id::text);
  end loop;
end $$;
revoke execute on function private.promover_espera(uuid) from public, anon, authenticated;
grant execute on function private.promover_espera(uuid) to service_role;

create or replace function public.inscripcion_libera_plaza()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.estado = 'apuntado' then perform private.promover_espera(old.tardeo_id); end if;
    return old;
  end if;
  if old.estado = 'apuntado' and new.estado <> 'apuntado' then
    perform private.promover_espera(new.tardeo_id);
  end if;
  return new;
end $$;
revoke execute on function public.inscripcion_libera_plaza() from public, anon, authenticated;
drop trigger if exists trg_inscripcion_libera_plaza on public.inscripciones;
create trigger trg_inscripcion_libera_plaza
  after update of estado or delete on public.inscripciones
  for each row execute function public.inscripcion_libera_plaza();

-- Si el local SUBE el aforo, también hay plazas nuevas para la espera.
create or replace function public.tardeo_aforo_sube()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.aforo is distinct from old.aforo and (new.aforo is null or old.aforo is null or new.aforo > old.aforo) then
    perform private.promover_espera(new.id);
  end if;
  return new;
end $$;
revoke execute on function public.tardeo_aforo_sube() from public, anon, authenticated;
drop trigger if exists trg_tardeo_aforo_sube on public.tardeos;
create trigger trg_tardeo_aforo_sube
  after update of aforo on public.tardeos
  for each row execute function public.tardeo_aforo_sube();

-- 2) Asistiré -----------------------------------------------------------------
create or replace function private.asistire(p_tardeo uuid)
returns table (estado text, puesto int)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_aforo int; v_estado_t text; v_fecha date;
  v_actual text; v_n int; v_nuevo text;
begin
  if v_uid is null then raise exception 'Hace falta entrar en tu cuenta' using errcode = '42501'; end if;
  select t.aforo, t.estado, t.fecha into v_aforo, v_estado_t, v_fecha from public.tardeos t where t.id = p_tardeo;
  if not found or v_estado_t not in ('publicado', 'programado') then
    raise exception 'Este tardeo no está disponible' using errcode = 'P0002';
  end if;
  if v_fecha < (now() at time zone 'Europe/Madrid')::date then
    raise exception 'Este tardeo ya pasó' using errcode = 'P0001';
  end if;

  -- Mismo candado que el disparador de aforo: dos toques a la vez se ordenan.
  perform pg_advisory_xact_lock(hashtext(p_tardeo::text));

  select i.estado into v_actual from public.inscripciones i
   where i.tardeo_id = p_tardeo and i.profile_id = v_uid for update;

  if v_actual in ('apuntado', 'espera') then
    v_nuevo := v_actual;            -- doble toque: no se duplica ni se pierde el puesto
  else
    select count(*) into v_n from public.inscripciones i
     where i.tardeo_id = p_tardeo and i.estado = 'apuntado';
    -- Si ya hay gente esperando, la plaza es suya antes que de quien llega.
    if v_aforo is null or (v_n < v_aforo and not exists (
         select 1 from public.inscripciones i where i.tardeo_id = p_tardeo and i.estado = 'espera')) then
      v_nuevo := 'apuntado';
    else
      v_nuevo := 'espera';
    end if;
    insert into public.inscripciones (tardeo_id, profile_id, estado)
    values (p_tardeo, v_uid, v_nuevo)
    on conflict (tardeo_id, profile_id) do update set estado = excluded.estado;
  end if;

  return query select m.estado, m.puesto from private.mi_asistencia(p_tardeo) m;
end $$;

-- 5) Mi asistencia ------------------------------------------------------------
create or replace function private.mi_asistencia(p_tardeo uuid)
returns table (estado text, puesto int)
language sql stable security definer set search_path = public as $$
  select i.estado,
         case when i.estado = 'espera' then (
           select count(*)::int from public.inscripciones e
            where e.tardeo_id = i.tardeo_id and e.estado = 'espera'
              and (coalesce(e.espera_desde, e.created_at), e.id) <= (coalesce(i.espera_desde, i.created_at), i.id))
         end
  from public.inscripciones i
  where i.tardeo_id = p_tardeo and i.profile_id = auth.uid();
$$;
revoke execute on function private.mi_asistencia(uuid) from public, anon;
grant execute on function private.mi_asistencia(uuid) to authenticated, service_role;
create or replace function public.mi_asistencia(p_tardeo uuid)
returns table (estado text, puesto int)
language sql stable security invoker set search_path = public
as $$ select * from private.mi_asistencia($1) $$;
revoke execute on function public.mi_asistencia(uuid) from public, anon;
grant execute on function public.mi_asistencia(uuid) to authenticated, service_role;

revoke execute on function private.asistire(uuid) from public, anon;
grant execute on function private.asistire(uuid) to authenticated, service_role;
create or replace function public.asistire(p_tardeo uuid)
returns table (estado text, puesto int)
language sql volatile security invoker set search_path = public
as $$ select * from private.asistire($1) $$;
revoke execute on function public.asistire(uuid) from public, anon;
grant execute on function public.asistire(uuid) to authenticated, service_role;

-- 3) Retirar ----------------------------------------------------------------
create or replace function private.retirar_asistencia(p_tardeo uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar en tu cuenta' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext(p_tardeo::text));
  update public.inscripciones set estado = 'cancelado'
   where tardeo_id = p_tardeo and profile_id = auth.uid() and estado in ('apuntado', 'espera')
   returning id into v_id;
  -- La promoción de la espera la hace el disparador del punto 4.
  return v_id is not null;
end $$;
revoke execute on function private.retirar_asistencia(uuid) from public, anon;
grant execute on function private.retirar_asistencia(uuid) to authenticated, service_role;
create or replace function public.retirar_asistencia(p_tardeo uuid)
returns boolean language sql volatile security invoker set search_path = public
as $$ select private.retirar_asistencia($1) $$;
revoke execute on function public.retirar_asistencia(uuid) from public, anon;
grant execute on function public.retirar_asistencia(uuid) to authenticated, service_role;

-- 6) Quiénes van ----------------------------------------------------------------
-- Solo de tardeos visibles y solo alias + foto (perfil_publico del lote 63).
create or replace function private.quienes_van(p_tardeo uuid)
returns table (total int, perfiles jsonb)
language sql stable security definer set search_path = public as $$
  with t as (
    select id from public.tardeos
     where id = p_tardeo and estado in ('publicado', 'programado', 'finalizado')
  ), conf as (
    select i.profile_id, i.created_at from public.inscripciones i join t on t.id = i.tardeo_id
     where i.estado = 'apuntado'
  )
  select (select count(*)::int from conf),
         coalesce((
           select jsonb_agg(jsonb_build_object('alias', pp.alias, 'avatar_url', pp.avatar_url))
           from (select c.profile_id from conf c order by c.created_at limit 8) x
           join private.perfil_publico(array[x.profile_id]) pp on true
         ), '[]'::jsonb);
$$;
revoke execute on function private.quienes_van(uuid) from public;
grant execute on function private.quienes_van(uuid) to anon, authenticated, service_role;
create or replace function public.quienes_van(p_tardeo uuid)
returns table (total int, perfiles jsonb)
language sql stable security invoker set search_path = public
as $$ select * from private.quienes_van($1) $$;
grant execute on function public.quienes_van(uuid) to anon, authenticated, service_role;

-- 7) Pop-ups vistos -------------------------------------------------------------
create table if not exists public.popups_vistos (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  popup_id uuid not null references public.popups(id) on delete cascade,
  visto_en timestamptz not null default now(),
  primary key (profile_id, popup_id)
);
create index if not exists idx_fk_popups_vistos_popup on public.popups_vistos (popup_id);
alter table public.popups_vistos enable row level security;
grant select, insert on public.popups_vistos to authenticated;
drop policy if exists "popups_vistos_select" on public.popups_vistos;
create policy "popups_vistos_select" on public.popups_vistos for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "popups_vistos_insert" on public.popups_vistos;
create policy "popups_vistos_insert" on public.popups_vistos for insert to authenticated
  with check (profile_id = (select auth.uid()));

-- 8) ADN: zona y presupuesto (lote 22 ya los crea) --------------------------------
alter table public.profiles add column if not exists zonas text[];
alter table public.profiles add column if not exists precio_max text;

notify pgrst, 'reload schema';
