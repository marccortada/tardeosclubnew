-- OBSOLETO: NO EJECUTAR. Sustituido por supabase/47_presskit_y_arreglos.sql.
-- La política "djs_presskit_select" (USING (true)) hace visibles los DJs
-- ocultos, porque las políticas de lectura se suman con OR. La columna se crea
-- en el lote 47 y sin políticas nuevas.

ALTER TABLE public.djs ADD COLUMN IF NOT EXISTS presskit_url text;
CREATE POLICY "djs_presskit_select" ON public.djs FOR SELECT USING (true);
CREATE POLICY "djs_presskit_update" ON public.djs FOR UPDATE USING (profile_id = auth.uid() or public.is_admin());
