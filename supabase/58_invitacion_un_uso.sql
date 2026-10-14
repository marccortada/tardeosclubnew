-- =========================================================
-- TardeosClub · LOTE 58: una invitación solo se usa una vez
-- Aplicar en Supabase → SQL Editor, después del Lote 57. Se puede pegar más
-- de una vez sin romper nada (solo redefine una función).
--
-- Por qué: `invitaciones.usada_por` tiene `on delete set null`. Si la cuenta
-- que reclamó la ficha se borra, `usada_por` vuelve a null y la invitación
-- parecía sin usar: el mismo enlace servía otra vez. `usada_en` no se borra
-- nunca, así que es la marca fiable de «ya usada».
--
-- Es la función del Lote 10 tal cual, con dos cambios:
--   1) también rechaza si `usada_en is not null`;
--   2) `for update` al leer la invitación, para que dos personas que abran el
--      mismo enlace a la vez no la gasten las dos.
-- =========================================================

create or replace function public.reclamar_invitacion(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  inv      public.invitaciones;
  v_uid    uuid := auth.uid();
  v_nombre text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Entra con tu cuenta para reclamar la ficha.');
  end if;

  select * into inv from public.invitaciones where token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Esta invitación no existe.');
  end if;
  -- `usada_en` además de `usada_por`: ver la cabecera del lote.
  if inv.usada_por is not null or inv.usada_en is not null then
    return jsonb_build_object('ok', false, 'error', 'Esta invitación ya se ha usado.');
  end if;
  if inv.expira_en < now() then
    return jsonb_build_object('ok', false, 'error', 'Esta invitación ha caducado. Pide una nueva.');
  end if;

  -- El 'is null' del where es lo que evita robar una ficha que ya tiene dueño,
  -- aunque alguien reutilice un enlace antiguo.
  if inv.tipo = 'local' then
    update public.locales set owner_id = v_uid
      where id = inv.ficha_id and owner_id is null
      returning nombre into v_nombre;
  else
    update public.djs set profile_id = v_uid
      where id = inv.ficha_id and profile_id is null
      returning nombre_artistico into v_nombre;
  end if;

  if v_nombre is null then
    return jsonb_build_object('ok', false, 'error', 'Esta ficha ya tiene dueño.');
  end if;

  update public.invitaciones
     set usada_por = v_uid, usada_en = now()
   where id = inv.id;

  return jsonb_build_object('ok', true, 'tipo', inv.tipo, 'nombre', v_nombre);
end; $$;

-- Igual que en el Lote 10: anónimo no.
revoke all on function public.reclamar_invitacion(text) from public, anon;
grant execute on function public.reclamar_invitacion(text) to authenticated;
