-- =========================================================
-- TardeosClub · LOTE 14: EL EMAIL DEL LOCAL DEJA DE SER PÚBLICO
-- Aplicar en Supabase → SQL Editor (base nueva). Va con el Lote 13.
--
-- La política "locales_select" hace pública la fila entera de un local activo,
-- y la anon key viaja dentro del JavaScript del navegador. Con `email` en la
-- tabla, los 59 correos se cosechaban en una sola petición sin autenticarse:
--
--   GET /rest/v1/locales?select=nombre,email   ->  los 59
--
-- POR QUÉ NO BASTA UN REVOKE DE COLUMNA:
-- Supabase le concede a `anon` el SELECT a nivel de TABLA. Mientras lo tenga,
-- un "revoke select (email)" no hace nada: el permiso de tabla ya autoriza
-- todas las columnas. Hay que quitarle el de tabla y devolverle las columnas
-- una a una, todas menos la que queremos esconder.
--
-- MANTENIMIENTO: si algún día añades una columna a `locales` y quieres que se
-- vea en público, tienes que concederla aquí también. Si no, `anon` no la verá.
-- =========================================================

revoke select on public.locales from anon;

grant select (
  id, owner_id, nombre, descripcion, direccion, lat, lng, zona,
  telefono, redes, fotos, horarios, verificado, estado,
  fourvenues_rrpp_code, created_at, updated_at, codigo_postal, origen_id
) on public.locales to anon;

-- PostgREST cachea el esquema; sin esto puede tardar en enterarse.
notify pgrst, 'reload schema';

-- Comprobación con la anon key:
--   select=nombre,email  -> debe fallar con "permission denied for column email"
--   select=nombre        -> debe funcionar
--
-- OJO: getLocalById() ya pide columnas explícitas. Si alguien lo devuelve a
-- select("*"), la ficha pública romperá, porque `*` incluye email.
