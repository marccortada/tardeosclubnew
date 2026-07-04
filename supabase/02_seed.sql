-- =========================================================
-- TardeosClub · LOTE 2: DATOS DE EJEMPLO (seed)
-- Aplicar en Supabase → SQL Editor (después del Lote 1)
-- Los flyer_url apuntan a /flyers/tX.jpg (ya están en la app).
-- =========================================================

-- Faltaba la columna precio en tardeos:
alter table public.tardeos add column if not exists precio numeric;

-- LOCALES ------------------------------------------------------
insert into public.locales (id, nombre, direccion, zona, verificado, estado) values
 ('00000000-0000-4000-8000-0000000000a1','Sala Blau','C/ Marina 120, Barcelona','Barcelona',true,'activo'),
 ('00000000-0000-4000-8000-0000000000a2','Chiringuito La Marea','Passeig Marítim 8, Mataró','Maresme',true,'activo'),
 ('00000000-0000-4000-8000-0000000000a3','Terraza Costa','Av. del Mar 45, Lloret de Mar','Costa Brava',false,'activo'),
 ('00000000-0000-4000-8000-0000000000a4','El Patio Latino','C/ Gran Via 500, Barcelona','Barcelona',true,'activo'),
 ('00000000-0000-4000-8000-0000000000a5','Beach Club Sol','Passeig del Callao 2, Calella','Maresme',true,'activo'),
 ('00000000-0000-4000-8000-0000000000a6','Masia Fest','Ctra. Sant Boi 12, Sant Boi','Baix Llobregat',false,'activo')
on conflict (id) do nothing;

-- DJS ----------------------------------------------------------
insert into public.djs (id, nombre_artistico, estilos, verificado, reputacion_score) values
 ('00000000-0000-4000-8000-0000000000b1','DJ Nando','{Remember,House}',true,4.8),
 ('00000000-0000-4000-8000-0000000000b2','DJ Marta Sound','{Latino,Comercial}',true,4.5),
 ('00000000-0000-4000-8000-0000000000b3','DJ Kiko','{"Años 80-90",Remember}',false,4.2),
 ('00000000-0000-4000-8000-0000000000b4','DJ Rumba Viva','{Rumba,Latino}',true,4.9),
 ('00000000-0000-4000-8000-0000000000b5','DJ Sonia','{House,Comercial}',false,4.0)
on conflict (id) do nothing;

-- TARDEOS (publicados) ----------------------------------------
insert into public.tardeos
 (id, local_id, titulo, fecha, hora_inicio, hora_fin, direccion, lat, lng, zona, estilo, flyer_url, es_de_pago, tiene_lista, precio, estado, destacado_hasta) values
 ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000a1','Tardeo Remember Sunset','2026-07-11','18:00','23:00','C/ Marina 120, Barcelona',41.3908,2.196,'Barcelona','Remember','/flyers/t1.jpg',true,false,12,'publicado', now()+interval '60 days'),
 ('00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-0000000000a2','Latino Beach Party','2026-07-12','17:30','22:30','Passeig Marítim 8, Mataró',41.5388,2.4449,'Maresme','Latino','/flyers/t2.jpg',false,true,null,'publicado', now()+interval '60 days'),
 ('00000000-0000-4000-8000-0000000000c3','00000000-0000-4000-8000-0000000000a3','Tardeo del Mar','2026-07-12','18:00','23:30','Av. del Mar 45, Lloret de Mar',41.7,2.845,'Costa Brava','House','/flyers/t3.jpg',false,false,null,'publicado', null),
 ('00000000-0000-4000-8000-0000000000c4','00000000-0000-4000-8000-0000000000a4','Rumba y Salsa Tarde','2026-07-13','19:00','23:00','C/ Gran Via 500, Barcelona',41.3775,2.148,'Barcelona','Rumba','/flyers/t4.jpg',true,false,10,'publicado', now()+interval '60 days'),
 ('00000000-0000-4000-8000-0000000000c5','00000000-0000-4000-8000-0000000000a5','Años 80-90 Fiesta','2026-07-18','18:00','22:00','Passeig del Callao 2, Calella',41.6142,2.6558,'Maresme','Años 80-90','/flyers/t5.jpg',false,true,null,'publicado', null),
 ('00000000-0000-4000-8000-0000000000c6','00000000-0000-4000-8000-0000000000a3','House Sunset Session','2026-07-19','18:30','23:59','Av. del Mar 45, Lloret de Mar',41.702,2.848,'Costa Brava','House','/flyers/t6.jpg',true,false,15,'publicado', null),
 ('00000000-0000-4000-8000-0000000000c7','00000000-0000-4000-8000-0000000000a6','Comercial Hits Tarde','2026-07-20','17:00','21:30','Ctra. Sant Boi 12, Sant Boi',41.345,2.037,'Baix Llobregat','Comercial','/flyers/t7.jpg',false,false,null,'publicado', null),
 ('00000000-0000-4000-8000-0000000000c8','00000000-0000-4000-8000-0000000000a1','Gran Tardeo Verano','2026-07-25','18:00','23:59','C/ Marina 120, Barcelona',41.3905,2.1954,'Barcelona','Remember','/flyers/t8.jpg',true,false,18,'publicado', now()+interval '60 days')
on conflict (id) do nothing;

-- TARDEO_DJS (qué DJ toca en cada tardeo) ---------------------
insert into public.tardeo_djs (tardeo_id, dj_id) values
 ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000b1'),
 ('00000000-0000-4000-8000-0000000000c1','00000000-0000-4000-8000-0000000000b3'),
 ('00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-0000000000b2'),
 ('00000000-0000-4000-8000-0000000000c2','00000000-0000-4000-8000-0000000000b4'),
 ('00000000-0000-4000-8000-0000000000c3','00000000-0000-4000-8000-0000000000b5'),
 ('00000000-0000-4000-8000-0000000000c4','00000000-0000-4000-8000-0000000000b4'),
 ('00000000-0000-4000-8000-0000000000c5','00000000-0000-4000-8000-0000000000b3'),
 ('00000000-0000-4000-8000-0000000000c5','00000000-0000-4000-8000-0000000000b1'),
 ('00000000-0000-4000-8000-0000000000c6','00000000-0000-4000-8000-0000000000b5'),
 ('00000000-0000-4000-8000-0000000000c8','00000000-0000-4000-8000-0000000000b1'),
 ('00000000-0000-4000-8000-0000000000c8','00000000-0000-4000-8000-0000000000b4')
on conflict do nothing;
