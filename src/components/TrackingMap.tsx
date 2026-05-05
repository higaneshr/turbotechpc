import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

const customerIcon = L.divIcon({
  className: "",
  html: `<div style="background:oklch(0.6 0.22 25);width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.25);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

const techIcon = L.divIcon({
  className: "",
  html: `<div style="position:relative;">
    <div class="tech-marker-pulse" style="position:absolute;inset:-6px;background:oklch(0.62 0.21 255 / 0.4);border-radius:9999px;"></div>
    <div style="position:relative;background:oklch(0.62 0.21 255);width:32px;height:32px;border-radius:9999px;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:16px;">🛵</div>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
    }
  }, [points, map]);
  return null;
}

export function TrackingMap({
  customer,
  technician,
}: {
  customer: { lat: number; lng: number };
  technician: { lat: number; lng: number } | null;
}) {
  const points: [number, number][] = [[customer.lat, customer.lng]];
  if (technician) points.push([technician.lat, technician.lng]);

  return (
    <div className="h-80 w-full overflow-hidden rounded-xl border shadow-[var(--shadow-card)]">
      <MapContainer center={[customer.lat, customer.lng]} zoom={14} className="h-full w-full">
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[customer.lat, customer.lng]} icon={customerIcon} />
        {technician && <Marker position={[technician.lat, technician.lng]} icon={techIcon} />}
        {technician && (
          <Polyline
            positions={[
              [technician.lat, technician.lng],
              [customer.lat, customer.lng],
            ]}
            pathOptions={{ color: "#3b82f6", weight: 3, dashArray: "8 8" }}
          />
        )}
        <Fit points={points} />
      </MapContainer>
    </div>
  );
}
