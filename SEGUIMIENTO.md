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

---

## 15‑oct‑2026 · Despliegue a crm.gnerai.com

- Desplegado el commit `5fade89` (contadores de admin) con `bash scripts/desplegar.sh`:
  todas las comprobaciones `ok` y «▸ Listo.».
- Antes hizo falta `npm install`: faltaba `@dnd-kit` en `node_modules` de este Mac y el
  build no habría compilado.
- SSH: el script usa `ssh root@46.101.185.148` sin clave explícita; en este Mac hay que
  cargar antes la clave con `ssh-add ~/.ssh/id_ed25519_little_forest`.
- GitHub por SSH con la misma clave:
  `GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_little_forest" git push git@github.com:marccortada/tardeosclubnew.git rediseno`

---

## 17‑oct‑2026 · Auditoría a fondo (último commit + seguridad + lógica + móvil) y arreglos

**Último commit (`5fade89`, contadores de admin):** correcto; «Cola de trabajo» y «por
verificar» cuentan igual en todas partes.

**Arreglado en código:**
- Push: el build desplegado no llevaba `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (comprobado en el JS
  público): nadie podía activar notificaciones. `desplegar.sh` la lee del `.env` del
  servidor y no despliega si no entra en el JS. La clave del historial público NO es la
  de producción (huellas distintas): no hace falta rotar. Aviso nuevo en `/admin/salud`.
- Cabeceras de seguridad (`next.config.mjs`) y sin `x-powered-by`.
- Avisos/recordatorios: los programados ya visibles cuentan como publicados; la
  cancelación avisa también a la lista de espera; el aviso de fin no va a quien «no
  vino»; errores de lectura ya no se tragan; clave de cancelación con fecha.
- API: push, ofertas, borrar cuentas ajenas y datos de usuario exigen admin GENERAL;
  techo global por hora en IA de flyers (200) y buscador de direcciones (400);
  enlace de entradas validado antes de `window.open`.
- Pantallas: feed de DJs (cargas cruzadas, ♥/guardar/seguir optimistas), aviso de
  mensaje que abre su pestaña, cola de admin (página vacía, «Soltar»), ficha «ya pasó»
  por hora de fin, editar sin hora de inicio, título de set vacío (el 400), fechas de
  admin en hora de Madrid.
- Móvil: mapa con todas las chinchetas en pantalla y logos optimizados (798 → 304 KB),
  barra fija «Asistiré / Guardar» en la ficha, flyer entero (4:5), feed de DJs sin cara
  a pantalla completa, aviso de instalar desde la 2.ª visita y en franja, directorio con
  foto primero, textos clave ≥13 px, botones ≥44 px, CSS de Leaflet solo con mapa.
- `es_profesional`, métricas, canje de promos y cola siguen al lote 73.

**SQL nuevo (sin pegar):** `PEGAR_73.sql` (175 pruebas bien en local) y limpieza
L0‑L8 revisada (24/24 en local, también con el 73): reasigna métricas en vez de abortar
y marca la transacción como escritura del servidor (sin eso el SQL Editor deshacía en
silencio estado y orden de destacados). L8 oculta las 3 fichas de prueba.

**Para el cliente:** «sí» a la limpieza; datos raros en 2 tardeos publicados; privacidad
«Pendiente»; ¿«oletu» es de prueba?

---

## 17‑oct‑2026 (noche) · Lotes 73-74 en producción y prueba completa

- **Lotes 73 y 74 aplicados** (los pegó el usuario; comprobado leyendo la base).
- **Prueba con sesión** de los 4 portales (admin, local, DJ, tardícola) en local contra
  producción: ninguna pantalla rota ni «permission denied»; escrituras [PRUEBA] de sets,
  Nexo, sorteos, tardeo en borrador y perfil DJ funcionan y se deshicieron. Los intentos
  de saltarse permisos (Nexo «aceptado», likes, seguidores) se rechazan.
- **Cruce estático** de todas las escrituras del navegador contra los grants: todo cuadra.
- **Rastreo público:** 381 URLs y 298 imágenes, 0 rotas.
- **Arreglado:** modo oscuro (pie, texto sobre oro, magentas, sigue al sistema, mapa),
  SEO (og:image, descripciones, sitemap, canonical, h1, 404 de DJ inexistente),
  escritorio de /djs y /nexo, fotos HEIC (se convierten o se explica), Entre Beats para
  fichas pendientes, filtros del ADN visibles en Eventos, claves repetidas en estadísticas,
  updates que no comprobaban si se guardaron (anuncios, sets), funciones muertas fuera.
- **Para probar Entre Beats usar admin@**: dj@ y local@ tienen la ficha oculta/sin
  aprobar y, desde el 73, no cuentan como profesionales.

---

## 17‑oct‑2026 (noche, 2) · "Sí" a la limpieza

- El usuario da el **sí** a la limpieza. Recuento fresco: 794 tardeos, 59 locales y 30 DJs
  duplicados; de las copias cuelgan 31 métricas y **1 inscripción real** (16‑oct, a la copia
  publicada de «Fiesta Sevillanas»), que habría parado L1. L1 ahora pasa las inscripciones
  al gemelo. Probado en local: 25/25 y `PEGAR_LIMPIEZA.sql` (L0‑L8) dos veces seguidas.
- **Datos mal:** «Fiesta Sevillanas» estaba inactiva en la antigua (fechas rotas): la
  limpieza la deja en borrador. «Tardeo House» (Mataró vs Café Royale) ya pasó: se pregunta
  al organizador. Apuntado en CLAUDE.md §11.
- Lo demás (marca, enlaces, Nexo, privacidad, Fatima Kahlo duplicada) queda guardado en §11.

---

## 18‑oct‑2026 · Asistencia por tardeo, filtros en todos los paneles y modo oscuro

- **Asistencia y espera** (lo pidió el usuario: no se podía filtrar por tardeo ni gestionar
  desde la ficha): `PasarLista` rehecho con resumen, buscador, filtros y acciones (dar plaza,
  a espera, cancelar con doble toque, volver a confirmar, dar plaza al siguiente). Está en la
  ficha del tardeo (local y admin) y en `/admin/registro?tardeo=<id>` (buscador de tardeos y
  título clicable). `/local/apuntados?tardeo=` filtra de verdad.
- **Lote 75** (pendiente de pegar): el dueño del local gestiona su lista; el admin, solo su
  zona. 23/23 en local. Sin él, la pantalla funciona y esas acciones solo le van al admin.
- **Filtros**: `PanelFiltros` plegable en ~25 listas (tardeos, fichas, usuarios,
  suscripciones, auditoría, sorteos, CRM, cola, moderación, denuncias, incidencias,
  reclamaciones, enlaces, pop-ups, Nexo, Coins, tardeos del local, solicitudes, reseñas,
  Entre Beats, avisos, DJ). Sin buscar texto en la cola (necesita SQL).
- **Modo oscuro del portal del local**: las cajas de aviso/ok/error eran crema con letra
  clara (no se leían). «Ver mi ficha» con la ficha en revisión daba 404: ahora vista previa
  para el dueño. Las páginas «no encontrado» salían en claro: arreglado.
- **Documento de la empresa (CRM / HubSpot)**: respondido punto por punto (ver artifact).

## 18‑oct‑2026 (tarde) · Limpieza aplicada y SQL sin pegar a mano

- `scripts/aplicar-sql.sh` + conexión en `.env.local`: los lotes probados en local los aplica
  Claude (autorización escrita del usuario; lo que borra datos sigue pidiendo "sí").
- Lote 75 aplicado y verificado. Lote 76: copias `_bak_limpieza_*` sin permisos para el público.
- **Limpieza aplicada** (sí del usuario): 794 tardeos, 59 locales y 30 DJs duplicados fuera;
  métricas 598 = 598; 2 inscripciones y 2 favoritos pasados al gemelo; 3 fichas de prueba
  ocultas; zonas unificadas; 819 tardeos pasados → finalizado. Quedan 821 / 71 / 33.
- Consecuencia: 0 tardeos próximos. Eventos dice «Nuevos tardeos en camino» en vez de «quita
  algún filtro». Pendiente del cliente: cargar oferta y decidir la ficha buena de «Fatima Kahlo».

---

## 20‑oct‑2026 · tardeosclub.com sirve la app nueva (portada en mantenimiento)

- DNS de tardeosclub.com en DigitalOcean (registrador Nominalia); el dominio ya apuntaba al
  droplet, donde nginx servía la web de mantenimiento estática.
- Nuevo nginx (`docs/nginx-tardeosclub.com.conf`): `/` exacta = mantenimiento; `/assets/`,
  `/favicon.png`, `/manifest.webmanifest` = sus ficheros; todo lo demás → app (puerto 3005).
  Copia previa en `/root/nginx-tardeosclub.com.antes-app.bak`. `nginx -t` ok y recargado.
- Comprobado: `/` 200 «Estamos en mantenimiento» (también en navegador); `/eventos`, `/djs`,
  `/perfil`, `/sitemap.xml`, `/robots.txt`, optimizador de imágenes 200; www también;
  sin errores de consola; crm.gnerai.com sigue igual.
- Sigue `noindex` y canónica a crm.gnerai.com (el build no ha cambiado): bien mientras haya
  mantenimiento. Pasos de lanzamiento en `CLAUDE.md` §10.
- Ojo: el logo / «Inicio» de la app llevan a `/`, que en tardeosclub.com es el mantenimiento.

---

## 20‑oct‑2026 · Copia del Supabase ANTIGUO (obevrycebhqdqtvxnxoy) antes de pausarlo

- Proyecto «TardeosClub» de *msanjuan04's Org* (plan PRO). En 24 h solo recibía las
  comprobaciones de salud del propio Supabase: la app nueva no depende de él (0 imágenes de la
  base nueva apuntan a su Storage).
- Copia hecha con la service role (solo lectura) en
  `/Users/marccortada/tardeos/backup-supabase-antiguo-2026-10-20/` (604 MB, fuera del repo):
  28 tablas de la API en JSON + `openapi.json` (columnas) + todos los ficheros de Storage,
  0 errores. Resumen en `RESUMEN.json`.
- Límite: es copia de DATOS. No incluye funciones, políticas ni usuarios de `auth` (la API no
  los expone). Para una copia completa: descargar el backup diario desde el panel
  (Database › Backups) antes de borrar.
- Pausar/borrar: lo hace el usuario en el panel (el modo automático bloquea tocar la cuenta).
  Recordar: el plan PRO es de la organización; solo baja la factura si no queda otro proyecto.
- **20‑oct: el usuario BORRÓ el proyecto antiguo** en el panel (pausar no se podía: plan de pago).
  Comprobado después: el dominio `obevrycebhqdqtvxnxoy.supabase.co` ya no responde;
  tardeosclub.com (portada de mantenimiento incluida), /eventos y crm.gnerai.com siguen en 200.
  La única copia que queda es la de `backup-supabase-antiguo-2026-10-20/`. Pendiente: bajar
  *msanjuan04's Org* a Free si no le quedan proyectos, y quitar el host antiguo de
  `next.config.mjs` / `lib/fotos.ts` y los `OLD_SUPABASE_*` del `.env`.

---

## 20‑oct‑2026 · Mantenimiento para el público, app para el equipo (llave)

- tardeosclub.com y crm.gnerai.com: sin llave → mantenimiento en TODAS las rutas (503 +
  Retry-After); con la cookie `tc_acceso` → app entera. `/api/` siempre abierta.
- Llave en `/root/tardeos-llave-equipo.txt` (no está en el repo). Enlace para el equipo:
  `https://tardeosclub.com/llave-equipo?k=<LLAVE>` (y lo mismo en crm.gnerai.com).
- Comprobado: público 503 en `/`, `/eventos`, `/admin` de los dos dominios; con llave 200;
  `/api/buscar-sitio` 200; llave mala no da cookie; cron `avisos` sigue en 200.
- `scripts/desplegar.sh` comprueba ahora con la llave (la lee del servidor).
- Plantillas en `docs/nginx-*.conf`; copia de antes en `/root/nginx-antes-llave-*`.

---

## 20‑oct‑2026 · Auditoría a fondo (código, seguridad, pantallas, datos, servidor)

- **Fotos rotas**: 57 locales tenían la galería en el Supabase antiguo (borrado hoy). Lote 77:
  enlaces al Storage nuevo; 57/57 cargan. Revisadas además 826 imágenes: ninguna rota.
- **Sincronización diaria con la web antigua** (workflow de GitHub desde `main`): reescribía
  locales, DJs y tardeos de producción con los de la vieja. Desactivada en GitHub y quitada de
  `rediseno`; host antiguo fuera de `next.config.mjs` y `lib/fotos.ts`.
- **Código**: avisos de cancelación con el número de confirmados actual, CSV de un tardeo
  elegido en /admin/registro, 404 real en fichas de local inexistentes, cargas tardías en Nexo.
- **Seguridad, lote 78**: reseñas nacen pendientes, columnas de sistema de tardeos, emails y
  cobros de fichas fuera de la API (`lib/privados.ts`), plaza en tardeo cerrado solo admin,
  `quienes_van` solo visibles. 24/24 en local.
- **Pantallas** (~40 arreglos): reproductor que tapaba «Asistiré», velos y X en oscuro, zoom
  de iOS en buscadores, barras tapadas por la barra inferior, textos largos, errores técnicos
  en inglés y «falta el lote» fuera de lo público, foco en hojas, botones de 44 px.
- **Pendiente de decidir (usuario)**: repo de GitHub PÚBLICO con el email del admin de prueba;
  servidor con entrada por contraseña de root, sin cortafuegos ni fail2ban (21.446 intentos en
  24 h); `.gitignore` sin `.env` ni `AUDITORIA_Y_PLAN.md` (el protector de comandos no dejó
  editarlo); unificar nombres (Apuntados/Asistentes/Confirmados) y constante de marca.
