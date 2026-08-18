-- =========================================================
-- TardeosClub · LOTE 23: POP-UPS SEGMENTADOS POR ADN
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- §3.4 del documento: los pop-ups son el espacio publicitario, y lo que los
-- hace vendibles es poder pedir un público concreto. Sin esto solo se puede
-- decir "a todos" o "a los registrados", que no es un producto.
--
-- OJO con `publico`, que ya existe desde el lote 17 y es OTRA COSA: segmenta
-- por ROL (anónimo, registrado, local, DJ). Lo de aquí segmenta por GUSTOS.
-- Se llaman seg_* precisamente para que no se confundan al leer el código.
--
-- Cada criterio vacío significa "sin restricción". Un pop-up con seg_musica y
-- nada más llega a quien le guste esa música, tenga la edad que tenga.
-- =========================================================

alter table public.popups add column if not exists seg_musica       text[];
alter table public.popups add column if not exists seg_tipos_evento text[];
alter table public.popups add column if not exists seg_edades       text[];
alter table public.popups add column if not exists seg_zonas        text[];

-- §3.5: el tope lo pone TardeosClub, no cada campaña.
--
-- `repetir_horas` limita cada pop-up por separado. Eso no basta: con diez
-- campañas activas, cada una respetando su frecuencia, al usuario le salta un
-- cartel tras otro. Esto limita el total del día, que es lo que de verdad
-- protege al tardícola de la propia monetización.
create table if not exists public.ajustes (
  clave text primary key,
  valor text not null,
  actualizado_at timestamptz not null default now()
);

insert into public.ajustes (clave, valor) values ('popups_max_dia', '3')
  on conflict (clave) do nothing;

alter table public.ajustes enable row level security;

-- Lectura abierta: el navegador necesita saber el tope para respetarlo, y no
-- hay nada sensible en "3". Escritura solo admin.
drop policy if exists "ajustes_lectura" on public.ajustes;
create policy "ajustes_lectura" on public.ajustes for select using (true);
drop policy if exists "ajustes_escritura" on public.ajustes;
create policy "ajustes_escritura" on public.ajustes for all using (public.is_admin());

notify pgrst, 'reload schema';
