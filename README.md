# TardeosClub

Webapp de **tardeos** (fiestas de tarde) de la costa de Catalunya. El cliente descubre
tardeos, el local los publica con ayuda de IA, y el admin lo gobierna todo desde el móvil.

Sustituye a la web gratuita del mismo dueño, esta vez con suscripción para locales y DJs.
El análisis completo del producto está en [`ANALISIS.md`](ANALISIS.md); lo que depende del
dueño, en [`PEDIR_AL_DUENO.md`](PEDIR_AL_DUENO.md).

## Stack

| Pieza | Qué usa |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Estilos | Tailwind CSS 3 (paleta de marca en `tailwind.config.ts`) |
| Datos y login | Supabase (Postgres + Auth), con RLS |
| Leer flyers | Anthropic Claude (visión + salida estructurada) |
| Crear flyers | OpenAI `gpt-image-1` + sello estampado con `sharp` |
| Emails | Resend |
| Mapa | Leaflet |

## Arrancar en local

```bash
npm install
cp .env.example .env.local   # y rellena las claves
npm run dev
```

Abre <http://localhost:3000>.

### Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). Las imprescindibles para que
la app arranque son `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

`SUPABASE_SERVICE_ROLE_KEY` se salta el RLS: solo se usa en rutas de servidor
(`app/api/**`) y nunca debe llegar al navegador.

## Base de datos

Los ficheros de `supabase/` se aplican **en orden** desde el SQL Editor de Supabase:

| Fichero | Qué añade |
|---|---|
| `01_core.sql` | Tablas base, funciones, triggers y políticas RLS |
| `02_seed.sql` | Datos de ejemplo (locales, DJs y tardeos de prueba) |
| `03_admin.sql` | Catálogo de promociones y popups |
| `04_resenas.sql` | Reseñas con moderación |
| `05_metricas.sql` | Visitas e inscritos por tardeo |
| `06_dj_avatar.sql` | Avatar del DJ |
| `07_reputacion_dj.sql` | Reputación automática a partir de las reseñas |
| `08_inscritos_local.sql` | Listado de apuntados para el local |
| `09_seguridad.sql` | **Protege las columnas privilegiadas. No te lo saltes.** |
| `10_invitaciones.sql` | Enlaces con token para que un local o DJ reclame su ficha |
| `11_origen_migracion.sql` | `origen_id`: rastro de la app vieja, hace repetible la migración |
| `12_service_role.sql` | La service role cuenta como admin en los triggers del lote 9 |
| `13_email_local.sql` | `locales.email`: contacto del local, para mandarle la invitación |
| `14_email_no_publico.sql` | Quita `locales.email` al rol anónimo. **Aplícalo junto al 13.** |
| `15_limite_ia.sql` | El límite por hora de las rutas de IA, contado en la base |

Después, hazte admin con tu email:

```sql
update public.profiles set is_admin = true where email = 'TU_EMAIL';
```

### Por qué el lote 09 es obligatorio

Las políticas RLS dejan a cada usuario editar su propia fila, pero no limitan **qué
columnas**. Sin el lote 09, cualquiera con una cuenta podía hacerse admin, verificarse el
local solo, o regalarse el "destacado" (que es producto de pago) desde la consola del
navegador. El lote 09 añade triggers que ignoran esos cambios si quien escribe no es admin.

## Estructura

```
app/            Rutas (App Router)
  api/          Rutas de servidor: IA, emails, recordatorios
  admin/        Panel de administración (mobile-first, por widgets)
  local/        Panel del local: alta, editar, crear tardeo
  legal/        Aviso legal, privacidad y cookies
components/     Componentes compartidos
lib/            Supabase, tipos, auth de API, consultas
supabase/       SQL a aplicar en orden
scripts/        Utilidades sueltas (generador de flyers de ejemplo)
```

## Rutas de API

| Ruta | Quién puede | Notas |
|---|---|---|
| `POST /api/leer-flyer` | Local dado de alta o admin | Claude lee el flyer. 40/hora por usuario |
| `POST /api/crear-flyer` | Local dado de alta o admin | Genera imagen (se paga por llamada). 15/hora |
| `POST /api/enviar-oferta` | Solo admin | Email masivo a los locales |
| `GET/POST /api/recordatorios` | Cron con `x-cron-secret` | Avisa a los apuntados del día siguiente |

Los límites por hora son en memoria del proceso: se reinician en cada despliegue y no se
comparten entre instancias. Si algún día hay más de una instancia, hay que moverlos a
Supabase o Redis (ver `lib/apiAuth.ts`).

### Recordatorios diarios

Programa una llamada diaria a:

```bash
curl -H "x-cron-secret: $CRON_SECRET" https://TU_DOMINIO/api/recordatorios
```

## Comandos

```bash
npm run dev     # desarrollo
npm run build   # build de producción (incluye typecheck)
npm run lint    # linter
```

## Estado

MVP en construcción. Funciona el bucle de cliente (descubrir, filtrar, mapa, apuntarse) y
el de local (alta, crear tardeo leyendo o generando el flyer, publicar), más el panel de
admin y la capa de DJs.

Falta, y depende de datos del dueño (ver `PEDIR_AL_DUENO.md`):

- **Fourvenues**: la redirección con código RRPP está sin conectar (`components/AccionTardeo.tsx`).
- **Migración** de los datos de la app antigua.
- **Pasarela de pago** para las suscripciones y el destacado.
- Bilingüe ES/CA y service worker de la PWA.
