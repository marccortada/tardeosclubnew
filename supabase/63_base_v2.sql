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
