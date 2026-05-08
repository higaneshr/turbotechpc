import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Zap, AlertTriangle, MapPin } from "lucide-react";
import { haversineKm, etaMinutes, reverseGeocode } from "@/lib/geo";
import { toast } from "sonner";
import { useSession } from "@/lib/session";

const MapPicker = lazy(() => import("@/components/MapPicker").then((m) => ({ default: m.MapPicker })));

export const Route = createFileRoute("/quick-booking")({
  head: () => ({
    meta: [
      { title: "Quick Booking — Turbo Tech Agency" },
      { name: "description", content: "Book a computer technician in seconds. Just enter your name, phone, and pin your location." },
    ],
  }),
  component: QuickBookingPage,
});

const ORIGIN = { lat: 28.6139, lng: 77.209 };

function QuickBookingPage() {
  const navigate = useNavigate();
  const session = useSession();
  const customer = session?.role === "customer" ? session : null;
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [problem, setProblem] = useState("");
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (customer) { if (!name) setName(customer.name); if (!phone) setPhone(customer.phone); }
  }, [customer]);

  useEffect(() => {
    if (loc && !address) reverseGeocode(loc.lat, loc.lng).then(setAddress);
  }, [loc, address]);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) return toast.error("Name and phone are required");
    if (!loc) return toast.error("Please pin your location");
    setBusy(true);
    const distance = haversineKm(ORIGIN, loc);
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        customer_id: null,
        service_id: null,
        service_name: "Quick Booking",
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        problem: problem.trim() || "Quick booking — issue to be diagnosed on arrival",
        address: address.trim() || `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`,
        customer_lat: loc.lat,
        customer_lng: loc.lng,
        distance_km: Number(distance.toFixed(2)),
        eta_minutes: etaMinutes(distance),
        price: 0,
        status: "pending",
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Quick booking submitted! We will call you to confirm.");
    navigate({ to: "/track/$bookingId", params: { bookingId: data.id } });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b bg-accent/30 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Quick Booking</h1>
            <p className="text-xs text-muted-foreground">Fastest way to get a technician on the way.</p>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {/* Red disclaimer */}
          <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-xs leading-relaxed">
              <strong>Computer software issues only.</strong> This service covers desktop & laptop software problems.
              Hardware laptop repair is <em>not available yet</em>.
            </div>
          </div>

          <div>
            <Label htmlFor="qname">Your name</Label>
            <Input id="qname" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Full name" />
          </div>
          <div>
            <Label htmlFor="qphone">Phone number</Label>
            <Input id="qphone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} placeholder="10-digit mobile" />
          </div>
          <div>
            <Label htmlFor="qproblem">Issue (optional)</Label>
            <Textarea id="qproblem" rows={2} value={problem} onChange={(e) => setProblem(e.target.value)} maxLength={500} placeholder="Tell us in one line — or leave blank." />
          </div>

          <div>
            <Label>Pin your location</Label>
            <Suspense fallback={<div className="h-72 rounded-xl bg-muted" />}>
              <MapPicker value={loc} onChange={(v) => { setLoc(v); setAddress(""); }} />
            </Suspense>
            <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (auto-filled from map)" className="mt-2" />
          </div>

          <Button className="w-full" size="lg" onClick={submit} disabled={busy}>
            <MapPin className="mr-1 h-4 w-4" /> {busy ? "Booking…" : "Book now"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
