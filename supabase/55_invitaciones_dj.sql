-- =========================================================
-- TardeosClub · LOTE 55: INVITACIONES DJ ↔ TARDEO
-- Aplicar en Supabase → SQL Editor (base nueva). Idempotente.
--
-- Hoy un DJ sale en un tardeo solo si el local lo mete en `tardeo_djs`, sin
-- preguntarle. Resultado: DJs que aparecen en carteles en los que no pinchan
-- (sobre todo tras la migración) y sin forma de quitarse.
--
-- 1. `dj_invitaciones`: el local (o el admin) invita; el DJ acepta o rechaza.
--    Al aceptar, un disparador lo mete en `tardeo_djs` (el DJ no tiene
--    permiso directo sobre esa tabla, y así sigue siendo).
-- 2. El DJ puede QUITARSE de un tardeo (borrar SU fila de `tardeo_djs`). Solo
--    la suya: no puede tocar las de otros DJs ni añadirse a nada sin invitación.
-- =========================================================

create table if not exists public.dj_invitaciones (
  id uuid primary key default gen_random_uuid(),
  tardeo_id uuid not null references public.tardeos(id) on delete cascade,
  dj_id uuid not null references public.djs(id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptada', 'rechazada')),
  -- Quién invitó. Si se borra la cuenta, la invitación se queda.
  creada_por uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  respondida_en timestamptz
);

-- Una sola invitación PENDIENTE por DJ y tardeo: reenviar no debe llenarle la
-- bandeja. Las respondidas sí se acumulan (histórico).
create unique index if not exists uq_dj_inv_pendiente
  on public.dj_invitaciones(tardeo_id, dj_id) where estado = 'pendiente';
create index if not exists idx_dj_inv_dj on public.dj_invitaciones(dj_id, estado, created_at desc);

alter table public.dj_invitaciones enable row level security;

-- ¿Es mío este DJ? (security definer para no depender de la RLS de djs)
create or replace function public.es_mi_dj(p_dj uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.djs d where d.id = p_dj and d.profile_id = auth.uid());
$$;

-- ¿Soy dueño del local de este tardeo? (o admin)
create or replace function public.gestiona_tardeo(p_tardeo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.tardeos t where t.id = p_tardeo and public.owns_tardeo(t.local_id));
$$;

-- VER: el DJ invitado, quien gestiona el tardeo y el admin.
drop policy if exists "dj_inv_select" on public.dj_invitaciones;
create policy "dj_inv_select" on public.dj_invitaciones
  for select using (public.es_mi_dj(dj_id) or public.gestiona_tardeo(tardeo_id));

-- CREAR: solo quien gestiona el tardeo, siempre en pendiente y a su nombre.
drop policy if exists "dj_inv_insert" on public.dj_invitaciones;
create policy "dj_inv_insert" on public.dj_invitaciones
  for insert with check (
    public.gestiona_tardeo(tardeo_id)
    and estado = 'pendiente'
    and (creada_por is null or creada_por = auth.uid())
  );

-- RESPONDER: el DJ, solo las suyas y solo de pendiente a aceptada/rechazada.
drop policy if exists "dj_inv_responder" on public.dj_invitaciones;
create policy "dj_inv_responder" on public.dj_invitaciones
  for update using (public.es_mi_dj(dj_id) and estado = 'pendiente')
  with check (public.es_mi_dj(dj_id) and estado in ('aceptada', 'rechazada'));

-- El admin puede corregir cualquier cosa.
drop policy if exists "dj_inv_admin" on public.dj_invitaciones;
create policy "dj_inv_admin" on public.dj_invitaciones
  for update using (public.is_admin()) with check (public.is_admin());

-- RETIRAR una invitación: quien gestiona el tardeo.
drop policy if exists "dj_inv_delete" on public.dj_invitaciones;
create policy "dj_inv_delete" on public.dj_invitaciones
  for delete using (public.gestiona_tardeo(tardeo_id));

-- Al responder no se puede cambiar a qué tardeo ni a qué DJ se refiere (la
-- política de update no ve columnas sueltas: esto lo cierra). Y se apunta la
-- hora de respuesta.
create or replace function public.dj_inv_antes_update()
returns trigger language plpgsql as $$
begin
  if new.tardeo_id is distinct from old.tardeo_id
     or new.dj_id is distinct from old.dj_id
     or new.creada_por is distinct from old.creada_por
     or new.created_at is distinct from old.created_at then
    raise exception 'Solo se puede cambiar el estado de la invitación' using errcode = '42501';
  end if;
  if new.estado is distinct from old.estado and new.estado <> 'pendiente' then
    new.respondida_en := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_dj_inv_antes_update on public.dj_invitaciones;
create trigger trg_dj_inv_antes_update before update on public.dj_invitaciones
  for each row execute function public.dj_inv_antes_update();

-- Al aceptar, el DJ entra en el cartel. security definer porque el DJ no puede
-- escribir en tardeo_djs; solo se ejecuta por una invitación válida.
create or replace function public.dj_inv_al_aceptar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'aceptada' and old.estado is distinct from 'aceptada' then
    insert into public.tardeo_djs (tardeo_id, dj_id)
    values (new.tardeo_id, new.dj_id)
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_dj_inv_al_aceptar on public.dj_invitaciones;
create trigger trg_dj_inv_al_aceptar after update on public.dj_invitaciones
  for each row execute function public.dj_inv_al_aceptar();

grant select, insert, update, delete on public.dj_invitaciones to authenticated;

-- 2. "No pincho aquí": el DJ puede borrar SU fila de tardeo_djs.
drop policy if exists "tardeo_djs_dj_salir" on public.tardeo_djs;
create policy "tardeo_djs_dj_salir" on public.tardeo_djs
  for delete using (public.es_mi_dj(dj_id));

-- 3. Lo que ve el DJ en su bandeja. Función y no consulta directa porque el
-- tardeo puede estar aún en borrador, y entonces la RLS de `tardeos` no le
-- deja leer ni el título: vería invitaciones "a nada". Aquí se devuelve lo
-- justo (título, fecha, local) y solo de SUS invitaciones (o admin).
create or replace function public.invitaciones_de_dj(p_dj uuid)
returns table (
  id uuid, estado text, created_at timestamptz, tardeo_id uuid,
  titulo text, fecha date, hora_inicio time, local_nombre text, zona text
)
language sql stable security definer set search_path = public as $$
  select i.id, i.estado, i.created_at, t.id, t.titulo, t.fecha, t.hora_inicio, l.nombre, l.zona
    from public.dj_invitaciones i
    join public.tardeos t on t.id = i.tardeo_id
    left join public.locales l on l.id = t.local_id
   where i.dj_id = p_dj
     and (public.es_mi_dj(p_dj) or public.is_admin())
   order by (i.estado = 'pendiente') desc, t.fecha asc;
$$;

grant execute on function public.invitaciones_de_dj(uuid) to authenticated;

-- 4. El admin puede BORRAR fichas de DJ. `djs` nunca tuvo política de borrado
-- (los locales sí: locales_delete), así que "Eliminar ficha" en /admin/djs
-- devolvía 0 filas sin error. Con el borrado caen en cascada sus apariciones
-- en carteles (tardeo_djs), contenidos y métricas; los tardeos se quedan.
drop policy if exists "djs_delete" on public.djs;
create policy "djs_delete" on public.djs
  for delete using (public.is_admin());
