-- =============================================================
-- TardeosClub · LOTE 66: COMUNIDAD (dossier 14‑oct‑2026, págs. 6, 8 y 15)
-- =============================================================
--  1) Filtro común: nadie publica teléfonos ni emails (se rechaza ANTES de
--     guardar, en un disparador; también antes de generar avisos, porque el
--     aviso solo se crea si el mensaje se guardó).
--  2) Meet Zone: chat por evento. Solo inscripción CONFIRMADA ('apuntado'; la
--     'espera' del lote 64 NO entra), el organizador y el admin. Se cierra 72 h
--     después del FIN del evento, calculado aquí (no en el navegador):
--       fin = fecha + hora_fin (Europe/Madrid); si hora_fin <= hora_inicio,
--             el evento acaba al día siguiente.
--       REGLA SIN hora_fin: fin = fecha a las 23:59:59 (el evento cuenta
--             hasta el final de su día). Cambiar fecha/hora recalcula solo.
--     Evento cancelado: solo lectura para los participantes; el organizador
--     puede escribir y fijar para explicarlo. Borrador: nadie salvo organizador.
--     Ritmo: 20 mensajes cada 5 minutos por persona.
--  3) Solicitudes de mensaje al DJ (tardícola → DJ): un primer mensaje; el DJ
--     acepta, rechaza, bloquea o pausa nuevas. Conversación solo si se acepta.
--     1 pendiente por persona y DJ, 5 solicitudes al día, 30 días de espera
--     tras un rechazo. Nunca privados entre tardícolas.
--  4) Entre Beats: hilos, respuestas y anuncios SOLO para es_profesional().
--  5) Denuncias (tabla genérica del lote 63): con 3 denuncias pendientes el
--     contenido queda RETENIDO (oculto a los demás) hasta que un admin decida.
--     El admin retira o desestima con resolver_denuncia() (deja auditoría).
--
-- Retirar el acceso NO borra nada (dossier pág. 6). Idempotente. Sin borrar datos.
-- =============================================================

-- 1) Filtro de teléfonos y emails --------------------------------------------
create or replace function private.contiene_contacto(p text)
returns boolean language sql immutable set search_path = public as $$
  select p is not null and (
    -- email normal u ofuscado ("nombre arroba gmail punto com", "(at)")
    p ~* '[a-z0-9._%+-]+\s*(@|\(at\)|\[at\]|\sarroba\s)\s*[a-z0-9-]+(\.|\s*punto\s*)[a-z]{2,}'
    -- teléfono: 9 o más cifras seguidas quitando espacios, puntos, guiones y paréntesis
    or regexp_replace(p, '[\s.\-()/]', '', 'g') ~ '\d{9,}'
    or regexp_replace(p, '[\s.\-()/]', '', 'g') ~ '(\+|00)\d{8,}'
  );
$$;
grant execute on function private.contiene_contacto(text) to anon, authenticated, service_role;

-- ¿Termina ya el evento? Fin + 72 h, en servidor.
create or replace function private.meet_cierre(p_tardeo uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select (case
            when t.hora_fin is null then (t.fecha + time '23:59:59')
            when t.hora_inicio is not null and t.hora_fin <= t.hora_inicio then (t.fecha + 1 + t.hora_fin)
            else (t.fecha + t.hora_fin)
          end) at time zone 'Europe/Madrid' + interval '72 hours'
  from public.tardeos t where t.id = p_tardeo;
$$;
revoke execute on function private.meet_cierre(uuid) from public;
grant execute on function private.meet_cierre(uuid) to authenticated, service_role;

-- 2) MEET ZONE ------------------------------------------------------------------
create table if not exists public.meet_mensajes (
  id uuid primary key default gen_random_uuid(),
  tardeo_id uuid not null references public.tardeos(id) on delete cascade,
  autor uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 1 and 500),
  retenido boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_meet_mensajes_tardeo on public.meet_mensajes (tardeo_id, created_at);
create index if not exists idx_fk_meet_mensajes_autor on public.meet_mensajes (autor, created_at desc);

create table if not exists public.meet_fijado (
  tardeo_id uuid primary key references public.tardeos(id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 1 and 400),
  autor uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists idx_fk_meet_fijado_autor on public.meet_fijado (autor);

-- Qué es la persona para este chat. Única fuente de verdad: la usan las
-- políticas, el disparador y la pantalla.
--   'no_sesion' | 'no_existe' | 'organizador' | 'admin' | 'participante'
--   | 'espera' | 'no_confirmado' | 'cerrado'
create or replace function private.meet_acceso(p_tardeo uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_estado text; v_local uuid; v_insc text;
begin
  if v_uid is null then return 'no_sesion'; end if;
  select t.estado, t.local_id into v_estado, v_local from public.tardeos t where t.id = p_tardeo;
  if not found then return 'no_existe'; end if;
  if now() > private.meet_cierre(p_tardeo) then return 'cerrado'; end if;
  if exists (select 1 from public.locales l where l.id = v_local and l.owner_id = v_uid) then return 'organizador'; end if;
  if coalesce((select is_admin from public.profiles where id = v_uid), false) then return 'admin'; end if;
  if v_estado = 'borrador' then return 'no_existe'; end if;
  select i.estado into v_insc from public.inscripciones i where i.tardeo_id = p_tardeo and i.profile_id = v_uid;
  if v_insc = 'apuntado' then return 'participante'; end if;
  if v_insc = 'espera' then return 'espera'; end if;
  return 'no_confirmado';
end $$;
revoke execute on function private.meet_acceso(uuid) from public;
grant execute on function private.meet_acceso(uuid) to authenticated, service_role;

create or replace function private.meet_puede_leer(p_tardeo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select private.meet_acceso(p_tardeo) in ('organizador', 'admin', 'participante');
$$;
revoke execute on function private.meet_puede_leer(uuid) from public;
grant execute on function private.meet_puede_leer(uuid) to authenticated, service_role;

create or replace function private.meet_puede_escribir(p_tardeo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case private.meet_acceso(p_tardeo)
           when 'organizador' then true
           when 'admin' then true
           when 'participante' then (select t.estado <> 'cancelado' from public.tardeos t where t.id = p_tardeo)
           else false end;
$$;
revoke execute on function private.meet_puede_escribir(uuid) from public;
grant execute on function private.meet_puede_escribir(uuid) to authenticated, service_role;

-- ¿Es admin? (versión interna para usar dentro de funciones privadas)
create or replace function private.soy_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
      or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role';
$$;
revoke execute on function private.soy_admin() from public;
grant execute on function private.soy_admin() to authenticated, service_role;

alter table public.meet_mensajes enable row level security;
alter table public.meet_fijado enable row level security;
grant select, insert on public.meet_mensajes to authenticated;
grant select on public.meet_fijado to authenticated;

drop policy if exists "meet_mensajes_select" on public.meet_mensajes;
create policy "meet_mensajes_select" on public.meet_mensajes for select to authenticated
  using ((select private.meet_puede_leer(tardeo_id))
         and (not retenido or autor = (select auth.uid()) or (select private.soy_admin())));
drop policy if exists "meet_mensajes_insert" on public.meet_mensajes;
create policy "meet_mensajes_insert" on public.meet_mensajes for insert to authenticated
  with check (autor = (select auth.uid()) and (select private.meet_puede_escribir(tardeo_id)));

drop policy if exists "meet_fijado_select" on public.meet_fijado;
create policy "meet_fijado_select" on public.meet_fijado for select to authenticated
  using ((select private.meet_puede_leer(tardeo_id)));

-- Disparador común de los mensajes: filtro + ritmo + campos que no decide el
-- navegador. Va antes de guardar, así que nada con teléfonos llega a la base
-- ni a los avisos.
create or replace function private.antes_mensaje_comunidad()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_txt text; v_n int;
begin
  -- Cada tabla tiene sus columnas: se leen por separado (una sola expresión
  -- con todas fallaría al no existir el campo en las otras tablas).
  if tg_table_name in ('eb_hilos', 'eb_anuncios') then
    v_txt := coalesce(new.titulo, '') || ' ' || coalesce(new.cuerpo, '');
  elsif tg_table_name = 'eb_respuestas' then
    v_txt := new.cuerpo;
  else
    v_txt := new.texto;
  end if;
  if private.contiene_contacto(v_txt) then
    raise exception 'No se pueden compartir teléfonos ni emails aquí' using errcode = 'P0001', hint = 'contacto';
  end if;
  if tg_table_name = 'meet_mensajes' then
    new.retenido := false; new.created_at := now();
    select count(*) into v_n from public.meet_mensajes
      where autor = new.autor and created_at > now() - interval '5 minutes';
    if v_n >= 20 then
      raise exception 'Vas muy rápido. Espera un par de minutos.' using errcode = 'P0001', hint = 'ritmo';
    end if;
  elsif tg_table_name = 'mensajes_dj' then
    new.retenido := false; new.created_at := now();
    select count(*) into v_n from public.mensajes_dj
      where autor = new.autor and created_at > now() - interval '5 minutes';
    if v_n >= 30 then
      raise exception 'Vas muy rápido. Espera un par de minutos.' using errcode = 'P0001', hint = 'ritmo';
    end if;
  elsif tg_table_name in ('eb_hilos', 'eb_respuestas', 'eb_anuncios') then
    new.retenido := false; new.created_at := now();
  end if;
  return new;
end $$;
revoke execute on function private.antes_mensaje_comunidad() from public, anon, authenticated;

drop trigger if exists trg_meet_mensajes_antes on public.meet_mensajes;
create trigger trg_meet_mensajes_antes before insert on public.meet_mensajes
  for each row execute function private.antes_mensaje_comunidad();

-- Estado de la Meet Zone para la pantalla (también sirve el evento: un tardeo
-- finalizado no se lee por la RLS de tardeos, pero su chat sigue 72 h).
create or replace function private.meet_estado(p_tardeo uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_acceso text; v jsonb;
begin
  v_acceso := private.meet_acceso(p_tardeo);
  if v_acceso = 'no_existe' then return jsonb_build_object('acceso', 'no_existe'); end if;
  select jsonb_build_object(
    'acceso', v_acceso,
    'puede_escribir', private.meet_puede_escribir(p_tardeo),
    'cierra_en', private.meet_cierre(p_tardeo),
    'titulo', t.titulo, 'fecha', t.fecha, 'hora_inicio', t.hora_inicio, 'hora_fin', t.hora_fin,
    'estado_evento', t.estado,
    'organizador', l.owner_id,
    'participantes', (select count(*) from public.inscripciones i where i.tardeo_id = t.id and i.estado = 'apuntado'),
    'fijado', case when v_acceso in ('organizador', 'admin', 'participante')
                   then (select f.texto from public.meet_fijado f where f.tardeo_id = t.id) end
  ) into v
  from public.tardeos t left join public.locales l on l.id = t.local_id where t.id = p_tardeo;
  return v;
end $$;
revoke execute on function private.meet_estado(uuid) from public;
grant execute on function private.meet_estado(uuid) to authenticated, service_role;
create or replace function public.meet_estado(p_tardeo uuid)
returns jsonb language sql stable security invoker set search_path = public
as $$ select private.meet_estado($1) $$;
grant execute on function public.meet_estado(uuid) to authenticated;

-- Fijar (o quitar con texto vacío) el mensaje del organizador.
create or replace function private.meet_fijar(p_tardeo uuid, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if private.meet_acceso(p_tardeo) not in ('organizador', 'admin') then
    raise exception 'Solo el organizador puede fijar un mensaje';
  end if;
  if coalesce(btrim(p_texto), '') = '' then
    delete from public.meet_fijado where tardeo_id = p_tardeo;  -- quitar el fijado (no es contenido de nadie más)
    return;
  end if;
  if private.contiene_contacto(p_texto) then
    raise exception 'No se pueden compartir teléfonos ni emails aquí' using errcode = 'P0001', hint = 'contacto';
  end if;
  insert into public.meet_fijado (tardeo_id, texto, autor, updated_at)
  values (p_tardeo, btrim(p_texto), auth.uid(), now())
  on conflict (tardeo_id) do update set texto = excluded.texto, autor = excluded.autor, updated_at = now();
end $$;
revoke execute on function private.meet_fijar(uuid, text) from public;
grant execute on function private.meet_fijar(uuid, text) to authenticated, service_role;
create or replace function public.meet_fijar(p_tardeo uuid, p_texto text)
returns void language sql security invoker set search_path = public
as $$ select private.meet_fijar($1, $2) $$;
grant execute on function public.meet_fijar(uuid, text) to authenticated;

-- 3) SOLICITUDES DE MENSAJE AL DJ -------------------------------------------------
create table if not exists public.solicitudes_mensaje (
  id uuid primary key default gen_random_uuid(),
  de uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  dj_id uuid not null references public.djs(id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 1 and 500),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada')),
  retenido boolean not null default false,
  respondida_en timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_solicitud_viva on public.solicitudes_mensaje (de, dj_id) where estado in ('pendiente', 'aceptada');
create index if not exists idx_fk_solicitudes_de on public.solicitudes_mensaje (de, created_at desc);
create index if not exists idx_fk_solicitudes_dj on public.solicitudes_mensaje (dj_id, estado, created_at desc);

create table if not exists public.mensajes_dj (
  id uuid primary key default gen_random_uuid(),
  conversacion uuid not null references public.solicitudes_mensaje(id) on delete cascade,
  autor uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 1 and 1000),
  retenido boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_fk_mensajes_dj_conv on public.mensajes_dj (conversacion, created_at);
create index if not exists idx_fk_mensajes_dj_autor on public.mensajes_dj (autor, created_at desc);

create table if not exists public.bloqueos (
  dj_id uuid not null references public.djs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (dj_id, profile_id)
);
create index if not exists idx_fk_bloqueos_profile on public.bloqueos (profile_id);

-- "Limitar": el DJ pausa las solicitudes nuevas.
create table if not exists public.dj_mensajes_ajustes (
  dj_id uuid primary key references public.djs(id) on delete cascade,
  acepta_solicitudes boolean not null default true,
  updated_at timestamptz not null default now()
);

create or replace function private.es_mi_dj(p_dj uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.djs d where d.id = p_dj and d.profile_id = auth.uid());
$$;
revoke execute on function private.es_mi_dj(uuid) from public;
grant execute on function private.es_mi_dj(uuid) to authenticated, service_role;

-- ¿Puedo leer/escribir en esta conversación? (aceptada, soy una de las dos
-- partes y no hay bloqueo)
create or replace function private.en_conversacion(p_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.solicitudes_mensaje s join public.djs d on d.id = s.dj_id
    where s.id = p_conv and s.estado = 'aceptada'
      and (s.de = auth.uid() or d.profile_id = auth.uid())
      and not exists (select 1 from public.bloqueos b where b.dj_id = s.dj_id and b.profile_id = s.de));
$$;
revoke execute on function private.en_conversacion(uuid) from public;
grant execute on function private.en_conversacion(uuid) to authenticated, service_role;

alter table public.solicitudes_mensaje enable row level security;
alter table public.mensajes_dj enable row level security;
alter table public.bloqueos enable row level security;
alter table public.dj_mensajes_ajustes enable row level security;
grant select on public.solicitudes_mensaje to authenticated;
grant select, insert on public.mensajes_dj to authenticated;
grant select on public.bloqueos to authenticated;
grant select on public.dj_mensajes_ajustes to authenticated;

drop policy if exists "solicitudes_select" on public.solicitudes_mensaje;
create policy "solicitudes_select" on public.solicitudes_mensaje for select to authenticated
  using (de = (select auth.uid()) or (select private.es_mi_dj(dj_id)) or (select private.soy_admin()));
drop policy if exists "mensajes_dj_select" on public.mensajes_dj;
create policy "mensajes_dj_select" on public.mensajes_dj for select to authenticated
  using (((select private.en_conversacion(conversacion)) and (not retenido or autor = (select auth.uid())))
         or (select private.soy_admin()));
drop policy if exists "mensajes_dj_insert" on public.mensajes_dj;
create policy "mensajes_dj_insert" on public.mensajes_dj for insert to authenticated
  with check (autor = (select auth.uid()) and (select private.en_conversacion(conversacion)));
drop policy if exists "bloqueos_select" on public.bloqueos;
create policy "bloqueos_select" on public.bloqueos for select to authenticated
  using ((select private.es_mi_dj(dj_id)) or (select private.soy_admin()));
drop policy if exists "dj_ajustes_select" on public.dj_mensajes_ajustes;
create policy "dj_ajustes_select" on public.dj_mensajes_ajustes for select to authenticated
  using ((select private.es_mi_dj(dj_id)) or (select private.soy_admin()));

drop trigger if exists trg_mensajes_dj_antes on public.mensajes_dj;
create trigger trg_mensajes_dj_antes before insert on public.mensajes_dj
  for each row execute function private.antes_mensaje_comunidad();

-- Aviso al otro lado cuando llega un mensaje (uno por conversación y día, para
-- no llenar la campana).
create or replace function private.tras_mensaje_dj()
returns trigger language plpgsql security definer set search_path = public as $$
declare s record; v_dest uuid; v_url text;
begin
  select sm.de, d.profile_id as dj_prof, d.nombre_artistico, sm.id into s
    from public.solicitudes_mensaje sm join public.djs d on d.id = sm.dj_id where sm.id = new.conversacion;
  if new.autor = s.de then v_dest := s.dj_prof; v_url := '/dj/mensajes?c=' || s.id;
  else v_dest := s.de; v_url := '/mensajes?c=' || s.id; end if;
  if v_dest is not null then
    perform private.crear_aviso(v_dest, 'mensaje', 'Tienes un mensaje nuevo',
      case when new.autor = s.de then null else s.nombre_artistico || ' te ha escrito' end,
      v_url, 'msg:' || s.id || ':' || to_char(now() at time zone 'Europe/Madrid', 'YYYYMMDD'));
  end if;
  return null;
end $$;
revoke execute on function private.tras_mensaje_dj() from public, anon, authenticated;
drop trigger if exists trg_mensajes_dj_tras on public.mensajes_dj;
create trigger trg_mensajes_dj_tras after insert on public.mensajes_dj
  for each row execute function private.tras_mensaje_dj();

-- Enviar solicitud. Todo lo que limita se comprueba aquí.
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
  if exists (select 1 from public.solicitudes_mensaje s where s.de = v_uid and s.dj_id = p_dj
             and s.estado = 'rechazada' and s.respondida_en > now() - interval '30 days') then
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
create or replace function public.enviar_solicitud_dj(p_dj uuid, p_texto text)
returns uuid language sql security invoker set search_path = public
as $$ select private.enviar_solicitud_dj($1, $2) $$;
grant execute on function public.enviar_solicitud_dj(uuid, text) to authenticated;

-- El DJ responde: 'aceptar' | 'rechazar' | 'bloquear' | 'desbloquear'.
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
    update public.solicitudes_mensaje set estado = 'rechazada', respondida_en = now()
      where id = p_solicitud and estado in ('pendiente', 'aceptada');
  elsif p_accion = 'bloquear' then
    insert into public.bloqueos (dj_id, profile_id) values (s.dj_id, s.de) on conflict do nothing;
    update public.solicitudes_mensaje set estado = 'rechazada', respondida_en = now()
      where dj_id = s.dj_id and de = s.de and estado in ('pendiente', 'aceptada');
  elsif p_accion = 'desbloquear' then
    delete from public.bloqueos where dj_id = s.dj_id and profile_id = s.de;  -- quitar el bloqueo, no datos
  else
    raise exception 'Acción desconocida';
  end if;
end $$;
revoke execute on function private.responder_solicitud_dj(uuid, text) from public;
grant execute on function private.responder_solicitud_dj(uuid, text) to authenticated, service_role;
create or replace function public.responder_solicitud_dj(p_solicitud uuid, p_accion text)
returns void language sql security invoker set search_path = public
as $$ select private.responder_solicitud_dj($1, $2) $$;
grant execute on function public.responder_solicitud_dj(uuid, text) to authenticated;

create or replace function private.limitar_solicitudes_dj(p_dj uuid, p_acepta boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.es_mi_dj(p_dj) then raise exception 'Este perfil de DJ no es tuyo'; end if;
  insert into public.dj_mensajes_ajustes (dj_id, acepta_solicitudes, updated_at) values (p_dj, p_acepta, now())
  on conflict (dj_id) do update set acepta_solicitudes = excluded.acepta_solicitudes, updated_at = now();
end $$;
revoke execute on function private.limitar_solicitudes_dj(uuid, boolean) from public;
grant execute on function private.limitar_solicitudes_dj(uuid, boolean) to authenticated, service_role;
create or replace function public.limitar_solicitudes_dj(p_dj uuid, p_acepta boolean)
returns void language sql security invoker set search_path = public
as $$ select private.limitar_solicitudes_dj($1, $2) $$;
grant execute on function public.limitar_solicitudes_dj(uuid, boolean) to authenticated;

-- 4) ENTRE BEATS (solo profesionales) ---------------------------------------------
create table if not exists public.eb_hilos (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  cuerpo text not null check (char_length(btrim(cuerpo)) between 1 and 3000),
  tema text,
  zona text,
  retenido boolean not null default false,
  created_at timestamptz not null default now(),
  busqueda tsvector generated always as
    (to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(cuerpo, '') || ' ' || coalesce(tema, ''))) stored
);
create index if not exists idx_eb_hilos_fecha on public.eb_hilos (created_at desc);
create index if not exists idx_eb_hilos_busqueda on public.eb_hilos using gin (busqueda);
create index if not exists idx_fk_eb_hilos_autor on public.eb_hilos (autor);

create table if not exists public.eb_respuestas (
  id uuid primary key default gen_random_uuid(),
  hilo_id uuid not null references public.eb_hilos(id) on delete cascade,
  autor uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  cuerpo text not null check (char_length(btrim(cuerpo)) between 1 and 2000),
  retenido boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_fk_eb_respuestas_hilo on public.eb_respuestas (hilo_id, created_at);
create index if not exists idx_fk_eb_respuestas_autor on public.eb_respuestas (autor);

create table if not exists public.eb_anuncios (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  categoria text not null check (categoria in ('busco_dj', 'busco_local', 'colaboracion', 'material', 'otro')),
  titulo text not null check (char_length(btrim(titulo)) between 3 and 120),
  cuerpo text not null check (char_length(btrim(cuerpo)) between 1 and 2000),
  zona text,
  estilos text[] not null default '{}',
  -- Contacto que el autor decide hacer público SOLO a profesionales (es la
  -- vía de "Contactar"). Es el único campo exento del filtro de teléfonos.
  contacto text not null check (char_length(btrim(contacto)) between 3 and 120),
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  retenido boolean not null default false,
  created_at timestamptz not null default now(),
  busqueda tsvector generated always as
    (to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(cuerpo, '') || ' ' || coalesce(zona, ''))) stored
);
create index if not exists idx_eb_anuncios_fecha on public.eb_anuncios (estado, created_at desc);
create index if not exists idx_eb_anuncios_busqueda on public.eb_anuncios using gin (busqueda);
create index if not exists idx_fk_eb_anuncios_autor on public.eb_anuncios (autor);

alter table public.eb_hilos enable row level security;
alter table public.eb_respuestas enable row level security;
alter table public.eb_anuncios enable row level security;
grant select, insert on public.eb_hilos, public.eb_respuestas, public.eb_anuncios to authenticated;
-- El autor solo puede abrir/cerrar su anuncio; "retenido" lo decide el admin
-- por función.
grant update (estado) on public.eb_anuncios to authenticated;

drop policy if exists "eb_hilos_select" on public.eb_hilos;
create policy "eb_hilos_select" on public.eb_hilos for select to authenticated
  using ((select private.es_profesional()) and (not retenido or autor = (select auth.uid()) or (select private.soy_admin())));
drop policy if exists "eb_hilos_insert" on public.eb_hilos;
create policy "eb_hilos_insert" on public.eb_hilos for insert to authenticated
  with check ((select private.es_profesional()) and autor = (select auth.uid()));

drop policy if exists "eb_respuestas_select" on public.eb_respuestas;
create policy "eb_respuestas_select" on public.eb_respuestas for select to authenticated
  using ((select private.es_profesional()) and (not retenido or autor = (select auth.uid()) or (select private.soy_admin())));
drop policy if exists "eb_respuestas_insert" on public.eb_respuestas;
create policy "eb_respuestas_insert" on public.eb_respuestas for insert to authenticated
  with check ((select private.es_profesional()) and autor = (select auth.uid())
              and exists (select 1 from public.eb_hilos h where h.id = hilo_id and not h.retenido));

drop policy if exists "eb_anuncios_select" on public.eb_anuncios;
create policy "eb_anuncios_select" on public.eb_anuncios for select to authenticated
  using ((select private.es_profesional()) and (not retenido or autor = (select auth.uid()) or (select private.soy_admin())));
drop policy if exists "eb_anuncios_insert" on public.eb_anuncios;
create policy "eb_anuncios_insert" on public.eb_anuncios for insert to authenticated
  with check ((select private.es_profesional()) and autor = (select auth.uid()) and estado = 'abierto');
drop policy if exists "eb_anuncios_update" on public.eb_anuncios;
create policy "eb_anuncios_update" on public.eb_anuncios for update to authenticated
  using (autor = (select auth.uid()) and (select private.es_profesional()))
  with check (autor = (select auth.uid()));

drop trigger if exists trg_eb_hilos_antes on public.eb_hilos;
create trigger trg_eb_hilos_antes before insert on public.eb_hilos
  for each row execute function private.antes_mensaje_comunidad();
drop trigger if exists trg_eb_respuestas_antes on public.eb_respuestas;
create trigger trg_eb_respuestas_antes before insert on public.eb_respuestas
  for each row execute function private.antes_mensaje_comunidad();
drop trigger if exists trg_eb_anuncios_antes on public.eb_anuncios;
create trigger trg_eb_anuncios_antes before insert on public.eb_anuncios
  for each row execute function private.antes_mensaje_comunidad();

-- Nombre visible de un profesional en Entre Beats: nombre artístico si es DJ,
-- nombre del local si tiene uno, si no su alias. Solo para profesionales.
create or replace function private.eb_autores(p_ids uuid[])
returns table (id uuid, nombre text, rol text, dj_id uuid)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce((select d.nombre_artistico from public.djs d where d.profile_id = p.id order by d.created_at limit 1),
                  (select l.nombre from public.locales l where l.owner_id = p.id order by l.created_at limit 1),
                  p.alias, split_part(coalesce(p.display_name, 'Profesional'), ' ', 1)),
         case when exists (select 1 from public.djs d where d.profile_id = p.id) then 'DJ'
              when exists (select 1 from public.locales l where l.owner_id = p.id) then 'Organizador'
              when p.is_admin then 'Equipo' else 'Profesional' end,
         (select d.id from public.djs d where d.profile_id = p.id and not d.oculto order by d.created_at limit 1)
  from public.profiles p
  where p.id = any(p_ids) and private.es_profesional();
$$;
revoke execute on function private.eb_autores(uuid[]) from public;
grant execute on function private.eb_autores(uuid[]) to authenticated, service_role;
create or replace function public.eb_autores(p_ids uuid[])
returns table (id uuid, nombre text, rol text, dj_id uuid)
language sql stable security invoker set search_path = public
as $$ select * from private.eb_autores($1) $$;
grant execute on function public.eb_autores(uuid[]) to authenticated;

-- 5) DENUNCIAS: retención automática y resolución --------------------------------
-- Con 3 denuncias pendientes de personas distintas el contenido se retiene
-- (deja de verse salvo para su autor y el admin) hasta revisión humana.
create or replace function private.retener_contenido(p_tipo text, p_id text, p_valor boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_id !~ '^[0-9a-f-]{36}$' then return; end if;
  case p_tipo
    when 'meet_mensaje' then update public.meet_mensajes set retenido = p_valor where id = p_id::uuid;
    when 'mensaje_dj'   then
      -- El id puede ser un mensaje o la propia solicitud (primer mensaje).
      update public.mensajes_dj set retenido = p_valor where id = p_id::uuid;
      update public.solicitudes_mensaje set retenido = p_valor where id = p_id::uuid;
    when 'eb_hilo'      then update public.eb_hilos      set retenido = p_valor where id = p_id::uuid;
    when 'eb_respuesta' then update public.eb_respuestas set retenido = p_valor where id = p_id::uuid;
    when 'eb_anuncio'   then update public.eb_anuncios   set retenido = p_valor where id = p_id::uuid;
    else null;
  end case;
end $$;
revoke execute on function private.retener_contenido(text, text, boolean) from public, anon, authenticated;
grant execute on function private.retener_contenido(text, text, boolean) to service_role;

create or replace function private.tras_denuncia_comunidad()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.denuncias d
      where d.tipo_objeto = new.tipo_objeto and d.objeto_id = new.objeto_id and d.estado = 'pendiente') >= 3 then
    perform private.retener_contenido(new.tipo_objeto, new.objeto_id, true);
  end if;
  return null;
end $$;
revoke execute on function private.tras_denuncia_comunidad() from public, anon, authenticated;
drop trigger if exists trg_denuncias_retener on public.denuncias;
create trigger trg_denuncias_retener after insert on public.denuncias
  for each row execute function private.tras_denuncia_comunidad();

-- Lo denunciado, para la cola del admin (texto, autor, dónde está).
create or replace function private.contenido_denunciado(p_tipos text[], p_ids text[])
returns table (tipo text, id text, texto text, autor uuid, autor_alias text, contexto text, url text, retenido boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.soy_admin() then raise exception 'Solo un administrador'; end if;
  return query
  with q as (select unnest(p_tipos) as t, unnest(p_ids) as i)
  select q.t, q.i, c.texto, c.autor,
         (select coalesce(p.alias, p.display_name) from public.profiles p where p.id = c.autor),
         c.contexto, c.url, c.retenido
  from q
  left join lateral (
    select m.texto, m.autor, ('Meet Zone · ' || t.titulo) as contexto, ('/tardeos/' || t.id || '/meet') as url, m.retenido
      from public.meet_mensajes m join public.tardeos t on t.id = m.tardeo_id
      where q.t = 'meet_mensaje' and m.id::text = q.i
    union all
    select m.texto, m.autor, 'Mensaje a DJ', null, m.retenido from public.mensajes_dj m
      where q.t = 'mensaje_dj' and m.id::text = q.i
    union all
    select s.texto, s.de, 'Solicitud de mensaje a DJ', null, s.retenido from public.solicitudes_mensaje s
      where q.t = 'mensaje_dj' and s.id::text = q.i
    union all
    select h.titulo || E'\n' || h.cuerpo, h.autor, 'Entre Beats · hilo', '/entre-beats?hilo=' || h.id, h.retenido
      from public.eb_hilos h where q.t = 'eb_hilo' and h.id::text = q.i
    union all
    select r.cuerpo, r.autor, 'Entre Beats · respuesta', '/entre-beats?hilo=' || r.hilo_id, r.retenido
      from public.eb_respuestas r where q.t = 'eb_respuesta' and r.id::text = q.i
    union all
    select a.titulo || E'\n' || a.cuerpo, a.autor, 'Entre Beats · anuncio', '/entre-beats?tab=anuncios', a.retenido
      from public.eb_anuncios a where q.t = 'eb_anuncio' and a.id::text = q.i
    limit 1
  ) c on true;
end $$;
revoke execute on function private.contenido_denunciado(text[], text[]) from public;
grant execute on function private.contenido_denunciado(text[], text[]) to authenticated, service_role;
create or replace function public.contenido_denunciado(p_tipos text[], p_ids text[])
returns table (tipo text, id text, texto text, autor uuid, autor_alias text, contexto text, url text, retenido boolean)
language sql stable security invoker set search_path = public
as $$ select * from private.contenido_denunciado($1, $2) $$;
grant execute on function public.contenido_denunciado(text[], text[]) to authenticated;

-- Resolver: 'retirar' oculta el contenido y cierra TODAS las denuncias
-- pendientes de ese objeto; 'desestimar' las cierra y, si estaba retenido
-- automáticamente, lo vuelve a mostrar. Deja rastro en auditoria.
create or replace function private.resolver_denuncia(p_denuncia uuid, p_accion text)
returns void language plpgsql security definer set search_path = public as $$
declare d record; v_estado text;
begin
  if not private.soy_admin() then raise exception 'Solo un administrador'; end if;
  select * into d from public.denuncias where id = p_denuncia;
  if not found then raise exception 'La denuncia no existe'; end if;
  if p_accion = 'retirar' then v_estado := 'retirado';
  elsif p_accion = 'desestimar' then v_estado := 'desestimado';
  else raise exception 'Acción desconocida'; end if;
  update public.denuncias set estado = v_estado, resuelta_por = auth.uid(), resuelta_en = now()
    where tipo_objeto = d.tipo_objeto and objeto_id = d.objeto_id and estado = 'pendiente';
  perform private.retener_contenido(d.tipo_objeto, d.objeto_id, p_accion = 'retirar');
  perform private.auditar(p_accion, 'denuncia', p_denuncia::text, null,
    jsonb_build_object('tipo_objeto', d.tipo_objeto, 'objeto_id', d.objeto_id, 'motivo', d.motivo));
end $$;
revoke execute on function private.resolver_denuncia(uuid, text) from public;
grant execute on function private.resolver_denuncia(uuid, text) to authenticated, service_role;
create or replace function public.resolver_denuncia(p_denuncia uuid, p_accion text)
returns void language sql security invoker set search_path = public
as $$ select private.resolver_denuncia($1, $2) $$;
grant execute on function public.resolver_denuncia(uuid, text) to authenticated;

-- 6) Tiempo real: Meet Zone y conversaciones con DJ --------------------------------
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Sin publicación supabase_realtime (base local): se omite';
    return;
  end if;
  foreach t in array array['meet_mensajes', 'mensajes_dj'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
