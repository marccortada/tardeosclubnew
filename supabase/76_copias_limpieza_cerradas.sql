-- 76 · Copias de seguridad de la limpieza, cerradas del todo (18-oct-2026)
-- Idempotente. No borra nada.
--
-- Por qué: L0 creó en `public` las tablas _bak_limpieza_* (tardeos, locales,
-- DJs, perfiles con emails, métricas) con RLS y sin políticas: nadie lee filas
-- por la API, pero anon y authenticated conservaban el permiso de TABLA por
-- defecto de Supabase y el Security Advisor las marca. Regla del proyecto
-- (lote 62): tabla interna = sin permisos para el público + "solo admin lee".
-- Se guardan por si hubiera que deshacer algo de la limpieza; cuando el
-- cliente confirme que todo está bien, se podrán borrar (con su "sí").
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and c.relname like '\_bak\_limpieza\_%'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('drop policy if exists "solo admin lee" on public.%I', t);
    execute format('create policy "solo admin lee" on public.%I for select to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;
