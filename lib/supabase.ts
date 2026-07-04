import { createClient } from "@supabase/supabase-js";

// Cliente público (anon). Vale para lectura pública en server y cliente.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
