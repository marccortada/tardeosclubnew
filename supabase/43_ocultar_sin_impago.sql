-- =========================================================
-- TardeosClub · LOTE 43: OCULTAR UNA FICHA SIN ACUSARLA DE NO PAGAR
-- Aplicar en Supabase → SQL Editor. SUSTITUYE al disparador del lote 41.
--
-- El lote 41 se quedó corto y, peor, rompía algo. La comprobación de estados
-- ya guardados devolvió esto:
--
--   miraclee · estado = 'oculto_impago' · plan_estado = 'sin_suscripcion'
--
-- No es un dato corrupto: es que `locales.estado` solo tiene TRES valores
-- —borrador, activo, oculto_impago— y el botón de ocultar del panel escribe
-- el tercero pase lo que pase. Hay muchas razones para retirar una ficha de la
-- web (un duplicado, una prueba, un local cerrado, una petición del propio
-- local) y solo una de ellas es un impago.
--
-- Y como los 66 locales están hoy en 'sin_suscripcion', el disparador del
-- lote 41 dejaba ese botón inservible para TODOS, y además congelaba esa
-- ficha: cualquier actualización sobre ella volvía a disparar la excepción.
--
-- Aquí se arregla de raíz: un estado nuevo, 'oculto', para retirar una ficha
-- sin decir nada del pago. `oculto_impago` se reserva para lo que dice su
-- nombre, y el disparador solo rechaza lo que de verdad es imposible.
-- =========================================================

-- 1. El estado nuevo.
alter table public.locales drop constraint if exists locales_estado_check;
alter table public.locales add constraint locales_estado_check
  check (estado in ('borrador', 'activo', 'oculto', 'oculto_impago'));

-- Nada más cambia con esto: lo público sigue siendo solo 'activo', así que
-- 'oculto' se comporta exactamente igual de cara a la web.

-- 2. El disparador, ahora bien acotado.
--
-- Solo queda una combinación imposible: oculta POR IMPAGO mientras la
-- suscripción figura AL CORRIENTE. Ahí sí hay que elegir a cuál de las dos
-- casillas hacer caso, y no hay forma de saberlo.
--
-- `oculto_impago` + `sin_suscripcion` ya NO se rechaza: se deja pasar porque
-- hay filas así de antes y bloquearlas impediría editarlas, que es justo lo
-- contrario de lo que hace falta. Lo suyo es pasarlas a 'oculto' (ver abajo),
-- pero eso es una decisión sobre datos y no la toma un disparador.
create or replace function public.estados_coherentes()
returns trigger language plpgsql as $$
begin
  if new.estado = 'oculto_impago' and new.plan_estado = 'activa' then
    raise exception using
      errcode = 'check_violation',
      message = 'La ficha no puede estar oculta por impago con la suscripción al corriente.',
      hint    = 'Usa «Oculta» si la retiras por otro motivo, o marca la suscripción como impago.';
  end if;

  -- Una suscripción cancelada no conserva fecha de fin: la fecha dice hasta
  -- cuándo está pagado, y cancelada significa que ya no hay periodo que
  -- proteger. Se limpia sola, que no es una contradicción que deba resolver
  -- una persona.
  if new.plan_estado = 'cancelada' then
    new.plan_hasta := null;
  end if;

  return new;
end; $$;

drop trigger if exists trg_estados_coherentes on public.locales;
create trigger trg_estados_coherentes
  before insert or update on public.locales
  for each row execute function public.estados_coherentes();

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- 3. OPCIONAL, y decides tú: las fichas ocultas que no deben nada.
-- ---------------------------------------------------------
-- Esto NO se ejecuta solo. Cambia datos, y hay una ficha de por medio
-- ("miraclee") sobre la que no toco nada sin permiso.
--
-- Lo que hace: pasar a 'oculto' las fichas retiradas que nunca tuvieron
-- suscripción. No cambia lo que ve nadie —siguen fuera de la web igual— solo
-- deja de acusarlas de un impago que no existe.
--
--   update public.locales
--      set estado = 'oculto'
--    where estado = 'oculto_impago'
--      and coalesce(plan_estado, 'sin_suscripcion') = 'sin_suscripcion';
