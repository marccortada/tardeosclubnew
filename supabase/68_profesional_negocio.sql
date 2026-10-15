-- =============================================================
-- TardeosClub · LOTE 68: PROFESIONAL Y NEGOCIO (dossier 14‑oct, págs. 11‑14 y 16)
-- =============================================================
-- Equipo E. Idempotente, no borra datos. Todo lo que cobra sigue APAGADO:
--   · cupos por ciclo: solo bloquean con ajustes.planes_activos = 'true'
--   · Coins: solo se reservan con ajustes.coins_activos = 'true'
-- Sin pasarela: las recargas las apunta un admin a mano (con referencia única).
--
--  1) Duplicados: posibles_duplicados() antes de crear un tardeo.
--  2) Cupos por ciclo (Basic 1 · Pro 2 · Premium/Fundador ilimitado), ciclo
--     mensual desde el alta; bloqueo al publicar SOLO con planes activos.
--     Promociones: Basic 0 · Pro 2 a la vez · Premium una por evento.
--     Fundadores: máximo 50.
--  3) Coins: libro contable inmutable `coins_movimientos` + `coins_reservas`
--     + catálogo `coins_servicios`; saldos SIEMPRE calculados.
--  4) Canje real de promociones: `promo_canjes` + canjear_promocion() con
--     bloqueo de fila (dos canjes a la vez no pasan del límite).
--  5) DJ ↔ evento: `dj_solicitudes` (vínculo a evento existente, que aprueba
--     el organizador; propuesta de evento nuevo, que revisa el equipo).
--     DJ provisional creado por un organizador (queda para revisión).
--  6) Incidencias con referencia y borrador ("Necesito ayuda" al publicar).
--  7) Métricas del local por canal (entrada/lista/WhatsApp/Instagram/web…).
-- =============================================================

create schema if not exists private;

-- ---------------------------------------------------------------
-- 0) Ajuste nuevo: coins_activos (apagado). planes_activos ya existe.
-- ---------------------------------------------------------------
insert into public.ajustes (clave, valor) values ('coins_activos', 'false')
on conflict (clave) do nothing;

create or replace function private.ajuste_activo(p_clave text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select valor = 'true' from public.ajustes where clave = p_clave), false);
$$;
revoke execute on function private.ajuste_activo(text) from public;
grant execute on function private.ajuste_activo(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------
-- 1) DUPLICADOS
-- ---------------------------------------------------------------
-- Normaliza un título: minúsculas, sin tildes, sin signos y sin palabras de
-- relleno ("tardeo", "dj", "con", "de"…). Así "Tardeo Remember con DJ Nando"
-- y "remember nando" se reconocen como el mismo.
create or replace function private.normalizar_titulo(p text)
returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(
    ' ' || regexp_replace(
      lower(translate(coalesce(p, ''), 'ÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑÇáéíóúàèìòùäëïöüñç', 'AEIOUAEIOUAEIOUNCaeiouaeiouaeiounc')),
      '[^a-z0-9]+', ' ', 'g') || ' ',
    ' (tardeo|tardeos|dj|djs|con|de|del|la|el|los|las|en|y|the|party|fiesta|edicion) ', ' ', 'g'));
$$;

-- Parecido = mismo título normalizado, uno contiene al otro, o comparten al
-- menos la mitad de las palabras (del más corto).
create or replace function private.titulos_parecidos(a text, b text)
returns boolean language sql immutable set search_path = public as $$
  with x as (select private.normalizar_titulo(a) na, private.normalizar_titulo(b) nb),
  w as (
    select na, nb,
      (select array_agg(distinct p) from unnest(string_to_array(regexp_replace(na, ' +', ' ', 'g'), ' ')) p where length(p) > 1) wa,
      (select array_agg(distinct p) from unnest(string_to_array(regexp_replace(nb, ' +', ' ', 'g'), ' ')) p where length(p) > 1) wb
    from x)
  select case
    when na = '' or nb = '' then false
    when na = nb or position(na in nb) > 0 or position(nb in na) > 0 then true
    when wa is null or wb is null then false
    else (select count(*) from unnest(wa) p where p = any(wb))::numeric
         / least(cardinality(wa), cardinality(wb)) >= 0.5
  end from w;
$$;

-- Tardeos que podrían ser el mismo: misma fecha, mismo local (o a <150 m) y
-- título parecido. Del propio local se ven todos los estados; de otros, solo
-- lo que ya es público. Nunca devuelve datos privados.
create or replace function private.posibles_duplicados(
  p_local uuid, p_fechas date[], p_titulo text,
  p_lat double precision default null, p_lng double precision default null,
  p_excluir uuid default null)
returns table (id uuid, titulo text, fecha date, hora_inicio time, estado text, local_nombre text, mismo_local boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.titulo, t.fecha, t.hora_inicio, t.estado, l.nombre, t.local_id = p_local
    from public.tardeos t
    join public.locales l on l.id = t.local_id
   where (select auth.uid()) is not null
     and t.fecha = any(p_fechas)
     and t.estado <> 'cancelado'
     and (p_excluir is null or t.id <> p_excluir)
     and (t.local_id = p_local
          or (p_lat is not null and p_lng is not null and t.lat is not null and t.lng is not null
              and abs(t.lat - p_lat) < 0.0014 and abs(t.lng - p_lng) < 0.0019))
     and (t.local_id = p_local and (public.owns_tardeo(p_local) or public.is_admin())
          or t.estado in ('publicado', 'programado', 'finalizado'))
     and private.titulos_parecidos(t.titulo, p_titulo)
   order by t.fecha, t.titulo
   limit 20;
$$;
revoke execute on function private.posibles_duplicados(uuid, date[], text, double precision, double precision, uuid) from public;
grant execute on function private.posibles_duplicados(uuid, date[], text, double precision, double precision, uuid) to authenticated, service_role;
create or replace function public.posibles_duplicados(
  p_local uuid, p_fechas date[], p_titulo text,
  p_lat double precision default null, p_lng double precision default null, p_excluir uuid default null)
returns table (id uuid, titulo text, fecha date, hora_inicio time, estado text, local_nombre text, mismo_local boolean)
language sql stable security invoker set search_path = public
as $$ select * from private.posibles_duplicados($1, $2, $3, $4, $5, $6) $$;
grant execute on function public.posibles_duplicados(uuid, date[], text, double precision, double precision, uuid) to authenticated;

-- ---------------------------------------------------------------
-- 2) CUPOS POR CICLO
-- ---------------------------------------------------------------
-- Ciclo mensual desde el alta (plan_desde; si no hay, el alta de la ficha).
-- Del 31 de enero: 28/29 feb, 31 mar… (se conserva el día de alta).
create or replace function private.ciclo_local(p_local uuid, p_ahora timestamptz default now())
returns table (inicio timestamptz, fin timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  v_ancla timestamptz;
  n int;
begin
  select coalesce(l.plan_desde, l.created_at) into v_ancla from public.locales l where l.id = p_local;
  if v_ancla is null then return; end if;
  if v_ancla > p_ahora then inicio := v_ancla; fin := v_ancla + interval '1 month'; return next; return; end if;
  n := (extract(year from age(p_ahora, v_ancla)) * 12 + extract(month from age(p_ahora, v_ancla)))::int;
  inicio := v_ancla + make_interval(months => n);
  if inicio > p_ahora then n := n - 1; inicio := v_ancla + make_interval(months => n); end if;
  fin := v_ancla + make_interval(months => n + 1);
  return next;
end $$;
revoke execute on function private.ciclo_local(uuid, timestamptz) from public;
grant execute on function private.ciclo_local(uuid, timestamptz) to authenticated, service_role;

-- Eventos incluidos por plan. NULL = sin límite. Un plan no vigente (impago,
-- cancelado, caducado) cae a Basic, nunca a cero.
create or replace function private.eventos_incluidos(p_plan text, p_estado text, p_hasta timestamptz)
returns int language sql immutable set search_path = public as $$
  select case
    when p_estado is distinct from 'activa' or (p_hasta is not null and p_hasta::date < (now() at time zone 'Europe/Madrid')::date) then 1
    when p_plan = 'pro' then 2
    when p_plan in ('premium', 'fundador') then null
    else 1 end;
$$;

-- Lo consumido en el ciclo: cada fecha publicada (o programada) creada en el
-- ciclo es un evento. Editar no crea filas, así que no consume. Más los
-- «eventos adicionales» comprados con Coins y vivos en el ciclo.
create or replace function private.cupo_local(p_local uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l record; c record; v_usados int; v_extra int; v_inc int; v_activos boolean;
begin
  if not (public.is_admin() or public.owns_tardeo(p_local)) then
    raise exception 'No es tu ficha' using errcode = '42501';
  end if;
  select * into l from public.locales where id = p_local;
  if not found then return null; end if;
  select * into c from private.ciclo_local(p_local);
  select count(*) into v_usados from public.tardeos t
   where t.local_id = p_local and t.estado in ('publicado', 'programado', 'finalizado')
     and t.created_at >= c.inicio and t.created_at < c.fin;
  select coalesce(count(*), 0) into v_extra from public.coins_reservas r
   where r.local_id = p_local and r.servicio = 'evento_adicional'
     and r.estado in ('pendiente', 'confirmada', 'entregada')
     and r.created_at >= c.inicio and r.created_at < c.fin;
  v_inc := private.eventos_incluidos(l.plan, l.plan_estado, l.plan_hasta);
  v_activos := private.ajuste_activo('planes_activos');
  return jsonb_build_object(
    'plan', l.plan, 'plan_estado', l.plan_estado, 'planes_activos', v_activos,
    'ciclo_inicio', c.inicio, 'ciclo_fin', c.fin,
    'incluidos', v_inc, 'extra', v_extra, 'usados', v_usados,
    'restantes', case when v_inc is null then null else greatest(v_inc + v_extra - v_usados, 0) end,
    'bloquea', v_activos and v_inc is not null);
end $$;
revoke execute on function private.cupo_local(uuid) from public;
grant execute on function private.cupo_local(uuid) to authenticated, service_role;
create or replace function public.cupo_local(p_local uuid)
returns jsonb language sql stable security invoker set search_path = public
as $$ select private.cupo_local($1) $$;
grant execute on function public.cupo_local(uuid) to authenticated;

-- Bloqueo en BASE al publicar (insert publicado/programado o paso de
-- borrador a publicado). Con planes apagados no hace nada. El admin no se
-- bloquea (publica en nombre de otros y decide él).
create or replace function private.tardeos_control_cupo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  l record; c record; v_usados int; v_extra int; v_inc int;
begin
  if not private.ajuste_activo('planes_activos') or public.is_admin() then return new; end if;
  if new.estado not in ('publicado', 'programado') then return new; end if;
  if tg_op = 'UPDATE' and old.estado in ('publicado', 'programado', 'finalizado') then return new; end if;
  select * into l from public.locales where id = new.local_id for update;  -- serializa publicaciones del mismo local
  v_inc := private.eventos_incluidos(l.plan, l.plan_estado, l.plan_hasta);
  if v_inc is null then return new; end if;
  select * into c from private.ciclo_local(new.local_id);
  select count(*) into v_usados from public.tardeos t
   where t.local_id = new.local_id and t.estado in ('publicado', 'programado', 'finalizado')
     and t.created_at >= c.inicio and t.created_at < c.fin and t.id <> new.id;
  select count(*) into v_extra from public.coins_reservas r
   where r.local_id = new.local_id and r.servicio = 'evento_adicional'
     and r.estado in ('pendiente', 'confirmada', 'entregada')
     and r.created_at >= c.inicio and r.created_at < c.fin;
  if v_usados + 1 > v_inc + v_extra then
    raise exception 'Has llegado al cupo de tu plan en este ciclo (% de %). Puedes guardarlo como borrador.', v_usados, v_inc + v_extra
      using errcode = 'P0001', hint = 'cupo';
  end if;
  return new;
end $$;
revoke execute on function private.tardeos_control_cupo() from public, anon, authenticated;

-- Promociones por plan: Basic ninguna, Pro 2 activas a la vez, Premium una por evento.
create or replace function private.promos_control_plan()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_local uuid; l record; v_n int; v_plan text;
begin
  if not private.ajuste_activo('planes_activos') or public.is_admin() or not new.activa then return new; end if;
  v_local := coalesce(new.local_id, (select t.local_id from public.tardeos t where t.id = new.tardeo_id));
  select * into l from public.locales where id = v_local for update;
  v_plan := case when l.plan_estado = 'activa' then l.plan else 'basic' end;
  if v_plan = 'basic' then
    raise exception 'El plan Basic no incluye promociones.' using errcode = 'P0001', hint = 'cupo';
  elsif v_plan = 'pro' then
    select count(*) into v_n from public.promociones p
      left join public.tardeos t on t.id = p.tardeo_id
     where coalesce(p.local_id, t.local_id) = v_local and p.id <> new.id and public.promo_vigente(p);
    if v_n >= 2 then raise exception 'El plan Pro permite 2 promociones activas a la vez.' using errcode = 'P0001', hint = 'cupo'; end if;
  elsif new.tardeo_id is not null then
    select count(*) into v_n from public.promociones p
     where p.tardeo_id = new.tardeo_id and p.id <> new.id and public.promo_vigente(p);
    if v_n >= 1 then raise exception 'Tu plan permite una promoción por evento.' using errcode = 'P0001', hint = 'cupo'; end if;
  end if;
  return new;
end $$;
revoke execute on function private.promos_control_plan() from public, anon, authenticated;

-- Fundadores: los 50 primeros locales.
create or replace function private.locales_control_fundador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.plan = 'fundador' and (tg_op = 'INSERT' or old.plan is distinct from 'fundador') then
    if (select count(*) from public.locales where plan = 'fundador' and id <> new.id) >= 50 then
      raise exception 'Ya hay 50 locales Fundadores: no quedan plazas.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
revoke execute on function private.locales_control_fundador() from public, anon, authenticated;

create or replace function private.plazas_fundador()
returns int language sql stable security definer set search_path = public as $$
  select greatest(50 - (select count(*) from public.locales where plan = 'fundador'), 0)::int;
$$;
revoke execute on function private.plazas_fundador() from public;
grant execute on function private.plazas_fundador() to anon, authenticated, service_role;
create or replace function public.plazas_fundador()
returns int language sql stable security invoker set search_path = public
as $$ select private.plazas_fundador() $$;
grant execute on function public.plazas_fundador() to anon, authenticated;

-- ---------------------------------------------------------------
-- 3) COINS
-- ---------------------------------------------------------------
create table if not exists public.coins_servicios (
  slug text primary key,
  nombre text not null,
  coste int,                       -- null = presupuesto aparte
  alcance text not null,
  solo_comprado boolean not null default false,  -- stories: no con Coins incluidos/regalados
  orden int not null default 0,
  activo boolean not null default true
);
alter table public.coins_servicios enable row level security;
grant select on public.coins_servicios to anon, authenticated;
drop policy if exists "coins_servicios_select" on public.coins_servicios;
create policy "coins_servicios_select" on public.coins_servicios for select using (true);

insert into public.coins_servicios (slug, nombre, coste, alcance, solo_comprado, orden) values
  ('evento_adicional', 'Evento adicional',      1,    'Basic/Pro: una fecha extra en el ciclo.', false, 1),
  ('promocion_pro',    'Promoción Pro extra',   3,    'Una oferta hasta su fin, máximo 30 días.', false, 2),
  ('destacado',        'Destacado',             5,    '72 h de rotación compartida en su zona.', false, 3),
  ('story_repost',     'Story / repost',        5,    'Una pieza lista; sin edición.', true, 4),
  ('story_adaptada',   'Story adaptada',        15,   'Plantilla, texto breve, una revisión y publicación.', true, 5),
  ('popup_adn',        'Pop-up ADN',            5,    'Hasta 72 h; zona/preferencias; una vez por persona.', false, 6),
  ('inicio_patrocinado','Inicio patrocinado',   10,   '24 h de rotación compartida.', false, 7),
  ('reel_campana',     'Reel / grabación / campaña', null, 'Entregables, revisiones y fecha definidos aparte.', true, 8)
on conflict (slug) do nothing;

create table if not exists public.coins_reservas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locales(id) on delete cascade,
  servicio text not null references public.coins_servicios(slug),
  coste int not null check (coste >= 0),
  tardeo_id uuid references public.tardeos(id) on delete set null,
  detalle text check (char_length(detalle) <= 1000),
  -- De qué bolsa salió cada Coin: la devolución vuelve EXACTAMENTE ahí.
  desglose jsonb not null default '{}'::jsonb,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'confirmada', 'en_curso', 'entregada', 'cancelada', 'rechazada')),
  resultado text check (char_length(resultado) <= 2000),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resuelta_en timestamptz
);
create index if not exists idx_coins_reservas_local on public.coins_reservas (local_id, created_at desc);
create index if not exists idx_coins_reservas_estado on public.coins_reservas (estado, created_at);
create index if not exists idx_fk_coins_reservas_tardeo on public.coins_reservas (tardeo_id);
create index if not exists idx_fk_coins_reservas_servicio on public.coins_reservas (servicio);
create index if not exists idx_fk_coins_reservas_created_by on public.coins_reservas (created_by);
alter table public.coins_reservas enable row level security;
grant select on public.coins_reservas to authenticated;
drop policy if exists "coins_reservas_select" on public.coins_reservas;
create policy "coins_reservas_select" on public.coins_reservas for select to authenticated
  using ((select public.is_admin()) or public.owns_tardeo(local_id));
-- Escrituras SOLO por funciones (sin grants de insert/update/delete).

create table if not exists public.coins_movimientos (
  id bigint generated always as identity primary key,
  local_id uuid not null references public.locales(id) on delete restrict,
  tipo text not null check (tipo in ('compra', 'promocional_mensual', 'bono_fundador', 'protegido', 'consumo', 'devolucion', 'ajuste')),
  bolsa text not null check (bolsa in ('comprado', 'promocional', 'fundador', 'protegido')),
  importe int not null check (importe <> 0),
  saldo_bolsa int not null check (saldo_bolsa >= 0),    -- saldo de ESA bolsa tras el movimiento
  referencia text check (char_length(referencia) <= 200),  -- nº de pago, «alta», mes «2026-10»…
  reserva_id uuid references public.coins_reservas(id) on delete restrict,
  motivo text check (char_length(motivo) <= 500),
  actor uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_coins_mov_local on public.coins_movimientos (local_id, id desc);
create index if not exists idx_fk_coins_mov_reserva on public.coins_movimientos (reserva_id);
create index if not exists idx_fk_coins_mov_actor on public.coins_movimientos (actor);
-- Recarga / bono / mensualidad: una sola vez por referencia (no hay doble abono).
create unique index if not exists uq_coins_mov_referencia on public.coins_movimientos (local_id, tipo, referencia)
  where referencia is not null and tipo in ('compra', 'promocional_mensual', 'bono_fundador');
-- Bono Fundador: una vez en la vida del local.
create unique index if not exists uq_coins_bono_fundador on public.coins_movimientos (local_id) where tipo = 'bono_fundador';
-- Una reserva se cobra una vez por bolsa y se devuelve una vez por bolsa.
create unique index if not exists uq_coins_mov_reserva on public.coins_movimientos (reserva_id, tipo, bolsa) where reserva_id is not null;

alter table public.coins_movimientos enable row level security;
grant select on public.coins_movimientos to authenticated;
drop policy if exists "coins_mov_select" on public.coins_movimientos;
create policy "coins_mov_select" on public.coins_movimientos for select to authenticated
  using ((select public.is_admin()) or public.owns_tardeo(local_id));

-- Inmutable: ni el admin edita ni borra un apunte. Se corrige con otro apunte.
create or replace function private.coins_inmutable()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'El libro de Coins no se edita ni se borra: añade un ajuste.' using errcode = '42501';
end $$;
revoke execute on function private.coins_inmutable() from public, anon, authenticated;
drop trigger if exists trg_coins_inmutable on public.coins_movimientos;
create trigger trg_coins_inmutable before update or delete on public.coins_movimientos
  for each row execute function private.coins_inmutable();

-- Saldo de una bolsa = suma de sus apuntes. El bono Fundador solo vale 2 meses
-- desde que se abonó; pasado eso se presenta a 0 (el apunte sigue ahí).
create or replace function private.coins_saldo_bolsa(p_local uuid, p_bolsa text)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(importe), 0)::int from public.coins_movimientos where local_id = p_local and bolsa = p_bolsa;
$$;
revoke execute on function private.coins_saldo_bolsa(uuid, text) from public, anon, authenticated;

create or replace function private.coins_saldos(p_local uuid)
returns table (bolsa text, saldo int, caduca timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_bono timestamptz;
begin
  if not (public.is_admin() or public.owns_tardeo(p_local)) then raise exception 'No es tu ficha' using errcode = '42501'; end if;
  select min(created_at) into v_bono from public.coins_movimientos where local_id = p_local and tipo = 'bono_fundador';
  return query
    select b.bolsa,
      case when b.bolsa = 'fundador' and v_bono is not null and v_bono + interval '2 months' < now() then 0
           else private.coins_saldo_bolsa(p_local, b.bolsa) end,
      case when b.bolsa = 'fundador' and v_bono is not null then v_bono + interval '2 months' else null end
    from (values ('comprado'), ('promocional'), ('fundador'), ('protegido')) b(bolsa);
end $$;
revoke execute on function private.coins_saldos(uuid) from public;
grant execute on function private.coins_saldos(uuid) to authenticated, service_role;
create or replace function public.coins_saldos(p_local uuid)
returns table (bolsa text, saldo int, caduca timestamptz)
language sql stable security invoker set search_path = public
as $$ select * from private.coins_saldos($1) $$;
grant execute on function public.coins_saldos(uuid) to authenticated;

-- Apunte interno (calcula el saldo resultante). Llamar con la fila del local bloqueada.
create or replace function private.coins_apuntar(p_local uuid, p_tipo text, p_bolsa text, p_importe int,
  p_referencia text, p_reserva uuid, p_motivo text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_saldo int; v_id bigint;
begin
  v_saldo := private.coins_saldo_bolsa(p_local, p_bolsa) + p_importe;
  if v_saldo < 0 then raise exception 'Saldo insuficiente en la bolsa %', p_bolsa using errcode = 'P0001'; end if;
  insert into public.coins_movimientos (local_id, tipo, bolsa, importe, saldo_bolsa, referencia, reserva_id, motivo)
  values (p_local, p_tipo, p_bolsa, p_importe, v_saldo, p_referencia, p_reserva, p_motivo)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function private.coins_apuntar(uuid, text, text, int, text, uuid, text) from public, anon, authenticated;

-- RESERVAR un servicio: descuenta UNA vez, en orden promocional → fundador →
-- protegido → comprado (primero lo que caduca). Las stories solo con comprado
-- o protegido (dossier pág. 13: incluidos/regalados solo dentro de la app).
create or replace function private.coins_reservar(p_local uuid, p_servicio text, p_tardeo uuid default null, p_detalle text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s record; v_res uuid; v_falta int; v_disp int; v_toma int; v_desglose jsonb := '{}'::jsonb; b text;
  v_orden text[];
begin
  if not (public.is_admin() or public.owns_tardeo(p_local)) then raise exception 'No es tu ficha' using errcode = '42501'; end if;
  if not private.ajuste_activo('coins_activos') then raise exception 'Los Coins están desactivados por ahora.' using errcode = 'P0001'; end if;
  select * into s from public.coins_servicios where slug = p_servicio and activo;
  if not found then raise exception 'Servicio no disponible' using errcode = 'P0001'; end if;
  if s.coste is null then raise exception 'Este servicio va con presupuesto: escríbenos.' using errcode = 'P0001'; end if;
  if p_tardeo is not null and not exists (select 1 from public.tardeos where id = p_tardeo and local_id = p_local) then
    raise exception 'Ese tardeo no es de esta ficha' using errcode = '42501';
  end if;
  if p_servicio <> 'evento_adicional' and coalesce(btrim(p_detalle), '') = '' and p_tardeo is null then
    raise exception 'Solicitud incompleta: di para qué evento o material es.' using errcode = 'P0001';
  end if;
  perform 1 from public.locales where id = p_local for update;   -- un descuento a la vez por local
  v_orden := case when s.solo_comprado then array['protegido', 'comprado'] else array['promocional', 'fundador', 'protegido', 'comprado'] end;
  v_falta := s.coste;
  insert into public.coins_reservas (local_id, servicio, coste, tardeo_id, detalle)
  values (p_local, p_servicio, s.coste, p_tardeo, nullif(btrim(p_detalle), '')) returning id into v_res;
  foreach b in array v_orden loop
    exit when v_falta = 0;
    select saldo into v_disp from private.coins_saldos(p_local) x where x.bolsa = b;
    v_toma := least(coalesce(v_disp, 0), v_falta);
    if v_toma > 0 then
      perform private.coins_apuntar(p_local, 'consumo', b, -v_toma, null, v_res, s.nombre);
      v_desglose := v_desglose || jsonb_build_object(b, v_toma);
      v_falta := v_falta - v_toma;
    end if;
  end loop;
  if v_falta > 0 then raise exception 'Saldo insuficiente: faltan % Coins.', v_falta using errcode = 'P0001'; end if;
  update public.coins_reservas set desglose = v_desglose where id = v_res;
  return v_res;
end $$;
revoke execute on function private.coins_reservar(uuid, text, uuid, text) from public;
grant execute on function private.coins_reservar(uuid, text, uuid, text) to authenticated, service_role;
create or replace function public.coins_reservar(p_local uuid, p_servicio text, p_tardeo uuid default null, p_detalle text default null)
returns uuid language sql security invoker set search_path = public
as $$ select private.coins_reservar($1, $2, $3, $4) $$;
grant execute on function public.coins_reservar(uuid, text, uuid, text) to authenticated;

-- CANCELAR antes de empezar: devolución íntegra al MISMO origen (bolsa a bolsa).
-- El local solo cancela lo pendiente; el admin, también lo confirmado.
create or replace function private.coins_cancelar(p_reserva uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record; b text; v int;
begin
  select * into r from public.coins_reservas where id = p_reserva for update;
  if not found then raise exception 'Reserva no encontrada' using errcode = 'P0001'; end if;
  if not (public.is_admin() or (public.owns_tardeo(r.local_id) and r.estado = 'pendiente')) then
    raise exception 'No puedes cancelar esta reserva' using errcode = '42501';
  end if;
  if r.estado not in ('pendiente', 'confirmada') then
    raise exception 'Ya no se puede cancelar: el trabajo está en curso o terminado.' using errcode = 'P0001';
  end if;
  perform 1 from public.locales where id = r.local_id for update;
  for b, v in select key, value::int from jsonb_each_text(r.desglose) loop
    if v > 0 then perform private.coins_apuntar(r.local_id, 'devolucion', b, v, null, r.id, coalesce(p_motivo, 'Cancelación')); end if;
  end loop;
  update public.coins_reservas set estado = 'cancelada', resuelta_en = now(),
    resultado = coalesce(nullif(btrim(p_motivo), ''), resultado) where id = r.id;
  if public.is_admin() then
    perform private.auditar('coins_cancelar', 'coins_reserva', r.id::text, null, jsonb_build_object('motivo', p_motivo, 'desglose', r.desglose));
  end if;
end $$;
revoke execute on function private.coins_cancelar(uuid, text) from public;
grant execute on function private.coins_cancelar(uuid, text) to authenticated, service_role;
create or replace function public.coins_cancelar(p_reserva uuid, p_motivo text default null)
returns void language sql security invoker set search_path = public
as $$ select private.coins_cancelar($1, $2) $$;
grant execute on function public.coins_cancelar(uuid, text) to authenticated;

-- El equipo mueve la reserva: confirmada → en_curso → entregada (con resultado).
-- Rechazar = cancelar con devolución (usar coins_cancelar).
create or replace function private.coins_admin_estado(p_reserva uuid, p_estado text, p_resultado text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador' using errcode = '42501'; end if;
  if p_estado not in ('confirmada', 'en_curso', 'entregada') then raise exception 'Estado no válido' using errcode = 'P0001'; end if;
  update public.coins_reservas set estado = p_estado,
    resultado = coalesce(nullif(btrim(p_resultado), ''), resultado),
    resuelta_en = case when p_estado = 'entregada' then now() else resuelta_en end
   where id = p_reserva and estado in ('pendiente', 'confirmada', 'en_curso');
  if not found then raise exception 'La reserva no está en un estado que se pueda cambiar' using errcode = 'P0001'; end if;
  perform private.auditar('coins_estado', 'coins_reserva', p_reserva::text, null, jsonb_build_object('estado', p_estado, 'resultado', p_resultado));
end $$;
revoke execute on function private.coins_admin_estado(uuid, text, text) from public;
grant execute on function private.coins_admin_estado(uuid, text, text) to authenticated, service_role;
create or replace function public.coins_admin_estado(p_reserva uuid, p_estado text, p_resultado text default null)
returns void language sql security invoker set search_path = public
as $$ select private.coins_admin_estado($1, $2, $3) $$;
grant execute on function public.coins_admin_estado(uuid, text, text) to authenticated;

-- Abonos y ajustes del equipo (sin pasarela: recargas a mano con su referencia).
--  compra 10/25/50/100 → bolsa comprado (no caduca, se conserva tras baja)
--  promocional_mensual → bolsa promocional, tope 20 acumulado
--  bono_fundador 10 → bolsa fundador, una vez, vale 2 meses
--  protegido → bolsa protegido (saldo afectado sin disponibilidad)
--  ajuste ± → cualquier bolsa, con motivo obligatorio
create or replace function private.coins_admin_apunte(p_local uuid, p_tipo text, p_bolsa text, p_importe int,
  p_motivo text, p_referencia text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_saldo int; v_importe int := p_importe; v_bolsa text := p_bolsa;
begin
  if not public.is_admin() then raise exception 'Solo un administrador' using errcode = '42501'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Pon el motivo del apunte' using errcode = 'P0001'; end if;
  perform 1 from public.locales where id = p_local for update;
  if not found then raise exception 'Local no encontrado' using errcode = 'P0001'; end if;
  if p_tipo = 'compra' then
    if p_importe not in (10, 25, 50, 100) then raise exception 'Paquetes: 10, 25, 50 o 100 Coins' using errcode = 'P0001'; end if;
    if coalesce(btrim(p_referencia), '') = '' then raise exception 'Una recarga necesita la referencia del pago' using errcode = 'P0001'; end if;
    v_bolsa := 'comprado';
  elsif p_tipo = 'promocional_mensual' then
    v_bolsa := 'promocional';
    v_saldo := private.coins_saldo_bolsa(p_local, 'promocional');
    v_importe := least(p_importe, 20 - v_saldo);
    if v_importe <= 0 then raise exception 'El saldo promocional ya está en el tope de 20' using errcode = 'P0001'; end if;
  elsif p_tipo = 'bono_fundador' then
    v_bolsa := 'fundador'; v_importe := 10;
    if not exists (select 1 from public.locales where id = p_local and plan = 'fundador') then
      raise exception 'El bono es solo para locales Fundadores' using errcode = 'P0001';
    end if;
  elsif p_tipo = 'protegido' then
    v_bolsa := 'protegido';
    if p_importe <= 0 then raise exception 'Importe positivo' using errcode = 'P0001'; end if;
  elsif p_tipo <> 'ajuste' then
    raise exception 'Tipo no válido' using errcode = 'P0001';
  end if;
  begin
    v_id := private.coins_apuntar(p_local, p_tipo, v_bolsa, v_importe, nullif(btrim(p_referencia), ''), null, p_motivo);
  exception when unique_violation then
    -- Recarga con la misma referencia o bono ya dado: nunca se abona dos veces.
    raise exception 'Ese apunte ya existe (referencia repetida o bono ya entregado).' using errcode = 'P0001';
  end;
  perform private.auditar('coins_' || p_tipo, 'local', p_local::text, null,
    jsonb_build_object('bolsa', v_bolsa, 'importe', v_importe, 'motivo', p_motivo, 'referencia', p_referencia, 'movimiento', v_id));
  return v_id;
end $$;
revoke execute on function private.coins_admin_apunte(uuid, text, text, int, text, text) from public;
grant execute on function private.coins_admin_apunte(uuid, text, text, int, text, text) to authenticated, service_role;
create or replace function public.coins_admin_apunte(p_local uuid, p_tipo text, p_bolsa text, p_importe int,
  p_motivo text, p_referencia text default null)
returns bigint language sql security invoker set search_path = public
as $$ select private.coins_admin_apunte($1, $2, $3, $4, $5, $6) $$;
grant execute on function public.coins_admin_apunte(uuid, text, text, int, text, text) to authenticated;

-- ---------------------------------------------------------------
-- 4) CANJE DE PROMOCIONES
-- ---------------------------------------------------------------
create table if not exists public.promo_canjes (
  id uuid primary key default gen_random_uuid(),
  promocion_id uuid not null references public.promociones(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  codigo text,
  created_at timestamptz not null default now(),
  unique (promocion_id, profile_id)            -- una vez por persona
);
create index if not exists idx_fk_promo_canjes_profile on public.promo_canjes (profile_id);
alter table public.promo_canjes enable row level security;
grant select on public.promo_canjes to authenticated;
drop policy if exists "promo_canjes_select" on public.promo_canjes;
create policy "promo_canjes_select" on public.promo_canjes for select to authenticated
  using (profile_id = (select auth.uid())
         or exists (select 1 from public.promociones p where p.id = promocion_id
                    and public.puede_editar_promo(p.tardeo_id, p.local_id)));

-- Bloquea la fila de la promoción: dos canjes a la vez se ponen en cola y el
-- segundo ve los usos ya sumados (no se pasa del límite).
create or replace function private.canjear_promocion(p_promo uuid, p_codigo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p record; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Entra con tu cuenta para canjear' using errcode = '42501'; end if;
  select * into p from public.promociones where id = p_promo for update;
  if not found then raise exception 'Promoción no encontrada' using errcode = 'P0001'; end if;
  if not p.activa or (p.desde is not null and p.desde > now()) or (p.hasta is not null and p.hasta < now()) then
    raise exception 'Esta promoción no está vigente' using errcode = 'P0001';
  end if;
  if p.limite_usos is not null and p.usos >= p.limite_usos then
    raise exception 'Se han agotado los canjes de esta promoción' using errcode = 'P0001';
  end if;
  if p.codigo is not null and upper(btrim(coalesce(p_codigo, ''))) <> upper(btrim(p.codigo)) then
    raise exception 'El código no es correcto' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.promo_canjes where promocion_id = p_promo and profile_id = v_uid) then
    raise exception 'Ya has canjeado esta promoción' using errcode = 'P0001';
  end if;
  insert into public.promo_canjes (promocion_id, profile_id, codigo) values (p_promo, v_uid, p.codigo);
  update public.promociones set usos = usos + 1 where id = p_promo;
  return jsonb_build_object('ok', true, 'usos', p.usos + 1, 'limite', p.limite_usos, 'beneficio', p.beneficio, 'nombre', p.nombre);
end $$;
revoke execute on function private.canjear_promocion(uuid, text) from public;
grant execute on function private.canjear_promocion(uuid, text) to authenticated, service_role;
create or replace function public.canjear_promocion(p_promo uuid, p_codigo text default null)
returns jsonb language sql security invoker set search_path = public
as $$ select private.canjear_promocion($1, $2) $$;
grant execute on function public.canjear_promocion(uuid, text) to authenticated;

-- ---------------------------------------------------------------
-- 5) DJ ↔ EVENTO
-- ---------------------------------------------------------------
alter table public.djs add column if not exists provisional boolean not null default false;
alter table public.djs add column if not exists creado_por uuid references public.profiles(id) on delete set null;
create index if not exists idx_fk_djs_creado_por on public.djs (creado_por);
create index if not exists idx_djs_provisional on public.djs (provisional) where provisional;
grant select (provisional) on public.djs to anon, authenticated;

-- Un organizador escribe un DJ que no está en el directorio: se crea su ficha
-- PROVISIONAL (sin dueño, para revisión del equipo; el DJ la reclama después
-- con una invitación). Si ya existe con ese nombre, se devuelve esa.
create or replace function private.crear_dj_provisional(p_nombre text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n int; v_nombre text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
begin
  if not private.es_profesional() then raise exception 'Solo locales, organizadores y DJs' using errcode = '42501'; end if;
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 60 then raise exception 'Nombre de DJ no válido' using errcode = 'P0001'; end if;
  select id into v_id from public.djs
   where private.normalizar_titulo(nombre_artistico) = private.normalizar_titulo(v_nombre)
     and private.normalizar_titulo(v_nombre) <> '' limit 1;
  if v_id is not null then return v_id; end if;
  select count(*) into v_n from public.djs where creado_por = auth.uid() and created_at > now() - interval '1 day';
  if v_n >= 20 and not public.is_admin() then raise exception 'Has creado muchos DJs hoy. Escríbenos.' using errcode = 'P0001'; end if;
  insert into public.djs (nombre_artistico, provisional, creado_por) values (v_nombre, true, auth.uid()) returning id into v_id;
  return v_id;
end $$;
revoke execute on function private.crear_dj_provisional(text) from public;
grant execute on function private.crear_dj_provisional(text) to authenticated, service_role;
create or replace function public.crear_dj_provisional(p_nombre text)
returns uuid language sql security invoker set search_path = public
as $$ select private.crear_dj_provisional($1) $$;
grant execute on function public.crear_dj_provisional(text) to authenticated;

create table if not exists public.dj_solicitudes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('vinculo', 'propuesta')),
  dj_id uuid not null references public.djs(id) on delete cascade,
  tardeo_id uuid references public.tardeos(id) on delete cascade,
  -- Propuesta de evento nuevo: título, fecha, hora, lugar, enlace, nota.
  propuesta jsonb,
  mensaje text check (char_length(mensaje) <= 500),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'retirada')),
  nota_resolucion text check (char_length(nota_resolucion) <= 500),
  resuelta_por uuid references public.profiles(id) on delete set null,
  resuelta_en timestamptz,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint dj_sol_forma check (
    (tipo = 'vinculo' and tardeo_id is not null) or (tipo = 'propuesta' and propuesta is not null))
);
create unique index if not exists uq_dj_sol_pendiente on public.dj_solicitudes (dj_id, tardeo_id)
  where estado = 'pendiente' and tipo = 'vinculo';
create index if not exists idx_dj_sol_dj on public.dj_solicitudes (dj_id, created_at desc);
create index if not exists idx_dj_sol_cola on public.dj_solicitudes (tipo, estado, created_at);
create index if not exists idx_fk_dj_sol_tardeo on public.dj_solicitudes (tardeo_id);
create index if not exists idx_fk_dj_sol_resuelta on public.dj_solicitudes (resuelta_por);
create index if not exists idx_fk_dj_sol_created_by on public.dj_solicitudes (created_by);
alter table public.dj_solicitudes enable row level security;
grant select, insert on public.dj_solicitudes to authenticated;
drop policy if exists "dj_sol_select" on public.dj_solicitudes;
create policy "dj_sol_select" on public.dj_solicitudes for select to authenticated
  using (public.es_mi_dj(dj_id) or (tardeo_id is not null and public.gestiona_tardeo(tardeo_id)) or (select public.is_admin()));
drop policy if exists "dj_sol_insert" on public.dj_solicitudes;
create policy "dj_sol_insert" on public.dj_solicitudes for insert to authenticated
  with check (public.es_mi_dj(dj_id) and estado = 'pendiente' and resuelta_por is null and resuelta_en is null
              and (created_by is null or created_by = (select auth.uid())));

-- Resolver: el vínculo lo decide quien gestiona el tardeo (o admin); la
-- propuesta, el equipo. El DJ puede retirar la suya.
create or replace function private.resolver_solicitud_dj(p_id uuid, p_estado text, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s from public.dj_solicitudes where id = p_id for update;
  if not found then raise exception 'Solicitud no encontrada' using errcode = 'P0001'; end if;
  if s.estado <> 'pendiente' then raise exception 'Ya estaba resuelta' using errcode = 'P0001'; end if;
  if p_estado = 'retirada' then
    if not public.es_mi_dj(s.dj_id) then raise exception 'No es tuya' using errcode = '42501'; end if;
  elsif p_estado in ('aprobada', 'rechazada') then
    if s.tipo = 'vinculo' and not public.gestiona_tardeo(s.tardeo_id) then raise exception 'No gestionas ese tardeo' using errcode = '42501'; end if;
    if s.tipo = 'propuesta' and not public.is_admin() then raise exception 'Solo el equipo revisa propuestas' using errcode = '42501'; end if;
  else
    raise exception 'Estado no válido' using errcode = 'P0001';
  end if;
  update public.dj_solicitudes set estado = p_estado, nota_resolucion = nullif(btrim(p_nota), ''),
    resuelta_por = auth.uid(), resuelta_en = now() where id = p_id;
  if p_estado = 'aprobada' and s.tipo = 'vinculo' then
    insert into public.tardeo_djs (tardeo_id, dj_id) values (s.tardeo_id, s.dj_id) on conflict do nothing;
  end if;
  if public.is_admin() then
    perform private.auditar('solicitud_dj_' || p_estado, 'dj_solicitud', p_id::text, null, jsonb_build_object('tipo', s.tipo, 'nota', p_nota));
  end if;
end $$;
revoke execute on function private.resolver_solicitud_dj(uuid, text, text) from public;
grant execute on function private.resolver_solicitud_dj(uuid, text, text) to authenticated, service_role;
create or replace function public.resolver_solicitud_dj(p_id uuid, p_estado text, p_nota text default null)
returns void language sql security invoker set search_path = public
as $$ select private.resolver_solicitud_dj($1, $2, $3) $$;
grant execute on function public.resolver_solicitud_dj(uuid, text, text) to authenticated;

-- Bandeja del organizador: solicitudes de vínculo a SUS tardeos, con el nombre
-- del DJ y del tardeo (el tardeo puede estar en borrador).
create or replace function private.solicitudes_dj_de_local(p_local uuid)
returns table (id uuid, estado text, mensaje text, created_at timestamptz, dj_id uuid, dj_nombre text,
               dj_avatar text, tardeo_id uuid, titulo text, fecha date)
language sql stable security definer set search_path = public as $$
  select s.id, s.estado, s.mensaje, s.created_at, d.id, d.nombre_artistico, d.avatar_url, t.id, t.titulo, t.fecha
    from public.dj_solicitudes s
    join public.tardeos t on t.id = s.tardeo_id
    join public.djs d on d.id = s.dj_id
   where s.tipo = 'vinculo' and t.local_id = p_local
     and (public.is_admin() or public.owns_tardeo(p_local))
   order by (s.estado = 'pendiente') desc, s.created_at desc
   limit 100;
$$;
revoke execute on function private.solicitudes_dj_de_local(uuid) from public;
grant execute on function private.solicitudes_dj_de_local(uuid) to authenticated, service_role;
create or replace function public.solicitudes_dj_de_local(p_local uuid)
returns table (id uuid, estado text, mensaje text, created_at timestamptz, dj_id uuid, dj_nombre text,
               dj_avatar text, tardeo_id uuid, titulo text, fecha date)
language sql stable security invoker set search_path = public
as $$ select * from private.solicitudes_dj_de_local($1) $$;
grant execute on function public.solicitudes_dj_de_local(uuid) to authenticated;

-- ---------------------------------------------------------------
-- 6) INCIDENCIAS con referencia y borrador ("Necesito ayuda")
-- ---------------------------------------------------------------
alter table public.incidencias add column if not exists referencia text check (char_length(referencia) <= 200);
alter table public.incidencias add column if not exists borrador jsonb check (pg_column_size(borrador) <= 20000);

-- ---------------------------------------------------------------
-- 7) MÉTRICAS POR CANAL (panel del local, 7/30/90)
-- ---------------------------------------------------------------
create or replace function private.metricas_canales_local(p_local uuid, p_dias int default 30)
returns table (canal text, total bigint)
language sql stable security definer set search_path = public as $$
  select case e.tipo when 'clic_entrada' then 'entrada' when 'clic_lista' then 'lista'
                     else coalesce(nullif(e.detalle, ''), 'otro') end, count(*)
    from public.eventos_metrica e
    left join public.tardeos t on t.id = e.tardeo_id
   where e.tipo in ('clic_entrada', 'clic_lista', 'clic_contacto')
     and (e.local_id = p_local or t.local_id = p_local)
     and e.created_at >= now() - (greatest(p_dias, 1) || ' days')::interval
     and (public.is_admin() or public.owns_tardeo(p_local))
   group by 1;
$$;
revoke execute on function private.metricas_canales_local(uuid, int) from public;
grant execute on function private.metricas_canales_local(uuid, int) to authenticated, service_role;
create or replace function public.metricas_canales_local(p_local uuid, p_dias int default 30)
returns table (canal text, total bigint)
language sql stable security invoker set search_path = public
as $$ select * from private.metricas_canales_local($1, $2) $$;
grant execute on function public.metricas_canales_local(uuid, int) to authenticated;

-- ---------------------------------------------------------------
-- Disparadores (al final: usan tablas de arriba)
-- ---------------------------------------------------------------
drop trigger if exists trg_tardeos_control_cupo on public.tardeos;
create trigger trg_tardeos_control_cupo before insert or update of estado on public.tardeos
  for each row execute function private.tardeos_control_cupo();
drop trigger if exists trg_promos_control_plan on public.promociones;
create trigger trg_promos_control_plan before insert or update of activa on public.promociones
  for each row execute function private.promos_control_plan();
drop trigger if exists trg_locales_control_fundador on public.locales;
create trigger trg_locales_control_fundador before insert or update of plan on public.locales
  for each row execute function private.locales_control_fundador();

notify pgrst, 'reload schema';
