-- L7 · Estados: cancelados y tardeos ya pasados
-- Proyecto TardeosClub · limpieza de datos tras la migración doble · 14-oct-2026
-- 1) Propaga los eventos cancelados en la web antigua (la sincronización diaria nunca lo hizo).
-- 2) Marca como 'finalizado' los tardeos publicados cuya fecha ya pasó (hoy hay ~820 con
--    estado 'publicado' y fecha pasada). La web ya los oculta por fecha; esto lo deja limpio.
-- Ejecutar DESPUÉS de L1.


begin;

update public.tardeos set estado = 'cancelado' where origen_id in ('24856ed5-cc33-4f2b-a3d2-e4de958632ed') and estado <> 'cancelado';

update public.tardeos set estado = 'finalizado'
where estado = 'publicado' and fecha < (now() at time zone 'Europe/Madrid')::date;

-- COMPROBACIÓN
select estado, count(*) from public.tardeos group by estado order by 2 desc;

commit;
