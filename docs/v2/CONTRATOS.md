# Versión 2.0 — contratos entre equipos

Lee antes: `CLAUDE.md` (cómo funciona todo y reglas de SQL) y `PLAN_DOSSIER_2.0.md`
(auditoría y plan). El dossier del cliente es la fuente de verdad. Capturas del vídeo de
simulación (mírarlas, son el diseño objetivo):
`/private/tmp/claude-501/-Users-lago-GNERAI-01-PROYECTOS-02-PROYECTOS-CLIENTE-TARDEOSCLUB/d2b5d1b0-2e66-419f-9d9e-672961a5cb66/scratchpad/video/hoja0.jpg` … `hoja5.jpg`
(fotogramas sueltos `f000.jpg`…`f089.jpg` en la misma carpeta, uno cada 2,5 s).

## Decisiones tomadas (por defecto, hasta que el cliente diga otra cosa)

1. Manda el dossier 14‑oct: **Meet Zone, Coins y Entre Beats (hilos + anuncios) SE CONSTRUYEN**.
2. Cupos de eventos por ciclo: Basic 1 · Pro 2 · Premium ilimitado.
3. Press kit: solo profesionales (`es_profesional()`).
4. `/` sin sesión = landing actual (conversión). `/` con sesión = **Inicio de app** (5 bloques).
5. Pagos (planes y Coins): todo construido y **APAGADO** (`ajustes.planes_activos`); sin pasarela.
6. Pedir taxi: aplazado → se quita. Cómo llegar se queda.
7. Nombre y marca cambian el domingo 18‑oct: **usa solo tokens** (colores, fuentes), nada de
   hex sueltos, para que el cambio sea en un sitio.

## Estética (del vídeo)

App móvil: fondo blanco / marfil, tarjetas blancas con borde fino y radio grande, botón
primario magenta sólido (`bg-magenta text-white`), chips redondeados (activo: fondo
`magenta-50` texto `magenta`), precio en píldora amarilla (`bg-oro`), etiquetas "Afín a mí"
rosa claro, "Patrocinado" en gris pequeño. Barra inferior con 5 iconos + etiqueta.
Cabecera de cada pestaña: logo izq · título centrado · campana dcha. Manrope.
Modo oscuro: todos los componentes nuevos con tokens que el equipo A convierte en variables
CSS (no uses `bg-white` a pelo en lo nuevo: usa `bg-superficie`, ver abajo).

Tokens nuevos (los crea el equipo A en `tailwind.config.ts` + `globals.css`, como variables
CSS con versión clara y oscura): `superficie` (tarjetas), `fondo` (página), `tinta`,
`tinta-suave`, `linea`. Mientras no existan, usa `bg-white`/`bg-marfil` y A los migra.

## Base de datos

- Lote **63** (`supabase/63_base_v2.sql`, ya escrito y probado): `es_profesional()`,
  `zonas` (con `zona_madre` barcelona/tarragona/girona y `marca`), `avisos` (bandeja de la
  campana; crear con `private.crear_aviso(...)` solo desde servidor/funciones), `auditoria`
  (`public.auditar(accion, entidad, id, zona, detalle)` solo admin; desde funciones,
  `private.auditar`), `denuncias` genéricas (tipo_objeto: meet_mensaje, mensaje_dj, eb_hilo,
  eb_respuesta, eb_anuncio, set_comentario, perfil, otro), `profiles.alias|bio|tema`,
  `perfil_publico(uuid[])` (alias, foto, bio: nunca email/teléfono).
- Cada equipo tiene SU lote. Nadie toca el de otro.

| Lote | Equipo |
|---|---|
| 64 | A · App tardícola |
| 65 | B · Música |
| 66 | C · Comunidad |
| 67 | D · Retorno |
| 68 | E · Profesional y negocio |
| 69 | F · Admin y medición |

- Probar en local: `scratchpad/nueva_bd.sh <tu_nombre_de_bd>` (crea base con 01‑63; usa un
  nombre propio: `t_a`, `t_b`…), luego `scratchpad/pg.sh -d t_x -f supabase/6X_….sql`
  **dos veces** (idempotente) y prueba con `set role anon;` / `set role authenticated;
  select set_config('request.jwt.claim.sub','<uuid>',false);`. Arranca el Postgres si no
  responde: `LC_ALL=en_US.UTF-8 /opt/homebrew/opt/postgresql@16/bin/pg_ctl -D scratchpad/pg -o "-p 55433 -k /tmp/tcpg -c listen_addresses=''" -l scratchpad/pg.log start`.
- **NUNCA** ejecutes nada en Supabase de producción. El coordinador aplica los lotes.
- Reglas de CLAUDE.md §8 obligatorias: idempotente, sin borrar datos, SECURITY DEFINER en
  `private` con envoltorio invoker en `public`, `(select auth.uid())`, una política
  permisiva por tabla/acción/rol, índice en cada FK, grants explícitos
  (`grant select … to anon, authenticated` — en local no hay privilegios por defecto),
  `notify pgrst, 'reload schema'` al final.
- Si el código usa algo de tu lote, que **degrade bien** si el lote aún no está aplicado
  (error 42P01/42883/PGRST202 → mensaje "Falta el lote 6X", nunca pantalla rota).

## Rutas y propiedad de ficheros

Solo editas lo tuyo. Si necesitas algo de otro equipo, enlaza a su ruta (contrato) aunque
aún no exista. Ficheros compartidos: solo **añadir** (no reescribir).

| Equipo | Rutas / ficheros propios |
|---|---|
| **A · App tardícola** | `tailwind.config.ts`, `app/globals.css`, `components/BottomNav.tsx`, `components/SiteNav.tsx`, `components/TopBar.tsx`, cabecera de app nueva, `app/page.tsx` (+ Inicio app), `app/eventos/**` (nuevo: Mapa/Lista/Mes), `app/tardeos/page.tsx` y `app/mapa` (redirigir a /eventos), `app/tardeos/[id]/page.tsx` (ficha), `components/AccionTardeo.tsx`, `app/proxima-parada/**` (nuevo; `/favoritos` redirige), `app/perfil/**` (perfil tardícola, Mi ADN), `app/colaboradores` → directorio, `components/PopupCliente.tsx`, `lib/tardicola.ts`, `components/ListaTardeos.tsx`, `components/Mapa*.tsx`, lote 64 (lista de espera, popups_vistos, ADN zona/presupuesto) |
| **B · Música** | `app/djs/**` (feed `/djs` + perfil `/djs/[id]`), `app/dj/**` **excepto** `app/dj/tardeos` y `app/dj/mensajes`, `app/nexo/**`, `components/musica/**` (incl. `Reproductor.tsx`: ya montado en layout, impleméntalo), `components/ContenidoDj.tsx`, `ContenidoPublicoDj.tsx`, `Playlist.tsx`, `DjCard.tsx`, `lib/djs.ts`, `lib/sets.ts` (nuevo), lote 65 (seguidores_dj, sets, likes, guardados, comentarios + respuesta DJ, nexo_envios, press kit solo profesionales) |
| **C · Comunidad** | `app/tardeos/[id]/meet/**` (Meet Zone), `app/entre-beats/**`, `app/mensajes/**` (tardícola), `app/dj/mensajes/**` (bandeja DJ), `app/admin/denuncias/**`, `components/comunidad/**`, `lib/meet.ts`, `lib/mensajes.ts`, `lib/entreBeats.ts`, `lib/denuncias.ts` (solo añadir), lote 66 |
| **D · Retorno** | `app/api/avisos/**` (cron), `app/api/recordatorios` (ampliar), `app/avisos/**` (bandeja de la campana), `app/tardeos/[id]/encuesta/**`, `app/sorteos/**`, `app/admin/sorteos/**`, `app/admin/encuestas/**`, `components/retorno/**`, `lib/avisos.ts`, `lib/encuestas.ts`, `lib/sorteos.ts`, `public/sw.js`, lote 67 (avisos programados, encuestas, sorteos, `resenas.tardeo_id`) |
| **E · Profesional y negocio** | `app/local/**`, `app/dj/tardeos/**` (invitaciones + DJ solicita vínculo / propone evento), `app/unirse`, `lib/cuotas.ts`, `lib/planes.ts`, `lib/promociones.ts`, `lib/periodicidad.ts`, `components/EstadisticasLocal.tsx`, `PrecioTardeo.tsx`, `PromoTardeo.tsx`, `PromocionesDeTardeo.tsx`, `app/admin/suscripciones`, `app/admin/promociones`, `app/admin/coins/**` (nuevo), `app/local/coins/**` (nuevo), lote 68 (cupos por ciclo, coins ledger, promo_canjes, duplicados, solicitudes de vínculo DJ/evento propuesto) |
| **F · Admin y medición** | `app/admin/**` (todo lo demás), `components/admin/**` (incl. `AdminNav.tsx`), `lib/metricas.ts`, `lib/estadisticas.ts`, `lib/salud.ts`, `lib/zonas.ts`, `lib/adminContadores.ts`, `supabase/limpieza/**`, lote 69 (admin_roles zona/tarea + funciones RLS, colas con responsable, listas/espera editables, cohortes, utm/origen, deduplicado, excluir equipo, documentar `favoritos`/`flyers`) |

`lib/tardeos.ts` es compartido (A y E): **solo añadir funciones nuevas**, no cambiar las
existentes. `lib/permisos.ts` (`useRoles()`: esAdmin/esLocal/esPromotor/esDj/esProfesional)
ya existe: úsalo.

### Rutas‑contrato (enlaza aunque aún no existan)

| Ruta | Dueño | Qué |
|---|---|---|
| `/` (con sesión) | A | Inicio app |
| `/eventos` | A | Mapa · Lista · Mes + filtros |
| `/tardeos/[id]` | A | Ficha |
| `/tardeos/[id]/meet` | C | Meet Zone |
| `/tardeos/[id]/encuesta` | D | ¿Qué tal el tardeo? |
| `/proxima-parada` | A | Guardados |
| `/perfil` · `/perfil/adn` | A | Perfil · Mi ADN |
| `/directorio` | A | Locales · Promotores · DJs |
| `/djs` · `/djs/[id]` | B | Feed · perfil DJ |
| `/nexo` | B | Nexo Radio (Escuchar · Programación · Enviar sesión) |
| `/djs/[id]/mensaje` | C | Enviar solicitud de mensaje al DJ |
| `/mensajes` | C | Mis conversaciones con DJs |
| `/dj/mensajes` | C | Solicitudes de mensaje (DJ) |
| `/entre-beats` | C | Hilos · Anuncios (solo profesionales) |
| `/avisos` | D | Bandeja de la campana |
| `/sorteos` · `/sorteos/[id]` | D | Sorteos |
| `/local/coins` | E | Monedero del local |
| `/admin/denuncias` | C | Cola de denuncias genéricas |
| `/admin/sorteos` · `/admin/encuestas` | D | — |
| `/admin/coins` | E | — |

Barra inferior (A): **tardícola** Inicio · Eventos · DJs · Próxima Parada · Perfil;
**profesional** Inicio · Eventos · DJs · Entre Beats · Perfil (Próxima Parada dentro de Perfil).
Su panel (/local, /dj, /admin) se abre desde Perfil.

Menú de admin: F es dueño de `AdminNav.tsx`. Los demás equipos, si crean páginas de admin,
**añaden una sola línea** en el grupo que toque, sin tocar el resto.

## Calidad

- `npx tsc --noEmit` y `npm run lint` sin errores **en tus ficheros** (otros equipos trabajan
  a la vez: si ves errores ajenos, ignóralos).
- Servidor de desarrollo ya corriendo en `http://localhost:3001` (no arranques otro). Comprueba
  tus páginas con `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ruta` y, para
  verlas, `scratchpad/shot.sh` (Chrome headless). Cuentas de prueba: CLAUDE.md §6.
- Móvil primero (375 px), botones ≥ 44 px, texto ≥ 15 px, español de España, comentarios del
  porqué en español.
- No commits, no push, no `npm install`, no tocar producción.
- Al acabar, informe: qué hiciste (por requisito del dossier), ficheros, lote SQL y cómo lo
  probaste, qué queda pendiente o necesita a otro equipo.
