-- =============================================================
-- TardeosClub · LOTE 49: BOTÓN E IMAGEN DE LOS POP-UPS
-- =============================================================
-- Hasta ahora todos los pop-ups llevaban el mismo botón fijo («Ver tardeos»,
-- a /tardeos) y ninguno podía llevar imagen. Para anunciar una promoción hace
-- falta mandar a SU página (la ficha del tardeo, la del local, un formulario)
-- y poder enseñar el cartel.
--
-- Todo es opcional y con `if not exists`: se puede pegar varias veces. La app
-- funciona sin este lote (los pop-ups salen con el botón de siempre y sin
-- imagen); el panel avisa de que falta.
-- =============================================================

alter table public.popups add column if not exists cta_texto  text;
alter table public.popups add column if not exists cta_url    text;
alter table public.popups add column if not exists imagen_url text;

-- Solo rutas internas ("/algo", nunca "//host") o enlaces https. Es la misma
-- regla que aplica el panel antes de guardar; aquí por si alguien escribe
-- directamente en la tabla.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'popups_cta_url_check') then
    alter table public.popups
      add constraint popups_cta_url_check
      check (
        cta_url is null
        or (cta_url like '/%' and cta_url not like '//%' and cta_url not like '/\\%')
        or cta_url like 'https://%'
      );
  end if;
end $$;

notify pgrst, 'reload schema';
