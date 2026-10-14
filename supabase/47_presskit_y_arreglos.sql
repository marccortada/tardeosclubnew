-- =========================================================
-- TardeosClub · LOTE 47: PRESSKIT DEL DJ Y PLANES CADUCADOS
-- Aplicar a mano en Supabase → SQL Editor. Es seguro repetirlo.
--
-- 1) `djs.presskit_url` nunca llegó a crearse en la base nueva y por eso
--    guardar el perfil de un DJ con PressKit fallaba. Solo se crea la columna.
--
--    NO se crea ninguna política nueva. El `presskit.sql` de la raíz añadía
--    `FOR SELECT USING (true)` sobre `djs`; como las políticas se suman con
--    OR, eso volvía visibles a los DJs ocultos. Las políticas que ya hay
--    (lectura pública de los no ocultos, el dueño edita lo suyo) cubren la
--    columna nueva sin más.
--
-- 2) Una función que dice qué locales tienen un plan de pago caducado o
--    impagado. `locales.plan_estado` y `plan_hasta` NO son públicos (lote 33:
--    es información comercial), así que la app no puede pedirlos en las
--    consultas anónimas. La función solo devuelve identificadores, sin decir
--    cuándo ni por qué: lo justo para que, con las reglas de planes
--    encendidas, un local caído deje de enseñar logo y sello.
--    Con las reglas apagadas la app ni la llama.
-- =========================================================

alter table public.djs add column if not exists presskit_url text;

-- Por coherencia con los lotes 27, 28 y 33. `djs` no está restringida por
-- columnas para anon, así que no cambia nada hoy; deja la columna visible si
-- algún día se cierra la tabla como se hizo con `locales`.
grant select (presskit_url) on public.djs to anon, authenticated;

-- PRIVACIDAD: con las reglas de planes APAGADAS (hoy) esta función devuelve
-- vacío, así que un anónimo no puede averiguar qué locales no han pagado. Con
-- las reglas encendidas solo revela lo que la web ya enseña (que ese local
-- pierde el logo y el sello).
--
-- Locales cuyo plan de pago ya no vale: no al corriente o pasada la fecha.
-- Mismo criterio que `vigente()` de lib/planes.ts (el día, en hora de España;
-- sin fecha se considera vigente). Los `basic` no se devuelven: caer a basic
-- no les cambia nada.
create or replace function public.locales_con_plan_caido()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select l.id
  from public.locales l
  where exists (select 1 from public.ajustes a
                where a.clave = 'planes_activos' and a.valor = 'true')
    and l.plan <> 'basic'
    and not (
      l.plan_estado = 'activa'
      and (
        l.plan_hasta is null
        or (l.plan_hasta at time zone 'Europe/Madrid')::date
           >= (now() at time zone 'Europe/Madrid')::date
      )
    );
$$;

revoke all on function public.locales_con_plan_caido() from public;
grant execute on function public.locales_con_plan_caido() to anon, authenticated;

notify pgrst, 'reload schema';
