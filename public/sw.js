/**
 * Service worker de TardeosClub.
 *
 * Recibe las notificaciones push y las enseña aunque la web esté cerrada, que
 * es lo que las hace parecer de app y no de página web. También es lo que
 * permite instalar la PWA en la pantalla de inicio — y en iPhone eso no es
 * opcional: Safari solo entrega push a webs instaladas (iOS 16.4+).
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  // Si el payload no es JSON válido no reventamos: enseñamos algo genérico.
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { titulo: "TardeosClub", mensaje: event.data ? event.data.text() : "" };
  }

  const titulo = datos.titulo || "TardeosClub";
  const opciones = {
    body: datos.mensaje || "",
    // Recortes pequeños a propósito: el móvil se los baja con CADA
    // notificación. El emblema original son 19 MB para pintar un badge que
    // Android enseña como una silueta de 24 píxeles en la barra de estado.
    icon: "/branding/icon-192.png",
    badge: "/branding/badge-96.png",
    // La URL que se abre al tocarla viaja dentro de la notificación.
    data: { url: datos.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  // Si ya hay una pestaña de la app abierta, la reutilizamos y navegamos en
  // ella; si no, se abre una nueva. Es lo que hace WhatsApp Web.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((pestanas) => {
      for (const p of pestanas) {
        if (new URL(p.url).origin === self.location.origin && "focus" in p) {
          p.navigate(url);
          return p.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
