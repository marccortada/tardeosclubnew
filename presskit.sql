ALTER TABLE public.djs ADD COLUMN IF NOT EXISTS presskit_url text;
CREATE POLICY "djs_presskit_select" ON public.djs FOR SELECT USING (true);
CREATE POLICY "djs_presskit_update" ON public.djs FOR UPDATE USING (profile_id = auth.uid() or public.is_admin());
