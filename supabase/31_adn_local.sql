-- =========================================================
-- TardeosClub · LOTE 31: ADN DEL LOCAL
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Cómo es el sitio, no qué pasa en él esta tarde. Un tardeo dice "hoy hay
-- techno"; el local dice "esto es una terraza en la playa, ambiente chill, se
-- viene en chanclas". Son cosas distintas y hacen falta las dos.
--
-- El vocabulario es EL MISMO que el del tardeo y el del tardícola (lib/adn.ts
-- y lib/musica.ts) a propósito: si cada uno tuviera el suyo no se podrían
-- cruzar, que es justo para lo que existe esto —recomendar—.
--
--    ADN Tardícola  <->  ADN Local  <->  ADN Evento
-- =========================================================

-- Qué clase de sitio es. `locales.tipo` NO vale: ese distingue local de
-- promotor, que es otra cosa (quién eres, no qué eres).
alter table public.locales add column if not exists tipo_local text;

-- Cuánta gente cabe. Se guarda el número y el tamaño se deduce de él: pedir
-- "aforo" y además "tamaño" es preguntar dos veces lo mismo, y así el local no
-- puede contestar cosas que se contradigan.
alter table public.locales add column if not exists aforo integer;

-- Interior, terraza, rooftop, playa… Varios a la vez: un chiringuito puede
-- tener barra dentro y terraza fuera.
alter table public.locales add column if not exists espacios text[];

-- Los tres que ya usa el tardeo, con el mismo vocabulario.
alter table public.locales add column if not exists ambiente text[];
alter table public.locales add column if not exists publico text[];
alter table public.locales add column if not exists dress_code text;

-- Lo que suena habitualmente. Varios estilos: casi ningún sitio pincha uno solo.
alter table public.locales add column if not exists musica text[];

-- "Vie a Dom, 18:00–02:00". Texto libre y no la columna `horarios` que ya
-- existe: aquella es un jsonb sin esquema, sin pantalla que la enseñe y vacía
-- en los 66 locales. Un horario que se pueda escribir de corrido es el que
-- alguien va a rellenar de verdad.
alter table public.locales add column if not exists horario_habitual text;

-- `locales` va con permisos columna a columna desde el lote 14: una columna
-- nueva nace INVISIBLE para los visitantes si no se concede aquí. Sin esto la
-- ficha pública se quedaría sin ADN y no daría ningún error: simplemente no
-- saldría.
grant select (
  tipo_local, aforo, espacios, ambiente, publico, dress_code, musica, horario_habitual
) on public.locales to anon;
grant select (
  tipo_local, aforo, espacios, ambiente, publico, dress_code, musica, horario_habitual
) on public.locales to authenticated;

-- Escribir no hace falta concederlo: `update` no está restringido por columnas,
-- lo gobierna la política `locales_update` (dueño o admin) del lote 1.

notify pgrst, 'reload schema';
