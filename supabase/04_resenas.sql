-- =========================================================
-- TardeosClub · LOTE 4: RESEÑAS
-- Aplicar en Supabase → SQL Editor
-- =========================================================
create table if not exists public.resenas (
  id uuid primary key default gen_random_uuid(),
  autor_profile_id uuid references public.profiles(id) on delete set null,
  objetivo_tipo text not null check (objetivo_tipo in ('local','dj')),
  objetivo_id uuid not null,
  puntuacion int not null check (puntuacion between 1 and 5),
  comentario text,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  created_at timestamptz not null default now()
);
alter table public.resenas enable row level security;
create policy "resenas_lectura" on public.resenas for select
  using (estado = 'aprobada' or autor_profile_id = auth.uid() or public.is_admin());
create policy "resenas_insert" on public.resenas for insert
  with check (autor_profile_id = auth.uid());
create policy "resenas_update" on public.resenas for update using (public.is_admin());
create policy "resenas_delete" on public.resenas for delete
  using (autor_profile_id = auth.uid() or public.is_admin());
create index if not exists idx_resenas_obj on public.resenas(objetivo_tipo, objetivo_id, estado);
