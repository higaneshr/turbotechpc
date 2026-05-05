import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Crosshair, MapPin } from "lucide-react";

// Fix default marker icons (CDN)
const customerIcon = L.divIcon({
  className: "",
  html: `<div style="background:oklch(0.62 0.21 255);width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.25);"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function Recenter({ pos }: { pos: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(pos, map.getZoom() < 14 ? 15 : map.getZoom());
  }, [pos, map]);
  return null;
}

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function MapPicker({
  value,
  onChange,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number }) => void;
}) {
  const [locating, setLocating] = useState(false);
  const center: [number, number] = value ? [value.lat, value.lng] : [28.6139, 77.209];

  const useGPS = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onChange({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative h-72 w-full overflow-hidden rounded-xl border shadow-[var(--shadow-card)]">
        <MapContainer center={center} zoom={value ? 15 : 11} className="h-full w-full">
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onChange={(lat, lng) => onChange({ lat, lng })} />
          {value && (
            <>
              <Recenter pos={[value.lat, value.lng]} />
              <Marker
                position={[value.lat, value.lng]}
                icon={customerIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const { lat, lng } = e.target.getLatLng();
                    onChange({ lat, lng });
                  },
                }}
              />
            </>
          )}
        </MapContainer>
        <Button
          type="button"
          size="sm"
          onClick={useGPS}
          disabled={locating}
          className="absolute right-3 top-3 z-[1000] shadow-lg"
        >
          <Crosshair className="mr-1 h-4 w-4" />
          {locating ? "Locating…" : "Use GPS"}
        </Button>
      </div>
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {value
            ? `Pinned: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)} — drag the marker or tap the map to adjust.`
            : "Tap the map or use GPS to pin your location."}
        </span>
      </div>
    </div>
  );
}
