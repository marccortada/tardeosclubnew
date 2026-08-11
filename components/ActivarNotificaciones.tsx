"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { Bell, BellRing, BellOff, Loader2, Share } from "lucide-react";

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
      <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
        <Share size={22} className="mt-0.5 shrink-0 text-magenta" />
        <p className="text-sm font-semibold text-tinta/80">
          Para recibir avisos de tardeos en tu iPhone, añade TardeosClub a tu pantalla
          de inicio: toca <b>Compartir</b> y luego <b>«Añadir a pantalla de inicio»</b>.
          Al abrirla desde ahí podrás activar las notificaciones.
        </p>
      </div>
    );
  }

  if (estado === "no-soportado") return null;

  if (estado === "denegado") {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
        <BellOff size={22} className="mt-0.5 shrink-0 text-tinta/40" />
        <p className="text-sm font-semibold text-tinta/60">
          Tienes las notificaciones bloqueadas para esta web. Se reactivan desde los
          ajustes del navegador (el candado junto a la dirección).
        </p>
      </div>
    );
  }

  if (estado === "activas") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
        <BellRing size={22} className="shrink-0 text-oro-600" />
        <p className="text-sm font-bold text-tinta/80">Notificaciones activadas en este dispositivo.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-tarjeta ring-1 ring-black/5">
      <button
        onClick={activar}
        disabled={ocupado}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-magenta py-3.5 font-extrabold text-white active:scale-[0.98] disabled:opacity-40"
      >
        {ocupado ? <Loader2 size={20} className="animate-spin" /> : <Bell size={20} />}
        Avísame de los tardeos
      </button>
      <p className="mt-2 text-center text-xs font-semibold text-tinta/50">
        Notificaciones en este dispositivo, como las de cualquier app. Se quitan cuando quieras.
      </p>
      {error && <p className="mt-1 text-center text-xs font-bold text-magenta">{error}</p>}
    </div>
  );
}
