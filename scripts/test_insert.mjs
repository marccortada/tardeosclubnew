import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(NEW_URL, NEW_KEY);

async function test() {
  const { error } = await supabase.from('locales').insert({
    id: '00000000-0000-0000-0000-000000000000',
    nombre: 'Test Local',
    owner_id: '00000000-0000-0000-0000-000000000000',
  });
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Insert exitoso");
  }
}
test();
