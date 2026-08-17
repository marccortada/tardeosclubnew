-- =========================================================
-- TardeosClub · LOTE 22: ADN DEL TARDÍCOLA
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Los mismos criterios con los que se describe un tardeo (lotes 20 y 21), pero
-- en forma de preferencia. Es lo que permite cruzar persona ↔ evento para
-- recomendar y para segmentar los avisos (§3 del documento).
--
-- La cardinalidad NO es la misma que en el evento:
--   · música, ambiente, tipos, dress codes y zonas -> VARIOS (son gustos)
--   · publico  -> UNO. Es su edad, no una preferencia.
--   · precio_max -> UNO. Es un tope.
--
-- OJO: el alta solo pregunta CUATRO (música, tipo de plan, edad y outfit). Cada
-- apartado extra recién registrado es gente que cierra la pestaña. Las columnas
-- de ambiente, zonas y precio se crean igual porque hay de dónde sacarlas sin
-- preguntar: la zona de la ubicación cuando la concede, y el ambiente y el
-- precio de los tardeos a los que se apunta. Y si algún día se decide
-- preguntarlas, no hace falta volver a migrar.
--
-- Texto y no enum, igual que en el tardeo: los valores viven en lib/adn.ts y
-- lib/musica.ts, y así se pueden añadir sin migrar la base.
-- =========================================================

alter table public.profiles add column if not exists musica        text[];
alter table public.profiles add column if not exists ambiente      text[];
alter table public.profiles add column if not exists tipos_evento  text[];
alter table public.profiles add column if not exists dress_codes   text[];
alter table public.profiles add column if not exists zonas         text[];
alter table public.profiles add column if not exists publico       text;
alter table public.profiles add column if not exists precio_max    text;

-- Cuándo lo rellenó: sirve para saber a quién conviene volver a preguntarle sin
-- molestar a quien lo acaba de hacer.
alter table public.profiles add column if not exists adn_en timestamptz;

-- NO se conceden permisos a `anon` a propósito: esto son datos personales. La
-- política de lectura de `profiles` ya es "tu propia fila o admin", así que
-- nadie ve los gustos de nadie. Para la segmentación de pop-ups el dato se usa
-- agregado desde el servidor, con la service role.

-- El trigger `proteger_profiles` (lote 9) solo blinda `is_admin`, así que estas
-- columnas las puede escribir su dueño y nada más. Es lo que se quiere.

notify pgrst, 'reload schema';
