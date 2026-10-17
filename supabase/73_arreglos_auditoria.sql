-- =============================================================
-- TardeosClub · LOTE 73: ARREGLOS DE LA AUDITORÍA (17‑oct‑2026)
-- =============================================================
-- Fallos de lógica y de seguridad encontrados al revisar los lotes 63‑72.
-- Cada función se redefine A PARTIR DE SU VERSIÓN VIGENTE (misma firma, mismos
-- permisos, mismo comportamiento) y solo cambia lo que dice su comentario.
--
--  1) Sorteo al azar sin pgcrypto (en Supabase vive en `extensions` y con
--     search_path = public fallaba SIEMPRE).
--  2) tardeos_select: el público ve también cancelados y finalizados (+ S3:
--     solo de locales activos).
--  3) Programado ya visible = publicado a efectos de avisos de cambio de hora.
--  4) Asistiré / encuesta: nada de apuntarse a tardeos no visibles o ya
--     terminados (ni por RPC ni por la API directa).
--  5) admin_mover_inscripcion a 'espera' sin rebote instantáneo.
--  6) admin_asignar_rol: nadie se asigna un rol a sí mismo (+ S1: busca en
--     auth.users con email confirmado).
--  7) promover_espera: no sube a nadie en tardeos cerrados; el aviso «Ya tienes
--     plaza» puede repetirse; también al promover o mover a mano.
--  8) Desbloquear a alguien no le deja 30 días sin poder escribir.
--  9) cola_trabajo: enlace correcto y total aunque la página salga vacía.
-- 10) Meet Zone cierra con la misma regla de fin que la encuesta.
-- 11) Filtro de teléfonos/emails: más formatos, sin bloquear fechas y horas.
-- 12) nexo_sesiones: sin sets ocultos; plataforma según la URL del envío.
-- S1) profiles.email no se cambia por API; se sincroniza desde auth.users.
-- S3) es_profesional(): local ACTIVO o DJ no oculto.
-- S4) Métricas: solo por medir_evento() y con longitudes acotadas.
-- S5) Bucket `flyers`: tamaño, tipos y escritura solo del dueño o admin.
-- S7) djs.oculto solo lo cambia el admin; comentario ocultado por el equipo no
--     lo reabre el dueño del set.
-- S8) djs: columnas de cobro y contacto fuera de anon.
-- S9) tardeos: enlaces de entradas/promo solo http(s).
-- S11) Incidencias anónimas sin `borrador`.
-- S13) canjear_promocion: máximo 10 códigos fallidos por hora y promoción.
--
-- Idempotente (se puede pegar dos veces). No borra datos.
-- ORDEN: pegar ANTES de desplegar el código que dependa de él (ver informe).
-- =============================================================

create schema if not exists private;

-- -----------------------------------------------------------------
-- 0) Pieza común: ¿admite asistencia este tardeo?
-- -----------------------------------------------------------------
-- Una sola regla para asistire(), el disparador de inscripciones y
-- promover_espera(): si estuviera en tres sitios, el día que cambie quedaría
-- alguno sin actualizar. Devuelve null si se puede, o el motivo:
--   'no_existe' | 'no_disponible' (borrador, cancelado, finalizado, programado
--   aún sin salir o local no activo) | 'terminado' (ya pasó su fin).
-- "Visible" es lo mismo que ve el público por la política tardeos_select.
create or replace function private.tardeo_cerrado_motivo(p_tardeo uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when t.id is null then 'no_existe'
    when not (t.estado = 'publicado'
              or (t.estado = 'programado' and t.publicar_en is not null and t.publicar_en <= now()))
      or not exists (select 1 from public.locales l where l.id = t.local_id and l.estado = 'activo')
      then 'no_disponible'
    when now() >= public.tardeo_fin(t.fecha, t.hora_inicio, t.hora_fin) then 'terminado'
  end
  from (select 1) x left join public.tardeos t on t.id = p_tardeo;
$$;
revoke execute on function private.tardeo_cerrado_motivo(uuid) from public, anon, authenticated;
grant execute on function private.tardeo_cerrado_motivo(uuid) to service_role;

-- Aviso «Ya tienes plaza». La clave lleva un sello de tiempo: la clave única
-- (profile_id, clave) de avisos hacía que, si alguien volvía a subir de la
-- espera (bajó, se cayó otro, volvió a subir), el segundo aviso se perdiera.
create or replace function private.avisar_plaza(p_profile uuid, p_tardeo uuid, p_insc uuid, p_cuerpo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_titulo text;
begin
  select titulo into v_titulo from public.tardeos where id = p_tardeo;
  perform private.crear_aviso(p_profile, 'espera',
    'Ya tienes plaza: ' || coalesce(v_titulo, 'tu tardeo'),
    coalesce(p_cuerpo, 'Se ha liberado una plaza y has pasado de la lista de espera a confirmado.'),
    '/tardeos/' || p_tardeo::text,
    'espera:' || p_tardeo::text || ':' || p_insc::text || ':'
      || floor(extract(epoch from clock_timestamp()) * 1000000)::bigint::text);
end $$;
revoke execute on function private.avisar_plaza(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.avisar_plaza(uuid, uuid, uuid, text) to service_role;

-- -----------------------------------------------------------------
-- 1) Sorteo al azar sin pgcrypto
-- -----------------------------------------------------------------
-- gen_random_bytes() es de pgcrypto, que en Supabase está en el esquema
-- `extensions`: con search_path = public no se encuentra y elegir al azar
-- fallaba siempre. md5() es del núcleo de Postgres. La semilla solo tiene que
-- ser imprevisible al elegir y quedar guardada para repetir el cálculo; cómo se
-- usa (md5(semilla || perfil)) no cambia.
create or replace function private.elegir_ganador_sorteo(p_sorteo uuid, p_ganador uuid, p_semilla text)
returns uuid language plpgsql security definer set search_path = public as $$
declare s record; v_g uuid; v_sem text;
begin
  if not public.is_admin() then raise exception 'Solo un administrador.' using errcode = '42501'; end if;
  select id, estado, cierra, zona_madre into s from public.sorteos where id = p_sorteo for update;
  if s.id is null then raise exception 'Ese sorteo no existe.' using errcode = 'P0001'; end if;
  if s.estado = 'resuelto' then raise exception 'El ganador ya está publicado.' using errcode = 'P0001'; end if;
  if s.estado = 'borrador' then raise exception 'El sorteo aún es un borrador.' using errcode = 'P0001'; end if;
  if now() <= s.cierra and s.estado <> 'cerrado' then
    raise exception 'El sorteo sigue abierto: ciérralo o espera a la fecha de cierre.' using errcode = 'P0001';
  end if;
  if p_ganador is not null then
    if not exists (select 1 from public.sorteo_participaciones where sorteo_id = p_sorteo and profile_id = p_ganador) then
      raise exception 'Esa persona no participa en el sorteo.' using errcode = 'P0001';
    end if;
    v_g := p_ganador;
  else
    v_sem := coalesce(nullif(btrim(p_semilla), ''),
                      left(md5(random()::text || clock_timestamp()::text || p_sorteo::text || coalesce(auth.uid()::text, '')), 16));
    select profile_id into v_g from public.sorteo_participaciones
     where sorteo_id = p_sorteo order by md5(v_sem || profile_id::text), profile_id limit 1;
    if v_g is null then raise exception 'No hay participantes.' using errcode = 'P0001'; end if;
  end if;
  update public.sorteos set ganador_id = v_g, metodo = case when p_ganador is null then 'azar' else 'manual' end,
         semilla = v_sem, elegido_en = now(), estado = 'cerrado'
   where id = p_sorteo;
  perform private.auditar('elegir_ganador', 'sorteo', p_sorteo::text, s.zona_madre,
    jsonb_build_object('ganador', v_g, 'metodo', case when p_ganador is null then 'azar' else 'manual' end, 'semilla', v_sem,
                       'participantes', (select count(*) from public.sorteo_participaciones where sorteo_id = p_sorteo)));
  return v_g;
end $$;
revoke execute on function private.elegir_ganador_sorteo(uuid, uuid, text) from public, anon;
grant execute on function private.elegir_ganador_sorteo(uuid, uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------
-- 2 + S3) Quién ve un tardeo
-- -----------------------------------------------------------------
-- Antes el público solo veía 'publicado' y el programado ya vencido: la ficha
-- de un tardeo cancelado («Este tardeo se ha cancelado») daba 404 y en Próxima
-- Parada desaparecían los cancelados y los pasados. Ahora también se ven
-- 'cancelado' y 'finalizado'. Los borradores y los programados que aún no han
-- salido siguen siendo solo del dueño y del equipo.
-- S3: y solo si el local está ACTIVO. lib/tardeos.ts ya escondía en la web los
-- tardeos de locales sin aprobar (conLocalVisible), pero por la API se leían
-- igual. El dueño y el admin los ven siempre.
drop policy if exists "tardeos_select" on public.tardeos;
create policy "tardeos_select" on public.tardeos
  for select using (
    ((estado in ('publicado', 'cancelado', 'finalizado')
      or (estado = 'programado' and publicar_en is not null and publicar_en <= now()))
     and exists (select 1 from public.locales l where l.id = tardeos.local_id and l.estado = 'activo'))
    or public.owns_tardeo(local_id)
    or (select public.is_admin())
  );

-- S3) ¿Es profesional? Antes bastaba con CUALQUIER fila en locales (también un
-- borrador que nadie ha aprobado) o en djs. Ahora: admin, dueño de un local
-- ACTIVO (lo aprueba el equipo en «Por revisar») o DJ con ficha NO oculta. Los
-- DJs no pasan por aprobación en el código (su ficha sale pública al crearla y
-- `verificado` es solo la insignia), así que exigir `verificado` dejaría fuera
-- a todos los DJs nuevos sin una pantalla donde aprobarlos; `oculto` es la
-- palanca que tiene el equipo para retirar a un DJ (y desde este lote solo la
-- mueve el admin, ver S7).
create or replace function private.es_profesional()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
      or exists (select 1 from public.locales where owner_id = auth.uid() and estado = 'activo')
      or exists (select 1 from public.djs where profile_id = auth.uid() and not oculto);
$$;
revoke execute on function private.es_profesional() from public;
grant execute on function private.es_profesional() to anon, authenticated, service_role;

-- -----------------------------------------------------------------
-- 3) Cambios de horario en programados ya visibles
-- -----------------------------------------------------------------
-- Un 'programado' cuya hora de publicar ya pasó se ve y admite «Asistiré»
-- igual que un 'publicado' (su estado no cambia nunca solo). Si mueve la hora,
-- quien ya tiene plan tiene que enterarse igual. El cron (/api/avisos) ya
-- trata así a los programados; faltaba este disparador.
create or replace function public.tardeo_marcar_cambios()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_viejo_visible boolean; v_nuevo_visible boolean;
begin
  v_viejo_visible := old.estado = 'publicado'
    or (old.estado = 'programado' and old.publicar_en is not null and old.publicar_en <= now());
  v_nuevo_visible := new.estado = 'publicado'
    or (new.estado = 'programado' and new.publicar_en is not null and new.publicar_en <= now());
  -- Solo cuenta como "cambio" lo que afecta a quien ya tiene plan: un tardeo
  -- visible que mueve fecha u hora. Retocar un borrador no avisa a nadie.
  if v_viejo_visible and v_nuevo_visible
     and (new.fecha is distinct from old.fecha
          or new.hora_inicio is distinct from old.hora_inicio
          or new.hora_fin is distinct from old.hora_fin) then
    new.horario_version := coalesce(old.horario_version, 0) + 1;
    new.horario_cambiado_en := now();
    new.horario_anterior := jsonb_build_object('fecha', old.fecha, 'hora_inicio', old.hora_inicio, 'hora_fin', old.hora_fin);
  end if;
  if new.estado = 'cancelado' and old.estado is distinct from 'cancelado' then
    new.cancelado_en := now();
  end if;
  return new;
end $$;
revoke execute on function public.tardeo_marcar_cambios() from public, anon, authenticated;

-- -----------------------------------------------------------------
-- 4) Asistiré, encuesta y el disparador de inscripciones
-- -----------------------------------------------------------------
-- asistire(): antes admitía 'programado' aún sin salir y un tardeo de hoy ya
-- terminado (solo miraba la fecha). Ahora usa la regla común de arriba.
create or replace function private.asistire(p_tardeo uuid)
returns table (estado text, puesto int)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_aforo int; v_motivo text;
  v_actual text; v_n int; v_nuevo text;
begin
  if v_uid is null then raise exception 'Hace falta entrar en tu cuenta' using errcode = '42501'; end if;
  v_motivo := private.tardeo_cerrado_motivo(p_tardeo);
  if v_motivo in ('no_existe', 'no_disponible') then
    raise exception 'Este tardeo no está disponible' using errcode = 'P0002';
  end if;
  if v_motivo = 'terminado' then
    raise exception 'Este tardeo ya ha terminado' using errcode = 'P0001';
  end if;
  select t.aforo into v_aforo from public.tardeos t where t.id = p_tardeo;

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
revoke execute on function private.asistire(uuid) from public, anon;
grant execute on function private.asistire(uuid) to authenticated, service_role;

-- Las políticas inscr_insert / inscr_update dejan escribir la propia fila por
-- la API (el código antiguo se apunta con un upsert). Sin esto, cualquiera
-- podía ponerse 'apuntado' en un tardeo ya terminado o en un borrador y pasar
-- el filtro «solo confirmados» de la encuesta y de la Meet Zone.
-- Se salta para el admin / service role y para las funciones de sistema que ya
-- marcan la transacción (app.sistema_espera, promover_espera).
create or replace function private.inscripcion_solo_abiertos()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_motivo text;
begin
  if public.is_admin() or coalesce(current_setting('app.sistema_espera', true), '') = 'on' then
    return new;
  end if;
  if new.estado not in ('apuntado', 'espera') then return new; end if;
  -- Quien ya estaba dentro no "entra": cancelar o cambiar otra cosa sigue libre.
  if tg_op = 'UPDATE' and old.estado in ('apuntado', 'espera') then return new; end if;
  v_motivo := private.tardeo_cerrado_motivo(new.tardeo_id);
  if v_motivo = 'terminado' then
    raise exception 'Este tardeo ya ha terminado' using errcode = 'P0001';
  elsif v_motivo is not null then
    raise exception 'Este tardeo no está disponible' using errcode = 'P0002';
  end if;
  return new;
end $$;
revoke execute on function private.inscripcion_solo_abiertos() from public, anon, authenticated;
-- El nombre importa: los BEFORE se disparan por orden alfabético y este debe ir
-- antes que trg_inscripcion_aforo (si no, en un tardeo cerrado y lleno diría
-- «Aforo completo» en vez de «ya ha terminado»).
drop trigger if exists trg_inscripcion_abierto on public.inscripciones;
create trigger trg_inscripcion_abierto
  before insert or update of estado on public.inscripciones
  for each row execute function private.inscripcion_solo_abiertos();

-- estado_encuesta(): además de 'apuntado', la inscripción tiene que haberse
-- creado ANTES del fin (no vale apuntarse después para opinar). Un programado
-- que aún no ha salido no existe para el público.
create or replace function private.estado_encuesta(p_tardeo uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare t record; v_fin timestamptz;
begin
  if auth.uid() is null then return 'sin_sesion'; end if;
  select id, fecha, hora_inicio, hora_fin, estado, publicar_en into t from public.tardeos where id = p_tardeo;
  if t.id is null or t.estado = 'borrador'
     or (t.estado = 'programado' and (t.publicar_en is null or t.publicar_en > now())) then
    return 'no_existe';
  end if;
  if t.estado = 'cancelado' then return 'cancelado'; end if;
  if exists (select 1 from public.encuestas e where e.tardeo_id = p_tardeo and e.profile_id = auth.uid()) then
    return 'ya_respondida';
  end if;
  v_fin := public.tardeo_fin(t.fecha, t.hora_inicio, t.hora_fin);
  -- "Asistiré" o lista confirmada = inscripción en estado 'apuntado' hecha
  -- antes del fin. Si el local marcó que no vino, no opina.
  if not exists (select 1 from public.inscripciones i
                 where i.tardeo_id = p_tardeo and i.profile_id = auth.uid()
                   and i.estado = 'apuntado' and coalesce(i.asistencia, 'pendiente') <> 'no_asistio'
                   and i.created_at < v_fin) then
    return 'no_confirmado';
  end if;
  if now() < v_fin then return 'aun_no'; end if;
  if now() > v_fin + interval '72 hours' then return 'fuera_plazo'; end if;
  return 'ok';
end $$;
revoke execute on function private.estado_encuesta(uuid) from public, anon;
grant execute on function private.estado_encuesta(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------
-- 7) Promover la espera
-- -----------------------------------------------------------------
-- No sube a nadie si el tardeo ya no admite asistencia (cancelado, terminado,
-- oculto…): antes, cancelar una plaza de un tardeo pasado "confirmaba" al
-- primero de la espera y le mandaba «Ya tienes plaza» de algo que ya pasó.
create or replace function private.promover_espera(p_tardeo uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_aforo int; v_n int; v_sig record;
begin
  perform pg_advisory_xact_lock(hashtext(p_tardeo::text));
  if private.tardeo_cerrado_motivo(p_tardeo) is not null then return; end if;
  select t.aforo into v_aforo from public.tardeos t where t.id = p_tardeo;
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
    perform private.avisar_plaza(v_sig.profile_id, p_tardeo, v_sig.id);
  end loop;
end $$;
revoke execute on function private.promover_espera(uuid) from public, anon, authenticated;
grant execute on function private.promover_espera(uuid) to service_role;

-- -----------------------------------------------------------------
-- 5 + 7) Mover inscripciones a mano (admin)
-- -----------------------------------------------------------------
-- A 'espera': antes, si quedaba plaza libre, el disparador del lote 64 la
-- devolvía a 'apuntado' al instante y le mandaba «Ya tienes plaza». Ahora se
-- rechaza con un mensaje claro si la persona volvería a subir sola (sin aforo,
-- o con más plazas que confirmados + otros en espera), y si procede se pone
-- espera_desde = ahora (el disparador del lote 64 no lo pone para el admin).
-- A 'apuntado': se avisa a la persona como al promover.
create or replace function private.admin_mover_inscripcion(p_inscripcion uuid, p_estado text)
returns void language plpgsql security definer set search_path = public as $$
declare i record; v_aforo int; v_conf int; v_otros int;
begin
  select ins.id, ins.estado, ins.tardeo_id, ins.profile_id, t.zona_slug, t.aforo into i
    from public.inscripciones ins join public.tardeos t on t.id = ins.tardeo_id where ins.id = p_inscripcion;
  if i.id is null then raise exception 'Inscripción no encontrada' using errcode = 'P0002'; end if;
  if not private.admin_de_slug(i.zona_slug) then
    raise exception 'Este tardeo no es de tu zona' using errcode = '42501';
  end if;
  if p_estado not in ('apuntado', 'espera', 'cancelado') then
    raise exception 'Estado no válido: %', p_estado using errcode = '22023';
  end if;
  if p_estado = 'espera' and not exists (
       select 1 from pg_constraint where conname = 'inscripciones_estado_check'
          and pg_get_constraintdef(oid) like '%espera%') then
    raise exception 'La lista de espera aún no está activada (falta el lote 64)' using errcode = '0A000';
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
    update public.inscripciones set estado = p_estado where id = p_inscripcion;
  end if;

  if p_estado = 'apuntado' then
    perform private.avisar_plaza(i.profile_id, i.tardeo_id, p_inscripcion,
      case when i.estado = 'espera' then null else 'El equipo te ha confirmado la plaza.' end);
  end if;
  perform private.auditar('mover_inscripcion', 'inscripcion', p_inscripcion::text,
    (select z.zona_madre from public.zonas z where z.slug = i.zona_slug),
    jsonb_build_object('de', i.estado, 'a', p_estado, 'tardeo', i.tardeo_id));
end $$;
revoke execute on function private.admin_mover_inscripcion(uuid, text) from public, anon;
grant execute on function private.admin_mover_inscripcion(uuid, text) to authenticated, service_role;

-- Promover a mano: igual que antes, y ahora también avisa.
create or replace function private.admin_promover_espera(p_tardeo uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_prof uuid; v_zona text; v_orden text;
begin
  select zona_slug into v_zona from public.tardeos where id = p_tardeo;
  if not found then raise exception 'Tardeo no encontrado' using errcode = 'P0002'; end if;
  if not private.admin_de_slug(v_zona) then raise exception 'Este tardeo no es de tu zona' using errcode = '42501'; end if;
  v_orden := case when exists (select 1 from information_schema.columns where table_schema = 'public'
                                 and table_name = 'inscripciones' and column_name = 'espera_desde')
                  then 'espera_desde nulls last, created_at' else 'created_at' end;
  execute format('select id, profile_id from public.inscripciones where tardeo_id = $1 and estado = ''espera'' order by %s, id limit 1', v_orden)
    into v_id, v_prof using p_tardeo;
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

-- -----------------------------------------------------------------
-- S1) profiles.email
-- -----------------------------------------------------------------
-- La política perfil_update deja a cada persona cambiar SU fila entera, email
-- incluido. Como admin_asignar_rol buscaba por profiles.email, alguien podía
-- ponerse el email de otra persona y quedarse el rol que el admin le daba a
-- esa otra. El email de verdad es el de auth.users (verificado por Supabase):
-- profiles.email es solo una copia. Un cambio por la API se ignora en
-- silencio (la petición no falla, el email no cambia); lo puede cambiar el
-- service role, un admin global o la sincronización desde auth.users.
-- No se pone índice ÚNICO en email: hay perfiles migrados de la web antigua
-- con el mismo email repetido; el único seguro es el de auth.users.
create or replace function private.profiles_proteger_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is not distinct from old.email then return new; end if;
  if coalesce(current_setting('app.sync_email', true), '') = 'on' or private.es_admin_global() then
    return new;
  end if;
  new.email := old.email;
  return new;
end $$;
revoke execute on function private.profiles_proteger_email() from public, anon, authenticated;
drop trigger if exists trg_profiles_proteger_email on public.profiles;
create trigger trg_profiles_proteger_email
  before update of email on public.profiles
  for each row execute function private.profiles_proteger_email();

-- Cuando Supabase confirma un cambio de email, la copia se pone al día.
create or replace function private.sync_email_desde_auth()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    perform set_config('app.sync_email', 'on', true);
    update public.profiles set email = new.email where id = new.id;
    perform set_config('app.sync_email', 'off', true);
  end if;
  return null;
end $$;
revoke execute on function private.sync_email_desde_auth() from public, anon, authenticated;
drop trigger if exists trg_sync_email_desde_auth on auth.users;
create trigger trg_sync_email_desde_auth
  after update of email on auth.users
  for each row execute function private.sync_email_desde_auth();

-- 6 + S1) Asignar rol: busca la cuenta en auth.users con el email CONFIRMADO
-- (no en profiles, que era editable), exige que haya exactamente una y no deja
-- asignarse un rol a uno mismo: un admin sin filas en admin_roles es GLOBAL y
-- al darse una tarea dejaba de serlo sin poder deshacerlo (quitarse roles a
-- uno mismo está prohibido).
create or replace function private.admin_asignar_rol(p_email text, p_tarea text, p_zona_madre text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n int; v_rol uuid;
begin
  if not private.es_admin_global() then raise exception 'Solo un administrador global' using errcode = '42501'; end if;
  select count(*), min(u.id::text)::uuid into v_n, v_id
    from auth.users u
   where lower(u.email) = lower(trim(p_email)) and u.email_confirmed_at is not null;
  if v_n = 0 then
    raise exception 'No hay ninguna cuenta con ese email confirmado' using errcode = 'P0002';
  elsif v_n > 1 then
    raise exception 'Hay % cuentas con ese email: resuélvelo antes desde Usuarios', v_n using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = v_id) then
    raise exception 'Esa cuenta no tiene perfil todavía' using errcode = 'P0002';
  end if;
  if v_id = auth.uid() then
    raise exception 'No puedes asignarte un rol a ti mismo: pídeselo a otro administrador global' using errcode = '42501';
  end if;
  if p_tarea = 'global' then p_zona_madre := null; end if;
  insert into public.admin_roles (profile_id, tarea, zona_madre, created_by)
  values (v_id, p_tarea, p_zona_madre, auth.uid())
  on conflict (profile_id, tarea, coalesce(zona_madre, '*')) do nothing
  returning id into v_rol;
  update public.profiles set is_admin = true where id = v_id and not is_admin;
  perform private.auditar('asignar_rol', 'admin_roles', v_id::text, p_zona_madre,
    jsonb_build_object('email', lower(trim(p_email)), 'tarea', p_tarea));
  return v_rol;
end $$;
revoke execute on function private.admin_asignar_rol(text, text, text) from public, anon;
grant execute on function private.admin_asignar_rol(text, text, text) to authenticated, service_role;

-- -----------------------------------------------------------------
-- 8) Bloquear / desbloquear DJ
-- -----------------------------------------------------------------
-- Al bloquear, las solicitudes vivas pasan a 'rechazada'. Al desbloquear, esa
-- persona seguía 30 días sin poder escribir por la regla «el DJ rechazó tu
-- solicitud hace poco», aunque el DJ nunca la rechazó: la cerró el bloqueo.
-- Se marca el rechazo como causado por el bloqueo y esa regla no lo cuenta.
alter table public.solicitudes_mensaje add column if not exists por_bloqueo boolean not null default false;

create or replace function private.responder_solicitud_dj(p_solicitud uuid, p_accion text)
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select sm.*, d.nombre_artistico into s from public.solicitudes_mensaje sm join public.djs d on d.id = sm.dj_id
    where sm.id = p_solicitud;
  if not found or not private.es_mi_dj(s.dj_id) then raise exception 'Esta solicitud no es tuya'; end if;
  if p_accion = 'aceptar' then
    if s.estado <> 'pendiente' then raise exception 'La solicitud ya estaba respondida'; end if;
    update public.solicitudes_mensaje set estado = 'aceptada', respondida_en = now() where id = p_solicitud;
    perform private.crear_aviso(s.de, 'mensaje', s.nombre_artistico || ' ha aceptado tu mensaje',
      'Ya podéis hablar.', '/mensajes?c=' || p_solicitud, 'sol_ok:' || p_solicitud);
  elsif p_accion = 'rechazar' then
    update public.solicitudes_mensaje set estado = 'rechazada', respondida_en = now(), por_bloqueo = false
      where id = p_solicitud and estado in ('pendiente', 'aceptada');
  elsif p_accion = 'bloquear' then
    insert into public.bloqueos (dj_id, profile_id) values (s.dj_id, s.de) on conflict do nothing;
    update public.solicitudes_mensaje set estado = 'rechazada', respondida_en = now(), por_bloqueo = true
      where dj_id = s.dj_id and de = s.de and estado in ('pendiente', 'aceptada');
  elsif p_accion = 'desbloquear' then
    delete from public.bloqueos where dj_id = s.dj_id and profile_id = s.de;  -- quitar el bloqueo, no datos
  else
    raise exception 'Acción desconocida';
  end if;
end $$;
revoke execute on function private.responder_solicitud_dj(uuid, text) from public;
grant execute on function private.responder_solicitud_dj(uuid, text) to authenticated, service_role;

create or replace function private.enviar_solicitud_dj(p_dj uuid, p_texto text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_prof uuid; v_nombre text; v_id uuid;
begin
  if v_uid is null then raise exception 'Entra en tu cuenta para escribir a un DJ'; end if;
  select d.profile_id, d.nombre_artistico into v_prof, v_nombre from public.djs d where d.id = p_dj and not d.oculto;
  if not found or v_prof is null then raise exception 'Este DJ todavía no recibe mensajes'; end if;
  if v_prof = v_uid then raise exception 'No puedes escribirte a ti mismo'; end if;
  if coalesce(btrim(p_texto), '') = '' or char_length(p_texto) > 500 then
    raise exception 'Escribe un mensaje de hasta 500 caracteres';
  end if;
  if private.contiene_contacto(p_texto) then
    raise exception 'No se pueden compartir teléfonos ni emails aquí' using errcode = 'P0001', hint = 'contacto';
  end if;
  if exists (select 1 from public.bloqueos b where b.dj_id = p_dj and b.profile_id = v_uid) then
    raise exception 'Este DJ no acepta mensajes tuyos';
  end if;
  if exists (select 1 from public.dj_mensajes_ajustes a where a.dj_id = p_dj and not a.acepta_solicitudes) then
    raise exception 'Este DJ ha pausado las solicitudes nuevas';
  end if;
  if exists (select 1 from public.solicitudes_mensaje s where s.de = v_uid and s.dj_id = p_dj and s.estado = 'pendiente') then
    raise exception 'Ya tienes una solicitud pendiente con este DJ';
  end if;
  if exists (select 1 from public.solicitudes_mensaje s where s.de = v_uid and s.dj_id = p_dj and s.estado = 'aceptada') then
    raise exception 'Ya tienes una conversación abierta con este DJ';
  end if;
  -- Solo cuentan los rechazos de verdad, no los que cerró un bloqueo ya quitado.
  if exists (select 1 from public.solicitudes_mensaje s where s.de = v_uid and s.dj_id = p_dj
             and s.estado = 'rechazada' and not s.por_bloqueo and s.respondida_en > now() - interval '30 days') then
    raise exception 'El DJ rechazó tu solicitud hace poco. Podrás volver a intentarlo más adelante.';
  end if;
  if (select count(*) from public.solicitudes_mensaje s where s.de = v_uid and s.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Has enviado 5 solicitudes hoy. Vuelve a intentarlo mañana.';
  end if;
  insert into public.solicitudes_mensaje (de, dj_id, texto) values (v_uid, p_dj, btrim(p_texto)) returning id into v_id;
  perform private.crear_aviso(v_prof, 'mensaje', 'Nueva solicitud de mensaje',
    left(btrim(p_texto), 120), '/dj/mensajes?c=' || v_id, 'sol:' || v_id);
  return v_id;
end $$;
revoke execute on function private.enviar_solicitud_dj(uuid, text) from public;
grant execute on function private.enviar_solicitud_dj(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------
-- 9) Cola de trabajo
-- -----------------------------------------------------------------
-- a) Los locales por verificar se aprueban en /admin/revisar (la pantalla
--    /admin/locales?id= no abre ninguna ficha).
-- b) El total viaja en cada fila (count(*) over ()), así que con la página
--    vacía (p. ej. se marcó «hecho» lo último de la última página) no había de
--    dónde leerlo. La cola completa sale ahora de UNA función interna y
--    cola_trabajo_total() la cuenta entera, sin paginar: la pantalla la pide
--    cuando la página llega vacía. cola_trabajo() devuelve lo mismo que antes.
create or replace function private.cola_completa(p_tipo text, p_zona text, p_solo_mias boolean, p_estado text)
returns table (tipo text, objeto_id text, titulo text, detalle text, zona_madre text, fecha timestamptz,
               enlace text, responsable uuid, responsable_nombre text, estado text, nota text)
language plpgsql volatile security definer set search_path = public as $$
declare
  fuentes text[] := array[]::text[];
  sql text;
  mis text[] := private.mis_zonas_admin();
begin
  if not public.is_admin() then return; end if;

  -- validación profesional: locales/promotores en borrador
  fuentes := array_append(fuentes, $q$select 'validacion'::text, l.id::text, l.nombre, coalesce(l.tipo,'local'), z.zona_madre, l.created_at, '/admin/revisar'::text
    from public.locales l left join public.zonas z on z.slug = l.zona_slug where l.estado = 'borrador'$q$::text);
  -- reclamaciones de ficha
  if to_regclass('public.solicitudes_reclamacion') is not null then
    fuentes := array_append(fuentes, $q$select 'reclamacion', s.id::text, 'Reclamación de ' || s.tipo, left(s.mensaje, 140), z.zona_madre, s.created_at, '/admin/reclamaciones'
      from public.solicitudes_reclamacion s left join public.locales l on l.id = s.objetivo_id left join public.zonas z on z.slug = l.zona_slug
      where s.estado = 'pendiente'$q$::text);
  end if;
  if to_regclass('public.denuncias_flyer') is not null then
    fuentes := array_append(fuentes, $q$select 'denuncia_flyer', d.id::text, coalesce(t.titulo, 'Flyer'), d.motivo, z.zona_madre, d.created_at, '/admin/moderacion?tab=flyers'
      from public.denuncias_flyer d left join public.tardeos t on t.id = d.tardeo_id left join public.zonas z on z.slug = t.zona_slug
      where d.estado = 'pendiente'$q$::text);
  end if;
  if to_regclass('public.denuncias') is not null then
    fuentes := array_append(fuentes, $q$select 'denuncia', d.id::text, 'Denuncia: ' || d.tipo_objeto, d.motivo, null::text, d.created_at, '/admin/denuncias'
      from public.denuncias d where d.estado = 'pendiente'$q$::text);
  end if;
  if to_regclass('public.incidencias') is not null then
    fuentes := array_append(fuentes, $q$select 'ayuda', i.id::text, 'Ayuda: ' || coalesce(i.tipo, 'incidencia'), left(i.mensaje, 140), null::text, i.created_at, '/admin/incidencias'
      from public.incidencias i where i.estado = 'abierta'$q$::text);
  end if;
  if to_regclass('public.dj_solicitudes') is not null then
    fuentes := array_append(fuentes, $q$select case s.tipo when 'vinculo' then 'vinculo_dj' else 'evento_propuesto' end,
        s.id::text, case s.tipo when 'vinculo' then 'Vínculo DJ' else 'Evento propuesto' end || coalesce(': ' || t.titulo, ''),
        null::text, z.zona_madre, s.created_at, '/admin/cola'
      from public.dj_solicitudes s left join public.tardeos t on t.id = s.tardeo_id left join public.zonas z on z.slug = t.zona_slug
      where s.estado = 'pendiente'$q$::text);
  end if;
  if to_regclass('public.coins_reservas') is not null then
    fuentes := array_append(fuentes, $q$select 'comercial', s.id::text, 'Reserva de Coins: ' || coalesce(l.nombre, ''), null::text, z.zona_madre, s.created_at, '/admin/coins'
      from public.coins_reservas s left join public.locales l on l.id = s.local_id left join public.zonas z on z.slug = l.zona_slug
      where s.estado in ('pendiente', 'confirmada', 'en_curso')$q$::text);
  end if;

  create temporary table if not exists _cola (tipo text, objeto_id text, titulo text, detalle text, zona_madre text, fecha timestamptz, enlace text) on commit drop;
  truncate _cola;
  foreach sql in array fuentes loop
    begin
      execute 'insert into _cola ' || sql;
    exception when others then
      raise notice 'cola_trabajo: fuente omitida (%)', sqlerrm;
    end;
  end loop;

  return query
    select c.tipo, c.objeto_id, c.titulo, c.detalle, c.zona_madre, c.fecha, c.enlace,
           a.responsable, coalesce(p.display_name, p.email), coalesce(a.estado, 'pendiente'), a.nota
    from _cola c
    left join public.asignaciones a on a.tipo = c.tipo and a.objeto_id = c.objeto_id
    left join public.profiles p on p.id = a.responsable
    where (p_tipo is null or c.tipo = p_tipo)
      and (mis is null or c.zona_madre is null or c.zona_madre = any(mis))
      and (p_zona is null or c.zona_madre = p_zona)
      and (not coalesce(p_solo_mias, false) or a.responsable = auth.uid())
      and (p_estado = 'todas' or (p_estado = 'abiertas' and coalesce(a.estado, 'pendiente') in ('pendiente', 'en_curso'))
           or coalesce(a.estado, 'pendiente') = p_estado);
end $$;
revoke execute on function private.cola_completa(text, text, boolean, text) from public, anon, authenticated;
grant execute on function private.cola_completa(text, text, boolean, text) to service_role;

create or replace function private.cola_trabajo(p_tipo text default null, p_zona text default null,
                                                p_solo_mias boolean default false, p_estado text default 'abiertas',
                                                p_limite int default 25, p_desde int default 0)
returns table (tipo text, objeto_id text, titulo text, detalle text, zona_madre text, fecha timestamptz,
               enlace text, responsable uuid, responsable_nombre text, estado text, nota text, total bigint)
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then return; end if;
  -- El total se cuenta sobre la cola ENTERA (la ventana va antes del limit).
  return query
    select c.*, count(*) over ()
    from private.cola_completa(p_tipo, p_zona, p_solo_mias, p_estado) c
    order by c.fecha desc nulls last, c.tipo, c.objeto_id
    limit greatest(least(p_limite, 200), 1) offset greatest(p_desde, 0);
end $$;
revoke execute on function private.cola_trabajo(text, text, boolean, text, int, int) from public, anon;
grant execute on function private.cola_trabajo(text, text, boolean, text, int, int) to authenticated, service_role;

create or replace function private.cola_trabajo_total(p_tipo text, p_zona text, p_solo_mias boolean, p_estado text)
returns bigint language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then return 0; end if;
  return (select count(*) from private.cola_completa(p_tipo, p_zona, p_solo_mias, p_estado));
end $$;
revoke execute on function private.cola_trabajo_total(text, text, boolean, text) from public, anon;
grant execute on function private.cola_trabajo_total(text, text, boolean, text) to authenticated, service_role;
-- Crea una tabla temporal: no puede ser "stable" en el envoltorio.
create or replace function public.cola_trabajo_total(p_tipo text default null, p_zona text default null,
                                                     p_solo_mias boolean default false, p_estado text default 'abiertas')
returns bigint language sql security invoker set search_path = public
as $$ select private.cola_trabajo_total($1, $2, $3, $4) $$;
revoke execute on function public.cola_trabajo_total(text, text, boolean, text) from public, anon;
grant execute on function public.cola_trabajo_total(text, text, boolean, text) to authenticated, service_role;

-- -----------------------------------------------------------------
-- 10) Cierre de la Meet Zone = fin del tardeo + 72 h (misma regla que la encuesta)
-- -----------------------------------------------------------------
-- Antes tenía su propia cuenta (sin hora de fin = 23:59:59 del día) y la
-- encuesta otra (inicio + 5 h): el chat y la encuesta cerraban a horas
-- distintas para el mismo tardeo. Ahora las dos usan public.tardeo_fin().
create or replace function private.meet_cierre(p_tardeo uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select public.tardeo_fin(t.fecha, t.hora_inicio, t.hora_fin) + interval '72 hours'
  from public.tardeos t where t.id = p_tardeo;
$$;
revoke execute on function private.meet_cierre(uuid) from public;
grant execute on function private.meet_cierre(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------
-- 11) Filtro de teléfonos y emails
-- -----------------------------------------------------------------
-- Antes quitaba espacios, puntos, barras… y buscaba 9 cifras seguidas: eso
-- bloqueaba «17/10/2026 18.00h» (fecha + hora = 12 cifras) y dejaba pasar
-- «612,345,678» (la coma no se quitaba) o «pepe @ gmail . com».
-- Ahora se buscan FORMAS de teléfono, no cifras sueltas:
--   · español: empieza por 6, 7, 8 o 9 (sin cifra delante), con o sin +34 /
--     0034, en grupos 3‑3‑3 o 3‑2‑2‑2 separados por espacio, punto, guion,
--     paréntesis o una coma pegada (612,345,678). Detrás no puede venir otra
--     cifra. La barra (/) y los dos puntos (:) no separan: son de fechas y horas.
--   · internacional: + o 00 (sin cifra, punto, coma o dos puntos delante,
--     para no confundir «18.00») y al menos 8 cifras más.
--   · 9 o más cifras pegadas.
-- Emails: normal, «arroba/punto», (at) y [at]; con espacios alrededor de la @
-- y del punto solo si termina en un dominio conocido (así «hola @ todos. Nos
-- vemos» no salta).
create or replace function private.contiene_contacto(p text)
returns boolean language sql immutable set search_path = public as $$
  select p is not null and (
    -- email pegado u ofuscado: pepe@gmail.com, pepe arroba gmail punto com, pepe(at)gmail.com
    p ~* '[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\sarroba\s)\s*[a-z0-9-]+(\.|\s+punto\s+)[a-z]{2,}'
    -- email con espacios: pepe @ gmail . com
    or p ~* '[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\sarroba\s)\s*[a-z0-9-]+\s*(\.|punto)\s*(com|es|net|org|cat|eu|info|me|io|co|fr|de|it|pt|uk|us)([^a-z]|$)'
    -- teléfono español en grupos
    or p ~ '(^|[^0-9])((\+|00)\s?34[\s.()-]{0,3})?[6789][0-9]{2}(([\s.()-]{0,3}|,)[0-9]{3}([\s.()-]{0,3}|,)[0-9]{3}|([\s.()-]{0,3}|,)[0-9]{2}([\s.()-]{0,3}|,)[0-9]{2}([\s.()-]{0,3}|,)[0-9]{2})([^0-9]|$)'
    -- internacional
    or p ~ '(^|[^0-9.,:])(\+|00)\s?[1-9]([\s.()-]{0,2}[0-9]){8,}'
    -- 9 o más cifras pegadas
    or p ~ '[0-9]{9,}'
  );
$$;
grant execute on function private.contiene_contacto(text) to anon, authenticated, service_role;

-- -----------------------------------------------------------------
-- 12) Nexo: «Descubre sesiones»
-- -----------------------------------------------------------------
-- Un set ocultado por moderación (sets.oculto) seguía sonando en Nexo si
-- alguien lo había enviado. Y la plataforma salía del set, aunque el envío
-- llevara otra URL (la que de verdad se reproduce).
create or replace function private.nexo_sesiones(p_limite integer default 20)
returns table (id uuid, titulo text, url text, descripcion text, dj_id uuid,
               dj_nombre text, dj_avatar text, portada text, plataforma text, estado text)
language sql stable security definer set search_path = public as $$
  select e.id, e.titulo, e.url, e.descripcion, d.id, d.nombre_artistico, d.avatar_url,
         s.portada,
         case when nullif(btrim(e.url), '') is not null then
           case when e.url ~* 'soundcloud\.com' then 'soundcloud'
                when e.url ~* '(youtube\.com|youtu\.be)' then 'youtube'
                when e.url ~* 'mixcloud\.com' then 'mixcloud'
                when e.url ~* '\.(mp3|m4a|aac|ogg|wav)(\?|$)' then 'audio'
                else 'otra' end
         else coalesce(s.plataforma, 'otra') end,
         e.estado
  from public.nexo_envios e
  join public.djs d on d.id = e.dj_id and not d.oculto
  left join public.sets s on s.id = e.set_id
  where e.estado in ('aceptado', 'emitido')
    and (s.id is null or not s.oculto)
  order by coalesce(e.emitido_en, e.revisado_en, e.created_at) desc
  limit least(greatest(coalesce(p_limite, 20), 1), 50);
$$;
revoke execute on function private.nexo_sesiones(integer) from public;
grant execute on function private.nexo_sesiones(integer) to anon, authenticated, service_role;

-- -----------------------------------------------------------------
-- S4) Métricas
-- -----------------------------------------------------------------
-- Cualquiera (también anónimo) podía insertar en eventos_metrica y
-- clics_atribucion directamente, en masa y con textos de cualquier tamaño.
-- Todo el código mide con medir_evento() (lib/metricas.ts; el insert directo
-- solo era plan B por si faltaba el lote 69). medir_evento pasa a SECURITY
-- DEFINER (fuera de la API, patrón lote 60) y recorta y fija profile_id él
-- mismo; así se puede quitar el INSERT directo. clics_atribucion no lo usa
-- ningún código. Además, longitudes máximas en la propia tabla.
create or replace function private.medir_evento(p_tipo text, p_tardeo uuid, p_local uuid, p_dj uuid,
                                                p_sesion text, p_destino text, p_detalle text,
                                                p_origen text, p_medio text, p_campana text)
returns void language sql security definer set search_path = public as $$
  insert into public.eventos_metrica (tipo, tardeo_id, local_id, dj_id, profile_id, sesion, destino, detalle, origen, medio, campana)
  values (p_tipo, p_tardeo, p_local, p_dj, auth.uid(), left(nullif(p_sesion, ''), 64), left(p_destino, 500), left(p_detalle, 80),
          left(p_origen, 60), left(p_medio, 60), left(p_campana, 80))
  on conflict do nothing;
$$;
revoke execute on function private.medir_evento(text, uuid, uuid, uuid, text, text, text, text, text, text) from public;
grant execute on function private.medir_evento(text, uuid, uuid, uuid, text, text, text, text, text, text) to anon, authenticated, service_role;
create or replace function public.medir_evento(p_tipo text, p_tardeo uuid default null, p_local uuid default null, p_dj uuid default null,
                                               p_sesion text default null, p_destino text default null, p_detalle text default null,
                                               p_origen text default null, p_medio text default null, p_campana text default null)
returns void language sql security invoker set search_path = public
as $$ select private.medir_evento($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) $$;
grant execute on function public.medir_evento(text, uuid, uuid, uuid, text, text, text, text, text, text) to anon, authenticated, service_role;

revoke insert on public.eventos_metrica from anon, authenticated;
revoke insert on public.clics_atribucion from anon, authenticated;

-- Restricciones de longitud: se añaden NOT VALID (no recorren la tabla al
-- crearse) y se validan si los datos ya cumplen; si alguna fila antigua no
-- cumple se deja sin validar (las filas nuevas sí se comprueban) y se avisa.
-- Comprobado el 17‑oct en producción (solo lectura): 524 métricas, sesión
-- máx. 20, detalle máx. 24, destino máx. 155; 0 clics. Cumplen.
do $$
declare r record;
begin
  for r in select * from (values
    ('eventos_metrica', 'eventos_metrica_largos', '(sesion is null or char_length(sesion) <= 64) and (detalle is null or char_length(detalle) <= 200) and (destino is null or char_length(destino) <= 500)'),
    ('clics_atribucion', 'clics_atribucion_largos', '(destino_url is null or char_length(destino_url) <= 1000)'),
    -- S9) Enlaces de entradas y promo: solo http(s). Un «javascript:…» o
    -- «data:…» en el botón de comprar se abría tal cual. 1.615 tardeos en
    -- producción revisados el 17‑oct: ninguno incumple.
    ('tardeos', 'tardeos_urls_http', '(fourvenues_url is null or fourvenues_url ~* ''^https?://'') and (promo_url is null or promo_url ~* ''^https?://'')')
  ) as x(tabla, nombre, expr)
  loop
    if not exists (select 1 from pg_constraint where conname = r.nombre and conrelid = ('public.' || r.tabla)::regclass) then
      execute format('alter table public.%I add constraint %I check (%s) not valid', r.tabla, r.nombre, r.expr);
    end if;
    begin
      execute format('alter table public.%I validate constraint %I', r.tabla, r.nombre);
    exception when check_violation then
      raise warning 'Lote 73: hay filas antiguas en % que no cumplen %; la restricción queda sin validar (las nuevas sí se comprueban).', r.tabla, r.nombre;
    end;
  end loop;
end $$;

-- -----------------------------------------------------------------
-- S5) Bucket `flyers`
-- -----------------------------------------------------------------
-- Público, sin límite de tamaño ni de tipos. Lo que sube el código: flyers,
-- avatares, logos y fotos de local, imágenes de DJ y de pop‑ups (imágenes) y
-- el press kit (PDF, máx. 10 MB en /dj/presskit). No se sube audio (los sets
-- y Nexo son enlaces). Límite 10 MB = el del press kit.
-- Escritura: cada objeto solo lo cambia o borra quien lo subió (owner) o un
-- admin. Las políticas del bucket se crearon a mano en el panel y no están en
-- ningún lote: por eso las de este lote son RESTRICTIVAS (se suman como "y" a
-- las que ya haya, sea cual sea su nombre) y solo para `flyers`; las
-- permisivas mínimas se crean solo si no hay ya alguna para ese bucket. La
-- lectura pública por URL no pasa por RLS: no cambia.
do $$
declare
  v_owner text;
  c text;
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets
       set file_size_limit = 10485760,
           allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
     where id = 'flyers';
  end if;
  if to_regclass('storage.objects') is null then return; end if;

  -- owner (uuid) existe siempre; owner_id (texto) solo en versiones nuevas de Storage.
  v_owner := case when exists (select 1 from information_schema.columns
                                where table_schema = 'storage' and table_name = 'objects' and column_name = 'owner_id')
                  then '(owner = (select auth.uid()) or owner_id = (select auth.uid())::text)'
                  else 'owner = (select auth.uid())' end;

  execute 'drop policy if exists "t73_flyers_ins_restr" on storage.objects';
  execute format('create policy "t73_flyers_ins_restr" on storage.objects as restrictive for insert to anon, authenticated
                  with check (bucket_id <> ''flyers'' or (select public.is_admin()) or ((select auth.uid()) is not null and %s))', v_owner);
  execute 'drop policy if exists "t73_flyers_upd_restr" on storage.objects';
  execute format('create policy "t73_flyers_upd_restr" on storage.objects as restrictive for update to anon, authenticated
                  using (bucket_id <> ''flyers'' or (select public.is_admin()) or %1$s)
                  with check (bucket_id <> ''flyers'' or (select public.is_admin()) or %1$s)', v_owner);
  execute 'drop policy if exists "t73_flyers_del_restr" on storage.objects';
  execute format('create policy "t73_flyers_del_restr" on storage.objects as restrictive for delete to anon, authenticated
                  using (bucket_id <> ''flyers'' or (select public.is_admin()) or %s)', v_owner);

  -- Permisivas mínimas (subir, sustituir con upsert, borrar lo propio y leer
  -- lo propio, que Storage necesita para upsert y remove) solo si el panel no
  -- tiene ya alguna para `flyers` y esa acción.
  foreach c in array array['select', 'insert', 'update', 'delete'] loop
    execute format('drop policy if exists %I on storage.objects', 't73_flyers_' || c);
    if not exists (select 1 from pg_policies
                    where schemaname = 'storage' and tablename = 'objects' and permissive = 'PERMISSIVE'
                      and cmd in (upper(c), 'ALL') and policyname not like 't73_%'
                      and coalesce(qual, '') || coalesce(with_check, '') like '%flyers%') then
      execute case c
        when 'select' then format('create policy "t73_flyers_select" on storage.objects for select to authenticated
                                   using (bucket_id = ''flyers'' and ((select public.is_admin()) or %s))', v_owner)
        when 'insert' then format('create policy "t73_flyers_insert" on storage.objects for insert to authenticated
                                   with check (bucket_id = ''flyers'' and ((select public.is_admin()) or %s))', v_owner)
        when 'update' then format('create policy "t73_flyers_update" on storage.objects for update to authenticated
                                   using (bucket_id = ''flyers'' and ((select public.is_admin()) or %1$s))
                                   with check (bucket_id = ''flyers'' and ((select public.is_admin()) or %1$s))', v_owner)
        else format('create policy "t73_flyers_delete" on storage.objects for delete to authenticated
                     using (bucket_id = ''flyers'' and ((select public.is_admin()) or %s))', v_owner)
      end;
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------
-- S7) djs.oculto y comentarios de sets
-- -----------------------------------------------------------------
-- `oculto` es la palanca del equipo para retirar a un DJ de la web, pero el
-- dueño podía volver a mostrarse con un update. El portal DJ no ofrece
-- «ocultar mi ficha» (solo FichasAdmin lo cambia), así que solo el admin lo
-- mueve, en los dos sentidos. Una ficha nueva nace visible, como hasta ahora.
-- Versión vigente: lote 19 (+ oculto).
create or replace function public.proteger_djs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.verificado       := false;
    new.reputacion_score := 0;
    new.destacado_orden  := null;
    new.oculto           := false;
  else
    new.verificado       := old.verificado;
    new.destacado_orden  := old.destacado_orden;
    new.oculto           := old.oculto;
    -- Solo el recálculo automático del Lote 7 puede tocar la reputación.
    if coalesce(current_setting('app.recalc_reputacion', true), '') <> 'on' then
      new.reputacion_score := old.reputacion_score;
    end if;
  end if;
  return new;
end; $$;
revoke execute on function public.proteger_djs() from public, anon, authenticated;

-- Comentarios de sets: el dueño del set puede ocultar comentarios de su set,
-- pero no deshacer lo que ocultó el equipo. Se apunta quién lo ocultó
-- (oculto_por_admin, que solo cambia este disparador).
-- El dueño podría volver a mostrar lo que ocultó él mismo, pero hoy la
-- política de lectura ya no le deja ver (ni por tanto tocar) un comentario
-- oculto: en la práctica solo pasa de visible a oculto.
alter table public.sets_comentarios add column if not exists oculto_por_admin boolean not null default false;

-- El lote 65 dio permisos POR COLUMNA (insert de set_id/autor/texto/
-- respuesta_de, update solo de oculto), pero en Supabase la tabla ya tenía
-- todos los permisos por defecto a nivel de tabla, así que las columnas no
-- limitaban nada: el dueño del set podía reescribir el TEXTO de los
-- comentarios de otros en su set (la política de update se lo permite).
-- Se quitan los permisos de tabla y quedan solo los de columna. El código
-- (lib/sets.ts) solo inserta esas 4 columnas, borra y lee.
revoke insert, update, delete, truncate, references, trigger on public.sets_comentarios from anon;
revoke insert, update, truncate, references, trigger on public.sets_comentarios from authenticated;
grant select on public.sets_comentarios to anon, authenticated;
grant insert (set_id, autor, texto, respuesta_de) on public.sets_comentarios to authenticated;
grant update (oculto) on public.sets_comentarios to authenticated;
grant delete on public.sets_comentarios to authenticated;

create or replace function private.sets_comentarios_moderacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    if new.oculto is distinct from old.oculto then new.oculto_por_admin := new.oculto; end if;
    return new;
  end if;
  new.oculto_por_admin := old.oculto_por_admin;   -- nadie más lo toca
  if old.oculto and not new.oculto and old.oculto_por_admin then
    raise exception 'Este comentario lo ocultó el equipo: solo el equipo puede volver a mostrarlo' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function private.sets_comentarios_moderacion() from public, anon, authenticated;
drop trigger if exists trg_sets_comentarios_moderacion on public.sets_comentarios;
create trigger trg_sets_comentarios_moderacion
  before update on public.sets_comentarios
  for each row execute function private.sets_comentarios_moderacion();

-- -----------------------------------------------------------------
-- S8) djs: columnas de cobro y contacto, fuera de anon
-- -----------------------------------------------------------------
-- Ninguna pantalla anónima las pide (la ficha pública usa getDjPublico, sin
-- ellas; getDjById, que pedía `contacto`, ya no se usa). El equipo y el propio
-- DJ las leen con sesión (authenticated), que no cambia.
revoke select (pago_proveedor, pago_referencia, plan_notas, plan_estado, plan_hasta, contacto) on public.djs from anon;

-- -----------------------------------------------------------------
-- S11) Incidencias: el `borrador` (copia del formulario de un tardeo) solo con sesión
-- -----------------------------------------------------------------
-- Política vigente (lote 61) + borrador solo con sesión: sin esto cualquiera
-- podía meter 20 kB de JSON por incidencia anónima. El tope global de 60
-- anónimas por hora (disparador del lote 57) sigue igual.
drop policy if exists "incidencias_insert" on public.incidencias;
create policy "incidencias_insert" on public.incidencias
  for insert to anon, authenticated with check (
    (profile_id is null or profile_id = (select auth.uid()))
    and estado = 'abierta'
    and nota_admin is null
    and resuelta_en is null
    and char_length(btrim(mensaje)) between 10 and 2000
    and (borrador is null or (select auth.uid()) is not null)
  );

-- -----------------------------------------------------------------
-- S13) Canjear promoción: tope de códigos fallidos
-- -----------------------------------------------------------------
-- Sin tope, un código corto se adivinaba a base de intentos. Máximo 10 códigos
-- fallidos por persona y promoción en una hora (contador en uso_ia, el mismo
-- de los límites de IA; se limpia solo a la hora).
-- OJO: un código incorrecto ya NO lanza error: devuelve {ok:false, error,
-- motivo:'codigo', intentos_restantes}. Un error desharía también la anotación
-- del intento fallido (todo va en la misma transacción) y el tope no contaría
-- nunca. Los demás rechazos siguen siendo errores como antes.
create or replace function private.canjear_promocion(p_promo uuid, p_codigo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p record; v_uid uuid := auth.uid(); v_clave text; v_fallos int;
begin
  if v_uid is null then raise exception 'Entra con tu cuenta para canjear' using errcode = '42501'; end if;
  v_clave := 'promo:' || p_promo::text || ':' || v_uid::text;
  select count(*) into v_fallos from public.uso_ia
   where clave = v_clave and creado_en > now() - interval '1 hour';
  if v_fallos >= 10 then
    raise exception 'Demasiados códigos incorrectos. Prueba dentro de una hora.' using errcode = 'P0001', hint = 'intentos';
  end if;
  select * into p from public.promociones where id = p_promo for update;
  if not found then raise exception 'Promoción no encontrada' using errcode = 'P0001'; end if;
  if not p.activa or (p.desde is not null and p.desde > now()) or (p.hasta is not null and p.hasta < now()) then
    raise exception 'Esta promoción no está vigente' using errcode = 'P0001';
  end if;
  if p.limite_usos is not null and p.usos >= p.limite_usos then
    raise exception 'Se han agotado los canjes de esta promoción' using errcode = 'P0001';
  end if;
  if p.codigo is not null and upper(btrim(coalesce(p_codigo, ''))) <> upper(btrim(p.codigo)) then
    insert into public.uso_ia (clave) values (v_clave);
    return jsonb_build_object('ok', false, 'motivo', 'codigo', 'error', 'El código no es correcto',
                              'intentos_restantes', greatest(10 - v_fallos - 1, 0));
  end if;
  if exists (select 1 from public.promo_canjes where promocion_id = p_promo and profile_id = v_uid) then
    raise exception 'Ya has canjeado esta promoción' using errcode = 'P0001';
  end if;
  insert into public.promo_canjes (promocion_id, profile_id, codigo) values (p_promo, v_uid, p.codigo);
  update public.promociones set usos = usos + 1 where id = p_promo;
  return jsonb_build_object('ok', true, 'usos', p.usos + 1, 'limite', p.limite_usos, 'beneficio', p.beneficio, 'nombre', p.nombre);
end $$;
revoke execute on function private.canjear_promocion(uuid, text) from public;
grant execute on function private.canjear_promocion(uuid, text) to authenticated, service_role;

-- S14) perfil_publico NO se toca: lo usa la ficha pública de un set
-- (lib/sets.ts, comentarios visibles sin sesión) y quienes_van (también
-- anónimo, por dentro). Solo devuelve alias, foto y presentación.

notify pgrst, 'reload schema';
