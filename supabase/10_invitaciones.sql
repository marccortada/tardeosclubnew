-- =========================================================
-- TardeosClub · LOTE 10: INVITACIONES (reclamar ficha)
-- Aplicar en Supabase → SQL Editor, después del Lote 9.
--
-- El admin da de alta locales y DJs a mano; esas fichas nacen sin dueño.
-- Este lote permite generar un enlace con token para que la persona lo abra,
-- entre con su cuenta y la ficha quede enlazada a ella.
-- =========================================================

create table if not exists public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  -- 64 hex sin guiones. Dos uuid v4 = 256 bits de aleatoriedad: no se adivina
  -- por fuerza bruta y no hace falta la extensión pgcrypto.
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  tipo text not null check (tipo in ('local', 'dj')),
  ficha_id uuid not null,                 -- id del local o del dj
  email text,                             -- a quién se la mandaste (informativo)
  creada_por uuid references public.profiles(id) on delete set null,
  usada_por uuid references public.profiles(id) on delete set null,
  usada_en timestamptz,
  expira_en timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);

create index if not exists idx_invitaciones_ficha on public.invitaciones(ficha_id);

alter table public.invitaciones enable row level security;

-- Solo el admin toca la tabla. Quien reclama nunca la lee: para eso está la
-- función de abajo, que comprueba el token por dentro. Si el invitado pudiera
-- leer la tabla, podría listar los tokens de los demás.
drop policy if exists "invitaciones_admin" on public.invitaciones;
create policy "invitaciones_admin" on public.invitaciones
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------
-- Reclamar: valida el token y enlaza la ficha con quien llama.
--
-- security definer porque el que reclama NO puede escribir la ficha por su
-- cuenta: 'locales_update' exige owner_id = auth.uid(), y en una ficha
-- huérfana owner_id es null, así que RLS le diría que no.
--
-- Ojo con lo que NO hace: no toca 'verificado' ni 'estado'. El trigger
-- proteger_locales del Lote 9 sigue actuando (auth.uid() sigue siendo el
-- invitado, que no es admin), así que reclamar una ficha no sirve para
-- auto-verificarse ni para reactivar un local impagado.
-- ---------------------------------------------------------
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

  select * into inv from public.invitaciones where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Esta invitación no existe.');
  end if;
  if inv.usada_por is not null then
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

-- Anónimo no: hay que estar dentro para poder enlazar la ficha a alguien.
revoke all on function public.reclamar_invitacion(text) from public, anon;
grant execute on function public.reclamar_invitacion(text) to authenticated;
