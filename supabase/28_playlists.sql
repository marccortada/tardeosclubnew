-- =========================================================
-- TardeosClub · LOTE 28: PLAYLIST DE LOCALES, PROMOTORES Y DJs
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Una playlist por ficha: la que los representa. Es distinto del contenido
-- suelto del DJ (lote 27), que son muchas sesiones sueltas; esto es "la
-- nuestra", la que suena en el sitio.
--
-- Promotores incluidos sin hacer nada: comparten tabla con los locales y solo
-- se distinguen por `tipo`.
-- =========================================================

alter table public.locales add column if not exists playlist_url text;
alter table public.djs     add column if not exists playlist_url text;

-- `locales` está cerrado columna a columna desde el lote 14 (por el email), así
-- que una columna nueva nace INVISIBLE para los visitantes si no se concede
-- aquí. En `djs` no hace falta, pero se pone igual para que no dependa de
-- recordar cuál de las dos tablas estaba restringida.
grant select (playlist_url) on public.locales to anon;
grant select (playlist_url) on public.locales to authenticated;
grant select (playlist_url) on public.djs to anon;
grant select (playlist_url) on public.djs to authenticated;

notify pgrst, 'reload schema';
