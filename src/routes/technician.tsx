import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Navigation, MapPin, Phone, CheckCircle2 } from "lucide-react";
import { haversineKm, etaMinutes } from "@/lib/geo";

const TrackingMap = lazy(() => import("@/components/TrackingMap").then((m) => ({ default: m.TrackingMap })));

export const Route = createFileRoute("/technician")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: "/technician" } as never });
  },
  component: TechPage,
});

function TechPage() {
  const { user, role } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const watchId = useRef<number | null>(null);

  const load = async () => {
    if (!user) return;
    const [{ data: mine }, { data: pend }] = await Promise.all([
      supabase.from("bookings").select("*").eq("technician_id", user.id)
        .in("status", ["accepted", "on_the_way", "arrived"])
        .order("created_at", { ascending: false }),
      supabase.from("bookings").select("*").eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);
    setJobs(mine ?? []);
    setPending(pend ?? []);
    const cur = (mine ?? []).find((j) => ["accepted", "on_the_way", "arrived"].includes(j.status));
    setActive(cur ?? null);
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`tech-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // GPS streaming when there's an active job
  useEffect(() => {
    if (!active || !user) {
      if (watchId.current !== null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
      return;
    }
    if (!navigator.geolocation) { toast.error("Geolocation unsupported"); return; }
    let lastSent = 0;
    watchId.current = navigator.geolocation.watchPosition(
      async (p) => {
        const { latitude: lat, longitude: lng, heading } = p.coords;
        setPos({ lat, lng });
        const now = Date.now();
        if (now - lastSent < 4000) return;
        lastSent = now;
        await supabase.from("location_updates").insert({
          booking_id: active.id, technician_id: user.id, lat, lng, heading,
        });
        await supabase.from("bookings").update({ technician_lat: lat, technician_lng: lng }).eq("id", active.id);
      },
      (err) => toast.error("Location error: " + err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
  }, [active, user]);

  const approve = async (b: any) => {
    if (!user) return;
    const { error } = await supabase.from("bookings")
      .update({ technician_id: user.id, status: "accepted" })
      .eq("id", b.id).eq("status", "pending");
    if (error) toast.error(error.message); else toast.success("Booking approved");
  };

  const updateStatus = async (status: string) => {
    if (!active) return;
    const { error } = await supabase.from("bookings").update({ status: status as any }).eq("id", active.id);
    if (error) toast.error(error.message); else toast.success("Status: " + status);
  };

  if (role && role !== "technician" && role !== "admin") {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-muted-foreground">You're not assigned as a technician. Ask the admin to grant access.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 space-y-3">
      <h1 className="text-xl font-bold">Technician Dashboard</h1>

      {active ? (
        <Card className="overflow-hidden">
          <div className="border-b bg-accent/30 p-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Active job</div>
              <div className="font-semibold">{active.service_name}</div>
            </div>
            <Badge>{active.status}</Badge>
          </div>
          <div className="p-4 space-y-3">
            <div className="text-sm">
              <div className="font-medium">{active.customer_name}</div>
              <a href={`tel:${active.customer_phone}`} className="flex items-center gap-1 text-primary"><Phone className="h-3.5 w-3.5" /> {active.customer_phone}</a>
              <div className="mt-1 text-xs text-muted-foreground">{active.address}</div>
              {active.problem && <div className="mt-1 text-xs">📝 {active.problem}</div>}
            </div>
            {pos && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border p-2">
                  <div className="text-xs text-muted-foreground">Distance</div>
                  <div className="font-bold">{haversineKm(pos, { lat: active.customer_lat, lng: active.customer_lng }).toFixed(2)} km</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-xs text-muted-foreground">ETA</div>
                  <div className="font-bold">~{etaMinutes(haversineKm(pos, { lat: active.customer_lat, lng: active.customer_lng }))} min</div>
                </div>
              </div>
            )}
            <Suspense fallback={<div className="h-80 rounded-xl bg-muted" />}>
              <TrackingMap customer={{ lat: active.customer_lat, lng: active.customer_lng }} technician={pos} />
            </Suspense>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => updateStatus("on_the_way")} variant={active.status === "on_the_way" ? "default" : "outline"}>
                <Navigation className="mr-1 h-4 w-4" /> On the way
              </Button>
              <Button onClick={() => updateStatus("arrived")} variant={active.status === "arrived" ? "default" : "outline"}>
                <MapPin className="mr-1 h-4 w-4" /> Arrived
              </Button>
            </div>
            <Button className="w-full" onClick={() => updateStatus("completed")}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Mark complete
            </Button>
            <p className="text-xs text-muted-foreground text-center">Your live GPS is being shared with the customer.</p>
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No active job. Ask the admin to assign you a booking.
        </Card>
      )}

      {jobs.length > 1 && (
        <div>
          <h2 className="px-1 text-sm font-semibold">Other assigned</h2>
          {jobs.filter((j) => j.id !== active?.id).map((j) => (
            <Card key={j.id} className="p-3 mt-2 text-sm">
              <div className="font-medium">{j.service_name} — {j.customer_name}</div>
              <div className="text-xs text-muted-foreground">{j.address}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
