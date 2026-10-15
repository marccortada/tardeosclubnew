-- =============================================================
-- TardeosClub · LOTE 61: LOS AVISOS DEL PERFORMANCE ADVISOR
-- =============================================================
-- No cambia QUIÉN puede ver o tocar qué: cambia lo rápido que lo decide.
--
--  1) "Auth RLS Initialization Plan": una política con `auth.uid()` a pelo lo
--     evalúa UNA VEZ POR FILA. Con 1.600 tardeos son 1.600 llamadas por
--     consulta. Escrito `(select auth.uid())`, Postgres lo calcula una vez y
--     lo reutiliza. Lo mismo con is_admin(), que no depende de la fila.
--
--  2) "Multiple Permissive Policies": dos políticas permisivas para la misma
--     tabla, rol y acción obligan a evaluar las dos en cada fila. Se fusionan
--     en una por acción con OR: el resultado es idéntico (Postgres ya las
--     combinaba con OR), pero se evalúa una. Solo se hace si todas las
--     políticas de la tabla son para los mismos roles; si no, se deja.
--
--  3) "Unindexed foreign keys": claves foráneas sin índice. Borrar un perfil
--     o un tardeo obligaba a recorrer enteras las tablas que lo apuntan.
--
-- No toca datos. Idempotente: la segunda pasada no encuentra nada que hacer.
-- =============================================================

do $$
declare
  r record;
  q text;
  c text;
  v_accion text;
  v_usando text;
  v_chequeo text;
  v_roles text;
begin
  -- 1) Envolver auth.*() e is_admin() en un SELECT.
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
          ~* '(?<!select )(auth\.(uid|jwt|role)\(\)|is_admin\(\))'
  loop
    q := regexp_replace(r.qual,       '(?<!SELECT )(?<!select )(auth\.(uid|jwt|role)\(\)|(public\.)?is_admin\(\))', '(select \1)', 'g');
    c := regexp_replace(r.with_check, '(?<!SELECT )(?<!select )(auth\.(uid|jwt|role)\(\)|(public\.)?is_admin\(\))', '(select \1)', 'g');
    if q is not null then
      execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, q);
    end if;
    if c is not null then
      execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, c);
    end if;
  end loop;

  -- 2) Fusionar políticas permisivas que se solapan.
  for r in
    with p as (
      select tablename, policyname, roles, cmd
      from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE'
    ),
    solapes as (
      select distinct p.tablename
      from p, lateral unnest(case when cmd = 'ALL' then array['SELECT','INSERT','UPDATE','DELETE'] else array[cmd] end) a,
           lateral unnest(roles) rol
      group by p.tablename, a, rol having count(*) > 1
    )
    select s.tablename
    from solapes s
    where (select count(distinct roles) from p where p.tablename = s.tablename) = 1
  loop
    select array_to_string(array(select quote_ident(x) from unnest(pol.roles) x), ', ')
      into v_roles
    from pg_policies pol where pol.schemaname = 'public' and pol.tablename = r.tablename limit 1;

    -- Se guardan antes de borrar nada.
    create temp table if not exists _pol (accion text, usando text, chequeo text) on commit drop;
    truncate _pol;
    insert into _pol
    select a,
           case when a in ('SELECT','UPDATE','DELETE') then coalesce(qual, 'true') end,
           case when a in ('INSERT','UPDATE') then coalesce(with_check, qual, 'true') end
    from pg_policies,
         lateral unnest(case when cmd = 'ALL' then array['SELECT','INSERT','UPDATE','DELETE'] else array[cmd] end) a
    where schemaname = 'public' and tablename = r.tablename and permissive = 'PERMISSIVE';

    for c in select policyname from pg_policies
             where schemaname = 'public' and tablename = r.tablename and permissive = 'PERMISSIVE'
    loop
      execute format('drop policy %I on public.%I', c, r.tablename);
    end loop;

    for v_accion in select distinct _pol.accion from _pol loop
      select string_agg('(' || u || ')', ' or ') into v_usando
        from (select distinct _pol.usando u from _pol where _pol.accion = v_accion and _pol.usando is not null) s;
      select string_agg('(' || k || ')', ' or ') into v_chequeo
        from (select distinct _pol.chequeo k from _pol where _pol.accion = v_accion and _pol.chequeo is not null) s;
      execute format('create policy %I on public.%I as permissive for %s to %s%s%s',
        r.tablename || '_' || lower(v_accion), r.tablename, v_accion, v_roles,
        case when v_usando is not null then ' using (' || v_usando || ')' else '' end,
        case when v_chequeo is not null then ' with check (' || v_chequeo || ')' else '' end);
    end loop;
  end loop;

  -- 3) Índice para cada clave foránea que no tenga uno que empiece por ella.
  for r in
    select c.conrelid::regclass as tabla, c.conrelid, c.conkey,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as columnas,
           (select string_agg(a.attname, '_' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as sufijo
    from pg_constraint c
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
      )
  loop
    execute format('create index if not exists %I on %s (%s)',
      left('idx_fk_' || replace(r.tabla::text, 'public.', '') || '_' || r.sufijo, 63), r.tabla, r.columnas);
  end loop;
end $$;

-- 4) Reseñas: dos políticas de UPDATE con roles distintos (admin para todos,
--    apelar solo con sesión). El paso 2 no las fusiona por tener roles
--    distintos; a mano es seguro: sin sesión auth.uid() es null y is_admin()
--    es falso, así que para anon la política sigue sin dejar pasar nada.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'resenas' and policyname = 'resenas_apelar') then
    drop policy if exists "resenas_update" on public.resenas;
    drop policy "resenas_apelar" on public.resenas;
    create policy "resenas_update" on public.resenas
      for update
      using ((select public.is_admin())
             or (autor_profile_id = (select auth.uid()) and estado = 'rechazada'))
      with check ((select public.is_admin())
             or (autor_profile_id = (select auth.uid()) and estado = 'apelada'));
  end if;
end $$;

notify pgrst, 'reload schema';
