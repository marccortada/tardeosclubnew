-- L5 · Orden de destacados igual que en la web antigua
-- Proyecto TardeosClub · limpieza de datos tras la migración doble · 14-oct-2026
-- Replica la regla de la portada antigua: venues y DJs aprobados con "mostrar en portada",
-- por featured_order (los sin número, detrás) y en empate por antigüedad (locales) o
-- valoración (DJs). 38 locales y 16 DJs.
-- Esto SUSTITUYE el orden de destacados actual (hoy hay 7 locales con orden puesto a mano).
-- Los tardeos destacados de la antigua son todos de fechas pasadas: no se traducen.
-- Ejecutar DESPUÉS de L2 y L3.


begin;

-- El SQL Editor no tiene sesión de usuario: para la base no eres admin, y los disparadores
-- de protección (lotes 9, 19, 33, 37) DESHARÍAN EN SILENCIO los cambios de estado, orden de
-- destacados y planes. Esto marca la transacción como escritura del servidor (igual que la
-- service role) y solo dura hasta el commit.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

update public.locales set destacado_orden = null where destacado_orden is not null;
update public.djs     set destacado_orden = null where destacado_orden is not null;

update public.locales l set destacado_orden = v.n
from (values
  ('b81e8d10-de09-4684-8ab4-845d7f7dd1c2'::uuid, 1), -- ECLIPSE SOLAR 12/08/2026
  ('6400ff32-efa7-4d03-95b4-61c999ba1112'::uuid, 2), -- El Ritmo del Sonido
  ('0ad40370-17be-413e-8b8a-8326d5286bed'::uuid, 3), -- EL REENCUENTRO TARDEO
  ('d1c60c48-69ee-493d-92d3-e2f9c39b0ff1'::uuid, 4), -- GUATEKKE
  ('131ecfbd-be9d-4325-b5c8-6cfe34bf76ff'::uuid, 5), -- Tardeotgn
  ('27b99692-49e9-4421-ab55-d6776316b5fe'::uuid, 6), -- LAPIKKARA
  ('d71c4ac7-1ff3-4d5e-9b07-b1bccce3cdf4'::uuid, 7), -- BANDARRA REMEMBER FESTIVAL
  ('763dc240-cad4-4821-9eca-5191b0d73df4'::uuid, 8), -- M7
  ('2f096b7a-d7da-4f09-ad53-046ed7ca4c8a'::uuid, 9), -- Yclub
  ('57ea5034-8410-4835-8fd9-4dfeff348160'::uuid, 10), -- Level
  ('6d4be418-9e93-49f3-8e12-31cdf38d91b2'::uuid, 11), -- By Gemelos
  ('30df2082-85d7-4d4d-b5ac-1ee685711469'::uuid, 12), -- Nama_tardeo
  ('25a37905-2765-4ddb-a735-cf6e568fbbdb'::uuid, 13), -- La Coffee
  ('e5b86ad4-f083-41b8-8a96-85c44551aac4'::uuid, 14), -- FOREVER
  ('e60eea9a-acb2-4393-a14c-39228f0b6491'::uuid, 15), -- La Golosa
  ('44fd164c-d7fb-40d1-bbee-a5561bdbb7f4'::uuid, 16), -- Sugar Hits
  ('093ffe74-9dbd-4d95-b57e-d41f954b9d25'::uuid, 17), -- NADA ES LO QUE PARECE
  ('5f37f833-f9ca-4fa1-9cf2-309623b0a072'::uuid, 18), -- Sabana
  ('fe83158d-8bfc-40d4-881a-5c22ea27709e'::uuid, 19), -- VOLS FESTA
  ('440cd5e0-a2cb-465b-8f6e-d67021efa955'::uuid, 20), -- Beach Point Cambrils
  ('48e51e3b-5fa1-44a4-ae90-c390640ebaef'::uuid, 21), -- Lo SUBMARINO de Reus
  ('4959ff5e-b057-49db-aff1-4eed1db8dc92'::uuid, 22), -- Tomato Fest
  ('f2e49678-f3cc-46f9-841f-47edd6e6593e'::uuid, 23), -- Sevillanas Granollers
  ('1b776c3a-47f0-4d53-a50f-01234f875b46'::uuid, 24), -- Vermusic "Cicle Itinerant"
  ('6bf357ff-bce1-4bb3-ad09-393539222656'::uuid, 25), -- Undead Dark Club
  ('f849b2fd-f242-437d-9464-f9abc5166f1c'::uuid, 26), -- Magic
  ('2130f910-fdd3-46a2-b171-8397c7d839c7'::uuid, 27), -- Tardeos BE FREE
  ('3c8c719f-3845-4d5f-b68c-5ecd5ac2ba1b'::uuid, 28), -- La pepa
  ('f753fe06-b6a8-47ca-bc78-0c5e5ed9ab9a'::uuid, 29), -- Venice Club
  ('dd442760-3e1a-4696-be0f-b38be19ac872'::uuid, 30), -- Madison Club & Lounge
  ('a9a0bb42-4476-48ac-ae32-713c377f2616'::uuid, 31), -- Sala Vinilo
  ('2105511e-c5e5-431d-8d24-06dea478e9f5'::uuid, 32), -- Sala Panorama Tardeos
  ('1c871fd8-a347-43d3-a73d-ba367f79f895'::uuid, 33), -- Clerik & Lotura
  ('a91720fc-ce41-4967-9e8e-2c9f492097fe'::uuid, 34), -- My-Tardeos Granollers
  ('751f0836-0293-4957-8af1-29e5e253ceec'::uuid, 35), -- R E S E T  Festival
  ('7d572f4c-3822-416d-bdfa-b720fd92b64d'::uuid, 36), -- Club 55
  ('633e3ef6-a368-4024-936c-2833c59e3691'::uuid, 37), -- Tardeo 59
  ('7202da30-e36e-4ca1-821f-9a6b180b1ee8'::uuid, 38) -- Nova
) as v(origen, n)
where l.origen_id = v.origen;

update public.djs d set destacado_orden = v.n
from (values
  ('b1f721be-c927-42b0-aebf-f713421426ef'::uuid, 1), -- MAIK
  ('7c57c63d-de1c-4115-9e04-4fe39ddd5f55'::uuid, 2), -- VxBV
  ('14a2705a-ed74-49ec-9d19-0838e61ac851'::uuid, 3), -- DJ GLASS HAT
  ('852745fd-96cd-4ca6-8397-08564bd9ebc4'::uuid, 4), -- LÄINA
  ('65c2900a-1ba9-4743-937d-1611ac5846ed'::uuid, 5), -- Oscar Molina 
  ('de1b7bc7-cb8d-4e70-bd57-ab6549fd3caf'::uuid, 6), -- Fatima Kahlo
  ('38ff18b4-da89-479d-9624-13d3c38e092b'::uuid, 7), -- Basi de La Fuente
  ('448710cc-461e-4e2a-8b5a-c1b2953a4204'::uuid, 8), -- VANGELDEREN 
  ('167e245a-6c69-4dd9-8957-6fae7d2f9fdb'::uuid, 9), -- Joan Gel
  ('219240d6-bd64-44b6-a7a1-629253e64dac'::uuid, 10), -- Raúl Ayora
  ('2d28d3f2-a68b-4f90-8f05-0a79aea5cc00'::uuid, 11), -- MAYA
  ('81cf1419-c3e0-4dd5-8184-c410dbacb89f'::uuid, 12), -- Davwell
  ('2e2d99e2-f1ee-4211-b6bc-b803522b3885'::uuid, 13), -- Marcci Marcco
  ('b04b2900-f93e-4034-a723-bf383c1829d8'::uuid, 14), -- Kaballe
  ('fdfc6f70-61ae-4ab3-8f0f-e1ef185af777'::uuid, 15), -- oscarmovedj
  ('817b3856-4848-476e-b4d5-a38326da7493'::uuid, 16) -- IVANUR
) as v(origen, n)
where d.origen_id = v.origen;

-- COMPROBACIÓN: esperado 38 locales y 16 DJs con orden
select (select count(*) from public.locales where destacado_orden is not null) as locales_con_orden,
       (select count(*) from public.djs where destacado_orden is not null) as djs_con_orden;

commit;
