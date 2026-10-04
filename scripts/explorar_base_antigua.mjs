import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const OLD_URL = process.env.OLD_SUPABASE_URL;
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(OLD_URL, OLD_KEY);

async function explorar() {
  const tablas = ['venues', 'events', 'djs', 'profiles'];
  for (const tabla of tablas) {
    console.log(`\nTabla: ${tabla}`);
    const { data, error } = await supabase.from(tabla).select('*').limit(1);
    if (error) {
      console.error(`Error leyendo ${tabla}:`, error.message);
    } else if (data && data.length > 0) {
      console.log("Muestra de datos:", JSON.stringify(data[0], null, 2));
    } else {
      console.log("La tabla está vacía.");
    }
  }
}

explorar();
