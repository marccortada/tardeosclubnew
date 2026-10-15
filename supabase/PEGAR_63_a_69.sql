-- ============================================================
-- TardeosClub · PAQUETE ÚNICO: lotes 63 a 69 (versión 2.0, dossier 14-oct-2026)
-- Pegar ENTERO en Supabase → SQL Editor → Run. Se puede pegar más de una vez.
-- Requiere 01-62 (ya en producción). No borra ningún dato.
-- ============================================================


-- >>>>>>>>>>>>>>>>>>>> 63_base_v2.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- TardeosClub · LOTE 63: BASE COMÚN DE LA VERSIÓN 2.0 (dossier 14‑oct‑2026)
-- =============================================================
-- Piezas que usan varios módulos nuevos a la vez. Van primero para que los
-- lotes 64‑69 puedan apoyarse en ellas:
--
--  1) private.es_profesional(): DJ, local, promotor o admin. Decide quién ve
--     Entre Beats y los press kits. Con envoltorio en public (patrón lote 60).
--  2) zonas: catálogo único. Cada zona del buscador cuelga de una ZONA MADRE
--     (barcelona / tarragona / girona), que es la que reparte el trabajo del
--     admin (Álex, Sergi, Girona) y la marca que publica en cada una.
--  3) avisos: la bandeja de la campana. Una fila por aviso y persona.
--  4) auditoria: quién hizo qué en el panel (colas, listas, sorteos…).
--  5) denuncias: genérica para chat, hilos, perfiles, comentarios… (la de
--     flyers del lote 42 se queda como está).
--  6) profiles: alias, presentación y tema claro/oscuro.
--
-- No toca datos existentes. Idempotente.
-- =============================================================

-- 1) ¿Es profesional? -------------------------------------------------------
create or replace function private.es_profesional()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
      or exists (select 1 from public.locales where owner_id = auth.uid())
      or exists (select 1 from public.djs where profile_id = auth.uid());
$$;
revoke execute on function private.es_profesional() from public;
grant execute on function private.es_profesional() to anon, authenticated, service_role;

create or replace function public.es_profesional()
returns boolean language sql stable security invoker set search_path = public
as $$ select private.es_profesional() $$;

-- 2) Zonas -----------------------------------------------------------------
create table if not exists public.zonas (
  slug text primary key,
  nombre text not null,
  zona_madre text not null check (zona_madre in ('barcelona', 'tarragona', 'girona')),
  -- Marca que publica en la zona madre (dossier pág. 4).
  marca text,
  orden int not null default 0
);
alter table public.zonas enable row level security;
grant select on public.zonas to anon, authenticated;
grant insert, update on public.zonas to authenticated;
drop policy if exists "zonas_select" on public.zonas;
create policy "zonas_select" on public.zonas for select using (true);
drop policy if exists "zonas_admin" on public.zonas;
create policy "zonas_admin" on public.zonas for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "zonas_admin_upd" on public.zonas;
create policy "zonas_admin_upd" on public.zonas for update to authenticated using ((select public.is_admin()));

insert into public.zonas (slug, nombre, zona_madre, marca, orden) values
  ('barcelona',        'Barcelona',          'barcelona', 'Tardeos Club',        1),
  ('maresme',          'Maresme',            'barcelona', 'Tardeos Club',        2),
  ('costa-brava',      'Costa Brava',        'girona',    'El Ritmo del Sonido', 3),
  ('girona',           'Girona',             'girona',    'El Ritmo del Sonido', 4),
  ('costa-daurada',    'Costa Daurada',      'tarragona', 'Tardeo Tarragona',    5),
  ('tarragona',        'Tarragona',          'tarragona', 'Tardeo Tarragona',    6),
  ('terres-de-lebre',  'Terres de l''Ebre',  'tarragona', 'Tardeo Tarragona',    7),
  ('ponent',           'Ponent',             'barcelona', 'Tardeos Club',        8)
on conflict (slug) do nothing;

-- 3) Bandeja de avisos ------------------------------------------------------
create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null,          -- 'recordatorio', 'fin_evento', 'cambio', 'cancelacion', 'espera', 'mensaje', 'sorteo', 'encuesta', 'sistema'…
  titulo text not null,
  cuerpo text,
  url text,                    -- ruta interna a la que lleva (/tardeos/…)
  clave text,                  -- para no repetir el mismo aviso (p. ej. 'fin:<tardeo>')
  leido_en timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_avisos_clave on public.avisos (profile_id, clave) where clave is not null;
create index if not exists idx_avisos_bandeja on public.avisos (profile_id, created_at desc);
alter table public.avisos enable row level security;
grant select, delete on public.avisos to authenticated;
drop policy if exists "avisos_select" on public.avisos;
create policy "avisos_select" on public.avisos for select to authenticated
  using (profile_id = (select auth.uid()));
drop policy if exists "avisos_update" on public.avisos;
create policy "avisos_update" on public.avisos for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
drop policy if exists "avisos_delete" on public.avisos;
create policy "avisos_delete" on public.avisos for delete to authenticated
  using (profile_id = (select auth.uid()));
-- Solo se marca como leído: el resto de columnas no se toca desde el navegador.
revoke update on public.avisos from authenticated;
grant update (leido_en) on public.avisos to authenticated;

-- Crear avisos: lo hacen el servidor (service role) y las funciones del
-- sistema (Meet Zone, espera, sorteos…), nunca un usuario a otro.
create or replace function private.crear_aviso(p_profile uuid, p_tipo text, p_titulo text, p_cuerpo text, p_url text, p_clave text)
returns void language sql security definer set search_path = public as $$
  insert into public.avisos (profile_id, tipo, titulo, cuerpo, url, clave)
  values (p_profile, p_tipo, p_titulo, p_cuerpo, p_url, p_clave)
  on conflict (profile_id, clave) where clave is not null do nothing;
$$;
revoke execute on function private.crear_aviso(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function private.crear_aviso(uuid, text, text, text, text, text) to service_role;

-- 4) Auditoría --------------------------------------------------------------
create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  actor uuid references public.profiles(id) on delete set null,
  accion text not null,        -- 'aprobar', 'rechazar', 'promover_espera', 'publicar_ganador'…
  entidad text not null,       -- 'tardeo', 'local', 'dj', 'inscripcion', 'denuncia'…
  entidad_id text,
  zona_madre text,
  detalle jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_auditoria_fecha on public.auditoria (created_at desc);
create index if not exists idx_auditoria_entidad on public.auditoria (entidad, entidad_id);
create index if not exists idx_fk_auditoria_actor on public.auditoria (actor);
alter table public.auditoria enable row level security;
grant select on public.auditoria to authenticated;
drop policy if exists "auditoria_select" on public.auditoria;
create policy "auditoria_select" on public.auditoria for select to authenticated
  using ((select public.is_admin()));
-- Nadie la edita ni la borra: un rastro que se puede tocar no es rastro.

create or replace function private.auditar(p_accion text, p_entidad text, p_entidad_id text, p_zona text, p_detalle jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.auditoria (actor, accion, entidad, entidad_id, zona_madre, detalle)
  values (auth.uid(), p_accion, p_entidad, p_entidad_id, p_zona, p_detalle);
$$;
revoke execute on function private.auditar(text, text, text, text, jsonb) from public, anon;
grant execute on function private.auditar(text, text, text, text, jsonb) to authenticated, service_role;

-- Envoltorio para que el panel pueda dejar rastro de lo que hace (solo admin).
create or replace function public.auditar(p_accion text, p_entidad text, p_entidad_id text, p_zona text default null, p_detalle jsonb default null)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador'; end if;
  perform private.auditar(p_accion, p_entidad, p_entidad_id, p_zona, p_detalle);
end $$;
revoke execute on function public.auditar(text, text, text, text, jsonb) from public, anon;
grant execute on function public.auditar(text, text, text, text, jsonb) to authenticated, service_role;

-- 5) Denuncias genéricas ----------------------------------------------------
create table if not exists public.denuncias (
  id uuid primary key default gen_random_uuid(),
  denunciante uuid references public.profiles(id) on delete set null,
  tipo_objeto text not null check (tipo_objeto in
    ('meet_mensaje', 'mensaje_dj', 'eb_hilo', 'eb_respuesta', 'eb_anuncio', 'set_comentario', 'perfil', 'otro')),
  objeto_id text not null,
  motivo text not null check (motivo in ('spam', 'ofensivo', 'datos_personales', 'acoso', 'otro')),
  mensaje text check (char_length(mensaje) <= 500),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'retirado', 'desestimado')),
  resuelta_por uuid references public.profiles(id) on delete set null,
  resuelta_en timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_denuncia_pendiente on public.denuncias (denunciante, tipo_objeto, objeto_id) where estado = 'pendiente';
create index if not exists idx_denuncias_cola on public.denuncias (estado, created_at desc);
create index if not exists idx_fk_denuncias_resuelta_por on public.denuncias (resuelta_por);
alter table public.denuncias enable row level security;
grant select, insert, update on public.denuncias to authenticated;
drop policy if exists "denuncias_g_insert" on public.denuncias;
create policy "denuncias_g_insert" on public.denuncias for insert to authenticated
  with check (denunciante = (select auth.uid()) and estado = 'pendiente');
drop policy if exists "denuncias_g_select" on public.denuncias;
create policy "denuncias_g_select" on public.denuncias for select to authenticated
  using ((select public.is_admin()) or denunciante = (select auth.uid()));
drop policy if exists "denuncias_g_update" on public.denuncias;
create policy "denuncias_g_update" on public.denuncias for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- 6) Perfil público del tardícola -------------------------------------------
alter table public.profiles add column if not exists alias text check (char_length(alias) between 2 and 30);
alter table public.profiles add column if not exists bio text check (char_length(bio) <= 300);
alter table public.profiles add column if not exists tema text not null default 'claro' check (tema in ('claro', 'oscuro'));
create unique index if not exists uq_profiles_alias on public.profiles (lower(alias)) where alias is not null;

-- Lo público de una persona: alias, foto, presentación y estilos. Nunca email,
-- teléfono, ADN completo ni historial (dossier pág. 6 y 9).
create or replace function private.perfil_publico(p_ids uuid[])
returns table (id uuid, alias text, avatar_url text, bio text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.alias, split_part(coalesce(p.display_name, 'Tardícola'), ' ', 1)), p.avatar_url, p.bio
  from public.profiles p where p.id = any(p_ids);
$$;
revoke execute on function private.perfil_publico(uuid[]) from public;
grant execute on function private.perfil_publico(uuid[]) to anon, authenticated, service_role;
create or replace function public.perfil_publico(p_ids uuid[])
returns table (id uuid, alias text, avatar_url text, bio text)
language sql stable security invoker set search_path = public
as $$ select * from private.perfil_publico($1) $$;

notify pgrst, 'reload schema';


-- >>>>>>>>>>>>>>>>>>>> 64_asistire_espera.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> 65_musica.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- TardeosClub · LOTE 65: MÚSICA (dossier 2.0, págs. 7 y 8) — equipo B
-- =============================================================
-- 1) djs: banner_url, ciudad y contador de seguidores.
-- 2) PRESS KIT SOLO PROFESIONALES: `djs.presskit_url` deja de leerse por
--    anon/authenticated. Se lee con presskit_de(dj), que solo devuelve la URL
--    a un profesional (es_profesional(), lote 63) o al dueño.
--    POR QUÉ HAY QUE QUITAR EL SELECT DE TABLA: Supabase concede SELECT a nivel
--    de tabla; mientras exista, un revoke de columna no hace nada (ver lote 14).
--    Se quita el de tabla y se devuelven TODAS las demás columnas una a una.
--    MANTENIMIENTO: una columna nueva en `djs` nace invisible para la app
--    hasta que se le haga `grant select (col) on public.djs to anon, authenticated`.
-- 3) sets: entidad propia. DECISIÓN: tabla nueva y no reutilizar dj_contenidos,
--    porque un set necesita plataforma, portada, estilos, destacado, orden y
--    contadores, y dj_contenidos sigue sirviendo para fotos y flyers. Las
--    sesiones y vídeos que ya hay en dj_contenidos se COPIAN (no se mueven ni
--    se borran) a sets, enlazados por `contenido_id` (único → idempotente).
-- 4) seguidores_dj, sets_likes, sets_guardados, sets_comentarios (+ respuesta
--    del DJ dueño). Contadores mantenidos por disparador (no count(*) por fila).
-- 5) nexo_envios (el DJ envía sesión; admin revisa) y nexo_programacion.
-- 6) feed_djs(): feed vertical "Para ti" / "Siguiendo" en una sola llamada.
-- Idempotente. No borra datos.
-- =============================================================

-- 1) Columnas nuevas de djs -------------------------------------------------
alter table public.djs add column if not exists banner_url text;
alter table public.djs add column if not exists ciudad text;
alter table public.djs add column if not exists seguidores integer not null default 0;

-- 2) Press kit solo profesionales -------------------------------------------
revoke select on public.djs from anon, authenticated;
revoke select (presskit_url) on public.djs from anon, authenticated;
grant select (
  id, profile_id, nombre_artistico, bio, estilos, galeria, redes, verificado,
  reputacion_score, oculto, created_at, avatar_url, origen_id, destacado_orden,
  zonas, contacto, playlist_url, plan, plan_estado, plan_desde, plan_hasta,
  pago_proveedor, pago_referencia, plan_notas, banner_url, ciudad, seguidores
) on public.djs to anon, authenticated;
-- El dueño SIGUE pudiendo escribirla (update), solo no leerla por la tabla.
-- El contador lo lleva el disparador: nadie lo toca a mano.
revoke update (seguidores) on public.djs from anon, authenticated;

create or replace function private.presskit_de(p_dj uuid)
returns text language sql stable security definer set search_path = public as $$
  select d.presskit_url from public.djs d
  where d.id = p_dj
    and (private.es_profesional() or d.profile_id = auth.uid());
$$;
revoke execute on function private.presskit_de(uuid) from public;
grant execute on function private.presskit_de(uuid) to anon, authenticated, service_role;

create or replace function public.presskit_de(p_dj uuid)
returns text language sql stable security invoker set search_path = public
as $$ select private.presskit_de(p_dj) $$;
grant execute on function public.presskit_de(uuid) to anon, authenticated, service_role;

-- 3) Sets --------------------------------------------------------------------
create table if not exists public.sets (
  id uuid primary key default gen_random_uuid(),
  dj_id uuid not null references public.djs(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 140),
  url text not null check (url ~* '^https?://'),
  plataforma text not null default 'otra'
    check (plataforma in ('soundcloud', 'youtube', 'mixcloud', 'audio', 'otra')),
  portada text,
  estilos text[] not null default '{}',
  destacado boolean not null default false,
  duracion integer,                 -- segundos (opcional)
  orden integer not null default 0,
  oculto boolean not null default false,   -- moderación (solo admin)
  likes integer not null default 0,
  comentarios integer not null default 0,
  guardados integer not null default 0,
  contenido_id uuid unique references public.dj_contenidos(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sets_dj on public.sets (dj_id, destacado desc, orden, created_at desc);
create index if not exists idx_sets_recientes on public.sets (created_at desc);
alter table public.sets enable row level security;

grant select on public.sets to anon, authenticated;
grant insert (dj_id, titulo, url, plataforma, portada, estilos, destacado, duracion, orden)
  on public.sets to authenticated;
grant update (titulo, url, plataforma, portada, estilos, destacado, duracion, orden, oculto)
  on public.sets to authenticated;
grant delete on public.sets to authenticated;

drop policy if exists "sets_select" on public.sets;
create policy "sets_select" on public.sets for select using (
  exists (select 1 from public.djs d where d.id = dj_id
          and ((not d.oculto and not sets.oculto)
               or d.profile_id = (select auth.uid()) or (select public.is_admin()))));
drop policy if exists "sets_insert" on public.sets;
create policy "sets_insert" on public.sets for insert to authenticated with check (
  exists (select 1 from public.djs d where d.id = dj_id
          and (d.profile_id = (select auth.uid()) or (select public.is_admin()))));
drop policy if exists "sets_update" on public.sets;
create policy "sets_update" on public.sets for update to authenticated using (
  exists (select 1 from public.djs d where d.id = dj_id
          and (d.profile_id = (select auth.uid()) or (select public.is_admin()))));
drop policy if exists "sets_delete" on public.sets;
create policy "sets_delete" on public.sets for delete to authenticated using (
  exists (select 1 from public.djs d where d.id = dj_id
          and (d.profile_id = (select auth.uid()) or (select public.is_admin()))));

-- Solo el admin oculta un set (moderación); el DJ no puede «desocultarlo».
create or replace function public.proteger_sets()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then new.oculto := false;
  else new.oculto := old.oculto; end if;
  return new;
end $$;
revoke execute on function public.proteger_sets() from public, anon, authenticated;
drop trigger if exists trg_proteger_sets on public.sets;
create trigger trg_proteger_sets before insert or update on public.sets
  for each row execute function public.proteger_sets();

-- Copia de sesiones y vídeos ya subidos (idempotente por contenido_id).
insert into public.sets (dj_id, titulo, url, plataforma, created_at, contenido_id)
select c.dj_id,
       coalesce(nullif(trim(c.titulo), ''), case when c.tipo = 'video' then 'Vídeo' else 'Sesión' end),
       c.url,
       case when c.url ~* 'soundcloud\.com' then 'soundcloud'
            when c.url ~* '(youtube\.com|youtu\.be)' then 'youtube'
            when c.url ~* 'mixcloud\.com' then 'mixcloud'
            when c.url ~* '\.(mp3|m4a|aac|ogg|wav)(\?|$)' then 'audio'
            else 'otra' end,
       c.created_at, c.id
from public.dj_contenidos c
where c.tipo in ('sesion', 'video') and c.url ~* '^https?://'
on conflict (contenido_id) do nothing;

-- 4) Seguidores, likes, guardados, comentarios -----------------------------
create table if not exists public.seguidores_dj (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  dj_id uuid not null references public.djs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, dj_id)
);
create index if not exists idx_fk_seguidores_dj on public.seguidores_dj (dj_id);

create table if not exists public.sets_likes (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  set_id uuid not null references public.sets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, set_id)
);
create index if not exists idx_fk_sets_likes on public.sets_likes (set_id);

create table if not exists public.sets_guardados (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  set_id uuid not null references public.sets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, set_id)
);
create index if not exists idx_fk_sets_guardados on public.sets_guardados (set_id);

-- Las tres son "mías": cada cual ve, crea y quita solo sus filas. Los totales
-- públicos salen de los contadores, no de leer quién sigue a quién.
do $$
declare t text;
begin
  foreach t in array array['seguidores_dj', 'sets_likes', 'sets_guardados'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, delete on public.%I to authenticated', t);
    -- anon: solo para que feed_djs (invoker) pueda preguntar "¿lo sigo?" y
    -- reciba "no"; las políticas son "to authenticated", así que no ve filas.
    execute format('grant select on public.%I to anon', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (profile_id = (select auth.uid()) or (select public.is_admin()))', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (profile_id = (select auth.uid()))', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (profile_id = (select auth.uid()))', t || '_delete', t);
  end loop;
end $$;

create table if not exists public.sets_comentarios (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  autor uuid references public.profiles(id) on delete set null,
  texto text not null check (char_length(trim(texto)) between 1 and 1000),
  respuesta_de uuid references public.sets_comentarios(id) on delete cascade,
  es_dj boolean not null default false,     -- lo pone el disparador
  oculto boolean not null default false,    -- moderación
  created_at timestamptz not null default now()
);
create index if not exists idx_sets_comentarios on public.sets_comentarios (set_id, created_at);
create index if not exists idx_fk_sets_comentarios_autor on public.sets_comentarios (autor);
create index if not exists idx_fk_sets_comentarios_resp on public.sets_comentarios (respuesta_de);
alter table public.sets_comentarios enable row level security;
grant select on public.sets_comentarios to anon, authenticated;
grant insert (set_id, autor, texto, respuesta_de) on public.sets_comentarios to authenticated;
grant update (oculto) on public.sets_comentarios to authenticated;
grant delete on public.sets_comentarios to authenticated;

drop policy if exists "sets_comentarios_select" on public.sets_comentarios;
create policy "sets_comentarios_select" on public.sets_comentarios for select using (
  (not oculto and exists (select 1 from public.sets s where s.id = set_id))
  or autor = (select auth.uid()) or (select public.is_admin()));
-- Comentar: cualquiera con sesión. RESPONDER (respuesta_de): solo el DJ dueño
-- del set, que es quien contesta en su perfil (dossier pág. 7).
drop policy if exists "sets_comentarios_insert" on public.sets_comentarios;
create policy "sets_comentarios_insert" on public.sets_comentarios for insert to authenticated with check (
  autor = (select auth.uid())
  and (respuesta_de is null or exists (
    select 1 from public.sets s join public.djs d on d.id = s.dj_id
    where s.id = set_id and d.profile_id = (select auth.uid()))));
-- Ocultar: el DJ dueño del set (en su set) o el admin.
drop policy if exists "sets_comentarios_update" on public.sets_comentarios;
create policy "sets_comentarios_update" on public.sets_comentarios for update to authenticated using (
  (select public.is_admin()) or exists (
    select 1 from public.sets s join public.djs d on d.id = s.dj_id
    where s.id = set_id and d.profile_id = (select auth.uid())));
drop policy if exists "sets_comentarios_delete" on public.sets_comentarios;
create policy "sets_comentarios_delete" on public.sets_comentarios for delete to authenticated using (
  autor = (select auth.uid()) or (select public.is_admin()) or exists (
    select 1 from public.sets s join public.djs d on d.id = s.dj_id
    where s.id = set_id and d.profile_id = (select auth.uid())));

-- es_dj y coherencia de la respuesta (mismo set, una sola profundidad).
create or replace function public.preparar_comentario_set()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_padre record;
begin
  new.es_dj := exists (select 1 from public.sets s join public.djs d on d.id = s.dj_id
                       where s.id = new.set_id and d.profile_id = new.autor);
  if new.respuesta_de is not null then
    select set_id, respuesta_de into v_padre from public.sets_comentarios where id = new.respuesta_de;
    if v_padre is null or v_padre.set_id <> new.set_id then
      raise exception 'La respuesta no corresponde a este set';
    end if;
    if v_padre.respuesta_de is not null then new.respuesta_de := v_padre.respuesta_de; end if;
  end if;
  return new;
end $$;
revoke execute on function public.preparar_comentario_set() from public, anon, authenticated;
drop trigger if exists trg_preparar_comentario_set on public.sets_comentarios;
create trigger trg_preparar_comentario_set before insert on public.sets_comentarios
  for each row execute function public.preparar_comentario_set();

-- Contadores. Un disparador por tabla: suma al insertar, resta al borrar.
create or replace function public.contar_musica()
returns trigger language plpgsql security definer set search_path = public as $$
declare d integer := case when tg_op = 'INSERT' then 1 else -1 end;
        r record := case when tg_op = 'INSERT' then new else old end;
begin
  if tg_table_name = 'seguidores_dj' then
    update public.djs set seguidores = greatest(0, seguidores + d) where id = r.dj_id;
  elsif tg_table_name = 'sets_likes' then
    update public.sets set likes = greatest(0, likes + d) where id = r.set_id;
  elsif tg_table_name = 'sets_guardados' then
    update public.sets set guardados = greatest(0, guardados + d) where id = r.set_id;
  elsif tg_table_name = 'sets_comentarios' then
    update public.sets set comentarios = greatest(0, comentarios + d) where id = r.set_id;
  end if;
  return null;
end $$;
revoke execute on function public.contar_musica() from public, anon, authenticated;
drop trigger if exists trg_contar_seguidores on public.seguidores_dj;
create trigger trg_contar_seguidores after insert or delete on public.seguidores_dj
  for each row execute function public.contar_musica();
drop trigger if exists trg_contar_likes on public.sets_likes;
create trigger trg_contar_likes after insert or delete on public.sets_likes
  for each row execute function public.contar_musica();
drop trigger if exists trg_contar_guardados on public.sets_guardados;
create trigger trg_contar_guardados after insert or delete on public.sets_guardados
  for each row execute function public.contar_musica();
drop trigger if exists trg_contar_comentarios on public.sets_comentarios;
create trigger trg_contar_comentarios after insert or delete on public.sets_comentarios
  for each row execute function public.contar_musica();

-- 5) Nexo ---------------------------------------------------------------------
create table if not exists public.nexo_envios (
  id uuid primary key default gen_random_uuid(),
  dj_id uuid not null references public.djs(id) on delete cascade,
  set_id uuid references public.sets(id) on delete set null,
  titulo text not null check (char_length(trim(titulo)) between 1 and 140),
  url text not null check (url ~* '^https?://'),
  descripcion text check (descripcion is null or char_length(descripcion) <= 1000),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptado', 'rechazado', 'emitido')),
  nota_nexo text,
  revisado_por uuid references public.profiles(id) on delete set null,
  revisado_en timestamptz,
  emitido_en timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_nexo_envios_dj on public.nexo_envios (dj_id, created_at desc);
create index if not exists idx_nexo_envios_estado on public.nexo_envios (estado, created_at desc);
create index if not exists idx_fk_nexo_envios_set on public.nexo_envios (set_id);
create index if not exists idx_fk_nexo_envios_revisor on public.nexo_envios (revisado_por);
alter table public.nexo_envios enable row level security;
grant select, delete on public.nexo_envios to authenticated;
grant insert (dj_id, set_id, titulo, url, descripcion) on public.nexo_envios to authenticated;
grant update (estado, nota_nexo, revisado_por, revisado_en, emitido_en) on public.nexo_envios to authenticated;

drop policy if exists "nexo_envios_select" on public.nexo_envios;
create policy "nexo_envios_select" on public.nexo_envios for select to authenticated using (
  (select public.is_admin()) or exists (
    select 1 from public.djs d where d.id = dj_id and d.profile_id = (select auth.uid())));
drop policy if exists "nexo_envios_insert" on public.nexo_envios;
create policy "nexo_envios_insert" on public.nexo_envios for insert to authenticated with check (
  exists (select 1 from public.djs d where d.id = dj_id and d.profile_id = (select auth.uid())));
drop policy if exists "nexo_envios_update" on public.nexo_envios;
create policy "nexo_envios_update" on public.nexo_envios for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- El DJ puede retirar un envío mientras está pendiente; el admin, siempre.
drop policy if exists "nexo_envios_delete" on public.nexo_envios;
create policy "nexo_envios_delete" on public.nexo_envios for delete to authenticated using (
  (select public.is_admin()) or (estado = 'pendiente' and exists (
    select 1 from public.djs d where d.id = dj_id and d.profile_id = (select auth.uid()))));

-- "Descubre sesiones": lo aceptado o emitido, sin notas internas.
create or replace function private.nexo_sesiones(p_limite integer default 20)
returns table (id uuid, titulo text, url text, descripcion text, dj_id uuid,
               dj_nombre text, dj_avatar text, portada text, plataforma text, estado text)
language sql stable security definer set search_path = public as $$
  select e.id, e.titulo, e.url, e.descripcion, d.id, d.nombre_artistico, d.avatar_url,
         s.portada, coalesce(s.plataforma,
           case when e.url ~* 'soundcloud\.com' then 'soundcloud'
                when e.url ~* '(youtube\.com|youtu\.be)' then 'youtube'
                when e.url ~* 'mixcloud\.com' then 'mixcloud'
                when e.url ~* '\.(mp3|m4a|aac|ogg|wav)(\?|$)' then 'audio'
                else 'otra' end), e.estado
  from public.nexo_envios e
  join public.djs d on d.id = e.dj_id and not d.oculto
  left join public.sets s on s.id = e.set_id
  where e.estado in ('aceptado', 'emitido')
  order by coalesce(e.emitido_en, e.revisado_en, e.created_at) desc
  limit least(greatest(coalesce(p_limite, 20), 1), 50);
$$;
revoke execute on function private.nexo_sesiones(integer) from public;
grant execute on function private.nexo_sesiones(integer) to anon, authenticated, service_role;
create or replace function public.nexo_sesiones(p_limite integer default 20)
returns table (id uuid, titulo text, url text, descripcion text, dj_id uuid,
               dj_nombre text, dj_avatar text, portada text, plataforma text, estado text)
language sql stable security invoker set search_path = public
as $$ select * from private.nexo_sesiones(p_limite) $$;
grant execute on function public.nexo_sesiones(integer) to anon, authenticated, service_role;

create table if not exists public.nexo_programacion (
  id uuid primary key default gen_random_uuid(),
  dia_semana smallint check (dia_semana between 1 and 7),   -- null = cada día
  hora time not null,
  titulo text not null check (char_length(trim(titulo)) between 1 and 120),
  detalle text,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_nexo_programacion on public.nexo_programacion (dia_semana, hora);
alter table public.nexo_programacion enable row level security;
grant select on public.nexo_programacion to anon, authenticated;
grant insert, update, delete on public.nexo_programacion to authenticated;
drop policy if exists "nexo_programacion_select" on public.nexo_programacion;
create policy "nexo_programacion_select" on public.nexo_programacion for select using (true);
drop policy if exists "nexo_programacion_insert" on public.nexo_programacion;
create policy "nexo_programacion_insert" on public.nexo_programacion for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "nexo_programacion_update" on public.nexo_programacion;
create policy "nexo_programacion_update" on public.nexo_programacion for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "nexo_programacion_delete" on public.nexo_programacion;
create policy "nexo_programacion_delete" on public.nexo_programacion for delete to authenticated
  using ((select public.is_admin()));

-- La programación que enseña el vídeo, solo si la tabla está vacía.
insert into public.nexo_programacion (hora, titulo, orden)
select v.hora, v.titulo, v.orden
from (values ('17:00'::time, 'Sesiones de tarde', 1), ('19:00'::time, 'Selección Nexo', 2)) v(hora, titulo, orden)
where not exists (select 1 from public.nexo_programacion);

-- 6) Feed de DJs -------------------------------------------------------------
-- Una tarjeta por DJ visible con algo que enseñar: su set destacado (o el
-- último) y su próximo evento a la vista. "Para ti" ordena por afinidad con
-- los estilos que manda la app (ADN del usuario), luego quien tiene evento
-- próximo, luego destacados y seguidores. "Siguiendo": solo los que sigo.
-- SECURITY INVOKER: respeta las políticas de cada tabla.
create or replace function public.feed_djs(
  p_siguiendo boolean default false, p_estilos text[] default '{}',
  p_desde integer default 0, p_limite integer default 8)
returns table (
  dj_id uuid, nombre text, avatar_url text, banner_url text, ciudad text, estilos text[],
  seguidores integer, siguiendo boolean,
  set_id uuid, set_titulo text, set_url text, set_plataforma text, set_portada text,
  set_estilos text[], set_likes integer, set_comentarios integer, me_gusta boolean, guardado boolean,
  evento_id uuid, evento_titulo text, evento_fecha date, evento_flyer text, evento_local text,
  afinidad integer)
language sql stable security invoker set search_path = public as $$
  with yo as (select auth.uid() as uid),
  base as (
    -- Columnas explícitas: con d.* entraría presskit_url, que anon no puede leer.
    select d.id, d.nombre_artistico, d.avatar_url, d.banner_url, d.ciudad, d.estilos,
      d.seguidores, d.destacado_orden,
      s.id as s_id, s.titulo as s_titulo, s.url as s_url, s.plataforma as s_plataforma,
      s.portada as s_portada, s.estilos as s_estilos, s.likes as s_likes, s.comentarios as s_comentarios,
      t.id as t_id, t.titulo as t_titulo, t.fecha as t_fecha, t.flyer_url as t_flyer, t.local_id as t_local
    from public.djs d
    left join lateral (
      select s.id, s.titulo, s.url, s.plataforma, s.portada, s.estilos, s.likes, s.comentarios
      from public.sets s where s.dj_id = d.id
      order by s.destacado desc, s.orden, s.created_at desc limit 1) s on true
    left join lateral (
      select t.id, t.titulo, t.fecha, t.flyer_url, t.local_id
      from public.tardeos t join public.tardeo_djs td on td.tardeo_id = t.id
      where td.dj_id = d.id and t.fecha >= (now() at time zone 'Europe/Madrid')::date
        and (t.estado = 'publicado' or (t.estado = 'programado' and t.publicar_en <= now()))
      order by t.fecha, t.id limit 1) t on true
    where not d.oculto
      and (not coalesce(p_siguiendo, false) or exists (
        select 1 from public.seguidores_dj f, yo where f.dj_id = d.id and f.profile_id = yo.uid))
  )
  select b.id, b.nombre_artistico, b.avatar_url, b.banner_url, b.ciudad, b.estilos,
    b.seguidores,
    exists (select 1 from public.seguidores_dj f, yo where f.dj_id = b.id and f.profile_id = yo.uid),
    b.s_id, b.s_titulo, b.s_url, b.s_plataforma, b.s_portada, b.s_estilos, b.s_likes, b.s_comentarios,
    exists (select 1 from public.sets_likes l, yo where l.set_id = b.s_id and l.profile_id = yo.uid),
    exists (select 1 from public.sets_guardados g, yo where g.set_id = b.s_id and g.profile_id = yo.uid),
    b.t_id, b.t_titulo, b.t_fecha::date, b.t_flyer,
    (select l.nombre from public.locales l where l.id = b.t_local),
    -- Afinidad: estilos en común, sin distinguir mayúsculas ("House" = "house").
    coalesce(cardinality(array(
      select lower(trim(x)) from unnest(coalesce(b.estilos, '{}') || coalesce(b.s_estilos, '{}')) x
      intersect select lower(trim(y)) from unnest(coalesce(p_estilos, '{}')) y)), 0)
  from base b
  where b.s_id is not null or b.t_id is not null
  order by 24 desc, (b.t_id is not null) desc, b.destacado_orden nulls last,
           b.seguidores desc, b.id
  offset greatest(coalesce(p_desde, 0), 0)
  limit least(greatest(coalesce(p_limite, 8), 1), 30);
$$;
grant execute on function public.feed_djs(boolean, text[], integer, integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';


-- >>>>>>>>>>>>>>>>>>>> 66_comunidad.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> 67_retorno.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- TardeosClub · LOTE 67: RETORNO (avisos programados, encuesta 72 h, sorteos)
-- Dossier 2.0 págs. 10 y 14. Equipo D. Idempotente; no borra datos.
--
--  1) Hora de inicio/fin de un tardeo como instante (huso de España), en un
--     solo sitio: la usan la encuesta (fin + 72 h) y el cron de avisos.
--  2) tardeos: versión de horario y marca de cancelación (disparador). Así el
--     cron sabe que cambió la hora o se canceló y avisa una vez por cambio.
--  3) avisos.push_en: cuándo salió el push de un aviso de la bandeja.
--  4) preferencias_avisos: la persona apaga recordatorios o el aviso de fin.
--  5) encuestas: una por persona y tardeo, solo confirmados, hasta fin + 72 h,
--     comprobado en servidor. Público: solo valoración y comentario.
--  6) resenas.tardeo_id: la reseña sabe de qué tardeo viene.
--  7) sorteos + participaciones: una por cuenta; ganador al azar reproducible
--     (semilla) o manual; publicar; todo con rastro (private.auditar).
-- =============================================================

-- 1) Inicio y fin --------------------------------------------------------------
-- Sin hora de inicio se supone las 17:00 (tardeo); sin hora de fin, inicio + 5 h.
-- Si la hora de fin es menor o igual que la de inicio, acaba al día siguiente.
-- La MISMA regla está en lib/avisos.ts (instantesTardeo): si cambias una,
-- cambia la otra.
create or replace function public.tardeo_inicio(p_fecha date, p_inicio time)
returns timestamptz language sql stable set search_path = public as $$
  select (p_fecha + coalesce(p_inicio, time '17:00')) at time zone 'Europe/Madrid';
$$;

create or replace function public.tardeo_fin(p_fecha date, p_inicio time, p_fin time)
returns timestamptz language sql stable set search_path = public as $$
  select case
    when p_fin is null then public.tardeo_inicio(p_fecha, p_inicio) + interval '5 hours'
    when p_fin <= coalesce(p_inicio, time '17:00') then (p_fecha + 1 + p_fin) at time zone 'Europe/Madrid'
    else (p_fecha + p_fin) at time zone 'Europe/Madrid'
  end;
$$;
grant execute on function public.tardeo_inicio(date, time) to anon, authenticated, service_role;
grant execute on function public.tardeo_fin(date, time, time) to anon, authenticated, service_role;

-- 2) Cambios de horario y cancelación ----------------------------------------
alter table public.tardeos add column if not exists horario_version int not null default 0;
alter table public.tardeos add column if not exists horario_cambiado_en timestamptz;
alter table public.tardeos add column if not exists horario_anterior jsonb;
alter table public.tardeos add column if not exists cancelado_en timestamptz;
grant select (horario_version, horario_cambiado_en, cancelado_en) on public.tardeos to anon, authenticated;

create or replace function public.tardeo_marcar_cambios()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Solo cuenta como "cambio" lo que afecta a quien ya tiene plan: un tardeo
  -- publicado que mueve fecha u hora. Retocar un borrador no avisa a nadie.
  if old.estado = 'publicado' and new.estado = 'publicado'
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
drop trigger if exists trg_tardeo_marcar_cambios on public.tardeos;
create trigger trg_tardeo_marcar_cambios before update on public.tardeos
  for each row execute function public.tardeo_marcar_cambios();

-- Por defecto, el aviso de 1 h antes va solo a "Asistiré". Con 'true' también a
-- quien lo guardó (dossier pág. 10: "confirmar si también a guardados").
insert into public.ajustes (clave, valor) values ('avisos_1h_guardados', 'false')
  on conflict (clave) do nothing;

-- 3) Push de los avisos ----------------------------------------------------------
alter table public.avisos add column if not exists push_en timestamptz;
create index if not exists idx_avisos_sin_push on public.avisos (created_at) where push_en is null;

-- Crear avisos en lote desde el cron (solo servidor). La clave única
-- (profile_id, clave) hace que repetir la ejecución no duplique: devuelve SOLO
-- los avisos recién creados, que son a los que se manda push.
create or replace function private.crear_avisos_lote(p_avisos jsonb)
returns table (id uuid, profile_id uuid, clave text)
language sql security definer set search_path = public as $$
  insert into public.avisos (profile_id, tipo, titulo, cuerpo, url, clave)
  select x.profile_id, x.tipo, x.titulo, x.cuerpo, x.url, x.clave
  from jsonb_to_recordset(p_avisos) as x(profile_id uuid, tipo text, titulo text, cuerpo text, url text, clave text)
  on conflict (profile_id, clave) where clave is not null do nothing
  returning avisos.id, avisos.profile_id, avisos.clave;
$$;
revoke execute on function private.crear_avisos_lote(jsonb) from public, anon, authenticated;
grant execute on function private.crear_avisos_lote(jsonb) to service_role;
create or replace function public.crear_avisos_lote(p_avisos jsonb)
returns table (id uuid, profile_id uuid, clave text)
language sql security invoker set search_path = public
as $$ select * from private.crear_avisos_lote($1) $$;
revoke execute on function public.crear_avisos_lote(jsonb) from public, anon, authenticated;
grant execute on function public.crear_avisos_lote(jsonb) to service_role;

-- 4) Preferencias -------------------------------------------------------------------
create table if not exists public.preferencias_avisos (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  recordatorios boolean not null default true,   -- día antes y 1 h antes
  fin_evento boolean not null default true,       -- "¿Qué tal ha ido?" + vuelta segura
  updated_at timestamptz not null default now()
);
alter table public.preferencias_avisos enable row level security;
grant select, insert, update on public.preferencias_avisos to authenticated;
drop policy if exists "pref_avisos_select" on public.preferencias_avisos;
create policy "pref_avisos_select" on public.preferencias_avisos for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "pref_avisos_insert" on public.preferencias_avisos;
create policy "pref_avisos_insert" on public.preferencias_avisos for insert to authenticated
  with check (profile_id = (select auth.uid()));
drop policy if exists "pref_avisos_update" on public.preferencias_avisos;
create policy "pref_avisos_update" on public.preferencias_avisos for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

-- 5) Encuestas ------------------------------------------------------------------------
create table if not exists public.encuestas (
  id uuid primary key default gen_random_uuid(),
  tardeo_id uuid not null references public.tardeos(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  valoracion int not null check (valoracion between 1 and 5),
  musica text[] not null default '{}',
  ambiente text[] not null default '{}',
  ropa text check (char_length(ropa) <= 40),
  edad_aprox text check (char_length(edad_aprox) <= 20),
  comodidad int check (comodidad between 1 and 5),
  calidad_precio int check (calidad_precio between 1 and 5),
  volverias text check (volverias in ('si', 'no', 'nose')),
  comentario text check (char_length(comentario) <= 600),
  -- El equipo puede retirar un comentario de lo público sin borrar la encuesta.
  comentario_oculto boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tardeo_id, profile_id)
);
create index if not exists idx_fk_encuestas_profile on public.encuestas (profile_id);
create index if not exists idx_encuestas_tardeo on public.encuestas (tardeo_id, created_at desc);
alter table public.encuestas enable row level security;
grant select on public.encuestas to authenticated;
grant update (comentario_oculto) on public.encuestas to authenticated;
-- Detalle completo: la propia persona y el equipo. Nadie más.
drop policy if exists "encuestas_select" on public.encuestas;
create policy "encuestas_select" on public.encuestas for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "encuestas_update" on public.encuestas;
create policy "encuestas_update" on public.encuestas for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- Sin política de insert: solo por responder_encuesta(), que valida todo.

-- 6) resenas.tardeo_id -----------------------------------------------------------
alter table public.resenas add column if not exists tardeo_id uuid references public.tardeos(id) on delete set null;
create index if not exists idx_fk_resenas_tardeo on public.resenas (tardeo_id);

-- ¿Puede esta persona responder la encuesta de este tardeo? Devuelve el motivo
-- si no: 'sin_sesion', 'no_existe', 'cancelado', 'no_confirmado', 'aun_no',
-- 'fuera_plazo', 'ya_respondida' u 'ok'. La pantalla enseña el estado con esto.
create or replace function private.estado_encuesta(p_tardeo uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare t record; v_fin timestamptz;
begin
  if auth.uid() is null then return 'sin_sesion'; end if;
  select id, fecha, hora_inicio, hora_fin, estado into t from public.tardeos where id = p_tardeo;
  if t.id is null or t.estado = 'borrador' then return 'no_existe'; end if;
  if t.estado = 'cancelado' then return 'cancelado'; end if;
  if exists (select 1 from public.encuestas e where e.tardeo_id = p_tardeo and e.profile_id = auth.uid()) then
    return 'ya_respondida';
  end if;
  -- "Asistiré" o lista confirmada = inscripción en estado 'apuntado'. Si el
  -- local marcó que no vino, no opina (dossier: la lista no acredita presencia,
  -- pero un "no asistió" explícito sí la niega).
  if not exists (select 1 from public.inscripciones i
                 where i.tardeo_id = p_tardeo and i.profile_id = auth.uid()
                   and i.estado = 'apuntado' and coalesce(i.asistencia, 'pendiente') <> 'no_asistio') then
    return 'no_confirmado';
  end if;
  v_fin := public.tardeo_fin(t.fecha, t.hora_inicio, t.hora_fin);
  if now() < v_fin then return 'aun_no'; end if;
  if now() > v_fin + interval '72 hours' then return 'fuera_plazo'; end if;
  return 'ok';
end $$;
revoke execute on function private.estado_encuesta(uuid) from public, anon;
grant execute on function private.estado_encuesta(uuid) to authenticated, service_role;
create or replace function public.estado_encuesta(p_tardeo uuid)
returns text language sql stable security invoker set search_path = public
as $$ select private.estado_encuesta($1) $$;
revoke execute on function public.estado_encuesta(uuid) from public, anon;
grant execute on function public.estado_encuesta(uuid) to authenticated, service_role;

create or replace function private.responder_encuesta(
  p_tardeo uuid, p_valoracion int, p_musica text[], p_ambiente text[], p_ropa text, p_edad text,
  p_comodidad int, p_calidad_precio int, p_volverias text, p_comentario text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_estado text; v_id uuid; v_local uuid; v_com text;
begin
  v_estado := private.estado_encuesta(p_tardeo);
  if v_estado <> 'ok' then
    raise exception '%', case v_estado
      when 'sin_sesion' then 'Entra con tu cuenta para valorar.'
      when 'no_confirmado' then 'Solo pueden valorar quienes tenían plaza confirmada.'
      when 'aun_no' then 'Podrás valorarlo cuando termine el tardeo.'
      when 'fuera_plazo' then 'El plazo para valorar (72 h después del fin) ya ha pasado.'
      when 'ya_respondida' then 'Ya enviaste tu valoración de este tardeo.'
      else 'Este tardeo no admite valoraciones.' end
      using errcode = 'P0001', hint = v_estado;
  end if;
  v_com := nullif(btrim(coalesce(p_comentario, '')), '');
  insert into public.encuestas (tardeo_id, profile_id, valoracion, musica, ambiente, ropa, edad_aprox,
                                comodidad, calidad_precio, volverias, comentario)
  values (p_tardeo, auth.uid(), p_valoracion,
          coalesce((select array_agg(left(x, 30)) from unnest(p_musica[1:12]) x), '{}'),
          coalesce((select array_agg(left(x, 30)) from unnest(p_ambiente[1:8]) x), '{}'),
          nullif(btrim(coalesce(p_ropa, '')), ''), nullif(btrim(coalesce(p_edad, '')), ''),
          p_comodidad, p_calidad_precio, p_volverias, v_com)
  returning id into v_id;

  -- Reseña del local enlazada al tardeo, si esa persona aún no reseñó el local.
  -- Pasa por la moderación de siempre (pendiente). Si algo la impide (límite
  -- diario, etc.) la encuesta se guarda igual.
  select local_id into v_local from public.tardeos where id = p_tardeo;
  if v_local is not null and not exists (
       select 1 from public.resenas r where r.autor_profile_id = auth.uid()
         and r.objetivo_tipo = 'local' and r.objetivo_id = v_local) then
    begin
      insert into public.resenas (autor_profile_id, objetivo_tipo, objetivo_id, puntuacion, comentario, estado, tardeo_id)
      values (auth.uid(), 'local', v_local, p_valoracion, v_com, 'pendiente', p_tardeo);
    exception when others then null;
    end;
  end if;
  return v_id;
end $$;
revoke execute on function private.responder_encuesta(uuid, int, text[], text[], text, text, int, int, text, text) from public, anon;
grant execute on function private.responder_encuesta(uuid, int, text[], text[], text, text, int, int, text, text) to authenticated, service_role;
create or replace function public.responder_encuesta(
  p_tardeo uuid, p_valoracion int, p_musica text[] default '{}', p_ambiente text[] default '{}', p_ropa text default null,
  p_edad text default null, p_comodidad int default null, p_calidad_precio int default null,
  p_volverias text default null, p_comentario text default null)
returns uuid language sql security invoker set search_path = public
as $$ select private.responder_encuesta($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) $$;
revoke execute on function public.responder_encuesta(uuid, int, text[], text[], text, text, int, int, text, text) from public, anon;
grant execute on function public.responder_encuesta(uuid, int, text[], text[], text, text, int, int, text, text) to authenticated, service_role;

-- Lo público de las encuestas: SOLO valoración y comentario (y alias, fecha).
-- Por tardeo o por local (todos sus tardeos).
create or replace function private.valoraciones_publicas(p_tardeo uuid, p_local uuid, p_limite int)
returns table (valoracion int, comentario text, alias text, tardeo_id uuid, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.valoracion, case when e.comentario_oculto then null else e.comentario end,
         coalesce(p.alias, split_part(coalesce(p.display_name, 'Tardícola'), ' ', 1)),
         e.tardeo_id, e.created_at
  from public.encuestas e
  join public.tardeos t on t.id = e.tardeo_id
  left join public.profiles p on p.id = e.profile_id
  where (p_tardeo is null or e.tardeo_id = p_tardeo)
    and (p_local is null or t.local_id = p_local)
    and (p_tardeo is not null or p_local is not null)
  order by e.created_at desc
  limit least(coalesce(p_limite, 50), 200);
$$;
revoke execute on function private.valoraciones_publicas(uuid, uuid, int) from public;
grant execute on function private.valoraciones_publicas(uuid, uuid, int) to anon, authenticated, service_role;
create or replace function public.valoraciones_publicas(p_tardeo uuid default null, p_local uuid default null, p_limite int default 50)
returns table (valoracion int, comentario text, alias text, tardeo_id uuid, created_at timestamptz)
language sql stable security invoker set search_path = public
as $$ select * from private.valoraciones_publicas($1, $2, $3) $$;
grant execute on function public.valoraciones_publicas(uuid, uuid, int) to anon, authenticated, service_role;

-- Resumen por tardeo para el panel (solo equipo): nº de respuestas, media,
-- reparto de estrellas y "¿volverías?". Paginado con p_desde/p_limite.
create or replace function private.resumen_encuestas(p_local uuid, p_desde int, p_limite int)
returns table (tardeo_id uuid, titulo text, fecha date, local_id uuid, local_nombre text, respuestas bigint,
               media numeric, estrellas int[], volverias_si bigint, volverias_no bigint, volverias_nose bigint, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo el equipo.' using errcode = '42501'; end if;
  return query
  with r as (
    select e.tardeo_id, count(*) n, round(avg(e.valoracion)::numeric, 2) m,
           array[count(*) filter (where e.valoracion = 1), count(*) filter (where e.valoracion = 2), count(*) filter (where e.valoracion = 3),
                 count(*) filter (where e.valoracion = 4), count(*) filter (where e.valoracion = 5)]::int[] est,
           count(*) filter (where e.volverias = 'si') si, count(*) filter (where e.volverias = 'no') no_, count(*) filter (where e.volverias = 'nose') ns
    from public.encuestas e group by e.tardeo_id)
  select t.id, t.titulo, t.fecha, t.local_id, l.nombre, r.n, r.m, r.est, r.si, r.no_, r.ns, count(*) over ()
  from r join public.tardeos t on t.id = r.tardeo_id left join public.locales l on l.id = t.local_id
  where p_local is null or t.local_id = p_local
  order by t.fecha desc, t.id
  offset greatest(coalesce(p_desde, 0), 0) limit least(coalesce(p_limite, 25), 100);
end $$;
revoke execute on function private.resumen_encuestas(uuid, int, int) from public, anon;
grant execute on function private.resumen_encuestas(uuid, int, int) to authenticated, service_role;
create or replace function public.resumen_encuestas(p_local uuid default null, p_desde int default 0, p_limite int default 25)
returns table (tardeo_id uuid, titulo text, fecha date, local_id uuid, local_nombre text, respuestas bigint,
               media numeric, estrellas int[], volverias_si bigint, volverias_no bigint, volverias_nose bigint, total bigint)
language sql stable security invoker set search_path = public
as $$ select * from private.resumen_encuestas($1, $2, $3) $$;
revoke execute on function public.resumen_encuestas(uuid, int, int) from public, anon;
grant execute on function public.resumen_encuestas(uuid, int, int) to authenticated, service_role;

-- 7) Sorteos -------------------------------------------------------------------
create table if not exists public.sorteos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 3 and 120),
  descripcion text check (char_length(descripcion) <= 1000),
  premio text not null check (char_length(premio) between 2 and 200),
  bases text check (char_length(bases) <= 8000),
  imagen_url text,
  tardeo_id uuid references public.tardeos(id) on delete set null,
  zona_madre text check (zona_madre in ('barcelona', 'tarragona', 'girona')),
  abre timestamptz not null default now(),
  cierra timestamptz not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'abierto', 'cerrado', 'resuelto')),
  ganador_id uuid references public.profiles(id) on delete set null,
  ganador_alias text,
  metodo text check (metodo in ('azar', 'manual')),
  semilla text,
  elegido_en timestamptz,
  publicado_en timestamptz,
  responsable uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sorteos_ventana check (cierra > abre),
  constraint sorteos_resuelto check (estado <> 'resuelto' or (ganador_alias is not null and publicado_en is not null))
);
create index if not exists idx_fk_sorteos_tardeo on public.sorteos (tardeo_id);
create index if not exists idx_fk_sorteos_ganador on public.sorteos (ganador_id);
create index if not exists idx_fk_sorteos_responsable on public.sorteos (responsable);
create index if not exists idx_fk_sorteos_created_by on public.sorteos (created_by);
create index if not exists idx_sorteos_estado on public.sorteos (estado, cierra desc);
drop trigger if exists trg_sorteos_updated on public.sorteos;
create trigger trg_sorteos_updated before update on public.sorteos
  for each row execute function public.set_updated_at();

alter table public.sorteos enable row level security;
-- Columnas públicas: todo menos quién ganó (uuid) y la semilla antes de
-- publicar. El ganador se ve por su alias, y solo al publicarlo.
revoke select on public.sorteos from anon, authenticated;
grant select (id, titulo, descripcion, premio, bases, imagen_url, tardeo_id, zona_madre, abre, cierra, estado,
              ganador_alias, metodo, publicado_en, created_at, updated_at) on public.sorteos to anon, authenticated;
-- El admin escribe el contenido; el ganador y la resolución, solo por función.
grant insert (titulo, descripcion, premio, bases, imagen_url, tardeo_id, zona_madre, abre, cierra, estado, responsable, created_by)
  on public.sorteos to authenticated;
revoke update on public.sorteos from authenticated;
grant update (titulo, descripcion, premio, bases, imagen_url, tardeo_id, zona_madre, abre, cierra, estado, responsable)
  on public.sorteos to authenticated;
drop policy if exists "sorteos_select" on public.sorteos;
create policy "sorteos_select" on public.sorteos for select
  using (estado <> 'borrador' or (select public.is_admin()));
drop policy if exists "sorteos_insert" on public.sorteos;
create policy "sorteos_insert" on public.sorteos for insert to authenticated
  with check ((select public.is_admin()) and estado in ('borrador', 'abierto'));
drop policy if exists "sorteos_update" on public.sorteos;
create policy "sorteos_update" on public.sorteos for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()) and estado <> 'resuelto');

create table if not exists public.sorteo_participaciones (
  id uuid primary key default gen_random_uuid(),
  sorteo_id uuid not null references public.sorteos(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (sorteo_id, profile_id)
);
create index if not exists idx_fk_sorteo_part_profile on public.sorteo_participaciones (profile_id);
alter table public.sorteo_participaciones enable row level security;
grant select on public.sorteo_participaciones to authenticated;
drop policy if exists "sorteo_part_select" on public.sorteo_participaciones;
create policy "sorteo_part_select" on public.sorteo_participaciones for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));
-- Sin insert directo: participar_sorteo() valida la ventana.

-- Participar: una vez por cuenta, solo con el sorteo abierto y en fecha.
-- Devuelve 'registrada' o 'ya_participabas' (pulsar dos veces no es un error).
create or replace function private.participar_sorteo(p_sorteo uuid)
returns text language plpgsql security definer set search_path = public as $$
declare s record; v_n int;
begin
  if auth.uid() is null then raise exception 'Entra con tu cuenta para participar.' using errcode = 'P0001'; end if;
  select id, estado, abre, cierra into s from public.sorteos where id = p_sorteo;
  if s.id is null or s.estado = 'borrador' then raise exception 'Ese sorteo no existe.' using errcode = 'P0001'; end if;
  if s.estado <> 'abierto' or now() < s.abre or now() > s.cierra then
    raise exception 'Este sorteo no está abierto ahora mismo.' using errcode = 'P0001';
  end if;
  insert into public.sorteo_participaciones (sorteo_id, profile_id) values (p_sorteo, auth.uid())
    on conflict (sorteo_id, profile_id) do nothing;
  get diagnostics v_n = row_count;
  return case when v_n = 1 then 'registrada' else 'ya_participabas' end;
end $$;
revoke execute on function private.participar_sorteo(uuid) from public, anon;
grant execute on function private.participar_sorteo(uuid) to authenticated, service_role;
create or replace function public.participar_sorteo(p_sorteo uuid)
returns text language sql security invoker set search_path = public
as $$ select private.participar_sorteo($1) $$;
revoke execute on function public.participar_sorteo(uuid) from public, anon;
grant execute on function public.participar_sorteo(uuid) to authenticated, service_role;

-- Elegir ganador (solo admin). Sin p_ganador: al azar REPRODUCIBLE: se ordena a
-- los participantes por md5(semilla || id de perfil) y gana el primero; con la
-- semilla y la lista cualquiera puede repetir el cálculo. Con p_ganador:
-- elección manual (debe ser participante). No publica: eso es otro paso.
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
    v_sem := coalesce(nullif(btrim(p_semilla), ''), encode(gen_random_bytes(8), 'hex'));
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
create or replace function public.elegir_ganador_sorteo(p_sorteo uuid, p_ganador uuid default null, p_semilla text default null)
returns uuid language sql security invoker set search_path = public
as $$ select private.elegir_ganador_sorteo($1, $2, $3) $$;
revoke execute on function public.elegir_ganador_sorteo(uuid, uuid, text) from public, anon;
grant execute on function public.elegir_ganador_sorteo(uuid, uuid, text) to authenticated, service_role;

-- Publicar ganador (solo admin): fija el alias público, pasa a 'resuelto' y
-- deja un aviso en la bandeja del ganador.
create or replace function private.publicar_ganador_sorteo(p_sorteo uuid)
returns text language plpgsql security definer set search_path = public as $$
declare s record; v_alias text;
begin
  if not public.is_admin() then raise exception 'Solo un administrador.' using errcode = '42501'; end if;
  select id, titulo, estado, ganador_id, zona_madre into s from public.sorteos where id = p_sorteo for update;
  if s.id is null then raise exception 'Ese sorteo no existe.' using errcode = 'P0001'; end if;
  if s.estado = 'resuelto' then raise exception 'Ya estaba publicado.' using errcode = 'P0001'; end if;
  if s.ganador_id is null then raise exception 'Primero elige el ganador.' using errcode = 'P0001'; end if;
  select coalesce(p.alias, split_part(coalesce(p.display_name, 'Tardícola'), ' ', 1)) into v_alias
    from public.profiles p where p.id = s.ganador_id;
  update public.sorteos set estado = 'resuelto', ganador_alias = coalesce(v_alias, 'Tardícola'), publicado_en = now()
   where id = p_sorteo;
  perform private.crear_aviso(s.ganador_id, 'sorteo', '¡Has ganado el sorteo!',
    'Has ganado «' || s.titulo || '». El equipo se pondrá en contacto contigo.', '/sorteos/' || p_sorteo, 'sorteo:' || p_sorteo);
  perform private.auditar('publicar_ganador', 'sorteo', p_sorteo::text, s.zona_madre,
    jsonb_build_object('ganador', s.ganador_id, 'alias', v_alias));
  return v_alias;
end $$;
revoke execute on function private.publicar_ganador_sorteo(uuid) from public, anon;
grant execute on function private.publicar_ganador_sorteo(uuid) to authenticated, service_role;
create or replace function public.publicar_ganador_sorteo(p_sorteo uuid)
returns text language sql security invoker set search_path = public
as $$ select private.publicar_ganador_sorteo($1) $$;
revoke execute on function public.publicar_ganador_sorteo(uuid) from public, anon;
grant execute on function public.publicar_ganador_sorteo(uuid) to authenticated, service_role;

-- Resolución para el panel (solo admin): ganador elegido, semilla y recuento.
create or replace function private.sorteo_resolucion(p_sorteo uuid)
returns table (ganador_id uuid, ganador_alias text, ganador_email text, metodo text, semilla text,
               elegido_en timestamptz, participantes bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador.' using errcode = '42501'; end if;
  return query
  select s.ganador_id, coalesce(p.alias, split_part(coalesce(p.display_name, ''), ' ', 1)), p.email, s.metodo, s.semilla,
         s.elegido_en, (select count(*) from public.sorteo_participaciones sp where sp.sorteo_id = s.id)
  from public.sorteos s left join public.profiles p on p.id = s.ganador_id
  where s.id = p_sorteo;
end $$;
revoke execute on function private.sorteo_resolucion(uuid) from public, anon;
grant execute on function private.sorteo_resolucion(uuid) to authenticated, service_role;
create or replace function public.sorteo_resolucion(p_sorteo uuid)
returns table (ganador_id uuid, ganador_alias text, ganador_email text, metodo text, semilla text,
               elegido_en timestamptz, participantes bigint)
language sql stable security invoker set search_path = public
as $$ select * from private.sorteo_resolucion($1) $$;
revoke execute on function public.sorteo_resolucion(uuid) from public, anon;
grant execute on function public.sorteo_resolucion(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';


-- >>>>>>>>>>>>>>>>>>>> 68_profesional_negocio.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- TardeosClub · LOTE 68: PROFESIONAL Y NEGOCIO (dossier 14‑oct, págs. 11‑14 y 16)
-- =============================================================
-- Equipo E. Idempotente, no borra datos. Todo lo que cobra sigue APAGADO:
--   · cupos por ciclo: solo bloquean con ajustes.planes_activos = 'true'
--   · Coins: solo se reservan con ajustes.coins_activos = 'true'
-- Sin pasarela: las recargas las apunta un admin a mano (con referencia única).
--
--  1) Duplicados: posibles_duplicados() antes de crear un tardeo.
--  2) Cupos por ciclo (Basic 1 · Pro 2 · Premium/Fundador ilimitado), ciclo
--     mensual desde el alta; bloqueo al publicar SOLO con planes activos.
--     Promociones: Basic 0 · Pro 2 a la vez · Premium una por evento.
--     Fundadores: máximo 50.
--  3) Coins: libro contable inmutable `coins_movimientos` + `coins_reservas`
--     + catálogo `coins_servicios`; saldos SIEMPRE calculados.
--  4) Canje real de promociones: `promo_canjes` + canjear_promocion() con
--     bloqueo de fila (dos canjes a la vez no pasan del límite).
--  5) DJ ↔ evento: `dj_solicitudes` (vínculo a evento existente, que aprueba
--     el organizador; propuesta de evento nuevo, que revisa el equipo).
--     DJ provisional creado por un organizador (queda para revisión).
--  6) Incidencias con referencia y borrador ("Necesito ayuda" al publicar).
--  7) Métricas del local por canal (entrada/lista/WhatsApp/Instagram/web…).
-- =============================================================

create schema if not exists private;

-- ---------------------------------------------------------------
-- 0) Ajuste nuevo: coins_activos (apagado). planes_activos ya existe.
-- ---------------------------------------------------------------
insert into public.ajustes (clave, valor) values ('coins_activos', 'false')
on conflict (clave) do nothing;

create or replace function private.ajuste_activo(p_clave text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select valor = 'true' from public.ajustes where clave = p_clave), false);
$$;
revoke execute on function private.ajuste_activo(text) from public;
grant execute on function private.ajuste_activo(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------
-- 1) DUPLICADOS
-- ---------------------------------------------------------------
-- Normaliza un título: minúsculas, sin tildes, sin signos y sin palabras de
-- relleno ("tardeo", "dj", "con", "de"…). Así "Tardeo Remember con DJ Nando"
-- y "remember nando" se reconocen como el mismo.
create or replace function private.normalizar_titulo(p text)
returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(
    ' ' || regexp_replace(
      lower(translate(coalesce(p, ''), 'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑÇáéíóúàèìòùäëïöüñç', 'AEIOUAEIOUAEIOUNCaeiouaeiouaeiounc')),
      '[^a-z0-9]+', ' ', 'g') || ' ',
    ' (tardeo|tardeos|dj|djs|con|de|del|la|el|los|las|en|y|the|party|fiesta|edicion) ', ' ', 'g'));
$$;

-- Parecido = mismo título normalizado, uno contiene al otro, o comparten al
-- menos la mitad de las palabras (del más corto).
create or replace function private.titulos_parecidos(a text, b text)
returns boolean language sql immutable set search_path = public as $$
  with x as (select private.normalizar_titulo(a) na, private.normalizar_titulo(b) nb),
  w as (
    select na, nb,
      (select array_agg(distinct p) from unnest(string_to_array(regexp_replace(na, ' +', ' ', 'g'), ' ')) p where length(p) > 1) wa,
      (select array_agg(distinct p) from unnest(string_to_array(regexp_replace(nb, ' +', ' ', 'g'), ' ')) p where length(p) > 1) wb
    from x)
  select case
    when na = '' or nb = '' then false
    when na = nb or position(na in nb) > 0 or position(nb in na) > 0 then true
    when wa is null or wb is null then false
    else (select count(*) from unnest(wa) p where p = any(wb))::numeric
         / least(cardinality(wa), cardinality(wb)) >= 0.5
  end from w;
$$;

-- Tardeos que podrían ser el mismo: misma fecha, mismo local (o a <150 m) y
-- título parecido. Del propio local se ven todos los estados; de otros, solo
-- lo que ya es público. Nunca devuelve datos privados.
create or replace function private.posibles_duplicados(
  p_local uuid, p_fechas date[], p_titulo text,
  p_lat double precision default null, p_lng double precision default null,
  p_excluir uuid default null)
returns table (id uuid, titulo text, fecha date, hora_inicio time, estado text, local_nombre text, mismo_local boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.titulo, t.fecha, t.hora_inicio, t.estado, l.nombre, t.local_id = p_local
    from public.tardeos t
    join public.locales l on l.id = t.local_id
   where (select auth.uid()) is not null
     and t.fecha = any(p_fechas)
     and t.estado <> 'cancelado'
     and (p_excluir is null or t.id <> p_excluir)
     and (t.local_id = p_local
          or (p_lat is not null and p_lng is not null and t.lat is not null and t.lng is not null
              and abs(t.lat - p_lat) < 0.0014 and abs(t.lng - p_lng) < 0.0019))
     and (t.local_id = p_local and (public.owns_tardeo(p_local) or public.is_admin())
          or t.estado in ('publicado', 'programado', 'finalizado'))
     and private.titulos_parecidos(t.titulo, p_titulo)
   order by t.fecha, t.titulo
   limit 20;
$$;
revoke execute on function private.posibles_duplicados(uuid, date[], text, double precision, double precision, uuid) from public;
grant execute on function private.posibles_duplicados(uuid, date[], text, double precision, double precision, uuid) to authenticated, service_role;
create or replace function public.posibles_duplicados(
  p_local uuid, p_fechas date[], p_titulo text,
  p_lat double precision default null, p_lng double precision default null, p_excluir uuid default null)
returns table (id uuid, titulo text, fecha date, hora_inicio time, estado text, local_nombre text, mismo_local boolean)
language sql stable security invoker set search_path = public
as $$ select * from private.posibles_duplicados($1, $2, $3, $4, $5, $6) $$;
grant execute on function public.posibles_duplicados(uuid, date[], text, double precision, double precision, uuid) to authenticated;

-- ---------------------------------------------------------------
-- 2) CUPOS POR CICLO
-- ---------------------------------------------------------------
-- Ciclo mensual desde el alta (plan_desde; si no hay, el alta de la ficha).
-- Del 31 de enero: 28/29 feb, 31 mar… (se conserva el día de alta).
create or replace function private.ciclo_local(p_local uuid, p_ahora timestamptz default now())
returns table (inicio timestamptz, fin timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  v_ancla timestamptz;
  n int;
begin
  select coalesce(l.plan_desde, l.created_at) into v_ancla from public.locales l where l.id = p_local;
  if v_ancla is null then return; end if;
  if v_ancla > p_ahora then inicio := v_ancla; fin := v_ancla + interval '1 month'; return next; return; end if;
  n := (extract(year from age(p_ahora, v_ancla)) * 12 + extract(month from age(p_ahora, v_ancla)))::int;
  inicio := v_ancla + make_interval(months => n);
  if inicio > p_ahora then n := n - 1; inicio := v_ancla + make_interval(months => n); end if;
  fin := v_ancla + make_interval(months => n + 1);
  return next;
end $$;
revoke execute on function private.ciclo_local(uuid, timestamptz) from public;
grant execute on function private.ciclo_local(uuid, timestamptz) to authenticated, service_role;

-- Eventos incluidos por plan. NULL = sin límite. Un plan no vigente (impago,
-- cancelado, caducado) cae a Basic, nunca a cero.
create or replace function private.eventos_incluidos(p_plan text, p_estado text, p_hasta timestamptz)
returns int language sql immutable set search_path = public as $$
  select case
    when p_estado is distinct from 'activa' or (p_hasta is not null and p_hasta::date < (now() at time zone 'Europe/Madrid')::date) then 1
    when p_plan = 'pro' then 2
    when p_plan in ('premium', 'fundador') then null
    else 1 end;
$$;

-- Lo consumido en el ciclo: cada fecha publicada (o programada) creada en el
-- ciclo es un evento. Editar no crea filas, así que no consume. Más los
-- «eventos adicionales» comprados con Coins y vivos en el ciclo.
create or replace function private.cupo_local(p_local uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l record; c record; v_usados int; v_extra int; v_inc int; v_activos boolean;
begin
  if not (public.is_admin() or public.owns_tardeo(p_local)) then
    raise exception 'No es tu ficha' using errcode = '42501';
  end if;
  select * into l from public.locales where id = p_local;
  if not found then return null; end if;
  select * into c from private.ciclo_local(p_local);
  select count(*) into v_usados from public.tardeos t
   where t.local_id = p_local and t.estado in ('publicado', 'programado', 'finalizado')
     and t.created_at >= c.inicio and t.created_at < c.fin;
  select coalesce(count(*), 0) into v_extra from public.coins_reservas r
   where r.local_id = p_local and r.servicio = 'evento_adicional'
     and r.estado in ('pendiente', 'confirmada', 'entregada')
     and r.created_at >= c.inicio and r.created_at < c.fin;
  v_inc := private.eventos_incluidos(l.plan, l.plan_estado, l.plan_hasta);
  v_activos := private.ajuste_activo('planes_activos');
  return jsonb_build_object(
    'plan', l.plan, 'plan_estado', l.plan_estado, 'planes_activos', v_activos,
    'ciclo_inicio', c.inicio, 'ciclo_fin', c.fin,
    'incluidos', v_inc, 'extra', v_extra, 'usados', v_usados,
    'restantes', case when v_inc is null then null else greatest(v_inc + v_extra - v_usados, 0) end,
    'bloquea', v_activos and v_inc is not null);
end $$;
revoke execute on function private.cupo_local(uuid) from public;
grant execute on function private.cupo_local(uuid) to authenticated, service_role;
create or replace function public.cupo_local(p_local uuid)
returns jsonb language sql stable security invoker set search_path = public
as $$ select private.cupo_local($1) $$;
grant execute on function public.cupo_local(uuid) to authenticated;

-- Bloqueo en BASE al publicar (insert publicado/programado o paso de
-- borrador a publicado). Con planes apagados no hace nada. El admin no se
-- bloquea (publica en nombre de otros y decide él).
create or replace function private.tardeos_control_cupo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  l record; c record; v_usados int; v_extra int; v_inc int;
begin
  if not private.ajuste_activo('planes_activos') or public.is_admin() then return new; end if;
  if new.estado not in ('publicado', 'programado') then return new; end if;
  if tg_op = 'UPDATE' and old.estado in ('publicado', 'programado', 'finalizado') then return new; end if;
  select * into l from public.locales where id = new.local_id for update;  -- serializa publicaciones del mismo local
  v_inc := private.eventos_incluidos(l.plan, l.plan_estado, l.plan_hasta);
  if v_inc is null then return new; end if;
  select * into c from private.ciclo_local(new.local_id);
  select count(*) into v_usados from public.tardeos t
   where t.local_id = new.local_id and t.estado in ('publicado', 'programado', 'finalizado')
     and t.created_at >= c.inicio and t.created_at < c.fin and t.id <> new.id;
  select count(*) into v_extra from public.coins_reservas r
   where r.local_id = new.local_id and r.servicio = 'evento_adicional'
     and r.estado in ('pendiente', 'confirmada', 'entregada')
     and r.created_at >= c.inicio and r.created_at < c.fin;
  if v_usados + 1 > v_inc + v_extra then
    raise exception 'Has llegado al cupo de tu plan en este ciclo (% de %). Puedes guardarlo como borrador.', v_usados, v_inc + v_extra
      using errcode = 'P0001', hint = 'cupo';
  end if;
  return new;
end $$;
revoke execute on function private.tardeos_control_cupo() from public, anon, authenticated;

-- Promociones por plan: Basic ninguna, Pro 2 activas a la vez, Premium una por evento.
create or replace function private.promos_control_plan()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_local uuid; l record; v_n int; v_plan text;
begin
  if not private.ajuste_activo('planes_activos') or public.is_admin() or not new.activa then return new; end if;
  v_local := coalesce(new.local_id, (select t.local_id from public.tardeos t where t.id = new.tardeo_id));
  select * into l from public.locales where id = v_local for update;
  v_plan := case when l.plan_estado = 'activa' then l.plan else 'basic' end;
  if v_plan = 'basic' then
    raise exception 'El plan Basic no incluye promociones.' using errcode = 'P0001', hint = 'cupo';
  elsif v_plan = 'pro' then
    select count(*) into v_n from public.promociones p
      left join public.tardeos t on t.id = p.tardeo_id
     where coalesce(p.local_id, t.local_id) = v_local and p.id <> new.id and public.promo_vigente(p);
    if v_n >= 2 then raise exception 'El plan Pro permite 2 promociones activas a la vez.' using errcode = 'P0001', hint = 'cupo'; end if;
  elsif new.tardeo_id is not null then
    select count(*) into v_n from public.promociones p
     where p.tardeo_id = new.tardeo_id and p.id <> new.id and public.promo_vigente(p);
    if v_n >= 1 then raise exception 'Tu plan permite una promoción por evento.' using errcode = 'P0001', hint = 'cupo'; end if;
  end if;
  return new;
end $$;
revoke execute on function private.promos_control_plan() from public, anon, authenticated;

-- Fundadores: los 50 primeros locales.
create or replace function private.locales_control_fundador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.plan = 'fundador' and (tg_op = 'INSERT' or old.plan is distinct from 'fundador') then
    if (select count(*) from public.locales where plan = 'fundador' and id <> new.id) >= 50 then
      raise exception 'Ya hay 50 locales Fundadores: no quedan plazas.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
revoke execute on function private.locales_control_fundador() from public, anon, authenticated;

create or replace function private.plazas_fundador()
returns int language sql stable security definer set search_path = public as $$
  select greatest(50 - (select count(*) from public.locales where plan = 'fundador'), 0)::int;
$$;
revoke execute on function private.plazas_fundador() from public;
grant execute on function private.plazas_fundador() to anon, authenticated, service_role;
create or replace function public.plazas_fundador()
returns int language sql stable security invoker set search_path = public
as $$ select private.plazas_fundador() $$;
grant execute on function public.plazas_fundador() to anon, authenticated;

-- ---------------------------------------------------------------
-- 3) COINS
-- ---------------------------------------------------------------
create table if not exists public.coins_servicios (
  slug text primary key,
  nombre text not null,
  coste int,                       -- null = presupuesto aparte
  alcance text not null,
  solo_comprado boolean not null default false,  -- stories: no con Coins incluidos/regalados
  orden int not null default 0,
  activo boolean not null default true
);
alter table public.coins_servicios enable row level security;
grant select on public.coins_servicios to anon, authenticated;
drop policy if exists "coins_servicios_select" on public.coins_servicios;
create policy "coins_servicios_select" on public.coins_servicios for select using (true);

insert into public.coins_servicios (slug, nombre, coste, alcance, solo_comprado, orden) values
  ('evento_adicional', 'Evento adicional',      1,    'Basic/Pro: una fecha extra en el ciclo.', false, 1),
  ('promocion_pro',    'Promoción Pro extra',   3,    'Una oferta hasta su fin, máximo 30 días.', false, 2),
  ('destacado',        'Destacado',             5,    '72 h de rotación compartida en su zona.', false, 3),
  ('story_repost',     'Story / repost',        5,    'Una pieza lista; sin edición.', true, 4),
  ('story_adaptada',   'Story adaptada',        15,   'Plantilla, texto breve, una revisión y publicación.', true, 5),
  ('popup_adn',        'Pop-up ADN',            5,    'Hasta 72 h; zona/preferencias; una vez por persona.', false, 6),
  ('inicio_patrocinado','Inicio patrocinado',   10,   '24 h de rotación compartida.', false, 7),
  ('reel_campana',     'Reel / grabación / campaña', null, 'Entregables, revisiones y fecha definidos aparte.', true, 8)
on conflict (slug) do nothing;

create table if not exists public.coins_reservas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locales(id) on delete cascade,
  servicio text not null references public.coins_servicios(slug),
  coste int not null check (coste >= 0),
  tardeo_id uuid references public.tardeos(id) on delete set null,
  detalle text check (char_length(detalle) <= 1000),
  -- De qué bolsa salió cada Coin: la devolución vuelve EXACTAMENTE ahí.
  desglose jsonb not null default '{}'::jsonb,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'confirmada', 'en_curso', 'entregada', 'cancelada', 'rechazada')),
  resultado text check (char_length(resultado) <= 2000),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resuelta_en timestamptz
);
create index if not exists idx_coins_reservas_local on public.coins_reservas (local_id, created_at desc);
create index if not exists idx_coins_reservas_estado on public.coins_reservas (estado, created_at);
create index if not exists idx_fk_coins_reservas_tardeo on public.coins_reservas (tardeo_id);
create index if not exists idx_fk_coins_reservas_servicio on public.coins_reservas (servicio);
create index if not exists idx_fk_coins_reservas_created_by on public.coins_reservas (created_by);
alter table public.coins_reservas enable row level security;
grant select on public.coins_reservas to authenticated;
drop policy if exists "coins_reservas_select" on public.coins_reservas;
create policy "coins_reservas_select" on public.coins_reservas for select to authenticated
  using ((select public.is_admin()) or public.owns_tardeo(local_id));
-- Escrituras SOLO por funciones (sin grants de insert/update/delete).

create table if not exists public.coins_movimientos (
  id bigint generated always as identity primary key,
  local_id uuid not null references public.locales(id) on delete restrict,
  tipo text not null check (tipo in ('compra', 'promocional_mensual', 'bono_fundador', 'protegido', 'consumo', 'devolucion', 'ajuste')),
  bolsa text not null check (bolsa in ('comprado', 'promocional', 'fundador', 'protegido')),
  importe int not null check (importe <> 0),
  saldo_bolsa int not null check (saldo_bolsa >= 0),    -- saldo de ESA bolsa tras el movimiento
  referencia text check (char_length(referencia) <= 200),  -- nº de pago, «alta», mes «2026-10»…
  reserva_id uuid references public.coins_reservas(id) on delete restrict,
  motivo text check (char_length(motivo) <= 500),
  actor uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_coins_mov_local on public.coins_movimientos (local_id, id desc);
create index if not exists idx_fk_coins_mov_reserva on public.coins_movimientos (reserva_id);
create index if not exists idx_fk_coins_mov_actor on public.coins_movimientos (actor);
-- Recarga / bono / mensualidad: una sola vez por referencia (no hay doble abono).
create unique index if not exists uq_coins_mov_referencia on public.coins_movimientos (local_id, tipo, referencia)
  where referencia is not null and tipo in ('compra', 'promocional_mensual', 'bono_fundador');
-- Bono Fundador: una vez en la vida del local.
create unique index if not exists uq_coins_bono_fundador on public.coins_movimientos (local_id) where tipo = 'bono_fundador';
-- Una reserva se cobra una vez por bolsa y se devuelve una vez por bolsa.
create unique index if not exists uq_coins_mov_reserva on public.coins_movimientos (reserva_id, tipo, bolsa) where reserva_id is not null;

alter table public.coins_movimientos enable row level security;
grant select on public.coins_movimientos to authenticated;
drop policy if exists "coins_mov_select" on public.coins_movimientos;
create policy "coins_mov_select" on public.coins_movimientos for select to authenticated
  using ((select public.is_admin()) or public.owns_tardeo(local_id));

-- Inmutable: ni el admin edita ni borra un apunte. Se corrige con otro apunte.
create or replace function private.coins_inmutable()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'El libro de Coins no se edita ni se borra: añade un ajuste.' using errcode = '42501';
end $$;
revoke execute on function private.coins_inmutable() from public, anon, authenticated;
drop trigger if exists trg_coins_inmutable on public.coins_movimientos;
create trigger trg_coins_inmutable before update or delete on public.coins_movimientos
  for each row execute function private.coins_inmutable();

-- Saldo de una bolsa = suma de sus apuntes. El bono Fundador solo vale 2 meses
-- desde que se abonó; pasado eso se presenta a 0 (el apunte sigue ahí).
create or replace function private.coins_saldo_bolsa(p_local uuid, p_bolsa text)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(importe), 0)::int from public.coins_movimientos where local_id = p_local and bolsa = p_bolsa;
$$;
revoke execute on function private.coins_saldo_bolsa(uuid, text) from public, anon, authenticated;

create or replace function private.coins_saldos(p_local uuid)
returns table (bolsa text, saldo int, caduca timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_bono timestamptz;
begin
  if not (public.is_admin() or public.owns_tardeo(p_local)) then raise exception 'No es tu ficha' using errcode = '42501'; end if;
  select min(created_at) into v_bono from public.coins_movimientos where local_id = p_local and tipo = 'bono_fundador';
  return query
    select b.bolsa,
      case when b.bolsa = 'fundador' and v_bono is not null and v_bono + interval '2 months' < now() then 0
           else private.coins_saldo_bolsa(p_local, b.bolsa) end,
      case when b.bolsa = 'fundador' and v_bono is not null then v_bono + interval '2 months' else null end
    from (values ('comprado'), ('promocional'), ('fundador'), ('protegido')) b(bolsa);
end $$;
revoke execute on function private.coins_saldos(uuid) from public;
grant execute on function private.coins_saldos(uuid) to authenticated, service_role;
create or replace function public.coins_saldos(p_local uuid)
returns table (bolsa text, saldo int, caduca timestamptz)
language sql stable security invoker set search_path = public
as $$ select * from private.coins_saldos($1) $$;
grant execute on function public.coins_saldos(uuid) to authenticated;

-- Apunte interno (calcula el saldo resultante). Llamar con la fila del local bloqueada.
create or replace function private.coins_apuntar(p_local uuid, p_tipo text, p_bolsa text, p_importe int,
  p_referencia text, p_reserva uuid, p_motivo text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_saldo int; v_id bigint;
begin
  v_saldo := private.coins_saldo_bolsa(p_local, p_bolsa) + p_importe;
  if v_saldo < 0 then raise exception 'Saldo insuficiente en la bolsa %', p_bolsa using errcode = 'P0001'; end if;
  insert into public.coins_movimientos (local_id, tipo, bolsa, importe, saldo_bolsa, referencia, reserva_id, motivo)
  values (p_local, p_tipo, p_bolsa, p_importe, v_saldo, p_referencia, p_reserva, p_motivo)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function private.coins_apuntar(uuid, text, text, int, text, uuid, text) from public, anon, authenticated;

-- RESERVAR un servicio: descuenta UNA vez, en orden promocional → fundador →
-- protegido → comprado (primero lo que caduca). Las stories solo con comprado
-- o protegido (dossier pág. 13: incluidos/regalados solo dentro de la app).
create or replace function private.coins_reservar(p_local uuid, p_servicio text, p_tardeo uuid default null, p_detalle text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s record; v_res uuid; v_falta int; v_disp int; v_toma int; v_desglose jsonb := '{}'::jsonb; b text;
  v_orden text[];
begin
  if not (public.is_admin() or public.owns_tardeo(p_local)) then raise exception 'No es tu ficha' using errcode = '42501'; end if;
  if not private.ajuste_activo('coins_activos') then raise exception 'Los Coins están desactivados por ahora.' using errcode = 'P0001'; end if;
  select * into s from public.coins_servicios where slug = p_servicio and activo;
  if not found then raise exception 'Servicio no disponible' using errcode = 'P0001'; end if;
  if s.coste is null then raise exception 'Este servicio va con presupuesto: escríbenos.' using errcode = 'P0001'; end if;
  if p_tardeo is not null and not exists (select 1 from public.tardeos where id = p_tardeo and local_id = p_local) then
    raise exception 'Ese tardeo no es de esta ficha' using errcode = '42501';
  end if;
  if p_servicio <> 'evento_adicional' and coalesce(btrim(p_detalle), '') = '' and p_tardeo is null then
    raise exception 'Solicitud incompleta: di para qué evento o material es.' using errcode = 'P0001';
  end if;
  perform 1 from public.locales where id = p_local for update;   -- un descuento a la vez por local
  v_orden := case when s.solo_comprado then array['protegido', 'comprado'] else array['promocional', 'fundador', 'protegido', 'comprado'] end;
  v_falta := s.coste;
  insert into public.coins_reservas (local_id, servicio, coste, tardeo_id, detalle)
  values (p_local, p_servicio, s.coste, p_tardeo, nullif(btrim(p_detalle), '')) returning id into v_res;
  foreach b in array v_orden loop
    exit when v_falta = 0;
    select saldo into v_disp from private.coins_saldos(p_local) x where x.bolsa = b;
    v_toma := least(coalesce(v_disp, 0), v_falta);
    if v_toma > 0 then
      perform private.coins_apuntar(p_local, 'consumo', b, -v_toma, null, v_res, s.nombre);
      v_desglose := v_desglose || jsonb_build_object(b, v_toma);
      v_falta := v_falta - v_toma;
    end if;
  end loop;
  if v_falta > 0 then raise exception 'Saldo insuficiente: faltan % Coins.', v_falta using errcode = 'P0001'; end if;
  update public.coins_reservas set desglose = v_desglose where id = v_res;
  return v_res;
end $$;
revoke execute on function private.coins_reservar(uuid, text, uuid, text) from public;
grant execute on function private.coins_reservar(uuid, text, uuid, text) to authenticated, service_role;
create or replace function public.coins_reservar(p_local uuid, p_servicio text, p_tardeo uuid default null, p_detalle text default null)
returns uuid language sql security invoker set search_path = public
as $$ select private.coins_reservar($1, $2, $3, $4) $$;
grant execute on function public.coins_reservar(uuid, text, uuid, text) to authenticated;

-- CANCELAR antes de empezar: devolución íntegra al MISMO origen (bolsa a bolsa).
-- El local solo cancela lo pendiente; el admin, también lo confirmado.
create or replace function private.coins_cancelar(p_reserva uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record; b text; v int;
begin
  select * into r from public.coins_reservas where id = p_reserva for update;
  if not found then raise exception 'Reserva no encontrada' using errcode = 'P0001'; end if;
  if not (public.is_admin() or (public.owns_tardeo(r.local_id) and r.estado = 'pendiente')) then
    raise exception 'No puedes cancelar esta reserva' using errcode = '42501';
  end if;
  if r.estado not in ('pendiente', 'confirmada') then
    raise exception 'Ya no se puede cancelar: el trabajo está en curso o terminado.' using errcode = 'P0001';
  end if;
  perform 1 from public.locales where id = r.local_id for update;
  for b, v in select key, value::int from jsonb_each_text(r.desglose) loop
    if v > 0 then perform private.coins_apuntar(r.local_id, 'devolucion', b, v, null, r.id, coalesce(p_motivo, 'Cancelación')); end if;
  end loop;
  update public.coins_reservas set estado = 'cancelada', resuelta_en = now(),
    resultado = coalesce(nullif(btrim(p_motivo), ''), resultado) where id = r.id;
  if public.is_admin() then
    perform private.auditar('coins_cancelar', 'coins_reserva', r.id::text, null, jsonb_build_object('motivo', p_motivo, 'desglose', r.desglose));
  end if;
end $$;
revoke execute on function private.coins_cancelar(uuid, text) from public;
grant execute on function private.coins_cancelar(uuid, text) to authenticated, service_role;
create or replace function public.coins_cancelar(p_reserva uuid, p_motivo text default null)
returns void language sql security invoker set search_path = public
as $$ select private.coins_cancelar($1, $2) $$;
grant execute on function public.coins_cancelar(uuid, text) to authenticated;

-- El equipo mueve la reserva: confirmada → en_curso → entregada (con resultado).
-- Rechazar = cancelar con devolución (usar coins_cancelar).
create or replace function private.coins_admin_estado(p_reserva uuid, p_estado text, p_resultado text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador' using errcode = '42501'; end if;
  if p_estado not in ('confirmada', 'en_curso', 'entregada') then raise exception 'Estado no válido' using errcode = 'P0001'; end if;
  update public.coins_reservas set estado = p_estado,
    resultado = coalesce(nullif(btrim(p_resultado), ''), resultado),
    resuelta_en = case when p_estado = 'entregada' then now() else resuelta_en end
   where id = p_reserva and estado in ('pendiente', 'confirmada', 'en_curso');
  if not found then raise exception 'La reserva no está en un estado que se pueda cambiar' using errcode = 'P0001'; end if;
  perform private.auditar('coins_estado', 'coins_reserva', p_reserva::text, null, jsonb_build_object('estado', p_estado, 'resultado', p_resultado));
end $$;
revoke execute on function private.coins_admin_estado(uuid, text, text) from public;
grant execute on function private.coins_admin_estado(uuid, text, text) to authenticated, service_role;
create or replace function public.coins_admin_estado(p_reserva uuid, p_estado text, p_resultado text default null)
returns void language sql security invoker set search_path = public
as $$ select private.coins_admin_estado($1, $2, $3) $$;
grant execute on function public.coins_admin_estado(uuid, text, text) to authenticated;

-- Abonos y ajustes del equipo (sin pasarela: recargas a mano con su referencia).
--  compra 10/25/50/100 → bolsa comprado (no caduca, se conserva tras baja)
--  promocional_mensual → bolsa promocional, tope 20 acumulado
--  bono_fundador 10 → bolsa fundador, una vez, vale 2 meses
--  protegido → bolsa protegido (saldo afectado sin disponibilidad)
--  ajuste ± → cualquier bolsa, con motivo obligatorio
create or replace function private.coins_admin_apunte(p_local uuid, p_tipo text, p_bolsa text, p_importe int,
  p_motivo text, p_referencia text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_saldo int; v_importe int := p_importe; v_bolsa text := p_bolsa;
begin
  if not public.is_admin() then raise exception 'Solo un administrador' using errcode = '42501'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Pon el motivo del apunte' using errcode = 'P0001'; end if;
  perform 1 from public.locales where id = p_local for update;
  if not found then raise exception 'Local no encontrado' using errcode = 'P0001'; end if;
  if p_tipo = 'compra' then
    if p_importe not in (10, 25, 50, 100) then raise exception 'Paquetes: 10, 25, 50 o 100 Coins' using errcode = 'P0001'; end if;
    if coalesce(btrim(p_referencia), '') = '' then raise exception 'Una recarga necesita la referencia del pago' using errcode = 'P0001'; end if;
    v_bolsa := 'comprado';
  elsif p_tipo = 'promocional_mensual' then
    v_bolsa := 'promocional';
    v_saldo := private.coins_saldo_bolsa(p_local, 'promocional');
    v_importe := least(p_importe, 20 - v_saldo);
    if v_importe <= 0 then raise exception 'El saldo promocional ya está en el tope de 20' using errcode = 'P0001'; end if;
  elsif p_tipo = 'bono_fundador' then
    v_bolsa := 'fundador'; v_importe := 10;
    if not exists (select 1 from public.locales where id = p_local and plan = 'fundador') then
      raise exception 'El bono es solo para locales Fundadores' using errcode = 'P0001';
    end if;
  elsif p_tipo = 'protegido' then
    v_bolsa := 'protegido';
    if p_importe <= 0 then raise exception 'Importe positivo' using errcode = 'P0001'; end if;
  elsif p_tipo <> 'ajuste' then
    raise exception 'Tipo no válido' using errcode = 'P0001';
  end if;
  begin
    v_id := private.coins_apuntar(p_local, p_tipo, v_bolsa, v_importe, nullif(btrim(p_referencia), ''), null, p_motivo);
  exception when unique_violation then
    -- Recarga con la misma referencia o bono ya dado: nunca se abona dos veces.
    raise exception 'Ese apunte ya existe (referencia repetida o bono ya entregado).' using errcode = 'P0001';
  end;
  perform private.auditar('coins_' || p_tipo, 'local', p_local::text, null,
    jsonb_build_object('bolsa', v_bolsa, 'importe', v_importe, 'motivo', p_motivo, 'referencia', p_referencia, 'movimiento', v_id));
  return v_id;
end $$;
revoke execute on function private.coins_admin_apunte(uuid, text, text, int, text, text) from public;
grant execute on function private.coins_admin_apunte(uuid, text, text, int, text, text) to authenticated, service_role;
create or replace function public.coins_admin_apunte(p_local uuid, p_tipo text, p_bolsa text, p_importe int,
  p_motivo text, p_referencia text default null)
returns bigint language sql security invoker set search_path = public
as $$ select private.coins_admin_apunte($1, $2, $3, $4, $5, $6) $$;
grant execute on function public.coins_admin_apunte(uuid, text, text, int, text, text) to authenticated;

-- ---------------------------------------------------------------
-- 4) CANJE DE PROMOCIONES
-- ---------------------------------------------------------------
create table if not exists public.promo_canjes (
  id uuid primary key default gen_random_uuid(),
  promocion_id uuid not null references public.promociones(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  codigo text,
  created_at timestamptz not null default now(),
  unique (promocion_id, profile_id)            -- una vez por persona
);
create index if not exists idx_fk_promo_canjes_profile on public.promo_canjes (profile_id);
alter table public.promo_canjes enable row level security;
grant select on public.promo_canjes to authenticated;
drop policy if exists "promo_canjes_select" on public.promo_canjes;
create policy "promo_canjes_select" on public.promo_canjes for select to authenticated
  using (profile_id = (select auth.uid())
         or exists (select 1 from public.promociones p where p.id = promocion_id
                    and public.puede_editar_promo(p.tardeo_id, p.local_id)));

-- Bloquea la fila de la promoción: dos canjes a la vez se ponen en cola y el
-- segundo ve los usos ya sumados (no se pasa del límite).
create or replace function private.canjear_promocion(p_promo uuid, p_codigo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p record; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Entra con tu cuenta para canjear' using errcode = '42501'; end if;
  select * into p from public.promociones where id = p_promo for update;
  if not found then raise exception 'Promoción no encontrada' using errcode = 'P0001'; end if;
  if not p.activa or (p.desde is not null and p.desde > now()) or (p.hasta is not null and p.hasta < now()) then
    raise exception 'Esta promoción no está vigente' using errcode = 'P0001';
  end if;
  if p.limite_usos is not null and p.usos >= p.limite_usos then
    raise exception 'Se han agotado los canjes de esta promoción' using errcode = 'P0001';
  end if;
  if p.codigo is not null and upper(btrim(coalesce(p_codigo, ''))) <> upper(btrim(p.codigo)) then
    raise exception 'El código no es correcto' using errcode = 'P0001';
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
create or replace function public.canjear_promocion(p_promo uuid, p_codigo text default null)
returns jsonb language sql security invoker set search_path = public
as $$ select private.canjear_promocion($1, $2) $$;
grant execute on function public.canjear_promocion(uuid, text) to authenticated;

-- ---------------------------------------------------------------
-- 5) DJ ↔ EVENTO
-- ---------------------------------------------------------------
alter table public.djs add column if not exists provisional boolean not null default false;
alter table public.djs add column if not exists creado_por uuid references public.profiles(id) on delete set null;
create index if not exists idx_fk_djs_creado_por on public.djs (creado_por);
create index if not exists idx_djs_provisional on public.djs (provisional) where provisional;
grant select (provisional) on public.djs to anon, authenticated;

-- Un organizador escribe un DJ que no está en el directorio: se crea su ficha
-- PROVISIONAL (sin dueño, para revisión del equipo; el DJ la reclama después
-- con una invitación). Si ya existe con ese nombre, se devuelve esa.
create or replace function private.crear_dj_provisional(p_nombre text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n int; v_nombre text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
begin
  if not private.es_profesional() then raise exception 'Solo locales, organizadores y DJs' using errcode = '42501'; end if;
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 60 then raise exception 'Nombre de DJ no válido' using errcode = 'P0001'; end if;
  select id into v_id from public.djs
   where private.normalizar_titulo(nombre_artistico) = private.normalizar_titulo(v_nombre)
     and private.normalizar_titulo(v_nombre) <> '' limit 1;
  if v_id is not null then return v_id; end if;
  select count(*) into v_n from public.djs where creado_por = auth.uid() and created_at > now() - interval '1 day';
  if v_n >= 20 and not public.is_admin() then raise exception 'Has creado muchos DJs hoy. Escríbenos.' using errcode = 'P0001'; end if;
  insert into public.djs (nombre_artistico, provisional, creado_por) values (v_nombre, true, auth.uid()) returning id into v_id;
  return v_id;
end $$;
revoke execute on function private.crear_dj_provisional(text) from public;
grant execute on function private.crear_dj_provisional(text) to authenticated, service_role;
create or replace function public.crear_dj_provisional(p_nombre text)
returns uuid language sql security invoker set search_path = public
as $$ select private.crear_dj_provisional($1) $$;
grant execute on function public.crear_dj_provisional(text) to authenticated;

create table if not exists public.dj_solicitudes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('vinculo', 'propuesta')),
  dj_id uuid not null references public.djs(id) on delete cascade,
  tardeo_id uuid references public.tardeos(id) on delete cascade,
  -- Propuesta de evento nuevo: título, fecha, hora, lugar, enlace, nota.
  propuesta jsonb,
  mensaje text check (char_length(mensaje) <= 500),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'retirada')),
  nota_resolucion text check (char_length(nota_resolucion) <= 500),
  resuelta_por uuid references public.profiles(id) on delete set null,
  resuelta_en timestamptz,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint dj_sol_forma check (
    (tipo = 'vinculo' and tardeo_id is not null) or (tipo = 'propuesta' and propuesta is not null))
);
create unique index if not exists uq_dj_sol_pendiente on public.dj_solicitudes (dj_id, tardeo_id)
  where estado = 'pendiente' and tipo = 'vinculo';
create index if not exists idx_dj_sol_dj on public.dj_solicitudes (dj_id, created_at desc);
create index if not exists idx_dj_sol_cola on public.dj_solicitudes (tipo, estado, created_at);
create index if not exists idx_fk_dj_sol_tardeo on public.dj_solicitudes (tardeo_id);
create index if not exists idx_fk_dj_sol_resuelta on public.dj_solicitudes (resuelta_por);
create index if not exists idx_fk_dj_sol_created_by on public.dj_solicitudes (created_by);
alter table public.dj_solicitudes enable row level security;
grant select, insert on public.dj_solicitudes to authenticated;
drop policy if exists "dj_sol_select" on public.dj_solicitudes;
create policy "dj_sol_select" on public.dj_solicitudes for select to authenticated
  using (public.es_mi_dj(dj_id) or (tardeo_id is not null and public.gestiona_tardeo(tardeo_id)) or (select public.is_admin()));
drop policy if exists "dj_sol_insert" on public.dj_solicitudes;
create policy "dj_sol_insert" on public.dj_solicitudes for insert to authenticated
  with check (public.es_mi_dj(dj_id) and estado = 'pendiente' and resuelta_por is null and resuelta_en is null
              and (created_by is null or created_by = (select auth.uid())));

-- Resolver: el vínculo lo decide quien gestiona el tardeo (o admin); la
-- propuesta, el equipo. El DJ puede retirar la suya.
create or replace function private.resolver_solicitud_dj(p_id uuid, p_estado text, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from public.dj_solicitudes where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada' using errcode = 'P0001'; end if;
  if s.estado <> 'pendiente' then raise exception 'Ya estaba resuelta' using errcode = 'P0001'; end if;
  if p_estado = 'retirada' then
    if not public.es_mi_dj(s.dj_id) then raise exception 'No es tuya' using errcode = '42501'; end if;
  elsif p_estado in ('aprobada', 'rechazada') then
    if s.tipo = 'vinculo' and not public.gestiona_tardeo(s.tardeo_id) then raise exception 'No gestionas ese tardeo' using errcode = '42501'; end if;
    if s.tipo = 'propuesta' and not public.is_admin() then raise exception 'Solo el equipo revisa propuestas' using errcode = '42501'; end if;
  else
    raise exception 'Estado no válido' using errcode = 'P0001';
  end if;
  update public.dj_solicitudes set estado = p_estado, nota_resolucion = nullif(btrim(p_nota), ''),
    resuelta_por = auth.uid(), resuelta_en = now() where id = p_id;
  if p_estado = 'aprobada' and s.tipo = 'vinculo' then
    insert into public.tardeo_djs (tardeo_id, dj_id) values (s.tardeo_id, s.dj_id) on conflict do nothing;
  end if;
  if public.is_admin() then
    perform private.auditar('solicitud_dj_' || p_estado, 'dj_solicitud', p_id::text, null, jsonb_build_object('tipo', s.tipo, 'nota', p_nota));
  end if;
end $$;
revoke execute on function private.resolver_solicitud_dj(uuid, text, text) from public;
grant execute on function private.resolver_solicitud_dj(uuid, text, text) to authenticated, service_role;
create or replace function public.resolver_solicitud_dj(p_id uuid, p_estado text, p_nota text default null)
returns void language sql security invoker set search_path = public
as $$ select private.resolver_solicitud_dj($1, $2, $3) $$;
grant execute on function public.resolver_solicitud_dj(uuid, text, text) to authenticated;

-- Bandeja del organizador: solicitudes de vínculo a SUS tardeos, con el nombre
-- del DJ y del tardeo (el tardeo puede estar en borrador).
create or replace function private.solicitudes_dj_de_local(p_local uuid)
returns table (id uuid, estado text, mensaje text, created_at timestamptz, dj_id uuid, dj_nombre text,
               dj_avatar text, tardeo_id uuid, titulo text, fecha date)
language sql stable security definer set search_path = public as $$
  select s.id, s.estado, s.mensaje, s.created_at, d.id, d.nombre_artistico, d.avatar_url, t.id, t.titulo, t.fecha
    from public.dj_solicitudes s
    join public.tardeos t on t.id = s.tardeo_id
    join public.djs d on d.id = s.dj_id
   where s.tipo = 'vinculo' and t.local_id = p_local
     and (public.is_admin() or public.owns_tardeo(p_local))
   order by (s.estado = 'pendiente') desc, s.created_at desc
   limit 100;
$$;
revoke execute on function private.solicitudes_dj_de_local(uuid) from public;
grant execute on function private.solicitudes_dj_de_local(uuid) to authenticated, service_role;
create or replace function public.solicitudes_dj_de_local(p_local uuid)
returns table (id uuid, estado text, mensaje text, created_at timestamptz, dj_id uuid, dj_nombre text,
               dj_avatar text, tardeo_id uuid, titulo text, fecha date)
language sql stable security invoker set search_path = public
as $$ select * from private.solicitudes_dj_de_local($1) $$;
grant execute on function public.solicitudes_dj_de_local(uuid) to authenticated;

-- ---------------------------------------------------------------
-- 6) INCIDENCIAS con referencia y borrador ("Necesito ayuda")
-- ---------------------------------------------------------------
alter table public.incidencias add column if not exists referencia text check (char_length(referencia) <= 200);
alter table public.incidencias add column if not exists borrador jsonb check (pg_column_size(borrador) <= 20000);

-- ---------------------------------------------------------------
-- 7) MÉTRICAS POR CANAL (panel del local, 7/30/90)
-- ---------------------------------------------------------------
create or replace function private.metricas_canales_local(p_local uuid, p_dias int default 30)
returns table (canal text, total bigint)
language sql stable security definer set search_path = public as $$
  select case e.tipo when 'clic_entrada' then 'entrada' when 'clic_lista' then 'lista'
                     else coalesce(nullif(e.detalle, ''), 'otro') end, count(*)
    from public.eventos_metrica e
    left join public.tardeos t on t.id = e.tardeo_id
   where e.tipo in ('clic_entrada', 'clic_lista', 'clic_contacto')
     and (e.local_id = p_local or t.local_id = p_local)
     and e.created_at >= now() - (greatest(p_dias, 1) || ' days')::interval
     and (public.is_admin() or public.owns_tardeo(p_local))
   group by 1;
$$;
revoke execute on function private.metricas_canales_local(uuid, int) from public;
grant execute on function private.metricas_canales_local(uuid, int) to authenticated, service_role;
create or replace function public.metricas_canales_local(p_local uuid, p_dias int default 30)
returns table (canal text, total bigint)
language sql stable security invoker set search_path = public
as $$ select * from private.metricas_canales_local($1, $2) $$;
grant execute on function public.metricas_canales_local(uuid, int) to authenticated;

-- ---------------------------------------------------------------
-- Disparadores (al final: usan tablas de arriba)
-- ---------------------------------------------------------------
drop trigger if exists trg_tardeos_control_cupo on public.tardeos;
create trigger trg_tardeos_control_cupo before insert or update of estado on public.tardeos
  for each row execute function private.tardeos_control_cupo();
drop trigger if exists trg_promos_control_plan on public.promociones;
create trigger trg_promos_control_plan before insert or update of activa on public.promociones
  for each row execute function private.promos_control_plan();
drop trigger if exists trg_locales_control_fundador on public.locales;
create trigger trg_locales_control_fundador before insert or update of plan on public.locales
  for each row execute function private.locales_control_fundador();

notify pgrst, 'reload schema';


-- >>>>>>>>>>>>>>>>>>>> 69_admin_zonas.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- TardeosClub · LOTE 69: ADMIN POR ZONAS Y TAREAS, COLAS, MEDICIÓN
-- (dossier 14‑oct‑2026, págs. 15 y 16)
-- =============================================================
--  1) admin_roles: quién administra qué zona madre (barcelona / tarragona /
--     girona) o qué tarea (sorteos, moderación, comercial, nexo).
--     COMPATIBLE: is_admin() sigue siendo verdad para cualquier admin, y quien
--     tiene profiles.is_admin = true SIN filas aquí es admin GLOBAL (los admins
--     de hoy siguen igual). Las filas solo RESTRINGEN.
--  2) Zona normalizada en locales y tardeos (`zona_slug`, rellenada por
--     disparador desde el texto libre `zona`) y políticas de edición/borrado
--     por zona: el admin de Tarragona no toca un local de Barcelona.
--  3) Colas de trabajo: `asignaciones` (responsable, estado, nota) sin tocar
--     tablas de otros equipos + `cola_trabajo()` unificada (degrada si las
--     tablas de los lotes 64‑68 aún no existen).
--  4) Listas y espera editables por admin, con rastro en `auditoria`.
--  5) Medición: origen de campaña, `es_equipo`, deduplicado en servidor,
--     tipos nuevos, cohortes de retorno 7/28 días, estadísticas sin equipo.
--  6) Documenta `favoritos` (tabla) y `flyers` (bucket de Storage), que
--     existían en producción y en ningún lote. Si existen, no se tocan.
--
-- No borra datos. Idempotente (se puede pegar dos veces).
-- =============================================================

-- 0) favoritos y flyers (documentación) ----------------------------------------
-- Columnas tal como están en producción (leídas el 15‑oct): clave compuesta.
create table if not exists public.favoritos (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tardeo_id uuid not null references public.tardeos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, tardeo_id)
);
create index if not exists idx_fk_favoritos_tardeo on public.favoritos (tardeo_id);
alter table public.favoritos enable row level security;
grant select, insert, delete on public.favoritos to authenticated;
-- Políticas solo si la tabla no tiene ninguna (base nueva). En producción ya
-- tiene las suyas (+ "favoritos_admin_lee" del lote 56) y no se tocan.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'favoritos') then
    create policy "favoritos_select" on public.favoritos for select to authenticated
      using (profile_id = (select auth.uid()) or (select public.is_admin()));
    create policy "favoritos_insert" on public.favoritos for insert to authenticated
      with check (profile_id = (select auth.uid()));
    create policy "favoritos_delete" on public.favoritos for delete to authenticated
      using (profile_id = (select auth.uid()));
  end if;
end $$;

-- `flyers` NO es una tabla: es el bucket público de Storage donde se suben
-- flyers, logos, fotos de press kit e imágenes de pop‑ups. Se deja escrito
-- para que una base nueva lo tenga (en local no hay esquema storage).
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('flyers', 'flyers', true)
    on conflict (id) do nothing;
  end if;
end $$;

-- 1) admin_roles -----------------------------------------------------------------
create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  zona_madre text check (zona_madre in ('barcelona', 'tarragona', 'girona')),  -- null = todas
  tarea text not null check (tarea in ('global', 'zona', 'sorteos', 'moderacion', 'comercial', 'nexo')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_admin_roles on public.admin_roles (profile_id, tarea, coalesce(zona_madre, '*'));
create index if not exists idx_fk_admin_roles_profile on public.admin_roles (profile_id);
create index if not exists idx_fk_admin_roles_created_by on public.admin_roles (created_by);
alter table public.admin_roles enable row level security;
grant select on public.admin_roles to authenticated;
-- Se ve lo propio (para pintar el menú) y, si eres admin, todo el equipo.
-- Nadie escribe directamente: solo con admin_asignar_rol / admin_quitar_rol.
drop policy if exists "admin_roles_select" on public.admin_roles;
create policy "admin_roles_select" on public.admin_roles for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));

-- ¿Admin global? service role, o is_admin sin filas, o con fila 'global'.
create or replace function private.es_admin_global()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
      or (coalesce((select is_admin from public.profiles where id = auth.uid()), false)
          and (not exists (select 1 from public.admin_roles r where r.profile_id = auth.uid())
               or exists (select 1 from public.admin_roles r where r.profile_id = auth.uid() and r.tarea = 'global')));
$$;

-- ¿Puede administrar esta zona madre? Global, o rol 'zona' de esa zona (o de todas).
create or replace function private.admin_de_zona(p_zona_madre text)
returns boolean language sql stable security definer set search_path = public as $$
  select private.es_admin_global()
      or (p_zona_madre is not null
          and coalesce((select is_admin from public.profiles where id = auth.uid()), false)
          and exists (select 1 from public.admin_roles r
                       where r.profile_id = auth.uid() and r.tarea = 'zona'
                         and (r.zona_madre is null or r.zona_madre = p_zona_madre)));
$$;

-- ¿Tiene esta tarea? (sorteos, moderación…). El global las tiene todas.
create or replace function private.admin_tarea(p_tarea text)
returns boolean language sql stable security definer set search_path = public as $$
  select private.es_admin_global()
      or (coalesce((select is_admin from public.profiles where id = auth.uid()), false)
          and exists (select 1 from public.admin_roles r where r.profile_id = auth.uid() and r.tarea = p_tarea));
$$;

-- Para RLS: ¿puede administrar una fila cuya zona normalizada es p_slug?
-- Sin zona (null o no reconocida) solo el admin global: no se puede saber de quién es.
create or replace function private.admin_de_slug(p_slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select private.es_admin_global()
      or (p_slug is not null and private.admin_de_zona((select z.zona_madre from public.zonas z where z.slug = p_slug)));
$$;

-- Zonas madre que administra quien llama (null = todas). Para filtrar listas.
create or replace function private.mis_zonas_admin()
returns text[] language sql stable security definer set search_path = public as $$
  select case
    when private.es_admin_global() then null
    when exists (select 1 from public.admin_roles r where r.profile_id = auth.uid() and r.tarea = 'zona' and r.zona_madre is null) then null
    else coalesce((select array_agg(distinct r.zona_madre) from public.admin_roles r
                    where r.profile_id = auth.uid() and r.tarea = 'zona' and r.zona_madre is not null), '{}')
  end;
$$;

do $$
declare f text;
begin
  foreach f in array array['es_admin_global()', 'admin_de_zona(text)', 'admin_tarea(text)', 'admin_de_slug(text)', 'mis_zonas_admin()'] loop
    execute format('revoke execute on function private.%s from public', f);
    execute format('grant execute on function private.%s to anon, authenticated, service_role', f);
  end loop;
end $$;

create or replace function public.es_admin_global() returns boolean
  language sql stable security invoker set search_path = public as $$ select private.es_admin_global() $$;
create or replace function public.admin_de_zona(p_zona_madre text) returns boolean
  language sql stable security invoker set search_path = public as $$ select private.admin_de_zona($1) $$;
create or replace function public.admin_tarea(p_tarea text) returns boolean
  language sql stable security invoker set search_path = public as $$ select private.admin_tarea($1) $$;
create or replace function public.admin_de_slug(p_slug text) returns boolean
  language sql stable security invoker set search_path = public as $$ select private.admin_de_slug($1) $$;
create or replace function public.mis_zonas_admin() returns text[]
  language sql stable security invoker set search_path = public as $$ select private.mis_zonas_admin() $$;

-- Gestión del equipo (solo admin global). Asignar un rol da acceso al panel
-- (is_admin = true); quitar el último lo retira, porque una persona con
-- is_admin y SIN filas sería admin global: justo lo contrario de lo querido.
create or replace function private.admin_asignar_rol(p_email text, p_tarea text, p_zona_madre text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_rol uuid;
begin
  if not private.es_admin_global() then raise exception 'Solo un administrador global' using errcode = '42501'; end if;
  select id into v_id from public.profiles where lower(email) = lower(trim(p_email)) limit 1;
  if v_id is null then raise exception 'No hay ninguna cuenta con ese email' using errcode = 'P0002'; end if;
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

create or replace function private.admin_quitar_rol(p_rol uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.admin_roles;
begin
  if not private.es_admin_global() then raise exception 'Solo un administrador global' using errcode = '42501'; end if;
  select * into r from public.admin_roles where id = p_rol;
  if r.id is null then return; end if;
  if r.profile_id = auth.uid() then raise exception 'No puedes quitarte tus propios permisos' using errcode = '42501'; end if;
  delete from public.admin_roles where id = p_rol;
  if not exists (select 1 from public.admin_roles where profile_id = r.profile_id) then
    update public.profiles set is_admin = false where id = r.profile_id;
  end if;
  perform private.auditar('quitar_rol', 'admin_roles', r.profile_id::text, r.zona_madre, jsonb_build_object('tarea', r.tarea));
end $$;

-- Lista del equipo con email (solo admins).
create or replace function private.equipo_admin()
returns table (profile_id uuid, email text, nombre text, rol_id uuid, tarea text, zona_madre text, desde timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.email, p.display_name, r.id, coalesce(r.tarea, 'global'), r.zona_madre, coalesce(r.created_at, p.created_at)
  from public.profiles p
  left join public.admin_roles r on r.profile_id = p.id
  where p.is_admin and public.is_admin()
  order by p.email, r.tarea;
$$;

revoke execute on function private.admin_asignar_rol(text, text, text) from public, anon;
grant execute on function private.admin_asignar_rol(text, text, text) to authenticated, service_role;
revoke execute on function private.admin_quitar_rol(uuid) from public, anon;
grant execute on function private.admin_quitar_rol(uuid) to authenticated, service_role;
revoke execute on function private.equipo_admin() from public, anon;
grant execute on function private.equipo_admin() to authenticated, service_role;

create or replace function public.admin_asignar_rol(p_email text, p_tarea text, p_zona_madre text default null) returns uuid
  language sql security invoker set search_path = public as $$ select private.admin_asignar_rol($1, $2, $3) $$;
create or replace function public.admin_quitar_rol(p_rol uuid) returns void
  language sql security invoker set search_path = public as $$ select private.admin_quitar_rol($1) $$;
create or replace function public.equipo_admin()
returns table (profile_id uuid, email text, nombre text, rol_id uuid, tarea text, zona_madre text, desde timestamptz)
  language sql stable security invoker set search_path = public as $$ select * from private.equipo_admin() $$;
revoke execute on function public.admin_asignar_rol(text, text, text) from public, anon;
grant execute on function public.admin_asignar_rol(text, text, text) to authenticated, service_role;
revoke execute on function public.admin_quitar_rol(uuid) from public, anon;
grant execute on function public.admin_quitar_rol(uuid) to authenticated, service_role;

-- 2) Zona normalizada ------------------------------------------------------------
-- Sinónimos texto libre → zona del catálogo (mismo mapa que lib/zonas.ts).
create table if not exists public.zona_sinonimos (
  clave text primary key,           -- normalizada: minúsculas, sin acentos ni artículo
  zona_slug text not null references public.zonas(slug) on update cascade
);
create index if not exists idx_fk_zona_sinonimos_zona on public.zona_sinonimos (zona_slug);
alter table public.zona_sinonimos enable row level security;
grant select on public.zona_sinonimos to anon, authenticated;
drop policy if exists "zona_sinonimos_select" on public.zona_sinonimos;
create policy "zona_sinonimos_select" on public.zona_sinonimos for select using (true);

create or replace function private.normalizar_texto_zona(p text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(
           btrim(regexp_replace(
             translate(lower(coalesce(p, '')), 'àáâäèéêëìíîïòóôöùúûüçñ·', 'aaaaeeeeiiiioooouuuucn.'),
             '[^a-z0-9]+', ' ', 'g')),
           '^(l|el|la|les|els) ', '');
$$;

create or replace function private.normalizar_zona(p text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select z.slug from public.zonas z
      where private.normalizar_texto_zona(z.slug) = private.normalizar_texto_zona(p)
         or private.normalizar_texto_zona(z.nombre) = private.normalizar_texto_zona(p) limit 1),
    (select s.zona_slug from public.zona_sinonimos s where s.clave = private.normalizar_texto_zona(p)));
$$;
revoke execute on function private.normalizar_texto_zona(text) from public;
grant execute on function private.normalizar_texto_zona(text) to anon, authenticated, service_role;
revoke execute on function private.normalizar_zona(text) from public;
grant execute on function private.normalizar_zona(text) to anon, authenticated, service_role;
create or replace function public.normalizar_zona(p text) returns text
  language sql stable security invoker set search_path = public as $$ select private.normalizar_zona($1) $$;

insert into public.zona_sinonimos (clave, zona_slug)
select private.normalizar_texto_zona(s), z from (values
  ('barcelona','Barbera del Valles'),('barcelona','Castellar del Valles'),('barcelona','L''Ametlla del Valles'),('barcelona','Llinars del Valles'),
  ('barcelona','Vilanova i la Geltru'),('barcelona','Sant Pere de Ribes'),('barcelona','Barcelones'),('barcelona','Badalona'),
  ('barcelona','Santa Coloma de Gramenet'),('barcelona','Sant Adria de Besos'),('barcelona','Baix Llobregat'),('barcelona','Hospitalet de Llobregat'),
  ('barcelona','Cornella de Llobregat'),('barcelona','Sant Boi'),('barcelona','Sant Boi de Llobregat'),('barcelona','Castelldefels'),('barcelona','Gava'),
  ('barcelona','Viladecans'),('barcelona','Sitges'),('barcelona','El Prat de Llobregat'),('barcelona','Valles Occidental'),('barcelona','Valles Oriental'),
  ('barcelona','Sabadell'),('barcelona','Terrassa'),('barcelona','Granollers'),('barcelona','Mollet del Valles'),('barcelona','Santa Perpetua de Mogoda'),
  ('barcelona','Cerdanyola del Valles'),('barcelona','Rubi'),('barcelona','Sant Cugat del Valles'),
  ('maresme','Cabrils'),('maresme','Palafolls'),('maresme','Malgrat'),('maresme','Santa Susana'),('maresme','Mataro'),('maresme','Calella'),
  ('maresme','Pineda de Mar'),('maresme','Santa Susanna'),('maresme','Malgrat de Mar'),('maresme','Arenys de Mar'),('maresme','Canet de Mar'),
  ('maresme','Premia de Mar'),('maresme','El Masnou'),('maresme','Vilassar de Mar'),('maresme','Cabrera de Mar'),('maresme','Alella'),
  ('maresme','Canyamars'),('maresme','Dosrius'),('maresme','Tordera'),('maresme','Sant Pol de Mar'),
  ('costa-brava','Calonge'),('costa-brava','Figueres'),('costa-brava','Gualta'),('costa-brava','L''Armentera'),('costa-brava','La Bisbal d''Emporda'),
  ('costa-brava','Llafranc'),('costa-brava','Peralada'),('costa-brava','Platja de Pals'),('costa-brava','S''Agaro'),('costa-brava','Santa Cristina d''Aro'),
  ('costa-brava','Lloret de Mar'),('costa-brava','Blanes'),('costa-brava','Roses'),('costa-brava','Cadaques'),('costa-brava','Palamos'),
  ('costa-brava','Platja d''Aro'),('costa-brava','Sant Feliu de Guixols'),('costa-brava','Pals'),('costa-brava','Estartit'),
  ('costa-brava','Torroella de Montgri'),('costa-brava','Sant Pere Pescador'),('costa-brava','Escala'),('costa-brava','Empuriabrava'),
  ('costa-brava','Castello d''Empuries'),('costa-brava','Begur'),('costa-brava','Tossa de Mar'),('costa-brava','Calella de Palafrugell'),('costa-brava','Palafrugell'),
  ('costa-daurada','Constanti'),('costa-daurada','Montbrio del Camp'),('costa-daurada','Riudoms'),('costa-daurada','La Torre del Sol'),
  ('costa-daurada','Costa Dorada'),('costa-daurada','Salou'),('costa-daurada','Cambrils'),('costa-daurada','Altafulla'),('costa-daurada','Reus'),
  ('costa-daurada','Vila-seca'),('costa-daurada','Torredembarra'),('costa-daurada','Calafell'),('costa-daurada','El Vendrell'),('costa-daurada','Coma-ruga'),
  ('costa-daurada','Mont-roig del Camp'),('costa-daurada','L''Hospitalet de l''Infant'),('costa-daurada','Hospitalet de l''Infant'),('costa-daurada','Miami Platja'),
  ('costa-daurada','El Tarragones'),
  ('terres-de-lebre','Riumar'),('terres-de-lebre','Rasquera'),('terres-de-lebre','Els Reguers'),('terres-de-lebre','Amposta'),('terres-de-lebre','Deltebre'),
  ('terres-de-lebre','Tortosa'),('terres-de-lebre','Sant Carles de la Rapita'),('terres-de-lebre','La Rapita'),('terres-de-lebre','Ampolla'),
  ('terres-de-lebre','L''Ametlla de Mar'),('terres-de-lebre','Alcanar'),('terres-de-lebre','Les Cases d''Alcanar'),
  ('ponent','Cubells'),('ponent','Rossello'),('ponent','Lleida'),('ponent','Castell del Remei'),('ponent','Penelles'),('ponent','Balaguer'),
  ('ponent','Mollerussa'),('ponent','Tarrega'),('ponent','Cervera'),('ponent','La Noguera'),('ponent','Pla d''Urgell'),('ponent','Segria')
) v(z, s)
where exists (select 1 from public.zonas where slug = v.z)
on conflict (clave) do nothing;

alter table public.locales add column if not exists zona_slug text;
alter table public.tardeos add column if not exists zona_slug text;
create index if not exists idx_locales_zona_slug on public.locales (zona_slug);
create index if not exists idx_tardeos_zona_slug on public.tardeos (zona_slug);

-- Siempre se recalcula desde `zona`: el navegador no puede fijarla a mano.
create or replace function public.zona_slug_local()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.zona_slug := private.normalizar_zona(new.zona);
  return new;
end $$;
-- El tardeo usa su zona y, si no la tiene o no se reconoce, la de su local.
create or replace function public.zona_slug_tardeo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.zona_slug := coalesce(private.normalizar_zona(new.zona),
                            (select l.zona_slug from public.locales l where l.id = new.local_id));
  return new;
end $$;
revoke execute on function public.zona_slug_local() from public, anon, authenticated;
revoke execute on function public.zona_slug_tardeo() from public, anon, authenticated;
drop trigger if exists trg_zona_slug_locales on public.locales;
create trigger trg_zona_slug_locales before insert or update on public.locales
  for each row execute function public.zona_slug_local();
drop trigger if exists trg_zona_slug_tardeos on public.tardeos;
create trigger trg_zona_slug_tardeos before insert or update on public.tardeos
  for each row execute function public.zona_slug_tardeo();

-- Relleno de lo que ya hay SIN disparar el resto de disparadores (updated_at,
-- protecciones…): no debe cambiar nada más que la columna nueva. Se apagan
-- solo los que estaban encendidos y se vuelven a encender esos mismos.
do $$
declare t text; trg record; apagados text[];
begin
  foreach t in array array['locales', 'tardeos'] loop
    apagados := array[]::text[];
    for trg in select tgname from pg_trigger
                where tgrelid = ('public.' || t)::regclass and not tgisinternal and tgenabled <> 'D' loop
      execute format('alter table public.%I disable trigger %I', t, trg.tgname);
      apagados := apagados || trg.tgname::text;
    end loop;
    if t = 'locales' then
      update public.locales set zona_slug = private.normalizar_zona(zona)
       where zona_slug is distinct from private.normalizar_zona(zona);
    else
      update public.tardeos x set zona_slug = coalesce(private.normalizar_zona(x.zona),
                                   (select l.zona_slug from public.locales l where l.id = x.local_id))
       where x.zona_slug is distinct from coalesce(private.normalizar_zona(x.zona),
                                   (select l.zona_slug from public.locales l where l.id = x.local_id));
    end if;
    for i in 1 .. coalesce(array_length(apagados, 1), 0) loop
      execute format('alter table public.%I enable trigger %I', t, apagados[i]);
    end loop;
  end loop;
end $$;

-- Políticas de edición por zona. Sustituyen `is_admin()` por
-- `admin_de_slug(zona_slug)` SOLO en escribir/borrar; leer sigue igual. El
-- dueño (owner_id / owns_tardeo) conserva exactamente lo que tenía.
drop policy if exists "locales_update" on public.locales;
create policy "locales_update" on public.locales for update
  using (owner_id = (select auth.uid()) or (select public.es_admin_global()) or public.admin_de_slug(zona_slug))
  with check (owner_id = (select auth.uid()) or (select public.es_admin_global()) or public.admin_de_slug(zona_slug));
drop policy if exists "locales_delete" on public.locales;
create policy "locales_delete" on public.locales for delete
  using ((select public.es_admin_global()) or public.admin_de_slug(zona_slug));
drop policy if exists "locales_insert" on public.locales;
create policy "locales_insert" on public.locales for insert
  with check (owner_id = (select auth.uid()) or (select public.es_admin_global()) or public.admin_de_slug(zona_slug));

drop policy if exists "tardeos_update" on public.tardeos;
create policy "tardeos_update" on public.tardeos for update
  using (owns_tardeo(local_id) or (select public.es_admin_global()) or public.admin_de_slug(zona_slug))
  with check (owns_tardeo(local_id) or (select public.es_admin_global()) or public.admin_de_slug(zona_slug));
drop policy if exists "tardeos_delete" on public.tardeos;
create policy "tardeos_delete" on public.tardeos for delete
  using (owns_tardeo(local_id) or (select public.es_admin_global()) or public.admin_de_slug(zona_slug));
drop policy if exists "tardeos_insert" on public.tardeos;
create policy "tardeos_insert" on public.tardeos for insert
  with check (owns_tardeo(local_id) or (select public.es_admin_global()) or public.admin_de_slug(zona_slug));

-- 3) Colas de trabajo ---------------------------------------------------------------
create table if not exists public.asignaciones (
  tipo text not null,
  objeto_id text not null,
  responsable uuid references public.profiles(id) on delete set null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'hecho', 'descartado')),
  nota text check (char_length(nota) <= 1000),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (tipo, objeto_id)
);
create index if not exists idx_fk_asignaciones_responsable on public.asignaciones (responsable);
create index if not exists idx_fk_asignaciones_updated_by on public.asignaciones (updated_by);
alter table public.asignaciones enable row level security;
grant select on public.asignaciones to authenticated;
drop policy if exists "asignaciones_select" on public.asignaciones;
create policy "asignaciones_select" on public.asignaciones for select to authenticated
  using ((select public.is_admin()));

-- Cola unificada. Cada fuente va en su propio bloque con to_regclass y
-- captura de errores: si una tabla de los lotes 64‑68 aún no existe (o cambia
-- de columnas), esa fuente se salta y el resto sigue funcionando.
create or replace function private.cola_trabajo(p_tipo text default null, p_zona text default null,
                                                p_solo_mias boolean default false, p_estado text default 'abiertas',
                                                p_limite int default 25, p_desde int default 0)
returns table (tipo text, objeto_id text, titulo text, detalle text, zona_madre text, fecha timestamptz,
               enlace text, responsable uuid, responsable_nombre text, estado text, nota text, total bigint)
language plpgsql volatile security definer set search_path = public as $$
declare
  fuentes text[] := array[]::text[];
  sql text;
  mis text[] := private.mis_zonas_admin();
begin
  if not public.is_admin() then return; end if;

  -- validación profesional: locales/promotores en borrador
  fuentes := array_append(fuentes, $q$select 'validacion'::text, l.id::text, l.nombre, coalesce(l.tipo,'local'), z.zona_madre, l.created_at, '/admin/locales?id=' || l.id
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
  -- Lote 68 (equipo E): solicitudes de DJs (vínculo / evento propuesto) y
  -- reservas de Coins. Si el lote aún no está, se saltan.
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
    with c as (
      select c.*, a.responsable, coalesce(a.estado, 'pendiente') as est, a.nota
      from _cola c left join public.asignaciones a on a.tipo = c.tipo and a.objeto_id = c.objeto_id
      where (p_tipo is null or c.tipo = p_tipo)
        and (mis is null or c.zona_madre is null or c.zona_madre = any(mis))
        and (p_zona is null or c.zona_madre = p_zona)
        and (not p_solo_mias or a.responsable = auth.uid())
        and (p_estado = 'todas' or (p_estado = 'abiertas' and coalesce(a.estado, 'pendiente') in ('pendiente', 'en_curso'))
             or coalesce(a.estado, 'pendiente') = p_estado)
    )
    select c.tipo, c.objeto_id, c.titulo, c.detalle, c.zona_madre, c.fecha, c.enlace,
           c.responsable, coalesce(p.display_name, p.email), c.est, c.nota, count(*) over ()
    from c left join public.profiles p on p.id = c.responsable
    order by c.fecha desc nulls last, c.tipo, c.objeto_id
    limit greatest(least(p_limite, 200), 1) offset greatest(p_desde, 0);
end $$;

create or replace function private.asignar_cola(p_tipo text, p_objeto text, p_responsable uuid, p_estado text, p_nota text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador' using errcode = '42501'; end if;
  if p_responsable is not null and not exists (select 1 from public.profiles where id = p_responsable and is_admin) then
    raise exception 'El responsable tiene que ser del equipo' using errcode = '22023';
  end if;
  insert into public.asignaciones (tipo, objeto_id, responsable, estado, nota, updated_by, updated_at)
  values (p_tipo, p_objeto, p_responsable, coalesce(p_estado, 'pendiente'), p_nota, auth.uid(), now())
  on conflict (tipo, objeto_id) do update
    set responsable = excluded.responsable, estado = excluded.estado,
        nota = coalesce(excluded.nota, asignaciones.nota), updated_by = auth.uid(), updated_at = now();
  perform private.auditar('cola_' || coalesce(p_estado, 'pendiente'), p_tipo, p_objeto, null,
    jsonb_build_object('responsable', p_responsable, 'nota', p_nota));
end $$;

revoke execute on function private.cola_trabajo(text, text, boolean, text, int, int) from public, anon;
grant execute on function private.cola_trabajo(text, text, boolean, text, int, int) to authenticated, service_role;
revoke execute on function private.asignar_cola(text, text, uuid, text, text) from public, anon;
grant execute on function private.asignar_cola(text, text, uuid, text, text) to authenticated, service_role;

-- cola_trabajo crea una tabla temporal: no puede ser "stable" en el envoltorio.
create or replace function public.cola_trabajo(p_tipo text default null, p_zona text default null,
                                               p_solo_mias boolean default false, p_estado text default 'abiertas',
                                               p_limite int default 25, p_desde int default 0)
returns table (tipo text, objeto_id text, titulo text, detalle text, zona_madre text, fecha timestamptz,
               enlace text, responsable uuid, responsable_nombre text, estado text, nota text, total bigint)
language sql security invoker set search_path = public
as $$ select * from private.cola_trabajo($1, $2, $3, $4, $5, $6) $$;
create or replace function public.asignar_cola(p_tipo text, p_objeto text, p_responsable uuid, p_estado text default 'en_curso', p_nota text default null)
returns void language sql security invoker set search_path = public
as $$ select private.asignar_cola($1, $2, $3, $4, $5) $$;
revoke execute on function public.cola_trabajo(text, text, boolean, text, int, int) from public, anon;
grant execute on function public.cola_trabajo(text, text, boolean, text, int, int) to authenticated, service_role;
revoke execute on function public.asignar_cola(text, text, uuid, text, text) from public, anon;
grant execute on function public.asignar_cola(text, text, uuid, text, text) to authenticated, service_role;

-- 4) Listas y espera editables por admin --------------------------------------------
-- Mueve una inscripción a apuntado / espera / cancelado. El aforo lo sigue
-- vigilando el disparador del lote 48 (si no hay plaza, error claro). 'espera'
-- solo si el lote 64 ya la admite en la restricción.
create or replace function private.admin_mover_inscripcion(p_inscripcion uuid, p_estado text)
returns void language plpgsql security definer set search_path = public as $$
declare i record;
begin
  select ins.id, ins.estado, ins.tardeo_id, t.zona_slug into i
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
  update public.inscripciones set estado = p_estado where id = p_inscripcion;
  perform private.auditar('mover_inscripcion', 'inscripcion', p_inscripcion::text,
    (select z.zona_madre from public.zonas z where z.slug = i.zona_slug),
    jsonb_build_object('de', i.estado, 'a', p_estado, 'tardeo', i.tardeo_id));
end $$;

-- Pasa a apuntado al primero de la espera (por orden de llegada; si el lote
-- 64 trae `espera_desde`, manda esa fecha). El lote 64 además promueve solo
-- al liberarse plaza: esto es la excepción manual del equipo.
create or replace function private.admin_promover_espera(p_tardeo uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_zona text; v_orden text;
begin
  select zona_slug into v_zona from public.tardeos where id = p_tardeo;
  if not found then raise exception 'Tardeo no encontrado' using errcode = 'P0002'; end if;
  if not private.admin_de_slug(v_zona) then raise exception 'Este tardeo no es de tu zona' using errcode = '42501'; end if;
  v_orden := case when exists (select 1 from information_schema.columns where table_schema = 'public'
                                 and table_name = 'inscripciones' and column_name = 'espera_desde')
                  then 'espera_desde nulls last, created_at' else 'created_at' end;
  execute format('select id from public.inscripciones where tardeo_id = $1 and estado = ''espera'' order by %s, id limit 1', v_orden)
    into v_id using p_tardeo;
  if v_id is null then return null; end if;
  perform set_config('app.sistema_espera', 'on', true);
  update public.inscripciones set estado = 'apuntado' where id = v_id;
  perform set_config('app.sistema_espera', 'off', true);
  perform private.auditar('promover_espera', 'inscripcion', v_id::text,
    (select z.zona_madre from public.zonas z where z.slug = v_zona), jsonb_build_object('tardeo', p_tardeo));
  return v_id;
end $$;

revoke execute on function private.admin_mover_inscripcion(uuid, text) from public, anon;
grant execute on function private.admin_mover_inscripcion(uuid, text) to authenticated, service_role;
revoke execute on function private.admin_promover_espera(uuid) from public, anon;
grant execute on function private.admin_promover_espera(uuid) to authenticated, service_role;
create or replace function public.admin_mover_inscripcion(p_inscripcion uuid, p_estado text) returns void
  language sql security invoker set search_path = public as $$ select private.admin_mover_inscripcion($1, $2) $$;
create or replace function public.admin_promover_espera(p_tardeo uuid) returns uuid
  language sql security invoker set search_path = public as $$ select private.admin_promover_espera($1) $$;
revoke execute on function public.admin_mover_inscripcion(uuid, text) from public, anon;
grant execute on function public.admin_mover_inscripcion(uuid, text) to authenticated, service_role;
revoke execute on function public.admin_promover_espera(uuid) from public, anon;
grant execute on function public.admin_promover_espera(uuid) to authenticated, service_role;

-- 5) Medición ------------------------------------------------------------------------
alter table public.eventos_metrica add column if not exists origen text check (char_length(origen) <= 60);   -- utm_source / ?o= / canal
alter table public.eventos_metrica add column if not exists medio text check (char_length(medio) <= 60);     -- utm_medium
alter table public.eventos_metrica add column if not exists campana text check (char_length(campana) <= 80); -- utm_campaign
alter table public.eventos_metrica add column if not exists es_equipo boolean not null default false;
alter table public.eventos_metrica add column if not exists dia date;  -- día en Madrid; base del deduplicado
create index if not exists idx_em_origen on public.eventos_metrica (origen, created_at desc) where origen is not null;

-- Tipos nuevos (dossier pág. 16). Se mantiene todo lo anterior.
alter table public.eventos_metrica drop constraint if exists eventos_metrica_tipo_check;
alter table public.eventos_metrica add constraint eventos_metrica_tipo_check check (tipo in (
  'vista_tardeo', 'vista_local', 'vista_dj', 'clic_entrada', 'clic_lista', 'inscripcion', 'favorito',
  'vista_home', 'vista_listado', 'vista_mapa', 'busqueda', 'busqueda_vacia', 'filtro',
  'para_ti_visto', 'para_ti_clic', 'clic_contacto',
  'seguir', 'play', 'asistire', 'espera', 'meet_entrar', 'clic_externo', 'sorteo_participar', 'aviso_abierto'));

-- es_equipo y día los pone el servidor: el navegador no decide si cuenta.
create or replace function public.metrica_marcar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.dia := (coalesce(new.created_at, now()) at time zone 'Europe/Madrid')::date;
  new.es_equipo := coalesce((select p.is_admin or coalesce(p.email, '') ilike '%@prueba.tardeosclub.com'
                               from public.profiles p where p.id = new.profile_id), false);
  return new;
end $$;
revoke execute on function public.metrica_marcar() from public, anon, authenticated;
drop trigger if exists trg_metrica_marcar on public.eventos_metrica;
create trigger trg_metrica_marcar before insert on public.eventos_metrica
  for each row execute function public.metrica_marcar();

-- Deduplicado: una vez por pestaña + tipo + objeto + detalle + día. Parcial
-- en `dia is not null`, así las filas antiguas (sin día) no chocan entre sí.
create unique index if not exists uq_em_dedupe on public.eventos_metrica
  (sesion, tipo, coalesce(tardeo_id, local_id, dj_id), coalesce(detalle, ''), dia)
  where dia is not null and sesion is not null and sesion <> '';

-- Registrar sin error si ya estaba (ON CONFLICT sin destino vale con índices
-- de expresión). Invoker: la política em_insert sigue mandando.
create or replace function public.medir_evento(p_tipo text, p_tardeo uuid default null, p_local uuid default null, p_dj uuid default null,
                                               p_sesion text default null, p_destino text default null, p_detalle text default null,
                                               p_origen text default null, p_medio text default null, p_campana text default null)
returns void language sql security invoker set search_path = public as $$
  insert into public.eventos_metrica (tipo, tardeo_id, local_id, dj_id, profile_id, sesion, destino, detalle, origen, medio, campana)
  values (p_tipo, p_tardeo, p_local, p_dj, (select auth.uid()), nullif(p_sesion, ''), left(p_destino, 500), left(p_detalle, 80),
          left(p_origen, 60), left(p_medio, 60), left(p_campana, 80))
  on conflict do nothing;
$$;
grant execute on function public.medir_evento(text, uuid, uuid, uuid, text, text, text, text, text, text) to anon, authenticated, service_role;

-- Estadísticas del admin SIN equipo ni pruebas (misma salida que el lote 36 +
-- 'origenes'). Se reescribe entera para añadir el filtro.
create or replace function private.metricas_resumen(p_dias integer default 30)
returns json language sql stable security definer set search_path = public as $$
  with e as (
    select * from public.eventos_metrica
     where created_at >= now() - (greatest(p_dias, 1) || ' days')::interval
       and not es_equipo
       and public.is_admin()
  )
  select json_build_object(
    'total', (select count(*) from e),
    'por_tipo', (select coalesce(json_agg(x order by x.total desc), '[]'::json)
                   from (select tipo, count(*) as total from e group by tipo) x),
    'por_dia', (select coalesce(json_agg(x order by x.dia), '[]'::json)
                  from (select date_trunc('day', created_at)::date as dia, tipo, count(*) as total from e group by 1, 2) x),
    'personas', (select count(distinct coalesce(profile_id::text, sesion)) from e),
    'top_tardeos', (select coalesce(json_agg(x order by x.total desc), '[]'::json)
                      from (select t.id, t.titulo, t.fecha, count(*) as total from e join public.tardeos t on t.id = e.tardeo_id
                             where e.tipo = 'vista_tardeo' group by t.id, t.titulo, t.fecha order by count(*) desc limit 10) x),
    'top_locales', (select coalesce(json_agg(x order by x.total desc), '[]'::json)
                      from (select l.id, l.nombre, count(*) as total from e join public.locales l on l.id = e.local_id
                             where e.tipo = 'vista_local' group by l.id, l.nombre order by count(*) desc limit 10) x),
    'top_djs', (select coalesce(json_agg(x order by x.total desc), '[]'::json)
                  from (select d.id, d.nombre_artistico as nombre, count(*) as total from e join public.djs d on d.id = e.dj_id
                         where e.tipo = 'vista_dj' group by d.id, d.nombre_artistico order by count(*) desc limit 10) x),
    'busquedas', (select coalesce(json_agg(x order by x.total desc), '[]'::json)
                    from (select detalle as texto, count(*) as total, count(*) filter (where tipo = 'busqueda_vacia') as sin_resultados
                            from e where tipo in ('busqueda','busqueda_vacia') and detalle is not null
                           group by detalle order by count(*) desc limit 20) x),
    'filtros', (select coalesce(json_agg(x order by x.total desc), '[]'::json)
                  from (select detalle as filtro, count(*) as total from e where tipo = 'filtro' and detalle is not null
                         group by detalle order by count(*) desc limit 20) x),
    'ticketeras', (select coalesce(json_agg(x order by x.total desc), '[]'::json)
                     from (select split_part(split_part(replace(replace(destino, 'https://', ''), 'http://', ''), '/', 1), '?', 1) as dominio,
                                  count(*) as total from e where tipo in ('clic_entrada','clic_lista') and destino is not null
                            group by 1 order by count(*) desc limit 10) x),
    -- Origen de campaña: de dónde llegan (Ruta del Tardeo, WhatsApp, IG, QR…).
    'origenes', (select coalesce(json_agg(x order by x.personas desc), '[]'::json)
                   from (select coalesce(origen, '(directo)') as origen, campana,
                                count(distinct coalesce(profile_id::text, sesion)) as personas, count(*) as eventos
                           from e group by 1, 2 order by 3 desc limit 20) x)
  );
$$;

-- Cohortes de retorno: de las cuentas nuevas de cada semana (sin equipo ni
-- pruebas), cuántas vuelven con una acción útil entre el día 1 y el 7, y
-- entre el día 1 y el 28. Con denominador y "madura" (si ya pasó el plazo):
-- una cohorte que aún no ha cumplido 28 días no puede dar su 28 d real.
create or replace function private.cohortes_retorno(p_semanas integer default 12)
returns table (semana date, cuentas bigint, volvieron_7 bigint, volvieron_28 bigint, madura_7 boolean, madura_28 boolean)
language sql stable security definer set search_path = public as $$
  with c as (
    select p.id, p.created_at, date_trunc('week', p.created_at at time zone 'Europe/Madrid')::date as semana
      from public.profiles p
     where public.is_admin()
       and not p.is_admin and coalesce(p.email, '') not ilike '%@prueba.tardeosclub.com'
       and p.created_at >= date_trunc('week', now()) - (greatest(p_semanas, 1) || ' weeks')::interval
  ), util as (
    select e.profile_id, e.created_at from public.eventos_metrica e
     where e.profile_id is not null and not e.es_equipo
       and e.tipo in ('favorito', 'inscripcion', 'asistire', 'espera', 'seguir', 'play', 'clic_entrada', 'clic_lista',
                      'clic_contacto', 'clic_externo', 'meet_entrar', 'sorteo_participar')
  )
  select c.semana, count(*),
         count(*) filter (where exists (select 1 from util u where u.profile_id = c.id
                                         and u.created_at >= c.created_at + interval '1 day' and u.created_at < c.created_at + interval '8 days')),
         count(*) filter (where exists (select 1 from util u where u.profile_id = c.id
                                         and u.created_at >= c.created_at + interval '1 day' and u.created_at < c.created_at + interval '29 days')),
         c.semana + 14 <= current_date, c.semana + 35 <= current_date
    from c group by c.semana order by c.semana desc;
$$;
revoke execute on function private.cohortes_retorno(integer) from public, anon;
grant execute on function private.cohortes_retorno(integer) to authenticated, service_role;
create or replace function public.cohortes_retorno(p_semanas integer default 12)
returns table (semana date, cuentas bigint, volvieron_7 bigint, volvieron_28 bigint, madura_7 boolean, madura_28 boolean)
language sql stable security invoker set search_path = public as $$ select * from private.cohortes_retorno($1) $$;
revoke execute on function public.cohortes_retorno(integer) from public, anon;
grant execute on function public.cohortes_retorno(integer) to authenticated, service_role;

notify pgrst, 'reload schema';
