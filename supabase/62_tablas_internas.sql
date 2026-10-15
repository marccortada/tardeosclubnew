-- =============================================================
-- TardeosClub · LOTE 62: TABLAS INTERNAS CON RLS Y SIN POLÍTICAS
-- =============================================================
-- agente_acciones, recordatorios_enviados, uso_ia y verificaciones solo las
-- escribe el servidor (service role, que se salta RLS). Tenían RLS activado y
-- ninguna política: nadie más podía leerlas, que es lo correcto, pero el
-- Security Advisor lo marca porque no distingue "cerrada a propósito" de
-- "se olvidó la política".
--
-- Se añade una única política explícita: el admin puede LEERLAS (útil para
-- revisar el uso de la IA o los recordatorios desde el panel). Nadie más ve
-- nada y nadie escribe salvo el servidor. No toca datos. Idempotente.
-- =============================================================

do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and c.relrowsecurity
      and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_admin()))',
      r.relname || '_solo_admin', r.relname);
  end loop;
end $$;
