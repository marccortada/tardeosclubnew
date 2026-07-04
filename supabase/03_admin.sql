-- =========================================================
-- TardeosClub · LOTE 3: Promociones + Popups
-- Aplicar en Supabase → SQL Editor (después de los lotes 1 y 2)
-- =========================================================

-- Catálogo de promociones/precios (editable por el admin)
create table if not exists public.promociones_catalogo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'Destacado',
  precio numeric,
  activo boolean not null default true,
  config jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.promociones_catalogo enable row level security;
create policy "promos_lectura"  on public.promociones_catalogo for select using (activo or public.is_admin());
create policy "promos_ins" on public.promociones_catalogo for insert with check (public.is_admin());
create policy "promos_upd" on public.promociones_catalogo for update using (public.is_admin());
create policy "promos_del" on public.promociones_catalogo for delete using (public.is_admin());

-- Popups (ofertas/noticias para clientes)
create table if not exists public.popups (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  mensaje text,
  tipo text default 'Oferta',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.popups enable row level security;
create policy "popups_lectura"  on public.popups for select using (activo or public.is_admin());
create policy "popups_ins" on public.popups for insert with check (public.is_admin());
create policy "popups_upd" on public.popups for update using (public.is_admin());
create policy "popups_del" on public.popups for delete using (public.is_admin());

-- Promociones por defecto
insert into public.promociones_catalogo (nombre, tipo, precio, activo) values
 ('Destacado 7 días','Destacado',4.99,true),
 ('Destacado Premium','Destacado',9.99,true),
 ('Impulso Instagram','Instagram',14.99,true),
 ('Pack Pro (mes)','Pack',9.99,true),
 ('Pack Premium (mes)','Pack',19.99,false),
 ('Combo: Entrada + chupito','Combo',null,true)
on conflict do nothing;
