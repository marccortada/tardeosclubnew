-- =========================================================
-- TardeosClub · LOTE 13: EMAIL DE CONTACTO DEL LOCAL
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Hacía falta para las invitaciones: de los 58 locales migrados solo 12 traían
-- teléfono, así que sin email no había forma de mandarles el enlace para
-- reclamar su ficha.
--
-- Es el email de contacto DEL LOCAL (venues.email en la app vieja), no el de
-- la cuenta personal de quien lo registró. Lo protege la misma RLS que el
-- resto de la fila: solo lo ven el dueño y el admin... salvo que el local esté
-- activo, que entonces la política de lectura es pública. Ojo con eso si
-- algún día se pinta en la ficha pública.
-- =========================================================

alter table public.locales add column if not exists email text;
