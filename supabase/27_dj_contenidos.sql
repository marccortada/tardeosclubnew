-- =========================================================
-- TardeosClub · LOTE 27: CONTENIDO Y ZONA DE LOS DJs
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- §5.1 y §5.2 del documento. Lo de §5.3 —que las reseñas manden en el orden de
-- los destacados— ya funciona: el lote 7 recalcula `reputacion_score` con cada
-- reseña y getDjsPublicos ordena por destacado_orden, verificado y reputación.
-- =========================================================

alter table public.djs add column if not exists zonas    text[];
alter table public.djs add column if not exists contacto text;

-- Sesiones, mixes, vídeos y fotos.
--
-- Los mixes y vídeos van como ENLACE y no como fichero a propósito: un DJ ya
-- los tiene en SoundCloud, Mixcloud o YouTube, y guardar audio propio son gigas
-- de almacenamiento y un reproductor que mantener para no dar nada que no dé
-- ya el enlace. Las fotos sí se suben, que esas no viven en ningún sitio.
create table if not exists public.dj_contenidos (
  id uuid primary key default gen_random_uuid(),
  dj_id uuid not null references public.djs(id) on delete cascade,
  tipo text not null check (tipo in ('sesion','video','foto','flyer')),
  titulo text,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_dj_contenidos on public.dj_contenidos(dj_id, created_at desc);

alter table public.dj_contenidos enable row level security;

-- Se ve lo de los DJs visibles; lo edita su dueño y el admin. Un DJ oculto se
-- sigue viendo a sí mismo, que si no no podría preparar su perfil antes de
-- enseñarlo.
drop policy if exists "dj_contenidos_select" on public.dj_contenidos;
create policy "dj_contenidos_select" on public.dj_contenidos for select
  using (exists (select 1 from public.djs d where d.id = dj_id
                 and (not d.oculto or d.profile_id = auth.uid() or public.is_admin())));

drop policy if exists "dj_contenidos_write" on public.dj_contenidos;
create policy "dj_contenidos_write" on public.dj_contenidos for all
  using (exists (select 1 from public.djs d where d.id = dj_id
                 and (d.profile_id = auth.uid() or public.is_admin())));

grant select (zonas, contacto) on public.djs to anon;
grant select (zonas, contacto) on public.djs to authenticated;

notify pgrst, 'reload schema';
