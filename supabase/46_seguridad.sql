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
