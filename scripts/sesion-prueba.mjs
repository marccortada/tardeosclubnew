// Abre una sesión de una CUENTA DE PRUEBA sin teclear contraseñas (para revisar los portales).
// uso: node scripts/sesion-prueba.mjs admin@prueba.tardeosclub.com  -> URL de localhost con la sesión
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = process.argv[2];
if (!email.endsWith("@prueba.tardeosclub.com")) { console.error("solo cuentas de prueba"); process.exit(1); }
const { data, error } = await sb.auth.admin.generateLink({ type: "magiclink", email });
if (error) { console.error(error.message); process.exit(1); }
const r = await fetch(data.properties.action_link, { redirect: "manual" });
const loc = r.headers.get("location") ?? "";
const hash = loc.includes("#") ? loc.slice(loc.indexOf("#")) : "";
if (!hash.includes("access_token")) { console.error("sin token:", loc.slice(0, 120)); process.exit(1); }
// ?tras=login: la app manda a cada cuenta a su portal, como al entrar normal.
console.log("http://localhost:3000/perfil?tras=login" + hash);
