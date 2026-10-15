# TardeosClub · Auditoría del Dossier 2.0 y plan de construcción

Fuentes: *TC_Dossier_Flujos_Estado_Gnerai_14_10_2026* (20 págs.), vídeo de simulación
del 15‑oct (3 min 50 s, 90 fotogramas revisados) y el código actual (rama `rediseno`,
SQL hasta el lote 62). Fecha: 15‑oct‑2026.

---

## 1. Conclusión

**Lo que tenemos y lo que piden son dos productos distintos.**

| | Lo que hay hoy | Lo que pide el dossier |
|---|---|---|
| Forma | Web con portada tipo landing + 4 paneles de gestión con barra lateral | **App móvil** (PWA) con barra inferior de 5 pestañas, todo dentro de la app |
| Centro | Buscar tardeos y gestionarlos | Recorrido: **descubrir → Asistiré → Meet Zone → valorar → volver** |
| Música | Enlaces externos, embeds en la ficha del DJ | **Feed vertical de DJs**, seguir, sets, **reproductor persistente**, Nexo Radio dentro |
| Comunidad | Ninguna | **Meet Zone** (chat por evento 72 h), **solicitudes de mensaje a DJ**, **Entre Beats** (profesionales) |
| Retorno | Email el día antes | Aviso 1 h antes con música, aviso al acabar + vuelta segura, **encuesta 72 h**, sorteos |
| Negocio | Planes apagados (4/∞/∞ eventos), extras en € | Planes 1/2/∞ eventos por ciclo, **Coins**, patrocinados por ADN, QR/fidelización |
| Admin | Un único "es admin" con todo el poder | **Admin por zona y tarea** (Álex BCN, Sergi TGN, Girona, Cristina sorteos), colas con responsable y rastro |

Recuento de requisitos auditados (46): **~10 % hechos · ~45 % a medias · ~45 % por hacer.**
Lo que sí sirve tal cual: base de datos y seguridad (Advisors a cero), alta y login, publicar
tardeos con IA del flyer, recurrencias (hasta 52), aforo en base de datos, invitaciones a DJs,
pop‑ups segmentados, push/VAPID, métricas 7/30/90, CRM + CSV, errores e incidencias,
paginación del admin. **No se tira nada: se reorganiza la experiencia y se añaden módulos.**

---

## 2. Auditoría por módulo (dossier → código)

Leyenda: ✅ hecho · 🟡 a medias · ❌ falta

### 2.1 Navegación e Inicio (págs. 3‑4, vídeo 0:00‑0:40)

| Requisito | Estado | Hoy | Falta |
|---|---|---|---|
| Barra tardícola: Inicio · Eventos · DJs · Próxima Parada · Perfil | 🟡 | Inicio, Tardeos, Mapa, Planes, Cuenta (+ "Mi local/Mi DJ") | Renombrar, quitar Mapa (va dentro de Eventos), añadir DJs |
| Barra profesional: 4.ª pestaña = Entre Beats | ❌ | — | Pestaña según permiso |
| Cabecera: logo · selector de zona (Barcelona) · campana | ❌ | Logo + Entrar | Selector de zona persistente, bandeja de avisos |
| Inicio en orden: 1 Mapa pequeño (+Instagram/Comunidad) · 2 Destacados (Patrocinado) · 3 ADN Tardícola · 4 Entre Beats · 5 Nexo Radio | 🟡 | Hero grande, próximos, ParaTi, logos, DJs, FAQ | Reordenar. Hoy es landing de marketing; pide app. La landing actual puede quedar como web pública para quien llega sin app |
| Pop‑up promocional al entrar, 1 vez por usuario y campaña, "Patrocinado · Afín a tu ADN" | 🟡 | Existe, segmentado, pero "visto" se guarda en el navegador | Guardar en base por usuario; momento configurable; etiqueta Patrocinado |
| Volver conserva filtros, zona y posición | 🟡 | Parcial | Estado en URL + restaurar scroll |

### 2.2 Eventos, ADN, filtros, mapa, Mes (pág. 4, vídeo 0:35‑1:05)

| Requisito | Estado | Hoy | Falta |
|---|---|---|---|
| Buscador + chips Este finde · Hoy · Mañana · Mes | 🟡 | Hoy, Este finde, Esta semana, Vie/Sáb/Dom | "Mañana", "Mes" |
| Conmutador Mapa / Lista / Filtros en la misma pantalla | ❌ | Mapa en otra página | Unificar en `/eventos` conservando filtros |
| Vista **Mes**: calendario con puntos + lista del día | ❌ | — | Construir |
| Filtros en hoja inferior **prellenados con el ADN**, "Ver N planes", "Restaurar mi ADN" | 🟡 | Hoja de filtros con contador | Prellenar con ADN, Tipo de plan, Entrada (Gratis/Hasta 20 €/Cualquiera), restaurar |
| Pines con logo del local/marca; al tocar, tarjeta con precio | 🟡 | Logo sí; tarjeta sin precio destacado | Precio en tarjeta |
| "Cerca de ti" o zona manual | ✅ | Geolocalización + zona | — |
| ADN: música, plan, zona, presupuesto; editable en "Mi ADN"; privado; opcional al registrarse | 🟡 | Música, tipo, edad, ropa en "Mis gustos" | Zona y presupuesto, paso opcional en el alta, nombre "Mi ADN" |
| Etiqueta "Afín a mí" (no porcentajes inventados) | 🟡 | "N % para ti" | Cambiar a etiqueta binaria basada en regla real |
| Sin resultados: explicar y ofrecer ampliar | ✅ | Existe | Ajustar textos |

### 2.3 Ficha, Asistiré, lista de espera (pág. 5, vídeo 0:55‑1:10)

| Requisito | Estado | Hoy | Falta |
|---|---|---|---|
| Portada, nombre, fecha + fin, lugar, **Cómo llegar** | ✅ | Sí (+taxi) | Taxi aplazado según dossier: quitar |
| Precio: GRATIS / X € / Desde X € | 🟡 | Gratis / X € / Por lista | "Desde X €" con mínimo real |
| Descripción con "Leer más"; bloque **Entrada y condiciones** | ❌ | Texto entero | Construir |
| **Line‑up** con avatares → perfil DJ (volver recupera el evento) | 🟡 | Lista de DJs con enlace | Avatares, retorno |
| **Quiénes van**: N confirmados, avatares/alias, Ver lista | ❌ | Solo el local lo ve | Alias públicos (sin email/teléfono) |
| **Asistiré** → confirmado al momento si hay plaza; si no, **lista de espera** | 🟡 | "Apuntarme gratis" solo en gratuitos; aforo en base | Botón para todos los eventos, estado `espera`, promoción desde espera |
| Guardar ≠ Asistiré; Comprar entrada abre enlace externo | ✅ | Sí | — |
| Retirar Asistiré; aviso si cambia fecha o se cancela | 🟡 | Cancelación sí, cambio no | Aviso de cambio |

### 2.4 Meet Zone (pág. 6, vídeo 1:10‑1:25) — **❌ todo**
Chat por evento, gratis, solo confirmados; mensaje fijado del organizador; cierra 72 h después
del fin **en servidor** (también por enlace); alias y perfil público limitado; sin
teléfonos/emails (filtro antes de publicar); denuncias con revisión humana.
*Nota: CLAUDE.md lo daba por aplazado. El dossier 14‑oct lo pone en "Decisiones vigentes".
Manda el dossier (pág. 17: "la última instrucción sustituye la que contradiga").*

### 2.5 DJs, sets y reproductor (pág. 7, vídeo 1:30‑2:00)

| Requisito | Estado | Hoy | Falta |
|---|---|---|---|
| Pestaña DJs = **feed vertical** "Para ti / Siguiendo" (cartel o vídeo‑set, ♥, comentar, guardar, compartir, Seguir, Ver perfil) | ❌ | Rejilla de directorio | Construir |
| Perfil DJ: banner, ciudad, estilos, **Seguir / Mensaje**, set destacado, pestañas **Sets · Eventos · Sobre mí** | 🟡 | Cabecera, bio, dónde pincha, embeds | Banner, ciudad, seguir, mensaje, pestañas |
| **Seguir DJs**, sets favoritos, comentarios por set con respuesta del DJ | ❌ | — | Tablas y UI |
| **Mini‑reproductor persistente** (una fuente, no tapa navegación, no autoplay) | ❌ | Iframes dentro de la página | Contexto de audio global en el layout |
| Press kit **solo profesionales** | 🟡 | Público a todos (incluso anónimos) | Restringir lectura y descarga |

### 2.6 Nexo, mensajes, Entre Beats (pág. 8, vídeo 0:25‑0:35 y 2:55‑3:20)

| Requisito | Estado | Hoy | Falta |
|---|---|---|---|
| **Sección Nexo Radio**: reproductor, Escuchar · Programación · Enviar sesión, "Descubre sesiones" | ❌ | Enlace externo a nexoradio.es | Construir (stream real de Nexo: pendiente de URL/permiso) |
| DJ **envía sesión a Nexo** (título, enlace, descripción, estado) | ❌ | — | Tabla + bandeja para el equipo Nexo |
| **Solicitud de mensaje al DJ** (aceptar/rechazar/limitar, bloquear/denunciar) | ❌ | WhatsApp de contratación | Construir |
| **Entre Beats** (solo profesionales): Hilos (buscar, responder, crear) y Anuncios (categoría, Abierto/Cerrado, Contactar) | ❌ | — | Construir con permiso en servidor |

### 2.7 Próxima Parada, Perfil, directorio (pág. 9, vídeo 1:25‑1:30 y 2:00‑2:25)

| Requisito | Estado | Hoy | Falta |
|---|---|---|---|
| Próxima Parada: guardados, **Próximos / Pasados**, "En lista · Confirmado", deshacer | 🟡 | "Mis planes" con pestañas apuntado/guardados | Reorganizar, estado, deshacer |
| Perfil: foto, alias, presentación; Mis DJs, Mis sets, Mi ADN, Historial, Sorteos, **Modo claro/oscuro**, Notificaciones, Necesito ayuda, Cerrar sesión | 🟡 | Nombre, gustos, avisos, ajustes | Foto, alias, bio, listas, **tema oscuro** (no existe ningún estilo oscuro hoy) |
| Directorio desde Eventos: Locales · Promotores · DJs con buscador; marcas por zona | 🟡 | `/colaboradores` | Acceso desde Eventos, marcas Tardeos Club/BCN, Tardeo Tarragona/TGN, El Ritmo del Sonido/Girona |
| Local ≠ promotor (un promotor no es dueño del local donde publica) | 🟡 | Promotor = local sin dirección | Relación promotor‑evento‑local |
| Reseñas enlazadas al evento de origen | ❌ | Reseña por local/DJ | Columna `tardeo_id` |

### 2.8 Avisos, encuesta, vuelta segura (pág. 10, vídeo 2:25‑2:40)

| Requisito | Estado | Hoy | Falta |
|---|---|---|---|
| Aviso **1 h antes** con propuesta musical | ❌ | Email el día antes | Cron cada 5‑15 min + push |
| Aviso **al terminar** + "vuelta segura" | ❌ | Texto estático en ficha | Push programado |
| **Encuesta hasta 72 h**: estrellas, música, ambiente, ropa/edad, volverías, comentario; público solo nota+comentario | ❌ | Reseñas genéricas | Tabla + pantalla + permisos |
| Bandeja de avisos (campana) | ❌ | — | Construir |
| Pedir taxi | ⏸ aplazado | Hay botón | Quitar |

### 2.9 Publicar y mantener la oferta (pág. 11, vídeo 3:20‑3:35)

| Requisito | Estado | Hoy | Falta |
|---|---|---|---|
| Alta profesional con validación separada del pago | ✅ | Borrador → admin aprueba; plan aparte | — |
| Formulario: flyer + IA a borrador, revisar antes de publicar | ✅ | Sí, con campos a revisar | — |
| DJs del cartel como chips + "Añadir DJ" | 🟡 | Texto con sugerencias | Chips vinculados |
| **Ver vista previa**, Necesito ayuda | 🟡 | — | Vista previa idéntica a la ficha |
| Recurrencias con previsualización (máx. 52) | ✅ | Sí | Casos 31, febrero, cambio de hora: probar |
| **Evitar duplicados** (nombre + fecha + lugar) | ❌ | Solo en fichas | Aviso antes de crear |
| DJ **solicita vincularse** a evento existente / propone evento nuevo | ❌ | Solo local → DJ | Flujo inverso + cola de revisión |

### 2.10 Planes, Coins, promociones (págs. 12‑14)

| Requisito | Estado | Hoy | Falta |
|---|---|---|---|
| Basic 10 € / Pro 20 € / Premium 30 €, Fundador 40 € 2 meses | ✅ | Precios correctos, apagados | — |
| Eventos por ciclo **1 / 2 / ilimitado** | 🟡 | 4 / ∞ / ∞ | Ajustar a dossier + contador por ciclo en base |
| **Coins**: monedero, recargas 10/25/50/100, saldos separados (comprado/promocional ≤20/fundador/protegido), historial, reservas con devolución | ❌ | Precios extra en € | Libro contable (ledger) — **sin pasarela, apagado** como los planes |
| Patrocinados compatibles con ADN, etiqueta "Patrocinado" | 🟡 | Destacados sin etiqueta | Etiqueta + regla de afinidad |
| **Sorteos** (cuenta, bases, participantes, ganador publicado) | ❌ | — | Construir |
| **QR / fidelización / reclamo** de promociones | ❌ | Promos con código, `usos` nunca sube | Canje real + PDF QR por local |
| Enlaces con origen de campaña (Ruta del Tardeo, WhatsApp, IG, QR) | ❌ | — | utm → `eventos_metrica.origen` |

### 2.11 Administración (pág. 15)

| Requisito | Estado | Hoy | Falta |
|---|---|---|---|
| **Responsables por zona/tarea** con permisos en servidor | ❌ | `is_admin` todo‑poderoso | Tabla `admin_roles(usuario, zona, tarea)` + funciones RLS |
| Sergi: Local + Administrador | ✅ | Ya funciona (admin puede tener local) | Crear su cuenta cuando den el email + enlace /local en la barra admin |
| Colas: validación, evento propuesto, vínculo DJ, duplicados, denuncia, ayuda, prestación comercial; con **responsable, estado, fecha, rastro** | 🟡 | Revisar, incidencias, reclamaciones, moderación | Responsable asignado + **registro de auditoría** |
| Gestionar listas y espera desde admin | 🟡 | Registro de asistencias solo lectura | Editar, promover de espera |
| Encuestas internas (solo equipo) | ❌ | — | Con 2.8 |
| HubSpot | 🟡 | CRM propio + CSV | Exportación compatible HubSpot (integración: pendiente de decidir) |
| Necesito ayuda con evento/perfil referenciado y borrador guardado | 🟡 | Incidencias con URL | id referenciado + borrador |

### 2.12 Medición (pág. 16)

| Requisito | Estado | Falta |
|---|---|---|
| Vista efectiva, guardar, seguir, Play, Asistiré/espera, chat, clic externo, sorteo | 🟡 | Tipos nuevos (seguir, play, espera, chat, sorteo) |
| Deduplicar en servidor, excluir equipo/pruebas | ❌ | Índice único por sesión+evento+día, marca `es_equipo` |
| Retorno 7/28 días, cohortes | ❌ | Vista SQL de cohortes |
| Panel local 7/30/90 con entradas/lista/WhatsApp/IG separados; "No disponible" ≠ 0 | 🟡 | Separar y mostrar canales |

### 2.13 Técnico transversal

| Tema | Estado | Falta |
|---|---|---|
| Lecturas públicas sin paginar (todos los locales, todos los DJs, CRM) | 🟡 | Cortar a 1.000 filas → paginar/limitar |
| `favoritos` y `flyers` existen en producción pero en ningún lote | 🟡 | Lote que las documente (idempotente) |
| Duplicados de la migración (794 tardeos, 59 locales, 30 DJs) | ❌ | Aplicar `limpieza/L0‑L7` **con "sí" del cliente** |
| Zonas: texto libre vs. Barcelona/Tarragona/Girona del dossier | 🟡 | Catálogo único de zonas en base |
| Pruebas automáticas | ❌ | Playwright (recorridos pág. 19) + pruebas RLS |
| Offline / modo app | 🟡 | Caché del service worker |
| Marca | ⏸ | **Nombre y branding se cierran el domingo 18‑oct**: todo el color/tipografía ya va por tokens → cambio en un sitio |

---

## 3. Contradicciones que hay que cerrar (antes de construir)

1. **Aplazados vs. vigentes**: CLAUDE.md decía "no desarrollar Meet Zone, créditos, tablón".
   El dossier 14‑oct los da por vigentes (Meet Zone gratis, Coins, Entre Beats/Anuncios).
   → Se aplica el dossier; actualizar CLAUDE.md.
2. **Cupos**: código 4/∞/∞ eventos al mes; dossier 1/2/∞. → Dossier.
3. **Press kit**: hoy público; dossier "solo profesionales". → Restringir.
4. **Zonas de admin** (Barcelona/Tarragona/Girona) ≠ zonas del buscador (Barcelona, Maresme,
   Costa Brava, Costa Daurada, Terres de l'Ebre, Ponent). → Tabla de zonas con "zona madre".
5. **Landing**: el cliente quiere app con Inicio de 5 bloques; tú pediste landing de
   conversión. → Propuesta: `/` = Inicio de app (5 bloques); la landing se queda para quien
   llega desde fuera sin sesión (`/bienvenida` o la misma `/` si no hay sesión).
6. **Acceso sin cuenta / corte de 5 minutos**: pendiente del cliente (pág. 3).
7. **Pasarela de pago y Coins**: se construye todo el libro contable **apagado**, igual que los planes.

---

## 4. Plan por fases

Cada fase termina **desplegada en crm.gnerai.com**, con sus SQL aplicados, Advisors a cero y
las pruebas de aceptación de la pág. 19 grabadas como evidencia.

### Fase 0 · Cimientos (2‑3 días)
- Cerrar las 7 decisiones de §3 con Cristina/Álex.
- Limpieza de duplicados L0‑L7 (con recuentos y "sí").
- Lote con `favoritos`/`flyers`; paginar lecturas públicas grandes.
- **Catálogo de zonas** en base + `admin_roles` (zona/tarea) + **registro de auditoría**.
- Tema claro/oscuro por tokens (prepara el cambio de marca del domingo).
- Playwright + pruebas RLS mínimas.

### Fase 1 · App tardícola (5‑7 días) — *el recorrido del vídeo*
- **Shell de app**: barra inferior 5 pestañas (4.ª = Próxima Parada o Entre Beats según permiso), cabecera con zona y campana.
- **Inicio** en el orden aprobado.
- **Eventos**: Mapa / Lista / Mes en una pantalla, chips, filtros desde ADN, restaurar ADN, volver conserva estado.
- **Ficha** completa (Leer más, Entrada y condiciones, Line‑up, Quiénes van, Meet Zone card).
- **Asistiré** para todos + **lista de espera** (estado en base, promoción automática al liberar plaza).
- **Próxima Parada**, **Mi ADN** completo (zona, presupuesto, paso opcional en el alta), **Perfil** (foto, alias, bio, modo oscuro).
- Pop‑up 1 vez por usuario/campaña en base, etiqueta Patrocinado.

### Fase 2 · Música (4‑5 días)
- Perfil DJ nuevo (banner, ciudad, Seguir, pestañas Sets/Eventos/Sobre mí, set destacado).
- **Seguir DJs**, **sets** como entidad (guardar, ♥, comentarios + respuesta del DJ).
- **Feed vertical DJs** Para ti / Siguiendo.
- **Reproductor persistente** global (una fuente, Nexo detiene lo demás).
- **Nexo Radio** dentro de la app + **Enviar sesión** (bandeja para Nexo).
- Press kit solo profesionales.

### Fase 3 · Comunidad (4‑5 días)
- **Meet Zone**: chat por evento (Supabase Realtime), solo confirmados, mensaje fijado,
  cierre 72 h en servidor, filtro de teléfonos/emails, denuncias → cola.
- **Solicitudes de mensaje a DJ** (aceptar, rechazar, limitar, bloquear).
- **Entre Beats**: Hilos y Anuncios, solo profesionales (RLS), moderación.

### Fase 4 · Retorno (3‑4 días)
- Cron cada 10 min: **aviso 1 h antes** (música: favoritos → set del cartel → nada),
  **aviso al acabar + vuelta segura**, avisos de cambio/cancelación. Push + bandeja.
- **Encuesta 72 h** (público: nota + comentario; resto solo equipo), reseña enlazada al evento.
- **Sorteos** (participar, bases, revisar, publicar ganador; rastro).

### Fase 5 · Profesional y negocio (5‑7 días)
- Publicar: DJs como chips, **vista previa**, **detección de duplicados**, Necesito ayuda con borrador.
- DJ **solicita vínculo** / **propone evento** → colas.
- **Cupos por ciclo** 1/2/∞ contados en base; Fundadores (50 primeros, sello).
- **Coins** (libro contable, saldos separados, reservas, devolución) — apagado sin pasarela.
- Patrocinados por ADN, **promos con canje** (QR/código), PDF QR por local.
- Estadísticas del local con canales separados y "No disponible".

### Fase 6 · Admin por zonas y medición (3‑4 días)
- Permisos por zona/tarea aplicados a todas las pantallas y RLS; cuenta de **Sergi** (Local + Admin TGN).
- Colas con responsable/estado/fecha y rastro; listas y espera editables; encuestas internas.
- Medición: tipos nuevos, deduplicado en servidor, excluir equipo, cohortes 7/28, origen de campaña (utm/QR).
- Exportación HubSpot (CSV con su formato).

### Fase 7 · Piloto (2 semanas, dossier pág. 19)
Oferta real, Android Chrome + iPhone Safari, 4 roles; gratuito/pago/lista, cambio de hora,
cancelación. Evidencia por prueba (ID, rol, resultado esperado/real, URL/versión, captura).

**Total construcción: ~26‑35 días de trabajo** + piloto. Las fases 1 y 2 son las que hacen que
"se parezca al vídeo"; conviene enseñarlas al cliente en cuanto estén.

---

## 5. Nuevas tablas (resumen técnico)

`zonas`, `admin_roles`, `auditoria` · `inscripciones.estado += 'espera'`, `posicion_espera` ·
`seguidores_dj`, `sets` (+`sets_guardados`, `sets_likes`, `sets_comentarios`) ·
`meet_mensajes`, `meet_fijado` · `solicitudes_mensaje`, `mensajes_dj`, `bloqueos` ·
`eb_hilos`, `eb_respuestas`, `eb_anuncios` · `nexo_envios` · `avisos` (bandeja) +
`avisos_programados` · `encuestas` · `sorteos`, `sorteo_participaciones` ·
`coins_movimientos` (ledger), `coins_reservas` · `promo_canjes` · `popups_vistos` ·
`denuncias` (genérica: mensaje, hilo, perfil). Todas con RLS, `(select auth.uid())`,
funciones SECURITY DEFINER en `private`, índices en claves foráneas (reglas de CLAUDE.md §8).

---

## 6. Respuestas preparadas para "Preguntas finales para Gnerai" (pág. 18)

| Área | Respuesta |
|---|---|
| Estado y alcance | Tabla §2 por módulo; cada fase entrega URL, versión y evidencia |
| Registro y permisos | Email+contraseña, código por email y Google; recuperación por email; permisos en servidor (RLS), admin por zona/tarea en Fase 6 |
| Mapa/ADN | Leaflet + OpenStreetMap (sin coste por uso); zonas en catálogo; "Afín a mí" = coincide ≥1 estilo y zona y precio ≤ presupuesto (regla explicable) |
| Listas y espera | Aforo y confirmación en base con bloqueo (sin duplicados ni sobreventa); espera ordenada, promoción automática al liberar plaza |
| Chat y encuesta | Ventana = fin + 72 h calculada en servidor, se recalcula si cambia la fecha; mensajes se conservan internamente 90 días (a confirmar) |
| Audio/Nexo | Fuentes: SoundCloud/YouTube/Mixcloud embebidos + stream de Nexo; una sola fuente; segundo plano según navegador (iOS limita) |
| Planes/pagos/Coins | Todo construido y apagado; pasarela (Stripe recomendado) cuando el cliente la active |
| Partidas recuperadas | OCR/IA del flyer ya funciona (Claude); QR/fidelización en Fase 5 |
| Datos/operación | Migración hecha; limpieza de duplicados pendiente de "sí"; CSV para HubSpot |
| Continuidad | Supabase (BBDD/Auth/Storage), droplet propio, Resend, Anthropic; copias diarias de Supabase; errores e incidencias en el panel |

---

## 7. Lo que necesitamos del cliente

1. Confirmar las 7 decisiones de §3.
2. Nombre y branding (domingo 18‑oct).
3. Email de Sergi (Local + Admin Tarragona) y nombre del responsable de Girona.
4. URL del stream de Nexo Radio y quién recibe las sesiones enviadas.
5. Enlaces oficiales de Instagram y comunidad WhatsApp por zona.
6. Texto de bases de sorteos y condiciones de Coins/Fundadores.
7. "Sí" para la limpieza de duplicados (con recuentos delante).
