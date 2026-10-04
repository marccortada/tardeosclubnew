import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(NEW_URL, NEW_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_tables'); // check if it exists
  if (error) {
    console.log("No se pudo obtener la lista de tablas vía RPC.");
  } else {
    console.log("Tablas:", data);
  }
}

check();
