-- =========================================================
-- TardeosClub · LOTE 52: QUE SE PUEDA BORRAR UNA CUENTA
-- Aplicar en Supabase → SQL Editor. Idempotente: se puede pegar dos veces.
--
-- "Borrar mi cuenta" (/perfil/ajustes) y el admin llaman a
-- auth.admin.deleteUser. Eso borra auth.users → profiles (cascade) y, desde
-- ahí, todo lo que apunte al perfil. Si alguna clave ajena apunta a
-- profiles(id) o auth.users(id) SIN "on delete", Postgres impide el borrado
-- ("Database error deleting user").
--
-- En los lotes del repo todas llevan cascade/set null, pero en producción hay
-- tablas que no salen de ningún lote (favoritos, agente_acciones,
-- verificaciones…) y no sabemos cómo se crearon. Por eso no se nombran tablas:
-- se recorre el catálogo y se corrige cualquier clave que bloquee:
--   · columna que admite null  → ON DELETE SET NULL (p. ej. dueño de una ficha:
--     la ficha del local/DJ se queda, sin dueño)
--   · columna NOT NULL         → ON DELETE CASCADE (datos que solo son de esa
--     persona: sus guardados, sus apuntados…)
-- Las que ya tienen cascade/set null no se tocan.
-- =========================================================

do $$
declare
  r record;
  accion text;
begin
  for r in
    select c.conname,
           c.conrelid::regclass::text  as tabla,
           c.confrelid::regclass::text as destino,
           a.attname                   as col,
           af.attname                  as col_destino,
           a.attnotnull                as no_nulo
    from pg_constraint c
    join pg_attribute a  on a.attrelid  = c.conrelid  and a.attnum  = c.conkey[1]
    join pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
    where c.contype = 'f'
      and c.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
      and array_length(c.conkey, 1) = 1
      -- 'a' = no action, 'r' = restrict: las que bloquean el borrado.
      and c.confdeltype in ('a', 'r')
      -- Solo nuestras tablas: las de auth/storage son de Supabase.
      and c.connamespace = 'public'::regnamespace
  loop
    accion := case when r.no_nulo then 'cascade' else 'set null' end;
    begin
      -- En una sola sentencia: si algo falla, la clave antigua sigue en pie.
      execute format(
        'alter table %s drop constraint %I, add constraint %I foreign key (%I) references %s(%I) on delete %s',
        r.tabla, r.conname, r.conname, r.col, r.destino, r.col_destino, accion
      );
      raise notice 'lote 52: %.% -> % (on delete %)', r.tabla, r.col, r.destino, accion;
    exception when others then
      raise warning 'lote 52: no se pudo cambiar %.% (%): %', r.tabla, r.col, r.conname, sqlerrm;
    end;
  end loop;
end $$;

-- Comprobación (debe devolver 0 filas):
-- select c.conrelid::regclass, c.conname
-- from pg_constraint c
-- where c.contype = 'f' and c.connamespace = 'public'::regnamespace
--   and c.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
--   and c.confdeltype in ('a', 'r');
