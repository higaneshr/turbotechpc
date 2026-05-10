import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Navigation, MapPin, Phone, CheckCircle2, Plus, Trash2, KeyRound, Power } from "lucide-react";
import { haversineKm, etaMinutes } from "@/lib/geo";
import { NotificationsPanel } from "@/components/NotificationsPanel";

const TrackingMap = lazy(() => import("@/components/TrackingMap").then((m) => ({ default: m.TrackingMap })));

export const Route = createFileRoute("/technician")({
  component: TechPage,
});

type InvoiceItem = { label: string; amount: number };

function TechPage() {
  const { user, profile, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const uid = user?.id;
  const [jobs, setJobs] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [sharing, setSharing] = useState(true);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate({ to: "/auth", search: { redirect: "/technician" } });
  }, [authLoading, user, navigate]);

  const load = async () => {
    if (!uid) return;
    const [{ data: mine }, { data: pend }] = await Promise.all([
      supabase.from("bookings").select("*").eq("technician_id", uid)
        .in("status", ["accepted", "on_the_way", "arrived", "in_progress"])
        .order("created_at", { ascending: false }),
      supabase.from("bookings").select("*").eq("status", "pending").is("technician_id", null)
        .order("created_at", { ascending: false }),
    ]);
    setJobs(mine ?? []);
    setPending(pend ?? []);
    const cur = (mine ?? []).find((j: any) => ["accepted", "on_the_way", "arrived", "in_progress"].includes(j.status));
    setActive(cur ?? null);
    if (cur) setSharing(cur.location_sharing !== false);
  };

  useEffect(() => { load(); }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`tech-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid]);

  useEffect(() => {
    if (!active || !uid || !sharing) {
      if (watchId.current !== null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
      return;
    }
    if (!navigator.geolocation) { toast.error("Geolocation unsupported"); return; }
    let lastSent = 0;
    watchId.current = navigator.geolocation.watchPosition(
      async (p) => {
        const { latitude: lat, longitude: lng } = p.coords;
        setPos({ lat, lng });
        const now = Date.now();
        if (now - lastSent < 4000) return;
        lastSent = now;
        await supabase.from("bookings").update({ technician_lat: lat, technician_lng: lng }).eq("id", active.id);
      },
      (err) => toast.error("Location error: " + err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    return () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); };
  }, [active, uid, sharing]);

  const approve = async (b: any) => {
    if (!uid || !profile) return;
    const { error } = await supabase.from("bookings")
      .update({ technician_id: uid, technician_phone: profile.phone, status: "accepted" })
      .eq("id", b.id).eq("status", "pending");
    if (error) toast.error(error.message); else toast.success("Booking approved");
  };

  const updateBooking = async (patch: any) => {
    if (!active) return;
    const { error } = await supabase.from("bookings").update(patch).eq("id", active.id);
    if (error) toast.error(error.message);
  };

  const toggleSharing = async (next: boolean) => {
    setSharing(next);
    await updateBooking({ location_sharing: next });
    toast.success(next ? "Live location resumed" : "Live location paused");
  };

  if (authLoading || !user) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (role !== "technician" && role !== "admin") {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-muted-foreground">You're not assigned as a technician. Ask the admin to grant access.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Technician Dashboard</h1>
        <NotificationsPanel role="technician" />
      </div>

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
              <a href={`tel:${active.customer_phone}`} className="flex items-center gap-1 text-primary">
                <Phone className="h-3.5 w-3.5" /> {active.customer_phone}
              </a>
              <div className="mt-1 text-xs text-muted-foreground">{active.address}</div>
              {active.problem && <div className="mt-1 text-xs">📝 {active.problem}</div>}
            </div>

            {active.house_photo_url && (
              <a href={active.house_photo_url} target="_blank" rel="noreferrer" className="block">
                <img src={active.house_photo_url} alt="House" className="h-44 w-full rounded-lg border object-cover" />
              </a>
            )}

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

            <div className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <Power className={`h-4 w-4 ${sharing ? "text-success" : "text-muted-foreground"}`} />
                <div>
                  <div className="text-sm font-semibold">Share live location</div>
                  <div className="text-[11px] text-muted-foreground">{sharing ? "Customer can see you on the map" : "Paused — customer cannot see your location"}</div>
                </div>
              </div>
              <Switch checked={sharing} onCheckedChange={toggleSharing} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => updateBooking({ status: "on_the_way" })} variant={active.status === "on_the_way" ? "default" : "outline"}>
                <Navigation className="mr-1 h-4 w-4" /> On the way
              </Button>
              <ArrivalOtpButton booking={active} />
            </div>

            <Button
              onClick={() => updateBooking({ status: "in_progress", process_started_at: new Date().toISOString() })}
              variant={active.status === "in_progress" ? "default" : "outline"}
              className="w-full"
              disabled={active.status !== "arrived" && active.status !== "in_progress"}
            >
              🔧 Process started
            </Button>

            <InvoiceEditor booking={active} />

            <Button className="w-full" onClick={() => updateBooking({ status: "completed" })}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Mark job completed
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No active job. Approve a request below to get started.
        </Card>
      )}

      <div>
        <h2 className="px-1 text-sm font-semibold">Pending requests ({pending.length})</h2>
        {pending.length === 0 && (
          <Card className="mt-2 p-4 text-center text-xs text-muted-foreground">No pending requests right now.</Card>
        )}
        {pending.map((j) => (
          <Card key={j.id} className="mt-2 p-3 text-sm">
            <div className="flex items-start gap-3">
              {j.house_photo_url && (
                <img src={j.house_photo_url} alt="House" className="h-16 w-16 shrink-0 rounded-lg border object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium">{j.service_name} — {j.customer_name}</div>
                <a href={`tel:${j.customer_phone}`} className="text-xs text-primary">{j.customer_phone}</a>
                <div className="truncate text-xs text-muted-foreground">{j.address}</div>
                {j.problem && <div className="mt-0.5 truncate text-xs italic">"{j.problem}"</div>}
              </div>
              <Button size="sm" onClick={() => approve(j)} disabled={!!active}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ArrivalOtpButton({ booking }: { booking: any }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const arrived = booking.status === "arrived" || booking.status === "in_progress" || booking.status === "completed";

  const verify = async () => {
    if (!booking.arrival_otp) return toast.error("No OTP set yet");
    if (code.trim() !== String(booking.arrival_otp).trim()) return toast.error("Incorrect OTP");
    const { error } = await supabase.from("bookings")
      .update({ status: "arrived", arrived_at: new Date().toISOString() })
      .eq("id", booking.id);
    if (error) return toast.error(error.message);
    toast.success("Arrival verified");
    setOpen(false);
  };

  if (arrived) {
    return <Button variant="default" disabled><MapPin className="mr-1 h-4 w-4" /> Arrived</Button>;
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <KeyRound className="mr-1 h-4 w-4" /> Verify OTP
      </Button>
      {open && (
        <div className="col-span-2 rounded-xl border bg-card p-3 space-y-2">
          <Label className="text-xs">Ask the customer for the 4-digit OTP shown on their tracking page.</Label>
          <Input inputMode="numeric" maxLength={4} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••"
            className="text-center text-xl tracking-[0.5em]" />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={verify}>Confirm arrival</Button>
          </div>
        </div>
      )}
    </>
  );
}

function InvoiceEditor({ booking }: { booking: any }) {
  const [items, setItems] = useState<InvoiceItem[]>(
    Array.isArray(booking.invoice_items) ? booking.invoice_items : []
  );
  const [finalPrice, setFinalPrice] = useState<string>(
    booking.final_price != null ? String(booking.final_price) : ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setItems(Array.isArray(booking.invoice_items) ? booking.invoice_items : []);
    setFinalPrice(booking.final_price != null ? String(booking.final_price) : "");
  }, [booking.id]);

  const base = Number(booking.price ?? 0);
  const itemsTotal = items.reduce((s, it) => s + Number(it.amount || 0), 0);
  const computed = base + itemsTotal;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("bookings").update({
      invoice_items: items as any,
      final_price: finalPrice === "" ? computed : Number(finalPrice),
    }).eq("id", booking.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Invoice saved");
  };

  return (
    <div className="rounded-xl border p-3 space-y-2">
      <div className="text-sm font-semibold">Invoice</div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Service base</span>
        <span>₹{base}</span>
      </div>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input placeholder="Item / part" value={it.label}
            onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
          <Input type="number" placeholder="₹" className="w-24" value={it.amount}
            onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, amount: Number(e.target.value || 0) } : x))} />
          <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setItems([...items, { label: "", amount: 0 }])}>
        <Plus className="mr-1 h-4 w-4" /> Add line
      </Button>

      <div className="my-1 h-px bg-border" />
      <div>
        <Label className="text-xs">Final price (override)</Label>
        <Input type="number" placeholder={String(computed)} value={finalPrice}
          onChange={(e) => setFinalPrice(e.target.value)} />
        <div className="mt-1 text-[11px] text-muted-foreground">Computed: ₹{computed}. Leave blank to use computed.</div>
      </div>
      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Saving…" : "Save invoice"}
      </Button>
    </div>
  );
}
