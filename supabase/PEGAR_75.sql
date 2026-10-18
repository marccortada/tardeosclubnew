-- 75 · Gestión de la asistencia desde la ficha del tardeo (18-oct-2026)
-- Idempotente: se puede pegar dos veces.
--
-- Por qué: hasta ahora solo un admin (desde /admin/registro, sin filtro por
-- tardeo) podía dar plaza a alguien de la lista de espera, pasarlo a espera o
-- cancelarle. El local veía su lista de espera en solo lectura y no podía hacer
-- nada aunque fuera su fiesta. Ahora:
--   1) Quien gestiona un tardeo = admin de su zona O dueño de su local.
--   2) Mover y promover usan esa regla (mismas protecciones del lote 73).
--   3) Marcar asistencia también respeta la zona del admin (antes, cualquier admin).
--   4) lista_de_tardeo(): la lista completa para la ficha, con puesto en la
--      espera y el email solo para admins (el local ve nombres, como hasta ahora).

-- 1) ¿Puede esta persona gestionar la asistencia de este tardeo? -----------
-- OJO: NO se llama gestiona_tardeo: esa ya existe (lote 55, «cualquier admin o
-- dueño») y la usan las políticas de invitaciones y solicitudes de DJs. Esta es
-- más estricta con el admin (solo su zona) y no debe cambiar aquéllas.
create or replace function private.gestiona_asistencia(p_tardeo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tardeos t
     where t.id = p_tardeo
       and (private.admin_de_slug(t.zona_slug)
            or exists (select 1 from public.locales l where l.id = t.local_id and l.owner_id = (select auth.uid())))
  );
$$;
revoke execute on function private.gestiona_asistencia(uuid) from public, anon;
grant execute on function private.gestiona_asistencia(uuid) to authenticated, service_role;

-- 2a) Mover una inscripción (apuntado / espera / cancelado) -------------------
-- Igual que el lote 73 salvo el permiso: admin de la zona o dueño del local.
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

-- 2b) Dar plaza al primero de la espera ---------------------------------------
create or replace function private.admin_promover_espera(p_tardeo uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_prof uuid; v_zona text;
begin
  select zona_slug into v_zona from public.tardeos where id = p_tardeo;
  if not found then raise exception 'Tardeo no encontrado' using errcode = 'P0002'; end if;
  if not private.gestiona_asistencia(p_tardeo) then
    raise exception 'No puedes gestionar la asistencia de este tardeo' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_tardeo::text));
  -- Con el aforo lleno no hay a dónde subir a nadie: mensaje claro en vez del
  -- «Aforo completo» del disparador.
  if exists (select 1 from public.tardeos t where t.id = p_tardeo and t.aforo is not null
               and (select count(*) from public.inscripciones i where i.tardeo_id = p_tardeo and i.estado = 'apuntado') >= t.aforo) then
    raise exception 'No queda plaza libre: sube el aforo o cancela a alguien para dar plaza al siguiente.' using errcode = 'P0001';
  end if;
  select id, profile_id into v_id, v_prof from public.inscripciones
   where tardeo_id = p_tardeo and estado = 'espera'
   order by espera_desde nulls last, created_at, id limit 1 for update;
  if v_id is null then return null; end if;
  perform set_config('app.sistema_espera', 'on', true);
  update public.inscripciones set estado = 'apuntado' where id = v_id;
  perform set_config('app.sistema_espera', 'off', true);
  perform private.avisar_plaza(v_prof, p_tardeo, v_id);
  perform private.auditar('promover_espera', 'inscripcion', v_id::text,
    (select z.zona_madre from public.zonas z where z.slug = v_zona), jsonb_build_object('tardeo', p_tardeo));
  return v_id;
end $$;
revoke execute on function private.admin_promover_espera(uuid) from public, anon;
grant execute on function private.admin_promover_espera(uuid) to authenticated, service_role;

-- 3) Marcar asistencia: el admin, solo de su zona -----------------------------
create or replace function private.marcar_asistencia(p_inscripcion uuid, p_asistencia text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tardeo uuid;
begin
  if p_asistencia not in ('pendiente', 'asistio', 'no_asistio') then
    raise exception 'Valor no válido: %', p_asistencia using errcode = '22023';
  end if;
  select i.tardeo_id into v_tardeo from public.inscripciones i where i.id = p_inscripcion;
  if v_tardeo is null then raise exception 'Inscripción no encontrada' using errcode = 'P0002'; end if;
  if not private.gestiona_asistencia(v_tardeo) then
    raise exception 'No tienes permiso sobre este tardeo' using errcode = '42501';
  end if;
  perform set_config('app.marca_asistencia', 'on', true);
  update public.inscripciones
     set asistencia = p_asistencia,
         asistencia_en = case when p_asistencia = 'pendiente' then null else now() end
   where id = p_inscripcion;
  perform set_config('app.marca_asistencia', 'off', true);
end $$;
revoke execute on function private.marcar_asistencia(uuid, text) from public, anon;
grant execute on function private.marcar_asistencia(uuid, text) to authenticated, service_role;

-- 4) Lista completa de un tardeo para su ficha --------------------------------
-- Una sola llamada con todo lo que pinta la pantalla (antes eran dos lecturas y
-- el puesto en la espera se calculaba en el navegador).
create or replace function private.lista_de_tardeo(p_tardeo uuid)
returns table(inscripcion_id uuid, nombre text, email text, estado text, asistencia text,
              apuntado_en timestamptz, espera_desde timestamptz, puesto int)
language plpgsql stable security definer set search_path = public as $$
declare v_admin boolean;
begin
  if not private.gestiona_asistencia(p_tardeo) then return; end if;
  v_admin := public.is_admin();
  return query
    select i.id,
           coalesce(nullif(p.display_name, ''), 'Tardícola'),
           case when v_admin then p.email else null end,
           i.estado, i.asistencia, i.created_at, i.espera_desde,
           case when i.estado = 'espera'
                then (row_number() over (partition by i.estado order by i.espera_desde nulls last, i.created_at, i.id))::int
                end
      from public.inscripciones i
      left join public.profiles p on p.id = i.profile_id
     where i.tardeo_id = p_tardeo
     order by case i.estado when 'apuntado' then 0 when 'espera' then 1 else 2 end,
              i.espera_desde nulls last, i.created_at;
end $$;
revoke execute on function private.lista_de_tardeo(uuid) from public, anon;
grant execute on function private.lista_de_tardeo(uuid) to authenticated, service_role;

create or replace function public.lista_de_tardeo(p_tardeo uuid)
returns table(inscripcion_id uuid, nombre text, email text, estado text, asistencia text,
              apuntado_en timestamptz, espera_desde timestamptz, puesto int)
language sql stable security invoker set search_path = public
as $$ select * from private.lista_de_tardeo($1) $$;
revoke execute on function public.lista_de_tardeo(uuid) from public, anon;
grant execute on function public.lista_de_tardeo(uuid) to authenticated, service_role;
