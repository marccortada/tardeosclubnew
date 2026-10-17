-- L7 · Estados: cancelados y tardeos ya pasados
-- Proyecto TardeosClub · limpieza de datos tras la migración doble · 14-oct-2026
-- 1) Propaga los eventos cancelados en la web antigua (la sincronización diaria nunca lo hizo).
-- 2) Marca como 'finalizado' los tardeos publicados cuya fecha ya pasó (hoy hay ~820 con
--    estado 'publicado' y fecha pasada). La web ya los oculta por fecha; esto lo deja limpio.
-- Ejecutar DESPUÉS de L1.


begin;

-- El SQL Editor no tiene sesión de usuario: para la base no eres admin, y los disparadores
-- de protección (lotes 9, 19, 33, 37) DESHARÍAN EN SILENCIO los cambios de estado, orden de
-- destacados y planes. Esto marca la transacción como escritura del servidor (igual que la
-- service role) y solo dura hasta el commit.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

update public.tardeos set estado = 'cancelado' where origen_id in ('24856ed5-cc33-4f2b-a3d2-e4de958632ed') and estado <> 'cancelado';

update public.tardeos set estado = 'finalizado'
where estado = 'publicado' and fecha < (now() at time zone 'Europe/Madrid')::date;

-- COMPROBACIÓN
select estado, count(*) from public.tardeos group by estado order by 2 desc;

commit;
