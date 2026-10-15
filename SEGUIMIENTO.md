# Seguimiento de trabajo

Registro de lo que se revisa y se hace, en orden. Lo más nuevo, abajo.

---

## 15‑oct‑2026 · Revisión del dossier 2.0 frente al código

Dossier: `TC_Dossier_Flujos_Estado_Gnerai_14_10_2026` (20 págs.). Es el plan del
cliente, no un informe de avance. Comparado leyendo el código de la rama `rediseno`
(no probado en la app).

**Ya construido** (estaba dado por pendiente y no lo era):
- Lectura de flyers con IA (`app/api/leer-flyer`), al crear y al editar; recurrencias
  semana/15 días/mes con tope de 52 (`lib/periodicidad.ts`); borrador, vista previa,
  «Necesito ayuda» y aviso de duplicados (`app/local/crear`).
- QR imprimible del local con origen `utm_source=qr` (`app/local/qr`).
- Pop‑ups con «una vez» o «cada visita» (`app/admin/popups`, `components/PopupCliente.tsx`).
- Patrocinados identificados en Inicio, Eventos y tarjetas; destacados en admin.
- Estadísticas del local 7/30/90 días con fechas reales (`app/local/estadisticas`).
- CRM propio con «Exportar CSV» para cruzar con HubSpot (`app/admin/crm`).
- Meet Zone completa (`app/tardeos/[id]/meet`, lote 66): solo confirmados, cierre a
  fin + 72 h controlado por la base, filtro de teléfonos/emails, denuncias a la cola.
- Avisos de 1 h, de fin + vuelta segura (texto del dossier) y cambios/cancelaciones
  (`app/api/avisos`, `lib/avisos.ts`). Ajuste `avisos_1h_guardados` para guardados.

**Pendiente de verdad:**
- Cobros con PayPal (hoy «Promocionar» abre WhatsApp/email).
- Cron de avisos sin programar en el servidor (ver abajo).
- Botón «Canjear» promo en la ficha.
- Acceso sin cuenta / corte de 5 min (espera decisión del cliente).
- Lo del cliente: marca, Nexo, Instagram/WhatsApp por zona, Sergi, duplicados, eventos reales.

---

## 15‑oct‑2026 · Cron de avisos y recordatorios

**Revisado:**
- `app/api/avisos/route.ts`: pensado para cada 10 min. Idempotente (clave única por
  aviso y persona), ejecutarlo dos veces no duplica. Pide `CRON_SECRET`,
  `SUPABASE_SERVICE_ROLE_KEY` y las claves VAPID para el push.
- `app/api/recordatorios/route.ts`: una vez al día, email (Resend) a los apuntados de
  los tardeos de mañana. Idempotente con `recordatorios_enviados`. Pide además
  `RESEND_API_KEY`.
- `lib/apiAuth.ts`: el secreto solo se acepta por cabecera `x-cron-secret`.

**Fallo encontrado en `CLAUDE.md` §9:** la línea de crontab que propone usa
`$CRON_SECRET` dentro del crontab. Cron arranca con el entorno vacío, así que esa
variable no existe: la cabecera viajaría vacía, la API contestaría 401 cada 10 min y
nadie lo vería (la salida va a `/dev/null`). Hay que leer el secreto del `.env` del
servidor en cada ejecución.

**HECHO (15‑oct, 18:20):** con permiso del usuario. El acceso SSH va con la clave
`~/.ssh/id_ed25519_little_forest` (la de por defecto no entra).
- El `.env` del servidor ya tenía `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, VAPID y Resend.
- El servidor está en hora de Madrid y lo comparten otros proyectos (pilly, vigila-lince):
  sus líneas del crontab no se han tocado. Copia previa en `/root/crontab.antes-tardeos.bak`.
- Instalado `/root/tardeos-cron.sh` y las dos líneas (avisos cada 10 min, recordatorios a
  las 10:00 Madrid).
- Prueba de `/api/avisos`: **200**, `creados: 0` (no había avisos pendientes a esa hora).
- `/api/recordatorios` no se ha lanzado a mano: manda emails reales; corre mañana a las 10:00.
- Corregida la §9 de `CLAUDE.md` y quitado el punto de la §11.
- Para vigilarlo: `ssh -i ~/.ssh/id_ed25519_little_forest root@46.101.185.148 tail /var/log/tardeos-cron.log`

**Antes (bloqueado):** no se había podido entrar al servidor (`root@46.101.185.148`) ni crear el
script `scripts/programar-cron.sh` por falta de permiso. Falta comprobar:
1. Si el `.env` del servidor tiene `CRON_SECRET` (si no, crearlo y reiniciar con
   `pm2 restart tardeosclub --update-env`).
2. Que tenga `SUPABASE_SERVICE_ROLE_KEY`, las claves VAPID y `RESEND_API_KEY`.
3. Qué hay ya en el `crontab -l` del servidor.

**Plan para cuando haya permiso:** un lanzador en el servidor (`/root/tardeos-cron.sh`)
que lea `CRON_SECRET` del `.env`, haga el POST y apunte fecha, ruta y código HTTP en
`/var/log/tardeos-cron.log`; y en el crontab:

```cron
*/10 * * * * /root/tardeos-cron.sh avisos        # tardeosclub-cron
0 8 * * *    /root/tardeos-cron.sh recordatorios # tardeosclub-cron
```

(08:00 UTC = 10:00 en Madrid en invierno, 09:00‑10:00 según la época.) Después,
una ejecución a mano para ver que contesta 200, y corregir la línea de `CLAUDE.md` §9.

---

## 15‑oct‑2026 · Fallos de la prueba de punta a punta

### Contadores de admin que no cuadraban — ARREGLADO (sin desplegar)

**1. «Locales activos» 126 en Inicio frente a 122 en Fichas.**
Causa: la tabla `locales` guarda locales **y promotores**. El KPI de Inicio contaba
`estado = activo` de todo; Fichas › Locales filtra `tipo = local`. La diferencia (4)
son promotores activos.
Arreglo: `app/admin/page.tsx`, el KPI añade `.eq("tipo", "local")`.

**2. «Cola de trabajo» con cifras distintas en la fila de «Para hoy», el globo del menú
y el «N cosas esperan tu decisión».**
Causa: se contaba de dos maneras.
- Fila de «Para hoy»: RPC `cola_trabajo` (lote 69). Cuenta borradores, reclamaciones,
  denuncias de flyer, denuncias generales, ayuda, solicitudes de DJ y reservas de Coins;
  filtra por zona y **quita lo marcado como hecho/descartado**. No incluye reseñas.
- Globo del menú y cabecera: suma a mano de reseñas + flyers + reclamaciones +
  verificación + incidencias. Sin denuncias generales, sin DJ ni Coins, sin zona, y sin
  descontar lo ya hecho.

Arreglo:
- `lib/adminContadores.ts`: `leerContadores()` trae también `cola` (total de la RPC).
- `components/admin/AdminNav.tsx`: el globo de «Cola de trabajo» usa `cola` (la suma a
  mano solo si la cola no se puede leer).
- `app/admin/page.tsx`: la fila usa la misma cifra (se quita la llamada duplicada a la
  RPC) y la cabecera es `cola + reseñas`, porque las reseñas no son fuente de la cola.

Comprobado: lint limpio en los tres ficheros; tipos sin errores nuevos (el único error,
`@dnd-kit` en `ListaOrdenable.tsx`, ya estaba: paquete sin instalar en local).
**No comprobado en pantalla**: hace falta sesión de admin.

Pendiente de valorar: añadir las reseñas como fuente de `cola_trabajo` (lote 73) para
que la cola sea de verdad «todo lo pendiente en un sitio».

### Error 400 al publicar un set — SIN REPRODUCIR

Revisado `lib/sets.ts` (`crearSet`) y `app/dj/sets/page.tsx`, y la tabla `sets` del lote
65 (columnas, permisos por columna, políticas y disparador `proteger_sets`). El insert
manda solo columnas con permiso y cumple los `check`; si fallara, el error se vería en
pantalla, no solo en la consola. Así que el 400 viene de **otra petición** de esa
pantalla o de la siguiente.

Páginas públicas de música (`/djs`) en local: sin errores en consola.

No se ha podido seguir porque:
- El proyecto Supabase de TardeosClub (`fmbzcjsbyazkzsiiykto`) no está en la cuenta
  conectada a Claude (salen otros dos proyectos), así que no se ven sus registros.
- Reproducirlo necesita entrar como DJ, y las cuentas de prueba están en producción.

Para cerrarlo: entrar como DJ, publicar un set con la consola abierta y copiar la URL de
la petición que da 400 (o mirar Supabase › Logs › API filtrando por status 400).
