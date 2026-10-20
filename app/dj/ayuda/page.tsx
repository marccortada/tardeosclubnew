"use client";

import { ChevronDown, Mail, MessageCircle } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { claseBoton } from "@/components/Boton";
import ServiciosExternos, { whatsappTardeos, emailTardeos } from "@/components/ServiciosExternos";
import { useDj } from "../contexto";
import { MARCA } from "@/lib/marca";

/**
 * Preguntas que hace cualquier DJ al entrar (y que antes acababan en un
 * WhatsApp sin contexto). Las respuestas describen lo que la app hace HOY;
 * si algo cambia, hay que cambiarlo aquí también.
 */
const PREGUNTAS: { p: string; r: string }[] = [
  {
    p: "¿Cómo aparezco en un tardeo?",
    r: "Te añade el local o el promotor al crear o editar el tardeo. También pueden enviarte una invitación: la verás en «Mis tardeos», pestaña Invitaciones, y al aceptarla sales en el cartel.",
  },
  {
    p: "Salgo en un tardeo en el que no pincho",
    r: "Entra en «Mis tardeos», busca ese tardeo y pulsa «No pincho aquí». Si no te deja quitarte, escríbenos y lo corregimos.",
  },
  {
    p: "¿Por qué mi ficha está oculta?",
    r: "Las fichas se ocultan cuando están duplicadas, incompletas o cuando el equipo está revisando algo. Escríbenos y te decimos qué pasa con la tuya.",
  },
  {
    p: "¿Cómo consigo el sello de verificado?",
    r: `Lo pone el equipo de ${MARCA.nombre} cuando comprueba que el perfil es tuyo. Si aún no lo tienes, escríbenos y lo revisamos.`,
  },
  {
    p: "¿De dónde salen las reseñas?",
    r: "Las escribe la gente desde tu ficha pública. Antes de publicarse las revisa el equipo. Si ves una falsa o con insultos, avísanos.",
  },
  {
    p: "¿Qué es el PressKit?",
    r: "Un PDF con tu biografía, fotos y contacto para los locales que te quieren contratar. Súbelo en la sección PressKit: aparece como descarga en tu ficha.",
  },
  {
    p: "¿Mi WhatsApp es público?",
    r: "Sí, si lo pones en «Mi perfil» sale en tu ficha con un botón para contratarte. Si no quieres que te escriban, déjalo vacío y usa Instagram.",
  },
];

export default function AyudaDj() {
  const { dj, modoAdmin } = useDj();
  const texto = `Hola, soy ${dj.nombre_artistico} (DJ en ${MARCA.nombre}). Tengo una duda: `;

  return (
    <SeccionPanel titulo="Ayuda" descripcion={`Respuestas rápidas y cómo hablar con el equipo de ${MARCA.nombre}.`} ancho="estrecho">
      <section className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-5">
        <h2 className="text-lg font-bold">Habla con nosotros</h2>
        <p className="mt-1 text-[15px] text-tinta-suave">Te contesta una persona del equipo. Cuéntanos qué pasa y el nombre de tu ficha.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a href={whatsappTardeos(texto)} target="_blank" rel="noopener noreferrer" className={claseBoton("primario", "normal", true)}>
            <MessageCircle size={20} aria-hidden /> WhatsApp
          </a>
          <a href={emailTardeos(`Duda de DJ en ${MARCA.nombre}`, texto)} className={claseBoton("contorno", "normal", true)}>
            <Mail size={20} aria-hidden /> Correo
          </a>
        </div>
      </section>

      <section className="mt-4">
        <h2 className="mb-2 text-lg font-bold">Preguntas frecuentes</h2>
        <div className="flex flex-col gap-2">
          {PREGUNTAS.map((q) => (
            <details key={q.p} className="group rounded-2xl border border-linea bg-white shadow-tarjeta">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 text-[16px] font-semibold">
                {q.p}
                <ChevronDown size={20} className="shrink-0 text-tinta-suave transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="px-4 pb-4 text-[15px] text-tinta">{q.r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Servicios de pago de terceros: antes ocupaban medio Inicio; aquí,
          como en la ayuda del local, los encuentra quien los busca. */}
      {!modoAdmin && <ServiciosExternos tipo="dj" />}
    </SeccionPanel>
  );
}
