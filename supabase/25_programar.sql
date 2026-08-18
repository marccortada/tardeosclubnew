-- =========================================================
-- TardeosClub · LOTE 25: PROGRAMAR LA PUBLICACIÓN
-- Aplicar en Supabase → SQL Editor (base nueva).
--
-- Un local prepara los flyers de todo el mes y decide cuándo sale cada uno.
--
-- SIN CRON, a propósito. La alternativa era una tarea que cada hora cambiara
-- el estado, pero eso publica con retraso y puede fallar en silencio: el local
-- programa su fiesta para el viernes a las 10:00, la tarea no corre, y nadie
-- se entera hasta que pregunta por qué no sale. Aquí la visibilidad depende del
-- reloj: en cuanto pasa la hora, se ve. No hay nada que se pueda romper.
--
-- El reloj que manda es el del SERVIDOR (now() dentro de la política). El
-- filtro que manda la app es solo para no traerse de más: aunque alguien
-- trastee la petición con la hora cambiada, RLS no le deja ver lo que aún no
-- toca.
-- =========================================================

alter table public.tardeos add column if not exists publicar_en timestamptz;

-- Un estado nuevo en vez de reutilizar 'publicado' con fecha futura: así la
-- columna sigue diciendo la verdad de un vistazo. Un 'publicado' que no se ve
-- es justo el tipo de cosa que hace perder una tarde.
do $$
begin
  alter table public.tardeos drop constraint if exists tardeos_estado_check;
  alter table public.tardeos add constraint tardeos_estado_check
    check (estado in ('borrador','programado','publicado','finalizado','cancelado'));
end $$;

-- Los que están esperando su hora, para el calendario del local.
create index if not exists idx_tardeos_programados
  on public.tardeos(publicar_en) where estado = 'programado';

-- La política: un programado se ve cuando le llega la hora. Su dueño y el
-- admin lo ven siempre, que si no no podría revisarlo antes de que salga.
drop policy if exists "tardeos_select" on public.tardeos;
create policy "tardeos_select" on public.tardeos
  for select using (
    estado = 'publicado'
    or (estado = 'programado' and publicar_en is not null and publicar_en <= now())
    or public.owns_tardeo(local_id)
    or public.is_admin()
  );

-- `proteger_tardeos` (lote 9) solo fuerza destacado_hasta, así que el local
-- puede poner y quitar su propia fecha de publicación. Es lo que se quiere:
-- programar no da visibilidad extra, solo la retrasa.

notify pgrst, 'reload schema';
