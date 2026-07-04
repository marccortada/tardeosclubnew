-- ============================================================
-- LOTE 6 · Foto de perfil del DJ
-- ============================================================

alter table public.djs
  add column if not exists avatar_url text;
