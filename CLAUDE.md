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

1. **Pagos y suscripciones: presentes pero APAGADOS.** Se controla con
   `ajustes.planes_activos`. No tocar la lógica de `lib/planes.ts`,
   `lib/cuotas.ts`, `lib/estados.ts`, `lib/ajustes.ts`: solo presentación. Donde
   se enseñe una suscripción, debe verse "Desactivado / próximamente".
2. **Nada de borrar datos importantes** sin enseñar antes cuántas filas y tener
   un "sí" explícito.
3. Aplazado por el cliente, **no desarrollar**: Meet Zone, créditos, tablón.
4. Accesibilidad 30+: botones ≥ 44–48 px, texto ≥ 15–16 px, alto contraste.
   Español de España, frases cortas.
5. Comentarios del código en español y explicando el **porqué**.

---

## 5. Mapa del código

```
app/                    rutas (App Router; casi todo "use client")
  page.tsx              portada / landing
  tardeos/, tardeos/[id]    listado y ficha de tardeo
  locales/[id], djs/, djs/[id], dj/[slug], mapa/   fichas públicas
  unirse/               alta de local o DJ ("¿Qué eres?")
  reclamar/             reclamar ficha con enlace de invitación (token)
  perfil/**, favoritos/ portal TARDÍCOLA ("Mi cuenta")
  local/**              portal LOCAL / EVENTO
  dj/{perfil,contenido,presskit,tardeos,resenas,ayuda}   portal DJ
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
3. Todos los portales usan `PanelShell`: barra lateral fija (no se mueve al hacer
   scroll), botón "Volver a la web", sin pie de página, pestañas en móvil.
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

Con "código por email" no entran (esos correos no existen): usar contraseña o el enlace.

---

## 7. Diseño

- Colores (tokens Tailwind): `magenta` #D61AA8 (neón `magenta-400` #FF3DCF),
  `oro` #FAC72E, `naranja`, `tinta` (texto), `tinta-suave`, `marfil` (fondos),
  `linea`/`linea-fuerte` (bordes). Estados `ok`, `aviso`, `error`.
- Tipografía: **Manrope** para todo; **Dancing Script** (`font-script`) solo
  como acento puntual en la web pública.
- Portada (`app/page.tsx`): hero con foto, franja oro, "¿Qué te apetece?",
  próximos tardeos, muro de logos, `CarruselDjs` (3 visibles, laterales
  pequeños y difuminados), pasos, CTA locales/DJs, FAQ, cierre. Animaciones
  suaves con `<Revelar />` y clases `entrar`, `acercar`, `revelar`.
- No poner carruseles nuevos salvo el de DJs (el cliente no los quiere).
- Fotos de stock: `lib/fotos.ts` (Unsplash, `unoptimized`).

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

`supabase/PEGAR_45_a_62.sql` = los lotes 45–62 juntos en un fichero (ya
aplicado en producción el 15‑oct‑2026). `supabase/limpieza/` = limpieza de
duplicados de la migración (**no aplicada**: necesita "sí" del cliente).

**Estado de los Advisors (15‑oct‑2026):** Security 0 errores, 1 aviso
("Leaked Password Protection", requiere plan Pro: descartado). Performance 0
avisos. Los "Unused index" (info) son normales con poco tráfico: **no borrarlos**.

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
Flujo: base limpia → lotes 01–44 → lote nuevo **dos veces** → probar como
`set role anon;` / `set role authenticated; set request.jwt.claim.sub='<uuid>';`.
Arrancar siempre con `LC_ALL=en_US.UTF-8` (si no, no arranca).

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
| `errores` | recibe errores del navegador (límite por IP y global) |
| `borrar-cuenta` | el usuario borra su cuenta y datos |
| `admin/usuario/[id]` | acciones de admin sobre un usuario |

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
lotes SQL que necesite el código ya aplicados.

Git: rama de trabajo `rediseno`; `main` es la estable. No subir
`AUDITORIA_Y_PLAN.md` (datos de seguridad de la web vieja) ni ningún `.env*`
salvo `.env.example`.

---

## 11. Pendiente (depende del cliente)

- Limpieza de duplicados de la migración (`supabase/limpieza/`, L0–L7):
  enseñar recuentos y pedir "sí".
- Ocultar fichas de prueba (gnerai, Interdesign, localp).
- Rotar claves VAPID si producción usa las del historial.
- Borrar las cuentas `@prueba.tardeosclub.com` al lanzar.
- Dejar un solo admin (hoy hay varias cuentas con `is_admin`).

Documentos: `README.md` (arranque), `ANALISIS.md` (producto),
`PEDIR_AL_DUENO.md` (lo que falta del dueño), `TEST_PLAN.md`.
