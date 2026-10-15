-- =============================================================
-- TardeosClub · LOTE 60: FUNCIONES CON PRIVILEGIOS FUERA DE LA API
-- =============================================================
-- Tras el lote 59 el Security Advisor seguía avisando de 33 funciones
-- SECURITY DEFINER "ejecutables desde la API". Son a propósito (is_admin() lo
-- usan las políticas; metricas_local() lo pide el panel del local), pero el
-- patrón que recomienda Supabase es mejor y deja el aviso a cero:
--
--   private.f(...)  -> el código de verdad, SECURITY DEFINER, en un esquema
--                      que PostgREST NO publica: nadie la llama por HTTP.
--   public.f(...)   -> envoltorio SECURITY INVOKER de una línea que llama a
--                      private.f. Misma firma, mismos nombres de parámetros,
--                      así que la web, las políticas y las demás funciones
--                      siguen llamando a public.f sin cambiar nada.
--
-- Las que SOLO usa el servidor con la service role (cuotas de IA, registro de
-- errores, alcance de push) no necesitan envoltorio: se les quita EXECUTE a
-- anon y authenticated.
--
-- No toca ningún dato. Idempotente: en la segunda pasada ya no quedan
-- funciones SECURITY DEFINER en public y no hace nada.
-- =============================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

do $$
declare
  r record;
  def text;
  llamada text;
  solo_servidor constant text[] := array['consumir_cuota', 'registrar_error_app', 'alcance_estimado'];
begin
  -- 1) Solo servidor: fuera anon y authenticated.
  for r in
    select p.oid::regprocedure as firma
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.proname = any(solo_servidor)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.firma);
    execute format('grant execute on function %s to service_role', r.firma);
  end loop;

  -- 2) El resto (no disparadores, no de extensiones): a private + envoltorio.
  for r in
    select p.oid, p.proname, p.proretset, p.provolatile,
           pg_get_function_arguments(p.oid)          as args,
           pg_get_function_identity_arguments(p.oid) as args_id,
           pg_get_function_result(p.oid)             as resultado,
           p.pronargs, p.proargnames, p.proargmodes,
           has_function_privilege('anon', p.oid, 'execute') as anon_puede,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_puede
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
      and not (p.proname = any(solo_servidor))
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    -- a) Copia exacta en private (mismo cuerpo, mismo search_path, DEFINER).
    def := pg_get_functiondef(r.oid);
    def := regexp_replace(def, '^CREATE OR REPLACE FUNCTION public\.', 'CREATE OR REPLACE FUNCTION private.');
    execute def;
    execute format('revoke execute on function private.%I(%s) from public', r.proname, r.args_id);
    execute format('grant execute on function private.%I(%s) to service_role', r.proname, r.args_id);
    if r.auth_puede then
      execute format('grant execute on function private.%I(%s) to authenticated', r.proname, r.args_id);
    end if;
    if r.anon_puede then
      execute format('grant execute on function private.%I(%s) to anon', r.proname, r.args_id);
    end if;

    -- b) La de public pasa a envoltorio INVOKER. Se llama por posición con
    --    $1..$n (solo parámetros de entrada; las OUT de RETURNS TABLE no
    --    cuentan en pronargs).
    select string_agg('$' || i, ', ' order by i) into llamada
    from generate_series(1, r.pronargs) i;
    llamada := format('private.%I(%s)', r.proname, coalesce(llamada, ''));

    execute format(
      'create or replace function public.%I(%s) returns %s language sql %s security invoker set search_path = public as %L',
      r.proname, r.args, r.resultado,
      case r.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end,
      -- Con filas o con parámetros OUT devuelve columnas: select * from.
      case when r.proretset or r.proargmodes && array['o','b','t']::"char"[] then 'select * from ' || llamada
           else 'select ' || llamada end
    );
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Comprobación (debe devolver 0 filas): SECURITY DEFINER no-disparador en public.
--   select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
--     and has_function_privilege('authenticated', p.oid, 'execute');
