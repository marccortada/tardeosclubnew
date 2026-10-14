-- =========================================================
-- TardeosClub · LOTE 45: REORDENAR DESTACADOS EN UN SOLO PASO
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Antes, arrastrar un destacado a otro sitio hacía N escrituras seguidas desde
-- el navegador (una por fila). Si fallaba la quinta, el orden quedaba a medias.
-- Esta función pone destacado_orden = 1..N a la lista que le des, TODO en una
-- sola transacción: o se guarda entera o no se guarda nada.
--
-- Solo admin. Lista blanca de tablas: el nombre de la tabla llega como texto,
-- así que se valida antes de usarlo (y se escapa con %I) para que nadie pueda
-- colar otra tabla.
--
-- Los ids que NO vengan en la lista y ya tuvieran orden se quedan como están.
-- Idempotente: se puede pegar varias veces; llamar dos veces con la misma lista
-- deja el mismo resultado.
-- =========================================================

create or replace function public.reordenar_destacados(p_tabla text, p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n_pedidos integer;
  n_hechos  integer;
begin
  -- 1) Solo admin. is_admin() mira a quien llama (auth.uid()), no al dueño de
  --    la función, así que security definer no abre la puerta a nadie más.
  if not public.is_admin() then
    raise exception 'Solo un administrador puede reordenar destacados' using errcode = '42501';
  end if;

  -- 2) Lista blanca de tablas.
  if p_tabla is null or p_tabla not in ('tardeos', 'locales', 'djs') then
    raise exception 'Tabla no permitida: %', coalesce(p_tabla, '(nula)') using errcode = '22023';
  end if;

  -- 3) Lista vacía: nada que hacer.
  n_pedidos := coalesce(cardinality(p_ids), 0);
  if n_pedidos = 0 then
    return 0;
  end if;

  -- 4) Sin ids repetidos ni nulos: dos posiciones para el mismo id no tienen
  --    sentido y esconderían un error del cliente.
  if exists (select 1 from unnest(p_ids) as x where x is null)
     or (select count(distinct x) from unnest(p_ids) as x) <> n_pedidos then
    raise exception 'La lista de ids tiene nulos o repetidos' using errcode = '22023';
  end if;

  -- 5) Posición = lugar en la lista (1..N). Una sola sentencia = una sola
  --    transacción. Los triggers proteger_* dejan pasar porque quien llama es admin.
  execute format(
    'update public.%I t set destacado_orden = u.pos
       from unnest($1) with ordinality as u(id, pos)
      where t.id = u.id',
    p_tabla
  ) using p_ids;
  get diagnostics n_hechos = row_count;

  -- 6) Si algún id no existe, se deshace todo (el raise aborta la transacción)
  --    en vez de dejar un orden con huecos.
  if n_hechos <> n_pedidos then
    raise exception 'Faltan fichas: se pidieron % y solo existen %', n_pedidos, n_hechos using errcode = 'P0002';
  end if;

  return n_hechos;
end;
$$;

-- Nadie salvo usuarios con sesión puede llamarla (y dentro, solo admin).
revoke all on function public.reordenar_destacados(text, uuid[]) from public;
revoke all on function public.reordenar_destacados(text, uuid[]) from anon;
grant execute on function public.reordenar_destacados(text, uuid[]) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Comprobaciones (dejarlas comentadas; probar a mano si se quiere):
--
--  -- Como admin, con sesión iniciada en la app (desde el SQL Editor auth.uid()
--  -- es nulo y daría "Solo un administrador"):
--  --   select public.reordenar_destacados('djs', array['<uuid1>','<uuid2>']::uuid[]);
--  --   → devuelve 2 y esos DJs quedan con destacado_orden 1 y 2.
--  -- Tabla no permitida:
--  --   select public.reordenar_destacados('profiles', array['<uuid>']::uuid[]);
--  --   → error "Tabla no permitida: profiles".
--  -- Existe la función y solo la ejecuta authenticated:
--  --   select has_function_privilege('anon', 'public.reordenar_destacados(text,uuid[])', 'execute');          -- false
--  --   select has_function_privilege('authenticated', 'public.reordenar_destacados(text,uuid[])', 'execute'); -- true
-- ---------------------------------------------------------
