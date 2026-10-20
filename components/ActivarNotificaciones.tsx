"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { Bell, BellRing, BellOff, Loader2, Share } from "lucide-react";
import { claseBoton } from "@/components/Boton";
import { MARCA } from "@/lib/marca";

/**
 * El navegador solo enseña el permiso de notificaciones si lo pide un gesto
 * del usuario, así que esto es un botón y no un popup al entrar. Pedirlo nada
 * más cargar, además de no funcionar, es la forma más rápida de que te lo
 * denieguen para siempre.
 */

// La clave pública VAPID viaja en base64url; el navegador la quiere en bytes.
function claveABytes(b64: string): Uint8Array {
  const relleno = "=".repeat((4 - (b64.length % 4)) % 4);
  const crudo = atob((b64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
}

type Estado = "cargando" | "no-soportado" | "ios-sin-instalar" | "denegado" | "activas" | "inactivas";

export default function ActivarNotificaciones() {
  const { user } = useAuth();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const soportado = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!soportado) {
        // En iPhone el push existe pero SOLO para webs instaladas en la
        // pantalla de inicio (iOS 16.4+). Abierta en Safari, la API ni aparece:
        // en vez de "tu móvil no puede", contamos el paso que falta.
        const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const instalada = window.matchMedia("(display-mode: standalone)").matches;
        setEstado(esIOS && !instalada ? "ios-sin-instalar" : "no-soportado");
        return;
      }
      if (Notification.permission === "denied") { setEstado("denegado"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setEstado(sub ? "activas" : "inactivas");
    })().catch(() => setEstado("no-soportado"));
  }, []);

  const activar = async () => {
    setOcupado(true); setError("");
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "denegado" : "inactivas");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!clave) { setError("Falta configurar las notificaciones en el servidor."); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveABytes(clave) as BufferSource,
      });
      const j = sub.toJSON();

      // Guardamos la suscripción. Si ya existía (endpoint único), el error de
      // duplicado significa "ya estaba": no es un fallo.
      const { error: e } = await supabase.from("push_suscripciones").insert({
        profile_id: user?.id ?? null,
        endpoint: sub.endpoint,
        p256dh: j.keys?.p256dh ?? "",
        auth: j.keys?.auth ?? "",
      });
      if (e && !e.message.includes("duplicate")) { setError(e.message); return; }
      setEstado("activas");
    } catch {
      setError("No se pudieron activar. Prueba de nuevo.");
    } finally {
      setOcupado(false);
    }
  };

  if (estado === "cargando") return null;

  if (estado === "ios-sin-instalar") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-linea bg-white p-4">
        <Share size={22} className="mt-0.5 shrink-0 text-magenta" />
        <p className="text-[15px] text-tinta-suave">
          Para recibir avisos de tardeos en tu iPhone, añade {MARCA.nombre} a tu pantalla
          de inicio: toca <b>Compartir</b> y luego <b>«Añadir a pantalla de inicio»</b>.
          Al abrirla desde ahí podrás activar las notificaciones.
        </p>
      </div>
    );
  }

  if (estado === "no-soportado") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-linea bg-white p-4">
        <BellOff size={22} className="mt-0.5 shrink-0 text-tinta-suave" aria-hidden />
        <p className="text-[15px] text-tinta-suave">
          Este navegador no permite avisos. Prueba desde el móvil con Chrome o, en iPhone, con la app
          añadida a la pantalla de inicio.
        </p>
      </div>
    );
  }

  if (estado === "denegado") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-linea bg-white p-4">
        <BellOff size={22} className="mt-0.5 shrink-0 text-tinta-suave" />
        <p className="text-[15px] text-tinta-suave">
          Tienes las notificaciones bloqueadas para esta web. Se reactivan desde los
          ajustes del navegador (el candado junto a la dirección).
        </p>
      </div>
    );
  }

  if (estado === "activas") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-linea bg-white p-4">
        <BellRing size={22} className="shrink-0 text-ok" aria-hidden />
        <p className="text-[15px] font-semibold text-tinta">Notificaciones activadas en este dispositivo.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-linea bg-white p-4">
      <button
        onClick={activar}
        disabled={ocupado}
        className={claseBoton("primario", "normal", true)}
      >
        {ocupado ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Bell size={20} aria-hidden />}
        Avísame de los tardeos
      </button>
      <p className="mt-2 text-center text-[14px] text-tinta-suave">
        Notificaciones en este dispositivo, como las de cualquier app. Se quitan cuando quieras.
      </p>
      {error && <p role="alert" className="mt-2 text-center text-[15px] font-semibold text-error">{error}</p>}
    </div>
  );
}
