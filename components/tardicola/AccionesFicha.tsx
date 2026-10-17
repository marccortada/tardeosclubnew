"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Heart, Loader2 } from "lucide-react";
import type { Tardeo } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { esFavorito, setFavorito } from "@/lib/tardeos";
import { asistire, getMiAsistencia, type MiAsistencia } from "@/lib/tardicola";
import { medir } from "@/lib/metricas";
import AccionTardeo from "@/components/AccionTardeo";

/**
 * Misma clave y formato que usa AccionTardeo para recordar qué quería hacer
 * quien pulsó sin sesión. Tiene que coincidir: tras entrar se vuelve a la
 * ficha y es AccionTardeo quien la lee y hace la acción una sola vez.
 */
const CLAVE_INTENCION = "tc_intencion_tardeo";
const VIDA_INTENCION_MS = 15 * 60 * 1000;

/**
 * Acciones de la ficha: el bloque completo (AccionTardeo, sin tocar) en su
 * sitio y, en móvil, una barra fija con Asistiré / Guardar encima de la barra
 * inferior.
 *
 * Por qué: en un móvil de 844 px «Asistiré» quedaba a ~985 px, bajo el
 * pliegue; la acción principal de la app no se veía sin hacer scroll.
 *
 * Las dos piezas tienen su propio estado. Para que no se contradigan:
 * - Al hacer algo en la barra, AccionTardeo se vuelve a montar (key) y relee
 *   de la base, así enseña «Confirmado», Meet Zone, etc.
 * - La barra se esconde mientras el bloque completo está en pantalla y, al
 *   volver a aparecer, relee su estado (por si se pulsó allí abajo).
 */
export default function AccionesFicha({ tardeo, activo }: { tardeo: Tardeo; activo: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const bloqueRef = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);
  const [bloqueVisible, setBloqueVisible] = useState(false);
  const [mia, setMia] = useState<MiAsistencia>({ estado: null, puesto: null });
  const [fav, setFav] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");

  const releer = useCallback(() => {
    // Siempre por promesa (también sin sesión): el estado se pone al llegar la
    // respuesta, no en mitad del efecto.
    const lectura = user
      ? Promise.all([esFavorito(user.id, tardeo.id), getMiAsistencia(user.id, tardeo.id)])
      : Promise.resolve([false, { estado: null, puesto: null }] as [boolean, MiAsistencia]);
    lectura.then(([f, m]) => { setFav(f); setMia(m); });
  }, [user, tardeo.id]);

  // Al entrar, y cada vez que el bloque completo sale de pantalla (allí se ha
  // podido pulsar Asistiré, Guardar o retirarse).
  useEffect(() => { if (!bloqueVisible) releer(); }, [bloqueVisible, releer]);

  useEffect(() => {
    const el = bloqueRef.current;
    if (!el || !activo) return;
    const io = new IntersectionObserver(([e]) => setBloqueVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [activo]);

  const pedirLogin = (accion: "asistire" | "guardar") => {
    try {
      sessionStorage.setItem(CLAVE_INTENCION, JSON.stringify({ id: tardeo.id, accion, hasta: Date.now() + VIDA_INTENCION_MS }));
    } catch { /* sin almacenamiento: tendrá que pulsar otra vez al volver */ }
    router.push(`/perfil?volver=${encodeURIComponent(`/tardeos/${tardeo.id}`)}`);
  };

  const confirmado = mia.estado === "apuntado";
  const enEspera = mia.estado === "espera";

  const pulsarAsistire = async () => {
    if (!user) return pedirLogin("asistire");
    // Ya apuntado: lo que queda (retirarse, Meet Zone) está en el bloque de abajo.
    if (confirmado || enEspera) { bloqueRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    setOcupado(true); setAviso("");
    const { r, error } = await asistire(user.id, tardeo.id);
    setOcupado(false);
    if (error || !r) { setAviso("No se pudo guardar tu Asistiré. Inténtalo otra vez."); return; }
    setMia(r);
    medir("inscripcion", { tardeoId: tardeo.id, detalle: r.estado ?? undefined });
    setVersion((v) => v + 1);
  };

  const pulsarGuardar = async () => {
    if (!user) return pedirLogin("guardar");
    const n = !fav;
    setFav(n); setAviso("");
    const { error } = await setFavorito(user.id, tardeo.id, n);
    if (error) { setFav(!n); setAviso("No se pudo guardar. Inténtalo otra vez."); return; }
    if (n) medir("favorito", { tardeoId: tardeo.id });
    setVersion((v) => v + 1);
  };

  return (
    <>
      <div ref={bloqueRef}>
        <AccionTardeo key={version} tardeo={tardeo} activo={activo} />
      </div>

      {activo && (
        <div
          aria-label="Acciones del tardeo"
          role="region"
          // Encima de la barra inferior: su altura real la publica BottomNav en
          // --alto-barra-inferior (ya incluye la zona segura del iPhone).
          style={{ bottom: "var(--alto-barra-inferior, calc(68px + env(safe-area-inset-bottom)))" }}
          className={`fixed inset-x-0 z-[999] border-t border-linea bg-superficie/95 px-4 py-2 backdrop-blur transition-transform duration-200 md:hidden ${
            bloqueVisible ? "pointer-events-none translate-y-[150%]" : ""}`}
          aria-hidden={bloqueVisible || undefined}
        >
          {aviso && <p role="alert" className="mb-1.5 text-[15px] font-semibold text-error">{aviso}</p>}
          <div className="mx-auto grid max-w-md grid-cols-[1.4fr_1fr] gap-2">
            <button type="button" onClick={pulsarAsistire} disabled={ocupado} aria-pressed={confirmado || enEspera}
              tabIndex={bloqueVisible ? -1 : undefined}
              className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-3 text-[16px] font-bold transition active:scale-[0.98] disabled:opacity-70 ${
                enEspera ? "border border-aviso/40 bg-aviso-fondo text-aviso" : "bg-magenta text-white"}`}>
              {ocupado ? <Loader2 size={20} className="animate-spin" aria-hidden />
                : confirmado ? <><Check size={19} aria-hidden /> Confirmado</>
                : enEspera ? <><Clock size={18} aria-hidden /> En espera{mia.puesto ? ` (${mia.puesto})` : ""}</>
                : "Asistiré"}
            </button>
            <button type="button" onClick={pulsarGuardar} aria-pressed={fav}
              tabIndex={bloqueVisible ? -1 : undefined}
              className={`flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border text-[16px] font-bold transition ${
                fav ? "border-magenta bg-magenta-50 text-magenta-700" : "border-linea-fuerte bg-superficie text-tinta"}`}>
              <Heart size={18} fill={fav ? "currentColor" : "none"} aria-hidden /> {fav ? "Guardado" : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
