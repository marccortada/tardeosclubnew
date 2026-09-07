-- =========================================================
-- TardeosClub · LOTE 44: LÍMITES, APELACIÓN Y REGISTRO EN LAS RESEÑAS
-- Aplicar en Supabase → SQL Editor.
--
-- Es el punto Q-05. Hoy una reseña solo tiene tres estados y nada más: se
-- aprueba o se rechaza, y ahí se acaba. Lo que falta:
--
--   LÍMITES   -> nada impide escribir cincuenta reseñas en una tarde, ni dos
--                del mismo local. Lo segundo lo comprueba el navegador antes
--                de insertar, que es lo mismo que no comprobarlo: dos pestañas
--                abiertas, o una petición directa, y entran las dos.
--   APELACIÓN -> a quien le rechazan una reseña no se le dice ni que se la han
--                rechazado. Simplemente deja de aparecer.
--   REGISTRO  -> no queda constancia de quién decidió qué ni por qué, así que
--                «esto ya lo miró alguien» no se puede comprobar.
-- =========================================================

-- ---------------------------------------------------------
-- 1. El estado nuevo y las columnas del registro
-- ---------------------------------------------------------
alter table public.resenas drop constraint if exists resenas_estado_check;
alter table public.resenas add constraint resenas_estado_check
  check (estado in ('pendiente', 'aprobada', 'rechazada', 'apelada'));

-- Por qué se rechazó. Se le enseña a quien la escribió: rechazar sin decir el
-- motivo es lo que convierte una moderación en un agravio.
alter table public.resenas add column if not exists motivo_rechazo text;

-- Quién decidió y cuándo. Sin esto no hay auditoría posible.
alter table public.resenas add column if not exists moderada_por uuid references public.profiles(id) on delete set null;
alter table public.resenas add column if not exists moderada_en timestamptz;

-- Lo que alega quien la escribió, y cuándo lo alegó.
alter table public.resenas add column if not exists apelacion text;
alter table public.resenas add column if not exists apelada_en timestamptz;

-- ---------------------------------------------------------
-- 2. Una reseña por persona y objetivo, de verdad
-- ---------------------------------------------------------
-- Esto lo comprobaba `yaReseno()` en el navegador. Una comprobación en el
-- cliente no es un límite: es una sugerencia. Con dos pestañas abiertas
-- entran las dos.
--
-- Cubre TODOS los estados a propósito. Si una rechazada no contara, bastaría
-- con que te rechacen una para poder escribir otra igual, y la moderación no
-- serviría de nada. Para eso está la apelación.
create unique index if not exists uniq_resena_autor_objetivo
  on public.resenas (autor_profile_id, objetivo_tipo, objetivo_id)
  where autor_profile_id is not null;

-- ---------------------------------------------------------
-- 3. El límite por día
-- ---------------------------------------------------------
-- Cinco al día. Es de sobra para una persona —quien sale mucho reseña dos o
-- tres sitios a la semana— y corta en seco a quien viene a hacer una tanda,
-- que es el patrón de las reseñas compradas y el de una venganza.
--
-- Va en la base y no en el navegador por lo mismo de arriba.
create or replace function public.limite_resenas()
returns trigger language plpgsql security definer set search_path = public as $$
declare hoy_cuenta int;
begin
  if new.autor_profile_id is null then return new; end if;

  select count(*) into hoy_cuenta
    from public.resenas
   where autor_profile_id = new.autor_profile_id
     and created_at >= now() - interval '24 hours';

  if hoy_cuenta >= 5 then
    raise exception using
      errcode = 'check_violation',
      message = 'Has escrito muchas reseñas en poco tiempo. Prueba mañana.',
      hint    = 'Límite de 5 reseñas cada 24 horas por persona.';
  end if;
  return new;
end; $$;

drop trigger if exists trg_limite_resenas on public.resenas;
create trigger trg_limite_resenas
  before insert on public.resenas
  for each row execute function public.limite_resenas();

-- ---------------------------------------------------------
-- 4. Quién moderó y cuándo lo pone la base
-- ---------------------------------------------------------
-- Igual que en las denuncias: si lo mandara el navegador, cualquiera con
-- sesión de admin podría firmar la decisión con el identificador de otro y la
-- auditoría dejaría de valer.
create or replace function public.sellar_resena()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado is distinct from old.estado then
    if new.estado in ('aprobada', 'rechazada') then
      new.moderada_por := auth.uid();
      new.moderada_en  := now();
    elsif new.estado = 'apelada' then
      -- Apelar no es moderar: la fecha de la apelación es otra cosa y la
      -- decisión anterior se conserva, que es lo que se está discutiendo.
      new.apelada_en := now();
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_sellar_resena on public.resenas;
create trigger trg_sellar_resena
  before update on public.resenas
  for each row execute function public.sellar_resena();

-- ---------------------------------------------------------
-- 5. Que el autor pueda apelar, y solo apelar
-- ---------------------------------------------------------
-- La política de actualización era solo para el admin. Se añade una para el
-- autor, acotada a su propia reseña y solo cuando está rechazada.
drop policy if exists "resenas_apelar" on public.resenas;
create policy "resenas_apelar" on public.resenas
  for update to authenticated
  using (autor_profile_id = auth.uid() and estado = 'rechazada')
  with check (autor_profile_id = auth.uid() and estado = 'apelada');

-- La política deja escribir la fila, pero no dice QUÉ columnas. Sin esto, al
-- apelar se podría cambiar también la puntuación y el comentario, que es justo
-- lo que se está discutiendo: se apelaría una reseña y se colaría otra
-- distinta. Este disparador devuelve a su sitio todo lo que no sea la
-- apelación.
create or replace function public.proteger_apelacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;

  new.puntuacion      := old.puntuacion;
  new.comentario      := old.comentario;
  new.objetivo_tipo   := old.objetivo_tipo;
  new.objetivo_id     := old.objetivo_id;
  new.autor_profile_id := old.autor_profile_id;
  new.motivo_rechazo  := old.motivo_rechazo;
  new.moderada_por    := old.moderada_por;
  new.moderada_en     := old.moderada_en;
  new.created_at      := old.created_at;
  return new;
end; $$;

-- Son dos disparadores `before update` sobre la misma tabla y los dos se
-- ejecutan, por orden alfabético del nombre: primero `trg_proteger_apelacion`
-- y después `trg_sellar_resena`. Aquí da igual el orden —uno devuelve columnas
-- a su sitio y el otro deriva una fecha, y no se pisan— pero conviene saberlo
-- antes de tocar cualquiera de los dos.
drop trigger if exists trg_proteger_apelacion on public.resenas;
create trigger trg_proteger_apelacion
  before update on public.resenas
  for each row execute function public.proteger_apelacion();

notify pgrst, 'reload schema';
