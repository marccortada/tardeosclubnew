-- =========================================================
-- TardeosClub · LOTE 57: INCIDENCIAS Y ERRORES
-- Aplicar en Supabase → SQL Editor (base nueva). Idempotente: se puede pegar
-- dos veces sin romper nada.
--
-- Hoy, cuando algo falla, el admin se entera por un WhatsApp suelto («esto no
-- me va») o no se entera. Este lote da dos bandejas:
--
-- 1. `incidencias`: lo que la gente REPORTA a mano («X me da problema»).
--    Cualquiera puede crear una (con o sin sesión); cada uno ve las suyas y el
--    admin las ve y gestiona todas.
-- 2. `errores_app`: los errores que salen SOLOS (pantallas rotas, fallos del
--    servidor). Agrupados por huella: el mismo error mil veces es UNA fila con
--    `veces = 1000`, no mil filas. Solo escribe el servidor (service role) a
--    través de `registrar_error_app`; el admin lee, marca resueltos y borra.
-- =========================================================

-- ---------------------------------------------------------
-- 1) INCIDENCIAS
-- ---------------------------------------------------------
create table if not exists public.incidencias (
  id uuid primary key default gen_random_uuid(),
  -- Si se borra la cuenta, la incidencia se queda (sin dueño).
  profile_id uuid references public.profiles(id) on delete set null,
  email_contacto text,
  rol text not null default 'anonimo'
    check (rol in ('tardicola', 'local', 'dj', 'admin', 'anonimo')),
  tipo text not null default 'error'
    check (tipo in ('error', 'duda', 'sugerencia', 'otro')),
  mensaje text not null check (char_length(btrim(mensaje)) between 10 and 2000),
  url text check (url is null or char_length(url) <= 500),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  estado text not null default 'abierta'
    check (estado in ('abierta', 'en_curso', 'resuelta')),
  nota_admin text check (nota_admin is null or char_length(nota_admin) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resuelta_en timestamptz
);

-- El email se valida aparte para poder añadir la regla si la tabla ya existía.
do $$ begin
  alter table public.incidencias add constraint incidencias_email_chk
    check (email_contacto is null or (char_length(email_contacto) <= 200 and email_contacto ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
exception when duplicate_object then null; end $$;

create index if not exists idx_incidencias_estado on public.incidencias(estado, created_at desc);
create index if not exists idx_incidencias_fecha on public.incidencias(created_at desc);
create index if not exists idx_incidencias_profile on public.incidencias(profile_id) where profile_id is not null;

-- updated_at y resuelta_en se ponen solos: así no dependen de que la pantalla
-- se acuerde de mandarlos.
create or replace function public.incidencias_marcas()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.estado = 'resuelta' and (tg_op = 'INSERT' or old.estado is distinct from 'resuelta') then
    new.resuelta_en = now();
  elsif new.estado <> 'resuelta' then
    new.resuelta_en = null;
  end if;
  return new;
end; $$;

drop trigger if exists trg_incidencias_marcas on public.incidencias;
create trigger trg_incidencias_marcas before insert or update on public.incidencias
  for each row execute function public.incidencias_marcas();

-- Al crearla: el ROL lo decide la base (no quien escribe, que podía ponerse
-- "admin"), y hay tope para que nadie llene la bandeja: 5 por cuenta en una
-- hora, y como mucho 60 anónimas en una hora entre todos.
create or replace function public.incidencias_al_crear()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_n   integer;
begin
  if v_uid is null then
    new.rol := 'anonimo';
    select count(*) into v_n from public.incidencias
      where profile_id is null and created_at > now() - interval '1 hour';
    if v_n >= 60 then raise exception 'Demasiados avisos ahora mismo. Prueba en un rato.' using errcode = 'P0001'; end if;
  else
    select case
             when p.is_admin then 'admin'
             when exists (select 1 from public.locales l where l.owner_id = v_uid) then 'local'
             when exists (select 1 from public.djs d where d.profile_id = v_uid) then 'dj'
             else 'tardicola'
           end
      into new.rol
      from public.profiles p where p.id = v_uid;
    new.rol := coalesce(new.rol, 'tardicola');
    select count(*) into v_n from public.incidencias
      where profile_id = v_uid and created_at > now() - interval '1 hour';
    if v_n >= 5 then raise exception 'Ya nos has escrito varias veces en la última hora. Te contestamos pronto.' using errcode = 'P0001'; end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_incidencias_al_crear on public.incidencias;
create trigger trg_incidencias_al_crear before insert on public.incidencias
  for each row execute function public.incidencias_al_crear();

alter table public.incidencias enable row level security;

-- CREAR: cualquiera (con o sin sesión). Siempre abierta, sin nota del admin y
-- a su nombre o anónima: nadie puede crear incidencias en nombre de otro.
drop policy if exists "incidencias_insert" on public.incidencias;
create policy "incidencias_insert" on public.incidencias
  for insert to anon, authenticated with check (
    (profile_id is null or profile_id = auth.uid())
    and estado = 'abierta'
    and nota_admin is null
    and resuelta_en is null
    and char_length(btrim(mensaje)) between 10 and 2000
  );

-- VER: cada uno las suyas; el admin, todas.
drop policy if exists "incidencias_select" on public.incidencias;
create policy "incidencias_select" on public.incidencias
  for select to authenticated using (profile_id = auth.uid() or public.is_admin());

-- CAMBIAR ESTADO / NOTA: solo el admin.
drop policy if exists "incidencias_update" on public.incidencias;
create policy "incidencias_update" on public.incidencias
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "incidencias_delete" on public.incidencias;
create policy "incidencias_delete" on public.incidencias
  for delete to authenticated using (public.is_admin());

grant insert on public.incidencias to anon, authenticated;
grant select, update, delete on public.incidencias to authenticated;

-- ---------------------------------------------------------
-- 2) ERRORES AUTOMÁTICOS
-- ---------------------------------------------------------
create table if not exists public.errores_app (
  id uuid primary key default gen_random_uuid(),
  -- Hash de origen + mensaje normalizado + ruta: agrupa el «mismo» error.
  huella text not null check (char_length(huella) between 8 and 64),
  mensaje text not null check (char_length(mensaje) <= 1000),
  pila text check (pila is null or char_length(pila) <= 4000),
  url text check (url is null or char_length(url) <= 500),
  ruta text check (ruta is null or char_length(ruta) <= 300),
  origen text not null default 'cliente' check (origen in ('cliente', 'servidor')),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  profile_id uuid references public.profiles(id) on delete set null,
  veces integer not null default 1 check (veces >= 1),
  -- El admin lo marca al arreglarlo; si vuelve a salir, se reabre solo.
  resuelto boolean not null default false,
  primera_vez timestamptz not null default now(),
  ultima_vez timestamptz not null default now()
);

create unique index if not exists uq_errores_app_huella on public.errores_app(huella);
create index if not exists idx_errores_app_ultima on public.errores_app(ultima_vez desc);
create index if not exists idx_errores_app_origen on public.errores_app(origen, ultima_vez desc);

alter table public.errores_app enable row level security;

-- Sin política de INSERT: ni anon ni authenticated pueden escribir aquí. Solo
-- el servidor, con la service role (que se salta la RLS), vía la función.
drop policy if exists "errores_app_select" on public.errores_app;
create policy "errores_app_select" on public.errores_app
  for select to authenticated using (public.is_admin());

drop policy if exists "errores_app_update" on public.errores_app;
create policy "errores_app_update" on public.errores_app
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "errores_app_delete" on public.errores_app;
create policy "errores_app_delete" on public.errores_app
  for delete to authenticated using (public.is_admin());

revoke all on public.errores_app from anon;
revoke insert on public.errores_app from authenticated;
grant select, update, delete on public.errores_app to authenticated;

-- Alta o suma: si la huella ya existe, +1 en `veces`, se refresca la última
-- vez y los datos del último caso (url, pila…) y se reabre si estaba resuelto.
-- Recorta aquí también: no se fía de que quien llama lo haya hecho.
create or replace function public.registrar_error_app(
  p_huella text,
  p_mensaje text,
  p_pila text default null,
  p_url text default null,
  p_ruta text default null,
  p_origen text default 'cliente',
  p_user_agent text default null,
  p_profile uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_huella is null or char_length(p_huella) < 8 or coalesce(btrim(p_mensaje), '') = '' then
    return;
  end if;
  -- Tope de errores DISTINTOS nuevos al día: alguien podría inventar
  -- mensajes sin fin. Los que ya existen siguen sumando veces.
  if not exists (select 1 from public.errores_app where huella = left(p_huella, 64))
     and (select count(*) from public.errores_app where primera_vez > now() - interval '1 day') >= 500 then
    return;
  end if;
  insert into public.errores_app as e (huella, mensaje, pila, url, ruta, origen, user_agent, profile_id)
  values (
    left(p_huella, 64),
    left(p_mensaje, 1000),
    left(p_pila, 4000),
    left(p_url, 500),
    left(p_ruta, 300),
    case when p_origen = 'servidor' then 'servidor' else 'cliente' end,
    left(p_user_agent, 400),
    -- Solo si el perfil existe: un id inventado no debe tumbar el registro.
    (select id from public.profiles where id = p_profile)
  )
  on conflict (huella) do update set
    veces = least(e.veces, 2000000000) + 1,
    ultima_vez = now(),
    url = coalesce(excluded.url, e.url),
    pila = coalesce(excluded.pila, e.pila),
    user_agent = coalesce(excluded.user_agent, e.user_agent),
    profile_id = coalesce(excluded.profile_id, e.profile_id),
    resuelto = false;
end; $$;

-- Solo el servidor. Si anon pudiera llamarla, cualquiera llenaría la tabla.
revoke all on function public.registrar_error_app(text, text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.registrar_error_app(text, text, text, text, text, text, text, uuid) to service_role;

-- Que PostgREST vea las tablas nuevas sin esperar.
notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- Aviso de cancelación a los apuntados: UNO por tardeo (la ruta lo marca).
alter table public.tardeos add column if not exists avisado_cancelacion_en timestamptz;

-- Funciones de lotes 50-55 que no tienen nada que hacer sin sesión. Por
-- dentro ya devuelven vacío a anon, pero mejor que ni se puedan llamar.
do $$
declare f text;
begin
  foreach f in array array[
    'public.inscritos_de_local(uuid)', 'public.metricas_de_local(uuid)',
    'public.metricas_por_tardeo(uuid, integer)', 'public.invitaciones_de_dj(uuid)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
end $$;
