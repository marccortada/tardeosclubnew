-- =============================================================
-- TardeosClub · LOTE 72: BORRAR SORTEOS EN BORRADOR Y LO PROPIO EN ENTRE BEATS
-- =============================================================
-- El lote 67 no dejaba borrar sorteos a nadie. Un sorteo publicado no debe
-- desaparecer (hay participaciones y un ganador que auditar), pero uno en
-- BORRADOR que nunca vio nadie sí: si no, los de prueba se quedan para siempre
-- en el panel. Solo admin y solo en borrador. Idempotente.
-- =============================================================
grant delete on public.sorteos to authenticated;
drop policy if exists "sorteos_delete" on public.sorteos;
create policy "sorteos_delete" on public.sorteos
  for delete to authenticated
  using ((select public.is_admin()) and estado = 'borrador');

-- Entre Beats (lote 66) no dejaba borrar nada: quien se equivoca al publicar
-- un hilo, una respuesta o un anuncio no podía quitarlo. Lo borra su autor o
-- un admin (moderación). Al borrar un hilo se van sus respuestas (cascade).
grant delete on public.eb_hilos, public.eb_respuestas, public.eb_anuncios to authenticated;

drop policy if exists "eb_hilos_delete" on public.eb_hilos;
create policy "eb_hilos_delete" on public.eb_hilos for delete to authenticated
  using (autor = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "eb_respuestas_delete" on public.eb_respuestas;
create policy "eb_respuestas_delete" on public.eb_respuestas for delete to authenticated
  using (autor = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "eb_anuncios_delete" on public.eb_anuncios;
create policy "eb_anuncios_delete" on public.eb_anuncios for delete to authenticated
  using (autor = (select auth.uid()) or (select public.is_admin()));

notify pgrst, 'reload schema';
