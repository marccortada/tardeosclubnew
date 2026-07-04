"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { getTardeosPublicados } from "@/lib/tardeos";
import { Tardeo } from "@/lib/types";
import MapaSheet from "@/components/MapaSheet";

export default function MapaClient() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [sel, setSel] = useState<Tardeo | null>(null);

  useEffect(() => {
    let cancel = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancel || !ref.current || mapRef.current) return;

      const map = L.map(ref.current, { zoomControl: true }).setView([41.55, 2.3], 9);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      // Pin con el logo de TardeosClub sobre badge blanco (dorado si es destacado)
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

      const tardeos = await getTardeosPublicados();
      if (cancel) return;

      tardeos
        .filter((t) => t.lat && t.lng)
        .forEach((t) => {
          L.marker([t.lat, t.lng], { icon: pin(t.destacado) })
            .addTo(map)
            .on("click", () => setSel(t));
        });

      // Tu ubicación (intento real, con fallback)
      const marcarYo = (lat: number, lng: number) => {
        L.circleMarker([lat, lng], {
          radius: 9,
          color: "#fff",
          weight: 3,
          fillColor: "#1e88e5",
          fillOpacity: 1,
        })
          .addTo(map)
          .bindPopup("Estás aquí");
      };

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => !cancel && marcarYo(pos.coords.latitude, pos.coords.longitude),
          () => marcarYo(41.3874, 2.1686) // fallback: Barcelona
        );
      } else {
        marcarYo(41.3874, 2.1686);
      }
    })();

    return () => {
      cancel = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <>
      <div ref={ref} className="h-full w-full" />
      {sel && <MapaSheet tardeo={sel} onClose={() => setSel(null)} />}
    </>
  );
}
