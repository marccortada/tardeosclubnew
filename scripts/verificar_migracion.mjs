import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(NEW_URL, NEW_KEY);

async function verificar() {
  console.log("--- VERIFICANDO DATOS EN BASE NUEVA ---\n");

  const tablas = [
    { nombre: 'profiles', campo: 'id' },
    { nombre: 'djs', campo: 'id' },
    { nombre: 'locales', campo: 'id' },
    { nombre: 'tardeos', campo: 'id' },
  ];

  for (const t of tablas) {
    const { count, error } = await supabase.from(t.nombre).select(t.campo, { count: 'exact', head: true });
    if (error) {
      console.error(`Error contando ${t.nombre}:`, error.message);
    } else {
      console.log(`✅ ${t.nombre}: ${count} registros.`);
    }
  }
}

verificar();
