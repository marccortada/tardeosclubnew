-- ============================================================
-- TardeosClub · PAQUETE ÚNICO: lotes 45 a 62 en orden
-- Pegar ENTERO en Supabase → SQL Editor → Run. Se puede pegar más de una vez.
-- Probado en una copia local con los lotes 01-44 (dos pasadas, sin errores).
-- No borra ningún dato. YA APLICADO en producción el 15-oct-2026.
-- ============================================================


-- >>>>>>>>>>>>>>>>>>>> 45_destacados_orden.sql <<<<<<<<<<<<<<<<<<<<
-- =========================================================
-- TardeosClub · LOTE 45: REORDENAR DESTACADOS EN UN SOLO PASO
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Antes, arrastrar un destacado a otro sitio hacía N escrituras seguidas desde
-- el navegador (una por fila). Si fallaba la quinta, el orden quedaba a medias.
-- Esta función pone destacado_orden = 1..N a la lista que le des, TODO en una
-- sola transacción: o se guarda entera o no se guarda nada.
--
-- Solo admin. Lista blanca de tablas: el nombre de la tabla llega como texto,
-- así que se valida antes de usarlo (y se escapa con %I) para que nadie pueda
-- colar otra tabla.
--
-- Los ids que NO vengan en la lista y ya tuvieran orden se quedan como están.
-- Idempotente: se puede pegar varias veces; llamar dos veces con la misma lista
-- deja el mismo resultado.
-- =========================================================

create or replace function public.reordenar_destacados(p_tabla text, p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n_pedidos integer;
  n_hechos  integer;
begin
  -- 1) Solo admin. is_admin() mira a quien llama (auth.uid()), no al dueño de
  --    la función, así que security definer no abre la puerta a nadie más.
  if not public.is_admin() then
    raise exception 'Solo un administrador puede reordenar destacados' using errcode = '42501';
  end if;

  -- 2) Lista blanca de tablas.
  if p_tabla is null or p_tabla not in ('tardeos', 'locales', 'djs') then
    raise exception 'Tabla no permitida: %', coalesce(p_tabla, '(nula)') using errcode = '22023';
  end if;

  -- 3) Lista vacía: nada que hacer.
  n_pedidos := coalesce(cardinality(p_ids), 0);
  if n_pedidos = 0 then
    return 0;
  end if;

  -- 4) Sin ids repetidos ni nulos: dos posiciones para el mismo id no tienen
  --    sentido y esconderían un error del cliente.
  if exists (select 1 from unnest(p_ids) as x where x is null)
     or (select count(distinct x) from unnest(p_ids) as x) <> n_pedidos then
    raise exception 'La lista de ids tiene nulos o repetidos' using errcode = '22023';
  end if;

  -- 5) Posición = lugar en la lista (1..N). Una sola sentencia = una sola
  --    transacción. Los triggers proteger_* dejan pasar porque quien llama es admin.
  execute format(
    'update public.%I t set destacado_orden = u.pos
       from unnest($1) with ordinality as u(id, pos)
      where t.id = u.id',
    p_tabla
  ) using p_ids;
  get diagnostics n_hechos = row_count;

  -- 6) Si algún id no existe, se deshace todo (el raise aborta la transacción)
  --    en vez de dejar un orden con huecos.
  if n_hechos <> n_pedidos then
    raise exception 'Faltan fichas: se pidieron % y solo existen %', n_pedidos, n_hechos using errcode = 'P0002';
  end if;

  return n_hechos;
end;
$$;

-- Nadie salvo usuarios con sesión puede llamarla (y dentro, solo admin).
revoke all on function public.reordenar_destacados(text, uuid[]) from public;
revoke all on function public.reordenar_destacados(text, uuid[]) from anon;
grant execute on function public.reordenar_destacados(text, uuid[]) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Comprobaciones (dejarlas comentadas; probar a mano si se quiere):
--
--  -- Como admin, con sesión iniciada en la app (desde el SQL Editor auth.uid()
--  -- es nulo y daría "Solo un administrador"):
--  --   select public.reordenar_destacados('djs', array['<uuid1>','<uuid2>']::uuid[]);
--  --   → devuelve 2 y esos DJs quedan con destacado_orden 1 y 2.
--  -- Tabla no permitida:
--  --   select public.reordenar_destacados('profiles', array['<uuid>']::uuid[]);
--  --   → error "Tabla no permitida: profiles".
--  -- Existe la función y solo la ejecuta authenticated:
--  --   select has_function_privilege('anon', 'public.reordenar_destacados(text,uuid[])', 'execute');          -- false
--  --   select has_function_privilege('authenticated', 'public.reordenar_destacados(text,uuid[])', 'execute'); -- true
-- ---------------------------------------------------------


-- >>>>>>>>>>>>>>>>>>>> 46_seguridad.sql <<<<<<<<<<<<<<<<<<<<
-- 46_seguridad.sql
-- Endurecimiento de seguridad (AUDITORIA_Y_PLAN.md §5). Idempotente: se puede
-- ejecutar varias veces sin efectos secundarios.

-- ============================================================================
-- 1) Idempotencia de los recordatorios
-- ============================================================================
-- /api/recordatorios se ejecuta desde un cron. Si se lanza dos veces (reintento,
-- doble disparo, alguien llamándolo a mano), cada apuntado recibía el email
-- repetido. Esta tabla apunta a quién se le ha avisado de qué tardeo; la clave
-- primaria hace imposible duplicar, y el código inserta con "on conflict do
-- nothing" y solo envía a quien se acaba de insertar.
create table if not exists public.recordatorios_enviados (
  tardeo_id   uuid not null,
  profile_id  uuid not null,
  enviado_en  timestamptz not null default now(),
  primary key (tardeo_id, profile_id)
);

-- RLS activada y SIN políticas a propósito: anon y authenticated no pueden ni
-- leer ni escribir. Solo el servidor, con la service role (que se salta RLS).
alter table public.recordatorios_enviados enable row level security;

-- ============================================================================
-- 2) push_suscripciones: política de inserción más estricta
-- ============================================================================
-- Antes: `with check (true)`, es decir, cualquiera podía guardar un endpoint
-- arbitrario (el servidor luego le haría una petición: SSRF ciego) o suplantar
-- el profile_id de otra persona. Ahora se exige:
--   * endpoint con https:// y host de un servicio de push conocido
--     (FCM, Mozilla, Windows/WNS, Apple y sus subdominios), y
--   * profile_id nulo (suscripción anónima) o el propio usuario (auth.uid()).
-- El host se valida con regex anclada: tras https:// solo puede haber el host
-- (sin usuario@ ni puerto raro) seguido de "/" y la ruta.
drop policy if exists "push_insert" on public.push_suscripciones;
create policy "push_insert" on public.push_suscripciones
  for insert to anon, authenticated
  with check (
    endpoint ~* '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com|([a-z0-9-]+\.)+push\.apple\.com)(:443)?/'
    and (profile_id is null or profile_id = auth.uid())
  );

-- ============================================================================
-- Comprobaciones (descomenta y ejecuta una a una)
-- ============================================================================
-- select relrowsecurity from pg_class where oid = 'public.recordatorios_enviados'::regclass;   -- debe ser true
-- select count(*) from pg_policies where schemaname='public' and tablename='recordatorios_enviados'; -- debe ser 0
-- select policyname, cmd, with_check from pg_policies where schemaname='public' and tablename='push_suscripciones';
-- Suscripciones existentes que NO cumplirían la política nueva (revisar/borrar a mano):
-- select id, endpoint from public.push_suscripciones
--   where endpoint !~* '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com|([a-z0-9-]+\.)+push\.apple\.com)(:443)?/';


-- >>>>>>>>>>>>>>>>>>>> 47_presskit_y_arreglos.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> 48_reservas_aforo_asistencia.sql <<<<<<<<<<<<<<<<<<<<
-- =========================================================
-- TardeosClub · LOTE 48: RESERVAS CON AFORO Y ASISTENCIA
-- Aplicar a mano en Supabase → SQL Editor. Es seguro repetirlo.
--
-- La web antigua tenía "Reservas": aforo por evento, registro de asistencias
-- (asistió / no se presentó) y exportación. En la nueva ya existe
-- `inscripciones` (apuntarse a un tardeo gratis). Este lote la completa SIN
-- crear un sistema nuevo:
--   · tardeos.aforo               plazas (vacío = sin límite)
--   · inscripciones.asistencia    pendiente | asistio | no_asistio
--   · el aforo se respeta EN LA BASE, no solo en pantalla (dos personas
--     pulsando a la vez no pueden pasarse)
--   · el local (o el admin) marca la asistencia con una función, y solo eso:
--     no puede tocar a quién pertenece la inscripción ni su estado
--
-- Nada de esto toca pagos, planes ni precios.
-- =========================================================

-- 1) Columnas ---------------------------------------------------------------
alter table public.tardeos
  add column if not exists aforo integer check (aforo is null or aforo > 0);

alter table public.inscripciones
  add column if not exists asistencia text not null default 'pendiente'
    check (asistencia in ('pendiente', 'asistio', 'no_asistio')),
  add column if not exists asistencia_en timestamptz;

grant select (aforo) on public.tardeos to anon, authenticated;

-- 2) El aforo se respeta en la base ----------------------------------------
-- Se comprueba al apuntarse (insert) y al volver a apuntarse tras cancelar
-- (update de cancelado -> apuntado). El candado por tardeo evita que dos
-- peticiones simultáneas lean el mismo recuento y se cuelen las dos.
create or replace function public.inscripcion_respeta_aforo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aforo integer;
  v_n     integer;
begin
  if new.estado <> 'apuntado' then return new; end if;
  if tg_op = 'UPDATE' and old.estado = 'apuntado' and new.tardeo_id = old.tardeo_id then return new; end if;

  select t.aforo into v_aforo from public.tardeos t where t.id = new.tardeo_id;
  if v_aforo is null then return new; end if;

  perform pg_advisory_xact_lock(hashtext(new.tardeo_id::text));

  select count(*) into v_n
  from public.inscripciones i
  where i.tardeo_id = new.tardeo_id
    and i.estado = 'apuntado'
    and i.id is distinct from new.id;

  if v_n >= v_aforo then
    raise exception 'Aforo completo' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inscripcion_aforo on public.inscripciones;
create trigger trg_inscripcion_aforo
  before insert or update of estado, tardeo_id on public.inscripciones
  for each row execute function public.inscripcion_respeta_aforo();

-- 2b) Una inscripción no se "muda" ------------------------------------------
-- La política de update (lote 1) deja tocar la propia fila sin restringir
-- columnas: sin esto, alguien podía apuntarse a un tardeo con plazas y luego
-- cambiar el tardeo_id a uno lleno (o a un borrador). Solo el admin puede
-- cambiar a qué tardeo o a quién pertenece una inscripción.
create or replace function public.inscripcion_inmutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then return new; end if;
  if new.tardeo_id is distinct from old.tardeo_id or new.profile_id is distinct from old.profile_id then
    raise exception 'No se puede cambiar el tardeo ni la persona de una inscripción' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inscripcion_inmutable on public.inscripciones;
create trigger trg_inscripcion_inmutable
  before update of tardeo_id, profile_id on public.inscripciones
  for each row execute function public.inscripcion_inmutable();

-- 3) Quien se apunta NO puede marcarse su propia asistencia ------------------
create or replace function public.proteger_asistencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.asistencia    := 'pendiente';
    new.asistencia_en := null;
  else
    new.asistencia    := old.asistencia;
    new.asistencia_en := old.asistencia_en;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_asistencia on public.inscripciones;
create trigger trg_proteger_asistencia
  before insert or update on public.inscripciones
  for each row execute function public.proteger_asistencia();

-- 4) Plazas de un tardeo (público: el recuento no es dato personal) ---------
create or replace function public.plazas_de_tardeo(p_tardeo uuid)
returns table(aforo integer, apuntados integer, libres integer)
language sql
stable
security definer
set search_path = public
as $$
  select t.aforo,
         (select count(*)::int from public.inscripciones i
           where i.tardeo_id = t.id and i.estado = 'apuntado'),
         case when t.aforo is null then null
              else greatest(t.aforo - (select count(*)::int from public.inscripciones i
                                        where i.tardeo_id = t.id and i.estado = 'apuntado'), 0) end
  from public.tardeos t
  where t.id = p_tardeo;
$$;

revoke all on function public.plazas_de_tardeo(uuid) from public;
grant execute on function public.plazas_de_tardeo(uuid) to anon, authenticated;

-- 5) Quién se ha apuntado a un tardeo (solo su local o un admin) ------------
create or replace function public.inscritos_de_tardeo(p_tardeo uuid)
returns table(
  inscripcion_id uuid, nombre text, estado text,
  asistencia text, apuntado_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or exists (
        select 1 from public.tardeos t
        where t.id = p_tardeo and public.owns_tardeo(t.local_id))) then
    return;
  end if;

  return query
    select i.id, coalesce(p.display_name, 'Tardícola'), i.estado,
           i.asistencia, i.created_at
    from public.inscripciones i
    left join public.profiles p on p.id = i.profile_id
    where i.tardeo_id = p_tardeo
    order by i.estado, i.created_at;
end;
$$;

revoke all on function public.inscritos_de_tardeo(uuid) from public, anon;
grant execute on function public.inscritos_de_tardeo(uuid) to authenticated;

-- 6) Marcar asistencia (solo el local del tardeo o un admin) ----------------
create or replace function public.marcar_asistencia(p_inscripcion uuid, p_asistencia text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tardeo uuid;
begin
  if p_asistencia not in ('pendiente', 'asistio', 'no_asistio') then
    raise exception 'Valor no válido: %', p_asistencia using errcode = '22023';
  end if;

  select i.tardeo_id into v_tardeo from public.inscripciones i where i.id = p_inscripcion;
  if v_tardeo is null then
    raise exception 'Inscripción no encontrada' using errcode = 'P0002';
  end if;

  if not (public.is_admin() or exists (
        select 1 from public.tardeos t
        where t.id = v_tardeo and public.owns_tardeo(t.local_id))) then
    raise exception 'No tienes permiso sobre este tardeo' using errcode = '42501';
  end if;

  -- El trigger proteger_asistencia deja pasar solo a admins; aquí marcamos
  -- con la marca de "escritura del sistema" que ya usa el lote 9.
  perform set_config('app.marca_asistencia', 'on', true);
  update public.inscripciones
     set asistencia = p_asistencia,
         asistencia_en = case when p_asistencia = 'pendiente' then null else now() end
   where id = p_inscripcion;
  perform set_config('app.marca_asistencia', 'off', true);
end;
$$;

revoke all on function public.marcar_asistencia(uuid, text) from public, anon;
grant execute on function public.marcar_asistencia(uuid, text) to authenticated;

-- El trigger del punto 3 debe dejar pasar esa marca (y solo esa).
create or replace function public.proteger_asistencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then return new; end if;
  if coalesce(current_setting('app.marca_asistencia', true), '') = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    new.asistencia    := 'pendiente';
    new.asistencia_en := null;
  else
    new.asistencia    := old.asistencia;
    new.asistencia_en := old.asistencia_en;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';

-- =========================================================
-- COMPROBACIONES (descomenta y ejecuta una a una)
-- =========================================================
-- select column_name from information_schema.columns
--  where table_name in ('tardeos','inscripciones') and column_name in ('aforo','asistencia','asistencia_en');   -- 3 filas
-- select * from public.plazas_de_tardeo((select id from public.tardeos limit 1));


-- >>>>>>>>>>>>>>>>>>>> 49_popups.sql <<<<<<<<<<<<<<<<<<<<
-- =============================================================
-- TardeosClub · LOTE 49: BOTÓN E IMAGEN DE LOS POP-UPS
-- =============================================================
-- Hasta ahora todos los pop-ups llevaban el mismo botón fijo («Ver tardeos»,
-- a /tardeos) y ninguno podía llevar imagen. Para anunciar una promoción hace
-- falta mandar a SU página (la ficha del tardeo, la del local, un formulario)
-- y poder enseñar el cartel.
--
-- Todo es opcional y con `if not exists`: se puede pegar varias veces. La app
-- funciona sin este lote (los pop-ups salen con el botón de siempre y sin
-- imagen); el panel avisa de que falta.
-- =============================================================

alter table public.popups add column if not exists cta_texto  text;
alter table public.popups add column if not exists cta_url    text;
alter table public.popups add column if not exists imagen_url text;

-- Solo rutas internas ("/algo", nunca "//host") o enlaces https. Es la misma
-- regla que aplica el panel antes de guardar; aquí por si alguien escribe
-- directamente en la tabla.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'popups_cta_url_check') then
    alter table public.popups
      add constraint popups_cta_url_check
      check (
        cta_url is null
        or (cta_url like '/%' and cta_url not like '//%' and cta_url not like '/\\%')
        or cta_url like 'https://%'
      );
  end if;
end $$;

notify pgrst, 'reload schema';


-- >>>>>>>>>>>>>>>>>>>> 50_panel_local_admin.sql <<<<<<<<<<<<<<<<<<<<
-- ============================================================
-- LOTE 50 · El admin ve los apuntados y las visitas de cualquier local
--
-- El panel del local (/local?id=…) deja al admin abrir fichas ajenas para
-- ayudar a un dueño. Las dos funciones de abajo solo respondían al DUEÑO
-- (lotes 5 y 8), así que el admin veía "0 visitas" y "nadie apuntado" en
-- fichas que sí tienen datos, que es peor que no ver nada.
--
-- Mismo cuerpo que antes; solo cambia quién puede preguntar: el dueño o un
-- admin (public.is_admin(), lote 1). Idempotente: se puede pegar dos veces.
-- ============================================================

create or replace function public.inscritos_de_local(p_local uuid)
returns table(tardeo_id uuid, tardeo_titulo text, fecha date, nombre text, apuntado_en timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or exists (
    select 1 from public.locales l
    where l.id = p_local and l.owner_id = auth.uid()
  )) then
    return; -- vacío si no eres el dueño ni admin
  end if;

  return query
    select t.id, t.titulo, t.fecha,
           coalesce(p.display_name, 'Tardícola') as nombre,
           i.created_at
    from public.inscripciones i
    join public.tardeos t on t.id = i.tardeo_id
    left join public.profiles p on p.id = i.profile_id
    where t.local_id = p_local
      and i.estado = 'apuntado'
    order by t.fecha asc, i.created_at desc;
end;
$$;

grant execute on function public.inscritos_de_local(uuid) to authenticated;

create or replace function public.metricas_de_local(p_local uuid)
returns table(visitas bigint, inscritos bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or exists (
    select 1 from public.locales l
    where l.id = p_local and l.owner_id = auth.uid()
  )) then
    return query select 0::bigint, 0::bigint;
    return;
  end if;

  return query
    select
      coalesce((
        select sum(m.visitas)
        from public.metricas_tardeo m
        join public.tardeos t on t.id = m.tardeo_id
        where t.local_id = p_local
      ), 0)::bigint as visitas,
      coalesce((
        select count(*)
        from public.inscripciones i
        join public.tardeos t on t.id = i.tardeo_id
        where t.local_id = p_local and i.estado = 'apuntado'
      ), 0)::bigint as inscritos;
end;
$$;

grant execute on function public.metricas_de_local(uuid) to authenticated;


-- >>>>>>>>>>>>>>>>>>>> 51_salud_lotes.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> 52_borrar_cuenta.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> 53_series.sql <<<<<<<<<<<<<<<<<<<<
-- ============================================================
-- LOTE 53 · Series de tardeos («cada semana hasta diciembre»)
--
-- Crear un tardeo que se repite inserta una fila por fecha, pero nada las
-- unía: cambiar la hora de los dieciséis obligaba a abrirlos uno a uno.
-- `serie_id` es un uuid común a todas las fechas creadas a la vez; el panel
-- lo usa para «Aplicar también a las siguientes fechas de esta serie».
--
-- Sin tabla aparte a propósito: la serie no tiene datos propios, solo
-- agrupa. Los tardeos sueltos y los migrados quedan con null.
--
-- RLS no cambia: un update por serie_id sigue pasando por las políticas de
-- `tardeos` (solo el dueño del local o un admin).
-- Idempotente: se puede pegar dos veces.
-- ============================================================

alter table public.tardeos add column if not exists serie_id uuid;

-- Las consultas son siempre «los de esta serie a partir de tal fecha».
create index if not exists idx_tardeos_serie on public.tardeos(serie_id, fecha)
  where serie_id is not null;

notify pgrst, 'reload schema';


-- >>>>>>>>>>>>>>>>>>>> 54_metricas_por_tardeo.sql <<<<<<<<<<<<<<<<<<<<
-- ============================================================
-- LOTE 54 · Estadísticas por tardeo en el panel del local
--
-- «Cómo va» (lote 39) suma el local entero por día. Lo que el local quiere
-- saber después es CUÁL de sus tardeos funciona: visitas, clics a comprar y
-- guardados de cada uno en el periodo elegido.
--
-- En función y no desde el navegador: contar en cliente obligaría a bajarse
-- todas las filas de eventos_metrica (PostgREST corta a 1000). Sin la función
-- el panel cuenta a mano con un tope y lo avisa como aproximado.
--
-- security definer con la comprobación dentro, igual que metricas_local:
-- solo el dueño o un admin. Idempotente.
-- ============================================================

create or replace function public.metricas_por_tardeo(
  p_local uuid,
  p_dias int default 30
)
returns table (tardeo_id uuid, titulo text, fecha date, visitas bigint, clics bigint, guardados bigint)
language sql stable security definer set search_path = public as $$
  select t.id, t.titulo, t.fecha,
         count(*) filter (where e.tipo = 'vista_tardeo')                   as visitas,
         count(*) filter (where e.tipo in ('clic_entrada', 'clic_lista'))  as clics,
         count(*) filter (where e.tipo = 'favorito')                       as guardados
    from public.eventos_metrica e
    join public.tardeos t on t.id = e.tardeo_id
   where t.local_id = p_local
     and e.created_at >= now() - (greatest(p_dias, 1) || ' days')::interval
     and (public.is_admin() or public.owns_tardeo(p_local))
   group by t.id, t.titulo, t.fecha
   order by 4 desc, t.fecha desc
   limit 200;
$$;

revoke all on function public.metricas_por_tardeo(uuid, int) from public;
grant execute on function public.metricas_por_tardeo(uuid, int) to authenticated;

notify pgrst, 'reload schema';


-- >>>>>>>>>>>>>>>>>>>> 55_invitaciones_dj.sql <<<<<<<<<<<<<<<<<<<<
-- =========================================================
-- TardeosClub · LOTE 55: INVITACIONES DJ ↔ TARDEO
-- Aplicar en Supabase → SQL Editor (base nueva). Idempotente.
--
-- Hoy un DJ sale en un tardeo solo si el local lo mete en `tardeo_djs`, sin
-- preguntarle. Resultado: DJs que aparecen en carteles en los que no pinchan
-- (sobre todo tras la migración) y sin forma de quitarse.
--
-- 1. `dj_invitaciones`: el local (o el admin) invita; el DJ acepta o rechaza.
--    Al aceptar, un disparador lo mete en `tardeo_djs` (el DJ no tiene
--    permiso directo sobre esa tabla, y así sigue siendo).
-- 2. El DJ puede QUITARSE de un tardeo (borrar SU fila de `tardeo_djs`). Solo
--    la suya: no puede tocar las de otros DJs ni añadirse a nada sin invitación.
-- =========================================================

create table if not exists public.dj_invitaciones (
  id uuid primary key default gen_random_uuid(),
  tardeo_id uuid not null references public.tardeos(id) on delete cascade,
  dj_id uuid not null references public.djs(id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptada', 'rechazada')),
  -- Quién invitó. Si se borra la cuenta, la invitación se queda.
  creada_por uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  respondida_en timestamptz
);

-- Una sola invitación PENDIENTE por DJ y tardeo: reenviar no debe llenarle la
-- bandeja. Las respondidas sí se acumulan (histórico).
create unique index if not exists uq_dj_inv_pendiente
  on public.dj_invitaciones(tardeo_id, dj_id) where estado = 'pendiente';
create index if not exists idx_dj_inv_dj on public.dj_invitaciones(dj_id, estado, created_at desc);

alter table public.dj_invitaciones enable row level security;

-- ¿Es mío este DJ? (security definer para no depender de la RLS de djs)
create or replace function public.es_mi_dj(p_dj uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.djs d where d.id = p_dj and d.profile_id = auth.uid());
$$;

-- ¿Soy dueño del local de este tardeo? (o admin)
create or replace function public.gestiona_tardeo(p_tardeo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.tardeos t where t.id = p_tardeo and public.owns_tardeo(t.local_id));
$$;

-- VER: el DJ invitado, quien gestiona el tardeo y el admin.
drop policy if exists "dj_inv_select" on public.dj_invitaciones;
create policy "dj_inv_select" on public.dj_invitaciones
  for select using (public.es_mi_dj(dj_id) or public.gestiona_tardeo(tardeo_id));

-- CREAR: solo quien gestiona el tardeo, siempre en pendiente y a su nombre.
drop policy if exists "dj_inv_insert" on public.dj_invitaciones;
create policy "dj_inv_insert" on public.dj_invitaciones
  for insert with check (
    public.gestiona_tardeo(tardeo_id)
    and estado = 'pendiente'
    and (creada_por is null or creada_por = auth.uid())
  );

-- RESPONDER: el DJ, solo las suyas y solo de pendiente a aceptada/rechazada.
drop policy if exists "dj_inv_responder" on public.dj_invitaciones;
create policy "dj_inv_responder" on public.dj_invitaciones
  for update using (public.es_mi_dj(dj_id) and estado = 'pendiente')
  with check (public.es_mi_dj(dj_id) and estado in ('aceptada', 'rechazada'));

-- El admin puede corregir cualquier cosa.
drop policy if exists "dj_inv_admin" on public.dj_invitaciones;
create policy "dj_inv_admin" on public.dj_invitaciones
  for update using (public.is_admin()) with check (public.is_admin());

-- RETIRAR una invitación: quien gestiona el tardeo.
drop policy if exists "dj_inv_delete" on public.dj_invitaciones;
create policy "dj_inv_delete" on public.dj_invitaciones
  for delete using (public.gestiona_tardeo(tardeo_id));

-- Al responder no se puede cambiar a qué tardeo ni a qué DJ se refiere (la
-- política de update no ve columnas sueltas: esto lo cierra). Y se apunta la
-- hora de respuesta.
create or replace function public.dj_inv_antes_update()
returns trigger language plpgsql as $$
begin
  if new.tardeo_id is distinct from old.tardeo_id
     or new.dj_id is distinct from old.dj_id
     or new.creada_por is distinct from old.creada_por
     or new.created_at is distinct from old.created_at then
    raise exception 'Solo se puede cambiar el estado de la invitación' using errcode = '42501';
  end if;
  if new.estado is distinct from old.estado and new.estado <> 'pendiente' then
    new.respondida_en := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_dj_inv_antes_update on public.dj_invitaciones;
create trigger trg_dj_inv_antes_update before update on public.dj_invitaciones
  for each row execute function public.dj_inv_antes_update();

-- Al aceptar, el DJ entra en el cartel. security definer porque el DJ no puede
-- escribir en tardeo_djs; solo se ejecuta por una invitación válida.
create or replace function public.dj_inv_al_aceptar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'aceptada' and old.estado is distinct from 'aceptada' then
    insert into public.tardeo_djs (tardeo_id, dj_id)
    values (new.tardeo_id, new.dj_id)
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_dj_inv_al_aceptar on public.dj_invitaciones;
create trigger trg_dj_inv_al_aceptar after update on public.dj_invitaciones
  for each row execute function public.dj_inv_al_aceptar();

grant select, insert, update, delete on public.dj_invitaciones to authenticated;

-- 2. "No pincho aquí": el DJ puede borrar SU fila de tardeo_djs.
drop policy if exists "tardeo_djs_dj_salir" on public.tardeo_djs;
create policy "tardeo_djs_dj_salir" on public.tardeo_djs
  for delete using (public.es_mi_dj(dj_id));

-- 3. Lo que ve el DJ en su bandeja. Función y no consulta directa porque el
-- tardeo puede estar aún en borrador, y entonces la RLS de `tardeos` no le
-- deja leer ni el título: vería invitaciones "a nada". Aquí se devuelve lo
-- justo (título, fecha, local) y solo de SUS invitaciones (o admin).
create or replace function public.invitaciones_de_dj(p_dj uuid)
returns table (
  id uuid, estado text, created_at timestamptz, tardeo_id uuid,
  titulo text, fecha date, hora_inicio time, local_nombre text, zona text
)
language sql stable security definer set search_path = public as $$
  select i.id, i.estado, i.created_at, t.id, t.titulo, t.fecha, t.hora_inicio, l.nombre, l.zona
    from public.dj_invitaciones i
    join public.tardeos t on t.id = i.tardeo_id
    left join public.locales l on l.id = t.local_id
   where i.dj_id = p_dj
     and (public.es_mi_dj(p_dj) or public.is_admin())
   order by (i.estado = 'pendiente') desc, t.fecha asc;
$$;

grant execute on function public.invitaciones_de_dj(uuid) to authenticated;

-- 4. El admin puede BORRAR fichas de DJ. `djs` nunca tuvo política de borrado
-- (los locales sí: locales_delete), así que "Eliminar ficha" en /admin/djs
-- devolvía 0 filas sin error. Con el borrado caen en cascada sus apariciones
-- en carteles (tardeo_djs), contenidos y métricas; los tardeos se quedan.
drop policy if exists "djs_delete" on public.djs;
create policy "djs_delete" on public.djs
  for delete using (public.is_admin());


-- >>>>>>>>>>>>>>>>>>>> 56_admin_lee_favoritos.sql <<<<<<<<<<<<<<<<<<<<
-- =====================================================================
-- Lote 56 · El admin puede LEER los guardados (favoritos) de cualquiera
-- =====================================================================
-- La tabla `favoritos` existe en producción pero no sale de ningún lote del
-- repo, y su RLS solo deja a cada persona ver los suyos. En la ficha de
-- usuario del admin (/admin/usuarios/[id]) los guardados salían siempre 0
-- aunque la persona tuviera (comprobado con service role).
--
-- Solo añade una política de LECTURA para admins. No toca las existentes ni
-- deja escribir a nadie más. Se puede pegar varias veces.
-- =====================================================================

-- `favoritos` existe en producción pero no sale de ningún lote: si no
-- estuviera, se salta sin error (así el paquete entero nunca se corta aquí).
do $$
begin
  if to_regclass('public.favoritos') is null then
    raise notice 'No hay tabla public.favoritos: lote 56 sin efecto';
    return;
  end if;
  execute 'alter table public.favoritos enable row level security';
  execute 'drop policy if exists "favoritos_admin_lee" on public.favoritos';
  execute 'create policy "favoritos_admin_lee" on public.favoritos for select using (public.is_admin())';
end $$;


-- >>>>>>>>>>>>>>>>>>>> 57_incidencias_y_errores.sql <<<<<<<<<<<<<<<<<<<<
-- =========================================================
-- TardeosClub · LOTE 57: INCIDENCIAS Y ERRORES
-- Aplicar en Supabase → SQL Editor (base nueva). Idempotente: se puede pegar
-- dos veces sin romper nada.
--
-- Hoy, cuando algo falla, el admin se entera por un WhatsApp suelto («esto no
-- me va») o no se entera. Este lote da dos bandejas:
--
-- 1. `incidencias`: lo que la gente REPORTA a mano («X me da problema»).
--    Cualquiera puede crear una (con o sin sesión); cada uno ve las suyas y el
--    admin las ve y gestiona todas.
-- 2. `errores_app`: los errores que salen SOLOS (pantallas rotas, fallos del
--    servidor). Agrupados por huella: el mismo error mil veces es UNA fila con
--    `veces = 1000`, no mil filas. Solo escribe el servidor (service role) a
--    través de `registrar_error_app`; el admin lee, marca resueltos y borra.
-- =========================================================

-- ---------------------------------------------------------
-- 1) INCIDENCIAS
-- ---------------------------------------------------------
create table if not exists public.incidencias (
  id uuid primary key default gen_random_uuid(),
  -- Si se borra la cuenta, la incidencia se queda (sin dueño).
  profile_id uuid references public.profiles(id) on delete set null,
  email_contacto text,
  rol text not null default 'anonimo'
    check (rol in ('tardicola', 'local', 'dj', 'admin', 'anonimo')),
  tipo text not null default 'error'
    check (tipo in ('error', 'duda', 'sugerencia', 'otro')),
  mensaje text not null check (char_length(btrim(mensaje)) between 10 and 2000),
  url text check (url is null or char_length(url) <= 500),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  estado text not null default 'abierta'
    check (estado in ('abierta', 'en_curso', 'resuelta')),
  nota_admin text check (nota_admin is null or char_length(nota_admin) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resuelta_en timestamptz
);

-- El email se valida aparte para poder añadir la regla si la tabla ya existía.
do $$ begin
  alter table public.incidencias add constraint incidencias_email_chk
    check (email_contacto is null or (char_length(email_contacto) <= 200 and email_contacto ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
exception when duplicate_object then null; end $$;

create index if not exists idx_incidencias_estado on public.incidencias(estado, created_at desc);
create index if not exists idx_incidencias_fecha on public.incidencias(created_at desc);
create index if not exists idx_incidencias_profile on public.incidencias(profile_id) where profile_id is not null;

-- updated_at y resuelta_en se ponen solos: así no dependen de que la pantalla
-- se acuerde de mandarlos.
create or replace function public.incidencias_marcas()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.estado = 'resuelta' and (tg_op = 'INSERT' or old.estado is distinct from 'resuelta') then
    new.resuelta_en = now();
  elsif new.estado <> 'resuelta' then
    new.resuelta_en = null;
  end if;
  return new;
end; $$;

drop trigger if exists trg_incidencias_marcas on public.incidencias;
create trigger trg_incidencias_marcas before insert or update on public.incidencias
  for each row execute function public.incidencias_marcas();

-- Al crearla: el ROL lo decide la base (no quien escribe, que podía ponerse
-- "admin"), y hay tope para que nadie llene la bandeja: 5 por cuenta en una
-- hora, y como mucho 60 anónimas en una hora entre todos.
create or replace function public.incidencias_al_crear()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_n   integer;
begin
  if v_uid is null then
    new.rol := 'anonimo';
    select count(*) into v_n from public.incidencias
      where profile_id is null and created_at > now() - interval '1 hour';
    if v_n >= 60 then raise exception 'Demasiados avisos ahora mismo. Prueba en un rato.' using errcode = 'P0001'; end if;
  else
    select case
             when p.is_admin then 'admin'
             when exists (select 1 from public.locales l where l.owner_id = v_uid) then 'local'
             when exists (select 1 from public.djs d where d.profile_id = v_uid) then 'dj'
             else 'tardicola'
           end
      into new.rol
      from public.profiles p where p.id = v_uid;
    new.rol := coalesce(new.rol, 'tardicola');
    select count(*) into v_n from public.incidencias
      where profile_id = v_uid and created_at > now() - interval '1 hour';
    if v_n >= 5 then raise exception 'Ya nos has escrito varias veces en la última hora. Te contestamos pronto.' using errcode = 'P0001'; end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_incidencias_al_crear on public.incidencias;
create trigger trg_incidencias_al_crear before insert on public.incidencias
  for each row execute function public.incidencias_al_crear();

alter table public.incidencias enable row level security;

-- CREAR: cualquiera (con o sin sesión). Siempre abierta, sin nota del admin y
-- a su nombre o anónima: nadie puede crear incidencias en nombre de otro.
drop policy if exists "incidencias_insert" on public.incidencias;
create policy "incidencias_insert" on public.incidencias
  for insert to anon, authenticated with check (
    (profile_id is null or profile_id = auth.uid())
    and estado = 'abierta'
    and nota_admin is null
    and resuelta_en is null
    and char_length(btrim(mensaje)) between 10 and 2000
  );

-- VER: cada uno las suyas; el admin, todas.
drop policy if exists "incidencias_select" on public.incidencias;
create policy "incidencias_select" on public.incidencias
  for select to authenticated using (profile_id = auth.uid() or public.is_admin());

-- CAMBIAR ESTADO / NOTA: solo el admin.
drop policy if exists "incidencias_update" on public.incidencias;
create policy "incidencias_update" on public.incidencias
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "incidencias_delete" on public.incidencias;
create policy "incidencias_delete" on public.incidencias
  for delete to authenticated using (public.is_admin());

grant insert on public.incidencias to anon, authenticated;
grant select, update, delete on public.incidencias to authenticated;

-- ---------------------------------------------------------
-- 2) ERRORES AUTOMÁTICOS
-- ---------------------------------------------------------
create table if not exists public.errores_app (
  id uuid primary key default gen_random_uuid(),
  -- Hash de origen + mensaje normalizado + ruta: agrupa el «mismo» error.
  huella text not null check (char_length(huella) between 8 and 64),
  mensaje text not null check (char_length(mensaje) <= 1000),
  pila text check (pila is null or char_length(pila) <= 4000),
  url text check (url is null or char_length(url) <= 500),
  ruta text check (ruta is null or char_length(ruta) <= 300),
  origen text not null default 'cliente' check (origen in ('cliente', 'servidor')),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  profile_id uuid references public.profiles(id) on delete set null,
  veces integer not null default 1 check (veces >= 1),
  -- El admin lo marca al arreglarlo; si vuelve a salir, se reabre solo.
  resuelto boolean not null default false,
  primera_vez timestamptz not null default now(),
  ultima_vez timestamptz not null default now()
);

create unique index if not exists uq_errores_app_huella on public.errores_app(huella);
create index if not exists idx_errores_app_ultima on public.errores_app(ultima_vez desc);
create index if not exists idx_errores_app_origen on public.errores_app(origen, ultima_vez desc);

alter table public.errores_app enable row level security;

-- Sin política de INSERT: ni anon ni authenticated pueden escribir aquí. Solo
-- el servidor, con la service role (que se salta la RLS), vía la función.
drop policy if exists "errores_app_select" on public.errores_app;
create policy "errores_app_select" on public.errores_app
  for select to authenticated using (public.is_admin());

drop policy if exists "errores_app_update" on public.errores_app;
create policy "errores_app_update" on public.errores_app
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "errores_app_delete" on public.errores_app;
create policy "errores_app_delete" on public.errores_app
  for delete to authenticated using (public.is_admin());

revoke all on public.errores_app from anon;
revoke insert on public.errores_app from authenticated;
grant select, update, delete on public.errores_app to authenticated;

-- Alta o suma: si la huella ya existe, +1 en `veces`, se refresca la última
-- vez y los datos del último caso (url, pila…) y se reabre si estaba resuelto.
-- Recorta aquí también: no se fía de que quien llama lo haya hecho.
create or replace function public.registrar_error_app(
  p_huella text,
  p_mensaje text,
  p_pila text default null,
  p_url text default null,
  p_ruta text default null,
  p_origen text default 'cliente',
  p_user_agent text default null,
  p_profile uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_huella is null or char_length(p_huella) < 8 or coalesce(btrim(p_mensaje), '') = '' then
    return;
  end if;
  -- Tope de errores DISTINTOS nuevos al día: alguien podría inventar
  -- mensajes sin fin. Los que ya existen siguen sumando veces.
  if not exists (select 1 from public.errores_app where huella = left(p_huella, 64))
     and (select count(*) from public.errores_app where primera_vez > now() - interval '1 day') >= 500 then
    return;
  end if;
  insert into public.errores_app as e (huella, mensaje, pila, url, ruta, origen, user_agent, profile_id)
  values (
    left(p_huella, 64),
    left(p_mensaje, 1000),
    left(p_pila, 4000),
    left(p_url, 500),
    left(p_ruta, 300),
    case when p_origen = 'servidor' then 'servidor' else 'cliente' end,
    left(p_user_agent, 400),
    -- Solo si el perfil existe: un id inventado no debe tumbar el registro.
    (select id from public.profiles where id = p_profile)
  )
  on conflict (huella) do update set
    veces = least(e.veces, 2000000000) + 1,
    ultima_vez = now(),
    url = coalesce(excluded.url, e.url),
    pila = coalesce(excluded.pila, e.pila),
    user_agent = coalesce(excluded.user_agent, e.user_agent),
    profile_id = coalesce(excluded.profile_id, e.profile_id),
    resuelto = false;
end; $$;

-- Solo el servidor. Si anon pudiera llamarla, cualquiera llenaría la tabla.
revoke all on function public.registrar_error_app(text, text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.registrar_error_app(text, text, text, text, text, text, text, uuid) to service_role;

-- Que PostgREST vea las tablas nuevas sin esperar.
notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- Aviso de cancelación a los apuntados: UNO por tardeo (la ruta lo marca).
alter table public.tardeos add column if not exists avisado_cancelacion_en timestamptz;

-- Funciones de lotes 50-55 que no tienen nada que hacer sin sesión. Por
-- dentro ya devuelven vacío a anon, pero mejor que ni se puedan llamar.
do $$
declare f text;
begin
  foreach f in array array[
    'public.inscritos_de_local(uuid)', 'public.metricas_de_local(uuid)',
    'public.metricas_por_tardeo(uuid, integer)', 'public.invitaciones_de_dj(uuid)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
end $$;


-- >>>>>>>>>>>>>>>>>>>> 58_invitacion_un_uso.sql <<<<<<<<<<<<<<<<<<<<
-- =========================================================
-- TardeosClub · LOTE 58: una invitación solo se usa una vez
-- Aplicar en Supabase → SQL Editor, después del Lote 57. Se puede pegar más
-- de una vez sin romper nada (solo redefine una función).
--
-- Por qué: `invitaciones.usada_por` tiene `on delete set null`. Si la cuenta
-- que reclamó la ficha se borra, `usada_por` vuelve a null y la invitación
-- parecía sin usar: el mismo enlace servía otra vez. `usada_en` no se borra
-- nunca, así que es la marca fiable de «ya usada».
--
-- Es la función del Lote 10 tal cual, con dos cambios:
--   1) también rechaza si `usada_en is not null`;
--   2) `for update` al leer la invitación, para que dos personas que abran el
--      mismo enlace a la vez no la gasten las dos.
-- =========================================================

create or replace function public.reclamar_invitacion(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  inv      public.invitaciones;
  v_uid    uuid := auth.uid();
  v_nombre text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Entra con tu cuenta para reclamar la ficha.');
  end if;

  select * into inv from public.invitaciones where token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Esta invitación no existe.');
  end if;
  -- `usada_en` además de `usada_por`: ver la cabecera del lote.
  if inv.usada_por is not null or inv.usada_en is not null then
    return jsonb_build_object('ok', false, 'error', 'Esta invitación ya se ha usado.');
  end if;
  if inv.expira_en < now() then
    return jsonb_build_object('ok', false, 'error', 'Esta invitación ha caducado. Pide una nueva.');
  end if;

  -- El 'is null' del where es lo que evita robar una ficha que ya tiene dueño,
  -- aunque alguien reutilice un enlace antiguo.
  if inv.tipo = 'local' then
    update public.locales set owner_id = v_uid
      where id = inv.ficha_id and owner_id is null
      returning nombre into v_nombre;
  else
    update public.djs set profile_id = v_uid
      where id = inv.ficha_id and profile_id is null
      returning nombre_artistico into v_nombre;
  end if;

  if v_nombre is null then
    return jsonb_build_object('ok', false, 'error', 'Esta ficha ya tiene dueño.');
  end if;

  update public.invitaciones
     set usada_por = v_uid, usada_en = now()
   where id = inv.id;

  return jsonb_build_object('ok', true, 'tipo', inv.tipo, 'nombre', v_nombre);
end; $$;

-- Igual que en el Lote 10: anónimo no.
revoke all on function public.reclamar_invitacion(text) from public, anon;
grant execute on function public.reclamar_invitacion(text) to authenticated;


-- >>>>>>>>>>>>>>>>>>>> 59_avisos_seguridad.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> 60_funciones_privadas.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> 61_rendimiento_rls.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> 62_tablas_internas.sql <<<<<<<<<<<<<<<<<<<<
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
