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
