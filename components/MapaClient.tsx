"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, MarkerClusterGroup } from "leaflet";
import { getTardeosPublicados } from "@/lib/tardeos";
import { Tardeo } from "@/lib/types";
import MapaSheet from "@/components/MapaSheet";

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
const ZOOM_MAXIMO = 14;

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

export default function MapaClient({ tardeos: tardeosProp }: { tardeos?: Tardeo[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const capasRef = useRef<MarkerClusterGroup[]>([]); // un cluster por población
  const observerRef = useRef<ResizeObserver | null>(null);
  const encuadreRef = useRef<any>(null);   // límites que abarcan los tardeos pintados
  const encuadradoRef = useRef(false);
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
    if (!map || !limites?.isValid()) return;
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
    map.fitBounds(limites, {
      paddingTopLeft: [lados, arriba],
      paddingBottomRight: [lados, abajo],
      maxZoom: ZOOM_MAXIMO,
    });

    // fitBounds deja el contenido pegado a los bordes y, en contenedores bajos
    // como el mapa de la portada en móvil, se aleja tantísimo que salen
    // Portugal e Italia. Un punto más de zoom, y nunca por debajo del suelo:
    // vale más entrar viendo bien la zona buena que verlo todo diminuto.
    const z = map.getZoom();
    map.setZoom(Math.min(Math.max(z + 1, ZOOM_MINIMO), ZOOM_MAXIMO));
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

      const map = L.map(ref.current, { zoomControl: true }).setView([41.55, 2.3], 9);
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
          () => marcarYo(41.3874, 2.1686)
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
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // (Re)pintar los pines cada vez que cambian los datos filtrados
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const pin = (destacado: boolean) =>
      L.divIcon({
        className: "",
        html: `<div style="position:relative;width:54px;height:60px">
          <div style="display:grid;place-items:center;width:54px;height:50px;border-radius:16px;
            border:3px solid ${destacado ? "#F5B301" : "#E10A5A"};background:#fff;
            box-shadow:0 3px 8px rgba(0,0,0,.35)">
            <img src="/branding/pin-logo.png" style="width:40px;height:auto;display:block" alt=""/>
          </div>
          <div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:0;height:0;
            border-left:7px solid transparent;border-right:7px solid transparent;
            border-top:9px solid ${destacado ? "#F5B301" : "#E10A5A"}"></div>
        </div>`,
        iconSize: [54, 60],
        iconAnchor: [27, 60],
      });

    // La burbuja del grupo: número de tardeos, dorada si alguno es destacado.
    const burbuja = (cluster: any) => {
      const n = cluster.getChildCount();
      const destacado = cluster
        .getAllChildMarkers()
        .some((m: any) => m.options?.tardeoDestacado);
      const size = n < 10 ? 46 : n < 25 ? 56 : 66;
      const color = destacado ? "#F5B301" : "#E10A5A";
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
        L.marker([t.lat, t.lng], { icon: pin(t.destacado), tardeoDestacado: t.destacado })
          .addTo(capa)
          .on("click", () => setSel(t));
      });
      capa.addTo(map);
      capasRef.current.push(capa);
    });

    // Cambian los datos (carga inicial o filtro) -> toca reencuadrar.
    encuadreRef.current = conCoords.length
      ? L.latLngBounds(conCoords.map((t: Tardeo) => [t.lat, t.lng]))
      : null;
    encuadradoRef.current = false;
    encuadrar();
  }, [datos, listo, encuadrar]);

  return (
    <>
      <div ref={ref} className="h-full w-full" />
      {sel && <MapaSheet tardeo={sel} onClose={() => setSel(null)} />}
    </>
  );
}
