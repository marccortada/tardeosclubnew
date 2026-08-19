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

echo "▸ Compilando para $NEXT_PUBLIC_SITE_URL"
npm run build

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

echo "▸ Reiniciando"
ssh "$SERVIDOR" "pm2 restart $PROCESO --update-env >/dev/null && sleep 4"

echo "▸ Comprobando"
FALLOS=0
comprobar() {
  local ruta="$1" espera="$2"
  local codigo
  codigo=$(curl -s -o /dev/null -w '%{http_code}' "https://crm.gnerai.com$ruta")
  if [ "$codigo" = "$espera" ]; then
    printf '   ok   %-46s %s\n' "$ruta" "$codigo"
  else
    printf '   MAL  %-46s %s (esperaba %s)\n' "$ruta" "$codigo" "$espera"
    FALLOS=$((FALLOS + 1))
  fi
}
comprobar "/" 200
comprobar "/tardeos" 200
comprobar "/mapa" 200
# La imagen propia es la que se perdía. Va aquí para que un despliegue que la
# rompa no se dé por bueno.
comprobar "/_next/image?url=%2Fbranding%2Flogo-transp.png&w=256&q=75" 200
comprobar "/api/buscar-sitio" 200

echo "   canónica: $(curl -s https://crm.gnerai.com/ | grep -oE 'rel="canonical" href="[^"]*"' | head -1)"

if [ "$FALLOS" -gt 0 ]; then
  echo "▸ $FALLOS comprobación(es) mal. NO te fíes de este despliegue."
  exit 1
fi
echo "▸ Listo."
