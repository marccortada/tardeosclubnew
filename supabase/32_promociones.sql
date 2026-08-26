-- =========================================================
-- TardeosClub · LOTE 32: LA PROMOCIÓN COMO COSA PROPIA
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Puntos 15 y 16 del documento. Hasta ahora una promoción era un par de
-- campos sueltos dentro del tardeo (`promo_titulo`, `promo_texto`): no tenía
-- código, ni fechas, ni límite de usos, ni a quién va dirigida, y no se podía
-- enseñar en dos sitios sin copiarla.
--
-- Y sobre todo: el pop-up ERA la promoción. Eso mezcla dos cosas distintas.
-- Una promoción es "2x1 hasta las 21 h con el código VERANO"; el pop-up es uno
-- de los sitios donde se puede enseñar, como la tarjeta del tardeo o su ficha.
-- Aquí la promoción vive por su cuenta y el canal se decide después.
--
-- Las fechas (punto 16) NO son decorativas: la política de lectura de abajo
-- solo deja ver las vigentes, así que una promoción se enciende y se apaga
-- sola sin que nadie tenga que acordarse de retirarla.
-- =========================================================

create table if not exists public.promociones (
  id uuid primary key default gen_random_uuid(),

  -- A qué va pegada. Una de las dos, no las dos ni ninguna:
  --   tardeo -> "2x1 en ESTE tardeo"
  --   local  -> "los martes, chupito de bienvenida"
  tardeo_id uuid references public.tardeos(id) on delete cascade,
  local_id  uuid references public.locales(id) on delete cascade,
  constraint promo_va_pegada_a_algo check (
    (tardeo_id is not null and local_id is null)
    or (tardeo_id is null and local_id is not null)
  ),

  nombre text not null,
  -- Qué te llevas. Separado del nombre porque el nombre va en la etiqueta
  -- pequeña de la tarjeta y esto en la ficha, donde hay sitio para explicarlo.
  beneficio text,
  -- Opcional: hay promociones que no necesitan código ("entrada libre hasta
  -- las 20 h") y forzar uno obligaría a inventárselo.
  codigo text,

  desde timestamptz,
  hasta timestamptz,

  -- Cuántas veces se puede usar en total. NULL = sin tope.
  limite_usos integer check (limite_usos is null or limite_usos > 0),
  usos integer not null default 0,

  -- Interruptor manual, además de las fechas: sirve para pararla en caliente
  -- sin tener que tocar el calendario.
  activa boolean not null default true,

  -- A quién va dirigida. Mismos nombres y mismo significado que en `popups`
  -- (lote 23): cada criterio vacío es "sin restricción". Repetir la forma es
  -- lo que permite que una promoción se pueda mandar por el canal del pop-up
  -- sin traducir nada.
  seg_musica       text[],
  seg_tipos_evento text[],
  seg_edades       text[],
  seg_zonas        text[],

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_promos_tardeo on public.promociones(tardeo_id);
create index if not exists idx_promos_local  on public.promociones(local_id);

drop trigger if exists trg_promos_updated on public.promociones;
create trigger trg_promos_updated before update on public.promociones
  for each row execute function public.set_updated_at();

-- ¿Está viva ahora mismo?
--
-- Un solo sitio con la regla. Repartida entre la política, la app y el panel
-- acabaría desincronizada, y el día que se desincronice alguien enseñará una
-- promoción caducada o esconderá una viva.
create or replace function public.promo_vigente(p public.promociones)
returns boolean language sql stable set search_path = public as $$
  select p.activa
     and (p.desde is null or p.desde <= now())
     and (p.hasta is null or p.hasta >= now())
     and (p.limite_usos is null or p.usos < p.limite_usos);
$$;

-- ¿Puede esta persona tocarla? El dueño del local al que pertenece —directo o
-- a través del tardeo— o un admin.
create or replace function public.puede_editar_promo(p_tardeo uuid, p_local uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (p_local is not null and exists (
            select 1 from public.locales l where l.id = p_local and l.owner_id = auth.uid()))
      or (p_tardeo is not null and exists (
            select 1 from public.tardeos t
              join public.locales l on l.id = t.local_id
             where t.id = p_tardeo and l.owner_id = auth.uid()));
$$;

alter table public.promociones enable row level security;

-- El público solo ve las vigentes. Aquí es donde el punto 16 deja de ser una
-- promesa: una promoción caducada no es que no se pinte, es que no se puede
-- leer. Su dueño y el admin las ven todas, también las apagadas.
drop policy if exists "promos_select" on public.promociones;
create policy "promos_select" on public.promociones
  for select using (
    public.promo_vigente(promociones) or public.puede_editar_promo(tardeo_id, local_id)
  );

drop policy if exists "promos_insert" on public.promociones;
create policy "promos_insert" on public.promociones
  for insert with check (public.puede_editar_promo(tardeo_id, local_id));

drop policy if exists "promos_update" on public.promociones;
create policy "promos_update" on public.promociones
  for update using (public.puede_editar_promo(tardeo_id, local_id));

drop policy if exists "promos_delete" on public.promociones;
create policy "promos_delete" on public.promociones
  for delete using (public.puede_editar_promo(tardeo_id, local_id));

notify pgrst, 'reload schema';
