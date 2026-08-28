-- =========================================================
-- TardeosClub · LOTE 33: PLANES DE SUSCRIPCIÓN
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- La base para cobrar, ANTES de elegir por dónde se cobra. Sin esto, integrar
-- PayPal no sirve de nada: cobrarías y el cobro no cambiaría nada en la app.
--
-- A propósito NO hay nada de PayPal aquí dentro. `pago_proveedor` y
-- `pago_referencia` son dos campos genéricos: si mañana es Stripe, o un
-- recibo domiciliado, o una transferencia, cabe igual. Meter el vocabulario de
-- un proveedor en el esquema es lo que obliga a migrar la base el día que se
-- cambia de proveedor.
--
-- Los primeros veinte locales se marcan A MANO desde /admin/suscripciones. Con
-- ese volumen la comisión es calderilla y lo caro es el tiempo; automatizar el
-- alta y la baja tiene sentido a partir de treinta.
-- =========================================================

-- basic | pro | premium | fundador
-- Todo el mundo empieza en basic: es el nivel de "estar", no un castigo.
alter table public.locales add column if not exists plan text not null default 'basic'
  check (plan in ('basic', 'pro', 'premium', 'fundador'));

-- Si está al corriente. Separado del plan a propósito: un local que no paga
-- este mes NO baja de plan, se queda en el suyo con la suscripción en 'impago'.
-- Fundirlo todo en una columna obliga a recordar a qué plan volver cuando pague.
alter table public.locales add column if not exists plan_estado text not null default 'sin_suscripcion'
  check (plan_estado in ('sin_suscripcion', 'activa', 'impago', 'cancelada'));

alter table public.locales add column if not exists plan_desde timestamptz;
-- Hasta cuándo está pagado. Sirve para la condición de Fundador (40 € los dos
-- primeros meses y luego 30) y para saber cuándo toca cobrar otra vez.
alter table public.locales add column if not exists plan_hasta timestamptz;

-- Por dónde se cobra y con qué referencia allí. Texto libre los dos: hoy será
-- 'paypal' y el id de su suscripción; mañana puede ser 'transferencia' y el
-- número de factura.
alter table public.locales add column if not exists pago_proveedor text;
alter table public.locales add column if not exists pago_referencia text;

-- Notas del admin sobre la suscripción: lo hablado, lo prometido, lo pendiente.
alter table public.locales add column if not exists plan_notas text;

create index if not exists idx_locales_plan on public.locales(plan, plan_estado);

-- `plan` es PÚBLICO a propósito: la app tiene que poder decidir si enseña el
-- logo o el sello sin estar autenticada. Es un nivel de servicio, no un dato
-- personal. El resto —estado, fechas, proveedor, referencia, notas— NO se
-- concede: eso es información comercial y no tiene por qué verla un visitante.
--
-- `locales` va con permisos columna a columna desde el lote 14: sin este grant
-- la columna nace invisible y la app se quedaría sin saber el plan de nadie.
grant select (plan) on public.locales to anon;
grant select (plan) on public.locales to authenticated;

-- Lo mismo para los DJs, que también tendrán su propia tarifa más adelante.
alter table public.djs add column if not exists plan text not null default 'basic'
  check (plan in ('basic', 'pro', 'premium', 'fundador'));
alter table public.djs add column if not exists plan_estado text not null default 'sin_suscripcion'
  check (plan_estado in ('sin_suscripcion', 'activa', 'impago', 'cancelada'));
alter table public.djs add column if not exists plan_desde timestamptz;
alter table public.djs add column if not exists plan_hasta timestamptz;
alter table public.djs add column if not exists pago_proveedor text;
alter table public.djs add column if not exists pago_referencia text;
alter table public.djs add column if not exists plan_notas text;

grant select (plan) on public.djs to anon;
grant select (plan) on public.djs to authenticated;

-- OJO: el plan solo lo cambia un admin. La política `locales_update` deja
-- escribir al dueño, así que sin esto un local se sube a Fundador él solo.
-- Mismo patrón que `proteger_tardeos` con el destacado (lote 9).
create or replace function public.proteger_plan()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'UPDATE' then
    new.plan := old.plan;
    new.plan_estado := old.plan_estado;
    new.plan_desde := old.plan_desde;
    new.plan_hasta := old.plan_hasta;
    new.pago_proveedor := old.pago_proveedor;
    new.pago_referencia := old.pago_referencia;
    new.plan_notas := old.plan_notas;
  else
    new.plan := 'basic';
    new.plan_estado := 'sin_suscripcion';
    new.plan_desde := null; new.plan_hasta := null;
    new.pago_proveedor := null; new.pago_referencia := null; new.plan_notas := null;
  end if;
  return new;
end; $$;

drop trigger if exists trg_proteger_plan_locales on public.locales;
create trigger trg_proteger_plan_locales before insert or update on public.locales
  for each row execute function public.proteger_plan();

drop trigger if exists trg_proteger_plan_djs on public.djs;
create trigger trg_proteger_plan_djs before insert or update on public.djs
  for each row execute function public.proteger_plan();

notify pgrst, 'reload schema';
