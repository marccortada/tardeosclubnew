-- =========================================================
-- TardeosClub · LOTE 34: MEDIR CON FECHA, NO CON UN CONTADOR
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Lo que hay hoy es `metricas_tardeo`: un contador por tardeo que solo sube.
-- Con eso no se puede hacer NADA de lo que vende el modelo de suscripciones:
-- ni "este mes contra el pasado", ni evolución, ni comparativas, ni CTR. Y lo
-- que es peor, la historia que no se guarda hoy no se recupera mañana: cada día
-- que pasa incrementando un contador es un día que ya no se le podrá enseñar a
-- nadie.
--
-- Aquí se guarda UNA FILA POR CADA COSA QUE PASA, con su hora. De ahí sale
-- cualquier estadística, la de hoy y la que se invente dentro de dos años.
--
-- PRIVACIDAD: no se guarda IP, ni navegador, ni nada que identifique a nadie.
-- `sesion` es un número al azar que vive en la pestaña del visitante y solo
-- sirve para no contar diez veces a quien recarga. `profile_id` solo se rellena
-- si la persona ha entrado con su cuenta, y sirve para el ADN, no para fichar.
-- =========================================================

create table if not exists public.eventos_metrica (
  id bigint generated always as identity primary key,

  tipo text not null check (tipo in (
    'vista_tardeo',    -- alguien abre la ficha de un tardeo
    'vista_local',     -- alguien abre la ficha de un local o promotor
    'vista_dj',        -- alguien abre la ficha de un DJ
    'clic_entrada',    -- pulsa "Comprar entrada" y se va a la ticketera
    'clic_lista',      -- pulsa "Apuntarme a la lista"
    'inscripcion',     -- se apunta a un tardeo gratis
    'favorito'         -- guarda un tardeo
  )),

  -- A qué se refiere. Solo uno relleno según el tipo; los demás van a null.
  tardeo_id uuid references public.tardeos(id) on delete cascade,
  local_id  uuid references public.locales(id) on delete cascade,
  dj_id     uuid references public.djs(id)     on delete cascade,

  -- Quién, solo si tiene sesión. Si se borra la cuenta, la métrica se queda
  -- pero anónima: el dato agregado del local no debe desaparecer porque un
  -- visitante se dé de baja.
  profile_id uuid references public.profiles(id) on delete set null,

  -- Identificador de la pestaña, al azar. Para no contar diez veces al que
  -- recarga. No identifica a nadie ni sobrevive a cerrar el navegador.
  sesion text,

  -- A dónde iba el clic de entrada. Guardarlo permite saber qué ticketera
  -- convierte mejor, que es justo lo que hace falta para negociar con ellas.
  destino text,

  created_at timestamptz not null default now()
);

-- Los índices son lo que hace que el panel del local no tarde diez segundos.
-- Van por (a qué, cuándo) porque TODAS las consultas son "lo de este local
-- entre estas dos fechas".
create index if not exists idx_em_tardeo on public.eventos_metrica(tardeo_id, created_at desc);
create index if not exists idx_em_local  on public.eventos_metrica(local_id,  created_at desc);
create index if not exists idx_em_dj     on public.eventos_metrica(dj_id,     created_at desc);
create index if not exists idx_em_tipo   on public.eventos_metrica(tipo, created_at desc);

alter table public.eventos_metrica enable row level security;

-- Escribir puede cualquiera: si solo pudieran los registrados, la mitad de las
-- visitas no se contarían y las estadísticas mentirían por abajo.
--
-- Se restringe lo que se puede escribir: solo estos tipos, y `profile_id` tiene
-- que ser el suyo o ir vacío. Sin eso, cualquiera podría inflar las métricas de
-- un local o atribuirle visitas a otra persona.
drop policy if exists "em_insert" on public.eventos_metrica;
create policy "em_insert" on public.eventos_metrica
  for insert with check (profile_id is null or profile_id = auth.uid());

-- LEER es otra cosa. Las estadísticas de un local son suyas y de nadie más:
-- son información comercial. Cada uno ve lo suyo; el admin, todo.
drop policy if exists "em_select" on public.eventos_metrica;
create policy "em_select" on public.eventos_metrica
  for select using (
    public.is_admin()
    or (local_id is not null and public.owns_tardeo(local_id))
    or (tardeo_id is not null and exists (
          select 1 from public.tardeos t where t.id = tardeo_id and public.owns_tardeo(t.local_id)))
    or (dj_id is not null and exists (
          select 1 from public.djs d where d.id = dj_id and d.profile_id = auth.uid()))
  );

-- Nadie borra ni edita métricas, ni siquiera su dueño: un histórico que se
-- puede retocar no vale para enseñárselo a nadie.

-- Resumen por día de un local, listo para pintar una gráfica.
--
-- En una función y no consultando desde el navegador porque cruza tardeos con
-- métricas, y hacerlo fuera obligaría a traerse todas las filas al cliente.
create or replace function public.metricas_local(
  p_local uuid,
  p_desde timestamptz default now() - interval '30 days',
  p_hasta timestamptz default now()
)
returns table (dia date, tipo text, total bigint)
language sql stable security definer set search_path = public as $$
  select date_trunc('day', e.created_at)::date as dia, e.tipo, count(*) as total
    from public.eventos_metrica e
    left join public.tardeos t on t.id = e.tardeo_id
   where (e.local_id = p_local or t.local_id = p_local)
     and e.created_at >= p_desde and e.created_at <= p_hasta
     -- El dueño o un admin. Va DENTRO de la función porque es security definer:
     -- sin esto, cualquiera podría pedir las métricas de cualquier local.
     and (public.is_admin() or public.owns_tardeo(p_local))
   group by 1, 2
   order by 1;
$$;

revoke all on function public.metricas_local(uuid, timestamptz, timestamptz) from public;
grant execute on function public.metricas_local(uuid, timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
