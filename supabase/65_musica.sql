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
