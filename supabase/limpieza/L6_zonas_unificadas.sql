-- L6 · Unificar nombres de zona (Mataró / Mataro / MATARO…)
-- Proyecto TardeosClub · limpieza de datos tras la migración doble · 14-oct-2026
-- 6 variantes se unifican a su forma correcta. Revisa la lista antes de ejecutar:
-- cada línea es  'lo que hay'  →  'lo que quedará'.
-- Ejecutar cuando quieras (no depende de los demás).


begin;
update public.tardeos set zona = 'Barcelona' where zona = 'BARCELONA';
update public.locales set zona = 'Barcelona' where zona = 'BARCELONA'; -- BARCELONA → Barcelona
update public.tardeos set zona = 'Mataró' where zona = 'Mataro';
update public.locales set zona = 'Mataró' where zona = 'Mataro'; -- Mataro → Mataró
update public.tardeos set zona = 'Barberà del Vallès' where zona = 'barbera del valles';
update public.locales set zona = 'Barberà del Vallès' where zona = 'barbera del valles'; -- barbera del valles → Barberà del Vallès
update public.tardeos set zona = 'Barberà del Vallès' where zona = 'Barbera del Valles';
update public.locales set zona = 'Barberà del Vallès' where zona = 'Barbera del Valles'; -- Barbera del Valles → Barberà del Vallès
update public.tardeos set zona = 'Reus' where zona = 'REUS';
update public.locales set zona = 'Reus' where zona = 'REUS'; -- REUS → Reus
update public.tardeos set zona = 'Riudoms' where zona = 'RIUDOMS';
update public.locales set zona = 'Riudoms' where zona = 'RIUDOMS'; -- RIUDOMS → Riudoms

-- COMPROBACIÓN: zonas distintas que quedan
select count(distinct zona) as zonas_distintas from (select zona from public.tardeos union select zona from public.locales) z;

commit;
