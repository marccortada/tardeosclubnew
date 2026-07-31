-- =========================================================
-- TardeosClub · LOTE 9: SEGURIDAD — columnas privilegiadas
-- Aplicar en Supabase → SQL Editor (después del Lote 1).
-- =========================================================
--
-- PROBLEMA QUE ARREGLA
-- Las políticas RLS de UPDATE ("perfil_update", "locales_update", ...) dejan
-- a cada usuario modificar SU PROPIA fila, pero no dicen QUÉ COLUMNAS puede
-- tocar. Con la anon key (que es pública) cualquiera podía hacer:
--
--   supabase.from('profiles').update({ is_admin: true }).eq('id', miId)   -> admin
--   supabase.from('locales').update({ verificado: true }).eq('id', miLocal) -> sello falso
--   supabase.from('tardeos').update({ destacado_hasta: '2099-01-01' })      -> destacado gratis
--
-- SOLUCIÓN
-- Un trigger BEFORE INSERT OR UPDATE por tabla que, si quien escribe NO es
-- admin, deja las columnas privilegiadas con su valor anterior (en INSERT,
-- con el valor por defecto seguro). No lanza error: ignora el cambio en
-- silencio, así ningún flujo legítimo se rompe si el cliente reenvía la fila
-- entera. Los paneles de admin siguen funcionando igual (pasan por is_admin()).
--
-- Se hace con trigger y NO con "revoke update (col)" porque el admin usa el
-- mismo rol 'authenticated' desde el navegador: un revoke de columna también
-- se lo quitaría a él.
-- =========================================================

-- 1) PROFILES.is_admin -------------------------------------
create or replace function public.proteger_profiles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.is_admin := false;
  else
    new.is_admin := old.is_admin;
  end if;
  return new;
end; $$;

drop trigger if exists trg_proteger_profiles on public.profiles;
create trigger trg_proteger_profiles before insert or update on public.profiles
  for each row execute function public.proteger_profiles();

-- 2) LOCALES.verificado / estado ---------------------------
-- El local se da de alta como 'borrador' y es el admin quien lo verifica y
-- lo pasa a 'activo' (o a 'oculto_impago' si deja de pagar). Sin esto, un
-- local impagado podía volver a ponerse 'activo' él solo.
create or replace function public.proteger_locales()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.verificado := false;
    new.estado     := 'borrador';
  else
    new.verificado := old.verificado;
    new.estado     := old.estado;
  end if;
  return new;
end; $$;

drop trigger if exists trg_proteger_locales on public.locales;
create trigger trg_proteger_locales before insert or update on public.locales
  for each row execute function public.proteger_locales();

-- 3) DJS.verificado / reputacion_score ---------------------
-- reputacion_score la calcula el trigger del Lote 7 a partir de las reseñas
-- aprobadas. Nadie debe poder escribirla a mano.
--
-- OJO: el Lote 7 (recalc_reputacion_dj) SÍ tiene que poder escribirla, y lo
-- hace en la sesión del usuario que deja la reseña (que no es admin). Para
-- distinguir "lo escribe el sistema" de "lo escribe un usuario", el Lote 7 se
-- redefine abajo marcando la transacción con app.recalc_reputacion = 'on'.
create or replace function public.proteger_djs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.verificado        := false;
    new.reputacion_score  := 0;
  else
    new.verificado        := old.verificado;
    -- Solo el recálculo automático de reputación puede tocar esta columna.
    if coalesce(current_setting('app.recalc_reputacion', true), '') <> 'on' then
      new.reputacion_score := old.reputacion_score;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_proteger_djs on public.djs;
create trigger trg_proteger_djs before insert or update on public.djs
  for each row execute function public.proteger_djs();

-- 4) TARDEOS.destacado_hasta -------------------------------
-- "Destacado" es producto de pago (§21.1 del análisis). El dueño del tardeo
-- puede editarlo todo MENOS regalarse el destacado.
create or replace function public.proteger_tardeos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.destacado_hasta := null;
  else
    new.destacado_hasta := old.destacado_hasta;
  end if;
  return new;
end; $$;

drop trigger if exists trg_proteger_tardeos on public.tardeos;
create trigger trg_proteger_tardeos before insert or update on public.tardeos
  for each row execute function public.proteger_tardeos();

-- 5) LOTE 7 revisado: marcar el recálculo como "escritura del sistema" ----
-- Misma lógica que en 07_reputacion_dj.sql, pero marcando la transacción
-- (el 'true' final = solo dura esta transacción) para que proteger_djs()
-- deje pasar la escritura de reputacion_score.
create or replace function public.recalc_reputacion_dj()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dj  uuid;
  v_avg numeric;
begin
  if coalesce(new.objetivo_tipo, old.objetivo_tipo) <> 'dj' then
    return coalesce(new, old);
  end if;

  v_dj := coalesce(new.objetivo_id, old.objetivo_id);

  select round(avg(r.puntuacion)::numeric, 2)
    into v_avg
  from public.resenas r
  where r.objetivo_tipo = 'dj'
    and r.objetivo_id = v_dj
    and r.estado = 'aprobada';

  if v_avg is not null then
    perform set_config('app.recalc_reputacion', 'on', true);
    update public.djs set reputacion_score = v_avg where id = v_dj;
    perform set_config('app.recalc_reputacion', 'off', true);
  end if;

  return coalesce(new, old);
end; $$;

-- =========================================================
-- COMPROBACIÓN
--
-- 1) Con una sesión de usuario NORMAL (no admin):
--      update public.profiles set is_admin = true where id = auth.uid();
--    devuelve "UPDATE 1" pero is_admin sigue en false.
--
--      update public.tardeos set destacado_hasta = now() + interval '1 year'
--      where id = '<un tardeo tuyo>';
--    devuelve "UPDATE 1" pero destacado_hasta sigue igual.
--
-- 2) Con tu sesión de ADMIN, verificar un local desde /admin sigue funcionando.
--
-- 3) Dejar una reseña de DJ y aprobarla desde /admin/moderacion:
--    la reputación del DJ debe actualizarse sola.
-- =========================================================
