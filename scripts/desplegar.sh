#!/usr/bin/env bash
#
# Despliega a crm.gnerai.com.
#
# Existe porque desplegar a mano se rompió justo así: el rsync del build lleva
# `--delete` sobre toda la carpeta del servidor, y `public/` NO forma parte del
# build de Next, así que lo borraba. Un despliegue dejaba la web sin logo, sin
# chinchetas y sin ninguna imagen propia, y el error no salía en el build ni en
# los tipos: solo un 500 del optimizador de imágenes que hay que ir a buscar.
#
# Las tres exclusiones de abajo son el arreglo, y por eso van comentadas una a
# una: quitar cualquiera de ellas vuelve a romper lo mismo.
#
# Uso:  bash scripts/desplegar.sh
set -euo pipefail

SERVIDOR="root@46.101.185.148"
DESTINO="/var/www/tardeosclub"
PROCESO="tardeosclub"

# El dominio tiene que entrar en el BUILD, no solo en el .env del servidor:
# NEXT_PUBLIC_* se incrusta en el paquete al compilar. Si se compila con el
# valor de .env.local, la web publicada anuncia enlaces a localhost:3000 en la
# canónica, en el og:url que usa WhatsApp y en las 102 URLs del sitemap.
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://crm.gnerai.com}"

# La clave pública de las notificaciones push también va en el BUILD, y tiene
# que ser la PAREJA de la privada con la que el servidor envía (está en su
# .env). Se lee de allí y no de .env.local: el 15-oct se compiló en un Mac sin
# ella y en producción «Activar notificaciones» decía «Falta configurar las
# notificaciones en el servidor» a todo el mundo, sin que nada avisara.
if [ -z "${NEXT_PUBLIC_VAPID_PUBLIC_KEY:-}" ]; then
  NEXT_PUBLIC_VAPID_PUBLIC_KEY=$(ssh "$SERVIDOR" \
    "grep -E '^NEXT_PUBLIC_VAPID_PUBLIC_KEY=' $DESTINO/.env | head -1 | cut -d= -f2- | tr -d '\"\r'")
fi
if [ -z "$NEXT_PUBLIC_VAPID_PUBLIC_KEY" ]; then
  echo "▸ Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en $DESTINO/.env del servidor: sin ella no funcionan las notificaciones. No despliego."
  exit 1
fi
export NEXT_PUBLIC_VAPID_PUBLIC_KEY

echo "▸ Compilando para $NEXT_PUBLIC_SITE_URL"
npm run build

# Que la clave haya entrado de verdad en el JavaScript del navegador.
if ! grep -rqF "$NEXT_PUBLIC_VAPID_PUBLIC_KEY" .next/static; then
  echo "▸ El build no lleva la clave pública de notificaciones. No despliego."
  exit 1
fi

echo "▸ Subiendo el servidor"
rsync -az --delete .next/standalone/ "$SERVIDOR:$DESTINO/" \
  --exclude '.env' \
  `# el .env del servidor tiene claves que no existen aquí` \
  --exclude 'public' \
  `# public/ no está en el build: sin esto, --delete lo borra` \
  --exclude '.next/static'
  # static se sube aparte justo abajo; sin esto, --delete lo borra y hay unos
  # segundos con la web sin CSS ni JavaScript

echo "▸ Subiendo estáticos"
rsync -az --delete .next/static/ "$SERVIDOR:$DESTINO/.next/static/"

echo "▸ Subiendo public/"
rsync -az --delete --exclude '.DS_Store' public/ "$SERVIDOR:$DESTINO/public/"

# sharp, con los binarios de LINUX.
#
# Aquí se compila en un Mac, así que el node_modules que sube el rsync lleva
# sharp-darwin-arm64: en el droplet no carga, Next se queda sin optimizador y
# sirve CADA IMAGEN a tamaño completo. La portada pesaba 2,2 MB solo de foto de
# cabecera —y en un móvil con mala cobertura eso no llega a cargar: es
# exactamente "se ha caído la foto del inicio"—.
#
# No basta con el sharp de la raíz: `next/dist/server/image-optimizer.js` hace
# require("sharp") y Node resuelve ANTES el que hay en next/node_modules. Hay
# que reponer los dos.
#
# La copia buena vive en /root/sharp-linux, instalada una vez en el servidor:
#   mkdir -p /root/sharp-linux && cd /root/sharp-linux
#   npm init -y && npm install sharp@0.35.3
# Si algún día sube la versión de sharp en package.json, hay que repetirlo ahí.
echo "▸ Reponiendo sharp de Linux"
ssh "$SERVIDOR" 'S=/root/sharp-linux/node_modules
  for D in /var/www/tardeosclub/node_modules /var/www/tardeosclub/node_modules/next/node_modules; do
    # Next 16 ya no crea next/node_modules en el standalone: si no existe, no
    # hay sharp anidado que reponer (y cp llenaba la salida de errores falsos).
    [ -d "$D" ] || continue
    for P in $(ls "$S" | grep -v "^\."); do rm -rf "$D/$P"; cp -R "$S/$P" "$D/$P"; done
  done
  # La caché guarda lo ya servido: si quedó de una vez sin sharp, seguiría
  # devolviendo el original sin optimizar aunque ahora sí se pueda.
  rm -rf /var/www/tardeosclub/.next/cache/images'

echo "▸ Reiniciando"
ssh "$SERVIDOR" "pm2 restart $PROCESO --update-env >/dev/null && sleep 4"

echo "▸ Comprobando"
# Mientras la web esté en mantenimiento (snippets/tardeos-app.conf), el público recibe
# un 503 en todo: las comprobaciones entran con la llave del equipo, que solo vive en el
# servidor. Sin llave (ya lanzado), la cookie vacía no cambia nada.
LLAVE=$(ssh "$SERVIDOR" 'cat /root/tardeos-llave-equipo.txt 2>/dev/null' || true)
COOKIE="tc_acceso=$LLAVE"
FALLOS=0
comprobar() {
  local ruta="$1" espera="$2"
  local codigo
  codigo=$(curl -s -b "$COOKIE" -o /dev/null -w '%{http_code}' "https://crm.gnerai.com$ruta")
  if [ "$codigo" = "$espera" ]; then
    printf '   ok   %-46s %s\n' "$ruta" "$codigo"
  else
    printf '   MAL  %-46s %s (esperaba %s)\n' "$ruta" "$codigo" "$espera"
    FALLOS=$((FALLOS + 1))
  fi
}
comprobar "/" 200
comprobar "/eventos" 200
comprobar "/djs" 200
comprobar "/nexo" 200
# Desde la versión 2.0 /tardeos y /mapa redirigen a /eventos.
comprobar "/tardeos" 307
# La imagen propia es la que se perdía. Va aquí para que un despliegue que la
# rompa no se dé por bueno.
comprobar "/_next/image?url=%2Fbranding%2Flogo-transp.png&w=256&q=75" 200
comprobar "/api/buscar-sitio" 200

# Que el optimizador OPTIMICE, no solo que responda 200. Cuando sharp no carga
# devuelve el original tal cual con un 200 tan válido como este.
TIPO=$(curl -s -b "$COOKIE" -H 'Accept: image/avif,image/webp,*/*' -o /dev/null -w '%{content_type}' \
  'https://crm.gnerai.com/_next/image?url=%2Fimg%2Fhero.jpg&w=640&q=75')
if [ "$TIPO" = "image/webp" ] || [ "$TIPO" = "image/avif" ]; then
  printf '   ok   %-46s %s\n' "optimizador de imágenes" "$TIPO"
else
  printf '   MAL  %-46s %s (sharp no está optimizando)\n' "optimizador de imágenes" "$TIPO"
  FALLOS=$((FALLOS + 1))
fi

echo "   canónica: $(curl -s -b "$COOKIE" https://crm.gnerai.com/ | grep -oE 'rel="canonical" href="[^"]*"' | head -1)"

if [ "$FALLOS" -gt 0 ]; then
  echo "▸ $FALLOS comprobación(es) mal. NO te fíes de este despliegue."
  exit 1
fi
echo "▸ Listo."
