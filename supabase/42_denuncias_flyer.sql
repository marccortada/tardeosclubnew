-- =========================================================
-- TardeosClub · LOTE 42: DENUNCIAR UN FLYER
-- Aplicar en Supabase → SQL Editor.
--
-- La pantalla de moderación tiene una pestaña «Flyers» que hoy dice, literal,
-- que el reporte «se activará más adelante». Es el punto Q-01 de la auditoría,
-- y no es un adorno: los flyers los suben los locales sin que nadie los mire
-- antes, y en la web salen a tamaño completo en la portada.
--
-- Lo que pide la auditoría son cinco cosas, y las cinco están aquí:
--
--   CREAR CASO      -> una fila por denuncia, con su motivo.
--   GUARDAR PRUEBA  -> se copia la URL del flyer EN EL MOMENTO de denunciar.
--   AVISAR          -> `estado` empieza en 'pendiente' y sale en la cola.
--   RESOLVER        -> 'retirado' o 'desestimado', con quién y cuándo.
--   AUDITAR         -> nada se borra: la fila queda con las dos fechas.
--
-- POR QUÉ SE COPIA LA URL DEL FLYER Y NO SOLO EL ID DEL TARDEO:
-- Es la única forma de que la denuncia siga significando algo. Si solo se
-- guardara el tardeo, al local le bastaría con cambiar el flyer para que la
-- denuncia apuntara a una imagen distinta de la denunciada, y quien la revisa
-- no vería nunca lo que vio la persona que la reportó. La prueba tiene que
-- congelarse en el momento de recogerla, o no es prueba.
-- =========================================================

create table if not exists public.denuncias_flyer (
  id uuid primary key default gen_random_uuid(),
  tardeo_id uuid not null references public.tardeos(id) on delete cascade,

  -- Quién denuncia. Puede ser null: una imagen ofensiva la tiene que poder
  -- reportar quien pasaba por ahí, y obligar a registrarse para eso es
  -- garantizar que casi nadie lo haga.
  denunciante uuid references public.profiles(id) on delete set null,

  -- Lista cerrada: hace falta poder contar cuántas hay de cada tipo, y con
  -- texto libre eso no se puede. El detalle va en `mensaje`.
  motivo text not null check (motivo in (
    'ilegible',        -- no se lee, mal recortado, resolución de sello
    'no_corresponde',  -- el flyer no es de ese tardeo
    'ofensivo',        -- contenido inapropiado
    'derechos',        -- usa material de otro sin permiso
    'otro'
  )),
  mensaje text,

  -- LA PRUEBA. Ver la explicación de arriba.
  flyer_url text,

  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'retirado', 'desestimado')),

  -- Quién la resolvió y cuándo. Sirve para auditar: sin esto, «esto ya lo miró
  -- alguien» no se puede comprobar.
  resuelta_por uuid references public.profiles(id) on delete set null,
  resuelta_en timestamptz,
  nota_resolucion text,

  created_at timestamptz not null default now()
);

-- La consulta del panel es siempre «las pendientes, las más nuevas primero».
create index if not exists idx_denuncias_estado
  on public.denuncias_flyer(estado, created_at desc);

-- Una persona identificada no denuncia dos veces el mismo tardeo mientras haya
-- una pendiente. Sin esto, pulsar dos veces mete dos filas iguales en la cola.
-- No cubre a los anónimos, y es a propósito: bloquearlos exigiría guardar algo
-- que los identifique, y eso es justo lo que no queremos guardar.
create unique index if not exists uniq_denuncia_pendiente
  on public.denuncias_flyer (tardeo_id, denunciante)
  where estado = 'pendiente' and denunciante is not null;

alter table public.denuncias_flyer enable row level security;

-- Denunciar puede cualquiera, con sesión o sin ella.
drop policy if exists "denuncias_insert" on public.denuncias_flyer;
create policy "denuncias_insert" on public.denuncias_flyer
  for insert to anon, authenticated with check (true);

-- Leerlas y resolverlas, solo el admin. Una denuncia lleva dentro el texto que
-- escribió una persona sobre un negocio: no es información pública.
drop policy if exists "denuncias_select" on public.denuncias_flyer;
create policy "denuncias_select" on public.denuncias_flyer
  for select using (public.is_admin());

drop policy if exists "denuncias_update" on public.denuncias_flyer;
create policy "denuncias_update" on public.denuncias_flyer
  for update using (public.is_admin());

-- Nadie borra denuncias, ni el admin. Auditar significa que la fila se queda:
-- si se pudieran borrar, «no había ninguna denuncia» y «alguien la borró»
-- serían indistinguibles. Se resuelven, no se eliminan.

-- Quién resuelve y cuándo lo pone la BASE, no el navegador. Si lo mandara el
-- cliente, cualquiera con sesión de admin podría firmar la resolución con el
-- identificador de otro, y la auditoría dejaría de valer para nada.
create or replace function public.sellar_denuncia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado is distinct from old.estado and new.estado <> 'pendiente' then
    new.resuelta_por := auth.uid();
    new.resuelta_en  := now();
  end if;
  return new;
end; $$;

drop trigger if exists trg_sellar_denuncia on public.denuncias_flyer;
create trigger trg_sellar_denuncia
  before update on public.denuncias_flyer
  for each row execute function public.sellar_denuncia();

notify pgrst, 'reload schema';
