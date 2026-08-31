-- =========================================================
-- TardeosClub · LOTE 35: EL SEGUIMIENTO COMERCIAL
-- Aplicar en Supabase → SQL Editor.
--
-- Hay 68 locales y 4 reclamados. Los 64 restantes son fichas que creó
-- TardeosClub y que hay que ir a buscar uno a uno: llamar, escribir por
-- Instagram, insistir en septiembre. Eso hoy no se apunta en ninguna parte, y
-- lo que no se apunta se llama dos veces o no se llama nunca.
--
-- POR QUÉ UNA TABLA APARTE Y NO CUATRO COLUMNAS EN `locales`:
--
-- Porque `locales` lo lee su dueño. En cuanto un local reclama su ficha puede
-- leer sus propias filas, y una nota comercial que diga "regatea, no bajar de
-- 20" o "no le interesa, probar en septiembre" es exactamente lo que no puede
-- ver. Separándolo, la frontera la pone la base de datos y no el cuidado que
-- ponga cada consulta que se escriba de aquí en adelante.
--
-- LO QUE NO ESTÁ AQUÍ, A PROPÓSITO:
--
-- "Perfil reclamado" y "Cliente" no son columnas de esta tabla. Reclamado es
-- `locales.owner_id`, y cliente es `locales.plan_estado`. Copiarlos aquí sería
-- tener dos versiones de la misma verdad, y a los dos meses el tablero diría
-- "interesado" de alguien que lleva tres meses pagando. Se derivan al leer.
--
-- Los canales de contacto tampoco: teléfono, email y redes ya están en
-- `locales`, y la ticketera sale del último tardeo del local.
-- =========================================================

create table if not exists public.seguimiento_comercial (
  -- Uno por local, no un histórico: la clave primaria ES el local. El histórico
  -- de llamadas no se pide y mantenerlo sin que nadie lo lea solo estorba.
  local_id uuid primary key references public.locales(id) on delete cascade,

  estado text not null default 'no_contactado' check (estado in (
    'no_contactado',
    'contactado',      -- se le ha escrito o llamado, sin respuesta clara
    'interesado',      -- ha dicho que sí le interesa
    'no_interesado'    -- ha dicho que no. Se guarda: sin esto se le vuelve a llamar
  )),

  -- Por dónde se le habló. Sirve para saber qué canal funciona: si el 80 % de
  -- los "interesado" salieron de Instagram, las llamadas sobran.
  canal text check (canal is null or canal in ('instagram','email','telefono','whatsapp','presencial','otro')),

  notas text,

  -- El campo que hace que esto sirva de algo. Sin una fecha, un CRM es una
  -- lista de nombres; con ella, es una lista de lo que hay que hacer hoy.
  proximo_seguimiento date,

  ultimo_contacto timestamptz,

  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references public.profiles(id) on delete set null
);

-- La consulta de todos los días es "a quién le toca", así que el índice va por
-- ahí. Los que no tienen fecha no estorban: van al final por `nulls last`.
create index if not exists idx_seg_proximo on public.seguimiento_comercial(proximo_seguimiento);
create index if not exists idx_seg_estado  on public.seguimiento_comercial(estado);

alter table public.seguimiento_comercial enable row level security;

-- SOLO ADMIN, y las cuatro operaciones por separado.
--
-- No hay política para el dueño del local a propósito, ni siquiera de lectura:
-- esta tabla es del equipo comercial. Sin políticas para nadie más, RLS deja
-- fuera a todo el mundo, que es justo lo que se quiere.
drop policy if exists "seg_select" on public.seguimiento_comercial;
create policy "seg_select" on public.seguimiento_comercial
  for select using (public.is_admin());

drop policy if exists "seg_insert" on public.seguimiento_comercial;
create policy "seg_insert" on public.seguimiento_comercial
  for insert with check (public.is_admin());

drop policy if exists "seg_update" on public.seguimiento_comercial;
create policy "seg_update" on public.seguimiento_comercial
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "seg_delete" on public.seguimiento_comercial;
create policy "seg_delete" on public.seguimiento_comercial
  for delete using (public.is_admin());

-- La fecha del último contacto se pone sola al mover el estado.
--
-- A mano se olvida, y un "último contacto" que a veces está y a veces no es
-- peor que no tenerlo: no se puede ordenar por él ni confiar en lo que dice.
create or replace function public.tocar_seguimiento()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  if new.estado is distinct from coalesce(old.estado, 'no_contactado')
     and new.estado <> 'no_contactado' then
    new.ultimo_contacto := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tocar_seguimiento on public.seguimiento_comercial;
create trigger trg_tocar_seguimiento
  before insert or update on public.seguimiento_comercial
  for each row execute function public.tocar_seguimiento();

notify pgrst, 'reload schema';
