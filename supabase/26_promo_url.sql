-- =========================================================
-- TardeosClub · LOTE 26: ENLACE DE PROMOCIONES
--
-- El de entradas ya existe: `fourvenues_url`, que se llama así por la app
-- antigua pero guarda cualquier enlace de venta. Se reutiliza en vez de crear
-- otra columna con el mismo contenido.
-- =========================================================

alter table public.tardeos add column if not exists promo_url text;

grant select (promo_url) on public.tardeos to anon;
grant select (promo_url) on public.tardeos to authenticated;

notify pgrst, 'reload schema';
