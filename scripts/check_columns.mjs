import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(NEW_URL, NEW_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_columns_of_table', { table_name: 'tardeos' });
  if (error) {
    // If RPC doesn't exist, I'll just try a select and see the keys of the first result
    const { data: row, error: e } = await supabase.from('tardeos').select('*').limit(1);
    if (e) {
      console.error("Error:", e.message);
    } else if (row && row.length > 0) {
      console.log("Columnas encontradas:", Object.keys(row[0]));
    } else {
      console.log("Tabla vacía, no puedo sacar las columnas.");
    }
  } else {
    console.log("Columnas:", data);
  }
}

check();
