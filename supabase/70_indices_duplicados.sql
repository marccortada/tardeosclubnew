-- =============================================================
-- TardeosClub · LOTE 70: ÍNDICES DUPLICADOS
-- =============================================================
-- Tras el paquete 63-69 el Performance Advisor marcó "Duplicate Index" en
-- favoritos e inscripciones: los lotes nuevos crearon un índice que ya existía
-- en producción con otro nombre (esas tablas se crearon a mano antes de los
-- lotes). Dos índices iguales no aportan nada y ralentizan cada escritura.
--
-- Se borra el sobrante de cada pareja. Nunca uno que respalde una restricción
-- (clave primaria, única…): de cada grupo se queda primero el de restricción,
-- y si no hay, el más antiguo. Un índice no es dato: no se pierde nada.
-- Idempotente.
-- =============================================================
do $$
declare r record;
begin
  for r in
    with grupos as (
      select i.indexrelid, i.indrelid,
             exists (select 1 from pg_constraint c where c.conindid = i.indexrelid) as de_restriccion,
             row_number() over (
               partition by i.indrelid, i.indkey::text, i.indclass::text, coalesce(pg_get_expr(i.indexprs, i.indrelid), ''),
                            coalesce(pg_get_expr(i.indpred, i.indrelid), ''), i.indisunique
               order by (exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)) desc, i.indexrelid
             ) as n
      from pg_index i
      join pg_class t on t.oid = i.indrelid
      where t.relnamespace = 'public'::regnamespace
    )
    select indexrelid::regclass as indice from grupos where n > 1 and not de_restriccion
  loop
    execute format('drop index if exists %s', r.indice);
  end loop;
end $$;
