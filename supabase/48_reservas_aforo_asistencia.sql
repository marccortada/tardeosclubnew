-- =========================================================
-- TardeosClub · LOTE 48: RESERVAS CON AFORO Y ASISTENCIA
-- Aplicar a mano en Supabase → SQL Editor. Es seguro repetirlo.
--
-- La web antigua tenía "Reservas": aforo por evento, registro de asistencias
-- (asistió / no se presentó) y exportación. En la nueva ya existe
-- `inscripciones` (apuntarse a un tardeo gratis). Este lote la completa SIN
-- crear un sistema nuevo:
--   · tardeos.aforo               plazas (vacío = sin límite)
--   · inscripciones.asistencia    pendiente | asistio | no_asistio
--   · el aforo se respeta EN LA BASE, no solo en pantalla (dos personas
--     pulsando a la vez no pueden pasarse)
--   · el local (o el admin) marca la asistencia con una función, y solo eso:
--     no puede tocar a quién pertenece la inscripción ni su estado
--
-- Nada de esto toca pagos, planes ni precios.
-- =========================================================

-- 1) Columnas ---------------------------------------------------------------
alter table public.tardeos
  add column if not exists aforo integer check (aforo is null or aforo > 0);

alter table public.inscripciones
  add column if not exists asistencia text not null default 'pendiente'
    check (asistencia in ('pendiente', 'asistio', 'no_asistio')),
  add column if not exists asistencia_en timestamptz;

grant select (aforo) on public.tardeos to anon, authenticated;

-- 2) El aforo se respeta en la base ----------------------------------------
-- Se comprueba al apuntarse (insert) y al volver a apuntarse tras cancelar
-- (update de cancelado -> apuntado). El candado por tardeo evita que dos
-- peticiones simultáneas lean el mismo recuento y se cuelen las dos.
create or replace function public.inscripcion_respeta_aforo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aforo integer;
  v_n     integer;
begin
  if new.estado <> 'apuntado' then return new; end if;
  if tg_op = 'UPDATE' and old.estado = 'apuntado' and new.tardeo_id = old.tardeo_id then return new; end if;

  select t.aforo into v_aforo from public.tardeos t where t.id = new.tardeo_id;
  if v_aforo is null then return new; end if;

  perform pg_advisory_xact_lock(hashtext(new.tardeo_id::text));

  select count(*) into v_n
  from public.inscripciones i
  where i.tardeo_id = new.tardeo_id
    and i.estado = 'apuntado'
    and i.id is distinct from new.id;

  if v_n >= v_aforo then
    raise exception 'Aforo completo' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inscripcion_aforo on public.inscripciones;
create trigger trg_inscripcion_aforo
  before insert or update of estado, tardeo_id on public.inscripciones
  for each row execute function public.inscripcion_respeta_aforo();

-- 2b) Una inscripción no se "muda" ------------------------------------------
-- La política de update (lote 1) deja tocar la propia fila sin restringir
-- columnas: sin esto, alguien podía apuntarse a un tardeo con plazas y luego
-- cambiar el tardeo_id a uno lleno (o a un borrador). Solo el admin puede
-- cambiar a qué tardeo o a quién pertenece una inscripción.
create or replace function public.inscripcion_inmutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then return new; end if;
  if new.tardeo_id is distinct from old.tardeo_id or new.profile_id is distinct from old.profile_id then
    raise exception 'No se puede cambiar el tardeo ni la persona de una inscripción' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inscripcion_inmutable on public.inscripciones;
create trigger trg_inscripcion_inmutable
  before update of tardeo_id, profile_id on public.inscripciones
  for each row execute function public.inscripcion_inmutable();

-- 3) Quien se apunta NO puede marcarse su propia asistencia ------------------
create or replace function public.proteger_asistencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.asistencia    := 'pendiente';
    new.asistencia_en := null;
  else
    new.asistencia    := old.asistencia;
    new.asistencia_en := old.asistencia_en;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_asistencia on public.inscripciones;
create trigger trg_proteger_asistencia
  before insert or update on public.inscripciones
  for each row execute function public.proteger_asistencia();

-- 4) Plazas de un tardeo (público: el recuento no es dato personal) ---------
create or replace function public.plazas_de_tardeo(p_tardeo uuid)
returns table(aforo integer, apuntados integer, libres integer)
language sql
stable
security definer
set search_path = public
as $$
  select t.aforo,
         (select count(*)::int from public.inscripciones i
           where i.tardeo_id = t.id and i.estado = 'apuntado'),
         case when t.aforo is null then null
              else greatest(t.aforo - (select count(*)::int from public.inscripciones i
                                        where i.tardeo_id = t.id and i.estado = 'apuntado'), 0) end
  from public.tardeos t
  where t.id = p_tardeo;
$$;

revoke all on function public.plazas_de_tardeo(uuid) from public;
grant execute on function public.plazas_de_tardeo(uuid) to anon, authenticated;

-- 5) Quién se ha apuntado a un tardeo (solo su local o un admin) ------------
create or replace function public.inscritos_de_tardeo(p_tardeo uuid)
returns table(
  inscripcion_id uuid, nombre text, estado text,
  asistencia text, apuntado_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or exists (
        select 1 from public.tardeos t
        where t.id = p_tardeo and public.owns_tardeo(t.local_id))) then
    return;
  end if;

  return query
    select i.id, coalesce(p.display_name, 'Tardícola'), i.estado,
           i.asistencia, i.created_at
    from public.inscripciones i
    left join public.profiles p on p.id = i.profile_id
    where i.tardeo_id = p_tardeo
    order by i.estado, i.created_at;
end;
$$;

revoke all on function public.inscritos_de_tardeo(uuid) from public, anon;
grant execute on function public.inscritos_de_tardeo(uuid) to authenticated;

-- 6) Marcar asistencia (solo el local del tardeo o un admin) ----------------
create or replace function public.marcar_asistencia(p_inscripcion uuid, p_asistencia text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tardeo uuid;
begin
  if p_asistencia not in ('pendiente', 'asistio', 'no_asistio') then
    raise exception 'Valor no válido: %', p_asistencia using errcode = '22023';
  end if;

  select i.tardeo_id into v_tardeo from public.inscripciones i where i.id = p_inscripcion;
  if v_tardeo is null then
    raise exception 'Inscripción no encontrada' using errcode = 'P0002';
  end if;

  if not (public.is_admin() or exists (
        select 1 from public.tardeos t
        where t.id = v_tardeo and public.owns_tardeo(t.local_id))) then
    raise exception 'No tienes permiso sobre este tardeo' using errcode = '42501';
  end if;

  -- El trigger proteger_asistencia deja pasar solo a admins; aquí marcamos
  -- con la marca de "escritura del sistema" que ya usa el lote 9.
  perform set_config('app.marca_asistencia', 'on', true);
  update public.inscripciones
     set asistencia = p_asistencia,
         asistencia_en = case when p_asistencia = 'pendiente' then null else now() end
   where id = p_inscripcion;
  perform set_config('app.marca_asistencia', 'off', true);
end;
$$;

revoke all on function public.marcar_asistencia(uuid, text) from public, anon;
grant execute on function public.marcar_asistencia(uuid, text) to authenticated;

-- El trigger del punto 3 debe dejar pasar esa marca (y solo esa).
create or replace function public.proteger_asistencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then return new; end if;
  if coalesce(current_setting('app.marca_asistencia', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.asistencia    := 'pendiente';
    new.asistencia_en := null;
  else
    new.asistencia    := old.asistencia;
    new.asistencia_en := old.asistencia_en;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';

-- =========================================================
-- COMPROBACIONES (descomenta y ejecuta una a una)
-- =========================================================
-- select column_name from information_schema.columns
--  where table_name in ('tardeos','inscripciones') and column_name in ('aforo','asistencia','asistencia_en');   -- 3 filas
-- select * from public.plazas_de_tardeo((select id from public.tardeos limit 1));
