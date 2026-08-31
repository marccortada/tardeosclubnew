-- =========================================================
-- TardeosClub · LOTE 36: MEDIR LO QUE FALTABA, Y PODER LEERLO
-- Aplicar en Supabase → SQL Editor.
--
-- El lote 34 montó la tubería y mide cuatro cosas: visitas a ficha, guardar,
-- apuntarse y clic a comprar. Con eso se sabe qué tardeo funciona una vez que
-- alguien ya ha llegado a él, y NADA de cómo llegó ni de qué buscaba.
--
-- Lo que falta es justo lo que hace falta ahora:
--   - Qué busca la gente y qué NO encuentra.
--   - Qué filtros usa de verdad (hay muchos; probablemente sobran la mitad).
--   - Si el "Para ti" sirve: cuántas veces se enseña y cuántas se pulsa.
--   - Por dónde entra: portada, listado o mapa.
--
-- Y una pantalla para el admin, porque hoy las estadísticas solo las ve cada
-- local de lo suyo: quien lleva el negocio no tiene dónde mirar.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Los tipos nuevos
-- ---------------------------------------------------------
-- La restricción se rehace entera: es una comprobación de columna, así que
-- Postgres la llamó `eventos_metrica_tipo_check`. Se mantiene una lista cerrada
-- a propósito, aunque obligue a pasar por aquí cada vez que se añade un tipo:
-- sin ella, un typo en el navegador crea un tipo fantasma que no cuenta en
-- ningún sitio y que nadie descubre hasta que faltan datos.
alter table public.eventos_metrica drop constraint if exists eventos_metrica_tipo_check;
alter table public.eventos_metrica add constraint eventos_metrica_tipo_check check (tipo in (
  -- Los del lote 34
  'vista_tardeo',
  'vista_local',
  'vista_dj',
  'clic_entrada',
  'clic_lista',
  'inscripcion',
  'favorito',

  -- Por dónde entra la gente
  'vista_home',
  'vista_listado',
  'vista_mapa',

  -- Qué busca y con qué filtra
  'busqueda',          -- el texto va en `detalle`
  'busqueda_vacia',    -- buscó y no salió nada: lo más valioso de todo
  'filtro',            -- qué filtro tocó, en `detalle`

  -- Si las recomendaciones sirven
  'para_ti_visto',     -- se le enseñó el carrusel (`detalle` = cuántos)
  'para_ti_clic'       -- pulsó uno de sus recomendados
));

-- ---------------------------------------------------------
-- 2. El detalle
-- ---------------------------------------------------------
-- `destino` ya existe, pero significa "a qué URL se fue el clic". Meter aquí
-- el texto de una búsqueda sería reusar una columna para otra cosa, y a los
-- tres meses nadie sabe qué contiene.
--
-- OJO CON LO QUE SE GUARDA: aquí entra texto escrito por personas. Se guarda
-- porque saber qué se busca —y sobre todo qué se busca SIN encontrar nada— es
-- lo que dice qué cartelera falta. Pero es texto libre: el cliente lo recorta a
-- 80 caracteres y lo pasa a minúsculas antes de mandarlo, y esto tiene que
-- constar en la política de privacidad, que hoy solo declara el clic de compra.
alter table public.eventos_metrica add column if not exists detalle text;

-- Para agrupar por tipo y fecha sin recorrer la tabla entera.
create index if not exists idx_em_tipo_detalle
  on public.eventos_metrica(tipo, detalle) where detalle is not null;

-- ---------------------------------------------------------
-- 3. El resumen para el admin
-- ---------------------------------------------------------
-- Devuelve JSON con todos los bloques de una vez, y no seis funciones: la
-- pantalla los enseña juntos, y seis llamadas son seis viajes para pintar una
-- sola pantalla.
--
-- Se agrega EN LA BASE y no en el navegador. Hoy hay dos filas y daría igual,
-- pero esto crece por cada visita de cada persona: el día que haya cien mil,
-- traérselas al móvil para contarlas allí no se puede arreglar sin rehacerlo.
create or replace function public.metricas_resumen(
  p_desde timestamptz default now() - interval '30 days',
  p_hasta timestamptz default now()
)
returns json
language sql stable security definer set search_path = public as $$
  with e as (
    select * from public.eventos_metrica
     where created_at >= p_desde and created_at <= p_hasta
       -- El filtro va DENTRO porque es security definer: sin esto, cualquiera
       -- con una sesión podría pedir las estadísticas de todo el negocio.
       and public.is_admin()
  )
  select json_build_object(
    'total', (select count(*) from e),

    'por_tipo', (
      select coalesce(json_agg(x order by x.total desc), '[]'::json)
        from (select tipo, count(*) as total from e group by tipo) x
    ),

    'por_dia', (
      select coalesce(json_agg(x order by x.dia), '[]'::json)
        from (select date_trunc('day', created_at)::date as dia, tipo, count(*) as total
                from e group by 1, 2) x
    ),

    -- Personas distintas, contando por pestaña cuando no hay sesión. No es
    -- exacto —quien entra desde el móvil y desde el portátil cuenta dos veces—
    -- y no puede serlo sin poner una cookie a cada visitante, que es justo lo
    -- que no queremos hacer.
    'personas', (select count(distinct coalesce(profile_id::text, sesion)) from e),

    'top_tardeos', (
      select coalesce(json_agg(x order by x.total desc), '[]'::json)
        from (select t.id, t.titulo, t.fecha, count(*) as total
                from e join public.tardeos t on t.id = e.tardeo_id
               where e.tipo = 'vista_tardeo'
               group by t.id, t.titulo, t.fecha
               order by count(*) desc limit 10) x
    ),

    'top_locales', (
      select coalesce(json_agg(x order by x.total desc), '[]'::json)
        from (select l.id, l.nombre, count(*) as total
                from e join public.locales l on l.id = e.local_id
               where e.tipo = 'vista_local'
               group by l.id, l.nombre
               order by count(*) desc limit 10) x
    ),

    'top_djs', (
      select coalesce(json_agg(x order by x.total desc), '[]'::json)
        from (select d.id, d.nombre_artistico as nombre, count(*) as total
                from e join public.djs d on d.id = e.dj_id
               where e.tipo = 'vista_dj'
               group by d.id, d.nombre_artistico
               order by count(*) desc limit 10) x
    ),

    'busquedas', (
      select coalesce(json_agg(x order by x.total desc), '[]'::json)
        from (select detalle as texto, count(*) as total,
                     count(*) filter (where tipo = 'busqueda_vacia') as sin_resultados
                from e where tipo in ('busqueda','busqueda_vacia') and detalle is not null
               group by detalle order by count(*) desc limit 20) x
    ),

    'filtros', (
      select coalesce(json_agg(x order by x.total desc), '[]'::json)
        from (select detalle as filtro, count(*) as total
                from e where tipo = 'filtro' and detalle is not null
               group by detalle order by count(*) desc limit 20) x
    ),

    -- A dónde van los clics de entrada. Es lo que hace falta para negociar con
    -- una ticketera: saber cuánta gente le mandas.
    'ticketeras', (
      select coalesce(json_agg(x order by x.total desc), '[]'::json)
        from (select split_part(split_part(replace(replace(destino, 'https://', ''), 'http://', ''), '/', 1), '?', 1) as dominio,
                     count(*) as total
                from e where tipo in ('clic_entrada','clic_lista') and destino is not null
               group by 1 order by count(*) desc limit 10) x
    )
  );
$$;

revoke all on function public.metricas_resumen(timestamptz, timestamptz) from public;
grant execute on function public.metricas_resumen(timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
