import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Phone, MessageSquare, Ticket, Clock, MapPin, CheckCircle2, CalendarClock, XCircle } from "lucide-react";
import { haversineKm, etaMinutes } from "@/lib/geo";
import { toast } from "sonner";

const TrackingMap = lazy(() => import("@/components/TrackingMap").then((m) => ({ default: m.TrackingMap })));

export const Route = createFileRoute("/track/$bookingId")({
  component: TrackPage,
});

const STATUS_STEPS = ["pending", "accepted", "on_the_way", "arrived", "in_progress", "completed"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending callback",
  accepted: "Approved",
  on_the_way: "On the way",
  arrived: "Arrived",
  in_progress: "Repair started",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
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

          {booking.status === "rejected" && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="font-semibold">Booking rejected</div>
              {booking.rejection_reason && <div className="mt-1 text-xs">Reason: {booking.rejection_reason}</div>}
            </div>
          )}
          {booking.status === "pending" && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <div className="font-semibold text-warning-foreground">📞 Awaiting callback confirmation</div>
              <div className="mt-1 text-xs text-muted-foreground">Our team will call you shortly to confirm this booking before dispatching a technician.</div>
            </div>
          )}
          {!techPos && booking.status !== "completed" && booking.status !== "cancelled" && booking.status !== "rejected" && (
            <div className="rounded-xl border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
              {booking.status === "pending" && "🕐 Waiting for our callback to confirm your booking."}
              {booking.status === "accepted" && "📍 Location not yet disclosed — technician will share live location once they head out."}
              {booking.status === "on_the_way" && "🚀 Out for service — waiting for live GPS to come online…"}
              {booking.status === "arrived" && "✅ Technician has arrived at your location."}
              {booking.status === "in_progress" && "🔧 Repair has been started by the technician."}
            </div>
          )}
          {techPos && booking.status !== "completed" && booking.status !== "cancelled" && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-2 text-center text-[11px] font-medium text-primary">
              🟢 Live location — refreshes every few seconds
            </div>
          )}

          {/* Booking info */}
          <div className="rounded-xl border bg-accent/20 p-3 text-sm">
            <div className="text-xs text-muted-foreground">Address</div>
            <div>{booking.address}</div>
            {booking.scheduled_at && (
              <>
                <div className="mt-2 text-xs text-muted-foreground">Scheduled for</div>
                <div>{new Date(booking.scheduled_at).toLocaleString()}</div>
              </>
            )}
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

          {/* Cancel / Reschedule actions (pending only) */}
          {booking.status === "pending" && (
            <BookingActions booking={booking} onUpdated={(b) => setBooking(b)} />
          )}

          {/* Support */}
          <SupportPanel settings={settings} />

          <Link to="/bookings"><Button variant="outline" className="w-full">View all bookings</Button></Link>
        </div>
      </Card>
    </div>
  );
}

function BookingActions({ booking, onUpdated }: { booking: any; onUpdated: (b: any) => void }) {
  const [openResched, setOpenResched] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [when, setWhen] = useState<string>(
    booking.scheduled_at ? new Date(booking.scheduled_at).toISOString().slice(0, 16) : ""
  );
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" as any })
      .eq("id", booking.id)
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Booking cancelled. Technician and admin notified.");
    setOpenCancel(false);
    if (data) onUpdated(data);
  };

  const reschedule = async () => {
    if (!when) return toast.error("Pick a date & time");
    setBusy(true);
    const { data, error } = await supabase
      .from("bookings")
      .update({ scheduled_at: new Date(when).toISOString() })
      .eq("id", booking.id)
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Rescheduled. Technician and admin notified.");
    setOpenResched(false);
    if (data) onUpdated(data);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" onClick={() => setOpenResched(true)}>
        <CalendarClock className="mr-1 h-4 w-4" /> Reschedule
      </Button>
      <Button variant="destructive" onClick={() => setOpenCancel(true)}>
        <XCircle className="mr-1 h-4 w-4" /> Cancel
      </Button>

      <Dialog open={openResched} onOpenChange={setOpenResched}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reschedule booking</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Pick a new date and time. The technician and admin will be notified.</p>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenResched(false)}>Back</Button>
            <Button onClick={reschedule} disabled={busy}>{busy ? "Saving…" : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openCancel} onOpenChange={setOpenCancel}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel this booking?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone. The technician and admin will be notified.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCancel(false)}>Keep it</Button>
            <Button variant="destructive" onClick={cancel} disabled={busy}>{busy ? "Cancelling…" : "Yes, cancel"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
