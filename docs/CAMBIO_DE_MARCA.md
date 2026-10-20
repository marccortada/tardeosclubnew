# Cambio de marca

El cliente puede cambiar el nombre y la marca (decisión pendiente desde el 18‑oct‑2026).
Esta es la lista de todo lo que hay que tocar para que no quede ni rastro del nombre viejo.
Si añades un sitio nuevo con el nombre de la marca, apúntalo aquí.

## 1. Nombre en la interfaz (un solo fichero)

- **`lib/marca.ts`** → `MARCA.nombre`, `MARCA.dominio` y `MARCA.lema`. De aquí salen los
  títulos y metadatos de todas las páginas, los emails (`app/api/**`), los textos para
  compartir, las páginas legales, los `alt` de los logos y el JSON‑LD (`lib/seo.ts`).
- En `app/layout.tsx` queda a mano el subtítulo «Tu comunidad tardícola» (título por
  defecto y Open Graph). Cambiarlo si la nueva marca no usa «tardícola».

## 2. Ficheros estáticos (no pueden importar `lib/marca.ts`)

- **`public/manifest.json`** → `name`, `short_name`, `description`, `theme_color`
  (#E10A5A) y `background_color`.
- **`public/sw.js`** → título por defecto de las notificaciones push (`"TardeosClub"`,
  dos veces) y el comentario de cabecera. Tras cambiarlo, los móviles cogen el service
  worker nuevo en su siguiente visita.

## 3. Colores y tipografía

- **`tailwind.config.ts`** → tokens (`magenta`, `oro`, `naranja`, `noche`, `sobre-oro`…).
- **`app/globals.css`** → variables CSS de los dos temas y los degradados de marca
  (`bg-fiesta`, etc.).
- `app/layout.tsx` → `viewport.themeColor` (#D61AA8, color de la barra del navegador).
- Colores escritos a pelo en el HTML de los emails: `app/api/avisar-apuntados`,
  `app/api/recordatorios`, `app/api/enviar-oferta` (#D61AA8, #FF3DCF, #FAC72E, #2A1721).

## 4. Logos, iconos e imágenes

- Arte original en `disenyo/marca/` (fuera de `public/`) y después
  `node scripts/iconos.mjs` para regenerar los recortes de `public/branding/`.
- **`public/branding/`**:
  - `logo-transp.png` (cabeceras, pie, acceso, QR del local),
  - `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (favicon, apple‑touch, manifest),
  - `badge-96.png` (silueta de las notificaciones push),
  - `og.png` (imagen al compartir, 1200×630),
  - `pin.png`, `pin-logo.png` (chinchetas del mapa),
  - `sello.png` (sello «Recomendado por…»).
  - No son de la marca: `nexo-radio.png` (Nexo Radio) y `gnerailogo.png` (GNERAI).

## 5. Datos de contacto, dominio y servidor

- `lib/legal.ts` → `emailContacto` / `emailPrivacidad` (`@tardeosclub.com`): buzones
  reales, se cambian cuando existan los nuevos.
- `lib/seo.ts` → valor por defecto de `SITE_URL` (`https://app.tardeosclub.com`). En
  producción manda `NEXT_PUBLIC_SITE_URL`.
- Variables de entorno del servidor: `NEXT_PUBLIC_SITE_URL`, `RESEND_FROM` (remitente de
  los emails) y `VAPID_SUBJECT` (por defecto `mailto:hola@tardeosclub.app` en
  `app/api/avisos`, `app/api/avisar-apuntados` y `app/api/push/enviar`).
- Redes: `components/tardicola/InicioApp.tsx` (`URL_INSTAGRAM`) y el grupo de WhatsApp
  (`app/page.tsx`, `components/Footer.tsx`, `components/ListaTardeos.tsx`,
  `components/tardicola/InicioApp.tsx`). Número de WhatsApp en
  `components/ServiciosExternos.tsx`.
- `app/admin/crm/page.tsx` → nombre del CSV descargado (`crm-tardeosclub-…`).
- Supabase Auth → Redirect URLs y plantillas de email (en el panel de Supabase).
- Nginx y despliegue: `docs/nginx-*.conf`, `scripts/desplegar.sh` (carpeta
  `/var/www/tardeosclub` y proceso PM2 `tardeosclub`). Son nombres internos: **no hace
  falta** cambiarlos para el usuario; si se cambian, hacerlo con calma y a la vez en el
  servidor.

## 6. Lo que NO se toca

- Comentarios que hablan de `tardeosclub.com` como la web antigua (migración,
  redirecciones de `next.config.mjs`, `app/dj/[slug]`): explican de dónde viene el código.
- Identificadores de código (`whatsappTardeos`, `tc_tema`, etc.) y el `name` de
  `package.json`: no los ve nadie.
- Lotes SQL ya aplicados (`supabase/`).

## Comprobación final

```bash
grep -rn "TardeosClub\|TARDEOSCLUB" app components lib public   # solo comentarios
grep -rni "tardeosclub" app components lib public               # repasar cada uno
```
