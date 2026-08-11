-- =========================================================
-- TardeosClub · LOTE 18: SUSCRIPCIONES A NOTIFICACIONES PUSH
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Cada fila es un navegador que aceptó recibir notificaciones. El endpoint lo
-- emite el navegador (Google/Apple/Mozilla) y es único por suscripción; las dos
-- claves cifran el mensaje para que solo ese navegador pueda leerlo.
-- =========================================================

create table if not exists public.push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  -- Null si acepta sin tener cuenta: la notificación es del navegador, no del
  -- usuario. Si luego inicia sesión y reactiva, se enlaza.
  profile_id uuid references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_profile on public.push_suscripciones(profile_id);

alter table public.push_suscripciones enable row level security;

-- Buzón de solo escritura: cualquiera puede dejar su suscripción, nadie puede
-- leer las de los demás (los endpoints son capacidad de envío: con ellos
-- cualquiera podría mandar notificaciones). Solo el servidor las lee, con la
-- service role, que se salta RLS.
--
-- No hay política de UPDATE ni DELETE a propósito: si una suscripción caduca,
-- el navegador emite un endpoint nuevo (fila nueva) y la vieja se poda sola
-- cuando el envío devuelve 404/410.
drop policy if exists "push_insert" on public.push_suscripciones;
create policy "push_insert" on public.push_suscripciones
  for insert to anon, authenticated with check (true);
