-- =========================================================
-- TardeosClub · LOTE 12: la service role cuenta como admin
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Los triggers del Lote 9 (proteger_locales, proteger_djs, proteger_tardeos)
-- preguntan por is_admin() para decidir si pisan las columnas privilegiadas.
-- Con la service role key auth.uid() es null, así que is_admin() devolvía
-- false y CUALQUIER script de servidor veía cómo le forzaban sus locales a
-- 'borrador'. Se descubrió migrando la app vieja: los 59 locales entraban
-- invisibles y sus tardeos salían con el nombre del local en blanco.
--
-- Esto no abre ninguna puerta: la service role ya se salta RLS entera. Solo
-- hace que los triggers la traten como lo que es, el backend.
-- =========================================================

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           ''
         ) = 'service_role'
      or coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
