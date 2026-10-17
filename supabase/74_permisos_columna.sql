-- =============================================================
-- TardeosClub · LOTE 74: PERMISOS POR COLUMNA QUE NO SURTÍAN EFECTO (17‑oct‑2026)
-- =============================================================
-- POR QUÉ: Supabase da a anon y authenticated TODOS los permisos de TABLA en
-- `public` (alter default privileges). Mientras exista el permiso de tabla, un
-- `grant insert (col)` / `grant update (col)` no limita nada y un
-- `revoke update (col)` no quita nada: Postgres mira primero la tabla. El lote
-- 73 ya lo arregló en `sets_comentarios`; aquí se hace lo mismo con el resto.
-- Patrón: se quita el permiso de TABLA (eso borra también los de columna) y se
-- vuelven a dar SOLO las columnas que usa el código.
--
--  1) nexo_envios: un DJ podía crear su envío ya «aceptado» o «emitido», con
--     nota y revisor inventados. Ahora inserta 5 columnas y nace 'pendiente'.
--  2) djs.seguidores (y provisional / creado_por): el `revoke update
--     (seguidores)` del lote 65 no hacía nada; el DJ podía ponerse 100.000
--     seguidores. Se protege con disparador (ver la explicación en 2).
--  3) sets: el DJ podía inflar likes, comentarios y guardados de sus sets.
--  4) eb_anuncios: el autor podía quitarse la retención («retenido») que pone
--     la moderación y reescribir el texto saltándose el filtro de teléfonos.
--  5) encuestas: el admin solo debe poder ocultar el comentario.
--  6) sorteos: el insert del admin, solo con las columnas del formulario
--     (ganador, semilla y resolución, solo por elegir_ganador_sorteo()).
--
-- service_role NO se toca (servidor y scripts). Las funciones SECURITY DEFINER
-- (contadores, crear_dj_provisional, reclamar…) corren como su dueño y no
-- dependen de estos permisos.
-- Idempotente (se puede pegar dos veces). No borra datos.
-- =============================================================

-- -----------------------------------------------------------------
-- 1) nexo_envios
-- -----------------------------------------------------------------
-- Código: el DJ (app/nexo/NexoRadioPagina.tsx) inserta dj_id, set_id, titulo,
-- url, descripcion; el admin (app/admin/nexo/page.tsx) actualiza estado,
-- nota_nexo, revisado_por, revisado_en, emitido_en (la política de update ya
-- es solo admin). Ambos leen y el DJ borra lo pendiente. anon no usa la tabla
-- (lo público sale por nexo_sesiones()).
revoke all on public.nexo_envios from anon;
revoke insert, update, truncate, references, trigger on public.nexo_envios from authenticated;
grant select, delete on public.nexo_envios to authenticated;
grant insert (dj_id, set_id, titulo, url, descripcion) on public.nexo_envios to authenticated;
grant update (estado, nota_nexo, revisado_por, revisado_en, emitido_en) on public.nexo_envios to authenticated;

-- Segunda llave por si algún día vuelve el permiso de tabla: lo que no sea el
-- admin nace 'pendiente' y sin datos de revisión, y no cambia nada de eso.
-- SECURITY INVOKER a propósito: así `current_user` es quien hace la operación
-- (anon/authenticated por la API) y el servidor o una función del sistema
-- (service_role, postgres) pasan sin tocar.
create or replace function private.nexo_envios_proteger()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user::text not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.estado       := 'pendiente';
    new.nota_nexo    := null;
    new.revisado_por := null;
    new.revisado_en  := null;
    new.emitido_en   := null;
    new.created_at   := now();
  else
    new.estado       := old.estado;
    new.nota_nexo    := old.nota_nexo;
    new.revisado_por := old.revisado_por;
    new.revisado_en  := old.revisado_en;
    new.emitido_en   := old.emitido_en;
    new.created_at   := old.created_at;
  end if;
  return new;
end $$;
revoke execute on function private.nexo_envios_proteger() from public, anon, authenticated;
drop trigger if exists trg_nexo_envios_proteger on public.nexo_envios;
create trigger trg_nexo_envios_proteger
  before insert or update on public.nexo_envios
  for each row execute function private.nexo_envios_proteger();

-- -----------------------------------------------------------------
-- 2) djs: seguidores, provisional y creado_por
-- -----------------------------------------------------------------
-- ELECCIÓN: disparador, no permisos por columna. El portal DJ, /unirse, el
-- asistente de alta y FichasAdmin insertan y actualizan muchas columnas de
-- `djs` (lib/tardeos.ts actualiza con un objeto `fields` genérico); pasar a
-- lista de columnas obligaría a mantener otra lista más (ya hay la de select
-- del lote 65) y cualquier olvido rompería el guardado de fichas en
-- producción. El disparador solo fija tres columnas que ninguna pantalla
-- escribe, y no puede romper nada más.
--  - seguidores: solo el contador (contar_musica, SECURITY DEFINER). Nadie a
--    mano, tampoco el admin.
--  - provisional / creado_por: los pone crear_dj_provisional() (SECURITY
--    DEFINER); el admin puede corregirlos; el dueño no.
-- Es SECURITY INVOKER: `current_user` distingue la API (anon/authenticated)
-- de las funciones del sistema, que corren como su dueño. proteger_djs (lote
-- 73) es SECURITY DEFINER y por eso no puede hacer esta distinción.
-- El `revoke update (seguidores)` del lote 65 se deja: no estorba.
create or replace function private.djs_proteger_contadores()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user::text not in ('anon', 'authenticated') then return new; end if;
  if tg_op = 'INSERT' then
    new.seguidores := 0;
    if not public.is_admin() then
      new.provisional := false;
      new.creado_por  := null;
    end if;
  else
    new.seguidores := old.seguidores;
    if not public.is_admin() then
      new.provisional := old.provisional;
      new.creado_por  := old.creado_por;
    end if;
  end if;
  return new;
end $$;
revoke execute on function private.djs_proteger_contadores() from public, anon, authenticated;
drop trigger if exists trg_djs_proteger_contadores on public.djs;
create trigger trg_djs_proteger_contadores
  before insert or update on public.djs
  for each row execute function private.djs_proteger_contadores();

-- -----------------------------------------------------------------
-- 3) sets: contadores fuera del alcance del DJ
-- -----------------------------------------------------------------
-- Mismas columnas que el lote 65 (lib/sets.ts: crearSet inserta dj_id, titulo,
-- url, plataforma, portada, estilos, destacado, orden; actualizarSet/destacarSet
-- cambian titulo, url, plataforma, portada, estilos, destacado, orden). `oculto`
-- sigue concedida y la protege proteger_sets (solo admin). likes, comentarios,
-- guardados y contenido_id quedan para los disparadores y el servidor.
revoke insert, update, delete, truncate, references, trigger on public.sets from anon;
revoke insert, update, truncate, references, trigger on public.sets from authenticated;
grant select on public.sets to anon, authenticated;
grant insert (dj_id, titulo, url, plataforma, portada, estilos, destacado, duracion, orden)
  on public.sets to authenticated;
grant update (titulo, url, plataforma, portada, estilos, destacado, duracion, orden, oculto)
  on public.sets to authenticated;
grant delete on public.sets to authenticated;

-- -----------------------------------------------------------------
-- 4) eb_anuncios: el autor solo abre/cierra
-- -----------------------------------------------------------------
-- El lote 66 quería esto («grant update (estado)») y no surtía efecto. El
-- código (app/entre-beats/page.tsx) solo hace update({ estado }). `retenido`
-- lo cambia el admin por función. Insert y delete no cambian.
revoke update, truncate, references, trigger on public.eb_anuncios from anon, authenticated;
grant update (estado) on public.eb_anuncios to authenticated;

-- -----------------------------------------------------------------
-- 5) encuestas: el admin solo oculta el comentario
-- -----------------------------------------------------------------
-- app/admin/encuestas/page.tsx solo hace update({ comentario_oculto }). Las
-- respuestas (valoración, etc.) no se retocan ni desde el panel. Sin insert
-- directo (responder_encuesta() valida todo), como ya decía el lote 67.
revoke insert, update, truncate, references, trigger on public.encuestas from anon, authenticated;
grant update (comentario_oculto) on public.encuestas to authenticated;

-- -----------------------------------------------------------------
-- 6) sorteos: insert solo con las columnas del formulario
-- -----------------------------------------------------------------
-- app/admin/sorteos/page.tsx inserta exactamente estas columnas. El update ya
-- estaba bien (el lote 67 quitó el de tabla a authenticated); se quita también
-- a anon por coherencia (no tenía política, no cambia nada visible).
revoke insert, update, truncate, references, trigger on public.sorteos from anon;
revoke insert, truncate, references, trigger on public.sorteos from authenticated;
grant insert (titulo, descripcion, premio, bases, imagen_url, tardeo_id, zona_madre, abre, cierra, estado, responsable, created_by)
  on public.sorteos to authenticated;

notify pgrst, 'reload schema';
