-- 77 · Fotos de locales que apuntaban al Supabase ANTIGUO (20-oct-2026)
-- Idempotente. No borra nada: solo cambia enlaces.
--
-- Por qué: el proyecto antiguo (obevrycebhqdqtvxnxoy) se borró el 20-oct y 57
-- locales activos tenían su galería enlazada allí: las fotos salían rotas. Las
-- mismas imágenes ya estaban copiadas en el Storage nuevo, en
-- flyers/migrados/<misma ruta> (comprobadas una a una antes de aplicar).
-- Los enlaces anteriores quedan en _bak_limpieza_locales (lote 76) por si acaso.
begin;
-- Escritura de servidor: los disparadores de protección no deben deshacerla.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select count(*) as locales_a_corregir from public.locales
 where fotos::text like '%obevrycebhqdqtvxnxoy.supabase.co/storage/v1/object/public/%';

update public.locales
   set fotos = replace(fotos::text,
                 'https://obevrycebhqdqtvxnxoy.supabase.co/storage/v1/object/public/',
                 'https://fmbzcjsbyazkzsiiykto.supabase.co/storage/v1/object/public/flyers/migrados/')::jsonb
 where fotos::text like '%obevrycebhqdqtvxnxoy.supabase.co/storage/v1/object/public/%';

select count(*) as quedan_en_el_antiguo from public.locales where fotos::text like '%obevrycebhqdqtvxnxoy%';
commit;
