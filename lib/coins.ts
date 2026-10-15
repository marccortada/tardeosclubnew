import { supabase } from "./supabase";
import { faltaLote68 } from "./tardeos";

/**
 * Coins (dossier pág. 13): créditos de servicios. 1 Coin = 1 €.
 * El libro contable vive en la base (lote 68, `coins_movimientos`, inmutable)
 * y los saldos se CALCULAN allí (`coins_saldos`). Aquí solo se lee y se llama
 * a las funciones. Todo apagado con `ajustes.coins_activos`; sin pasarela.
 */
export const CLAVE_COINS = "coins_activos";
export const PAQUETES = [10, 25, 50, 100] as const;

export type Bolsa = "comprado" | "promocional" | "fundador" | "protegido";
export const BOLSAS: Record<Bolsa, { nombre: string; nota: string }> = {
  comprado:    { nombre: "Comprados", nota: "No caducan y se conservan si te das de baja." },
  promocional: { nombre: "Promocionales del plan", nota: "Se acumulan hasta 20. Solo para promoción dentro de la app." },
  fundador:    { nombre: "Bono Fundador", nota: "10 Coins una vez; valen dos meses." },
  protegido:   { nombre: "Protegidos", nota: "Devueltos cuando un servicio no tuvo disponibilidad." },
};

export type Saldo = { bolsa: Bolsa; saldo: number; caduca: string | null };
export type Servicio = { slug: string; nombre: string; coste: number | null; alcance: string; solo_comprado: boolean; orden: number };
export type Reserva = {
  id: string; local_id: string; servicio: string; coste: number; tardeo_id: string | null; detalle: string | null;
  desglose: Partial<Record<Bolsa, number>>; estado: string; resultado: string | null; created_at: string; resuelta_en: string | null;
};
export type Movimiento = {
  id: number; local_id: string; tipo: string; bolsa: Bolsa; importe: number; saldo_bolsa: number;
  referencia: string | null; reserva_id: string | null; motivo: string | null; created_at: string;
};

export const TIPO_MOV: Record<string, string> = {
  compra: "Recarga", promocional_mensual: "Promocionales del mes", bono_fundador: "Bono Fundador",
  protegido: "Saldo protegido", consumo: "Reserva de servicio", devolucion: "Devolución", ajuste: "Ajuste del equipo",
};
export const ESTADO_RESERVA: Record<string, { texto: string; tono: "ok" | "aviso" | "neutro" | "error" | "marca" }> = {
  pendiente: { texto: "Pendiente", tono: "marca" }, confirmada: { texto: "Confirmada", tono: "aviso" },
  en_curso: { texto: "En curso", tono: "aviso" }, entregada: { texto: "Entregada", tono: "ok" },
  cancelada: { texto: "Cancelada · devuelta", tono: "neutro" }, rechazada: { texto: "Rechazada", tono: "error" },
};

type Res<T> = { datos: T; falta: boolean; error: string | null };
const envolver = <T,>(vacio: T, data: unknown, error: { code?: string; message: string } | null): Res<T> =>
  error ? { datos: vacio, falta: faltaLote68(error), error: faltaLote68(error) ? null : error.message } : { datos: (data ?? vacio) as T, falta: false, error: null };

export async function coinsActivos(): Promise<boolean> {
  const { data } = await supabase.from("ajustes").select("valor").eq("clave", CLAVE_COINS).maybeSingle();
  return data?.valor === "true";
}
export async function getSaldos(localId: string): Promise<Res<Saldo[]>> {
  const { data, error } = await supabase.rpc("coins_saldos", { p_local: localId });
  return envolver<Saldo[]>([], data, error);
}
export async function getServicios(): Promise<Res<Servicio[]>> {
  const { data, error } = await supabase.from("coins_servicios").select("*").eq("activo", true).order("orden");
  return envolver<Servicio[]>([], data, error);
}
export async function getReservas(localId: string | null, desde = 0, hasta = 49) {
  let q = supabase.from("coins_reservas").select("*", { count: "exact" }).order("created_at", { ascending: false }).order("id");
  if (localId) q = q.eq("local_id", localId);
  return q.range(desde, hasta);
}
export async function getMovimientos(localId: string, desde = 0, hasta = 24) {
  return supabase.from("coins_movimientos").select("*", { count: "exact" }).eq("local_id", localId)
    .order("id", { ascending: false }).range(desde, hasta);
}
export async function reservar(localId: string, servicio: string, tardeoId: string | null, detalle: string) {
  return supabase.rpc("coins_reservar", { p_local: localId, p_servicio: servicio, p_tardeo: tardeoId, p_detalle: detalle });
}
export async function cancelarReserva(id: string, motivo: string | null) {
  return supabase.rpc("coins_cancelar", { p_reserva: id, p_motivo: motivo });
}
export async function estadoReservaAdmin(id: string, estado: "confirmada" | "en_curso" | "entregada", resultado: string | null) {
  return supabase.rpc("coins_admin_estado", { p_reserva: id, p_estado: estado, p_resultado: resultado });
}
export async function apunteAdmin(p: { localId: string; tipo: string; bolsa: Bolsa; importe: number; motivo: string; referencia: string | null }) {
  return supabase.rpc("coins_admin_apunte", {
    p_local: p.localId, p_tipo: p.tipo, p_bolsa: p.bolsa, p_importe: p.importe, p_motivo: p.motivo, p_referencia: p.referencia,
  });
}
