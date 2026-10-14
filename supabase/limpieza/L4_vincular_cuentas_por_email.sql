-- L4 · Que los dueños de la web antigua entren a SU ficha
-- Proyecto TardeosClub · limpieza de datos tras la migración doble · 14-oct-2026
-- PROBLEMA: de 263 perfiles solo 8 tienen cuenta real de acceso. Los dueños de locales y DJs
-- migrados son "perfiles fantasma": nadie puede entrar como ellos, así que no pueden gestionar
-- su ficha en la web nueva.
-- SOLUCIÓN: cuando alguien confirma su email (con Google, código por email o contraseña) y
-- ese email coincide con un perfil fantasma, se le pasan SUS fichas, favoritos e inscripciones.
-- NUNCA se traspasa el permiso de administrador.
-- Solo vincula con email CONFIRMADO, para que nadie robe una ficha registrándose con el
-- email de otro.
-- Ejecutar DESPUÉS de L2 y L3 (da igual el orden respecto a L1).


alter table public.profiles add column if not exists vinculado_a uuid;

create or replace function public.vincular_cuenta_antigua(p_nuevo uuid, p_email text)
returns int
language plpgsql security definer set search_path = public, auth as $$
declare
  v_viejo record;
  r record;
  v_n int := 0;
begin
  if p_email is null or btrim(p_email) = '' then return 0; end if;

  -- Por si este trigger corre antes que el que crea el perfil
  insert into public.profiles (id, email, display_name)
  values (p_nuevo, p_email, split_part(p_email, '@', 1))
  on conflict (id) do nothing;

  for v_viejo in
    select p.id from public.profiles p
    where lower(p.email) = lower(p_email)
      and p.id <> p_nuevo
      and p.vinculado_a is null
      and not exists (select 1 from auth.users u where u.id = p.id)
  loop
    -- Todas las columnas que apuntan a un perfil (dueño de local, DJ, favoritos...)
    for r in
      select c.conrelid::regclass::text as tabla, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
        and array_length(c.conkey, 1) = 1
        and c.conrelid <> 'public.profiles'::regclass
    loop
      begin
        execute format('update %s set %I = $1 where %I = $2', r.tabla, r.col, r.col)
          using p_nuevo, v_viejo.id;
      exception when others then
        raise notice 'vincular_cuenta_antigua: % (%) -> %', r.tabla, r.col, sqlerrm;
      end;
    end loop;

    update public.profiles n set
      phone        = coalesce(n.phone, o.phone),
      display_name = coalesce(nullif(n.display_name, ''), o.display_name)
    from public.profiles o
    where n.id = p_nuevo and o.id = v_viejo.id;

    update public.profiles set vinculado_a = p_nuevo where id = v_viejo.id;
    v_n := v_n + 1;
  end loop;

  return v_n;
end $$;

revoke all on function public.vincular_cuenta_antigua(uuid, text) from public, anon, authenticated;

create or replace function public.vincular_cuenta_antigua_trg()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.vincular_cuenta_antigua(new.id, new.email);
  return new;
end $$;

revoke all on function public.vincular_cuenta_antigua_trg() from public, anon, authenticated;

drop trigger if exists trg_vincular_cuenta_antigua on auth.users;
create trigger trg_vincular_cuenta_antigua
  after insert or update of email_confirmed_at on auth.users
  for each row when (new.email_confirmed_at is not null)
  execute function public.vincular_cuenta_antigua_trg();

-- Cuentas que ya existen y están confirmadas (hoy son 8)
select u.email, public.vincular_cuenta_antigua(u.id, u.email) as perfiles_vinculados
from auth.users u where u.email_confirmed_at is not null;

-- COMPROBACIÓN
-- select count(*) from public.profiles where vinculado_a is not null;
-- select count(*) from public.locales where owner_id in (select id from auth.users);
