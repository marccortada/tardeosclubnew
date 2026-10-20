"use client";

import { useCallback, useEffect, useState } from "react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { supabase } from "@/lib/supabase";
import { Send, Tag, Users, Search } from "lucide-react";
import { plegar, contieneTexto } from "@/lib/texto";
import Boton from "@/components/Boton";
import Campo, { claseCampo } from "@/components/ui/Campo";
import Chip from "@/components/ui/Chip";
import Hoja from "@/components/ui/Hoja";
import Tarjeta from "@/components/ui/Tarjeta";
import Aviso from "@/components/admin/Aviso";
import { MARCA } from "@/lib/marca";

type Promo = { id: string; nombre: string; tipo: string; precio: number | null };
type Local = { id: string; nombre: string; registrado: boolean };
type Cuentas = { locales: number; registrados: number; conPermiso: number; sinPermiso: number };

export default function AdminOfertas() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "error">("idle");
  const [resultado, setResultado] = useState("");
  const [locales, setLocales] = useState<Local[]>([]);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [cuentas, setCuentas] = useState<Cuentas | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    supabase.from("locales").select("id,nombre,owner_id").eq("estado", "activo").order("nombre")
      .then(({ data }) => setLocales((data ?? []).map((l) => ({
        id: l.id, nombre: l.nombre, registrado: Boolean(l.owner_id),
      }))));
  }, []);

  /**
   * A cuántos va a llegar de verdad, antes de darle.
   *
   * Se pregunta al servidor y no se calcula aquí porque el permiso vive en
   * `profiles`, y quién ha aceptado qué no es asunto del navegador de nadie:
   * lo cuenta quien puede leerlo y devuelve un número.
   */
  const contar = useCallback(async (ids: string[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/enviar-oferta", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soloContar: true, localIds: ids, accessToken: session?.access_token }),
    });
    setCuentas(res.ok ? await res.json() : null);
  }, []);
  useEffect(() => { contar([...elegidos]); }, [contar, elegidos]);

  useEffect(() => {
    supabase.from("promociones_catalogo").select("id,nombre,tipo,precio").eq("activo", true).order("created_at")
      .then(({ data }) => setPromos((data as Promo[]) ?? []));
  }, []);

  const usarPromo = (p: Promo) => {
    setTitulo(`Oferta en ${p.nombre}`);
    setMensaje(
      `¡Aprovecha! ${p.nombre}${p.precio != null ? ` (normalmente ${p.precio} €)` : ""} con condiciones especiales esta semana. ` +
      `Entra en tu panel de ${MARCA.nombre} y promociona tus tardeos.`
    );
  };

  const enviar = async () => {
    if (!titulo.trim()) return;
    setConfirmando(false);
    setEstado("enviando"); setResultado("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/enviar-oferta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `localIds` iba SOLO en el contador y se olvidaba aquí: con tres locales
        // marcados el botón decía "Enviar a 3" y el correo salía a todos los que
        // habían aceptado. Sin selección se manda vacío (= todos), como dice el aviso.
        body: JSON.stringify({ titulo, mensaje, localIds: [...elegidos], accessToken: session?.access_token }),
      });
      const j = await res.json().catch(() => ({}));
      const enviados = Number(j.enviados) || 0;
      const fallidos = Number(j.fallidos) || 0;
      const salieron = enviados > 0 ? ` Sí salieron ${enviados}.` : "";
      if (!res.ok) {
        setEstado("error");
        setResultado(`${j.error || "No se pudo enviar."}${fallidos > 0 ? ` ${fallidos} no se pudieron enviar.` : ""}${salieron}`);
        return;
      }
      // Un envío con fallos o sin ningún correo enviado no es un éxito, aunque
      // la API responda 200: el admin tiene que saber que hay que repetirlo.
      if (fallidos > 0) {
        setEstado("error");
        setResultado(`${fallidos} no se pudieron enviar.${salieron}`);
        return;
      }
      if (enviados === 0) {
        setEstado("error");
        setResultado(j.aviso || "No se envió ningún correo.");
        return;
      }
      setEstado("ok");
      setResultado(`Enviado a ${enviados}.`);
    } catch {
      // Sin red o el servidor caído: que no se quede el botón girando.
      setEstado("error"); setResultado("No se pudo conectar. Revisa la conexión y vuelve a intentarlo.");
    }
  };

  const puedeEnviar = Boolean(titulo.trim()) && cuentas?.conPermiso !== 0;

  return (
    <SeccionPanel
      titulo="Ofertas a locales"
      descripcion="Redacta una oferta y mándala por email a los locales que hayan aceptado recibirlas."
      ancho="estrecho"
    >
      <div>

        {promos.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-[15px] font-semibold">Partir de un extra del catálogo</p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {promos.map((p) => (
                <Chip key={p.id} onClick={() => usarPromo(p)} icono={<Tag size={16} className="text-magenta" aria-hidden />}>
                  {p.nombre}{p.precio != null ? ` · ${p.precio}€` : ""}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <Tarjeta className="flex flex-col gap-4">
          <Campo etiqueta="Título de la oferta" htmlFor="of-titulo">
            <input id="of-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder="Destacado a mitad de precio esta semana" className={claseCampo} />
          </Campo>
          <Campo etiqueta="Mensaje" htmlFor="of-mensaje">
            <textarea id="of-mensaje" value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={4}
              placeholder="Cuéntales la oferta…" className={claseCampo} />
          </Campo>

          <div className="border-t border-linea pt-4">
            <p className="text-lg font-bold">¿A quién?</p>
            <p className="mb-2 text-[15px] text-tinta-suave">
              Sin marcar ninguno, va a todos los que hayan aceptado recibir ofertas.
            </p>
            <label className="mb-2 flex min-h-tacto items-center gap-2 rounded-xl border border-linea-fuerte bg-white px-3 focus-within:border-magenta focus-within:ring-4 focus-within:ring-magenta/15">
              <Search size={18} className="shrink-0 text-tinta-suave" aria-hidden />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar local"
                placeholder={`Buscar entre ${locales.length} locales…`}
                className="w-full bg-transparent text-base font-medium outline-none" />
            </label>
            <div className="flex max-h-72 flex-col overflow-y-auto">
              {locales
                .filter((l) => contieneTexto(l.nombre, plegar(busca.trim())))
                .slice(0, 60)
                .map((l) => (
                  <label key={l.id} className="flex min-h-tacto items-center gap-3 rounded-xl px-2 text-base font-medium hover:bg-marfil-100">
                    <input type="checkbox" checked={elegidos.has(l.id)}
                      onChange={() => setElegidos((p) => {
                        const n = new Set(p);
                        if (n.has(l.id)) n.delete(l.id); else n.add(l.id);
                        return n;
                      })}
                      className="h-6 w-6 shrink-0 accent-magenta" />
                    <span className="min-w-0 flex-1 truncate">{l.nombre}</span>
                    {/* Se marca quién NO puede recibirlo, para no elegirlo a ciegas. */}
                    {!l.registrado && <span className="shrink-0 text-sm font-semibold text-tinta-suave">sin cuenta</span>}
                  </label>
                ))}
            </div>
            {elegidos.size > 0 && (
              <button onClick={() => setElegidos(new Set())} className="mt-2 min-h-tacto text-base font-semibold text-magenta-700 underline">
                Quitar la selección ({elegidos.size})
              </button>
            )}
          </div>

          {/* Lo que va a pasar de verdad, con los que se quedan fuera y por qué:
              un "enviado a 4" sin decir que 55 no lo reciben engaña. */}
          {cuentas && (
            <div className={`rounded-xl p-3 text-base ${cuentas.conPermiso === 0 ? "bg-aviso-fondo text-aviso" : "bg-magenta-50 text-magenta-700"}`}>
              <p className="flex items-center gap-1.5 font-bold">
                <Users size={18} className="shrink-0" aria-hidden />
                {cuentas.conPermiso === 0 ? "Ahora mismo no lo recibiría nadie" : `Lo recibirán ${cuentas.conPermiso}`}
              </p>
              <p className="mt-1 text-[15px]">
                De {cuentas.locales} locales: {cuentas.registrados} tienen cuenta
                {cuentas.sinPermiso > 0 && `, y ${cuentas.sinPermiso} de esos no han aceptado recibir ofertas`}
                {cuentas.locales - cuentas.registrados > 0 && `. Los ${cuentas.locales - cuentas.registrados} sin cuenta no reciben nada`}.
              </p>
            </div>
          )}

          {estado === "error" && <Aviso tono="error">{resultado}</Aviso>}
          {estado === "ok" && <Aviso tono="ok">{resultado}</Aviso>}

          <Boton ancho cargando={estado === "enviando"} disabled={!puedeEnviar} onClick={() => setConfirmando(true)}>
            <Send size={20} aria-hidden /> {cuentas ? `Enviar a ${cuentas.conPermiso}` : "Enviar por email"}
          </Boton>
        </Tarjeta>

        <p className="mt-4 text-sm text-tinta-suave">
          Solo lo reciben quienes tienen cuenta <strong>y han aceptado</strong> recibir ofertas, en su
          perfil o al registrarse. Los locales que solo tienen email en su ficha no reciben nada:
          ese correo vino de la app antigua y no trae ningún permiso detrás.
          En pruebas, Resend solo entrega a tu propio email hasta verificar el dominio.
        </p>
      </div>

      <Hoja abierta={confirmando} onCerrar={() => setConfirmando(false)} titulo="¿Enviar esta oferta?"
        pie={
          <div className="grid gap-2">
            <Boton ancho onClick={enviar}><Send size={20} aria-hidden /> Sí, enviar a {cuentas?.conPermiso ?? "todos"}</Boton>
            <Boton ancho variante="contorno" onClick={() => setConfirmando(false)}>Todavía no</Boton>
          </div>
        }>
        <p className="text-base">
          Se enviará un email a <strong>{cuentas?.conPermiso ?? "todos los que aceptaron"}</strong>
          {elegidos.size > 0 ? ` (de los ${elegidos.size} locales que has marcado)` : " (todos los que aceptaron ofertas)"}. No se puede deshacer.
        </p>
        <div className="mt-3 rounded-2xl border border-linea bg-marfil p-4">
          <p className="text-lg font-bold">{titulo}</p>
          {mensaje && <p className="mt-2 whitespace-pre-line text-base text-tinta-suave">{mensaje}</p>}
        </div>
      </Hoja>
    </SeccionPanel>
  );
}
