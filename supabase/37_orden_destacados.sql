-- =========================================================
-- TardeosClub · LOTE 37: ORDENAR TAMBIÉN LOS TARDEOS DESTACADOS
-- Aplicar en Supabase → SQL Editor.
--
-- Los locales y los DJs se ordenan a mano desde el panel (`destacado_orden`:
-- 1, 2, 3…). Los tardeos no: solo tienen `destacado_hasta`, que dice SI están
-- destacados y hasta cuándo, pero no en qué orden salen. El carrusel de la
-- portada los pinta en el orden en que vienen de la consulta —por fecha—, así
-- que el admin puede elegir cuáles pero no cuál va primero.
--
-- POR QUÉ DOS COLUMNAS Y NO UNA:
--
-- `destacado_hasta` sigue siendo quien decide SI sale, y tiene caducidad
-- porque el día que esto se cobre, un destacado es algo que se compra por una
-- semana. `destacado_orden` solo dice EN QUÉ ORDEN salen los que ya están
-- destacados. Meter las dos cosas en una sola columna obligaría a inventarse
-- que "orden 0 = no destacado", y entonces quitar un destacado y ponerlo el
-- primero serían la misma operación.
-- =========================================================

alter table public.tardeos add column if not exists destacado_orden int;

-- El índice va con la condición puesta porque la consulta siempre es "los
-- destacados, ordenados": de 780 filas, los destacados son un puñado.
create index if not exists idx_tardeos_destacado_orden
  on public.tardeos(destacado_orden)
  where destacado_orden is not null;

-- El orden lo pone el admin, igual que en locales y djs.
--
-- Se AMPLÍA el disparador que ya existe (`proteger_tardeos`, lote 9) en vez de
-- añadir uno nuevo: dos disparadores `before update` en la misma tabla se
-- ejecutan los dos, por orden alfabético del nombre, y a los seis meses nadie
-- se acuerda de que hay dos sitios donde se decide lo mismo.
--
-- Sin esto, un local podría ponerse el primero de la portada editando su propio
-- tardeo: la columna es nueva y la protección de `destacado_hasta` no la cubre.
create or replace function public.proteger_tardeos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.destacado_hasta := null;
    new.destacado_orden := null;
  else
    -- No falla: simplemente se queda como estaba. Devolver un error llenaría de
    -- avisos la pantalla de editar un tardeo, que no toca estas columnas.
    new.destacado_hasta := old.destacado_hasta;
    new.destacado_orden := old.destacado_orden;
  end if;
  return new;
end; $$;

-- El disparador ya está creado desde el lote 9 y apunta a esta misma función,
-- así que con reemplazarla basta. Se recrea igualmente por si esa base viniera
-- de un volcado antiguo.
drop trigger if exists trg_proteger_tardeos on public.tardeos;
create trigger trg_proteger_tardeos before insert or update on public.tardeos
  for each row execute function public.proteger_tardeos();

notify pgrst, 'reload schema';
