"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Loader2, X, ChevronDown } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { Etiqueta } from "@/components/ui/Chip";
import Hoja from "@/components/ui/Hoja";
import Boton from "@/components/Boton";
import { claseCampo } from "@/components/ui/Campo";
import { useFicha } from "../_panel/PanelLocal";
import {
  BOLSAS, PAQUETES, TIPO_MOV, ESTADO_RESERVA, coinsActivos, getSaldos, getServicios, getReservas, getMovimientos,
  reservar, cancelarReserva, type Saldo, type Servicio, type Reserva, type Movimiento, type Bolsa,
} from "@/lib/coins";

const fecha = (d: string) => new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" });

/**
 * Monedero del local (dossier pág. 13): saldo por bolsa, historial, reservar
 * servicios y paquetes. Con `coins_activos` apagado se ve todo pero no se
 * reserva ni se compra: «Desactivado · próximamente». No hay pasarela.
 */
export default function MonederoCoins() {
  const { ficha } = useFicha();
  const [activos, setActivos] = useState(false);
  const [saldos, setSaldos] = useState<Saldo[] | null>(null);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [falta, setFalta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elegido, setElegido] = useState<Servicio | null>(null);
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    const [a, s, sv, r, m] = await Promise.all([
      coinsActivos(), getSaldos(ficha.id), getServicios(), getReservas(ficha.id, 0, 19), getMovimientos(ficha.id, 0, 29),
    ]);
    setActivos(a);
    setFalta(s.falta || sv.falta);
    setError(s.error ?? sv.error ?? r.error?.message ?? m.error?.message ?? null);
    setSaldos(s.datos);
    setServicios(sv.datos);
    setReservas((r.data as Reserva[]) ?? []);
    setMovs((m.data as Movimiento[]) ?? []);
  }, [ficha.id]);

  useEffect(() => {
    // Carga inicial desde la base.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  const total = (saldos ?? []).reduce((t, s) => t + s.saldo, 0);

  const confirmar = async () => {
    if (!elegido) return;
    setEnviando(true); setMsg(null);
    const { error: e } = await reservar(ficha.id, elegido.slug, null, detalle);
    setEnviando(false);
    if (e) { setMsg({ tono: "error", texto: e.message }); return; }
    setElegido(null); setDetalle("");
    setMsg({ tono: "ok", texto: `Reservado: ${elegido.nombre}. Se han descontado ${elegido.coste} Coins una sola vez.` });
    void cargar();
  };

  const cancelar = async (r: Reserva) => {
    setMsg(null);
    const { error: e } = await cancelarReserva(r.id, "Cancelada por el local antes de empezar");
    if (e) { setMsg({ tono: "error", texto: e.message }); return; }
    setMsg({ tono: "ok", texto: `Cancelada. Te hemos devuelto ${r.coste} Coins a la misma bolsa de la que salieron.` });
    void cargar();
  };

  const misReservas = (
    <section>
      <h2 className="mb-3 text-xl font-bold">Mis reservas</h2>
      {reservas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-5 text-center text-[15px] text-tinta-suave">Aún no has reservado nada.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reservas.map((r) => {
            const e = ESTADO_RESERVA[r.estado] ?? { texto: r.estado, tono: "neutro" as const };
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
                <div className="min-w-0">
                  <p className="font-bold">{servicios.find((s) => s.slug === r.servicio)?.nombre ?? r.servicio} · {r.coste} Coins</p>
                  <p className="text-sm text-tinta-suave">{fecha(r.created_at)}{r.detalle ? ` · ${r.detalle}` : ""}</p>
                  {r.resultado && <p className="text-sm">{r.resultado}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>
                  {r.estado === "pendiente" && (
                    <Boton tamano="pequeno" variante="contorno" onClick={() => cancelar(r)}><X size={16} aria-hidden /> Cancelar</Boton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
  const historial = (
    <section>
      <h2 className="mb-3 text-xl font-bold">Historial</h2>
      {movs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-5 text-center text-[15px] text-tinta-suave">Sin movimientos todavía.</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-linea bg-white shadow-tarjeta">
          {movs.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 border-b border-linea px-4 py-3 last:border-0">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{TIPO_MOV[m.tipo] ?? m.tipo} <span className="font-normal text-tinta-suave">· {BOLSAS[m.bolsa]?.nombre ?? m.bolsa}</span></p>
                <p className="text-sm text-tinta-suave">{fecha(m.created_at)}{m.motivo ? ` · ${m.motivo}` : ""}</p>
              </div>
              <p className={`shrink-0 text-[16px] font-bold ${m.importe > 0 ? "text-ok" : "text-tinta"}`}>{m.importe > 0 ? "+" : ""}{m.importe}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  // Apagado (o sin el lote en la base): un único estado «Próximamente». Antes
  // se veía el monedero entero con nueve servicios, cuatro paquetes y un
  // «Desactivado · próximamente» en cada botón: mucho ruido para algo que
  // aún no se puede usar. Si el admin le ha dado Coins o hay movimientos, se
  // enseñan (son suyos); el catálogo queda plegado.
  if (falta || !activos) {
    return (
      <SeccionPanel titulo="Coins" ancho="estrecho">
        <section className="flex flex-col items-center px-2 py-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-oro/20 text-tinta"><Coins size={26} aria-hidden /></span>
          <h2 className="mt-3 text-xl font-bold">Próximamente</h2>
          <p className="mt-1 max-w-sm text-[16px] text-tinta-suave">Créditos para promocionar tus tardeos: destacados, stories, pop-ups…</p>
          {total > 0 && <p className="mt-4 text-[16px]">Ya tienes <b>{total} Coins</b> guardados.</p>}
        </section>
        {servicios.length > 0 && (
          <details className="group border-t border-linea pt-2">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between text-[16px] font-semibold text-tinta">
              Qué podrás hacer <ChevronDown size={18} className="transition group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="divide-y divide-linea pb-2">
              {servicios.map((x) => (
                <li key={x.slug} className="py-3">
                  <p className="text-[16px] font-semibold">{x.nombre}</p>
                  <p className="text-[15px] text-tinta-suave">{x.alcance}</p>
                </li>
              ))}
            </ul>
          </details>
        )}
        {reservas.length > 0 && <div className="mt-6">{misReservas}</div>}
        {movs.length > 0 && <div className="mt-6">{historial}</div>}
      </SeccionPanel>
    );
  }

  return (
    <SeccionPanel titulo="Coins" descripcion="Créditos para servicios de promoción. 1 Coin = 1 €."
      acciones={activos ? <Etiqueta tono="ok">Activo</Etiqueta> : <Etiqueta>Desactivado · próximamente</Etiqueta>}>
      <div className="flex flex-col gap-6">
        {error && <p role="alert" className="rounded-xl border border-error/20 bg-error-fondo p-3 text-[15px] font-semibold text-error">{error}</p>}
        {msg && <p role="status" className={`rounded-xl p-3 text-[15px] font-semibold ${msg.tono === "ok" ? "bg-ok-fondo text-ok" : "bg-error-fondo text-error"}`}>{msg.texto}</p>}

        <section className="rounded-2xl border border-linea bg-white p-5 shadow-tarjeta">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-tinta-suave"><Coins size={18} className="text-oro" aria-hidden /> Tu saldo</p>
          <p className="mt-1 text-[36px] font-bold leading-none">{saldos ? total : <Loader2 className="animate-spin" size={28} aria-hidden />} <span className="text-lg font-semibold text-tinta-suave">Coins</span></p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {(saldos ?? []).map((s) => (
              <li key={s.bolsa} className="rounded-xl bg-marfil-100 p-3">
                <p className="flex justify-between text-[15px] font-bold"><span>{BOLSAS[s.bolsa as Bolsa]?.nombre ?? s.bolsa}</span><span>{s.saldo}</span></p>
                <p className="text-sm text-tinta-suave">{BOLSAS[s.bolsa as Bolsa]?.nota}{s.caduca ? ` Caduca el ${fecha(s.caduca)}.` : ""}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-1 text-xl font-bold">Reservar un servicio</h2>
          <p className="mb-3 text-[15px] text-tinta-suave">Eliges servicio y para qué evento; se descuenta una vez. Si cancelas antes de que empecemos, te lo devolvemos íntegro. Los Coins no garantizan asistentes ni un hueco concreto.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {servicios.map((s) => (
              <li key={s.slug} className="flex flex-col rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
                <p className="flex items-start justify-between gap-2 text-[16px] font-bold">{s.nombre}
                  <span className="shrink-0 rounded-full bg-oro px-2.5 py-0.5 text-sm">{s.coste == null ? "Presupuesto" : `${s.coste} Coins`}</span></p>
                <p className="mt-1 text-[15px] text-tinta-suave">{s.alcance}{s.solo_comprado ? " Solo con Coins comprados." : ""}</p>
                <div className="mt-auto pt-3">
                  <Boton tamano="pequeno" variante="contorno" ancho disabled={!activos || s.coste == null}
                    onClick={() => { setElegido(s); setDetalle(""); }}>
                    {!activos ? "Desactivado · próximamente" : s.coste == null ? "Escríbenos" : "Reservar"}
                  </Boton>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">Recargar</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PAQUETES.map((n) => (
              <div key={n} className="rounded-2xl border border-linea bg-white p-4 text-center shadow-tarjeta">
                <p className="text-2xl font-bold">{n}</p>
                <p className="text-[15px] text-tinta-suave">Coins · {n} €</p>
                <p className="mt-2"><Etiqueta>Desactivado · próximamente</Etiqueta></p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-tinta-suave">Sin bonus. Los comprados no caducan, no se transfieren y se conservan si te das de baja. Impuestos por confirmar antes de cobrar.</p>
        </section>

        {misReservas}
        {historial}
      </div>

      <Hoja abierta={!!elegido} onCerrar={() => !enviando && setElegido(null)} titulo={elegido ? `Reservar: ${elegido.nombre}` : ""}
        pie={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="contorno" onClick={() => setElegido(null)} disabled={enviando}>Cancelar</Boton>
            <Boton onClick={confirmar} cargando={enviando}>Confirmar · {elegido?.coste} Coins</Boton>
          </div>
        }>
        <p className="text-[15px] text-tinta-suave">{elegido?.alcance}</p>
        <label htmlFor="detalle-coins" className="mt-3 block text-[15px] font-semibold">¿Para qué evento, fecha o material?</label>
        <textarea id="detalle-coins" rows={3} value={detalle} onChange={(e) => setDetalle(e.target.value)} className={`${claseCampo} mt-1`}
          placeholder="Ej.: Tardeo Remember del sábado 24, flyer ya subido" />
        <p className="mt-2 text-sm text-tinta-suave">Una solicitud incompleta no reserva. Se descuenta una sola vez y recibirás el resultado aquí.</p>
      </Hoja>
    </SeccionPanel>
  );
}
