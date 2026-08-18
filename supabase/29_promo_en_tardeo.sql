-- =========================================================
-- TardeosClub · LOTE 29: PROMOCIÓN DENTRO DEL PROPIO TARDEO
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- El local promociona SU tardeo, dentro de SU ficha. No es el pop-up de
-- portada: aquel lo lanza el admin y le salta a quien no ha pedido nada. Esto
-- solo lo ve quien YA ha entrado a mirar ese tardeo, así que no interrumpe.
-- =========================================================

alter table public.tardeos add column if not exists promo_titulo text;
alter table public.tardeos add column if not exists promo_texto  text;

-- Etiquetas cortas para la tarjeta y la ficha: "2x1", "Chicas gratis hasta las
-- 20 h", "Entrada con consumición"… Texto libre porque cada local tiene las
-- suyas y una lista cerrada se queda corta el primer finde.
alter table public.tardeos add column if not exists etiquetas text[];

-- Lo mismo en la ficha del local o promotor.
alter table public.locales add column if not exists promo_titulo text;
alter table public.locales add column if not exists promo_texto  text;

-- `locales` va con permisos columna a columna desde el lote 14: sin esto las
-- columnas nuevas nacen invisibles para los visitantes.
grant select (promo_titulo, promo_texto, etiquetas) on public.tardeos to anon;
grant select (promo_titulo, promo_texto, etiquetas) on public.tardeos to authenticated;
grant select (promo_titulo, promo_texto) on public.locales to anon;
grant select (promo_titulo, promo_texto) on public.locales to authenticated;

notify pgrst, 'reload schema';
