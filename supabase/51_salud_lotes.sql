-- =========================================================
-- TardeosClub · LOTE 51: QUE /admin/salud PUEDA VER LO QUE NO SE LEE
-- Aplicar en Supabase → SQL Editor. Solo lectura, idempotente.
--
-- La pantalla de salud comprueba cada lote pidiendo una columna o llamando a
-- una función: si no existe, falta el lote. Pero hay lotes que solo crean
-- DISPARADORES, RESTRICCIONES o POLÍTICAS (41, 43 y parte del 46), y eso no se
-- ve desde fuera sin escribir, que es justo lo que no queremos hacer para
-- comprobar.
--
-- Esta función mira el catálogo de Postgres y dice sí/no por cada pieza. No
-- toca ningún dato. Solo admin.
-- =========================================================

create or replace function public.salud_lotes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador' using errcode = '42501';
  end if;

  return jsonb_build_object(
    -- Lote 41: el disparador que impide estados contradictorios en locales.
    'l41_disparador', exists (
      select 1 from pg_trigger
       where tgname = 'trg_estados_coherentes'
         and tgrelid = 'public.locales'::regclass
         and not tgisinternal),
    -- Lote 43: la restricción de estado admite 'oculto'.
    'l43_estado_oculto', exists (
      select 1 from pg_constraint
       where conname = 'locales_estado_check'
         and conrelid = 'public.locales'::regclass
         and pg_get_constraintdef(oid) like '%''oculto''%'),
    -- Lote 46: la política estricta de alta de suscripciones push.
    'l46_politica_push', exists (
      select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'push_suscripciones'
         and policyname = 'push_insert'
         and coalesce(with_check, '') like '%fcm%')
  );
end;
$$;

revoke all on function public.salud_lotes() from public;
revoke all on function public.salud_lotes() from anon;
grant execute on function public.salud_lotes() to authenticated;

notify pgrst, 'reload schema';

-- Comprobación (con sesión de admin en la app; desde el SQL Editor auth.uid()
-- es nulo y daría "Solo un administrador"):
--   select public.salud_lotes();
