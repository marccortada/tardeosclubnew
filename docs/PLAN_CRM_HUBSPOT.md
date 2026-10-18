# Plan CRM: dejar HubSpot (propuesta, SIN EMPEZAR)

Estado: **esperando el OK del cliente** (18‑oct‑2026). No hay nada construido de esto.
Respuesta enviada al cliente: doc «Flujo del cliente y HubSpot: respuesta»
(https://claude.ai/artifact/TM1Xr6rsVgo9pkUSo5RkFT), que responde su PDF
«Consulta Gnerai · Flujo CRM y HubSpot» punto por punto.

## Criterio

- **En la webapp**, todo lo que va pegado a los datos del producto (cliente, ficha, tardeos,
  plan): ya viven aquí, duplicarlos en HubSpot crea errores.
- **Fuera (HubSpot gratis o Brevo)**, el email marketing masivo (newsletters, campañas,
  secuencias): entregabilidad, plantillas y bajas los hacen mejor y más barato.
- **Sincronización en un solo sentido**: la webapp exporta contactos con consentimiento
  (zona, gustos, rol) a la herramienta de marketing; nunca al revés.

## Fases (cada una: lote SQL nuevo probado en local, sesión propia, publicada antes de la siguiente)

1. **Ficha 360 + seguimiento** (lo que más sustituye a HubSpot)
   - Responsable comercial por local y por DJ.
   - Historial de contactos por cliente (llamada / correo / WhatsApp, fecha, quién, resumen),
     botón «Anotar contacto» de un toque.
   - Próxima acción con responsable y aviso al vencer (en la Cola y en el Inicio del admin).
   - Indicadores de arranque: ficha completa, primer tardeo publicado, última entrada.
   - Incidencias del cliente visibles en su ficha.
2. **Correos automáticos con registro**
   - Bienvenida al aprobar la ficha (con guía de primeros pasos), «ya estás publicado»,
     avisos de renovación y de pago pendiente (cron).
   - Tabla de envíos por cliente: enviado / entregado / rebotado (webhook de Resend), reenviar.
   - Enlace de baja en los comerciales y lista de bajas respetada en todos los envíos.
   - Requiere: dominio de envío verificado en Resend (registros DNS, ~10 min).
3. **CRM de DJs**: el mismo seguimiento + acuerdos y comisiones con locales y su cobro.
4. **PayPal** (cuando lo decida el cliente): webhook → historial de pagos, renovación
   automática, paso solo a «pago pendiente» / «oculta por impago». Hasta entonces, cobros
   apagados («Próximamente»), sin tocar `lib/planes.ts`, `cuotas.ts`, `estados.ts`, `ajustes.ts`.

Tras la fase 2, HubSpot solo haría falta para campañas.

## Límites a explicar

- WhatsApp no se registra solo (haría falta WhatsApp Business API, de pago): se anota a mano.
- Sin dominio verificado, los correos automáticos pueden acabar en spam.

## Lo que ya existe (punto de partida)

`seguimiento_comercial` (una fila por local: estado, canal, notas, próximo seguimiento),
`/admin/crm` con filtros, `incidencias`, `auditoria`, `asignaciones` de la Cola,
`profiles.acepta_ofertas`, `app/api/enviar-oferta` (Resend), planes en `locales`/`djs`.
