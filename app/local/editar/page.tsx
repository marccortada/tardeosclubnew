"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Store, Check, Loader2, ImagePlus, Megaphone, Instagram, Globe, Mail, CalendarCheck, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SeccionPanel } from "@/components/panel/PanelShell";
import AddressSearch, { Direccion } from "@/components/AddressSearch";
import MiniMapa from "@/components/MiniMapa";
import CampoPlaylist from "@/components/CampoPlaylist";
import SelectorAdnLocal, { type AdnLocal } from "@/components/SelectorAdnLocal";
import Boton from "@/components/Boton";
import Campo, { claseCampo } from "@/components/ui/Campo";
import { useFicha, type FichaLocal } from "../_panel/PanelLocal";
import { updateMiLocal, subirLogoLocal } from "@/lib/tardeos";
import { redesParaGuardar, handleInstagram, urlSegura } from "@/lib/redes";

/** Una tarjeta por bloque, con ancla para el índice de arriba. */
function Bloque({ id, titulo, ayuda, children }: { id: string; titulo: string; ayuda?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-linea bg-white p-4 shadow-tarjeta md:p-6">
      <h2 className="text-lg font-bold">{titulo}</h2>
      {ayuda && <p className="mt-0.5 text-sm text-tinta-suave">{ayuda}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

const adnDe = (l: FichaLocal): AdnLocal => ({
  tipoLocal: l.tipo_local || "",
  aforo: l.aforo != null ? String(l.aforo) : "",
  espacios: l.espacios ?? [],
  musica: l.musica ?? [],
  ambiente: l.ambiente ?? [],
  publico: l.publico ?? [],
  dressCode: l.dress_code || "",
  horarioHabitual: l.horario_habitual || "",
});

/**
 * Los datos de la ficha, en bloques con nombre: básicos, dirección, redes,
 * música y ambiente, y logo. Antes era una columna de quince campos con un
 * «Guardar» al final y, al pulsarlo, te sacaba al panel sin decir si había
 * ido bien. Ahora se queda aquí y lo dice.
 *
 * La ficha llega del panel (ya cargada), así que el admin que entra con
 * ?id= edita la de ese local y no la suya.
 */
export default function EditarLocal() {
  const { ficha: local, actualizar, esPromotor } = useFicha();

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [direccion, setDireccion] = useState("");
  const [zona, setZona] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cambiarDir, setCambiarDir] = useState(false);
  const [playlist, setPlaylist] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [adn, setAdn] = useState<AdnLocal>(adnDe(local));
  // Las redes viven en una sola columna jsonb, pero se editan por separado.
  const [instagram, setInstagram] = useState("");
  const [web, setWeb] = useState("");
  const [reservas, setReservas] = useState("");
  const [facebook, setFacebook] = useState("");
  const [email, setEmail] = useState("");
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [logoMsg, setLogoMsg] = useState<{ ok: boolean; t: string } | null>(null);

  // Se rellena al entrar y al cambiar de ficha en el selector del panel.
  useEffect(() => {
    const l = local;
    setNombre(l.nombre || "");
    setTelefono(l.telefono || "");
    setDescripcion(l.descripcion || "");
    setPlaylist(l.playlist_url || "");
    setDireccion(l.direccion || "");
    setZona(l.zona || "");
    setCoords(l.lat && l.lng ? { lat: l.lat, lng: l.lng } : null);
    setLogo(l.logo_url || null);
    setEmail(l.email || "");
    const r = (l.redes ?? {}) as Record<string, string>;
    setInstagram(r.instagram || "");
    setWeb(r.web || "");
    setReservas(r.reservas || "");
    setFacebook(r.facebook || "");
    setAdn(adnDe(l));
    setGuardado(false); setError(""); setCambiarDir(false);
    // Solo al cambiar de ficha: `local` cambia también al guardar (actualizar)
    // y no hay que pisar lo que se está escribiendo.
  }, [local.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * El logo se guarda en cuanto se sube, sin esperar al botón de Guardar: si
   * alguien sube la imagen y se va de la página, lo raro sería perderla.
   */
  const onLogo = async (file: File) => {
    setSubiendoLogo(true); setLogoMsg(null);
    const url = await subirLogoLocal(local.id, file);
    if (!url) { setSubiendoLogo(false); setLogoMsg({ ok: false, t: "No se pudo subir el logo. Prueba con otra imagen." }); return; }
    const { data, error: e } = await updateMiLocal(local.id, { logo_url: url });
    setSubiendoLogo(false);
    if (e || !data?.length) { setLogoMsg({ ok: false, t: e ? e.message : "No tienes permiso sobre esta ficha." }); return; }
    setLogo(url);
    actualizar({ logo_url: url });
    setLogoMsg({ ok: true, t: "Logo guardado." });
  };

  const onDireccion = (d: Direccion) => {
    setDireccion(d.display);
    setZona(d.zona);
    setCoords({ lat: d.lat, lng: d.lng });
    setCambiarDir(false);
    setGuardado(false);
  };

  const guardar = async () => {
    setGuardado(false);
    if (!nombre.trim()) { setError(esPromotor ? "Pon el nombre con el que organizas." : "El local necesita un nombre."); return; }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("El email no parece válido."); return; }
    setGuardando(true); setError("");
    const fields: Record<string, unknown> = {
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      descripcion: descripcion.trim() || null,
      playlist_url: playlist.trim() || null,
      // El ADN: null cuando está vacío, no "" ni []. Así el filtro y las
      // recomendaciones distinguen "no lo ha dicho" de "ha dicho que ninguno".
      tipo_local: adn.tipoLocal.trim() || null,
      aforo: adn.aforo ? Number(adn.aforo) : null,
      espacios: adn.espacios.length ? adn.espacios : null,
      musica: adn.musica.length ? adn.musica : null,
      ambiente: adn.ambiente.length ? adn.ambiente : null,
      publico: adn.publico.length ? adn.publico : null,
      dress_code: adn.dressCode.trim() || null,
      horario_habitual: adn.horarioHabitual.trim() || null,
      // El email del local NO es público: el lote 14 le quitó a `anon` el
      // permiso sobre esa columna porque los 59 correos se cosechaban en una
      // sola petición. Se guarda aquí porque es el contacto del negocio y hay
      // que poder cambiarlo, no porque vaya a salir en la ficha.
      email: email.trim() || null,
      // Las cuatro redes en la misma columna, sin las claves vacías.
      redes: redesParaGuardar({ instagram, web, reservas, facebook }),
    };
    // Al promotor no se le tocan dirección ni coordenadas: no tiene ninguna, y
    // guardarle cadenas vacías le sobreescribiría lo que ya hubiera.
    if (!esPromotor) {
      fields.direccion = direccion;
      fields.zona = zona;
      if (coords) { fields.lat = coords.lat; fields.lng = coords.lng; }
    }
    const { data, error: e } = await updateMiLocal(local.id, fields);
    setGuardando(false);
    if (e) { setError(`No se pudo guardar: ${e.message}`); return; }
    if (!data?.length) { setError("No se guardó: no tienes permiso sobre esta ficha."); return; }
    actualizar(fields as Partial<FichaLocal>);
    setGuardado(true);
  };

  const indice = [
    ["basicos", "Datos básicos"],
    ...(esPromotor ? [] : [["direccion", "Dirección"]]),
    ["redes", "Redes y contacto"],
    ["musica", "Música y ambiente"],
    ["logo", "Logo"],
  ];

  return (
    <SeccionPanel
      titulo={esPromotor ? "Datos de la marca" : "Datos del local"}
      descripcion="Lo que ve la gente en tu ficha. Guarda al terminar."
      ancho="estrecho"
    >
      <nav aria-label="Secciones" className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
        {indice.map(([id, t]) => (
          <a key={id} href={`#${id}`}
            className="inline-flex min-h-[40px] shrink-0 items-center rounded-full border border-linea-fuerte bg-white px-3.5 text-[14px] font-semibold hover:border-tinta/50">
            {t}
          </a>
        ))}
      </nav>

      <div className="flex flex-col gap-4">
        <Bloque id="basicos" titulo="Datos básicos">
          <Campo etiqueta={esPromotor ? "Nombre con el que organizas" : "Nombre del local"} htmlFor="nombre">
            <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className={claseCampo} />
          </Campo>
          <Campo etiqueta="Teléfono o WhatsApp" htmlFor="tel" ayuda="Sale en tu ficha con un botón para escribirte.">
            <input id="tel" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="600 000 000" className={claseCampo} />
          </Campo>
          <Campo etiqueta="Descripción" htmlFor="desc" ayuda="Dos o tres frases: qué tipo de sitio es y por qué ir.">
            <textarea id="desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4}
              placeholder={esPromotor ? "Cuenta qué tipo de eventos organizas…" : "Cuenta qué ofrece tu local…"} className={`${claseCampo} resize-y`} />
          </Campo>
        </Bloque>

        {/* El promotor no tiene dirección fija: la pone en cada tardeo. */}
        {esPromotor ? (
          <p className="flex items-start gap-2 rounded-2xl border border-linea bg-white p-4 text-[15px] text-tinta-suave">
            <Megaphone size={18} className="mt-0.5 shrink-0 text-magenta" aria-hidden />
            Como promotor no tienes dirección fija: el sitio se elige al crear cada tardeo.
          </p>
        ) : (
          <Bloque id="direccion" titulo="Dirección" ayuda="De aquí salen tu chincheta en el mapa y la zona de los filtros.">
            {!cambiarDir ? (
              <div className="flex flex-col gap-2 rounded-xl border border-linea-fuerte bg-white p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{direccion || "Sin dirección"}</p>
                  {zona && <p className="text-sm text-tinta-suave">Zona: {zona}</p>}
                </div>
                <Boton variante="contorno" tamano="pequeno" onClick={() => setCambiarDir(true)}>Cambiar</Boton>
              </div>
            ) : (
              <>
                <AddressSearch onSelect={onDireccion} inicial={nombre} />
                <button type="button" onClick={() => setCambiarDir(false)} className="min-h-[44px] self-start text-[15px] font-bold text-magenta-700">
                  Dejarla como estaba
                </button>
              </>
            )}
            {coords ? (
              <div className="overflow-hidden rounded-xl ring-1 ring-linea">
                <MiniMapa lat={coords.lat} lng={coords.lng} />
              </div>
            ) : (
              <p className="rounded-xl bg-aviso-fondo p-3 text-[15px] text-aviso">
                Sin coordenadas tu local no sale en el mapa. Pulsa «Cambiar» y búscalo por su nombre.
              </p>
            )}
          </Bloque>
        )}

        {/* Dónde te encuentran fuera de aquí.
            46 de los 60 locales activos ya traían esto guardado de la
            migración —45 con Instagram— y no había ninguna pantalla para
            verlo ni corregirlo. Ahora sale en la ficha pública. */}
        <Bloque id="redes" titulo="Redes y contacto" ayuda="Sale en tu ficha, debajo de la dirección. El email no: ese es para que podamos avisarte a ti.">
          <CampoRed
            icon={Instagram} label="Instagram" valor={instagram} onCambio={setInstagram}
            placeholder="@tulocal"
            pista={instagram && !handleInstagram(instagram)
              ? "No se entiende. Pon tu nombre de usuario, como @tulocal."
              : handleInstagram(instagram) ? `Se abrirá instagram.com/${handleInstagram(instagram)}` : undefined}
            mal={Boolean(instagram) && !handleInstagram(instagram)}
          />
          <CampoRed
            icon={Globe} label="Página web" valor={web} onCambio={setWeb}
            placeholder="tulocal.com"
            pista={web && !urlSegura(web) ? "Esa dirección no se puede abrir." : undefined}
            mal={Boolean(web) && !urlSegura(web)}
          />
          <CampoRed
            icon={CalendarCheck} label="Reservas" valor={reservas} onCambio={setReservas}
            placeholder="Enlace para reservar mesa o entrada"
            pista={reservas && !urlSegura(reservas) ? "Esa dirección no se puede abrir." : undefined}
            mal={Boolean(reservas) && !urlSegura(reservas)}
          />
          <CampoRed
            icon={Mail} label="Email de contacto (privado)" valor={email} onCambio={setEmail}
            placeholder="hola@tulocal.com"
          />
          <p className="flex items-center gap-2 text-sm text-tinta-suave">
            <Phone size={14} aria-hidden /> El teléfono se cambia arriba, en Datos básicos.
          </p>
        </Bloque>

        {/* El ADN del local. Nada obligatorio: es lo que hace que te
            encuentren, no lo que hace falta para publicar. */}
        <Bloque id="musica" titulo="Música y ambiente" ayuda="Nada es obligatorio, pero cuanto más cuentes, en más búsquedas apareces y mejor te recomendamos a quien encaja contigo.">
          <CampoPlaylist valor={playlist} onCambio={setPlaylist} />
          <SelectorAdnLocal adn={adn} onCambio={setAdn} />
        </Bloque>

        {/* El logo es lo que sale en la chincheta del mapa; se guarda solo al
            subirlo, aparte del botón de abajo. */}
        <Bloque id="logo" titulo="Logo" ayuda="Es tu chincheta en el mapa. Cuadrado se ve mejor: se recorta al centro. Se guarda al subirlo.">
          <div className="flex items-center gap-4">
            <span className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-magenta-50 text-magenta ring-1 ring-linea">
              {logo
                // eslint-disable-next-line @next/next/no-img-element -- se reemplaza al vuelo tras subir; next/image cachearía la anterior
                ? <img src={logo} alt="Logo actual" className="h-full w-full object-cover" />
                : <Store size={36} aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <label className={`inline-flex min-h-tacto cursor-pointer items-center gap-2 rounded-xl px-5 text-[16px] font-bold ${subiendoLogo ? "bg-marfil-100 text-tinta-suave" : "bg-magenta-50 text-magenta-700 hover:bg-magenta-100"}`}>
                {subiendoLogo ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <ImagePlus size={18} aria-hidden />}
                {subiendoLogo ? "Subiendo…" : logo ? "Cambiar logo" : "Subir logo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={subiendoLogo}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogo(f); e.target.value = ""; }}
                />
              </label>
              {logoMsg && (
                <p role={logoMsg.ok ? undefined : "alert"} className={`mt-2 text-[15px] font-semibold ${logoMsg.ok ? "text-ok" : "text-error"}`}>{logoMsg.t}</p>
              )}
            </div>
          </div>
        </Bloque>

        {/* Barra de guardar pegada abajo en el móvil: el formulario es largo y
            el botón no puede quedar a seis pantallas. */}
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-linea bg-marfil/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
          <div aria-live="polite">
            {error && <p role="alert" className="rounded-xl border border-error/20 bg-error-fondo p-3 text-[15px] font-semibold text-error">{error}</p>}
            {guardado && !error && (
              <p className="flex items-center gap-2 rounded-xl bg-ok-fondo p-3 text-[15px] font-semibold text-ok">
                <Check size={18} aria-hidden /> Datos guardados.
                {/* Solo una ficha activa sale en la web: con la ficha pendiente
                    de aprobar, «ya se ven» sería falso. */}
                {local?.estado === "activo" ? " Ya se ven en tu ficha." : " Se verán en la web en cuanto tu ficha esté aprobada."}
              </p>
            )}
          </div>
          <Boton ancho onClick={guardar} cargando={guardando}>
            {!guardando && <Check size={20} aria-hidden />} Guardar datos
          </Boton>
        </div>
      </div>
    </SeccionPanel>
  );
}

/**
 * Un campo de red social con su aviso.
 *
 * El aviso se enseña MIENTRAS se escribe y no al guardar: si «@tu local» con
 * espacio se descubre al pulsar Guardar, ya te has ido de la página. Y no
 * bloquea el guardado, solo avisa: un enlace que no funciona es un problema
 * menor que perder los otros tres campos por no dejar guardar.
 */
function CampoRed({
  icon: Icon, label, valor, onCambio, placeholder, pista, mal,
}: {
  icon: LucideIcon; label: string; valor: string;
  onCambio: (v: string) => void; placeholder?: string; pista?: string; mal?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-[15px] font-semibold">
        <Icon size={17} className="text-magenta" aria-hidden /> {label}
      </span>
      <input
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder={placeholder}
        aria-invalid={mal || undefined}
        className={`${claseCampo} ${mal ? "!border-error" : ""}`}
      />
      {pista && (
        <span className={`mt-1.5 block text-sm ${mal ? "font-semibold text-error" : "text-tinta-suave"}`}>
          {pista}
        </span>
      )}
    </label>
  );
}
