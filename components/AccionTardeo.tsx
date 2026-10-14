"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Tardeo } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { esFavorito, setFavorito, estaInscrito, inscribir, cancelarInscripcion, getPlazasTardeo, type Plazas } from "@/lib/tardeos";
import { Ticket, ListChecks, Check, Heart, ExternalLink, Loader2 } from "lucide-react";
import { medir } from "@/lib/metricas";

export default function AccionTardeo({ tardeo }: { tardeo: Tardeo }) {
  const { user } = useAuth();
  const router = useRouter();
  const [apuntado, setApuntado] = useState(false);
  const [fav, setFav] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [plazas, setPlazas] = useState<Plazas | null>(null);
  // Se enseña cuando la base no ha aceptado el cambio, para que la pantalla no
  // diga «Apuntado» o «Favorito» de algo que no se guardó.
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!user) { setFav(false); setApuntado(false); return; }
    esFavorito(user.id, tardeo.id).then(setFav);
    if (tardeo.tipoEntrada === "gratis") estaInscrito(user.id, tardeo.id).then(setApuntado);
  }, [user, tardeo.id, tardeo.tipoEntrada]);

  // Las plazas las ve todo el mundo, con o sin sesión.
  useEffect(() => {
    if (tardeo.tipoEntrada === "gratis") getPlazasTardeo(tardeo.id).then(setPlazas);
  }, [tardeo.id, tardeo.tipoEntrada]);

  const pedirLogin = () => router.push("/perfil");

  const toggleFav = async () => {
    if (!user) return pedirLogin();
    const nuevo = !fav;
    setAviso("");
    setFav(nuevo);
    const { error } = await setFavorito(user.id, tardeo.id, nuevo);
    if (error) {
      setFav(!nuevo);
      setAviso(nuevo ? "No se pudo guardar en tus favoritos. Inténtalo otra vez." : "No se pudo quitar de tus favoritos. Inténtalo otra vez.");
      return;
    }
    // Solo al guardar, no al quitar: lo que interesa medir es el interés.
    if (nuevo) medir("favorito", { tardeoId: tardeo.id });
  };

  const toggleApuntar = async () => {
    if (!user) return pedirLogin();
    setOcupado(true);
    setAviso("");
    if (apuntado) {
      const { error } = await cancelarInscripcion(user.id, tardeo.id);
      if (error) setAviso("No se pudo cancelar tu plaza. Inténtalo otra vez.");
      else { setApuntado(false); getPlazasTardeo(tardeo.id).then(setPlazas); }
    } else {
      const { error } = await inscribir(user.id, tardeo.id);
      if (error?.message === "AFORO_COMPLETO") {
        setAviso("Se han acabado las plazas de este tardeo.");
        getPlazasTardeo(tardeo.id).then(setPlazas);
      } else if (error) setAviso("No te hemos podido apuntar. Inténtalo otra vez.");
      else {
        setApuntado(true);
        getPlazasTardeo(tardeo.id).then(setPlazas);
        medir("inscripcion", { tardeoId: tardeo.id });
      }
    }
    setOcupado(false);
  };

  /**
   * Al sitio donde se compra. Esto ERA UN `alert` que decía "(demo)": el botón
   * principal de todo tardeo de pago no llevaba a ninguna parte, teniendo el
   * enlace guardado en la base.
   *
   * Se apunta el clic ANTES de abrir. Al revés se perdería la mitad: en el
   * móvil, cuando el navegador cambia de página, lo que quede a medias se
   * cancela. Y no se espera a que termine de guardarse, que sería hacer esperar
   * a alguien que quiere comprar.
   */
  const irAEntradas = () => {
    if (!tardeo.urlEntradas) return;
    medir(tardeo.tipoEntrada === "lista" ? "clic_lista" : "clic_entrada",
      { tardeoId: tardeo.id, destino: tardeo.urlEntradas });
    window.open(tardeo.urlEntradas, "_blank", "noopener,noreferrer");
  };

  const completo = plazas?.libres === 0;
  const textoEntrada = tardeo.tipoEntrada === "lista"
    ? "Apuntarse a la lista"
    : `Comprar entradas${tardeo.precio ? ` · ${tardeo.precio} €` : ""}`;

  /*
   * En el móvil es una barra fija encima de la de navegación: la acción
   * principal siempre al alcance del pulgar. En escritorio deja de ser fija y
   * se queda en la columna de datos, debajo del título: ahí es donde se mira.
   */
  return (
    // 65 px es la barra de navegación inferior; más la zona segura del iPhone,
    // que si no la tapaba a medias.
    <div className="fixed bottom-[calc(65px+env(safe-area-inset-bottom))] left-0 right-0 z-[900] border-t border-linea bg-white/95 shadow-[0_-6px_20px_-8px_rgba(0,0,0,0.15)] backdrop-blur md:static md:z-auto md:mt-4 md:border-0 md:bg-transparent md:shadow-none md:backdrop-blur-0">
      {aviso && (
        <p role="alert" className="mx-auto max-w-md bg-error-fondo px-4 py-2 text-center text-[15px] font-semibold text-error md:mb-3 md:max-w-none md:rounded-xl md:text-left">
          {aviso}
        </p>
      )}
      {tardeo.tipoEntrada === "gratis" && plazas?.aforo != null && (
        <p className="mx-auto max-w-md px-4 pt-2 text-center text-[15px] font-bold text-tinta md:max-w-none md:px-0 md:pb-2 md:pt-0 md:text-left">
          {plazas.libres === 0 ? "Plazas agotadas" : `Quedan ${plazas.libres} de ${plazas.aforo} plazas`}
        </p>
      )}
      <div className="mx-auto flex max-w-md items-center gap-3 p-3 md:max-w-none md:p-0">
        <button
          onClick={toggleFav}
          aria-label={fav ? "Quitar de mis planes" : "Guardar en mis planes"}
          aria-pressed={fav}
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl border transition ${
            fav ? "border-magenta bg-magenta text-white" : "border-linea-fuerte bg-white text-magenta hover:bg-marfil"
          }`}
        >
          <Heart size={26} fill={fav ? "currentColor" : "none"} aria-hidden />
        </button>

        {tardeo.tipoEntrada === "gratis" ? (
          <button
            onClick={toggleApuntar}
            disabled={ocupado || (completo && !apuntado)}
            className={`flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-[17px] font-bold transition active:scale-[0.98] disabled:opacity-60 ${
              apuntado ? "bg-ok text-white" : completo ? "bg-marfil-200 text-tinta" : "bg-oro text-tinta shadow-plastilina-oro hover:bg-oro-400"
            }`}
          >
            {ocupado ? <Loader2 size={22} className="animate-spin" aria-hidden /> : apuntado ? (<><Check size={22} aria-hidden /> Apuntado · toca para cancelar</>) : completo ? "Completo" : "Apuntarme gratis"}
          </button>
        ) : tardeo.urlEntradas ? (
          <button
            onClick={irAEntradas}
            className="flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-xl bg-oro px-4 py-3 text-[17px] font-bold text-tinta shadow-plastilina-oro transition hover:bg-oro-400 active:scale-[0.98]"
          >
            {tardeo.tipoEntrada === "lista" ? <ListChecks size={22} aria-hidden /> : <Ticket size={22} aria-hidden />}
            {textoEntrada}
            <ExternalLink size={16} className="shrink-0 opacity-70" aria-hidden />
          </button>
        ) : (
          /* Sin enlace de venta no hay botón, y es a propósito: un botón que
             promete "Comprar entrada" y no hace nada es peor que no tenerlo, y
             ensucia la medición con clics que no llevan a ninguna venta. */
          <div className="flex min-h-[56px] flex-1 flex-col items-center justify-center rounded-xl bg-marfil-100 px-5 py-2 text-center">
            <span className="text-[17px] font-bold text-tinta">
              {tardeo.tipoEntrada === "lista" ? "Con lista" : tardeo.precio ? `Entrada ${tardeo.precio} €` : "Con entrada"}
            </span>
            <span className="text-[13px] font-medium text-tinta-suave">Consulta en el local</span>
          </div>
        )}
      </div>
      {/* Gratis pero con web propia (reservas, lista de la discoteca…): se
          ofrece también, en segundo plano, sin quitar el "Apuntarme". */}
      {tardeo.tipoEntrada === "gratis" && tardeo.urlEntradas && (
        <div className="mx-auto max-w-md px-3 pb-3 md:max-w-none md:px-0 md:pb-0 md:pt-3">
          <button onClick={irAEntradas} className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-linea-fuerte bg-white px-4 text-[15px] font-bold text-tinta hover:bg-marfil">
            <Ticket size={18} aria-hidden /> Reservar en la web del evento <ExternalLink size={14} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
