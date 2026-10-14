/**
 * Cuatro cuentas de prueba, una por portal: admin, tardícola, DJ y local.
 *
 *   node scripts/cuentas-prueba.mjs           crea (o resetea) las cuatro
 *   node scripts/cuentas-prueba.mjs --borrar  las borra con sus fichas
 *
 * Para enseñar y revisar cada portal sin tocar cuentas reales:
 *  - Los emails son de un dominio que no existe (@prueba.tardeosclub.com) y se
 *    crean ya confirmados: no se envía ningún correo.
 *  - Las contraseñas se generan al azar y se guardan en
 *    `.env.cuentas-prueba.local` (ignorado por git), nunca en pantalla.
 *  - Las fichas van marcadas «[PRUEBA]» y NO salen en la web: el local queda
 *    en borrador (sin aprobar) y el DJ oculto. Sus tardeos tampoco se verían.
 *
 * Usa la service role de `.env.local`. Escribe en la base: se ejecuta solo
 * cuando se decide crear las cuentas.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local"); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const FICHERO = ".env.cuentas-prueba.local";
const CUENTAS = [
  { rol: "admin", email: "admin@prueba.tardeosclub.com", nombre: "Admin de prueba" },
  { rol: "tardicola", email: "tardicola@prueba.tardeosclub.com", nombre: "Tardícola de prueba" },
  { rol: "dj", email: "dj@prueba.tardeosclub.com", nombre: "DJ de prueba" },
  { rol: "local", email: "local@prueba.tardeosclub.com", nombre: "Local de prueba" },
];

const clave = () => randomBytes(9).toString("base64url");

async function buscar(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === email);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function borrar() {
  for (const c of CUENTAS) {
    const u = await buscar(c.email);
    if (!u) { console.log(`· ${c.rol}: no existe`); continue; }
    await sb.from("locales").delete().eq("owner_id", u.id).like("nombre", "[PRUEBA]%");
    await sb.from("djs").delete().eq("profile_id", u.id).like("nombre_artistico", "[PRUEBA]%");
    const { error } = await sb.auth.admin.deleteUser(u.id);
    console.log(error ? `✗ ${c.rol}: ${error.message}` : `✓ ${c.rol}: borrada`);
  }
}

async function crear() {
  const lineas = ["# Cuentas de prueba (no subir). Generado por scripts/cuentas-prueba.mjs", ""];
  for (const c of CUENTAS) {
    const password = clave();
    let u = await buscar(c.email);
    if (u) {
      const { error } = await sb.auth.admin.updateUserById(u.id, { password, email_confirm: true });
      if (error) throw error;
    } else {
      const { data, error } = await sb.auth.admin.createUser({
        email: c.email, password, email_confirm: true, user_metadata: { display_name: c.nombre },
      });
      if (error) throw error;
      u = data.user;
    }
    // El perfil lo crea el disparador de alta; se completa por si acaso.
    const { error: eP } = await sb.from("profiles")
      .upsert({ id: u.id, email: c.email, display_name: c.nombre, is_admin: c.rol === "admin" }, { onConflict: "id" });
    if (eP) throw eP;

    if (c.rol === "local") {
      const { data: hay } = await sb.from("locales").select("id").eq("owner_id", u.id).limit(1);
      if (!hay?.length) {
        const { error } = await sb.from("locales").insert({
          owner_id: u.id, nombre: "[PRUEBA] Local de prueba", tipo: "local", estado: "borrador",
          zona: "Mataró", direccion: "La Riera 1, Mataró", lat: 41.5381, lng: 2.4445,
          descripcion: "Ficha de prueba para revisar el panel del local. No sale en la web.",
        });
        if (error) throw error;
      }
    }
    if (c.rol === "dj") {
      const { data: hay } = await sb.from("djs").select("id").eq("profile_id", u.id).limit(1);
      if (!hay?.length) {
        const { error } = await sb.from("djs").insert({
          profile_id: u.id, nombre_artistico: "[PRUEBA] DJ de prueba", oculto: true,
          bio: "Perfil de prueba para revisar el panel del DJ. No sale en la web.",
        });
        if (error) throw error;
      }
    }
    lineas.push(`# ${c.rol.toUpperCase()}`, `PRUEBA_${c.rol.toUpperCase()}_EMAIL=${c.email}`, `PRUEBA_${c.rol.toUpperCase()}_CLAVE=${password}`, "");
    console.log(`✓ ${c.rol}: ${c.email}`);
  }
  writeFileSync(FICHERO, lineas.join("\n"));
  console.log(`\nContraseñas guardadas en ${FICHERO} (ignorado por git).`);
}

const borrarModo = process.argv.includes("--borrar");
(borrarModo ? borrar() : crear()).catch((e) => { console.error("✗", e.message ?? e); process.exit(1); });
