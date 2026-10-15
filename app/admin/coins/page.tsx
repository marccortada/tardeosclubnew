"use client";

import { useCallback, useEffect, useState } from "react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import { Etiqueta } from "@/components/ui/Chip";
import Boton from "@/components/Boton";
import Campo, { claseCampo } from "@/components/ui/Campo";
import { useDiferido } from "@/components/panel/Paginacion";
import { supabase } from "@/lib/supabase";
import { faltaLote68 } from "@/lib/tardeos";
import {
  BOLSAS, ESTADO_RESERVA, coinsActivos, getSaldos, apunteAdmin, cancelarReserva, estadoReservaAdmin,
  type Saldo, type Reserva, type Bolsa,
} from "@/lib/coins";

const TIPOS = [
  { k: "compra", t: "Recarga (paquete pagado)", bolsa: "comprado" },
  { k: "promocional_mensual", t: "Promocionales del ciclo (tope 20)", bolsa: "promocional" },
  { k: "bono_fundador", t: "Bono Fundador (10, una vez)", bolsa: "fundador" },
  { k: "protegido", t: "Saldo protegido", bolsa: "protegido" },
  { k: "ajuste", t: "Ajuste manual ±", bolsa: "comprado" },
] as const;

/**
 * Coins desde el equipo (dossier pág. 13 y 15): apuntes manuales con motivo
 * (sin pasarela: una recarga se apunta con la referencia del pago y no se
 * puede repetir), reservas pendientes y devoluciones. Cada acción deja rastro
 * en `auditoria` desde la propia función de la base (private.auditar).
 */
export default function AdminCoins() {
  const [activos, setActivos] = useState<boolean | null>(null);
  const [busca, setBusca] = useState("");
  const buscado = useDiferido(busca, 250);
  const [locales, setLocales] = useState<{ id: string; nombre: string; plan: string }[]>([]);
  const [local, setLocal] = useState<{ id: string; nombre: string; plan: string } | null>(null);
  const [saldos, setSaldos] = useState<Saldo[]>([]);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]["k"]>("compra");
  const [bolsa, setBolsa] = useState<Bolsa>("comprado");
  const [importe, setImporte] = useState("10");
  const [motivo, setMotivo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const [cola, setCola] = useState<(Reserva & { locales?: { nombre: string } | null })[]>([]);
  const [falta, setFalta] = useState(false);
  const [notas, setNotas] = useState<Record<string, string>>({});

  const cargarCola = useCallback(async () => {
    const { data, error } = await supabase.from("coins_reservas").select("*, locales(nombre)")
      .in("estado", ["pendiente", "confirmada", "en_curso"]).order("created_at").order("id").limit(100);
    if (error) { setFalta(faltaLote68(error)); if (!faltaLote68(error)) setMsg({ tono: "error", texto: error.message }); return; }
    setCola((data ?? []) as typeof cola);
  }, []);

  useEffect(() => {
    coinsActivos().then(setActivos);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarCola();
  }, [cargarCola]);

  useEffect(() => {
    let vivo = true;
    const t = buscado.trim().replace(/[%_,()*]/g, " ");
    if (t.length < 2) { setLocales([]); return; }
    supabase.from("locales").select("id,nombre,plan").ilike("nombre", `%${t}%`).order("nombre").limit(8)
      .then(({ data }) => vivo && setLocales((data ?? []) as typeof locales));
    return () => { vivo = false; };
  }, [buscado]);

  const cargarSaldos = useCallback(async (id: string) => {
    const s = await getSaldos(id);
    setSaldos(s.datos);
    if (s.error) setMsg({ tono: "error", texto: s.error });
  }, []);

  const apuntar = async () => {
    if (!local) return;
    setGuardando(true); setMsg(null);
    const { error } = await apunteAdmin({ localId: local.id, tipo, bolsa, importe: Number(importe), motivo, referencia: referencia.trim() || null });
    setGuardando(false);
    if (error) { setMsg({ tono: "error", texto: error.message }); return; }
    setMsg({ tono: "ok", texto: "Apunte guardado y registrado en la auditoría." });
    setMotivo(""); setReferencia("");
    void cargarSaldos(local.id);
  };

  const mover = async (r: Reserva, estado: "confirmada" | "en_curso" | "entregada" | "cancelar") => {
    setMsg(null);
    const nota = notas[r.id]?.trim() || null;
    const { error } = estado === "cancelar"
      ? await cancelarReserva(r.id, nota ?? "Cancelada por el equipo (sin disponibilidad)")
      : await estadoReservaAdmin(r.id, estado, nota);
    if (error) { setMsg({ tono: "error", texto: error.message }); return; }
    setMsg({ tono: "ok", texto: estado === "cancelar" ? `Cancelada y devueltos ${r.coste} Coins al mismo origen.` : "Reserva actualizada." });
    void cargarCola();
    if (local?.id === r.local_id) void cargarSaldos(r.local_id);
  };

  if (falta) {
    return <SeccionPanel titulo="Coins"><p className="rounded-2xl border border-aviso/25 bg-aviso-fondo p-4 text-[15px]">Falta aplicar el lote 68 (supabase/68_profesional_negocio.sql).</p></SeccionPanel>;
  }

  return (
    <SeccionPanel titulo="Coins" descripcion="Apuntes manuales, reservas y devoluciones."
      acciones={activos ? <Etiqueta tono="ok">Activos</Etiqueta> : <Etiqueta>Desactivado · próximamente</Etiqueta>}>
      <div className="flex flex-col gap-6">
        {!activos && <p className="rounded-xl bg-marfil-100 p-3 text-[15px] text-tinta-suave">Los locales aún no pueden reservar (ajuste <code>coins_activos</code> apagado). Puedes preparar saldos; nadie paga nada desde la web.</p>}
        {msg && <p role="status" className={`rounded-xl p-3 text-[15px] font-semibold ${msg.tono === "ok" ? "bg-ok-fondo text-ok" : "bg-error-fondo text-error"}`}>{msg.texto}</p>}

        <section className="rounded-2xl border border-linea bg-white p-5 shadow-tarjeta">
          <h2 className="text-lg font-bold">Apunte manual</h2>
          <Campo etiqueta="Local" htmlFor="buscar-local">
            <input id="buscar-local" value={local ? local.nombre : busca} onChange={(e) => { setLocal(null); setBusca(e.target.value); }}
              placeholder="Escribe el nombre del local…" className={claseCampo} />
          </Campo>
          {!local && locales.length > 0 && (
            <ul className="mt-1 overflow-hidden rounded-xl border border-linea">
              {locales.map((l) => (
                <li key={l.id}><button type="button" onClick={() => { setLocal(l); void cargarSaldos(l.id); }}
                  className="min-h-[44px] w-full px-3 text-left text-[15px] hover:bg-marfil-100">{l.nombre} <span className="text-tinta-suave">· {l.plan}</span></button></li>
              ))}
            </ul>
          )}
          {local && (
            <>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {saldos.map((s) => <li key={s.bolsa} className="rounded-xl bg-marfil-100 p-2 text-[15px]"><b>{s.saldo}</b> {BOLSAS[s.bolsa as Bolsa]?.nombre}</li>)}
              </ul>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Tipo" htmlFor="tipo-ap">
                  <select id="tipo-ap" value={tipo} className={claseCampo}
                    onChange={(e) => { const t = TIPOS.find((x) => x.k === e.target.value)!; setTipo(t.k); setBolsa(t.bolsa); }}>
                    {TIPOS.map((t) => <option key={t.k} value={t.k}>{t.t}</option>)}
                  </select>
                </Campo>
                {tipo === "ajuste" && (
                  <Campo etiqueta="Bolsa" htmlFor="bolsa-ap">
                    <select id="bolsa-ap" value={bolsa} onChange={(e) => setBolsa(e.target.value as Bolsa)} className={claseCampo}>
                      {(Object.keys(BOLSAS) as Bolsa[]).map((b) => <option key={b} value={b}>{BOLSAS[b].nombre}</option>)}
                    </select>
                  </Campo>
                )}
                <Campo etiqueta={tipo === "compra" ? "Paquete (10, 25, 50, 100)" : "Coins (negativo para restar)"} htmlFor="imp-ap">
                  <input id="imp-ap" type="number" inputMode="numeric" value={importe} onChange={(e) => setImporte(e.target.value)} className={claseCampo} />
                </Campo>
                <Campo etiqueta="Referencia (nº de pago, mes…)" htmlFor="ref-ap">
                  <input id="ref-ap" value={referencia} onChange={(e) => setReferencia(e.target.value)} className={claseCampo} />
                </Campo>
              </div>
              <Campo etiqueta="Motivo (obligatorio, queda en la auditoría)" htmlFor="mot-ap">
                <input id="mot-ap" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={claseCampo} />
              </Campo>
              <Boton className="mt-3" onClick={apuntar} cargando={guardando} disabled={!motivo.trim() || !Number(importe)}>Guardar apunte</Boton>
            </>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl font-bold">Reservas abiertas</h2>
          {cola.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-linea-fuerte bg-white p-5 text-center text-[15px] text-tinta-suave">No hay reservas pendientes.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cola.map((r) => {
                const e = ESTADO_RESERVA[r.estado] ?? { texto: r.estado, tono: "neutro" as const };
                return (
                  <li key={r.id} className="rounded-2xl border border-linea bg-white p-4 shadow-tarjeta">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">{r.locales?.nombre ?? "Local"} · {r.servicio} · {r.coste} Coins</p>
                        <p className="text-sm text-tinta-suave">{new Date(r.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}{r.detalle ? ` · ${r.detalle}` : ""}</p>
                        <p className="text-sm text-tinta-suave">Origen: {Object.entries(r.desglose ?? {}).map(([b, v]) => `${v} ${BOLSAS[b as Bolsa]?.nombre ?? b}`).join(" + ") || "—"}</p>
                      </div>
                      <Etiqueta tono={e.tono}>{e.texto}</Etiqueta>
                    </div>
                    <input aria-label="Nota o resultado" placeholder="Nota / resultado (opcional)" value={notas[r.id] ?? ""}
                      onChange={(ev) => setNotas((n) => ({ ...n, [r.id]: ev.target.value }))} className={`${claseCampo} mt-2`} />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.estado === "pendiente" && <Boton tamano="pequeno" onClick={() => mover(r, "confirmada")}>Confirmar</Boton>}
                      {r.estado === "confirmada" && <Boton tamano="pequeno" onClick={() => mover(r, "en_curso")}>Empezar</Boton>}
                      {r.estado !== "pendiente" && <Boton tamano="pequeno" variante="contorno" onClick={() => mover(r, "entregada")}>Entregada</Boton>}
                      {r.estado !== "en_curso" && <Boton tamano="pequeno" variante="peligro" onClick={() => mover(r, "cancelar")}>Cancelar y devolver</Boton>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </SeccionPanel>
  );
}

