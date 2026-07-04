# ANÁLISIS DEL PROYECTO — TARDEOS CLUB (app nueva de pago)

> Documento vivo. Aquí se recoge TODO lo analizado antes de tocar código.
> Fecha inicio: 2026-07-02 · Plazo objetivo: ~2 meses · Estado: **Fase de análisis**

---

## ✅ ANÁLISIS COMPLETO — listo para construir

**Los 10 pilares cerrados:** Negocio · Pagos/Fourvenues · Stack · Branding · Mapa ·
1 Roles · 2 Conceptos · 3 Modelo de datos · 4 IA · 5 Seguridad/RGPD · 7 Precios ·
6 Migración · 9 UX · 10 Roadmap.

**Siguiente paso real:** empezar la **Semana 1 del Roadmap** (§21) cuando lleguen los
bloqueantes del dueño (ver `PEDIR_AL_DUENO.md`).

**Pendiente que depende del dueño / info externa:**
- Acceso **RRPP + API de Fourvenues** (atribución y estadísticas).
- **Export de datos** de la app actual (migración).
- **Subdominio + DNS/Cloudflare**.
- **Entidad legal** de TardeosClub (autónomo/S.L.) + resolver **pasarela/autónomo**.
- Cerrar **Precio Fundador**, **prueba gratis 1 mes** e **IVA**.
- Revisar **Posts** (apartado): ¿entran en el MVP?
- Guardar versiones **SVG** de logo/sello (opcional).

---

## 0. Reglas del proyecto (TRANSVERSALES — aplican a TODO)

1. **📱 MOBILE-FIRST EN TODO.** Toda la app se diseña primero para móvil: cliente,
   local, DJ **y el panel de admin** (widgets ordenados, mobile-first). El escritorio
   es adaptación, no al revés. Botones grandes, texto grande, 1 acción por pantalla.
2. **👵 Público mayor**: fácil, visible, legible, sin tecnicismos, login sin contraseña.
3. **Nada se da por hecho.** Cada decisión se confirma antes de construir.
4. **Supabase** (SQL, edge functions, secretos) lo gestiona el dueño; aquí se diseñan y
   se pasan en texto.

---

## 1. Resumen ejecutivo

Ya existe una **plataforma gratuita en funcionamiento** con **+360 tardeos activos**
(tardeos = fiestas de tarde), propiedad del **mismo dueño**.

El objetivo **NO** es competir ni copiar: es **crear una nueva app de pago que
sustituya a la gratuita**, modernizándola y monetizándola **sin perder la base
de usuarios existente**.

- **No hay arranque en frío**: la base (locales, DJs, clientes, tardeos) ya existe y es propia.
- **Riesgo principal**: la fricción del cambio **gratis → pago** (posible fuga de locales/DJs).
- **Palanca ganadora**: IA que hace el trabajo del local + UX radicalmente fácil para público mayor.

---

## 2. Contexto y activos

| Elemento | Estado |
|---|---|
| App gratis actual | En producción, +360 tardeos activos, mismo dueño |
| Dominio | Ya en uso por la app actual → **MVP nuevo en subdominio** |
| Base de datos | Propia → migración de datos viejos → nuevos es viable y legal |
| Público | Edad **grande** → prioridad: fácil, visible, mobile-first |

---

## 3. Usuarios / Roles

| Rol | Paga | Qué hace |
|---|---|---|
| **Cliente** | ❌ Gratis siempre | Se registra, navega tardeos (zona, filtros, destacados), se inscribe / compra entrada |
| **Local** | ✅ Suscripción baja | Crea tardeos, listas, invita, sube posts; dirección por defecto = la del local |
| **DJ** | ✅ Suscripción baja | Completa biografía, gana reputación |
| **Admin** | — | Control total por widgets (mobile-first); crea locales/tardeos, invita; **agentes IA trabajan por él** |

*(Detalle fino de permisos por rol → pendiente, ver §11.)*

---

## 4. Modelo de negocio y precios

### Fuentes de ingreso
1. **Suscripción Local**: 1,99 € (referencia inicial).
2. **Suscripción DJ**: 0,99 € (referencia inicial).
3. **Comisión por cliente traído** (vía Forvenus, atribución) — se liquida **fuera** de la plataforma.
4. **Promociones internas**: destacados, anuncios en Instagram, **packs mensuales**.
5. **Popups** de promos / ofertas / noticias (dirigidos al cliente).

### Decisión de cobro (cadencia)
- Ofrecer **mensual Y anual** (anual con descuento).
- **Motivo**: la comisión fija por transacción (~0,25 €) destroza los importes bajos mensuales.

| Plan | Mensual | % perdido/mes | Anual | % perdido/año |
|---|---|---|---|---|
| Local | 1,99 € | ~14% | 23,88 € | ~2,5% |
| DJ | 0,99 € | ~27% | 11,88 € | ~3,6% |

> Conclusión: la suscripción es un **peaje bajo / gancho**; el dinero real está en
> **comisiones + promociones**. Cobro anual recomendado para rentabilizar.

---

## 5. Fourvenues y flujo de pagos/atribución — CERRADO

> ⚠️ **Nombre correcto: FOURVENUES** (antes escrito "Forvenus"/"Forvenues").

**Qué es Fourvenues:** SaaS líder de gestión de ocio nocturno y eventos
(discotecas, beach clubs, festivales, promotores). Funciones:
🎟️ venta de entradas · 📋 listas de invitados · 🍾 reservas VIP ·
👥 **gestión de RRPP y promotores** · 📊 estadísticas y CRM · 💳 TPV y taquilla ·
✅ control de accesos por QR · 🌐 **API e integraciones**.

### 5.1 Posicionamiento: Tardeos Club NO compite con Fourvenues, lo alimenta
Tardeos Club es la **capa de descubrimiento + comunidad + IA** encima de Fourvenues:
- Reúne todos los tardeos con **mapa, filtros y branding** (lo que Fourvenues no ofrece).
- **Ahorra trabajo** al local con IA (leer/crear flyers, posts, onboarding).
- **Envía el tráfico a Fourvenues** para la transacción (entradas, listas, VIP, QR).
- Resultado: **cero pagos de entradas, cero tickets, cero control de accesos** para nosotros.

### 5.2 La atribución = sistema de RRPP/promotores de Fourvenues (CLAVE)
- El **admin de Tardeos Club** se da de alta en Fourvenues como **RRPP / promotor**.
- Al pulsar "Comprar entrada" / "Apuntarme a la lista", redirigimos a Fourvenues
  **con el enlace o código RRPP del admin**.
- Fourvenues **atribuye la venta al admin** → el local ve que vino de Tardeos Club →
  **comisión por cliente traído gestionada por el propio Fourvenues**.
- ✅ **No construimos** sistema de comisiones, tickets ni accesos: ya existe en Fourvenues.

### 5.3 Las dos vías de inscripción (confirmadas)
- **Con Fourvenues** → redirección con código RRPP del admin → comisión automática.
- **Sin Fourvenues** → acuerdo directo admin↔local (sin código, sin comisión de plataforma).

### 5.4 Nuestra pasarela (para suscripciones + promociones)
- Gestiona **únicamente**: suscripciones (local/DJ) + promociones/packs.
- ❌ NO Stripe Connect, NO reparto de pagos, NO licencias de entidad de pago.
- ⚠️ **Realidad legal (verificado)**: en España, cobrar de forma recurrente exige estar
  dado de alta como **autónomo o empresa** (Ley 20/2007). Ninguna pasarela lo evita:
  es obligación fiscal, no técnica. Wise **NO** sirve (no gestiona suscripciones).
- 🔶 **Opciones de pasarela** (decisión final pendiente):
  - **Stripe**: estándar, barato, pero tú gestionas el IVA/MOSS europeo.
  - **Merchant of Record (Lemon Squeezy `lemonsqueezy.com` / Paddle)**: son el "vendedor
    legal", **gestionan el IVA por ti**, onboarding rápido, ~5% + 0,50 €. Reduce burocracia
    pero **no exime de declarar los ingresos** (sigue haciendo falta ser autónomo).
  - 🔶 Recomendación: para arrancar con menos fricción, **MoR (Lemon Squeezy/Paddle)**;
    en paralelo, alta de **autónomo** (tarifa plana). **Consultar gestor antes de cobrar.**
  - ⚠️ Ojo: `lemonsqueezy.com` (pagos) ≠ `lemon-squeezy.ch` (app suiza de estudiantes, NO es).

### 5.5 Tipos de tardeo
- **Gratis** → "Apuntarme" interno (guardamos registro).
- **De pago** → "Comprar entrada" → **redirección a Fourvenues** (código RRPP).
- **Con lista** → "Apuntarme a la lista" → **lista de invitados de Fourvenues** (§14.4).
- El local decide gratis / de pago / con lista.

### 5.6 Integración (fases)
- **MVP**: redirección con parámetros/código RRPP (caja negra, sin API).
- **Fase 2**: usar la **API de Fourvenues** para traer estadísticas/conversiones
  al panel de admin y, si procede, sincronizar eventos.
- ❓ Pendiente: conseguir acceso RRPP + credenciales API de Fourvenues.

---

## 6. Posicionamiento / Ventaja diferencial

No es "otro tablón de tardeos". Es:

1. **"El que trabaja por ti"** — IA que le quita trabajo al local:
   - Lee el flyer y **extrae datos** (fecha, DJ, hora, dirección…).
   - Crea el evento automáticamente.
   - Genera publicaciones.
   - Automatiza procesos → reduce tiempo de gestión de ~minutos a ~segundos.
2. **"El más fácil para mayores"** — UX radical: letra grande, alto contraste,
   1 acción por pantalla, login sin contraseña (SMS / enlace mágico).

> Esto es lo que **justifica cobrar**: no vendes software, vendes **tiempo ahorrado**
> y **más clientes**. Para un local con muchos tardeos/mes, 1,99 € sale a cuenta.

---

## 6.5 Branding e identidad — DEFINIDO

**Nombre:** Tardeos Club

**Estilo visual:** claymation / 3D suave, divertido y cálido. Fondo claro.
El isotipo es una **copa/cóctel con pajitas** (guiño a antena de TV retro) + **ondas de sonido**.

**Paleta (HEX extraídos del logo real):**
- **Magenta primario:** `#D00050` – `#E00050` (token propuesto: **`#E10A5A`**).
- **Dorado secundario:** `#E0A000` – `#F0B000` (token propuesto: **`#F5B301`**).
- **Fondo:** blanco / claro.
- *Pendiente menor: definir neutros (grises), estados (éxito/error) y versión oscura.*

**Tipografía del logo:** "Tardeos" en serif/slab con volumen; "Club" en script/cursiva.
*(Definir la tipografía de interfaz aparte — debe ser muy legible para público mayor.)*

**Activos de marca (3 versiones vistas):**
1. **Logo principal** "Tardeos Club" (horizontal, claymation).
2. **Sello "Recomendado por Tardeos Club"** (neón circular, monograma **TC** + check).
3. **Sello circular con tagline** "¿Y dónde vamos ahora? · Tu comunidad tardícola".

**Uso del SELLO "Recomendado por Tardeos Club":**
- Se muestra en los tardeos **destacados** (los de pago promocionado).
- Se **estampa automáticamente** en los flyers que genere **nuestra IA de creación de imágenes** (marca de agua / firma en alguna zona).

**Taglines / voz de marca:**
- ⭐ **Eslogan oficial: "Sal, conecta y vive el tardeo"**
- "El buscador de tardeos que va contigo"
- "¿Y dónde vamos ahora?"
- "Tu comunidad tardícola"

**Término de comunidad:** los usuarios son **"tardícolas"**.
**Tono:** cercano, festivo, sencillo. Sin tecnicismos (público mayor).

**Activos guardados en `/branding`:** ✅
- `LOGO TARDEOS_CLUB.png` — logo principal.
- `ICON TARDEOS CLUB (1).png` — icono de app.
- `SELLO VERIFICADO_TARDEOSCLUB.png` — sello para destacados + firma de flyers IA.
- `EMBLEMA_VECT_TARDEOSCLUB.png` — emblema circular con tagline.
- *(Recomendable más adelante: versiones SVG y variantes en fondo oscuro.)*

---

## 6.6 Funcionalidades núcleo detectadas (app actual)

De la app gratuita actual (capturas) heredamos y mejoramos:

| Función | Estado actual | A mejorar en la nueva |
|---|---|---|
| **Buscador de tardeos** | Existe (Inicio / Tardeos) | Filtros por zona, tipo, fecha, DJ |
| **Mapa** | Existe (Google Maps, marcadores rosas con clustering, cubre Catalunya) | Tu ubicación + **cómo llegar** + filtros sobre el mapa + rendimiento |
| **DJ's** | Sección en nav | Perfil + biografía + reputación |
| **Nexo Radio** | Enlace externo a la radio de un colaborador | Se mantiene como **enlace externo** (no se desarrolla nada; solo un link) |
| **Entrar / Únete** | Registro/login | Login sin contraseña (SMS/enlace) para mayores |

**Mapa (núcleo, muy importante):**
- Ver dónde están los tardeos y **dónde estás tú**.
- **Cómo llegar** (ruta / navegación).
- Filtrable (zona, fecha, tipo…).
- Marcadores con el branding; clustering cuando hay muchos juntos.
- Objetivo: que sea **mejor y más rápido** que el actual, y muy fácil para mayores.

---

## 7. Automatizaciones con IA (Anthropic)

| Automatización | Descripción | Nota de seguridad |
|---|---|---|
| **Lector de flyer** | IA de visión lee el flyer subido y saca fecha/DJ/hora/dirección | **Revisión humana** antes de publicar (la IA se equivoca con fechas/horas) |
| **Creador de flyers** | IA de imágenes **genera** flyers para el local | Debe estampar **siempre el sello** "Recomendado por Tardeos Club" |
| **Onboarding de local** | IA guía el alta paso a paso | La IA propone, el humano confirma pasos con dinero/publicación |
| **Generación de posts** | IA redacta publicaciones del evento | Revisable por el local |
| **Agentes de admin** | Crean locales/tardeos, invitan, siembran datos sin intervención | Definir qué puede hacer solo un agente vs qué requiere visto bueno |
| **Dirección por defecto** | Siempre la del local (la mayoría de tardeos son en su local) | — |

---

## 8. Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend / App | **Next.js** |
| Backend / BBDD / Auth | **Supabase** (gestionado por el dueño) |
| Infra / Hosting | **DigitalOcean** |
| IA | **Anthropic** (visión para flyers, generación, agentes) |
| CDN / Seguridad / DNS | **Cloudflare** |
| Pagos suscripción/promos | Por decidir (prob. Stripe) |
| Pagos entradas / listas | **Fourvenues** (externo, redirección con código RRPP) |
| Despliegue MVP | **Subdominio** del dominio actual |

---

## 9. Riesgos principales

| Riesgo | Gravedad | Mitigación |
|---|---|---|
| **Fuga gratis→pago** | 🔴 Alta | Cliente gratis siempre; grandfathering a locales fundadores; cobrar solo el valor nuevo; migración gradual |
| Migración de datos vieja→nueva | 🟠 Media | Export/import controlado; tú llevas ambos Supabase |
| IA extrae datos mal (flyer) | 🟠 Media | Revisión humana obligatoria antes de publicar |
| Autonomía excesiva de agentes | 🟠 Media | Definir límites de decisión (railes) |
| Seguridad datos (público mayor) | 🟠 Media | RLS desde día 1, RGPD, verificación de locales |
| Precio por debajo de coste de cobro | 🟡 Baja | Cobro anual / packs |

---

## 10. Estrategia gratis → pago (a desarrollar)

- **Cliente**: gratis siempre → no se le toca, no se enfada. ✅
- **Locales/DJs fundadores**: trato especial (meses gratis / precio "de por vida" bajo).
- **Cobrar el valor nuevo**: básico casi gratis; IA / promoción / destacados = pago.
- **Migración gradual**: no apagar la app gratis hasta que la nueva demuestre retención.
- **Migración de datos**: la app nueva **nace llena** con los tardeos/locales existentes;
  el local solo "reclama" su ficha ya hecha.

---

## 11. Pilares PENDIENTES de analizar

Orden propuesto (cada uno alimenta al siguiente):

1. **Roles y permisos detallados** → qué ve/hace/edita exactamente cada rol (base para RLS).
2. **Conceptos** → definir con precisión: lista, reputación DJ, post, invitación, destacado, popup, pack.
3. **Modelo de datos** (tablas Supabase) → sale de 1 y 2; se pasa en SQL.
4. **Automatizaciones IA** → diseño del lector de flyer, onboarding, agentes y sus railes.
5. **Seguridad / RGPD** → RLS, consentimiento, borrado, verificación de locales.
6. **Plan de migración** → datos viejos→nuevos + usuarios viejos→nuevos sin fuga.
7. **Estrategia gratis→pago** → precios finales, grandfathering, tramos.
8. **Branding** → ✅ base definida; falta HEX exactos, tipografía de interfaz y guardar assets en `/branding`.
9. **Diseño UX** → flujos pantalla a pantalla (público mayor), mobile-first, mapa mejorado.
10. **Roadmap del MVP** → fases realistas para 2 meses.

**Pendiente técnico del mapa:**
- **Mapa**: qué motor (Google Maps vs alternativa como Mapbox por coste/rendimiento) y qué mejoras concretas.

---

## 12. Estado de decisiones

| Tema | Estado |
|---|---|
| Modelo de negocio | ✅ Cerrado |
| Flujo de pagos / Fourvenues (atribución por RRPP) | ✅ Cerrado (falta acceso RRPP + API) |
| Cadencia de cobro (mensual + anual) | ✅ Cerrado |
| Cliente siempre gratis | ✅ Cerrado |
| Stack técnico | ✅ Cerrado |
| Objetivo: sustituir app propia (no competir) | ✅ Cerrado |
| Nombre + branding + colores + sello | ✅ Definido (HEX extraídos, assets guardados; falta tipografía UI) |
| Mapa como función núcleo | ✅ Confirmado (mejorar el actual) |
| Nexo Radio | ✅ Cerrado (enlace externo a radio de colaborador, no se desarrolla) |
| Roles detallados / permisos | ✅ Cerrado (§13, 9 decisiones tomadas) |
| Conceptos (lista, reputación, popup…) | ✅ Cerrado (§14; Posts apartado, matiz Lista/Forvenus) |
| Modelo de datos | ✅ Cerrado conceptual (§15, 19 entidades); SQL al arrancar |
| Diseño de automatizaciones IA | ✅ Cerrado (§16; generador imagen a probar) |
| Seguridad / RGPD | ✅ Cerrado (§17; falta nombre entidad legal del dueño) |
| Precios | ✅ Base cerrada (§18); Fundador/prueba/IVA por definir |
| Migración | ✅ Cerrado (§19; estrategia y flujos, mapeo espera export) |
| Diseño UX / flujos | ✅ Cerrado (§20; nav, PWA, Nunito, bilingüe, modo claro) |
| Roadmap MVP (2 meses) | ✅ Cerrado (§21; plan 8 semanas, MVP vs Fase 2) |
| Plan de migración | ⬜ Pendiente |
| Precios finales / grandfathering | ⬜ Pendiente |
| Branding | ⬜ Pendiente |
| Diseño UX / flujos | ⬜ Pendiente |
| Pasarela pagos (Stripe u otra) | ⬜ Pendiente (recomendación: Stripe) |
| Roadmap MVP | ⬜ Pendiente |

---

## 13. PILAR 1 — Roles y permisos (BORRADOR para revisar)

Leyenda: ✅ confirmado · 🔶 propuesta mía (a validar) · ❓ decisión pendiente tuya

### 13.1 Principios
- **4 roles**: Cliente, Local, DJ, Admin.
- El **Cliente** es el rol por defecto: cualquiera que se registra es cliente.
- Local y DJ son **roles "de pago"** que se añaden encima de una cuenta.
- 🔶 **Una misma persona puede tener varios roles** (ej: el dueño de un local que
  también es DJ, o un cliente que luego registra su local). La cuenta es una;
  los roles son "sombreros" que se activan. ❓ ¿Te encaja o prefieres cuentas separadas?

### 13.2 CLIENTE (gratis)
**Registro:** 🔶 login sin contraseña (SMS o enlace mágico al email) por ser público mayor.
❓ ¿Permitimos también Google? ¿Registro obligatorio para ver, o puede navegar sin registrarse y solo pedirle cuenta al inscribirse?

Puede:
- Navegar tardeos (lista + mapa), filtrar por zona/fecha/tipo/DJ.
- Ver ficha de tardeo, de local y de DJ.
- **Inscribirse** en tardeo gratis (1 toque).
- **Comprar entrada** en tardeo de pago → redirección a Forvenus.
- Ver en el mapa dónde está y **cómo llegar**.
- 🔶 Guardar favoritos / "me interesa".
- 🔶 Seguir a un local o DJ para recibir avisos de sus tardeos.
- Recibir **popups** de promos/ofertas/noticias y notificaciones.
- ❓ ¿Puede **valorar / dejar reseña** de un tardeo o local? (afecta a reputación)
- ❓ ¿Puede ver qué amigos van a un tardeo (social) o lo dejamos simple?

No puede: crear tardeos, ver datos de otros clientes, nada de gestión.

### 13.3 LOCAL (suscripción)
**Alta:** se registra, 🔶 se **verifica** (que el local existe y es suyo) y paga suscripción.
🔶 Puede empezar con una ficha **pre-creada por migración** y solo "reclamarla".
❓ ¿La verificación la hace el admin a mano, un agente IA, o ambos?

Puede:
- Editar su **perfil de local** (nombre, dirección, fotos, horarios, redes).
- **Crear / editar / borrar tardeos**.
  - Subir flyer → **IA lo lee** y rellena datos (local revisa y confirma).
  - **IA genera flyer** con el sello (si no tiene uno).
  - Marcar tardeo gratis o de pago (pago → configura enlace Forvenus).
  - Dirección por defecto = la del local.
  - Asignar **DJ(s)** al tardeo.
- Crear **listas** ❓ (definir qué es exactamente una lista — pilar Conceptos).
- **Invitar** gente ❓ (¿a qué? ¿a un tardeo, a una lista?).
- Subir **posts** (con ayuda de IA para redactar).
- Comprar **promociones**: destacados, anuncios Instagram, packs.
- Ver **estadísticas**: inscritos, visitas, y 🔶 clientes traídos vía Forvenus (cuando haya API).
- ❓ ¿Un local puede gestionar **varios locales/sedes** con una sola cuenta?

No puede: ver datos de otros locales, tocar cobros de terceros, funciones de admin.

**Estado de suscripción impago** ❓: cuando deja de pagar, ¿qué pasa?
🔶 Propuesta: sus tardeos se **ocultan/despublican** pero no se borran; al pagar vuelven.

### 13.4 DJ (suscripción)
**Alta:** se registra como DJ y paga suscripción. 🔶 También ficha reclamable por migración.

Puede:
- Completar **biografía**, foto, estilos musicales, redes, galería.
- Aparecer asociado a tardeos (cuando un local lo asigna).
- **Ganar reputación** ❓ (definir cómo: ¿nº de tardeos?, ¿valoraciones de locales?,
  ¿valoraciones de clientes?, ¿verificación?). → pilar Conceptos.
- 🔶 Subir posts / novedades.
- ❓ ¿Puede **proponerse** a un local o solo el local lo asigna?

No puede: crear tardeos por su cuenta 🔶 (los tardeos son del local), ni funciones de admin.

### 13.5 ADMIN (control total)
Interfaz por **widgets, ordenada y mobile-first**.

Puede todo, destacando:
- Crear/editar/borrar **locales, tardeos, DJs, clientes**.
- **Invitar** locales/DJs y que se registren.
- Gestionar **suscripciones, promociones y precios**.
- **Moderar** contenido (flyers, posts, reseñas).
- Aprobar **verificaciones**.
- Ver **todas las estadísticas** y el estado del negocio.
- Lanzar **popups** globales (promos/noticias).
- Gestionar los **agentes IA** y sus límites.

**Agentes IA del admin** (actúan solos con reglas):
- Sembrar/crear locales y tardeos (migración).
- Onboarding automático de locales.
- Leer flyers y pre-crear tardeos.
- ❓ Límite: ¿qué pueden **publicar/cobrar solos** y qué requiere visto bueno del admin?
- 🔶 Propuesta: agentes pueden **preparar** todo (borradores) pero **publicar/cobrar
  requiere confirmación** hasta que confiemos en ellos.

### 13.6 Matriz rápida (resumen)

| Acción | Cliente | Local | DJ | Admin |
|---|:--:|:--:|:--:|:--:|
| Navegar / mapa / filtrar | ✅ | ✅ | ✅ | ✅ |
| Inscribirse / comprar entrada | ✅ | ✅ | ✅ | ✅ |
| Crear/editar tardeos | ❌ | ✅ (suyos) | ❌ | ✅ (todos) |
| Subir/generar flyer con IA | ❌ | ✅ | ❌ | ✅ |
| Perfil de local | ❌ | ✅ | ❌ | ✅ |
| Perfil/bio de DJ | ❌ | 🔶 | ✅ | ✅ |
| Listas / invitar / posts | ❌ | ✅ | 🔶 | ✅ |
| Comprar promociones | ❌ | ✅ | 🔶 ¿DJ? | ✅ |
| Ver estadísticas propias | ❌ | ✅ | ✅ | ✅ (todas) |
| Moderar / verificar / precios | ❌ | ❌ | ❌ | ✅ |
| Lanzar popups globales | ❌ | ❌ | ❌ | ✅ |

### 13.7 Decisiones tomadas de este pilar ✅
1. ✅ **Multi-rol en una sola cuenta**. Una persona puede ser cliente + local + DJ; los roles se activan como "sombreros".
2. ✅ **Navegar sin registro**. Se puede ver todo (lista, mapa, fichas) sin cuenta; solo se pide registro al **inscribirse o comprar**.
3. ✅ **Verificación de local = agente IA prepara + admin aprueba**.
4. ✅ **Reseñas de clientes = SÍ, simples** (valoración/like) desde el inicio; el admin modera.
5. ✅ **Reputación de DJ = mezcla**: nº de tardeos + valoración del local + verificación.
6. ✅ **Sin multi-sede en el MVP** (1 local = 1 dirección). Se deja para una fase posterior.
7. ✅ **Impago = ocultar contenido, no borrar**. Al volver a pagar, se recupera.
8. ✅ **El DJ también puede comprar promoción** (destacar su perfil).
9. ✅ **Agentes preparan borradores; publicar/cobrar requiere OK del admin** (por ahora).

---

## 14. PILAR 2 — Conceptos (BORRADOR para revisar)

Definición precisa de cada entidad. Leyenda: ✅ claro · 🔶 propuesta mía · ❓ decisión tuya

### 14.1 Tardeo (la entidad central)
Un evento de tarde creado por un local.
- **Campos**: título, local, dirección (por defecto la del local), fecha, hora inicio/fin,
  DJ(s), descripción, flyer (subido o generado por IA), tipo/estilo, gratis o de pago,
  (si de pago) enlace Forvenus, zona.
- **Estados** 🔶: `borrador` → `publicado` → `finalizado` / `cancelado`.
- **Gratis** → botón "Apuntarme" (inscripción interna).
- **De pago** → botón "Comprar entrada" (redirección a Forvenus).

### 14.2 Inscripción (tardeo gratis)
Registro de que un cliente va a un tardeo gratis. 1 toque.
- Sirve al local para saber **cuánta gente viene** y para avisar/recordar.
- 🔶 El cliente puede cancelar su inscripción.

### 14.3 Compra de entrada (tardeo de pago)
NO se cobra dentro de la app → **redirección a Forvenus** con parámetros de atribución.
- 🔶 Guardamos el "clic de intención" (para estadística), pero la venta la confirma Forvenus.

### 14.4 Lista ✅ (= "Listas de invitados" nativas de Fourvenues)
"Lista" en Tardeos Club = la **lista de invitados de Fourvenues** (función nativa suya).
- En nuestra app la lista es un **botón "Apuntarme a la lista"** que **redirige a Fourvenues**
  (con código RRPP del admin), donde el cliente se apunta y obtiene su beneficio.
- **No gestionamos la lista ni sus datos**: vive en Fourvenues.
- 🔶 Guardamos como mucho el "clic de intención" para estadística/atribución.
- ✅ Matiz resuelto: la lista **vive en Fourvenues**; nosotros solo enlazamos/mostramos.

### 14.5 Invitación
🔶 Mecanismo para que un local (o cliente) **comparta** un tardeo o una lista.
- Genera un enlace/tarjeta que se envía por WhatsApp/redes.
- ❓ ¿La invitación es solo "compartir", o implica algo más (cupos, control de aforo)?

### 14.6 Post ⏸️ (APARTADO — se decide más adelante)
Contenido social que publica un local o DJ (novedad, foto, aviso).
- El dueño tiene **dudas** sobre este concepto → **se deja fuera del cierre por ahora**.
- Se retomará antes del roadmap (decidir si entra en MVP o fase 2, y si feed global o no).

### 14.7 Destacado
Un tardeo (o perfil de DJ) **promocionado de pago**.
- Aparece arriba / resaltado en listados y mapa.
- Lleva el **sello "Recomendado por Tardeos Club"**.
- Se compra como promoción (ver Packs).
- 🔶 Tiene duración (ej: 7 días) y/o zona.

### 14.8 Promociones y Packs ✅
Servicios de pago para dar visibilidad:
- **Destacado** (posición top + sello).
- **Anuncio en Instagram** sobre el tardeo.
- **Packs mensuales**: combos (ej: X destacados + Y anuncios/mes) a mejor precio.
- ✅ **El admin tiene control total del catálogo de promociones**: puede **editar precios,
  crear promociones nuevas y crear "listas de promociones"** (combos de oferta), ej:
  *"entrada + 1 chupito"*. Los precios/combos que yo proponga son **orientativos y editables**.
- 🔶 **Nota de concepto**: distinguir dos cosas con nombre parecido:
  - *Lista de invitados* (§14.4, vía Forvenus).
  - *Lista de promociones* = catálogo de ofertas/combos que gestiona el admin (esto).

### 14.9 Reputación (DJ)
✅ Se compone de: nº de tardeos realizados + valoración de los locales + verificación.
- 🔶 Se muestra como nivel/estrellas o insignias.
- ❓ ¿Añadimos también la valoración de clientes al cálculo, o solo la del local?

### 14.10 Reseña / Valoración (cliente)
✅ Existe, simple (valoración + comentario corto). El admin modera.
- 🔶 Sobre el tardeo y/o el local. ❓ ¿También sobre el DJ?

### 14.11 Favorito / Seguir (cliente)
- **Favorito** 🔶: guardar un tardeo para verlo luego.
- **Seguir** 🔶: seguir a un local o DJ para recibir avisos de sus tardeos.

### 14.12 Popup ✅
Ventana emergente para el **cliente** con promo/oferta/noticia.
- ✅ **Solo el admin** puede lanzar popups (global). Los locales NO.

### 14.13 Verificación
Insignia de confianza:
- **Local verificado**: agente IA + admin confirman que existe y es suyo.
- **DJ verificado**: aporta a su reputación.

### 14.14 Decisiones tomadas de este pilar ✅
1. ✅ **Lista = "lista de invitados" nativa de Fourvenues** (vive en Fourvenues; nosotros solo enlazamos con código RRPP). *Matiz resuelto.*
2. ✅ **Invitación = compartir + control de aforo/cupos** opcional.
3. ⏸️ **Posts = apartado**, se decide más adelante (dudas del dueño).
4. ✅ **Promociones/Packs: yo propongo precios orientativos; el admin los edita y crea promos + "listas de promociones"** (combos tipo entrada+chupito).
5. ✅ **Reputación DJ = local + verificación** (base); valoración de cliente suma poco.
6. ✅ **Reseña al DJ = sí, solo clientes que asistieron.**
7. ✅ **Popups = solo admin.**

---

## 15. PILAR 3 — Modelo de datos conceptual (BORRADOR para revisar)

Nivel conceptual (entidades + campos + relaciones). Sobre **Supabase/Postgres + Auth**.
Leyenda: 🔶 propuesta a validar · ❓ decisión pendiente. *SQL se hará al validar esto.*

### 15.1 Principio de identidad (multi-rol)
- **`profiles`** = 1 fila por persona (extiende `auth.users`). **Todos son clientes.**
- Ser **Local** = tener una fila en `locales` (owner = profile).
- Ser **DJ** = tener una fila en `djs` (profile = profile).
- Ser **Admin** = flag `is_admin` en `profiles`.
- Así una misma cuenta puede ser cliente + local + DJ sin duplicar cuentas.

### 15.2 Entidades

**profiles** (base de todos)
`id (=auth.uid)` · display_name · phone · email · avatar_url · `is_admin` (bool) ·
created_at · updated_at

**locales**
`id` · `owner_id→profiles` · nombre · descripcion · **direccion + lat + lng** ·
`zona_id→zonas` · telefono · redes(json) · fotos(json) · horarios(json) ·
`verificado` (bool) · `estado` (borrador/activo/oculto_impago) ·
**`fourvenues_rrpp_code`** (código/acceso que CADA local da al admin para atribución) ·
🔶 `fourvenues_perfil` (referencia al local en Fourvenues, si aplica) · created_at

**djs**
`id` · `profile_id→profiles` · nombre_artistico · bio · estilos(array) · galeria(json) ·
redes(json) · `verificado` (bool) · `reputacion_score` (num, cacheado) · created_at

**tardeos** (entidad central)
`id` · `local_id→locales` · titulo · descripcion · **fecha · hora_inicio · hora_fin** ·
direccion + lat + lng (por defecto los del local) · `zona_id→zonas` · tipo/estilo ·
`flyer_url` · `flyer_origen` (subido/ia) · `es_de_pago` (bool) · `tiene_lista` (bool) ·
🔶 `fourvenues_url` (enlace de compra/lista; se le añade el **código RRPP del local**, de `locales.fourvenues_rrpp_code`) ·
`estado` (borrador/publicado/finalizado/cancelado) · `destacado_hasta` (timestamp|null) ·
`created_by` (local/admin/agente) · created_at

**tardeo_djs** (M:N tardeo ↔ dj)
`tardeo_id→tardeos` · `dj_id→djs`

**inscripciones** (solo tardeos gratis)
`id` · `tardeo_id→tardeos` · `profile_id→profiles` · estado (apuntado/cancelado) · created_at

**clics_atribucion** (redirecciones a Fourvenues, para estadística)
`id` · `tardeo_id→tardeos` · `profile_id→profiles` (nullable) · tipo (entrada/lista) ·
destino_url · created_at

### 15.3 Monetización

**suscripciones**
`id` · `profile_id→profiles` · `rol` (local/dj) · `plan` (mensual/anual) ·
`estado` (activa/impago/cancelada) · precio · proveedor (stripe) · stripe_customer/sub_id ·
periodo_fin · created_at

**promociones_catalogo** (ADMIN editable — decisión pilar 2 #4)
`id` · nombre · `tipo` (destacado/instagram/pack/combo) · descripcion · precio ·
duracion_dias · `config` (json, ej: "entrada+chupito") · activo · created_at

**promociones_compradas**
`id` · `comprador_profile_id→profiles` · `rol_comprador` (local/dj) ·
`promocion_id→promociones_catalogo` · `tardeo_id→tardeos` (si aplica) ·
inicio · fin · estado · `pago_id→pagos` · created_at

**pagos** (registro de cobros propios: suscripción/promoción)
`id` · `profile_id→profiles` · concepto · importe · proveedor · referencia_externa ·
estado · created_at

### 15.4 Comunidad y confianza

**resenas** (valoraciones — decisión pilar 1 #4)
`id` · `autor_profile_id→profiles` · `objetivo_tipo` (tardeo/local/dj) · `objetivo_id` ·
puntuacion · comentario · `estado_moderacion` (pendiente/aprobada/rechazada) · created_at
- 🔶 Regla: reseña a **DJ** solo si el autor **asistió** (hay inscripción/clic).

**favoritos** · `profile_id` · `tardeo_id`
**seguimientos** · `profile_id` · `objetivo_tipo` (local/dj) · `objetivo_id`

**invitaciones** (compartir + aforo — decisión pilar 2 #2)
`id` · `tipo` (tardeo/lista) · `objetivo_id` · token/enlace · `aforo_max` (nullable) ·
`creado_por→profiles` · created_at

**popups** (solo admin — decisión pilar 2 #7)
`id` · titulo · contenido · imagen · tipo (promo/oferta/noticia) ·
segmento (global/zona) · activo · inicio · fin · `created_by→profiles(admin)` · created_at

**verificaciones** (agente prepara + admin aprueba — decisión pilar 1 #3)
`id` · `objetivo_tipo` (local/dj) · `objetivo_id` · `estado` (pendiente/aprobada/rechazada) ·
`preparada_por_agente` (bool) · `aprobada_por→profiles(admin)` · created_at

### 15.5 Automatización / control

**agente_acciones** (borradores de IA — decisión pilar 1 #9)
`id` · tipo (crear_local/crear_tardeo/leer_flyer/onboarding…) · `payload` (json) ·
`estado` (borrador/aprobado/publicado/descartado) · `revisado_por→profiles(admin)` · created_at
- Encarna la regla: **los agentes preparan; publicar/cobrar requiere OK del admin.**

**zonas** (para filtros y mapa) — ⚡ **DINÁMICAS, no lista fija**
`id` · nombre · tipo (ciudad/comarca/provincia) · 🔶 geo(opcional)
- **Regla**: las zonas de los filtros se **derivan de los tardeos publicados** (de locales
  aprobados por el admin). Si un local pone una ubicación nueva (ej. **Lleida**), esa zona
  **aparece sola** en los filtros y en "Explora por zona". No hay que predefinirlas.
- Foco de captación inicial: Barcelona · Maresme · Costa Brava, pero el sistema admite
  cualquier zona donde haya un tardeo real.

**posts** ⏸️ (apartado — pilar 2) — se modelará si entra en el MVP.

### 15.6 Mapa de relaciones (texto)
```
profiles ──< locales ──< tardeos ──< inscripciones >── profiles
   │            │            │
   │            │            ├──< tardeo_djs >── djs ── profiles
   │            │            ├──< clics_atribucion >── profiles
   │            │            └── fourvenues_url (externo)
   │            └── suscripcion(local)
   ├── djs ── suscripcion(dj)
   ├──< resenas / favoritos / seguimientos
   ├──< promociones_compradas >── promociones_catalogo
   └──< pagos
admin(profiles.is_admin) ──< popups, verificaciones, agente_acciones
```

### 15.7 Decisiones tomadas de este pilar ✅
1. ✅ **Código RRPP = por local**. Cada local da al admin su código/acceso Fourvenues → se guarda en `locales.fourvenues_rrpp_code` y se usa al construir el enlace de redirección.
2. ✅ **Zonas predefinidas**, foco Barcelona · Maresme · Costa Brava, ampliable a toda Catalunya costa.
3. ✅ **Reseñas = local + DJ** (no al tardeo).
4. ✅ **Sin entidades extra de base** por ahora; se añadirán cuando el dueño aporte más requisitos.

---

## 16. PILAR 4 — Automatizaciones IA (BORRADOR para revisar)

Leyenda: 🔶 propuesta · ❓ decisión pendiente · ⚠️ aviso técnico importante

### ⚠️ Aviso técnico de base (no dar por hecho)
- **Claude (Anthropic) = TEXTO + VISIÓN.** Sirve para **LEER** flyers y **redactar**, NO para
  **dibujar/generar imágenes**.
- Para **CREAR** flyers (imágenes) hace falta un **modelo de imágenes aparte**
  (ej: Flux, Ideogram, o generador vía MCP). Claude ayuda con el *concepto y el texto*;
  el generador de imágenes crea el arte; y **el sello se estampa por código** (no lo dibuja
  la IA) para que **siempre salga idéntico y bien** → consistencia de marca garantizada.

### 16.1 Lector de flyer (flyer → datos) — Claude visión
**Objetivo:** el local sube el flyer y la IA rellena el tardeo.
- **Modelo:** 🔶 Claude Sonnet (buena visión) con **salida estructurada** (tool use → JSON).
- **Extrae:** título · fecha · hora inicio/fin · DJ(s) · dirección · tipo/estilo ·
  gratis/de pago · precio si aparece · enlace si aparece.
- **Dirección por defecto:** la del local (aunque el flyer diga otra, se avisa).
- **Confianza:** cada campo con nivel de confianza; los dudosos se marcan en amarillo.
- **✅ Revisión humana obligatoria:** el local confirma/edita antes de publicar (decisión previa).
- **Casos difíciles:** flyer de baja calidad, varias fechas, texto en catalán/castellano,
  fechas ambiguas (sin año) → la IA propone, el humano decide.
- **Idiomas:** entender y responder en **castellano y catalán**.

### 16.2 Creador de flyer (con sello) — imagen multimodal + código
**Objetivo:** el local que no tiene flyer, que la IA le genere uno.

**⚠️ Requisito confirmado:** el generador debe funcionar **como ChatGPT / Higgsfield / Claude
design** → aceptar **PROMPT + ADJUNTOS de referencia** (fotos del local, logos, branding,
imágenes de DJs, la propia identidad de marca). No basta un generador de solo-texto.
→ Necesitamos un modelo **multimodal con imágenes de referencia** (image + text-to-image).

- **Paso 1 (Claude):** con los datos del tardeo, redacta el **texto del flyer** y arma el
  **prompt** + selecciona los **adjuntos** (logo, colores, foto del local/DJ).
- **Paso 2 (generador multimodal):** genera el arte usando prompt **y** referencias.
  ❓ **proveedor a elegir** (ver 16.8) — debe soportar varias imágenes de entrada.
- **Paso 3 (código):** **estampa el sello oficial** "Recomendado por Tardeos Club"
  por composición determinista → **siempre idéntico y bien colocado** (aunque el generador
  ya use el branding como referencia, el sello final se pega por código para garantía).
- **Interfaz:** caja de prompt + zona de **subir adjuntos** (drag & drop), mobile-first.
- **Revisión:** el local ve el resultado y aprueba / regenera / ajusta prompt.

### 16.3 Onboarding de local asistido — Claude conversacional
**Objetivo:** dar de alta un local sin fricción, guiado paso a paso.
- Claude pregunta lo mínimo (nombre, dirección, redes…) en lenguaje natural y **rellena
  el formulario** por detrás (tool use).
- Puede **buscar/pre-rellenar** datos públicos (redes, dirección) para que el local solo confirme.
- 🔶 Al final: queda pendiente de **verificación** (agente prepara + admin aprueba).

### 16.4 Agentes del admin (siembra / migración / invitaciones)
**Objetivo:** poblar y operar la app sin que el admin trabaje.
- **Sembrar/migrar:** crear fichas de locales/tardeos existentes → nacen como **borradores**.
- **Invitar:** preparar invitaciones a locales/DJs para que reclamen su ficha.
- **Leer flyers en lote** y pre-crear tardeos.
- ✅ **Regla de oro (decisión pilar 1 #9):** los agentes **preparan borradores**;
  **publicar o cobrar requiere OK del admin**. Todo queda en `agente_acciones` con su estado.

### 16.5 Redacción asistida (textos)
- Descripciones de tardeo, textos de posts (si entran), mensajes de invitación.
- **Modelo:** 🔶 Claude Haiku (barato y rápido) para textos simples.

### 16.6 Selección de modelos y control de coste
| Tarea | Modelo propuesto | Motivo |
|---|---|---|
| Leer flyer (visión) | 🔶 Claude Sonnet | Necesita visión fiable |
| Onboarding / agentes | 🔶 Claude Sonnet | Razonamiento + tool use |
| Textos simples | 🔶 Claude Haiku | Barato y rápido |
| Generar imagen flyer | ❓ **multimodal con referencias** (gpt-image-1 / Gemini "Nano Banana" / Higgsfield) | Debe aceptar prompt **+ adjuntos** (logos/branding/fotos) |

**Control de coste y calidad:**
- **Prompt caching** del system prompt (mismas instrucciones → más barato).
- **Batch** para tareas no urgentes (siembra masiva de flyers).
- **Salida estructurada (JSON schema / tool use)** → nada de parsear texto a mano.
- **Reintentos** con validación; si la IA no está segura, **lo marca**, no inventa.

### ⚠️ 16.7 Seguridad de la IA (importante)
- **Inyección de prompts vía flyer:** un flyer podría contener texto malicioso
  ("ignora tus instrucciones…"). → El texto extraído se trata **como DATO, nunca como orden**.
- Los agentes **no ejecutan acciones con dinero/publicación** sin aprobación.
- Registrar todo en `agente_acciones` (auditoría).

### 16.8 Decisiones tomadas de este pilar ✅
1. ✅ **Generador de imágenes multimodal (prompt + adjuntos obligatorio)**. Finalistas:
   **gpt-image-1 (OpenAI)** y **Gemini 2.5 Flash Image ("Nano Banana")**.
   → **Se prueban ambos con el sello/branding real y se elige en fase de pruebas.**
2. ✅ **Onboarding busca datos públicos** (redes/dirección) para pre-rellenar; el local confirma.
3. ✅ **Modelos Claude**: Sonnet (visión/agentes) + Haiku (textos). Confirmado.
4. ✅ **IA bilingüe**: responde en **castellano y catalán** según el usuario.

---

## 17. PILAR 5 — Seguridad y RGPD (BORRADOR para revisar)

Leyenda: 🔶 propuesta · ❓ decisión pendiente · ⚠️ crítico

### BLOQUE A — Seguridad técnica

### 17.1 Row Level Security (RLS) en Supabase — ⚠️ desde el día 1
Cada tabla con políticas. Regla base: **cada uno solo ve/edita lo suyo**.
| Tabla | Lectura | Escritura |
|---|---|---|
| profiles | propia (público: solo campos públicos) | propia · admin |
| locales | pública si `activo` | owner · admin |
| djs | pública | dueño del perfil · admin |
| tardeos | pública si `publicado` | local dueño · admin/agente |
| inscripciones | propia + local del tardeo | propia (crear/cancelar) · admin |
| suscripciones / pagos | propia | sistema (server) · admin |
| resenas | pública si `aprobada` | autor (si asistió) · admin modera |
| promociones_compradas | propia | sistema · admin |
| popups | pública si `activa` | **solo admin** |
| verificaciones / agente_acciones | **solo admin** | solo admin/agente |

- **`service_role` key solo en servidor** (edge functions), NUNCA en el cliente.
- El cliente usa **anon key + RLS**; nada sensible expuesto.

### 17.2 Autenticación
- 🔶 **Login sin contraseña** (OTP por SMS / enlace mágico email) → fácil para mayores.
- **Rate limiting** en envío de OTP (evitar abuso/coste SMS).
- Sesiones seguras (cookies httpOnly), expiración razonable.
- ❓ ¿Verjación de edad **18+** al registrarse (ocio nocturno)?

### 17.3 Pagos
- **Stripe** (o similar) → **nunca guardamos tarjetas**; solo referencias (customer/sub id).
- Webhooks de Stripe **firmados y verificados** en servidor.
- Fourvenues: redirección **sin enviar datos personales** innecesarios; solo lo mínimo
  (id tardeo + código RRPP). Los datos de pago viven en Fourvenues.

### 17.4 Infraestructura
- **Cloudflare** delante: WAF, anti-DDoS, rate limiting, HTTPS forzado.
- **Secretos** en variables de entorno de Supabase / edge functions (nunca en el repo/cliente).
- Claves de API (Anthropic, generador imágenes, Stripe) **solo en servidor**.
- **Backups** automáticos de la base (Supabase) + política de restauración.
- Subdominio del MVP con su propio aislamiento.

### 17.5 Seguridad de IA y contenido
- **Inyección de prompts vía flyer** → texto extraído tratado como **dato, no orden** (§16.7).
- **Moderación**: flyers y reseñas pasan por control (admin) antes de ser públicos.
- Agentes: sin acciones de dinero/publicación sin OK; todo en `agente_acciones` (auditoría).

### BLOQUE B — RGPD / Protección de datos (España/UE)

### 17.6 Bases legales del tratamiento
- **Contrato**: suscripciones de local/DJ (necesario para prestar el servicio).
- **Consentimiento**: notificaciones, popups de marketing, emails promocionales.
- **Interés legítimo**: fichas de locales pre-creadas por migración (con opt-out fácil).

### 17.7 Documentos legales necesarios (a redactar)
- **Política de privacidad** (con lista de subencargados: ver 17.8).
- **Términos y condiciones** (incluida la relación con Fourvenues).
- **Política de cookies** + banner de consentimiento (si hay analítica).
- **Aviso legal** (datos del responsable del tratamiento).
- 🔶 Puedo **redactar borradores**; conviene revisión de un asesor antes de publicar.

### 17.8 Subencargados (proveedores que tocan datos) — ⚠️ transparencia
| Proveedor | Uso | Ubicación datos |
|---|---|---|
| Supabase | BBDD, auth | 🔶 elegir **región UE** |
| DigitalOcean | hosting | 🔶 **región UE** (Ámsterdam/Frankfurt) |
| Cloudflare | CDN/seguridad | Global (EU-friendly) |
| Anthropic | leer flyers / textos | EE. UU. → **API no entrena** con los datos por defecto |
| OpenAI / Google | generar imágenes | EE. UU. → disclosar |
| Stripe | pagos suscripción | UE/EE. UU. (cumple RGPD) |
| Fourvenues | entradas/listas | Externo (su propia política) |
- ⚠️ **Recomendación**: alojar BBDD y hosting en **UE**; disclosar las transferencias a EE. UU.
  (IA/pagos) en la política de privacidad.

### 17.9 Derechos de los usuarios (ARCO+)
- Acceso, rectificación, **supresión** (borrar cuenta), portabilidad, oposición.
- 🔶 **Botón "borrar mi cuenta"** en la app (autoservicio) → cumple y da confianza.
- Minimización: pedir **solo los datos necesarios** (nombre, teléfono/email).

### 17.10 Migración y datos existentes (enlaza con Pilar 6)
- Los usuarios de la app gratis → **mismo responsable** (dueño), pero **nuevo servicio**.
- ⚠️ Hay que **informarles** del cambio y (para lo de pago/marketing) **recabar consentimiento**.
- Fichas de locales sembradas desde datos públicos → interés legítimo + opt-out.

### 17.11 Público mayor — protección extra
- Lenguaje claro en avisos y consentimientos (nada de letra pequeña engañosa).
- Anti-fraude: verificación de locales, moderación, y **no** pedir datos de más.

### 17.12 Decisiones tomadas de este pilar ✅
1. ⏳ **Responsable del tratamiento**: **nombre comercial = TardeosClub**. La entidad legal
   (autónomo o S.L.) **aún no está constituida**. Los textos legales se redactan con el nombre
   comercial y con hueco para NIF/CIF cuando exista. A confirmar por el dueño.
2. ✅ **Datos en la UE**: Supabase (región UE) + DigitalOcean (Frankfurt/Ámsterdam).
3. ✅ **Verificación 18+** al registrarse (casilla simple).
4. ✅ **Analítica = Plausible** (sin cookies → evitamos banner molesto para mayores).
5. ✅ **Redactaré los borradores legales** (privacidad, términos, cookies, aviso legal),
   con revisión final de un asesor y a nombre de la entidad que indique el dueño.

---

## 18. PILAR 7 — Precios (BORRADOR para revisar)

Leyenda: 🔶 propuesta editable · ❓ decisión pendiente · ⚠️ ojo
> Todos los precios son **orientativos y editables por el admin** (decisión pilar 2 #4).
> El dinero real está en **promociones + comisión Fourvenues**; la suscripción es un peaje bajo.

### 18.1 Suscripciones (mensual + anual con descuento)
| Rol | Mensual | Anual (≈2 meses gratis) | Nota |
|---|---|---|---|
| **Local** | 1,99 € | 🔶 19,99 €/año | anual = más margen (menos comisión) |
| **DJ** | 0,99 € | 🔶 9,99 €/año | igual |

- 🔶 **Prueba gratis** 1 mes para locales nuevos (reduce fricción de entrada).
- 🔶 **Precio Fundador** (grandfathering) para los locales/DJs que vienen de la app gratis:
  ej. **6 meses gratis** o precio reducido de por vida. (Estrategia gratis→pago).

### 18.2 Promociones sueltas
| Promoción | 🔶 Precio | Qué incluye |
|---|---|---|
| **Destacado** | 4,99 € / 7 días | posición top en listado y mapa + **sello** |
| **Destacado Premium** | 9,99 € / evento | top absoluto + sello + badge especial |
| **Impulso Instagram** | 🔶 14,99 € | diseño + publicación del tardeo en el IG de TardeosClub |
| **Impulso IG + pago** | ❓ | shoutout + anuncio pagado (requiere presupuesto de ads aparte) |

⚠️ **Instagram**: hay dos modelos muy distintos —
- **Orgánico** (publicar en la cuenta de TardeosClub): precio fijo, simple. 🔶 recomendado para empezar.
- **Anuncio pagado** (Meta Ads): implica **presupuesto publicitario** además de nuestra tarifa
  → más complejo. Decidir si entra ya o en fase 2.

### 18.3 Packs mensuales (combos con descuento)
| Pack | 🔶 Precio/mes | Incluye |
|---|---|---|
| **Básico** | 1,99 € | Solo suscripción (crear tardeos + IA) |
| **Pro** | 🔶 9,99 € | Suscripción + 2 destacados/mes + 1 impulso IG |
| **Premium** | 🔶 19,99 € | Suscripción + destacados ilimitados + 4 impulsos IG/mes |

### 18.4 Combos al cliente ("listas de promociones", ej: entrada + chupito)
- Son **ofertas que el local/admin muestra al cliente** (no ingreso directo nuestro).
- El admin las crea/edita en `promociones_catalogo`.
- 🔶 Se pueden asociar a un tardeo como gancho ("Entra por la lista y llévate 1 chupito").
- El valor para nosotros: hacen más atractivo el tardeo → más clics → más comisión Fourvenues.

### 18.5 DJ y promociones (decisión pilar 1 #8)
- El DJ puede comprar **Destacado de perfil** 🔶 4,99 €/7 días para ganar visibilidad.

### 18.6 Fiscalidad (⚠️ no dar por hecho)
- ❓ **IVA (21%)**: ¿los precios se muestran **IVA incluido** o **+ IVA**?
  - Cliente/consumidor final → suele mostrarse **IVA incluido**.
  - B2B (locales/DJs) → habitual **+ IVA** y factura.
- 🔶 Recomendación: mostrar **IVA incluido** en la interfaz y detallar en factura.
- Facturación automática de suscripciones (Stripe puede emitir facturas).

### 18.7 Decisiones tomadas de este pilar
1. ✅ **Precios base**: Local 1,99 €/mes (19,99 €/año) · DJ 0,99 €/mes (9,99 €/año).
2. ✅ **Instagram = orgánico en el MVP** (publicación en la cuenta de TardeosClub);
   anuncio pagado (Meta Ads) queda para **fase 2**.
3. ✅ **Packs Básico / Pro / Premium** confirmados.
4. ⏳ **Precio Fundador** (migración app gratis) → **POR DEFINIR**.
5. ⏳ **Prueba gratis 1 mes** para locales nuevos → **POR DEFINIR**.
6. ⏳ **IVA** (incluido vs + IVA) → **POR DEFINIR** (depende de la entidad legal del dueño).

---

## 19. PILAR 6 — Migración (BORRADOR para revisar)

Leyenda: 🔶 propuesta · ❓ decisión pendiente · ⚠️ ojo
> Objetivo: pasar de la app gratis a la nueva **sin perder datos ni usuarios**, y que la
> app **nazca llena**. El mapeo exacto de campos espera el **export del dueño** (ver PEDIR_AL_DUENO).

### 19.1 Qué migramos
| Dato | ¿Migrar? | Notas |
|---|---|---|
| **Locales** | ✅ | Se crean como fichas **pre-hechas** (estado: no reclamado) |
| **Tardeos** | ✅ | Los +360; los pasados → `finalizado`, los futuros → `publicado` |
| **DJs** | ✅ | Fichas pre-hechas reclamables |
| **Zonas** | ✅ | Mapear a las zonas predefinidas (BCN, Maresme, Costa Brava…) |
| **Clientes** | ❓ | Ver 19.4 (tema RGPD) |
| Contraseñas | ❌ | No se migran (login sin contraseña / OTP) |

### 19.2 Cómo se migra (proceso técnico)
1. **Export** de la base actual (CSV/SQL/JSON) → lo da el dueño.
2. **Mapeo + limpieza** (script que yo te preparo en texto): normalizar fechas, zonas,
   direcciones; deduplicar; **geocodificar direcciones** (dirección → lat/lng para el mapa).
3. **Import** al Supabase nuevo (tú lo ejecutas).
4. **Verificación**: contar registros, revisar muestras, cuadrar totales.
- 🔶 Todo lo migrado entra como **borrador/no reclamado**, no publicado a ciegas.

### 19.3 Reclamar ficha (el flujo clave para locales/DJs)
- El local/DJ ya existe en la app nueva con su ficha hecha.
- Le llega una **invitación** (❓ email / WhatsApp / teléfono) para **"reclamar"** su ficha.
- Al reclamar: verifica que es suyo (agente IA + admin), activa cuenta y **empieza suscripción**
  (con **Precio Fundador**: meses gratis por venir de la app original).
- Ventaja: no parte de cero → se encuentra su local y sus tardeos ya cargados.

### 19.4 Clientes y RGPD ⚠️
- Migrar clientes = migrar **datos personales** → hay base legal (mismo responsable) pero
  **hay que informarles** del cambio de servicio.
- 🔶 Opción recomendada: **no migrar en masa** las cuentas de cliente; en su lugar,
  **avisar desde la app vieja** ("nos mudamos, entra aquí") y que **re-entren** con su
  teléfono/email (login OTP). Así el consentimiento es limpio y evitamos arrastrar datos viejos.
- ❓ Alternativa: migrar contactos y mandar **1 aviso** del cambio con opt-out.

### 19.5 Convivencia app vieja ↔ nueva
- App vieja sigue en el **dominio**; la nueva arranca en **subdominio** (MVP).
- 🔶 Fases:
  1. Nueva en subdominio, en pruebas, con datos migrados.
  2. Se invita a locales/DJs a reclamar ficha (grupo piloto por zona).
  3. Cuando la nueva retiene bien → se **redirige el dominio** a la nueva.
  4. Se apaga la vieja (sin prisa; nada de cortar de golpe).
- ⚠️ Regla: **no apagar la vieja** hasta que la nueva demuestre que funciona y retiene.

### 19.6 Riesgos y mitigación
| Riesgo | Mitigación |
|---|---|
| Perder datos en el traspaso | Export + verificación + backup antes de importar |
| Direcciones sin coordenadas (mapa) | Geocodificación en el paso de limpieza |
| Duplicados | Deduplicar por nombre+dirección |
| Locales que no reclaman | Recordatorios + ayuda del agente IA + Precio Fundador |
| Fuga de clientes por el cambio | Cliente sigue gratis + app más fácil + avisos claros |

### 19.7 Decisiones tomadas de este pilar ✅
1. ✅ **Clientes = re-registro limpio** (avisar desde la app vieja, entran con OTP). RGPD impecable.
2. ✅ **Canal para reclamar ficha = WhatsApp/email** (pendiente confirmar qué contactos tenemos).
3. ✅ **Migración por piloto de una zona** (ej. Maresme) antes de ir a por todo.
4. ✅ **Export lo aporta el dueño** (en PEDIR_AL_DUENO) → desbloquea el mapeo fino.

---

## 20. PILAR 9 — UX / Flujos (BORRADOR para revisar)

Leyenda: 🔶 propuesta · ❓ decisión pendiente
> Regla nº1: **mobile-first + público mayor**. Todo se diseña primero en móvil.

### 20.1 Principios de diseño para público mayor
- **Texto grande** (cuerpo ≥ 17–18px), títulos claros.
- **Botones grandes** (alto ≥ 48px), separados, fáciles de tocar.
- **Alto contraste**; nada de gris claro sobre blanco.
- **Icono + palabra** siempre (nunca solo icono).
- **1 acción principal por pantalla** (el botón importante destaca en magenta).
- **Poco scroll**, poco texto, lenguaje sencillo (nada de tecnicismos).
- **Login sin contraseña** (OTP SMS / enlace). Sin registros largos.
- 🔶 **PWA "Añadir a inicio"**: se instala como app sin pasar por tiendas.

### 20.2 Navegación (cliente) — barra inferior fija
🔶 4–5 pestañas grandes: **Inicio · Tardeos · Mapa · Favoritos · Perfil**
(+ acceso a **Nexo Radio** como enlace externo). ❓ ¿estas 5 o ajustamos?

### 20.3 Flujo CLIENTE (el más importante — cero fricción)
1. **Inicio**: saludo + "¿Y dónde vamos ahora?" + botones grandes **Ver tardeos** /
   **Filtrar** + vista previa del **mapa** + **destacados** (con sello).
2. **Tardeos (listado)**: tarjetas grandes con flyer, fecha, local, zona y botón.
   Filtros arriba: **zona · fecha · tipo · DJ**.
3. **Mapa**: pines de tardeos + **tu ubicación** + **cómo llegar** + filtros.
4. **Ficha de tardeo**: flyer grande, fecha/hora, local, DJ, mini-mapa, y **1 botón grande**:
   - Gratis → **Apuntarme**
   - De pago → **Comprar entrada** (→ Fourvenues)
   - Con lista → **Apuntarme a la lista** (→ Fourvenues)
5. **Registro/login**: solo aparece **al apuntarse/comprar** → OTP + casilla **18+**.
6. **Perfil**: mis inscripciones, favoritos, a quién sigo.
7. **Popups**: promo/oferta/noticia al abrir (lanzados por admin), fáciles de cerrar.

### 20.4 Flujo LOCAL
1. **Alta asistida por IA**: conversación corta → IA rellena y pre-busca datos → verificación.
2. **Panel del local** (widgets): mis tardeos · **crear tardeo** · estadísticas · promocionar ·
   suscripción.
3. **Crear tardeo**:
   - **Subir flyer** → IA extrae datos → **revisar/confirmar** (campos dudosos en amarillo) → publicar.
   - o **Crear flyer con IA** (prompt + adjuntos) → sello por código → publicar.
4. **Promocionar**: elegir **Destacado / Impulso Instagram / Pack**.

### 20.5 Flujo DJ
1. **Alta** → completar **biografía**, estilos, fotos, redes.
2. **Panel del DJ**: perfil · **reputación** (nivel/insignias) · tardeos donde aparece ·
   promocionar perfil.

### 20.6 Flujo ADMIN (mobile-first, por widgets)
- **Widgets ordenados**: métricas del negocio, **borradores de agentes pendientes de OK**,
  **verificaciones**, moderación (flyers/reseñas), crear locales/tardeos, **promociones y
  precios**, **popups**, estado de suscripciones.
- Todo tocable con el pulgar; acciones críticas con confirmación.

### 20.7 Accesibilidad y marca
- Colores de marca (magenta #E10A5A / dorado #F5B301) sobre fondo claro; asegurar
  **contraste suficiente** en textos (usar magenta para acentos/botones, texto en oscuro).
- Tipografía de interfaz **muy legible** 🔶 (Inter / Nunito) — decidir.
- **Bilingüe**: interfaz en **castellano y catalán**.

### 20.8 Decisiones tomadas de este pilar ✅
1. ✅ **Barra de navegación** = Inicio · Tardeos · Mapa · Favoritos · Perfil (5 pestañas).
2. ✅ **PWA instalable** ("añadir a inicio") → sin tiendas de apps.
3. ✅ **Tipografía de interfaz = Nunito** (redonda, cálida, muy legible para mayores).
4. ✅ **Interfaz bilingüe ES/CA** con selector.
5. ✅ **Solo modo claro** en el MVP (como la marca); modo oscuro más adelante.

---

## 21. PILAR 10 — Roadmap 2 meses (BORRADOR para revisar)

Leyenda: 🔶 propuesta · ❓ pendiente · ⛔ bloqueante
> 2 meses = **MVP enfocado**. Priorizamos el **bucle que demuestra el valor**:
> cliente descubre tardeos → local los crea con IA → app llena por migración → se cobra.

### 21.1 Alcance del MVP (lo que SÍ entra)
- **Cliente**: navegar, filtrar, **mapa** (tú + tardeos + cómo llegar), ficha,
  **apuntarse** (gratis) / **redirección Fourvenues** (pago/lista), favoritos, login OTP, popups.
- **Local**: alta asistida, panel, **crear tardeo subiendo flyer → IA lo lee** y rellena, publicar.
- **Creador de flyer con IA** (imagen + sello): ✅ **entra en MVP** — ya existe y funciona en la
  app actual, así que se reutiliza (bajo riesgo). Marc conoce cómo funciona hoy.
- **Migración**: importar locales/tardeos/DJs → app **nace llena** (piloto 1 zona).
- **Monetización**: suscripción (mensual+anual) + **Destacado** (con sello).
- **DJ**: perfil + bio (reputación básica).
- **Admin**: panel de widgets (moderación, verificación, precios, popups, borradores de agentes).
- **Base**: PWA instalable, bilingüe ES/CA, modo claro, RLS + seguridad, textos legales.

### 21.2 Fase 2 (después del MVP)
Posts · Impulso Instagram pagado (Meta Ads) · reputación DJ avanzada ·
**API de Fourvenues** (stats en admin) · multi-sede · modo oscuro · más autonomía de agentes.

### 21.3 Plan semana a semana (8 semanas)
| Sem | Fase | Qué se construye | Hito / entregable |
|---|---|---|---|
| **1** | Fundaciones | Repo Next.js, **SQL del modelo** + RLS (lo aplicas tú), auth OTP, **design system** (Nunito, colores, componentes), subdominio + Cloudflare | App esqueleto con login OTP |
| **2** | Núcleo cliente I | Listado de tardeos + filtros (zona/fecha/tipo/DJ), ficha de tardeo | Ver y filtrar tardeos (con datos de prueba) |
| **3** | Núcleo cliente II | **Mapa** (ubicación + cómo llegar + filtros), apuntarse gratis, **redirección Fourvenues**, favoritos, popups | **Cliente completo**: descubre y se apunta |
| **4** | Núcleo local | Alta asistida por IA, panel del local, **crear tardeo + subir flyer → IA lee** (Claude visión) + **crear flyer con IA** (reutilizar lo de la app actual + sello), publicar | **Local crea tardeos con IA (lee y crea flyers)** |
| **5** | Migración | Script de mapeo/limpieza/geocodificación, import (lo ejecutas tú), **reclamar ficha** | **App llena** + piloto en 1 zona (Maresme) |
| **6** | Monetización | Pasarela (MoR/Stripe): **suscripción** + **Destacado** con sello; Precio Fundador | **Se puede cobrar** |
| **7** | Admin + DJ | Panel admin (widgets, moderación, verificación, precios, popups, borradores de agentes), perfil+reputación DJ | Admin operativo sin tocar código |
| **8** | Pulido + lanzamiento | QA, accesibilidad (mayores), PWA, textos legales, bugfix; **soft-launch** por zona | **MVP en producción (piloto)** |

### 21.4 Dependencias / bloqueantes (del PEDIR_AL_DUENO)
- ⛔ **Cuenta RRPP + ejemplo de enlace Fourvenues** → necesario en **Semana 3**.
- ⛔ **Export de datos** → necesario en **Semana 5** (migración).
- ⛔ **Subdominio + acceso DNS/Cloudflare** → **Semana 1**.
- ⚠️ **Autónomo / pasarela** resuelto antes de **Semana 6** (cobrar).
- ⚠️ **Cuenta Instagram** para promociones (Semana 6-7).
- ⚠️ **Entidad legal** para textos legales (Semana 8).

### 21.5 Realismo y riesgos del plan
- **Equipo = Marc solo** (con ayuda de Claude). Deadline **firme, cuanto antes mejor**.
- ⚠️ Solo + 2 meses + este alcance es **agresivo**. Disciplina de scope: si algo se retrasa,
  se recorta de **Fase 2**, NUNCA del núcleo (descubrir → crear con IA → migrar → cobrar).
- ✅ Ventaja: el **creador de flyer con IA ya existe** en la app actual → se **reutiliza**,
  no se inventa (menos riesgo). Conviene documentar cómo funciona hoy (modelo, flujo, sello).
- ⛔ Todo depende de que los **bloqueantes del dueño** lleguen a tiempo (§21.4).

### 21.6 Decisiones tomadas de este pilar ✅
1. ✅ **Equipo = Marc solo** (con ayuda de Claude).
2. ✅ **Deadline firme** (~2 meses), **cuanto antes mejor**.
3. ✅ **Creador de flyer con IA = ENTRA en el MVP** (ya existe y funciona en la app actual → se reutiliza).
4. 🔶 Pendiente que Marc **documente cómo funciona hoy** el creador de flyer (modelo, flujo, sello)
   para replicarlo/mejorarlo.

---

*Fin del documento vivo. Análisis completo — listo para construir.*
