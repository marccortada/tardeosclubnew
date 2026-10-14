"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

export default function MiniMapa({
  lat, lng, alto = 160,
}: {
  lat: number;
  lng: number;
  /** En px. La ficha del local lo quiere algo más alto que el editor. */
  alto?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancel || !ref.current || mapRef.current) return;

      const map = L.map(ref.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: false,
        // En el móvil arrastrar con un dedo movía el mapa en vez de la página
        // y la ficha se quedaba "atascada" a media altura.
        dragging: !L.Browser.mobile,
      }).setView([lat, lng], 15);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: `<div style="position:relative;width:44px;height:50px">
          <div style="display:grid;place-items:center;width:44px;height:42px;border-radius:14px;
            border:3px solid #D61AA8;background:#fff;box-shadow:0 3px 8px rgba(0,0,0,.35)">
            <img src="/branding/pin-logo.png" style="width:34px;height:auto;display:block" alt=""/>
          </div>
          <div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:0;height:0;
            border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #D61AA8"></div>
        </div>`,
        iconSize: [44, 50],
        iconAnchor: [22, 50],
      });
      L.marker([lat, lng], { icon }).addTo(map);
      setTimeout(() => map.invalidateSize(), 200);
    })();

    return () => {
      cancel = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  return <div ref={ref} className="relative z-0 w-full" style={{ height: alto }} />;
}
