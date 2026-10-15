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
