-- =========================================================
-- TardeosClub · LOTE 30: RECLAMAR UNA FICHA
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- TardeosClub crea fichas de locales y DJs antes de que ellos lleguen, para
-- tener cartelera. Hoy son 62 locales de 66 y los 31 DJs: la norma, no la
-- excepción. El admin ya sabe enlazar una ficha con su dueño (por email o con
-- un enlace de invitación), pero solo si él da el primer paso.
--
-- Esto es la otra mitad: que lo pida el interesado desde su propia ficha.
-- «Ya te estamos publicando. Reclama tu perfil para gestionarlo.»
--
-- NO se asigna solo. Cualquiera podría decir que es el dueño del Miracle, así
-- que la solicitud queda pendiente y la aprueba un admin después de
-- comprobarlo. Por eso hay tabla y no un simple email: hace falta una cola.
-- =========================================================

create table if not exists public.solicitudes_reclamacion (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('local', 'dj')),
  objetivo_id uuid not null,
  -- Quién la pide. Al aprobarla, esta cuenta pasa a ser la dueña: por eso hace
  -- falta sesión para reclamar y no vale un formulario anónimo.
  solicitante uuid not null references public.profiles(id) on delete cascade,
  -- Qué es de la ficha ("Soy el propietario", "Llevo la sala"...). Texto libre:
  -- una lista cerrada se queda corta y aquí lo que importa es poder leerlo.
  cargo text,
  telefono text,
  mensaje text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  created_at timestamptz not null default now(),
  resuelta_en timestamptz
);

create index if not exists idx_solicitudes_estado on public.solicitudes_reclamacion(estado, created_at desc);

-- Una sola solicitud pendiente por persona y ficha. Sin esto, quien pulsa dos
-- veces le mete dos filas iguales a la cola del admin.
create unique index if not exists uniq_solicitud_pendiente
  on public.solicitudes_reclamacion (tipo, objetivo_id, solicitante)
  where estado = 'pendiente';

-- ¿Esa ficha sigue sin dueño?
--
-- `security definer` a propósito: la usa la política de abajo, y desde una
-- política no se puede depender de que quien escribe tenga permiso de lectura
-- sobre `locales.owner_id` —esa tabla va con permisos columna a columna desde
-- el lote 14 y eso cambia con el tiempo.
create or replace function public.ficha_sin_duenno(p_tipo text, p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_tipo
    when 'local' then exists (select 1 from public.locales where id = p_id and owner_id is null)
    when 'dj'    then exists (select 1 from public.djs     where id = p_id and profile_id is null)
    else false
  end;
$$;

alter table public.solicitudes_reclamacion enable row level security;

-- Cada uno ve las suyas; el admin, todas.
drop policy if exists "solicitudes_select" on public.solicitudes_reclamacion;
create policy "solicitudes_select" on public.solicitudes_reclamacion
  for select using (solicitante = auth.uid() or public.is_admin());

-- Solo se puede pedir para uno mismo y solo sobre una ficha que no tenga dueño.
drop policy if exists "solicitudes_insert" on public.solicitudes_reclamacion;
create policy "solicitudes_insert" on public.solicitudes_reclamacion
  for insert with check (
    solicitante = auth.uid()
    and estado = 'pendiente'
    and public.ficha_sin_duenno(tipo, objetivo_id)
  );

-- Resolver es cosa del admin. Nadie se aprueba la suya.
drop policy if exists "solicitudes_update" on public.solicitudes_reclamacion;
create policy "solicitudes_update" on public.solicitudes_reclamacion
  for update using (public.is_admin());

drop policy if exists "solicitudes_delete" on public.solicitudes_reclamacion;
create policy "solicitudes_delete" on public.solicitudes_reclamacion
  for delete using (public.is_admin());

-- Aprobar: enlaza la ficha y cierra la solicitud, todo o nada.
--
-- Va en una función y no en dos escrituras desde el navegador porque son dos
-- tablas: si la segunda falla, la ficha se queda con dueño y la solicitud
-- pendiente, y el admin la aprueba otra vez sin saber que ya estaba hecha.
--
-- Las demás solicitudes pendientes de esa misma ficha se rechazan solas: la
-- ficha ya tiene dueño, así que aprobar otra sería pisarlo.
create or replace function public.aprobar_reclamacion(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.solicitudes_reclamacion;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Solo para administradores.');
  end if;

  select * into s from public.solicitudes_reclamacion where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Esa solicitud ya no existe.');
  end if;
  if s.estado <> 'pendiente' then
    return jsonb_build_object('ok', false, 'error', 'Esa solicitud ya estaba resuelta.');
  end if;
  if not public.ficha_sin_duenno(s.tipo, s.objetivo_id) then
    return jsonb_build_object('ok', false, 'error', 'Esa ficha ya tiene dueño.');
  end if;

  if s.tipo = 'local' then
    update public.locales set owner_id = s.solicitante where id = s.objetivo_id;
  else
    update public.djs set profile_id = s.solicitante where id = s.objetivo_id;
  end if;

  update public.solicitudes_reclamacion
     set estado = 'aprobada', resuelta_en = now()
   where id = p_id;

  update public.solicitudes_reclamacion
     set estado = 'rechazada', resuelta_en = now()
   where tipo = s.tipo and objetivo_id = s.objetivo_id and estado = 'pendiente';

  return jsonb_build_object('ok', true);
end; $$;

revoke all on function public.aprobar_reclamacion(uuid) from public;
grant execute on function public.aprobar_reclamacion(uuid) to authenticated;

notify pgrst, 'reload schema';
