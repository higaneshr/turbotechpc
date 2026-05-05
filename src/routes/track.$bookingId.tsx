import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, Ticket, Clock, MapPin, CheckCircle2 } from "lucide-react";
import { haversineKm, etaMinutes } from "@/lib/geo";

const TrackingMap = lazy(() => import("@/components/TrackingMap").then((m) => ({ default: m.TrackingMap })));

export const Route = createFileRoute("/track/$bookingId")({
  component: TrackPage,
});

const STATUS_STEPS = ["pending", "accepted", "on_the_way", "arrived", "completed"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  on_the_way: "On the way",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
};

function TrackPage() {
  const { bookingId } = Route.useParams();
  const [booking, setBooking] = useState<any>(null);
  const [techPos, setTechPos] = useState<{ lat: number; lng: number } | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
      setBooking(data);
      if (data?.technician_lat && data?.technician_lng) {
        setTechPos({ lat: data.technician_lat, lng: data.technician_lng });
      }
    };
    load();
    supabase.from("app_settings").select("key,value").then(({ data }) => {
      const o: Record<string, any> = {};
      data?.forEach((r) => (o[r.key] = r.value));
      setSettings(o);
    });

    const ch = supabase
      .channel(`booking-${bookingId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (p) => {
          setBooking(p.new);
          if (p.new.technician_lat && p.new.technician_lng) {
            setTechPos({ lat: p.new.technician_lat, lng: p.new.technician_lng });
          }
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "location_updates", filter: `booking_id=eq.${bookingId}` },
        (p) => setTechPos({ lat: p.new.lat, lng: p.new.lng }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bookingId]);

  if (!booking) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const stepIdx = STATUS_STEPS.indexOf(booking.status);
  const customer = { lat: booking.customer_lat, lng: booking.customer_lng };
  const liveDistance = techPos ? haversineKm(techPos, customer) : booking.distance_km ?? 0;
  const liveEta = techPos ? etaMinutes(liveDistance) : booking.eta_minutes ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <Card className="overflow-hidden">
        <div className="border-b bg-accent/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Booking #{booking.id.slice(0, 8)}</div>
              <h1 className="text-lg font-bold">{booking.service_name}</h1>
            </div>
            <Badge variant={booking.status === "completed" ? "default" : "secondary"}>
              {STATUS_LABEL[booking.status]}
            </Badge>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Status timeline */}
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 items-center">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  i <= stepIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {i <= stepIdx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 ${i < stepIdx ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Live ETA */}
          {booking.status !== "completed" && booking.status !== "cancelled" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> Distance</div>
                <div className="text-xl font-bold">{liveDistance.toFixed(1)} km</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> ETA</div>
                <div className="text-xl font-bold">~{liveEta} min</div>
              </div>
            </div>
          )}

          {/* Map */}
          <Suspense fallback={<div className="h-80 rounded-xl bg-muted" />}>
            <TrackingMap customer={customer} technician={techPos} />
          </Suspense>

          {!techPos && booking.status !== "completed" && (
            <div className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">
              Waiting for a technician to start the trip… You'll see them move on the map in real time.
            </div>
          )}

          {/* Booking info */}
          <div className="rounded-xl border bg-accent/20 p-3 text-sm">
            <div className="text-xs text-muted-foreground">Address</div>
            <div>{booking.address}</div>
            {booking.problem && (
              <>
                <div className="mt-2 text-xs text-muted-foreground">Problem</div>
                <div>{booking.problem}</div>
              </>
            )}
            {booking.house_photo_url && (
              <>
                <div className="mt-2 text-xs text-muted-foreground">House photo</div>
                <img src={booking.house_photo_url} alt="House" className="mt-1 h-40 w-full rounded-lg border object-cover" />
              </>
            )}
          </div>

          {/* Support */}
          <SupportPanel settings={settings} />

          <Link to="/bookings"><Button variant="outline" className="w-full">View all bookings</Button></Link>
        </div>
      </Card>
    </div>
  );
}

function SupportPanel({ settings }: { settings: Record<string, any> }) {
  const type = settings.support_type ?? "phone";
  const phone = settings.support_phone ?? "+91 9999999999";
  return (
    <div className="rounded-xl border p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Need help?</div>
      {type === "phone" && (
        <a href={`tel:${phone}`} className="flex items-center gap-2 text-sm font-medium text-primary">
          <Phone className="h-4 w-4" /> Call support: {phone}
        </a>
      )}
      {type === "chat" && (
        <button className="flex items-center gap-2 text-sm font-medium text-primary">
          <MessageSquare className="h-4 w-4" /> Open chat
        </button>
      )}
      {type === "ticket" && (
        <button className="flex items-center gap-2 text-sm font-medium text-primary">
          <Ticket className="h-4 w-4" /> Raise a ticket
        </button>
      )}
    </div>
  );
}
