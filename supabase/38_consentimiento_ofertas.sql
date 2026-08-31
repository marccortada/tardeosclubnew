-- =========================================================
-- TardeosClub · LOTE 38: EL PERMISO PARA MANDAR OFERTAS
-- Aplicar en Supabase → SQL Editor.
--
-- La política de privacidad dice que los emails de ofertas se mandan "con tu
-- consentimiento (puedes retirarlo)", y que a los locales traídos de la app
-- antigua "les pediremos permiso otra vez". Pero ese permiso no se pedía en
-- ninguna parte ni se guardaba en ninguna columna, así que la pantalla de
-- ofertas solo podía hacer una cosa: mandárselo a todo el mundo o a nadie.
--
-- Aquí se guarda. Dos columnas y no una:
--
--   `acepta_ofertas`    -> si ahora mismo quiere recibirlas.
--   `acepta_ofertas_en` -> CUÁNDO dijo que sí.
--
-- La segunda no es un lujo: el RGPD no pide solo tener el consentimiento, pide
-- poder DEMOSTRARLO. Un booleano suelto no demuestra nada —no dice si lo marcó
-- la persona al registrarse o alguien por su cuenta un martes—, y el día que
-- alguien pregunte por qué recibe un email, la respuesta tiene que tener fecha.
-- =========================================================

alter table public.profiles add column if not exists acepta_ofertas boolean not null default false;
alter table public.profiles add column if not exists acepta_ofertas_en timestamptz;

-- Por defecto FALSE, y es lo que toca: un consentimiento que viene marcado de
-- serie no es un consentimiento. Quien no diga nada, no recibe.

-- La fecha la pone la base al cambiar el valor, no el navegador.
--
-- Si la pusiera el cliente, sería un dato que la propia persona puede escribir,
-- y entonces no prueba nada. Al retirarlo se borra la fecha: lo que queda
-- guardado es el permiso vigente, no un historial de idas y venidas que nadie
-- ha pedido conservar.
create or replace function public.sellar_consentimiento()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.acepta_ofertas_en := case when new.acepta_ofertas then now() else null end;
  elsif new.acepta_ofertas is distinct from old.acepta_ofertas then
    new.acepta_ofertas_en := case when new.acepta_ofertas then now() else null end;
  else
    -- No se cambió el permiso: la fecha se queda como estaba, venga lo que
    -- venga en la petición.
    new.acepta_ofertas_en := old.acepta_ofertas_en;
  end if;
  return new;
end; $$;

-- Disparador aparte y no metido en `proteger_profiles`, que ya existe: aquel
-- impide que alguien se haga admin, y este DERIVA una fecha de un valor. Son
-- dos cosas distintas y tocan columnas distintas, así que el orden entre ellos
-- da igual. (En `tardeos` sí fusioné los dos, porque allí los dos hacían lo
-- mismo: proteger columnas de quien no es admin.)
drop trigger if exists trg_sellar_consentimiento on public.profiles;
create trigger trg_sellar_consentimiento
  before insert or update on public.profiles
  for each row execute function public.sellar_consentimiento();

-- Y que se recoja EN EL ALTA, que es donde se pregunta.
--
-- El perfil lo crea este disparador al registrarse, leyendo los metadatos que
-- manda el formulario. Sin tocarlo, la casilla del alta se marcaría y se
-- perdería, porque la fila de profiles ya se ha creado con el valor por
-- defecto para cuando el navegador podría actualizarla.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, acepta_ofertas)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
          coalesce((new.raw_user_meta_data->>'acepta_ofertas')::boolean, false))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

notify pgrst, 'reload schema';
