-- =========================================================
-- TardeosClub · LOTE 15: LÍMITE DE USO DE LA IA, EN LA BASE
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Antes el contador vivía en la memoria del proceso Node: se ponía a cero en
-- cada despliegue y cada instancia llevaba el suyo, así que con dos
-- contenedores el tope real era el doble. Como crear un flyer se paga por
-- imagen, eso es dinero.
-- =========================================================

create table if not exists public.uso_ia (
  id bigserial primary key,
  clave text not null,              -- normalmente "<uid>:<ruta>"
  creado_en timestamptz not null default now()
);

create index if not exists idx_uso_ia_clave on public.uso_ia(clave, creado_en);
create index if not exists idx_uso_ia_creado on public.uso_ia(creado_en);

-- Nadie la toca desde el navegador: solo la función de abajo y la service role.
-- Sin políticas, RLS lo deniega todo, que es justo lo que queremos.
alter table public.uso_ia enable row level security;

-- ---------------------------------------------------------
-- Cuenta los usos de la última hora y, si queda hueco, apunta uno más.
-- Devuelve true si puede seguir, false si ya llegó al tope.
--
-- El advisory lock serializa por clave dentro de la transacción: sin él, dos
-- peticiones a la vez leen el mismo recuento y las dos pasan, que es
-- precisamente lo que hay que evitar en un endpoint que cuesta dinero.
-- ---------------------------------------------------------
create or replace function public.consumir_cuota(p_clave text, p_max int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_usados int;
begin
  perform pg_advisory_xact_lock(hashtext(p_clave));

  -- Purga global: la tabla se mantiene sola en unos pocos cientos de filas.
  delete from public.uso_ia where creado_en < now() - interval '1 hour';

  select count(*) into v_usados
    from public.uso_ia
   where clave = p_clave and creado_en > now() - interval '1 hour';

  if v_usados >= p_max then
    return false;
  end if;

  insert into public.uso_ia (clave) values (p_clave);
  return true;
end; $$;

-- Solo el servidor. Desde el navegador no se llama nunca.
revoke all on function public.consumir_cuota(text, int) from public, anon, authenticated;
