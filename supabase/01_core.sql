-- =========================================================
-- TardeosClub · Esquema Supabase · LOTE 1: NÚCLEO
-- Aplicar en: Supabase → SQL Editor (ejecutar una vez)
-- =========================================================

-- 0) UTILIDADES ------------------------------------------------
create extension if not exists pgcrypto;

-- Trigger genérico updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- 1) PROFILES (1 fila por persona; extiende auth.users) --------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  email text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crear profile automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: ¿el usuario actual es admin? (security definer evita recursión RLS)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- 2) LOCALES ---------------------------------------------------
create table if not exists public.locales (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  nombre text not null,
  descripcion text,
  direccion text,
  lat double precision,
  lng double precision,
  zona text,
  telefono text,
  redes jsonb default '{}'::jsonb,
  fotos jsonb default '[]'::jsonb,
  horarios jsonb default '{}'::jsonb,
  verificado boolean not null default false,
  estado text not null default 'borrador' check (estado in ('borrador','activo','oculto_impago')),
  fourvenues_rrpp_code text,      -- código RRPP que da el local para atribución
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_locales_zona on public.locales(zona);
create index if not exists idx_locales_owner on public.locales(owner_id);
drop trigger if exists trg_locales_updated on public.locales;
create trigger trg_locales_updated before update on public.locales
  for each row execute function public.set_updated_at();

-- 3) DJS -------------------------------------------------------
create table if not exists public.djs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  nombre_artistico text not null,
  bio text,
  estilos text[] default '{}',
  galeria jsonb default '[]'::jsonb,
  redes jsonb default '{}'::jsonb,
  verificado boolean not null default false,
  reputacion_score numeric(3,2) default 0,
  oculto boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_djs_profile on public.djs(profile_id);

-- 4) TARDEOS ---------------------------------------------------
create table if not exists public.tardeos (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locales(id) on delete cascade,
  titulo text not null,
  descripcion text,
  fecha date not null,
  hora_inicio time,
  hora_fin time,
  direccion text,                 -- por defecto la del local
  lat double precision,
  lng double precision,
  zona text,                      -- DINÁMICA: alimenta los filtros
  estilo text,
  flyer_url text,
  flyer_origen text check (flyer_origen in ('subido','ia')),
  es_de_pago boolean not null default false,
  tiene_lista boolean not null default false,
  fourvenues_url text,            -- enlace de compra/lista (con código RRPP)
  estado text not null default 'borrador' check (estado in ('borrador','publicado','finalizado','cancelado')),
  destacado_hasta timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tardeos_estado_fecha on public.tardeos(estado, fecha);
create index if not exists idx_tardeos_zona on public.tardeos(zona);
create index if not exists idx_tardeos_local on public.tardeos(local_id);
drop trigger if exists trg_tardeos_updated on public.tardeos;
create trigger trg_tardeos_updated before update on public.tardeos
  for each row execute function public.set_updated_at();

-- 5) TARDEO_DJS (M:N) -----------------------------------------
create table if not exists public.tardeo_djs (
  tardeo_id uuid references public.tardeos(id) on delete cascade,
  dj_id uuid references public.djs(id) on delete cascade,
  primary key (tardeo_id, dj_id)
);

-- 6) INSCRIPCIONES (tardeos gratis) ---------------------------
create table if not exists public.inscripciones (
  id uuid primary key default gen_random_uuid(),
  tardeo_id uuid not null references public.tardeos(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  estado text not null default 'apuntado' check (estado in ('apuntado','cancelado')),
  created_at timestamptz not null default now(),
  unique (tardeo_id, profile_id)
);

-- 7) CLICS_ATRIBUCION (redirecciones a Fourvenues) ------------
create table if not exists public.clics_atribucion (
  id uuid primary key default gen_random_uuid(),
  tardeo_id uuid not null references public.tardeos(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  tipo text check (tipo in ('entrada','lista')),
  destino_url text,
  created_at timestamptz not null default now()
);

-- Helper: ¿el usuario es dueño del local de un tardeo?
create or replace function public.owns_tardeo(t_local uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.locales l where l.id = t_local and l.owner_id = auth.uid());
$$;

-- =========================================================
-- RLS (Row Level Security) — cada uno solo ve/edita lo suyo
-- =========================================================
alter table public.profiles        enable row level security;
alter table public.locales         enable row level security;
alter table public.djs             enable row level security;
alter table public.tardeos         enable row level security;
alter table public.tardeo_djs      enable row level security;
alter table public.inscripciones   enable row level security;
alter table public.clics_atribucion enable row level security;

-- PROFILES
create policy "perfil_select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "perfil_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- LOCALES
create policy "locales_select" on public.locales
  for select using (estado = 'activo' or owner_id = auth.uid() or public.is_admin());
create policy "locales_insert" on public.locales
  for insert with check (owner_id = auth.uid() or public.is_admin());
create policy "locales_update" on public.locales
  for update using (owner_id = auth.uid() or public.is_admin());
create policy "locales_delete" on public.locales
  for delete using (public.is_admin());

-- DJS
create policy "djs_select" on public.djs
  for select using (not oculto or profile_id = auth.uid() or public.is_admin());
create policy "djs_insert" on public.djs
  for insert with check (profile_id = auth.uid() or public.is_admin());
create policy "djs_update" on public.djs
  for update using (profile_id = auth.uid() or public.is_admin());

-- TARDEOS
create policy "tardeos_select" on public.tardeos
  for select using (estado = 'publicado' or public.owns_tardeo(local_id) or public.is_admin());
create policy "tardeos_insert" on public.tardeos
  for insert with check (public.owns_tardeo(local_id) or public.is_admin());
create policy "tardeos_update" on public.tardeos
  for update using (public.owns_tardeo(local_id) or public.is_admin());
create policy "tardeos_delete" on public.tardeos
  for delete using (public.owns_tardeo(local_id) or public.is_admin());

-- TARDEO_DJS
create policy "tardeo_djs_select" on public.tardeo_djs
  for select using (true);
create policy "tardeo_djs_manage" on public.tardeo_djs
  for all using (exists(select 1 from public.tardeos t where t.id = tardeo_id
                        and (public.owns_tardeo(t.local_id) or public.is_admin())))
  with check (exists(select 1 from public.tardeos t where t.id = tardeo_id
                        and (public.owns_tardeo(t.local_id) or public.is_admin())));

-- INSCRIPCIONES
create policy "inscr_select" on public.inscripciones
  for select using (
    profile_id = auth.uid() or public.is_admin()
    or exists(select 1 from public.tardeos t where t.id = tardeo_id and public.owns_tardeo(t.local_id))
  );
create policy "inscr_insert" on public.inscripciones
  for insert with check (profile_id = auth.uid());
create policy "inscr_update" on public.inscripciones
  for update using (profile_id = auth.uid());
create policy "inscr_delete" on public.inscripciones
  for delete using (profile_id = auth.uid() or public.is_admin());

-- CLICS_ATRIBUCION
create policy "clics_insert" on public.clics_atribucion
  for insert with check (true);
create policy "clics_select" on public.clics_atribucion
  for select using (public.is_admin()
    or exists(select 1 from public.tardeos t where t.id = tardeo_id and public.owns_tardeo(t.local_id)));

-- =========================================================
-- FIN LOTE 1
-- Después de aplicar, hazte admin con tu email:
--   update public.profiles set is_admin = true where email = 'TU_EMAIL';
-- =========================================================
