-- =========================================================
-- TardeosClub · LOTE 24: CAMPAÑAS PEDIDAS POR LOCALES
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- §3.4: hasta ahora las campañas solo las creaba el admin a mano. Eso funciona
-- mientras se las pidan por WhatsApp; en cuanto haya diez locales, no.
--
-- El local PIDE, el admin APRUEBA, y al aprobar nace el pop-up. No se deja
-- publicar directo a propósito: un pop-up es lo único de la app que interrumpe
-- a todo el mundo, y quien lo paga no es quien decide si molesta.
-- =========================================================

create table if not exists public.campanas (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locales(id) on delete cascade,
  titulo text not null,
  mensaje text,
  tipo text not null default 'Oferta',

  -- Mismos criterios que el pop-up (lote 23).
  seg_musica       text[],
  seg_tipos_evento text[],
  seg_edades       text[],
  seg_zonas        text[],
  desde timestamptz,
  hasta timestamptz,

  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada')),
  -- El pop-up que se creó al aprobarla. Sirve para poder pararla luego.
  popup_id uuid references public.popups(id) on delete set null,
  -- Por qué se rechaza. Sin esto el local no sabe qué corregir y vuelve a pedir
  -- lo mismo.
  nota_admin text,

  created_at timestamptz not null default now(),
  revisada_at timestamptz
);

create index if not exists idx_campanas_estado on public.campanas(estado, created_at desc);
create index if not exists idx_campanas_local  on public.campanas(local_id, created_at desc);

alter table public.campanas enable row level security;

-- El local ve y pide las suyas; el admin, todas.
--
-- `owns_tardeo(local_id)` se llama así por dónde nació (lote 1, políticas de
-- tardeos), pero lo que comprueba es que ESE LOCAL sea tuyo, que es justo lo
-- que hace falta aquí. Se reutiliza en vez de duplicar la consulta.
drop policy if exists "campanas_select" on public.campanas;
create policy "campanas_select" on public.campanas for select
  using (public.owns_tardeo(local_id) or public.is_admin());

drop policy if exists "campanas_insert" on public.campanas;
create policy "campanas_insert" on public.campanas for insert
  with check (public.owns_tardeo(local_id) or public.is_admin());

-- Solo el admin cambia el estado. Si el local pudiera, se autoaprobaría.
drop policy if exists "campanas_update" on public.campanas;
create policy "campanas_update" on public.campanas for update using (public.is_admin());

drop policy if exists "campanas_delete" on public.campanas;
create policy "campanas_delete" on public.campanas for delete using (public.is_admin());

-- ---------------------------------------------------------
-- ALCANCE ESTIMADO
--
-- Cuánta gente encaja con un segmento. Es lo que convierte esto en un producto:
-- nadie paga por "a ver a cuántos llega".
--
-- security definer porque los gustos son privados —cada uno solo ve su fila— y
-- aquí hace falta contar sobre todas. Devuelve UN NÚMERO, nunca filas.
--
-- Y devuelve 0 cuando hay menos de 5, a propósito: con el número exacto se
-- podría usar como buscador de personas, afinando el segmento hasta que dé 1 y
-- deducir los gustos de alguien concreto. Un anunciante necesita saber si su
-- público son 20 o 2.000, no si es Marta.
-- ---------------------------------------------------------
create or replace function public.alcance_estimado(
  p_musica text[] default null,
  p_tipos  text[] default null,
  p_edades text[] default null,
  p_zonas  text[] default null
) returns integer
language sql stable security definer set search_path = public as $$
  with encajan as (
    select 1 from public.profiles p
    where
      -- Cada criterio vacío no restringe. Los puestos se exigen todos.
      (p_musica is null or cardinality(p_musica) = 0 or
        p.musica && p_musica
        -- Pedir una familia ("electronica") alcanza a quien marcó un estilo
        -- suyo ("electronica:afro house"), igual que en lib/segmentacion.ts.
        or exists (
          select 1 from unnest(p_musica) f, unnest(coalesce(p.musica, '{}')) s
          where position(':' in f) = 0 and s like f || ':%'
        ))
      and (p_tipos  is null or cardinality(p_tipos)  = 0 or p.tipos_evento && p_tipos)
      and (p_edades is null or cardinality(p_edades) = 0 or p.publico = any(p_edades))
      and (p_zonas  is null or cardinality(p_zonas)  = 0 or p.zonas && p_zonas)
  )
  select case when count(*) < 5 then 0 else count(*)::int end from encajan;
$$;

-- Solo con sesión: un visitante anónimo no tiene por qué poder sondear cuánta
-- gente hay ni de qué gustos.
revoke all on function public.alcance_estimado(text[], text[], text[], text[]) from public, anon;
grant execute on function public.alcance_estimado(text[], text[], text[], text[]) to authenticated;

notify pgrst, 'reload schema';
