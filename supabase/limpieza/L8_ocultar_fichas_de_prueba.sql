-- L8 · Ocultar las fichas de prueba que hoy ve el público
-- Proyecto TardeosClub · 17-oct-2026
-- Las tres fichas que CLAUDE.md §11 da por pruebas (gnerai, Interdesign, localp) están
-- ACTIVAS y salen en el directorio, el mapa y con sus tardeos (13 en total). Se pasan a
-- 'oculto' (lote 43): no se borra nada y se deshace volviendo a 'activo'.
-- NO incluye "oletu" (sin dueño, 0 tardeos): no consta como prueba. Confírmalo antes.
-- Independiente del resto de la limpieza: se puede pegar cuando quieras.

begin;

-- El SQL Editor no tiene sesión de usuario: para la base no eres admin, y los disparadores
-- de protección (lotes 9, 19, 33, 37) DESHARÍAN EN SILENCIO los cambios de estado, orden de
-- destacados y planes. Esto marca la transacción como escritura del servidor (igual que la
-- service role) y solo dura hasta el commit.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Lo que hay antes (deben salir 3 filas 'activo')
select id, nombre, estado from public.locales
where id in ('97d322cf-5ad8-4804-a22a-b87492b9ec5c',  -- Interdesign
             'f9d432ec-8a3e-41a1-a7c1-a9cc3e6b1222',  -- localp
             '2512b4df-0e84-4849-9b19-9cd700827126'); -- gnerai

update public.locales set estado = 'oculto'
where id in ('97d322cf-5ad8-4804-a22a-b87492b9ec5c',
             'f9d432ec-8a3e-41a1-a7c1-a9cc3e6b1222',
             '2512b4df-0e84-4849-9b19-9cd700827126')
  and estado = 'activo';

-- COMPROBACIÓN: las 3 en 'oculto'
select nombre, estado from public.locales
where id in ('97d322cf-5ad8-4804-a22a-b87492b9ec5c',
             'f9d432ec-8a3e-41a1-a7c1-a9cc3e6b1222',
             '2512b4df-0e84-4849-9b19-9cd700827126');

commit;

-- Para deshacer:
-- update public.locales set estado = 'activo'
-- where id in ('97d322cf-5ad8-4804-a22a-b87492b9ec5c','f9d432ec-8a3e-41a1-a7c1-a9cc3e6b1222','2512b4df-0e84-4849-9b19-9cd700827126');
