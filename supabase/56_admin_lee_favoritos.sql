-- =====================================================================
-- Lote 56 · El admin puede LEER los guardados (favoritos) de cualquiera
-- =====================================================================
-- La tabla `favoritos` existe en producción pero no sale de ningún lote del
-- repo, y su RLS solo deja a cada persona ver los suyos. En la ficha de
-- usuario del admin (/admin/usuarios/[id]) los guardados salían siempre 0
-- aunque la persona tuviera (comprobado con service role).
--
-- Solo añade una política de LECTURA para admins. No toca las existentes ni
-- deja escribir a nadie más. Se puede pegar varias veces.
-- =====================================================================

-- `favoritos` existe en producción pero no sale de ningún lote: si no
-- estuviera, se salta sin error (así el paquete entero nunca se corta aquí).
do $$
begin
  if to_regclass('public.favoritos') is null then
    raise notice 'No hay tabla public.favoritos: lote 56 sin efecto';
    return;
  end if;
  execute 'alter table public.favoritos enable row level security';
  execute 'drop policy if exists "favoritos_admin_lee" on public.favoritos';
  execute 'create policy "favoritos_admin_lee" on public.favoritos for select using (public.is_admin())';
end $$;
