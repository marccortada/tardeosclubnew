#!/bin/bash
# Aplica un lote SQL en la base de PRODUCCIÓN (Supabase, proyecto NUEVO).
#
#   bash scripts/aplicar-sql.sh supabase/PEGAR_75.sql   # aplica un lote
#   bash scripts/aplicar-sql.sh --probar                # solo prueba la conexión (no cambia nada)
#
# Por qué existe: hasta el 18-oct cada lote lo pegaba una persona en el SQL
# Editor. Esto hace lo mismo desde aquí con la conexión de .env.local
# (SUPABASE_DB_URL + SUPABASE_DB_PASSWORD; ese fichero no se sube a GitHub).
#  - Solo acepta el proyecto nuevo (fmbzcjsbyazkzsiiykto): nunca la base vieja.
#  - Se para en el primer error (ON_ERROR_STOP). Lo que un lote ya confirmó con
#    su propio COMMIT queda; el resto no. Los lotes son idempotentes.
#  - Igual que el SQL Editor, entra sin sesión de usuario: los scripts de datos
#    marcan su transacción como servidor (CLAUDE.md §8).
#  - La contraseña va por PGPASSWORD, nunca en la línea de órdenes ni en pantalla.
set -euo pipefail
cd "$(dirname "$0")/.."

leer() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
URL=$(leer SUPABASE_DB_URL)
PASS=$(leer SUPABASE_DB_PASSWORD)
[ -n "$URL" ] || { echo "Falta SUPABASE_DB_URL en .env.local" >&2; exit 1; }
[ -n "$PASS" ] || { echo "Falta SUPABASE_DB_PASSWORD en .env.local" >&2; exit 1; }
case "$URL" in *fmbzcjsbyazkzsiiykto*) ;; *) echo "La URL no es la del proyecto NUEVO (fmbzcjsbyazkzsiiykto): no sigo." >&2; exit 1;; esac

PSQL=$(command -v psql || echo /opt/homebrew/opt/postgresql@16/bin/psql)
export PGPASSWORD="$PASS" PGSSLMODE=require PGCONNECT_TIMEOUT=15

if [ "${1:-}" = "--probar" ]; then
  "$PSQL" "$URL" -X -tA -c "select 'Conexión correcta: ' || current_database() || ', ' || (select count(*) from public.tardeos) || ' tardeos'"
  exit 0
fi

f="${1:?Uso: bash scripts/aplicar-sql.sh <fichero.sql> | --probar}"
[ -f "$f" ] || { echo "No existe $f" >&2; exit 1; }
echo "▸ Aplicando $f en producción…"
"$PSQL" "$URL" -X -v ON_ERROR_STOP=1 -f "$f"
echo "▸ Hecho: $f"
