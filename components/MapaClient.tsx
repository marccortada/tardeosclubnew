"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, MarkerClusterGroup } from "leaflet";
import { getTardeosPublicados } from "@/lib/tardeos";
import { Tardeo } from "@/lib/types";
import MapaSheet from "@/components/MapaSheet";
import { optimizable } from "@/lib/fotos";
// CSS del mapa solo donde hay mapa (antes iba en el layout, en todas las páginas).
// MarkerCluster.css es solo la base (posicionado y animación); el aspecto de la
// burbuja es propio. mapa.css va el último para que sus retoques ganen.
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./mapa.css";

/**
 * Reparte los tardeos en "poblaciones" por distancia real, no por texto:
 * ni `zona` ni `direccion` son fiables (los datos geocodificados traen el
 * pueblo en `zona`, y el seed la comarca). Cada población se pinta luego con
 * su propio cluster, así Barcelona nunca se funde con Mataró a ningún zoom.
 */
const RADIO_POBLACION_KM = 8;

// Suelo y techo del encuadre automático. El suelo evita que un mapa bajito se
// aleje hasta enseñar media Europa; el techo, que un tardeo solo te deje
// mirando una acera.
const ZOOM_MINIMO = 8;
const ZOOM_MAXIMO = 12;
// Con un único tardeo: se ve el pueblo y sus calles principales.
const ZOOM_UNICO = 13;

/**
 * La costa catalana, de Amposta a Portbou. Con uno o ningún tardeo no hay
 * nada que encuadrar: ajustar a un solo punto acercaba hasta enseñar un único
 * pueblo (en la portada no se sabía ni dónde estaba). Se enseña la costa
 * entera y, si hay un tardeo, su chincheta dentro.
 */
const COSTA: [[number, number], [number, number]] = [[40.9, 0.9], [42.1, 3.3]];

function distanciaKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * El logo de la chincheta se ve a 54 px, pero el original pesa hasta 339 KB.
 * Si es de nuestro Supabase (host permitido en next.config.mjs) o una ruta
 * propia, se pide al optimizador de Next a 96 px (pantallas 2x). Otros hosts
 * no están permitidos en el optimizador y darían error: van tal cual.
 * q=75 y no 70: Next 16 solo acepta las calidades de `images.qualities`
 * (por defecto [75]); cualquier otra devuelve 400 y el pin saldría vacío.
 */
function srcPin(logo: string) {
  return optimizable(logo) ? `/_next/image?url=${encodeURIComponent(logo)}&w=96&q=75` : logo;
}

function porPoblaciones(tardeos: Tardeo[]): Tardeo[][] {
  // El centro de cada población es su primer tardeo y no se mueve: si fuera la
  // media, una costa con muchos locales encadenaría pueblo con pueblo.
  const grupos: { lat: number; lng: number; items: Tardeo[] }[] = [];
  // Orden estable para que el reparto no dependa del orden de llegada.
  const ordenados = [...tardeos].sort((a, b) => a.lat - b.lat || a.lng - b.lng);
  for (const t of ordenados) {
    const cerca = grupos.find(
      (g) => distanciaKm(g.lat, g.lng, t.lat, t.lng) <= RADIO_POBLACION_KM
    );
    if (cerca) cerca.items.push(t);
    else grupos.push({ lat: t.lat, lng: t.lng, items: [t] });
  }
  return grupos.map((g) => g.items);
}

export default function MapaClient({
  tardeos: tardeosProp,
  conZoom = true,
  centro,
}: {
  tardeos?: Tardeo[];
  /**
   * Centro de la zona elegida (Inicio). Con 0-1 tardeos, en vez de la costa
   * entera se encuadra la zona: si no, al elegir «Maresme» se seguía viendo
   * de Amposta a Portbou.
   */
  centro?: [number, number];
  /**
   * Los botones de + y −. Se apagan en la vista previa de la portada, que va
   * dentro de un contenedor `pointer-events-none`: allí no se pueden pulsar,
   * así que solo estorban —y encima quedaban debajo del rótulo "Tardeos cerca
   * de ti"—.
   */
  conZoom?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const capasRef = useRef<MarkerClusterGroup[]>([]); // un cluster por población
  const observerRef = useRef<ResizeObserver | null>(null);
  const encuadreRef = useRef<any>(null);   // límites que abarcan los tardeos pintados
  const encuadradoRef = useRef(false);
  const costaRef = useRef(false);          // true = encuadre de la costa (0-1 tardeos)
  const unicoRef = useRef<[number, number] | null>(null); // el tardeo, si solo hay uno
  const puntosRef = useRef<[number, number][]>([]);       // coordenadas pintadas (para comprobar el encuadre)
  const LRef = useRef<any>(null);
  const [sel, setSel] = useState<Tardeo | null>(null);
  const [internos, setInternos] = useState<Tardeo[]>([]);
  const [listo, setListo] = useState(false);

  // datos a pintar: los del prop (mapa filtrable) o los internos (home)
  const datos = tardeosProp ?? internos;

  /**
   * Encuadra el mapa sobre los tardeos que hay, en vez de dejarlo en un centro
   * fijo. Con los datos reales dentro, los tardeos van de Amposta a L'Estartit
   * y el encuadre de siempre ([41.55, 2.3] al zoom 9) se dejaba fuera media
   * Catalunya.
   *
   * Si el contenedor todavía no tiene tamaño, no encuadra y deja la marca sin
   * poner: lo reintenta el ResizeObserver en cuanto el mapa mide algo. Calcular
   * los límites sobre un mapa de 0x0 da un encuadre sin sentido.
   */
  const encuadrar = useCallback(() => {
    const map = mapRef.current as any;
    const limites = encuadreRef.current;
    // `_loaded`/`_container`: tras remove() Leaflet los borra; mover un mapa
    // desmontado es lo que lanzaba «reading '_leaflet_pos'».
    if (!map || !map._loaded || !map._container || !limites?.isValid()) return;
    const tam = map.getSize();
    if (tam.x < 50 || tam.y < 50) return;
    // Relleno asimétrico: el pin mide 60 px y sale hacia arriba desde su
    // coordenada, así que arriba hace falta hueco o se recorta. Pero acotado al
    // tamaño real: en el mapa de la portada (176 px de alto) un margen fijo de
    // 68+28 se comía más de la mitad del hueco y descuadraba el encuadre.
    const arriba = Math.min(68, Math.round(tam.y * 0.18));
    const abajo = Math.min(28, Math.round(tam.y * 0.08));
    const lados = Math.min(24, Math.round(tam.x * 0.06));
    // maxZoom para que un único tardeo no te deje mirando una acera.
    // Sin animación: el encuadre inicial no necesita vuelo, y una animación
    // a medias al salir de la pantalla dejaba a Leaflet tocando nodos ya quitados.
    map.fitBounds(limites, {
      paddingTopLeft: [lados, arriba],
      paddingBottomRight: [lados, abajo],
      maxZoom: ZOOM_MAXIMO,
      animate: false,
    });

    // Con la costa entera de encuadre no se acerca más: ya es lo que se quiere ver.
    // En un móvil en vertical o un contenedor bajo, la costa entera obliga a
    // alejarse hasta Toulouse y Mallorca: suelo de 8, centrado en la costa.
    if (costaRef.current) {
      if (unicoRef.current) {
        // Un solo tardeo: se centra en él a zoom de barrio. Con la costa entera
        // la chincheta quedaba diminuta y, con el suelo de zoom, a veces fuera.
        map.setView(unicoRef.current, ZOOM_UNICO, { animate: false });
      } else if (map.getZoom() < ZOOM_MINIMO) {
        map.setView([41.6, 2.2], ZOOM_MINIMO, { animate: false });
      }
    } else {
      // fitBounds deja los puntos pegados a los bordes y en contenedores bajos
      // se aleja mucho. Se prueba un punto más de zoom (y el suelo de 8), pero
      // SOLO si todas las chinchetas siguen dentro: antes se sumaba +1 a ciegas
      // y con dos tardeos separados el mapa abría en Dosrius sin ningún pin.
      const puntos: [number, number][] = puntosRef.current;
      const todosDentro = () => {
        const t = map.getSize();
        return puntos.every(([lat, lng]) => {
          const p = map.latLngToContainerPoint([lat, lng]);
          return p.x >= lados && p.x <= t.x - lados && p.y >= arriba && p.y <= t.y - abajo;
        });
      };
      const z = map.getZoom();
      const centroFit = map.getCenter();
      const objetivo = Math.min(Math.max(z + 1, ZOOM_MINIMO), ZOOM_MAXIMO);
      if (objetivo > z) {
        map.setZoom(objetivo, { animate: false });
        // Si al acercar se sale alguna, se vuelve al encuadre que las veía todas.
        if (!todosDentro()) map.setView(centroFit, z, { animate: false });
      }
    }
    encuadradoRef.current = true;
  }, []);

  // Inicializar el mapa una sola vez
  useEffect(() => {
    let cancel = false;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet.markercluster"); // añade L.markerClusterGroup
      if (cancel || !ref.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(ref.current, { zoomControl: conZoom }).setView([41.55, 2.3], 9);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      // Si el contenedor nace sin altura (pestaña oculta, panel plegado, móvil
      // girando), Leaflet cree que el mapa mide 0 y el cluster no dibuja nada
      // porque ningún pin entra en los límites visibles. Al recuperar tamaño hay
      // que avisarle; si no, el mapa se queda vacío para siempre.
      const ro = new ResizeObserver(() => {
        map.invalidateSize();
        // Solo si el encuadre inicial se quedó pendiente por falta de tamaño.
        // Reencuadrar en cada resize le movería el mapa al usuario mientras
        // gira el móvil o arrastra la ventana.
        if (!encuadradoRef.current) encuadrar();
      });
      ro.observe(ref.current);
      observerRef.current = ro;

      // Tu ubicación (intento real, con fallback)
      const marcarYo = (lat: number, lng: number) => {
        L.circleMarker([lat, lng], { radius: 9, color: "#fff", weight: 3, fillColor: "#1e88e5", fillOpacity: 1 })
          .addTo(map)
          .bindPopup("Estás aquí");
      };
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => !cancel && marcarYo(pos.coords.latitude, pos.coords.longitude),
          () => !cancel && marcarYo(41.3874, 2.1686)
        );
      } else {
        marcarYo(41.3874, 2.1686);
      }

      // Si no me pasan datos, los cargo yo (uso en la home)
      if (!tardeosProp) {
        const t = await getTardeosPublicados();
        if (!cancel) setInternos(t);
      }
      if (!cancel) setListo(true);
    })();

    return () => {
      cancel = true;
      observerRef.current?.disconnect();
      observerRef.current = null;
      const map = mapRef.current;
      mapRef.current = null;
      if (map) {
        // Orden importante: parar animaciones (zoom/pan en curso) y quitar
        // oyentes ANTES de remove(); si no, un paso de animación posterior lee
        // la posición de un panel ya borrado (`_leaflet_pos` de undefined).
        try {
          map.stop();
          map.off();
          capasRef.current.forEach((c) => map.removeLayer(c));
          map.remove();
        } catch { /* el mapa ya estaba a medio desmontar: nada que limpiar */ }
      }
      capasRef.current = [];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // (Re)pintar los pines cada vez que cambian los datos filtrados
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    /**
     * La chincheta lleva el logo del local si lo tiene, y el de TardeosClub si
     * no. El logo se recorta a cuadrado (object-fit) porque los que suben los
     * locales vienen de cualquier proporción y sin esto se deforman.
     *
     * Va como HTML plano y no como JSX porque Leaflet dibuja el icono a partir
     * de una cadena: aquí no hay React, así que tampoco next/image.
     */
    const pin = (destacado: boolean, logo?: string) => {
      const color = destacado ? "#FAC72E" : "#D61AA8";
      const dentro = logo
        ? `<img src="${srcPin(logo)}" style="width:100%;height:100%;object-fit:cover;display:block" alt=""
             onerror="this.src='/branding/pin-logo.png';this.style.objectFit='contain';this.style.padding='5px'"/>`
        : `<img src="/branding/pin-logo.png" style="width:40px;height:auto;display:block" alt=""/>`;
      return L.divIcon({
        className: "",
        html: `<div style="position:relative;width:54px;height:60px">
          <div style="display:grid;place-items:center;overflow:hidden;width:54px;height:50px;border-radius:16px;
            border:3px solid ${color};background:#fff;
            box-shadow:0 3px 8px rgba(0,0,0,.35)">${dentro}</div>
          <div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:0;height:0;
            border-left:7px solid transparent;border-right:7px solid transparent;
            border-top:9px solid ${color}"></div>
        </div>`,
        iconSize: [54, 60],
        iconAnchor: [27, 60],
      });
    };

    // La burbuja del grupo: número de tardeos, dorada si alguno es destacado.
    const burbuja = (cluster: any) => {
      const n = cluster.getChildCount();
      const destacado = cluster
        .getAllChildMarkers()
        .some((m: any) => m.options?.tardeoDestacado);
      const size = n < 10 ? 46 : n < 25 ? 56 : 66;
      const color = destacado ? "#FAC72E" : "#D61AA8";
      const texto = destacado ? "#2A1721" : "#fff";
      return L.divIcon({
        className: "",
        html: `<div style="display:grid;place-items:center;width:${size}px;height:${size}px;
          border-radius:9999px;background:${color};color:${texto};border:3px solid #fff;
          box-shadow:0 3px 10px rgba(0,0,0,.35);font-weight:800;
          font-size:${n < 100 ? 17 : 15}px;line-height:1">+${n}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    };

    // Fuera los grupos de la pasada anterior (cambio de filtro).
    capasRef.current.forEach((c) => map.removeLayer(c));
    capasRef.current = [];

    // Un cluster por población. Como cada uno es independiente, dos poblaciones
    // distintas jamás se juntan en una sola burbuja, por muy lejos que estés.
    // Dentro de la población sí manda el radio en píxeles: al hacer zoom se van
    // soltando, y desde el 15 se ve cada tardeo por separado.
    const conCoords = datos.filter((t) => t.lat && t.lng);

    porPoblaciones(conCoords).forEach((items) => {
      const capa = L.markerClusterGroup({
        maxClusterRadius: 150,
        disableClusteringAtZoom: 15,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true, // dos tardeos en el mismo portal se abren en abanico
        iconCreateFunction: burbuja,
      });
      items.forEach((t) => {
        L.marker([t.lat, t.lng], { icon: pin(t.destacado, t.local?.logo), tardeoDestacado: t.destacado })
          .addTo(capa)
          .on("click", () => setSel(t));
      });
      capa.addTo(map);
      capasRef.current.push(capa);
    });

    // Cambian los datos (carga inicial o filtro) -> toca reencuadrar.
    costaRef.current = conCoords.length < 2 && !centro;
    unicoRef.current = conCoords.length === 1 ? [conCoords[0].lat, conCoords[0].lng] : null;
    puntosRef.current = conCoords.map((t) => [t.lat, t.lng] as [number, number]);
    if (conCoords.length < 2 && centro) {
      // Unos 25 km alrededor del centro de la zona (y su tardeo, si lo hay).
      const zona = L.latLngBounds([[centro[0] - 0.2, centro[1] - 0.28], [centro[0] + 0.2, centro[1] + 0.28]]);
      if (conCoords[0]) zona.extend([conCoords[0].lat, conCoords[0].lng]);
      encuadreRef.current = zona;
    } else if (costaRef.current) {
      const costa = L.latLngBounds(COSTA);
      // Si el único tardeo cae fuera (Lleida, Andorra…), se amplía para que se vea.
      if (conCoords[0]) costa.extend([conCoords[0].lat, conCoords[0].lng]);
      encuadreRef.current = costa;
    } else {
      encuadreRef.current = L.latLngBounds(conCoords.map((t: Tardeo) => [t.lat, t.lng]));
    }
    encuadradoRef.current = false;
    encuadrar();
  }, [datos, listo, encuadrar, centro]);

  return (
    <>
      <div ref={ref} className="h-full w-full" />
      {sel && <MapaSheet tardeo={sel} onClose={() => setSel(null)} />}
    </>
  );
}
