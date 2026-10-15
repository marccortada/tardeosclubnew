-- =============================================================
-- TardeosClub · LOTE 59: LOS AVISOS DEL SECURITY ADVISOR
-- =============================================================
-- Supabase marcaba 52 avisos (ningún error). Este lote los resuelve de forma
-- general, sin tocar ningún dato:
--
--  1) "Function Search Path Mutable": toda función de `public` sin search_path
--     fijo pasa a tenerlo. Sin él, alguien con permiso para crear objetos
--     podría colar una función con el mismo nombre en otro esquema.
--
--  2) Funciones de DISPARADOR (returns trigger): nadie las llama a mano, así
--     que se les quita EXECUTE a todos. Los disparadores siguen funcionando:
--     Postgres no comprueba ese permiso al dispararlos.
--
--  3) "Public Can Execute SECURITY DEFINER Function": se quita EXECUTE a anon
--     (y a PUBLIC) y se deja solo a usuarios con sesión, SALVO:
--       - las que la web pública usa sin sesión (lista de abajo), y
--       - las que usan las propias políticas RLS (is_admin(), etc.): una
--         política que llama a una función sin permiso daría error a anon.
--
--  4) Inserciones con `with check (true)`: se acotan sin cerrarlas.
--
-- Idempotente: se puede pegar varias veces.
-- =============================================================

do $$
declare
  r record;
  -- Llamadas por la web pública SIN sesión (grep de .rpc( en el código).
  publicas constant text[] := array['incrementar_visita', 'plazas_de_tardeo', 'locales_con_plan_caido'];
begin
  -- 1) search_path fijo.
  for r in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, extensions', r.firma);
  end loop;

  -- 2) Funciones de disparador: sin EXECUTE para nadie.
  for r in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'trigger'::regtype
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.firma);
  end loop;

  -- 3) SECURITY DEFINER no-disparador: solo con sesión, salvo excepciones.
  for r in
    select p.oid::regprocedure as firma, p.proname as nombre
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype <> 'trigger'::regtype
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    if r.nombre = any(publicas) then
      continue;
    end if;
    if exists (
      select 1 from pg_policies pol
      where coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '') ~ ('\m' || r.nombre || '\s*\(')
    ) then
      continue;
    end if;
    execute format('revoke execute on function %s from public, anon', r.firma);
    execute format('grant execute on function %s to authenticated, service_role', r.firma);
  end loop;
end $$;

-- 4) "RLS Policy Always True": inserciones abiertas con `with check (true)`.
--    Siguen abiertas a quien no tiene cuenta (denunciar un flyer o contar un
--    clic no debe exigir registro), pero ya no se puede firmar en nombre de
--    otro ni colar una denuncia ya "resuelta".
drop policy if exists "clics_insert" on public.clics_atribucion;
create policy "clics_insert" on public.clics_atribucion
  for insert to anon, authenticated
  with check (profile_id is null or profile_id = auth.uid());

drop policy if exists "denuncias_insert" on public.denuncias_flyer;
create policy "denuncias_insert" on public.denuncias_flyer
  for insert to anon, authenticated
  with check ((denunciante is null or denunciante = auth.uid()) and estado = 'pendiente');

notify pgrst, 'reload schema';

-- Comprobación (debe devolver 0 filas): funciones de public sin search_path.
--   select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prokind = 'f'
--     and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%');
