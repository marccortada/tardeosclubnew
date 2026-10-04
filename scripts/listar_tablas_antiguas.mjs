import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const OLD_URL = process.env.OLD_SUPABASE_URL;
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;

if (!OLD_URL || !OLD_KEY) {
  console.error("Faltan OLD_SUPABASE_URL o OLD_SUPABASE_SERVICE_ROLE_KEY en el .env");
  process.exit(1);
}

const supabase = createClient(OLD_URL, OLD_KEY);

async function listar() {
  console.log("--- LISTANDO TABLAS DE LA BASE ANTIGUA ---\n");
  
  const { data, error } = await supabase.rpc('get_tables'); 
  // If get_tables rpc doesn't exist, I'll try a raw query via a trick or just guess names.
  // Actually, a better way to list tables in Supabase/Postgres via API is using a specific query.
  
  // Since I don't know if get_tables exists, let's try to query information_schema.
  // But Supabase API doesn't allow direct query to information_schema usually.
  
  // I'll try to guess common names or try to read some tables I suspect.
  const posibles = ['eventos', 'locales_club', 'establecimientos', 'fiestas', 'usuarios', 'tardicolas'];
  
  for (const t of posibles) {
    const { data: d, error: e } = await supabase.from(t).select('id').limit(1);
    if (!e) {
      console.log(`✅ Tabla encontrada: ${t}`);
    }
  }
}

listar();
