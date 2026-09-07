-- =========================================================
-- TardeosClub · LOTE 41: QUE LOS ESTADOS NO SE CONTRADIGAN
-- Aplicar en Supabase → SQL Editor.
--
-- Un local tiene cuatro cosas independientes: si está verificado, si su ficha
-- se ve, qué plan tiene y si está al corriente. Son cuatro columnas separadas
-- a propósito, y casi todas las combinaciones son legítimas:
--
--   · publicada y sin suscripción  -> hoy son los 66 locales;
--   · publicada con pago pendiente -> un impago no retira la ficha solo;
--   · verificada y sin publicar    -> se comprueba antes de sacarla.
--
-- La que NO puede ser es «oculta por impago» mientras la suscripción figura al
-- corriente o inexistente. Quien abra esa ficha tiene que decidir a cuál de las
-- dos casillas hacer caso, y no hay forma de saberlo. Pasa de verdad cuando
-- alguien cobra un recibo atrasado, actualiza el pago y se olvida de volver a
-- publicar la ficha.
--
-- POR QUÉ UN DISPARADOR Y NO UN `CHECK`:
-- Un check se comprueba contra TODAS las filas al crearlo, y si alguna de las
-- que ya están guardadas está en ese estado, el lote falla entero y no se
-- aplica nada. Un disparador solo mira lo que se escribe a partir de ahora:
-- las filas que ya estuvieran mal se quedan como están —visibles en el panel,
-- que es donde se arreglan— y no se puede crear ninguna nueva.
-- =========================================================

create or replace function public.estados_coherentes()
returns trigger language plpgsql as $$
begin
  if new.estado = 'oculto_impago'
     and coalesce(new.plan_estado, 'sin_suscripcion') in ('activa', 'sin_suscripcion') then
    raise exception using
      errcode = 'check_violation',
      message = 'La ficha no puede estar oculta por impago con la suscripción al corriente o inexistente.',
      hint    = 'Vuelve a publicarla, o marca la suscripción como impago o cancelada.';
  end if;

  -- Una suscripción cancelada no conserva fecha de fin: la fecha dice hasta
  -- cuándo está pagado, y cancelada significa que ya no hay periodo que
  -- proteger. Se limpia sola en vez de dar error, porque no es una
  -- contradicción que tenga que resolver una persona.
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

-- Para ver si alguna fila ya guardada está en ese estado (el disparador no las
-- toca, así que conviene mirarlo una vez):
--
--   select id, nombre, estado, plan_estado from public.locales
--    where estado = 'oculto_impago'
--      and coalesce(plan_estado,'sin_suscripcion') in ('activa','sin_suscripcion');
