import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MapPin, Clock, Route as RouteIcon } from "lucide-react";
import { haversineKm, etaMinutes, reverseGeocode } from "@/lib/geo";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const MapPicker = lazy(() => import("@/components/MapPicker").then(m => ({ default: m.MapPicker })));

export const Route = createFileRoute("/book/$serviceId")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: location.pathname } as never });
  },
  component: BookPage,
});

// Default origin for technicians (city center) — used to estimate distance pre-assignment
const ORIGIN = { lat: 28.6139, lng: 77.209 };

function BookPage() {
  const { serviceId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [service, setService] = useState<any>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [problem, setProblem] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("services").select("*").eq("id", serviceId).single().then(({ data }) => setService(data));
    supabase.from("profiles").select("full_name,phone").eq("id", user!.id).single().then(({ data }) => {
      if (data) { setName(data.full_name ?? ""); setPhone(data.phone ?? ""); }
    });
  }, [serviceId, user]);

  useEffect(() => {
    if (loc && !address) reverseGeocode(loc.lat, loc.lng).then(setAddress);
  }, [loc, address]);

  const distance = loc ? haversineKm(ORIGIN, loc) : 0;
  const eta = loc ? etaMinutes(distance) : 0;

  const submit = async () => {
    if (!loc || !service) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          customer_id: user!.id,
          service_id: service.id,
          service_name: service.name,
          customer_name: name,
          customer_phone: phone,
          problem,
          address,
          customer_lat: loc.lat,
          customer_lng: loc.lng,
          distance_km: Number(distance.toFixed(2)),
          eta_minutes: eta,
          price: service.base_price,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Booking confirmed!");
      navigate({ to: "/track/$bookingId", params: { bookingId: data.id } });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!service) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <button onClick={() => (step === 1 ? navigate({ to: "/" }) : setStep((s) => (s - 1) as never))} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card className="overflow-hidden">
        <div className="border-b bg-accent/30 p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Booking</div>
          <div className="mt-0.5 flex items-baseline justify-between">
            <h1 className="text-lg font-bold">{service.name}</h1>
            <span className="text-sm font-bold text-primary">₹{Number(service.base_price)}+</span>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex border-b bg-card text-xs">
          {["Details", "Location", "Confirm"].map((label, i) => (
            <div key={label} className={`flex-1 px-3 py-2.5 text-center font-medium ${
              step === i + 1 ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}>
              {i + 1}. {label}
            </div>
          ))}
        </div>

        <div className="p-4">
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="name">Your name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              </div>
              <div>
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
              </div>
              <div>
                <Label htmlFor="problem">Describe the problem</Label>
                <Textarea id="problem" rows={4} value={problem} onChange={(e) => setProblem(e.target.value)} maxLength={500} placeholder="e.g. PC won't boot, blue screen on startup…" />
              </div>
              <Button className="w-full" onClick={() => setStep(2)} disabled={!name || !phone || !problem}>
                Next: Pick location
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Suspense fallback={<div className="h-72 rounded-xl bg-muted" />}>
                <MapPicker value={loc} onChange={(v) => { setLoc(v); setAddress(""); }} />
              </Suspense>
              <div>
                <Label htmlFor="address">Address (editable)</Label>
                <Textarea id="address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Flat, building, street…" />
              </div>
              <Button className="w-full" onClick={() => setStep(3)} disabled={!loc}>
                Next: Review
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="rounded-xl border bg-accent/30 p-3">
                <div className="text-xs text-muted-foreground">Service</div>
                <div className="font-semibold">{service.name}</div>
                <div className="mt-2 text-xs text-muted-foreground">Address</div>
                <div className="text-sm">{address || "—"}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><RouteIcon className="h-3.5 w-3.5" /> Distance</div>
                  <div className="text-lg font-bold">{distance.toFixed(1)} km</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> ETA</div>
                  <div className="text-lg font-bold">~{eta} min</div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-card p-3">
                <div>
                  <div className="text-xs text-muted-foreground">Base charge</div>
                  <div className="text-xl font-bold">₹{Number(service.base_price)}</div>
                </div>
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <Button className="w-full" onClick={submit} disabled={submitting}>
                {submitting ? "Booking…" : "Confirm booking"}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
