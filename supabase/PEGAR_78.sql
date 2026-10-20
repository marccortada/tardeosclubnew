-- 78 · Seguridad: auditoría del 20-oct-2026
-- Idempotente. No borra datos.
--
-- 1) Reseñas: al crearlas, siempre «pendiente» (salvo admin). Antes la política
--    de alta solo miraba el autor y se podía insertar una reseña ya «aprobada»
--    (y con un moderador falso): salía publicada sin moderar y movía la nota.
-- 2) Tardeos: las columnas que mueven los avisos (versión de horario, cancelado,
--    avisado) solo las escribe el sistema. El dueño podía subir la versión y el
--    cron mandaba «ha cambiado la hora» a todos los apuntados cada 10 minutos.
-- 3) Emails y datos de cobro de las fichas: cualquier usuario con sesión podía
--    leer locales.email (61 locales) y las notas/referencias de cobro de locales
--    y DJs. Ahora esas columnas no se leen desde la API; las piden
--    datos_privados_locales / datos_privados_djs: email al dueño y al admin,
--    cobro solo al admin.
-- 4) Asistencia (lote 75): dar plaza en un tardeo cerrado, solo el admin.
-- 5) quienes_van: no enseña quién va a un tardeo que aún no ha salido
--    (programado sin publicar) ni de un local que no está activo.

-- 1) Reseñas --------------------------------------------------------------
create or replace function private.resena_nace_pendiente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  new.estado := 'pendiente';
  new.moderada_por := null;
  new.moderada_en := null;
  new.motivo_rechazo := null;
  new.apelacion := null;
  new.apelada_en := null;
  return new;
end $$;
revoke execute on function private.resena_nace_pendiente() from public, anon, authenticated;
-- «trg_a_…»: los BEFORE van por orden alfabético y este debe ir primero.
drop trigger if exists trg_a_resena_pendiente on public.resenas;
create trigger trg_a_resena_pendiente before insert on public.resenas
  for each row execute function private.resena_nace_pendiente();

-- 2) Tardeos: columnas del sistema ---------------------------------------
-- Va ANTES que trg_tardeo_marcar_cambios (orden alfabético: «trg_a_» < «trg_t»):
-- primero se deshace lo que mandó el navegador y luego marcar_cambios calcula lo
-- legítimo (cambio real de hora, paso a cancelado).
create or replace function private.tardeo_columnas_sistema()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.horario_version := 0;
    new.horario_cambiado_en := null;
    new.horario_anterior := null;
    new.cancelado_en := null;
    new.avisado_cancelacion_en := null;
  else
    new.horario_version := old.horario_version;
    new.horario_cambiado_en := old.horario_cambiado_en;
    new.horario_anterior := old.horario_anterior;
    new.cancelado_en := old.cancelado_en;
    new.avisado_cancelacion_en := old.avisado_cancelacion_en;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
revoke execute on function private.tardeo_columnas_sistema() from public, anon, authenticated;
drop trigger if exists trg_a_tardeo_columnas_sistema on public.tardeos;
create trigger trg_a_tardeo_columnas_sistema before insert or update on public.tardeos
  for each row execute function private.tardeo_columnas_sistema();

-- 3) Columnas privadas de locales y DJs ----------------------------------
-- locales: authenticated tenía permiso de TABLA (anon ya no, lote 14). Se quita
-- y se da columna a columna todo menos lo privado. Así una columna nueva no
-- queda abierta sin querer, pero hay que acordarse de darle su grant.
revoke select on public.locales from authenticated;
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ') into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'locales'
     and column_name not in ('email', 'plan_notas', 'pago_proveedor', 'pago_referencia');
  execute format('grant select (%s) on public.locales to authenticated', cols);
end $$;
-- djs ya va por columnas (lote 65): se quitan las privadas.
revoke select (contacto, plan_notas, pago_proveedor, pago_referencia) on public.djs from authenticated;

create or replace function private.datos_privados_locales(p_ids uuid[])
returns table(id uuid, email text, plan_notas text, pago_proveedor text, pago_referencia text)
language sql stable security definer set search_path = public as $$
  select l.id, l.email,
         case when public.is_admin() then l.plan_notas end,
         case when public.is_admin() then l.pago_proveedor end,
         case when public.is_admin() then l.pago_referencia end
    from public.locales l
   where l.id = any(p_ids)
     and (l.owner_id = (select auth.uid()) or (select public.is_admin()));
$$;
revoke execute on function private.datos_privados_locales(uuid[]) from public, anon;
grant execute on function private.datos_privados_locales(uuid[]) to authenticated, service_role;
create or replace function public.datos_privados_locales(p_ids uuid[])
returns table(id uuid, email text, plan_notas text, pago_proveedor text, pago_referencia text)
language sql stable security invoker set search_path = public
as $$ select * from private.datos_privados_locales($1) $$;
revoke execute on function public.datos_privados_locales(uuid[]) from public, anon;
grant execute on function public.datos_privados_locales(uuid[]) to authenticated, service_role;

-- En DJs, «email» es su campo de contacto.
create or replace function private.datos_privados_djs(p_ids uuid[])
returns table(id uuid, email text, plan_notas text, pago_proveedor text, pago_referencia text)
language sql stable security definer set search_path = public as $$
  select d.id, d.contacto,
         case when public.is_admin() then d.plan_notas end,
         case when public.is_admin() then d.pago_proveedor end,
         case when public.is_admin() then d.pago_referencia end
    from public.djs d
   where d.id = any(p_ids)
     and (d.profile_id = (select auth.uid()) or (select public.is_admin()));
$$;
revoke execute on function private.datos_privados_djs(uuid[]) from public, anon;
grant execute on function private.datos_privados_djs(uuid[]) to authenticated, service_role;
create or replace function public.datos_privados_djs(p_ids uuid[])
returns table(id uuid, email text, plan_notas text, pago_proveedor text, pago_referencia text)
language sql stable security invoker set search_path = public
as $$ select * from private.datos_privados_djs($1) $$;
revoke execute on function public.datos_privados_djs(uuid[]) from public, anon;
grant execute on function public.datos_privados_djs(uuid[]) to authenticated, service_role;

-- 4) Asistencia: dar plaza en un tardeo cerrado, solo admin ---------------
create or replace function private.admin_mover_inscripcion(p_inscripcion uuid, p_estado text)
returns void language plpgsql security definer set search_path = public as $$
declare i record; v_aforo int; v_conf int; v_otros int;
begin
  select ins.id, ins.estado, ins.tardeo_id, ins.profile_id, t.zona_slug, t.aforo into i
    from public.inscripciones ins join public.tardeos t on t.id = ins.tardeo_id where ins.id = p_inscripcion;
  if i.id is null then raise exception 'Inscripción no encontrada' using errcode = 'P0002'; end if;
  if not private.gestiona_asistencia(i.tardeo_id) then
    raise exception 'No puedes gestionar la asistencia de este tardeo' using errcode = '42501';
  end if;
  if p_estado not in ('apuntado', 'espera', 'cancelado') then
    raise exception 'Estado no válido: %', p_estado using errcode = '22023';
  end if;
  if i.estado = p_estado then return; end if;
  -- Dar plaza a un tardeo que ya terminó o ya no está a la venta (cancelado,
  -- oculto…) solo puede hacerlo el admin: el dueño podía inflar asistentes
  -- después de la fiesta y mandar «te han confirmado la plaza» de algo pasado.
  if p_estado = 'apuntado' and not public.is_admin()
     and private.tardeo_cerrado_motivo(i.tardeo_id) is not null then
    raise exception 'Este tardeo ya no admite cambios de plaza.' using errcode = 'P0001';
  end if;

  if p_estado = 'espera' then
    perform pg_advisory_xact_lock(hashtext(i.tardeo_id::text));
    v_aforo := i.aforo;
    if v_aforo is null then
      raise exception 'Este tardeo no tiene aforo: no hay lista de espera. Déjala confirmada o cancélala.' using errcode = 'P0001';
    end if;
    select count(*) filter (where estado = 'apuntado' and id <> p_inscripcion),
           count(*) filter (where estado = 'espera' and id <> p_inscripcion)
      into v_conf, v_otros
      from public.inscripciones where tardeo_id = i.tardeo_id;
    if v_conf + v_otros < v_aforo then
      raise exception 'Queda plaza libre (% confirmados de %): en espera volvería a subir sola. Déjala confirmada o cancélala.',
        v_conf, v_aforo using errcode = 'P0001';
    end if;
    update public.inscripciones set estado = 'espera', espera_desde = now() where id = p_inscripcion;
  else
    -- La marca de sistema solo salta el sello de espera y el bloqueo de
    -- "tardeo cerrado" (corregir a mano tras la fiesta). El AFORO se sigue
    -- respetando (lote 48): con el aforo lleno da «Aforo completo» y el panel
    -- explica que hay que subir el aforo o liberar una plaza.
    perform set_config('app.sistema_espera', 'on', true);
    update public.inscripciones set estado = p_estado where id = p_inscripcion;
    perform set_config('app.sistema_espera', 'off', true);
  end if;

  if p_estado = 'apuntado' then
    perform private.avisar_plaza(i.profile_id, i.tardeo_id, p_inscripcion,
      case when i.estado = 'espera' then null else 'El organizador te ha confirmado la plaza.' end);
  end if;
  perform private.auditar('mover_inscripcion', 'inscripcion', p_inscripcion::text,
    (select z.zona_madre from public.zonas z where z.slug = i.zona_slug),
    jsonb_build_object('de', i.estado, 'a', p_estado, 'tardeo', i.tardeo_id));
end $$;
revoke execute on function private.admin_mover_inscripcion(uuid, text) from public, anon;
grant execute on function private.admin_mover_inscripcion(uuid, text) to authenticated, service_role;


-- 5) Quién va: solo tardeos que el público ya puede ver -------------------
create or replace function private.quienes_van(p_tardeo uuid)
returns table(total integer, perfiles jsonb)
language sql stable security definer set search_path = public as $$
  with t as (
    select t.id from public.tardeos t
      join public.locales l on l.id = t.local_id and l.estado = 'activo'
     where t.id = p_tardeo
       and (t.estado in ('publicado', 'finalizado')
            or (t.estado = 'programado' and t.publicar_en is not null and t.publicar_en <= now()))
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
