# TardeosClub — cómo funciona todo

Guía para quien toque este proyecto (persona o IA). Si algo de aquí deja de ser
verdad, **corrígelo aquí en el mismo cambio**.

---

## 1. Qué es

Web/app (PWA instalable) de **tardeos**: fiestas de tarde en la costa de
Catalunya, para público de 30+. Móvil primero.

- El **tardícola** (público) descubre tardeos, se apunta, guarda favoritos.
- El **local / evento / promotor** publica sus tardeos (con ayuda de IA que lee el
  flyer), ve apuntados, pasa lista, invita DJs.
- El **DJ** tiene ficha pública, PressKit, contenido, acepta invitaciones.
- El **admin** gobierna todo: fichas, usuarios, destacados, moderación,
  pop-ups, push, CRM, errores e incidencias.

Sustituye a la web antigua `tardeosclub.com` (SPA React con muchos fallos).

**Versión 2.0 (15‑oct‑2026, en producción):** sigue el *Dossier 2.0* del cliente
(PDF 14‑oct + vídeo de simulación). Es una **app móvil** con barra inferior:

- **Tardícola:** Inicio · Eventos · DJs · Próxima Parada · Perfil.
- **Profesional** (DJ, local, promotor, admin): Inicio · Eventos · DJs · **Entre Beats** · Perfil.

Recorrido: descubrir → **Asistiré** (lista de espera si se llena) → **Meet Zone**
(chat del evento, cierra 72 h tras el fin) → **encuesta** → volver. Además: feed
vertical de DJs, seguir, sets, reproductor persistente, Nexo Radio dentro, sorteos,
avisos, Coins (apagado, "Próximamente"), admin por zonas. **Se usa casi siempre desde
el móvil**: el móvil manda; en escritorio basta con que se vea correcto. Pantallas
ligeras, lo justo, sin bloques de relleno. Auditoría y plan: `PLAN_DOSSIER_2.0.md`;
reparto por módulos: `docs/v2/CONTRATOS.md`. Nombre y marca pueden cambiar
(decisión del cliente, 18‑oct): **todo color/fuente va por tokens**.

---

## 2. Stack

| Pieza | Qué |
|---|---|
| Framework | Next.js 16 App Router + React 19 + TypeScript |
| Estilos | Tailwind 3 (tokens en `tailwind.config.ts`) |
| Base de datos y login | Supabase (Postgres + Auth + Storage), todo con RLS |
| IA | Anthropic Claude (leer flyers) — `app/api/leer-flyer` |
| Email | Resend |
| Push | Web Push (VAPID) |
| Mapa | Leaflet + markercluster |
| Servidor | Droplet propio (`crm.gnerai.com`), Next standalone + PM2 |

```bash
npm install
cp .env.example .env.local   # rellenar claves (ver .env.example)
npm run dev                  # http://localhost:3000
npm run build                # compila (comprueba tipos)
npm run lint                 # eslint
npx tsc --noEmit             # solo tipos
```

---

## 3. Dos proyectos de Supabase (¡no confundir!)

| | Ref | Para qué |
|---|---|---|
| **NUEVA** | `fmbzcjsbyazkzsiiykto` (Tardeosclubnew) | **Esta app.** Producción. |
| VIEJA | `obevrycebhqdqtvxnxoy` | tardeosclub.com antigua. Solo lectura, para migrar. |

Claves en `.env.local` (no se sube). La de la vieja: `OLD_SUPABASE_*`, solo para
`scripts/` de migración.

> `SUPABASE_SERVICE_ROLE_KEY` se salta RLS. **Solo** en servidor (`app/api/**`,
> `lib/apiAuth.ts`, `lib/erroresApp.ts`). Nunca con prefijo `NEXT_PUBLIC_`.

---

## 4. Reglas del cliente (no negociables)

1. **Pagos y suscripciones: presentes pero APAGADOS.** Se mostrarán como
   **"Próximamente"**; la pasarela será **PayPal** (por decidir cuándo). Se controla con
   `ajustes.planes_activos` (y `coins_activos` para Coins). No tocar la lógica de `lib/planes.ts`,
   `lib/cuotas.ts`, `lib/estados.ts`, `lib/ajustes.ts`: solo presentación. Donde
   se enseñe una suscripción, debe verse "Desactivado / próximamente".
2. **Nada de borrar datos importantes** sin enseñar antes cuántas filas y tener
   un "sí" explícito.
3. **Dossier 2.0 (14‑oct‑2026) manda**: Meet Zone, Coins (créditos) y Entre Beats
   (hilos + anuncios) ya NO están aplazados: se construyen. Aplazados: pedir taxi y
   descargar sets. Ver `PLAN_DOSSIER_2.0.md` y `docs/v2/CONTRATOS.md`.
4. Accesibilidad 30+: botones ≥ 44–48 px, texto ≥ 15–16 px, alto contraste.
   Español de España, frases cortas.
5. Comentarios del código en español y explicando el **porqué**.

---

## 5. Mapa del código

```
app/                    rutas (App Router; casi todo "use client")
  page.tsx              sin sesión: landing · con sesión: Inicio app (5 bloques)
  eventos/              Mapa · Lista · Mes + filtros desde el ADN (/tardeos y /mapa redirigen)
  tardeos/[id]          ficha (Asistiré, Quiénes van, Line-up, Meet Zone)
  tardeos/[id]/meet     Meet Zone · tardeos/[id]/encuesta  ¿Qué tal el tardeo?
  proxima-parada/       guardados + Asistiré (Próximos / Pasados)
  djs/                  feed vertical de DJs · djs/[id] perfil · djs/[id]/mensaje
  nexo/                 Nexo Radio (Escuchar · Programación · Enviar sesión)
  entre-beats/          hilos y anuncios, solo profesionales
  mensajes/             conversaciones tardícola ↔ DJ
  avisos/               bandeja de la campana · sorteos/  sorteos
  directorio/           locales · promotores · DJs (/colaboradores redirige)
  locales/[id], dj/[slug]   fichas públicas
  unirse/               alta de local o DJ ("¿Qué eres?")
  reclamar/             reclamar ficha con enlace de invitación (token)
  perfil/**             Perfil tardícola: adn, djs, sets, ajustes, notificaciones…
  local/**              portal LOCAL / EVENTO (+ coins, qr, solicitudes de DJs)
  dj/**                 portal DJ (perfil, sets, presskit, nexo, mensajes, tardeos…)
  admin/**              portal ADMIN (protegido por GuardiaAdmin)
  api/**                rutas de servidor (service role, cron, IA, push…)
  legal/**              aviso legal, cookies, privacidad
components/
  panel/PanelShell.tsx  barra lateral fija + cajón móvil de TODOS los portales
  panel/Paginacion.tsx  usePaginado, Paginacion, Buscador, Filtros, EstadoLista
  panel/CuentaNav.tsx   menú del portal tardícola
  admin/                AdminNav (barra admin), FichasAdmin, CSV, ordenar…
  cuenta/               Acceso (login/alta), AltaPortal, usePortal…
  ui/                   Campo, Chip, Hoja (modal), Tarjeta
  tardicola/            InicioApp, FichaPiezas, PerfilTardicola…
  musica/Reproductor.tsx   reproductor persistente (montado en app/layout.tsx)
  comunidad/ retorno/   Meet Zone, mensajes, denuncias · encuesta, sorteos
  CabeceraApp.tsx, BottomNav.tsx   cabecera (zona + campana) y barra de 5 pestañas
  *.tsx                 piezas públicas (TardeoCard, CarruselDjs, SiteNav…)
lib/                    lógica y acceso a datos (tardeos.ts, djs.ts, salud.ts…)
supabase/               lotes SQL numerados (ver §8)
scripts/                migración, cuentas de prueba, despliegue
public/                 imágenes, iconos, manifest, service worker
```

Piezas clave:

- `lib/supabase.ts` — cliente Supabase (timeouts: navegador ≥ 15 s).
- `lib/useAuth.ts` — sesión del usuario (objeto estable).
- `lib/inicio.ts` → `rutaDeInicio()` — **a qué portal va cada rol al entrar**.
- `lib/volver.ts` — `?volver=` seguro (solo rutas propias, sin trucos).
- `lib/rutasPanel.ts` — en qué rutas se oculta la cabecera pública / barra inferior.
- `lib/salud.ts` + `/admin/salud` — comprueba que la base tiene todo lo que el código espera.
- `lib/permisos.ts` → `useRoles()` — esAdmin / esLocal / esPromotor / esDj / **esProfesional**
  (decide la 4.ª pestaña, Entre Beats y press kit; la base lo protege con `es_profesional()`).
- `lib/qr.ts` — generador de QR propio (sin dependencias), usado en `/local/qr`.
- Modo claro/oscuro: colores como variables CSS (`app/globals.css`), `darkMode: "class"`,
  preferencia en `profiles.tema` + navegador.
- `lib/erroresApp.ts`, `components/CapturaErrores.tsx`, `/api/errores` — seguimiento de errores.

---

## 6. Roles, portales y cómo se entra

| Rol | Portal | Se detecta por |
|---|---|---|
| Admin | `/admin` | `profiles.is_admin = true` |
| Local / evento / promotor | `/local` | es dueño de una ficha en `locales` (`owner_id`) |
| DJ | `/dj` | tiene ficha en `djs` (`profile_id`) |
| Tardícola | `/perfil` | el resto |

Flujo:

1. `/perfil` sin sesión muestra **Acceso** (`components/cuenta/Acceso.tsx`):
   "Entrar" (contraseña por defecto, o código por email) y "Crear cuenta"
   (pregunta primero "¿Qué eres?").
2. Tras entrar se va a `?volver=` si existe, o a `rutaDeInicio()` según el rol.
   Un local/DJ recién dado de alta va a `/unirse?rol=…` para crear su ficha.
   El tardícola (al entrar y al crear cuenta) va al **Inicio de la app** (`/`), no
   al menú de Perfil; el ADN es opcional desde el bloque «ADN Tardícola».
   Sus pantallas de cuenta (`/perfil/ajustes`, `/perfil/notificaciones`) usan
   `MarcoCuenta` = cabecera de app con flecha a Perfil, sin barra lateral.
   `/perfil/gustos` → `/perfil/adn` y `/perfil/reservas` → `/proxima-parada`.
3. Los paneles (admin, local, DJ) usan `PanelShell`: en escritorio barra lateral
   fija; en móvil cabecera fija (☰ + nombre de la pantalla + botón «Web») y una
   fila de secciones que se va al hacer scroll. Sin pie de página. El tardícola NO
   tiene panel: su experiencia es la app (barra inferior + Perfil).
4. **Invitaciones**: el admin genera un enlace `/reclamar?token=…` para una
   ficha sin dueño; quien lo abre con sesión se convierte en dueño
   (`reclamar_invitacion`, un solo uso). Los locales invitan DJs a sus tardeos
   (`dj_invitaciones`); el DJ acepta o rechaza en `/dj/tardeos`.

### Cuentas de prueba

Cuatro cuentas, una por portal: `admin@`, `tardicola@`, `dj@`, `local@` +
`prueba.tardeosclub.com`. Contraseñas en `.env.cuentas-prueba.local` (no se sube).

```bash
node scripts/cuentas-prueba.mjs            # crearlas
node scripts/cuentas-prueba.mjs --borrar   # borrarlas (hacerlo al lanzar)
node --env-file=.env.local scripts/sesion-prueba.mjs dj@prueba.tardeosclub.com
#   → imprime un enlace http://localhost:3000/perfil?tras=login#access_token=…
#     que abre la web ya con esa sesión (solo funciona con @prueba.tardeosclub.com)
```

**Cómo entrar:** `/perfil` → "Entrar" → **"Con contraseña"** → email + contraseña del
fichero. Con "código por email" NO entran (esos correos no existen: Supabase responde
"Ese email no parece válido"). Las contraseñas son fáciles de recordar a propósito
(para enseñar la app) y **no van en este fichero porque se sube a GitHub**: están en
`.env.cuentas-prueba.local`, en la raíz, solo en el ordenador.

⚠️ Existen en la base de **producción** (la del admin es admin de verdad). Borrarlas
antes del lanzamiento con `--borrar`. Datos de prueba que siguen en producción
(todos de estas cuentas, no visibles al público): tardeo «[PRUEBA] Tardeo QA no
venir» (borrador), «[PRUEBA] Set QA» y su envío a Nexo (DJ de prueba, oculto) y un
mensaje en la Meet Zone de ese tardeo. Las pruebas que escriban en producción
deben marcar todo con «[PRUEBA]» y dejarlo oculto/borrado al acabar. `sesion-prueba.mjs` acepta `PUERTO=3001` si el
servidor local no está en el 3000.

---

## 7. Diseño

- Colores (tokens Tailwind): `magenta` #D61AA8 (neón `magenta-400` #FF3DCF),
  `oro` #FAC72E, `naranja`, `tinta` (texto), `tinta-suave`, `marfil` (fondos),
  `linea`/`linea-fuerte` (bordes). Estados `ok`, `aviso`, `error`.
- Tipografía: **Manrope** para todo; **Dancing Script** (`font-script`) solo
  como acento puntual en la web pública.
- Portada pública (`app/page.tsx`, sin sesión), pensada para móvil: hero a
  pantalla completa (titular + «Ver tardeos» / «Únete gratis» + Hoy · Este finde ·
  Cerca de mí) → próximos tardeos → «¿Qué te apetece hoy?» (6 estilos) →
  `CarruselDjs` (3 visibles, laterales pequeños y difuminados) → «Así de fácil»
  (3 pasos) → locales y DJs → FAQ (5) → cierre con WhatsApp. Sin mapa, sin franja
  dorada ni muro de logos (con pocos locales quedaba pobre). El contenido NUNCA
  depende de que arranque una animación: sin JS, con «reducir movimiento» o con la
  animación congelada se ve todo (`.con-revelar` en `<html>` lo pone `<Revelar />`).
  Fotos con `propsFoto()` de `lib/fotos.ts` (tamaño según pantalla).
- Con sesión, `/` es el Inicio de app (`components/tardicola/InicioApp.tsx`); el
  mapa se carga con `next/dynamic` solo ahí.
- No poner carruseles nuevos salvo el de DJs (el cliente no los quiere).
- Fotos de stock: `lib/fotos.ts` (Unsplash, `unoptimized`).

### Menús de panel (admin, local, DJ)

Pocas entradas en la barra (admin ~10, local 6, DJ 6). Las pantallas de una
misma entrada van en `hijas` (`ItemPanel` de `PanelShell`): cualquiera de ellas
enciende la entrada y `SeccionPanel` pinta solo las pestañas hermanas arriba
(`components/panel/SubSecciones.tsx`). Pantalla nueva = añadirla a las `hijas`
de su entrada, no una entrada nueva. Lo de pago va junto y «Próximamente».

### Listas de panel (patrón obligatorio)

Toda lista que pueda crecer va **paginada en el servidor**:

```ts
const { filas, total, pagina, setPagina, porPagina, cargando, error, quitar } =
  usePaginado((desde, hasta) =>
    supabase.from("tardeos").select("*", { count: "exact" })
      .order("fecha").order("id")          // id = desempate estable
      .range(desde, hasta), [filtro, busqueda]);
```

Y debajo `<Paginacion …/>`, arriba `<Buscador/>` + `<Filtros/>`, y
`<EstadoLista/>` para cargando/vacío/error. Ejemplo completo:
`components/admin/FichasAdmin.tsx`.

---

## 8. Base de datos

### Lotes SQL

`supabase/NN_nombre.sql`, numerados y **idempotentes** (se pueden pegar dos
veces sin romper nada). Se aplican en orden desde Supabase → SQL Editor.

- `01`–`44`: núcleo, seguridad, métricas, reseñas, invitaciones, push, CRM…
- `45`–`58`: destacados ordenables, PressKit, aforo y asistencia, pop-ups con
  CTA, `salud_lotes`, borrar cuenta, series, métricas por tardeo,
  invitaciones a DJs, incidencias + errores, invitación de un solo uso.
- `59` Security Advisor: `search_path` fijo, disparadores sin EXECUTE,
  inserciones abiertas acotadas.
- `60` Funciones con privilegios **fuera de la API** (ver abajo).
- `61` Performance Advisor: políticas con `(select auth.uid())`, políticas
  solapadas fusionadas, índices en todas las claves foráneas.
- `62` Tablas internas: política explícita "solo admin lee".
- `63` Base común v2: `es_profesional()`, `zonas` (zona madre barcelona/tarragona/girona
  + marca), `avisos` (bandeja), `auditoria` (`public.auditar`), `denuncias` genéricas,
  `profiles.alias|bio|tema`, `perfil_publico()`.
- `64` Asistiré + lista de espera (`asistire()`, `retirar_asistencia()`, promoción
  automática al liberarse plaza), `quienes_van()`, `popups_vistos`.
- `65` Música: `sets` (+ likes, guardados, comentarios con respuesta del DJ),
  `seguidores_dj`, `nexo_envios`, `nexo_programacion`, `feed_djs()`. **`djs` tiene
  permisos por columna**: `presskit_url` solo con `presskit_de()` (profesionales). Toda
  columna nueva de `djs` necesita `grant select (col) on public.djs to anon, authenticated`
  y nunca `select *` sobre `djs`.
- `66` Comunidad: Meet Zone (`meet_mensajes`, `meet_fijado`, `meet_estado`), solicitudes y
  mensajes con DJs, `bloqueos`, Entre Beats (`eb_hilos`, `eb_respuestas`, `eb_anuncios`),
  filtro de teléfonos/emails, retención con 3 denuncias, Realtime.
- `67` Retorno: `tardeo_inicio/fin`, versión de horario, `encuestas`, `sorteos`,
  `preferencias_avisos`, `resenas.tardeo_id`.
- `68` Negocio: cupos 1/2/∞ por ciclo, Fundadores (50), Coins (libro contable inmutable,
  reservas, devoluciones; `coins_activos` apagado), `promo_canjes`, `posibles_duplicados`,
  `dj_solicitudes` (vincularse / proponer evento), DJs provisionales.
- `69` Admin por zonas: `admin_roles` (zona/tarea; sin filas = admin global, compatible),
  `zona_slug` en locales/tardeos, `cola_trabajo()`, `asignaciones`, mover/promover
  inscripciones, medición (`origen`, `es_equipo`, deduplicado, `cohortes_retorno()`),
  `favoritos` documentada.
- `70` Índices duplicados que dejó el paquete. `71` `feed_djs` enseña todos los DJs.
- `72` Borrar: sorteos en **borrador** (solo admin) y hilos/respuestas/anuncios de
  Entre Beats (su autor o un admin).

Paquetes para pegar de una vez: `PEGAR_45_a_62.sql`, `PEGAR_63_a_69.sql`,
`PEGAR_70_71.sql`, `PEGAR_72.sql` — **todos aplicados en producción el 15‑oct‑2026**.
El siguiente lote libre es el **73**.
`supabase/limpieza/` = limpieza de duplicados de la migración (**no aplicada**:
necesita "sí"; recuentos con `node --env-file=.env.local scripts/limpieza-recuentos.mjs`,
solo lectura).

**Estado de los Advisors (15‑oct‑2026, tras el 71):** Security 0 errores, 1 aviso
("Leaked Password Protection", requiere plan Pro: **el cliente no quiere Pro**,
descartado). Performance 0 errores, 0 avisos. Los "Unused index" (info, ~100) son
normales con poco tráfico: **no borrarlos**.

Comprobar si un lote está en producción: `select(...).limit(1)` con la service role
(PGRST205 = no existe). **No** con `head: true`: devuelve "sin error" aunque la
tabla no exista.

### Reglas para escribir SQL nuevo

1. **Nuevo lote = nuevo fichero** con el siguiente número. Nunca editar uno ya
   aplicado en producción.
2. **Idempotente**: `create … if not exists`, `create or replace`,
   `drop policy if exists` + `create policy`, `add column if not exists`.
3. **Sin borrar datos** (nada de `delete`, `truncate`, `drop table/column`)
   salvo petición expresa.
4. **Funciones SECURITY DEFINER → en el esquema `private`**, con envoltorio
   en `public`:
   ```sql
   create or replace function private.mi_rpc(p_id uuid) returns … 
     language plpgsql security definer set search_path = public as $$ … $$;
   revoke execute on function private.mi_rpc(uuid) from public;
   grant execute on function private.mi_rpc(uuid) to authenticated, service_role;

   create or replace function public.mi_rpc(p_id uuid) returns …
     language sql security invoker set search_path = public
     as $$ select private.mi_rpc($1) $$;   -- o "select * from" si devuelve filas
   ```
   PostgREST solo publica `public`: así el código privilegiado no se puede
   llamar directamente por HTTP. (O pega tu función normal en public y vuelve
   a pasar el lote 60: la mueve sola.)
5. **Toda función** lleva `set search_path = public`.
6. **Funciones de disparador**: `revoke execute … from public, anon, authenticated`.
7. **Políticas RLS**: escribir `(select auth.uid())` y `(select public.is_admin())`,
   nunca a pelo (se evaluaría una vez por fila). **Una** política permisiva por
   tabla + acción + rol (si hacen falta dos condiciones, `or` en la misma).
8. **Toda clave foránea con índice** (`create index if not exists …`).
9. Tabla solo de servidor: RLS activado + política "solo admin lee".
10. Si el código usa algo nuevo de la base, añadir la comprobación en
    `lib/salud.ts` para que `/admin/salud` avise si falta el lote.

### Probar SQL antes de producción

Hay un Postgres 16 local (`/opt/homebrew/opt/postgresql@16/bin`) que simula
Supabase (roles `anon`/`authenticated`/`service_role`, `auth.uid()` falso).
Flujo: base limpia → lotes 01–(último) → lote nuevo **dos veces** → probar como
`set role anon;` / `set role authenticated; set request.jwt.claim.sub='<uuid>';`.
Arrancar siempre con `LC_ALL=en_US.UTF-8` (si no, no arranca). La base local NO
tiene los permisos por defecto de Supabase (`grant` sobre tablas a anon/authenticated,
`usage` en el esquema `auth`): en las pruebas hay que darlos a mano, y en los lotes
conviene ponerlos explícitos.

Pegar en producción: el modo automático de permisos de Claude Code bloquea
escribir en Supabase y desplegar aunque se autorice en el chat. Lo hace la persona:
abrir el `PEGAR_*.sql`, ⌘A ⌘C, SQL Editor → Run (si pregunta, **"Run without RLS"**:
los lotes ya activan RLS) → "Run query".

Al copiar SQL al portapapeles en macOS usar
`osascript -e 'set the clipboard to (read POSIX file "/ruta.sql" as «class utf8»)'`
(`pbcopy` estropea tildes y "·").

### Supabase Auth (panel)

- Proveedor Email con contraseña activado.
- Redirect URLs: `https://crm.gnerai.com/**` y `http://localhost:3000/**`.

---

## 9. API de servidor (`app/api/`)

| Ruta | Qué hace |
|---|---|
| `leer-flyer` | Claude lee un flyer y rellena el formulario del tardeo (límite/hora en `consumir_cuota`) |
| `buscar-sitio` | Google Places (direcciones) |
| `avisar-apuntados` | avisa a los apuntados si se cancela un tardeo (una sola vez por tardeo) |
| `push/enviar` | envía notificaciones push por segmento (admin) |
| `enviar-oferta` | email de oferta comercial (Resend) |
| `recordatorios`, `revalidar` | cron, protegidos con `x-cron-secret` |
| `avisos` | cron **cada 10 min** (lote 67): aviso 1 h antes con propuesta musical, "¿Qué tal ha ido?" + vuelta segura al acabar, cambios de hora y cancelaciones; bandeja `avisos` + push. Idempotente (clave por aviso). Probar con fecha simulada: `?ahora=2026-10-24T14:10:00Z` |
| `errores` | recibe errores del navegador (límite por IP y global) |
| `borrar-cuenta` | el usuario borra su cuenta y datos |
| `admin/usuario/[id]` | acciones de admin sobre un usuario |

Cron **programado en el servidor desde el 15‑oct** (crontab de root, hora de Madrid,
líneas marcadas `# tardeosclub-cron`; el servidor tiene cron de otros proyectos, no tocarlos):

```cron
*/10 * * * * /root/tardeos-cron.sh avisos        # tardeosclub-cron
0 10 * * *   /root/tardeos-cron.sh recordatorios # tardeosclub-cron
```

`/root/tardeos-cron.sh` lee `CRON_SECRET` del `.env` en cada ejecución (cron arranca sin
variables de entorno: poner `$CRON_SECRET` en el crontab manda la cabecera vacía y da 401)
y apunta fecha, ruta, código HTTP y respuesta en `/var/log/tardeos-cron.log`. Copia del
crontab anterior: `/root/crontab.antes-tardeos.bak`.

Retorno (lote 67): encuesta `/tardeos/[id]/encuesta` (solo confirmados, hasta fin + 72 h, lo
valida la base), bandeja `/avisos` (+ preferencias), `/sorteos`, `/admin/sorteos`,
`/admin/encuestas`. Lógica pura de horas y avisos en `lib/avisos.ts` (misma regla que
`public.tardeo_fin`). El ajuste `avisos_1h_guardados` = 'true' manda el aviso de 1 h también a
guardados (por defecto solo "Asistiré").

Errores: el navegador los manda a `/api/errores`, el servidor los agrupa por
huella en `errores_app` (máx. 500 nuevos/día). Se ven en `/admin/errores`.
Los usuarios reportan problemas con "¿Algo no funciona?" → `incidencias` →
`/admin/incidencias`.

---

## 10. Desplegar

```bash
bash scripts/desplegar.sh
```

Compila con `NEXT_PUBLIC_SITE_URL=https://crm.gnerai.com`, sube por rsync al
droplet (`/var/www/tardeosclub`), repone `sharp` de Linux y reinicia PM2.
El script explica por qué cada exclusión de rsync es necesaria: **no quitarlas**.
Antes de desplegar: `npx tsc --noEmit` y `npm run lint` sin errores, y los
lotes SQL que necesite el código ya aplicados (**primero SQL, luego despliegue**:
p. ej. con el lote 65 el código viejo ya no puede leer `presskit_url`). El script
termina en "▸ Listo." si todas las comprobaciones dan ok. Servidor:
`root@46.101.185.148`, proceso PM2 `tardeosclub`; logs con
`ssh root@46.101.185.148 'pm2 logs tardeosclub --lines 50 --nostream'`. Los
"Failed to find Server Action" en los logs tras desplegar son de pestañas abiertas
con la versión anterior: normales.

Git: rama de trabajo `rediseno`; `main` es la estable. No subir
`AUDITORIA_Y_PLAN.md` (datos de seguridad de la web vieja) ni ningún `.env*`
salvo `.env.example`.

---

## 11. Pendiente

**Del cliente (no se puede cerrar sin ellos):**
- Nombre y marca (domingo 18‑oct). Si cambian: tokens de `tailwind.config.ts` /
  `globals.css`, logos de `public/branding/`, textos con "TardeosClub".
- URL del stream de Nexo (`NEXT_PUBLIC_NEXO_STREAM_URL`) y quién recibe los envíos.
- Enlaces oficiales de Instagram y comunidad WhatsApp por zona (Inicio usa
  `instagram.com/tardeosclub`, supuesto).
- Email de Sergi → `/admin/equipo`: tarea Zona, zona Tarragona (+ su local).
  Nombre del responsable de Girona.
- "Sí" a la limpieza de duplicados (15‑oct: 794 tardeos, 59 locales, 30 DJs;
  6 métricas cuelgan de tardeos duplicados: reasignar, no borrar).
- Decidir: aviso de 1 h también a guardados (hoy no); valorar si el local te marcó
  "no vino" (hoy no); acceso sin cuenta / corte de 5 minutos.
- Cargar oferta real: hoy solo hay 1 tardeo próximo.

**Técnico:**
- Pasarela de pago con **PayPal** (suscripciones Basic/Pro/Premium, Fundador, recargas de
  Coins). Todo lo de cobro existe y está apagado: falta integrar PayPal (webhook que
  confirme el pago → `coins_movimientos` tipo compra / alta de plan) y encender
  `planes_activos` / `coins_activos`. Hasta entonces la UI dice "Próximamente".
- Borrar las cuentas `@prueba.tardeosclub.com` al lanzar; dejar un solo admin global.
- Ocultar fichas de prueba (gnerai, Interdesign, localp).
- Rotar claves VAPID si producción usa las del historial.
- Press kit en PDF: sigue en el bucket público `flyers` (la URL ya no se expone a
  no profesionales); cerrarlo del todo = bucket privado + URL firmada.
- "Desde X €" (falta columna de precio mínimo), banner/ciudad editables en
  `/dj/perfil`, botón "Canjear" promo en la ficha, `/unirse` con estado de
  validación, denunciar comentarios de sets y perfiles.
- Prueba de punta a punta (15‑oct, 4 cuentas, móvil): todo lo bloqueante e
  importante arreglado. Sin probar por falta de datos: enviar solicitud de mensaje
  a un DJ real, comentar un set, participar en un sorteo publicado, press kit de
  un DJ visible. Sin reproducir: un 400 en consola al publicar un set. Contadores
  de admin que no cuadran del todo («Cola de trabajo» de la pestaña frente a
  «Para hoy»; «Locales activos» 126 frente a 122 en Fichas).
- Git: todo está en la rama `rediseno`; `main` sigue con la versión antigua
  (4‑oct). Pasarlo a `main` cuando se decida y avisar al compañero.
- Probar en móviles reales (Android Chrome + iPhone Safari): piloto de 2 semanas
  del dossier (pág. 19). El reproductor en segundo plano depende del navegador.

Documentos: `README.md` (arranque), `ANALISIS.md` (producto),
`PEDIR_AL_DUENO.md` (lo que falta del dueño), `TEST_PLAN.md`.
