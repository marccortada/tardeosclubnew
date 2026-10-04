import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const OLD_URL = process.env.OLD_SUPABASE_URL;
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;
const NEW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEW_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const oldSupa = createClient(OLD_URL, OLD_KEY);
const newSupa = createClient(NEW_URL, NEW_KEY);

async function migrateProfiles() {
  console.log("Migrando perfiles...");
  const { data: profiles, error } = await oldSupa.from('profiles').select('*');
  if (error) throw error;

  for (const p of profiles) {
    const { error: err } = await newSupa.from('profiles').upsert({
      id: p.id,
      email: p.email,
      display_name: p.full_name,
      phone: p.phone,
      avatar_url: p.avatar_url,
      created_at: p.created_at,
    });
    if (err) console.error(`Error perfil ${p.id}:`, err.message);
  }
  console.log(`✅ ${profiles.length} perfiles migrados.`);
}

async function migrateDjs() {
  console.log("Migrando DJs...");
  const { data: djs, error } = await oldSupa.from('djs').select('*');
  if (error) throw error;

  for (const d of djs) {
    const { error: err } = await newSupa.from('djs').upsert({
      id: d.id,
      profile_id: d.user_id,
      nombre_artistico: d.artist_name,
      bio: d.bio,
      estilos: d.styles,
      avatar_url: d.avatar_url,
      redes: {
        instagram: d.instagram_url,
        soundcloud: d.soundcloud_url,
        youtube: d.youtube_url,
        whatsapp: d.phone,
      },
    });
    if (err) console.error(`Error DJ ${d.id}:`, err.message);
  }
  console.log(`✅ ${djs.length} DJs migrados.`);
}

async function migrateVenues() {
  console.log("Migrando locales...");
  const { data: venues, error } = await oldSupa.from('venues').select('*');
  if (error) throw error;

  for (const v of venues) {
    const { error: err } = await newSupa.from('locales').upsert({
      id: v.id,
      owner_id: v.user_id,
      nombre: v.name || v.venue_name,
      descripcion: v.description || v.short_desc,
      direccion: v.address,
      lat: v.latitude,
      lng: v.longitude,
      email: v.email,
      fotos: v.logo_url ? [v.logo_url] : [],
      estado: 'activo',
    });
    if (err) console.error(`Error local ${v.id}:`, err.message);
  }
  console.log(`✅ ${venues.length} locales migrados.`);
}

async function migrateEvents() {
  console.log("Migrando tardeos...");
  const { data: events, error } = await oldSupa.from('events').select('*');
  if (error) throw error;

  for (const e of events) {
    const start = new Date(e.start_time);
    const end = new Date(e.end_time);
    const fecha = start.toISOString().slice(0, 10);
    const horaInicio = start.toISOString().slice(11, 16);
    const horaFin = end.toISOString().slice(11, 16);

    const { error: err } = await newSupa.from('tardeos').upsert({
      id: e.id,
      local_id: e.venue_id,
      titulo: e.title,
      descripcion: e.description,
      fecha: fecha,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      flyer_url: e.image_url,
      estilo: e.estilo_musical ? e.estilo_musical[0] : null,
      precio: e.price,
      es_de_pago: e.price_mode !== 'free',
      tiene_lista: true, // Por defecto true si es de la app antigua
      fourvenues_url: e.ticket_link,
      direccion: e.location_address,
      lat: e.location_lat,
      lng: e.location_lng,
      ambiente: e.ambiente,
      publico: e.publico,
      dress_code: e.outfit_dress_code?.[0] || null,
      tipo_evento: e.tipo_evento?.[0] || 'Tardeo',
      estado: 'publicado',
    });
    if (err) console.error(`Error evento ${e.id}:`, err.message);
  }
  console.log(`✅ ${events.length} tardeos migrados.`);
}

async function run() {
  try {
    await migrateProfiles();
    await migrateDjs();
    await migrateVenues();
    await migrateEvents();
    console.log("\n--- MIGRACIÓN COMPLETADA ---");
  } catch (e) {
    console.error("Fallo crítico en migración:", e);
  }
}

run();
