"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SeccionPanel } from "@/components/panel/PanelShell";
import Paginacion, { usePaginado, useDiferido, Buscador, Filtros, EstadoLista } from "@/components/panel/Paginacion";
import { Etiqueta } from "@/components/ui/Chip";
import Hoja from "@/components/ui/Hoja";
import Boton from "@/components/Boton";
import Aviso from "@/components/admin/Aviso";
import { claseCampo } from "@/components/ui/Campo";
import { useAuth } from "@/lib/useAuth";
import { descargarCsv, leerPorLotes, hoyFichero } from "@/components/admin/csv";
import { Shield, Store, Megaphone, Disc3, Info, Mail, Phone, KeyRound, Trash2, Download } from "lucide-react";

type Perfil = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  is_admin: boolean;
  created_at: string;
};
type FichaUsuario = { id: string; nombre: string; tipo: "local" | "promotor" | "dj" };
type Filtro = "todos" | "admins" | "local" | "dj" | "sin";
/** Ids de dueños de fichas: pocas filas (las que tienen dueño), se piden una vez. */
type Duenos = { local: string[]; dj: string[] };
/** Acción en curso sobre un usuario (se confirma siempre en una hoja). */
type Accion = { tipo: "clave" | "borrar"; u: Perfil; paso: 1 | 2 };

const limpiar = (s: string) => s.replace(/[,()*%\\"']/g, " ").replace(/\s+/g, " ").trim();

/**
 * Usuarios registrados (tabla `profiles`). Lo tenía el admin antiguo.
 *
 * `is_admin` NO se cambia desde aquí: dar o quitar admin desde un botón es
 * demasiado fácil de hacer sin querer, y el cliente quiere un solo admin; se
 * hace por SQL. Sí se puede mandar un enlace para nueva contraseña y borrar
 * una cuenta (doble confirmación; lo hace /api/borrar-cuenta con la service
 * role, que solo vive en el servidor, y no deja borrar a otro admin).
 *
 * Qué fichas lleva cada uno se pregunta solo para la página visible, con dos
 * consultas `.in()`: en la base de producción no hay clave ajena declarada
 * entre `profiles` y `locales`, así que PostgREST no puede anidarlas. Por lo
 * mismo, los filtros "con ficha" / "sin ficha" se resuelven con la lista de
 * dueños (unas decenas de ids) y `.in()` / `not in`.
 */
export default function AdminUsuarios() {
  const [texto, setTexto] = useState("");
  const busca = useDiferido(texto);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [cuentas, setCuentas] = useState<Partial<Record<Filtro, number>>>({});
  const [fichas, setFichas] = useState<Map<string, FichaUsuario[]>>(new Map());
  const { user } = useAuth();
  const [accion, setAccion] = useState<Accion | null>(null);
  const [confirmaTexto, setConfirmaTexto] = useState("");
  const [obrando, setObrando] = useState(false);
  const [errHoja, setErrHoja] = useState("");
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const [exportando, setExportando] = useState<number | null>(null);
  const [duenos, setDuenos] = useState<Duenos | null>(null);
  const [errDuenos, setErrDuenos] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("locales").select("owner_id").not("owner_id", "is", null),
      supabase.from("djs").select("profile_id").not("profile_id", "is", null),
    ]).then(([l, d]) => {
      const e = l.error || d.error;
      if (e) { setErrDuenos(e.message); return; }
      setDuenos({
        local: [...new Set(((l.data ?? []) as { owner_id: string }[]).map((x) => x.owner_id))],
        dj: [...new Set(((d.data ?? []) as { profile_id: string }[]).map((x) => x.profile_id))],
      });
    });
  }, []);

  const consulta = (cuenta: boolean) => {
    let q = supabase.from("profiles").select("id,display_name,email,phone,is_admin,created_at", cuenta ? { count: "exact" } : undefined);
    if (filtro === "admins") q = q.eq("is_admin", true);
    if (duenos) q = filtrarPorFicha(q, filtro, duenos);
    const l = limpiar(busca);
    if (l) q = q.or(`email.ilike.%${l}%,display_name.ilike.%${l}%`);
    return q.order("created_at", { ascending: false }).order("id");
  };

  const p = usePaginado<Perfil>(
    (desde, hasta) =>
      consulta(true).range(desde, hasta) as unknown as PromiseLike<{ data: Perfil[] | null; count: number | null; error: unknown }>,
    [filtro, busca, !!duenos],
    25,
  );

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_admin", true),
    ]).then(([a, b]) => setCuentas((c) => ({ ...c, todos: a.count ?? undefined, admins: b.count ?? undefined })));
  }, []);

  // Contadores de las pestañas por ficha, cuando ya se sabe quién es dueño.
  useEffect(() => {
    if (!duenos) return;
    const base = () => supabase.from("profiles").select("id", { count: "exact", head: true });
    Promise.all((["local", "dj", "sin"] as const).map((f) => filtrarPorFicha(base(), f, duenos)))
      .then(([l, d, s]) => setCuentas((c) => ({ ...c, local: l.count ?? undefined, dj: d.count ?? undefined, sin: s.count ?? undefined })));
  }, [duenos]);

  // Hasta saber quién tiene ficha, los filtros por ficha no pueden consultar.
  const esperaDuenos = (filtro === "local" || filtro === "dj" || filtro === "sin") && !duenos && !errDuenos;

  // Fichas de los usuarios de esta página.
  useEffect(() => {
    const ids = p.filas.map((f) => f.id);
    if (!ids.length) return;
    Promise.all([
      supabase.from("locales").select("id,nombre,tipo,owner_id").in("owner_id", ids),
      supabase.from("djs").select("id,nombre_artistico,profile_id").in("profile_id", ids),
    ]).then(([l, d]) => {
      const m = new Map<string, FichaUsuario[]>();
      const add = (uid: string | null, f: FichaUsuario) => { if (uid) m.set(uid, [...(m.get(uid) ?? []), f]); };
      ((l.data ?? []) as { id: string; nombre: string; tipo: string | null; owner_id: string | null }[])
        .forEach((x) => add(x.owner_id, { id: x.id, nombre: x.nombre, tipo: x.tipo === "promotor" ? "promotor" : "local" }));
      ((d.data ?? []) as { id: string; nombre_artistico: string; profile_id: string | null }[])
        .forEach((x) => add(x.profile_id, { id: x.id, nombre: x.nombre_artistico, tipo: "dj" }));
      setFichas(m);
    });
  }, [p.filas]);

  const cerrar = () => { if (obrando) return; setAccion(null); setConfirmaTexto(""); setErrHoja(""); };

  const enviarClave = async (u: Perfil) => {
    if (!u.email) return;
    setObrando(true); setErrHoja("");
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, { redirectTo: `${window.location.origin}/perfil` });
    setObrando(false);
    if (error) { setErrHoja("No se pudo enviar: " + error.message); return; }
    setAccion(null);
    setAviso({ tono: "ok", texto: `Enlace enviado a ${u.email}. Le llegará un correo para poner una contraseña nueva.` });
  };

  const borrar = async (u: Perfil) => {
    setObrando(true); setErrHoja("");
    const { data: s } = await supabase.auth.getSession();
    let r: { ok?: boolean; error?: string } = {};
    let estado = 0;
    try {
      const res = await fetch("/api/borrar-cuenta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: s.session?.access_token, uid: u.id }),
      });
      estado = res.status;
      r = await res.json().catch(() => ({}));
    } catch {
      r = { error: "Sin conexión con el servidor." };
    }
    setObrando(false);
    if (!(estado >= 200 && estado < 300 && r.ok)) {
      setErrHoja(r.error || `No se pudo borrar la cuenta (error ${estado || "de red"}).`);
      return;
    }
    p.quitar((x) => x.id === u.id);
    setCuentas((c) => ({ ...c, todos: c.todos != null ? c.todos - 1 : c.todos }));
    setAccion(null); setConfirmaTexto("");
    setAviso({ tono: "ok", texto: `Cuenta de ${u.email || u.display_name || "usuario"} borrada. Sus fichas quedan sin dueño.` });
  };

  const exportarCsv = async () => {
    setExportando(0); setAviso(null);
    const { filas, error } = await leerPorLotes<Perfil>(
      (d, h) => consulta(false).range(d, h) as unknown as PromiseLike<{ data: Perfil[] | null; error: { message: string } | null }>,
      setExportando,
    );
    setExportando(null);
    if (error) { setAviso({ tono: "error", texto: "No se pudo exportar: " + error }); return; }
    descargarCsv(`usuarios-${hoyFichero()}.csv`, ["Nombre", "Email", "Teléfono", "Admin", "Alta", "Id"],
      filas.map((u) => [u.display_name ?? "", u.email ?? "", u.phone ?? "", u.is_admin ? "Sí" : "No", new Date(u.created_at).toLocaleDateString("es-ES"), u.id]));
    setAviso({ tono: "ok", texto: `Exportados ${filas.length.toLocaleString("es-ES")} usuarios.` });
  };

  // Para el segundo paso del borrado hay que escribir el email (o "BORRAR" si no tiene).
  const palabra = accion?.u.email || "BORRAR";
  const btnFila = "inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-linea-fuerte bg-white px-3 text-sm font-semibold hover:bg-marfil-100 disabled:opacity-50";

  return (
    <SeccionPanel
      titulo="Usuarios"
      descripcion="Todas las cuentas registradas, con las fichas que gestiona cada una."
      acciones={
        <Boton variante="contorno" tamano="pequeno" onClick={exportarCsv} cargando={exportando !== null} disabled={p.total === 0}>
          {exportando === null && <Download size={18} aria-hidden />}
          {exportando !== null ? `Exportando… ${exportando}` : `Exportar CSV (${p.total.toLocaleString("es-ES")})`}
        </Boton>
      }
      ancho="ancho"
    >
      <p className="mb-4 flex items-start gap-2 rounded-xl bg-marfil-100 p-3 text-[15px] text-tinta-suave">
        <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
        {/* En un solo hijo: suelto dentro del flex, el enlace hacía de
            columna y en móvil el texto quedaba en una tira estrecha. */}
        <span className="min-w-0">
          Para dar una ficha a alguien usa «Asignar dueño» en Locales o DJs, o un{" "}
          <Link href="/admin/enlaces" className="font-semibold text-magenta-700 underline">enlace de invitación</Link>.
        </span>
      </p>

      <div aria-live="polite">{aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}</div>

      <div className="mb-4 flex flex-col gap-3">
        <Buscador valor={texto} onCambiar={setTexto} placeholder="Buscar por email o nombre…" />
        <Filtros<Filtro>
          valor={filtro}
          onCambiar={setFiltro}
          opciones={[
            { clave: "todos", label: "Todos", n: cuentas.todos },
            { clave: "admins", label: "Admins", n: cuentas.admins },
            { clave: "local", label: "Con ficha local", n: cuentas.local },
            { clave: "dj", label: "Con ficha DJ", n: cuentas.dj },
            { clave: "sin", label: "Sin ficha", n: cuentas.sin },
          ]}
        />
        {errDuenos && <Aviso tono="error">No se pudo saber quién tiene ficha ({errDuenos}). Los filtros por ficha no funcionarán.</Aviso>}
      </div>

      <EstadoLista cargando={p.cargando || esperaDuenos} error={p.error ?? (errDuenos && filtro !== "todos" && filtro !== "admins" ? String(errDuenos) : null)} filas={p.filas.length}
        vacio={busca || filtro !== "todos" ? "Ningún usuario con esos filtros." : "Todavía no hay usuarios registrados."} />

      {p.filas.length > 0 && !esperaDuenos && (
        <div className={`overflow-hidden rounded-2xl border border-linea bg-white ${p.cargando ? "opacity-60" : ""}`}>
          <table className="w-full text-left text-[15px]">
            <thead className="hidden border-b border-linea bg-marfil text-[13px] font-semibold uppercase tracking-wide text-tinta-suave md:table-header-group">
              <tr>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Fichas que gestiona</th>
                <th className="px-4 py-3">Alta</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {p.filas.map((u) => {
                const suyas = fichas.get(u.id) ?? [];
                const inicial = (u.display_name || u.email || "?").trim().charAt(0).toUpperCase();
                return (
                  <tr key={u.id} className="flex flex-col gap-2 p-4 md:table-row md:p-0">
                    <td className="md:px-4 md:py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-marfil-100 font-bold text-tinta-suave" aria-hidden>{inicial}</span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-1.5 font-semibold leading-tight">
                            <Link href={`/admin/usuarios/${u.id}`} className="truncate hover:text-magenta-700 hover:underline">
                              {u.display_name || "Sin nombre"}
                            </Link>
                            {u.is_admin && <Etiqueta tono="marca"><Shield size={13} aria-hidden /> Admin</Etiqueta>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[300px] md:px-4 md:py-3">
                      {u.email ? (
                        <Link href={`/admin/usuarios/${u.id}`} className="flex items-center gap-1.5 truncate text-tinta hover:text-magenta-700" title={`Ver ficha de ${u.email}`}>
                          <Mail size={15} className="shrink-0 text-tinta-suave" aria-hidden /> <span className="truncate">{u.email}</span>
                        </Link>
                      ) : <span className="text-tinta-suave">Sin email</span>}
                      {u.phone && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-tinta-suave"><Phone size={14} aria-hidden /> {u.phone}</p>
                      )}
                    </td>
                    <td className="md:px-4 md:py-3">
                      {suyas.length === 0 ? (
                        <span className="text-sm text-tinta-suave">Sin ficha</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {suyas.map((f) => {
                            const I = f.tipo === "dj" ? Disc3 : f.tipo === "promotor" ? Megaphone : Store;
                            return (
                              <Link key={f.id} href={f.tipo === "dj" ? `/djs/${f.id}` : `/locales/${f.id}`} target="_blank"
                                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-linea-fuerte bg-white px-3 text-sm font-semibold hover:bg-marfil-100">
                                <I size={14} aria-hidden /> <span className="max-w-[12rem] truncate">{f.nombre}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="text-sm text-tinta-suave md:px-4 md:py-3">
                      <span className="md:hidden">Alta: </span>{new Date(u.created_at).toLocaleDateString("es-ES")}
                    </td>
                    <td className="md:px-4 md:py-3">
                      <div className="flex flex-wrap gap-1.5 md:justify-end">
                        {/* "Nueva contraseña" vive en la ficha del usuario: allí se sabe si
                            tiene cuenta de acceso. Aquí, a un perfil migrado sin cuenta, decía
                            "enlace enviado" sin que llegara nada. */}
                        <Link href={`/admin/usuarios/${u.id}`} className={btnFila}>Ver ficha</Link>
                        {!u.is_admin && u.id !== user?.id && (
                          <button type="button" onClick={() => { setAviso(null); setAccion({ tipo: "borrar", u, paso: 1 }); }}
                            className={`${btnFila} text-error hover:bg-error-fondo`}>
                            <Trash2 size={16} aria-hidden /> Borrar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Paginacion pagina={p.pagina} total={p.total} porPagina={p.porPagina} onCambiar={p.setPagina} cargando={p.cargando} />

      <Hoja abierta={!!accion} onCerrar={cerrar}
        titulo={accion?.tipo === "clave" ? "¿Enviar enlace para nueva contraseña?" : accion?.paso === 2 ? "Confirma el borrado" : "¿Borrar esta cuenta?"}>
        {accion && (
          <div className="flex flex-col gap-3">
            <p className="text-lg font-bold leading-tight">{accion.u.display_name || "Sin nombre"}</p>
            <p className="-mt-2 text-[15px] text-tinta-suave">{accion.u.email || "Sin email"}</p>
            {errHoja && <Aviso tono="error">{errHoja}</Aviso>}

            {accion.tipo === "clave" ? (
              <>
                <p className="text-[16px]">Le llegará un correo con un enlace para elegir una contraseña nueva. Su contraseña actual sigue valiendo hasta que la cambie.</p>
                <Boton ancho cargando={obrando} onClick={() => enviarClave(accion.u)}>Sí, enviar enlace</Boton>
                <Boton variante="contorno" ancho disabled={obrando} onClick={cerrar}>Cancelar</Boton>
              </>
            ) : accion.paso === 1 ? (
              <>
                <p className="rounded-xl bg-error-fondo p-4 text-[15px] font-semibold text-error">
                  Se borra la cuenta para siempre, con sus guardados, inscripciones y avisos.
                  {(fichas.get(accion.u.id)?.length ?? 0) > 0 && ` Sus ${fichas.get(accion.u.id)!.length} fichas no se borran: quedan sin dueño.`}
                  {" "}No se puede deshacer.
                </p>
                <Boton variante="peligro" ancho onClick={() => { setErrHoja(""); setAccion({ ...accion, paso: 2 }); }}>Continuar</Boton>
                <Boton variante="contorno" ancho onClick={cerrar}>Cancelar</Boton>
              </>
            ) : (
              <>
                <label htmlFor="confirma-borrar" className="text-[16px]">
                  Para confirmar, escribe <b className="break-all">{palabra}</b>:
                </label>
                <input id="confirma-borrar" value={confirmaTexto} onChange={(e) => setConfirmaTexto(e.target.value)}
                  autoComplete="off" autoCapitalize="off" spellCheck={false} className={claseCampo} />
                <Boton variante="peligro" ancho cargando={obrando}
                  disabled={confirmaTexto.trim().toLowerCase() !== palabra.toLowerCase()}
                  onClick={() => borrar(accion.u)}>
                  Borrar cuenta para siempre
                </Boton>
                <Boton variante="contorno" ancho disabled={obrando} onClick={cerrar}>Cancelar</Boton>
              </>
            )}
          </div>
        )}
      </Hoja>
    </SeccionPanel>
  );
}

/**
 * Aplica el filtro por ficha. "Local" incluye promotores (misma tabla). Con
 * 0 dueños, `.in()` vacío no devuelve nada y "sin ficha" no filtra.
 */
function filtrarPorFicha<Q extends { in: (c: string, v: string[]) => Q; not: (c: string, op: string, v: string) => Q }>(q: Q, filtro: Filtro, d: Duenos): Q {
  if (filtro === "local") return q.in("id", d.local);
  if (filtro === "dj") return q.in("id", d.dj);
  if (filtro === "sin") {
    const todos = [...new Set([...d.local, ...d.dj])];
    return todos.length ? q.not("id", "in", `(${todos.join(",")})`) : q;
  }
  return q;
}
