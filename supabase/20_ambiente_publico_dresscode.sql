-- =========================================================
-- TardeosClub · LOTE 20: AMBIENTE, PÚBLICO Y DRESS CODE
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Dos de los criterios del documento de filtros. Son parte del "ADN" con el
-- que después se cruzarán tardeo, local, DJ y tardícola, así que los valores
-- tienen que ser los mismos en todos: viven en lib/adn.ts y de ahí salen tanto
-- los formularios como los filtros.
--
-- Van como texto y NO como enum a propósito: los dos campos llevan un "Otro…"
-- de escritura libre en el formulario. Un enum obligaría a una migración cada
-- vez que a un local se le ocurra un dress code nuevo, y en la práctica lo que
-- pasaría es que nadie lo añade y se pierde el dato.
-- =========================================================

-- Ambiente: a qué va la gente. Array porque se solapan de verdad —un afterwork
-- es también social, y un temático puede ser fiestero—, y obligar a elegir uno
-- solo haría que el local eligiera mal.
alter table public.tardeos add column if not exists ambiente text[];

-- Público: array porque un tardeo apunta a varias franjas a la vez. La mayoría
-- de la cartelera real es de 25 a 55, que son dos de los tramos.
alter table public.tardeos add column if not exists publico text[];

-- Dress code: uno solo. Una fiesta no puede ser "Casual" y "Dressed to
-- impress" al mismo tiempo; si hace falta matizar, para eso está el texto libre.
alter table public.tardeos add column if not exists dress_code text;

-- No se añade índice: hoy el listado se trae la cartelera entera y filtra en
-- memoria (662 filas), así que un índice no se usaría. Cuando la segmentación
-- de pop-ups consulte por estos campos desde SQL, ahí sí hará falta un GIN
-- sobre `ambiente` y `publico`.

-- `anon` lee `tardeos` con permiso de tabla, no columna a columna como
-- `locales` desde el lote 14, así que estas dos nacen visibles sin más. Se
-- dejan escritas de todos modos para que sea explícito y para que siga
-- funcionando si algún día se cierra la tabla por columnas.
grant select (ambiente, publico, dress_code) on public.tardeos to anon;
grant select (ambiente, publico, dress_code) on public.tardeos to authenticated;

-- El trigger `proteger_tardeos` (lote 9) solo fuerza `destacado_hasta`, que es
-- lo que se paga. Estos dos campos los pone quien publica y no hay nada que
-- proteger: no dan visibilidad ni dinero.

notify pgrst, 'reload schema';
