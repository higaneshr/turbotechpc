import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MapPin, Clock, Route as RouteIcon, ImagePlus, X } from "lucide-react";
import { haversineKm, etaMinutes, reverseGeocode } from "@/lib/geo";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useCustomer } from "@/lib/customer-session";

const MapPicker = lazy(() => import("@/components/MapPicker").then(m => ({ default: m.MapPicker })));

export const Route = createFileRoute("/book/$serviceId")({
  component: BookPage,
});

const ORIGIN = { lat: 28.6139, lng: 77.209 };

function BookPage() {
  const { serviceId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const customer = useCustomer();
  const [service, setService] = useState<any>(null);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [problem, setProblem] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("services").select("*").eq("id", serviceId).single().then(({ data }) => {
      setService(data);
      if (data) setProblem(data.name);
    });
  }, [serviceId]);

  useEffect(() => {
    if (customer && !name) setName(customer.name);
    if (customer && !phone) setPhone(customer.phone);
  }, [customer]);

  useEffect(() => {
    if (loc && !address) reverseGeocode(loc.lat, loc.lng).then(setAddress);
  }, [loc, address]);

  const distance = loc ? haversineKm(ORIGIN, loc) : 0;
  const eta = loc ? etaMinutes(distance) : 0;

  const onPhotoChange = (f: File | null) => {
    if (!f) { setPhotoFile(null); setPhotoPreview(""); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5 MB"); return; }
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!loc || !service) { toast.error("Please pin your location"); return; }
    if (!name.trim() || !phone.trim() || !address.trim()) {
      toast.error("Name, phone, and address are required");
      return;
    }
    setSubmitting(true);
    try {
      let house_photo_url: string | null = null;
      if (photoFile) {
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${photoFile.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("house-photos").upload(path, photoFile, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("house-photos").getPublicUrl(path);
        house_photo_url = pub.publicUrl;
      }

      const { data, error } = await supabase
        .from("bookings")
        .insert({
          customer_id: user?.id ?? null,
          service_id: service.id,
          service_name: service.name,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          problem: problem.trim(),
          address: address.trim(),
          house_photo_url,
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
      toast.success("Booking submitted! A technician will approve shortly.");
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
      <button onClick={() => navigate({ to: "/" })} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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

        <div className="p-4 space-y-4">
          {/* Personal info */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Your name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Full name" />
            </div>
            <div>
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} placeholder="10-digit mobile" />
            </div>
            <div>
              <Label htmlFor="problem">Problem</Label>
              <Textarea id="problem" rows={2} value={problem} onChange={(e) => setProblem(e.target.value)} maxLength={500} />
              <p className="mt-1 text-[11px] text-muted-foreground">Pre-filled from selected service. Edit if needed.</p>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label>Pin your home on the map</Label>
            <Suspense fallback={<div className="h-72 rounded-xl bg-muted" />}>
              <MapPicker value={loc} onChange={(v) => { setLoc(v); setAddress(""); }} />
            </Suspense>
            <Label htmlFor="address" className="mt-2 block">Home address</Label>
            <Textarea id="address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Flat / building / street / landmark…" />
          </div>

          {/* House photo */}
          <div className="space-y-2">
            <Label>House photo <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            {photoPreview ? (
              <div className="relative h-44 w-full overflow-hidden rounded-xl border">
                <img src={photoPreview} alt="House" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onPhotoChange(null)}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  aria-label="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-32 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 text-sm text-muted-foreground hover:border-primary hover:text-primary"
              >
                <ImagePlus className="h-5 w-5" /> Add a photo of your house
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)}
            />
            <p className="text-[11px] text-muted-foreground">Helps the technician find your home faster.</p>
          </div>

          {/* Summary */}
          {loc && (
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
          )}

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
      </Card>
    </div>
  );
}
