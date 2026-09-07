-- =========================================================
-- TardeosClub · LOTE 40: MEDIR TAMBIÉN LOS CLICS DE CONTACTO
-- Aplicar en Supabase → SQL Editor.
--
-- Hoy se mide el clic a comprar la entrada y el de apuntarse a lista. Falta
-- todo lo demás que hace alguien que ya se ha decidido: escribir por WhatsApp,
-- abrir el Instagram del local, ir a su web, reservar mesa, mirar cómo llegar
-- o pedir un taxi para volver.
--
-- Es justo lo que pide el punto E-05 de la auditoría, y no es un capricho de
-- métricas: un local que recibe treinta WhatsApps al mes desde la ficha tiene
-- un argumento para renovar, y hoy no hay forma de enseñárselo.
--
-- UN SOLO TIPO Y NO SEIS. `clic_contacto` con el canal en `detalle`
-- ('whatsapp', 'instagram', 'web', 'reservas', 'mapa', 'taxi'). Seis tipos
-- obligarían a tocar esta restricción cada vez que se añade un canal, y a
-- cambiar todas las consultas que agrupan por tipo. Con el canal en `detalle`
-- se agrupa igual de bien y añadir uno nuevo no toca la base.
-- =========================================================

alter table public.eventos_metrica drop constraint if exists eventos_metrica_tipo_check;
alter table public.eventos_metrica add constraint eventos_metrica_tipo_check check (tipo in (
  -- Lote 34
  'vista_tardeo', 'vista_local', 'vista_dj',
  'clic_entrada', 'clic_lista', 'inscripcion', 'favorito',
  -- Lote 36
  'vista_home', 'vista_listado', 'vista_mapa',
  'busqueda', 'busqueda_vacia', 'filtro',
  'para_ti_visto', 'para_ti_clic',
  -- Este lote: el canal va en `detalle`
  'clic_contacto'
));

notify pgrst, 'reload schema';
