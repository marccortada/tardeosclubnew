-- PEGAR_LIMPIEZA · L0 a L8 de una vez (17-oct-2026). Cada paso es su propia transacción:
-- si uno falla se para ahí, lo anterior queda hecho y todo se puede volver a pegar.
-- Detalle de cada paso en LEEME.md. Copia de seguridad en tablas _bak_limpieza_* (L0).

-- ============================================================
-- L0 · Copia de seguridad (HAZLO PRIMERO)
-- Proyecto TardeosClub · limpieza de la migración doble · revisado 17-oct-2026
-- Copia en tablas _bak_limpieza_* todo lo que tocan L1-L7. Quedan ocultas (RLS sin
-- políticas). Para deshacer, se recupera de aquí. Se pueden borrar semanas después.
-- Seguro de repetir: si la copia ya existe, NO la pisa (la primera es la buena).

do $$
declare t text;
begin
  foreach t in array array['tardeos','locales','djs','profiles','eventos_metrica','metricas_tardeo'] loop
    if to_regclass('public._bak_limpieza_' || t) is null then
      execute format('create table public.%I as table public.%I', '_bak_limpieza_' || t, t);
      execute format('alter table public.%I enable row level security', '_bak_limpieza_' || t);
    end if;
  end loop;
end $$;

-- COMPROBACIÓN: cada copia debe tener las mismas filas que su tabla.
select 'tardeos' as tabla, (select count(*) from public._bak_limpieza_tardeos) as copia, (select count(*) from public.tardeos) as real
union all select 'locales', (select count(*) from public._bak_limpieza_locales), (select count(*) from public.locales)
union all select 'djs', (select count(*) from public._bak_limpieza_djs), (select count(*) from public.djs)
union all select 'profiles', (select count(*) from public._bak_limpieza_profiles), (select count(*) from public.profiles)
union all select 'eventos_metrica', (select count(*) from public._bak_limpieza_eventos_metrica), (select count(*) from public.eventos_metrica)
union all select 'metricas_tardeo', (select count(*) from public._bak_limpieza_metricas_tardeo), (select count(*) from public.metricas_tardeo);

-- ============================================================
-- L1 · Tardeos duplicados: fusionar, pasar sus métricas al gemelo y borrar las copias
-- Proyecto TardeosClub · limpieza de la migración doble · revisado 17-oct-2026
-- Cada copia (sin origen_id) tiene un gemelo bueno (origen_id = su id). Las copias traen la
-- hora desplazada 2 h, sin zona y publicadas aunque estuvieran ocultas, PERO guardan tipo
-- de evento, ambiente, público y dress code que el gemelo no tiene: se pasan ANTES.
-- De las copias cuelgan MÉTRICAS (visitas, clics) y, desde el 16-oct, 1 inscripción real
-- (alguien se apuntó a la copia publicada de «Fiesta Sevillanas»): todo pasa al gemelo.
-- Las que el gemelo ya tiene de la misma visita (misma sesión, tipo y día) se quitan:
-- contarían doble y además chocarían con el índice que evita duplicados.
-- Cualquier OTRA cosa que colgara (favoritos, Meet Zone, sorteos…) PARA todo.
-- Ejecutar DESPUÉS de L0. Todo o nada: si algo falla, no cambia nada.

begin;

-- El SQL Editor no tiene sesión de usuario: para la base no eres admin, y los disparadores
-- de protección (lotes 9, 19, 33, 37) DESHARÍAN EN SILENCIO los cambios de estado, orden de
-- destacados y planes. Esto marca la transacción como escritura del servidor (igual que la
-- service role) y solo dura hasta el commit.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Lo que va a pasar (léelo antes de seguir):
select (select count(*) from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null) as tardeos_a_borrar,
       (select count(*) from public.eventos_metrica where tardeo_id in (select d.id from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null)) as metricas_a_reasignar,
       (select count(*) from public.metricas_tardeo where tardeo_id in (select d.id from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null)) as contadores_a_sumar,
       (select count(*) from public.inscripciones where tardeo_id in (select d.id from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null)) as inscripciones_a_mover;

-- 1) Lo que solo tiene la copia pasa al gemelo bueno
update public.tardeos g set
  tipo_evento = coalesce(g.tipo_evento, d.tipo_evento),
  ambiente    = case when g.ambiente is null or cardinality(g.ambiente) = 0 then d.ambiente else g.ambiente end,
  publico     = case when g.publico  is null or cardinality(g.publico)  = 0 then d.publico  else g.publico  end,
  dress_code  = coalesce(g.dress_code, d.dress_code)
from public.tardeos d
where g.origen_id = d.id and d.origen_id is null;

-- 2) Métricas por evento: quitar las que ya tiene el gemelo (misma visita) y mover el resto
delete from public.eventos_metrica m
using public.tardeos d, public.tardeos g
where d.origen_id is null and g.origen_id = d.id and m.tardeo_id = d.id
  and m.dia is not null and coalesce(m.sesion, '') <> ''
  and exists (select 1 from public.eventos_metrica x
              where x.tardeo_id = g.id and x.sesion = m.sesion and x.tipo = m.tipo
                and coalesce(x.detalle, '') = coalesce(m.detalle, '') and x.dia = m.dia);

update public.eventos_metrica m set tardeo_id = g.id
from public.tardeos d, public.tardeos g
where d.origen_id is null and g.origen_id = d.id and m.tardeo_id = d.id;

-- 3) Contador de visitas (una fila por tardeo): se suma al del gemelo
insert into public.metricas_tardeo as mt (tardeo_id, visitas, updated_at)
select g.id, m.visitas, m.updated_at
from public.metricas_tardeo m
join public.tardeos d on d.id = m.tardeo_id and d.origen_id is null
join public.tardeos g on g.origen_id = d.id
on conflict (tardeo_id) do update
  set visitas = mt.visitas + excluded.visitas,
      updated_at = greatest(mt.updated_at, excluded.updated_at);
delete from public.metricas_tardeo where tardeo_id in (select d.id from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null);

-- 3b) Inscripciones: pasan al gemelo con su estado y su fecha (es la misma fiesta). Si la
-- persona ya estuviera apuntada también al gemelo, la de la copia se queda y la guarda de
-- abajo lo para todo: que lo decida una persona, no el script. Va con la marca de servidor
-- de arriba porque el lote 48 impide "mudar" una inscripción si no eres admin.
update public.inscripciones i set tardeo_id = g.id
from public.tardeos d, public.tardeos g
where d.origen_id is null and g.origen_id = d.id and i.tardeo_id = d.id
  and not exists (select 1 from public.inscripciones x where x.tardeo_id = g.id and x.profile_id = i.profile_id);

-- 4) Guarda: si cuelga cualquier otra cosa de una copia, se para TODO (nada se pierde)
do $g$
declare t record; n int; total int := 0; detalle text := '';
begin
  for t in select * from (values
    ('eventos_metrica','tardeo_id',null::text),
    ('metricas_tardeo','tardeo_id',null::text),
    ('favoritos','tardeo_id',null::text),
    ('inscripciones','tardeo_id',null::text),
    ('tardeo_djs','tardeo_id',null::text),
    ('clics_atribucion','tardeo_id',null::text),
    ('coins_reservas','tardeo_id',null::text),
    ('denuncias_flyer','tardeo_id',null::text),
    ('dj_invitaciones','tardeo_id',null::text),
    ('dj_solicitudes','tardeo_id',null::text),
    ('encuestas','tardeo_id',null::text),
    ('meet_fijado','tardeo_id',null::text),
    ('meet_mensajes','tardeo_id',null::text),
    ('promociones','tardeo_id',null::text),
    ('resenas','tardeo_id',null::text),
    ('sorteos','tardeo_id',null::text)
  ) as x(tabla, col, filtro)
  loop
    if to_regclass('public.' || t.tabla) is not null
       and exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = t.tabla and column_name = t.col) then
      execute format('select count(*) from public.%I where %I in (select d.id from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null) %s',
                     t.tabla, t.col, coalesce('and ' || t.filtro, '')) into n;
      if n > 0 then total := total + n; detalle := detalle || format(' %s.%s=%s', t.tabla, t.col, n); end if;
    end if;
  end loop;
  if total > 0 then
    raise exception 'Cuelgan % filas de tardeos duplicados que no son métricas: no se borra nada. Avisa. Detalle:%', total, detalle;
  end if;
end $g$;

-- 5) Borrar las copias
delete from public.tardeos d
using public.tardeos g
where d.origen_id is null and g.origen_id = d.id;

-- COMPROBACIÓN: 0 duplicados y ninguna métrica perdida (compárala con la copia de L0)
select (select count(*) from public.tardeos) as tardeos_ahora,
       (select count(*) from public.tardeos d join public.tardeos g on g.origen_id = d.id where d.origen_id is null) as duplicados_que_quedan,
       (select count(*) from public.eventos_metrica) as metricas_ahora,
       (select count(*) from public._bak_limpieza_eventos_metrica) as metricas_antes;

commit;

-- ============================================================
-- L2 · Locales duplicados: dueño, fotos y métricas al bueno; borrar las copias
-- Proyecto TardeosClub · limpieza de la migración doble · revisado 17-oct-2026
-- 59 locales existen dos veces: el bueno (origen_id) sin dueño y la copia (con el dueño).
-- Se pasa al bueno el dueño, las fotos, el orden de destacado y sus métricas.
-- OJO: borrar un local borra en cascada sus tardeos, CRM, coins y promociones; por eso hay
-- una guarda que PARA si algo distinto de métricas cuelga aún de una copia.
-- Ejecutar DESPUÉS de L1 (que se lleva los tardeos duplicados).

begin;

-- El SQL Editor no tiene sesión de usuario: para la base no eres admin, y los disparadores
-- de protección (lotes 9, 19, 33, 37) DESHARÍAN EN SILENCIO los cambios de estado, orden de
-- destacados y planes. Esto marca la transacción como escritura del servidor (igual que la
-- service role) y solo dura hasta el commit.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select (select count(*) from public.locales d join public.locales g on g.origen_id = d.id where d.origen_id is null) as locales_a_borrar,
       (select count(*) from public.eventos_metrica where local_id in (select d.id from public.locales d join public.locales g on g.origen_id = d.id where d.origen_id is null)) as metricas_a_reasignar;

-- 1) Dueño, fotos y orden de destacado pasan al bueno
update public.locales g set
  owner_id        = coalesce(g.owner_id, d.owner_id),
  fotos           = case when g.fotos is null or g.fotos = '[]'::jsonb then d.fotos else g.fotos end,
  destacado_orden = coalesce(g.destacado_orden, d.destacado_orden)
from public.locales d
where g.origen_id = d.id and d.origen_id is null;

-- 2) Métricas: quitar las repetidas (misma visita ya apuntada en el bueno) y mover el resto.
--    Si la métrica también lleva tardeo, su clave de duplicado es el tardeo y no choca.
delete from public.eventos_metrica m
using public.locales d, public.locales g
where d.origen_id is null and g.origen_id = d.id and m.local_id = d.id and m.tardeo_id is null
  and m.dia is not null and coalesce(m.sesion, '') <> ''
  and exists (select 1 from public.eventos_metrica x
              where x.local_id = g.id and x.tardeo_id is null and x.sesion = m.sesion and x.tipo = m.tipo
                and coalesce(x.detalle, '') = coalesce(m.detalle, '') and x.dia = m.dia);

update public.eventos_metrica m set local_id = g.id
from public.locales d, public.locales g
where d.origen_id is null and g.origen_id = d.id and m.local_id = d.id;

-- 3) Guarda
do $g$
declare t record; n int; total int := 0; detalle text := '';
begin
  for t in select * from (values
    ('tardeos','local_id',null::text),
    ('eventos_metrica','local_id',null::text),
    ('seguimiento_comercial','local_id',null::text),
    ('promociones','local_id',null::text),
    ('campanas','local_id',null::text),
    ('coins_movimientos','local_id',null::text),
    ('coins_reservas','local_id',null::text),
    ('resenas','objetivo_id',$$objetivo_tipo = 'local'$$),
    ('solicitudes_reclamacion','objetivo_id',$$tipo = 'local'$$),
    ('invitaciones','ficha_id',$$tipo = 'local'$$)
  ) as x(tabla, col, filtro)
  loop
    if to_regclass('public.' || t.tabla) is not null
       and exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = t.tabla and column_name = t.col) then
      execute format('select count(*) from public.%I where %I in (select d.id from public.locales d join public.locales g on g.origen_id = d.id where d.origen_id is null) %s',
                     t.tabla, t.col, coalesce('and ' || t.filtro, '')) into n;
      if n > 0 then total := total + n; detalle := detalle || format(' %s.%s=%s', t.tabla, t.col, n); end if;
    end if;
  end loop;
  if total > 0 then
    raise exception 'Cuelgan % filas de locales duplicados (¿falta L1?). No se borra nada. Detalle:%', total, detalle;
  end if;
end $g$;

-- 4) Borrar las copias
delete from public.locales d
using public.locales g
where d.origen_id is null and g.origen_id = d.id;

-- COMPROBACIÓN
select (select count(*) from public.locales) as locales_ahora,
       (select count(*) from public.locales d join public.locales g on g.origen_id = d.id where d.origen_id is null) as duplicados_que_quedan,
       (select count(*) from public.locales where origen_id is not null and owner_id is not null) as buenos_con_dueno;

commit;

-- ============================================================
-- L3 · DJs duplicados: cuenta y métricas al bueno; borrar las copias
-- Proyecto TardeosClub · limpieza de la migración doble · revisado 17-oct-2026
-- 30 DJs existen dos veces. Se pasa la cuenta (profile_id), el orden de destacado y sus
-- métricas al bueno y se borra la copia. NO se copia 'redes' de la copia: ahí la migración
-- antigua metió el teléfono como WhatsApp, y es público.
-- Ejecutar DESPUÉS de L1.

begin;

-- El SQL Editor no tiene sesión de usuario: para la base no eres admin, y los disparadores
-- de protección (lotes 9, 19, 33, 37) DESHARÍAN EN SILENCIO los cambios de estado, orden de
-- destacados y planes. Esto marca la transacción como escritura del servidor (igual que la
-- service role) y solo dura hasta el commit.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select (select count(*) from public.djs d join public.djs g on g.origen_id = d.id where d.origen_id is null) as djs_a_borrar,
       (select count(*) from public.eventos_metrica where dj_id in (select d.id from public.djs d join public.djs g on g.origen_id = d.id where d.origen_id is null)) as metricas_a_reasignar;

update public.djs g set
  profile_id      = coalesce(g.profile_id, d.profile_id),
  destacado_orden = coalesce(g.destacado_orden, d.destacado_orden)
from public.djs d
where g.origen_id = d.id and d.origen_id is null;

delete from public.eventos_metrica m
using public.djs d, public.djs g
where d.origen_id is null and g.origen_id = d.id and m.dj_id = d.id
  and m.tardeo_id is null and m.local_id is null
  and m.dia is not null and coalesce(m.sesion, '') <> ''
  and exists (select 1 from public.eventos_metrica x
              where x.dj_id = g.id and x.tardeo_id is null and x.local_id is null
                and x.sesion = m.sesion and x.tipo = m.tipo
                and coalesce(x.detalle, '') = coalesce(m.detalle, '') and x.dia = m.dia);

update public.eventos_metrica m set dj_id = g.id
from public.djs d, public.djs g
where d.origen_id is null and g.origen_id = d.id and m.dj_id = d.id;

do $g$
declare t record; n int; total int := 0; detalle text := '';
begin
  for t in select * from (values
    ('eventos_metrica','dj_id',null::text),
    ('tardeo_djs','dj_id',null::text),
    ('dj_contenidos','dj_id',null::text),
    ('dj_invitaciones','dj_id',null::text),
    ('dj_solicitudes','dj_id',null::text),
    ('dj_mensajes_ajustes','dj_id',null::text),
    ('bloqueos','dj_id',null::text),
    ('nexo_envios','dj_id',null::text),
    ('seguidores_dj','dj_id',null::text),
    ('sets','dj_id',null::text),
    ('solicitudes_mensaje','dj_id',null::text),
    ('resenas','objetivo_id',$$objetivo_tipo = 'dj'$$),
    ('solicitudes_reclamacion','objetivo_id',$$tipo = 'dj'$$),
    ('invitaciones','ficha_id',$$tipo = 'dj'$$)
  ) as x(tabla, col, filtro)
  loop
    if to_regclass('public.' || t.tabla) is not null
       and exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = t.tabla and column_name = t.col) then
      execute format('select count(*) from public.%I where %I in (select d.id from public.djs d join public.djs g on g.origen_id = d.id where d.origen_id is null) %s',
                     t.tabla, t.col, coalesce('and ' || t.filtro, '')) into n;
      if n > 0 then total := total + n; detalle := detalle || format(' %s.%s=%s', t.tabla, t.col, n); end if;
    end if;
  end loop;
  if total > 0 then
    raise exception 'Cuelgan % filas de DJs duplicados. No se borra nada. Detalle:%', total, detalle;
  end if;
end $g$;

delete from public.djs d
using public.djs g
where d.origen_id is null and g.origen_id = d.id;

select (select count(*) from public.djs) as djs_ahora,
       (select count(*) from public.djs d join public.djs g on g.origen_id = d.id where d.origen_id is null) as duplicados_que_quedan;

commit;

-- ============================================================
-- L4 · Que los dueños de la web antigua entren a SU ficha
-- Proyecto TardeosClub · limpieza de datos tras la migración doble · 14-oct-2026
-- PROBLEMA: de 263 perfiles solo 8 tienen cuenta real de acceso. Los dueños de locales y DJs
-- migrados son "perfiles fantasma": nadie puede entrar como ellos, así que no pueden gestionar
-- su ficha en la web nueva.
-- SOLUCIÓN: cuando alguien confirma su email (con Google, código por email o contraseña) y
-- ese email coincide con un perfil fantasma, se le pasan SUS fichas, favoritos e inscripciones.
-- NUNCA se traspasa el permiso de administrador.
-- Solo vincula con email CONFIRMADO, para que nadie robe una ficha registrándose con el
-- email de otro.
-- Ejecutar DESPUÉS de L2 y L3 (da igual el orden respecto a L1).


alter table public.profiles add column if not exists vinculado_a uuid;

-- Las funciones con privilegios viven en `private` (fuera de la API, regla del lote 60).
create schema if not exists private;

create or replace function private.vincular_cuenta_antigua(p_nuevo uuid, p_email text)
returns int
language plpgsql security definer set search_path = public, auth as $$
declare
  v_viejo record;
  r record;
  v_n int := 0;
begin
  if p_email is null or btrim(p_email) = '' then return 0; end if;

  -- Por si este trigger corre antes que el que crea el perfil
  insert into public.profiles (id, email, display_name)
  values (p_nuevo, p_email, split_part(p_email, '@', 1))
  on conflict (id) do nothing;

  for v_viejo in
    select p.id from public.profiles p
    where lower(p.email) = lower(p_email)
      and p.id <> p_nuevo
      and p.vinculado_a is null
      and not exists (select 1 from auth.users u where u.id = p.id)
  loop
    -- Todas las columnas que apuntan a un perfil (dueño de local, DJ, favoritos...)
    for r in
      select c.conrelid::regclass::text as tabla, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
        and array_length(c.conkey, 1) = 1
        and c.conrelid <> 'public.profiles'::regclass
    loop
      begin
        execute format('update %s set %I = $1 where %I = $2', r.tabla, r.col, r.col)
          using p_nuevo, v_viejo.id;
      exception when others then
        raise notice 'vincular_cuenta_antigua: % (%) -> %', r.tabla, r.col, sqlerrm;
      end;
    end loop;

    update public.profiles n set
      phone        = coalesce(n.phone, o.phone),
      display_name = coalesce(nullif(n.display_name, ''), o.display_name)
    from public.profiles o
    where n.id = p_nuevo and o.id = v_viejo.id;

    update public.profiles set vinculado_a = p_nuevo where id = v_viejo.id;
    v_n := v_n + 1;
  end loop;

  return v_n;
end $$;

revoke all on function private.vincular_cuenta_antigua(uuid, text) from public, anon, authenticated;

create or replace function private.vincular_cuenta_antigua_trg()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  perform private.vincular_cuenta_antigua(new.id, new.email);
  return new;
end $$;

revoke all on function private.vincular_cuenta_antigua_trg() from public, anon, authenticated;

drop trigger if exists trg_vincular_cuenta_antigua on auth.users;
create trigger trg_vincular_cuenta_antigua
  after insert or update of email_confirmed_at on auth.users
  for each row when (new.email_confirmed_at is not null)
  execute function private.vincular_cuenta_antigua_trg();

-- Cuentas que ya existen y están confirmadas (hoy son 8)
select u.email, private.vincular_cuenta_antigua(u.id, u.email) as perfiles_vinculados
from auth.users u where u.email_confirmed_at is not null;

-- COMPROBACIÓN
-- select count(*) from public.profiles where vinculado_a is not null;
-- select count(*) from public.locales where owner_id in (select id from auth.users);

-- ============================================================
-- L5 · Orden de destacados igual que en la web antigua
-- Proyecto TardeosClub · limpieza de datos tras la migración doble · 14-oct-2026
-- Replica la regla de la portada antigua: venues y DJs aprobados con "mostrar en portada",
-- por featured_order (los sin número, detrás) y en empate por antigüedad (locales) o
-- valoración (DJs). 38 locales y 16 DJs.
-- Esto SUSTITUYE el orden de destacados actual (hoy hay 7 locales con orden puesto a mano).
-- Los tardeos destacados de la antigua son todos de fechas pasadas: no se traducen.
-- Ejecutar DESPUÉS de L2 y L3.


begin;

-- El SQL Editor no tiene sesión de usuario: para la base no eres admin, y los disparadores
-- de protección (lotes 9, 19, 33, 37) DESHARÍAN EN SILENCIO los cambios de estado, orden de
-- destacados y planes. Esto marca la transacción como escritura del servidor (igual que la
-- service role) y solo dura hasta el commit.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

update public.locales set destacado_orden = null where destacado_orden is not null;
update public.djs     set destacado_orden = null where destacado_orden is not null;

update public.locales l set destacado_orden = v.n
from (values
  ('b81e8d10-de09-4684-8ab4-845d7f7dd1c2'::uuid, 1), -- ECLIPSE SOLAR 12/08/2026
  ('6400ff32-efa7-4d03-95b4-61c999ba1112'::uuid, 2), -- El Ritmo del Sonido
  ('0ad40370-17be-413e-8b8a-8326d5286bed'::uuid, 3), -- EL REENCUENTRO TARDEO
  ('d1c60c48-69ee-493d-92d3-e2f9c39b0ff1'::uuid, 4), -- GUATEKKE
  ('131ecfbd-be9d-4325-b5c8-6cfe34bf76ff'::uuid, 5), -- Tardeotgn
  ('27b99692-49e9-4421-ab55-d6776316b5fe'::uuid, 6), -- LAPIKKARA
  ('d71c4ac7-1ff3-4d5e-9b07-b1bccce3cdf4'::uuid, 7), -- BANDARRA REMEMBER FESTIVAL
  ('763dc240-cad4-4821-9eca-5191b0d73df4'::uuid, 8), -- M7
  ('2f096b7a-d7da-4f09-ad53-046ed7ca4c8a'::uuid, 9), -- Yclub
  ('57ea5034-8410-4835-8fd9-4dfeff348160'::uuid, 10), -- Level
  ('6d4be418-9e93-49f3-8e12-31cdf38d91b2'::uuid, 11), -- By Gemelos
  ('30df2082-85d7-4d4d-b5ac-1ee685711469'::uuid, 12), -- Nama_tardeo
  ('25a37905-2765-4ddb-a735-cf6e568fbbdb'::uuid, 13), -- La Coffee
  ('e5b86ad4-f083-41b8-8a96-85c44551aac4'::uuid, 14), -- FOREVER
  ('e60eea9a-acb2-4393-a14c-39228f0b6491'::uuid, 15), -- La Golosa
  ('44fd164c-d7fb-40d1-bbee-a5561bdbb7f4'::uuid, 16), -- Sugar Hits
  ('093ffe74-9dbd-4d95-b57e-d41f954b9d25'::uuid, 17), -- NADA ES LO QUE PARECE
  ('5f37f833-f9ca-4fa1-9cf2-309623b0a072'::uuid, 18), -- Sabana
  ('fe83158d-8bfc-40d4-881a-5c22ea27709e'::uuid, 19), -- VOLS FESTA
  ('440cd5e0-a2cb-465b-8f6e-d67021efa955'::uuid, 20), -- Beach Point Cambrils
  ('48e51e3b-5fa1-44a4-ae90-c390640ebaef'::uuid, 21), -- Lo SUBMARINO de Reus
  ('4959ff5e-b057-49db-aff1-4eed1db8dc92'::uuid, 22), -- Tomato Fest
  ('f2e49678-f3cc-46f9-841f-47edd6e6593e'::uuid, 23), -- Sevillanas Granollers
  ('1b776c3a-47f0-4d53-a50f-01234f875b46'::uuid, 24), -- Vermusic "Cicle Itinerant"
  ('6bf357ff-bce1-4bb3-ad09-393539222656'::uuid, 25), -- Undead Dark Club
  ('f849b2fd-f242-437d-9464-f9abc5166f1c'::uuid, 26), -- Magic
  ('2130f910-fdd3-46a2-b171-8397c7d839c7'::uuid, 27), -- Tardeos BE FREE
  ('3c8c719f-3845-4d5f-b68c-5ecd5ac2ba1b'::uuid, 28), -- La pepa
  ('f753fe06-b6a8-47ca-bc78-0c5e5ed9ab9a'::uuid, 29), -- Venice Club
  ('dd442760-3e1a-4696-be0f-b38be19ac872'::uuid, 30), -- Madison Club & Lounge
  ('a9a0bb42-4476-48ac-ae32-713c377f2616'::uuid, 31), -- Sala Vinilo
  ('2105511e-c5e5-431d-8d24-06dea478e9f5'::uuid, 32), -- Sala Panorama Tardeos
  ('1c871fd8-a347-43d3-a73d-ba367f79f895'::uuid, 33), -- Clerik & Lotura
  ('a91720fc-ce41-4967-9e8e-2c9f492097fe'::uuid, 34), -- My-Tardeos Granollers
  ('751f0836-0293-4957-8af1-29e5e253ceec'::uuid, 35), -- R E S E T  Festival
  ('7d572f4c-3822-416d-bdfa-b720fd92b64d'::uuid, 36), -- Club 55
  ('633e3ef6-a368-4024-936c-2833c59e3691'::uuid, 37), -- Tardeo 59
  ('7202da30-e36e-4ca1-821f-9a6b180b1ee8'::uuid, 38) -- Nova
) as v(origen, n)
where l.origen_id = v.origen;

update public.djs d set destacado_orden = v.n
from (values
  ('b1f721be-c927-42b0-aebf-f713421426ef'::uuid, 1), -- MAIK
  ('7c57c63d-de1c-4115-9e04-4fe39ddd5f55'::uuid, 2), -- VxBV
  ('14a2705a-ed74-49ec-9d19-0838e61ac851'::uuid, 3), -- DJ GLASS HAT
  ('852745fd-96cd-4ca6-8397-08564bd9ebc4'::uuid, 4), -- LÄINA
  ('65c2900a-1ba9-4743-937d-1611ac5846ed'::uuid, 5), -- Oscar Molina 
  ('de1b7bc7-cb8d-4e70-bd57-ab6549fd3caf'::uuid, 6), -- Fatima Kahlo
  ('38ff18b4-da89-479d-9624-13d3c38e092b'::uuid, 7), -- Basi de La Fuente
  ('448710cc-461e-4e2a-8b5a-c1b2953a4204'::uuid, 8), -- VANGELDEREN 
  ('167e245a-6c69-4dd9-8957-6fae7d2f9fdb'::uuid, 9), -- Joan Gel
  ('219240d6-bd64-44b6-a7a1-629253e64dac'::uuid, 10), -- Raúl Ayora
  ('2d28d3f2-a68b-4f90-8f05-0a79aea5cc00'::uuid, 11), -- MAYA
  ('81cf1419-c3e0-4dd5-8184-c410dbacb89f'::uuid, 12), -- Davwell
  ('2e2d99e2-f1ee-4211-b6bc-b803522b3885'::uuid, 13), -- Marcci Marcco
  ('b04b2900-f93e-4034-a723-bf383c1829d8'::uuid, 14), -- Kaballe
  ('fdfc6f70-61ae-4ab3-8f0f-e1ef185af777'::uuid, 15), -- oscarmovedj
  ('817b3856-4848-476e-b4d5-a38326da7493'::uuid, 16) -- IVANUR
) as v(origen, n)
where d.origen_id = v.origen;

-- COMPROBACIÓN: esperado 38 locales y 16 DJs con orden
select (select count(*) from public.locales where destacado_orden is not null) as locales_con_orden,
       (select count(*) from public.djs where destacado_orden is not null) as djs_con_orden;

commit;

-- ============================================================
-- L6 · Unificar nombres de zona (Mataró / Mataro / MATARO…)
-- Proyecto TardeosClub · limpieza de datos tras la migración doble · 14-oct-2026
-- 6 variantes se unifican a su forma correcta. Revisa la lista antes de ejecutar:
-- cada línea es  'lo que hay'  →  'lo que quedará'.
-- Ejecutar cuando quieras (no depende de los demás).


begin;

-- El SQL Editor no tiene sesión de usuario: para la base no eres admin, y los disparadores
-- de protección (lotes 9, 19, 33, 37) DESHARÍAN EN SILENCIO los cambios de estado, orden de
-- destacados y planes. Esto marca la transacción como escritura del servidor (igual que la
-- service role) y solo dura hasta el commit.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
update public.tardeos set zona = 'Barcelona' where zona = 'BARCELONA';
update public.locales set zona = 'Barcelona' where zona = 'BARCELONA'; -- BARCELONA → Barcelona
update public.tardeos set zona = 'Mataró' where zona = 'Mataro';
update public.locales set zona = 'Mataró' where zona = 'Mataro'; -- Mataro → Mataró
update public.tardeos set zona = 'Barberà del Vallès' where zona = 'barbera del valles';
update public.locales set zona = 'Barberà del Vallès' where zona = 'barbera del valles'; -- barbera del valles → Barberà del Vallès
update public.tardeos set zona = 'Barberà del Vallès' where zona = 'Barbera del Valles';
update public.locales set zona = 'Barberà del Vallès' where zona = 'Barbera del Valles'; -- Barbera del Valles → Barberà del Vallès
update public.tardeos set zona = 'Reus' where zona = 'REUS';
update public.locales set zona = 'Reus' where zona = 'REUS'; -- REUS → Reus
update public.tardeos set zona = 'Riudoms' where zona = 'RIUDOMS';
update public.locales set zona = 'Riudoms' where zona = 'RIUDOMS'; -- RIUDOMS → Riudoms

-- COMPROBACIÓN: zonas distintas que quedan
select count(distinct zona) as zonas_distintas from (select zona from public.tardeos union select zona from public.locales) z;

commit;

-- ============================================================
-- L7 · Estados: cancelados y tardeos ya pasados
-- Proyecto TardeosClub · limpieza de datos tras la migración doble · 14-oct-2026
-- 1) Propaga los eventos cancelados en la web antigua (la sincronización diaria nunca lo hizo).
-- 2) Marca como 'finalizado' los tardeos publicados cuya fecha ya pasó (hoy hay ~820 con
--    estado 'publicado' y fecha pasada). La web ya los oculta por fecha; esto lo deja limpio.
-- Ejecutar DESPUÉS de L1.


begin;

-- El SQL Editor no tiene sesión de usuario: para la base no eres admin, y los disparadores
-- de protección (lotes 9, 19, 33, 37) DESHARÍAN EN SILENCIO los cambios de estado, orden de
-- destacados y planes. Esto marca la transacción como escritura del servidor (igual que la
-- service role) y solo dura hasta el commit.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

update public.tardeos set estado = 'cancelado' where origen_id in ('24856ed5-cc33-4f2b-a3d2-e4de958632ed') and estado <> 'cancelado';

update public.tardeos set estado = 'finalizado'
where estado = 'publicado' and fecha < (now() at time zone 'Europe/Madrid')::date;

-- COMPROBACIÓN
select estado, count(*) from public.tardeos group by estado order by 2 desc;

commit;

-- ============================================================
-- L8 · Ocultar las fichas de prueba que hoy ve el público
-- Proyecto TardeosClub · 17-oct-2026
-- Las tres fichas que CLAUDE.md §11 da por pruebas (gnerai, Interdesign, localp) están
-- ACTIVAS y salen en el directorio, el mapa y con sus tardeos (13 en total). Se pasan a
-- 'oculto' (lote 43): no se borra nada y se deshace volviendo a 'activo'.
-- NO incluye "oletu" (sin dueño, 0 tardeos): no consta como prueba. Confírmalo antes.
-- Independiente del resto de la limpieza: se puede pegar cuando quieras.

begin;

-- El SQL Editor no tiene sesión de usuario: para la base no eres admin, y los disparadores
-- de protección (lotes 9, 19, 33, 37) DESHARÍAN EN SILENCIO los cambios de estado, orden de
-- destacados y planes. Esto marca la transacción como escritura del servidor (igual que la
-- service role) y solo dura hasta el commit.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Lo que hay antes (deben salir 3 filas 'activo')
select id, nombre, estado from public.locales
where id in ('97d322cf-5ad8-4804-a22a-b87492b9ec5c',  -- Interdesign
             'f9d432ec-8a3e-41a1-a7c1-a9cc3e6b1222',  -- localp
             '2512b4df-0e84-4849-9b19-9cd700827126'); -- gnerai

update public.locales set estado = 'oculto'
where id in ('97d322cf-5ad8-4804-a22a-b87492b9ec5c',
             'f9d432ec-8a3e-41a1-a7c1-a9cc3e6b1222',
             '2512b4df-0e84-4849-9b19-9cd700827126')
  and estado = 'activo';

-- COMPROBACIÓN: las 3 en 'oculto'
select nombre, estado from public.locales
where id in ('97d322cf-5ad8-4804-a22a-b87492b9ec5c',
             'f9d432ec-8a3e-41a1-a7c1-a9cc3e6b1222',
             '2512b4df-0e84-4849-9b19-9cd700827126');

commit;

-- Para deshacer:
-- update public.locales set estado = 'activo'
-- where id in ('97d322cf-5ad8-4804-a22a-b87492b9ec5c','f9d432ec-8a3e-41a1-a7c1-a9cc3e6b1222','2512b4df-0e84-4849-9b19-9cd700827126');
