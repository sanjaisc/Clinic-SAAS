"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet default icon issue with bundlers
(L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl = undefined;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface ClinicLocationMapProps {
  latitude: number;
  longitude: number;
  address?: string;
  className?: string;
}

export default function ClinicLocationMap({
  latitude,
  longitude,
  address,
  className = "",
}: ClinicLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Cleanup existing map if component re-renders with new coords
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView([latitude, longitude], 15);

    mapRef.current = map;

    // OpenStreetMap tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Custom marker icon using brand color
    const brandColor = "#059669";
    const markerIcon = L.divIcon({
      html: `
        <svg width="32" height="44" viewBox="0 0 32 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 28 16 28s16-16 16-28C32 7.163 24.837 0 16 0z" fill="${brandColor}"/>
          <circle cx="16" cy="16" r="7" fill="white"/>
        </svg>
      `,
      className: "custom-marker",
      iconSize: [32, 44],
      iconAnchor: [16, 44],
      popupAnchor: [0, -44],
    });

    // Add marker
    const marker = L.marker([latitude, longitude], { icon: markerIcon }).addTo(map);

    if (address) {
      marker.bindPopup(
        `<div style="font-size:13px;line-height:1.4;max-width:220px">${address}</div>`,
        { closeButton: false }
      );
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude, address]);

  return (
    <>
      <style jsx global>{`
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-control-attribution {
          font-size: 10px !important;
          background: rgba(255, 255, 255, 0.85) !important;
          backdrop-filter: blur(4px);
          border-radius: 4px 0 0 0;
          padding: 2px 6px !important;
        }
        .leaflet-control-attribution a {
          color: #059669 !important;
        }
      `}</style>
      <div
        ref={containerRef}
        className={`w-full rounded-lg overflow-hidden border border-border ${className}`}
        style={{ height: "240px" }}
      />
    </>
  );
}