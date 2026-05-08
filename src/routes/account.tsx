import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession, setSession, clearSession, ADMIN_PHONE, ADMIN_OTP, TEST_OTP } from "@/lib/session";
import { toast } from "sonner";
import { Phone, MessageSquare, Mail, LifeBuoy, LogOut, ListOrdered, Gift, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/account")({
  component: Account,
});

type Step = "phone" | "otp" | "name";

function Account() {
  const session = useSession();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingRole, setPendingRole] = useState<"admin" | "technician" | "customer">("customer");
  const [existingName, setExistingName] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});

  useEffect(() => {
    supabase.from("app_settings").select("key,value").then(({ data }) => {
      const o: Record<string, any> = {};
      data?.forEach((r: any) => (o[r.key] = r.value));
      setSettings(o);
    });
  }, []);

  const sendOtp = async () => {
    const p = phone.trim();
    if (p.length < 6) return toast.error("Please enter a valid phone number");
    setBusy(true);
    // Insert an OTP record. For the demo, the OTP is the universal test code.
    // (Real SMS delivery is not configured yet.)
    await supabase.from("otp_codes").insert({ phone: p, code: TEST_OTP });
    setBusy(false);
    setStep("otp");
    toast.success("OTP sent. Use 2345 for testing.");
  };

  const verifyOtp = async () => {
    const p = phone.trim();
    const code = otp.trim();
    if (!code) return toast.error("Enter the OTP");

    // Admin shortcut
    if (p === ADMIN_PHONE) {
      if (code !== ADMIN_OTP) return toast.error("Incorrect OTP");
      setSession({ phone: p, name: "Admin", role: "admin" });
      toast.success("Welcome, Admin");
      return;
    }

    if (code !== TEST_OTP) return toast.error("Incorrect OTP");

    // Determine role
    setBusy(true);
    const [{ data: tech }, { data: cust }] = await Promise.all([
      supabase.from("technicians").select("phone, full_name").eq("phone", p).maybeSingle(),
      supabase.from("customers").select("phone, name").eq("phone", p).maybeSingle(),
    ]);
    setBusy(false);

    if (tech) {
      setSession({ phone: p, name: tech.full_name, role: "technician" });
      toast.success(`Welcome, ${tech.full_name}`);
      return;
    }

    if (cust) {
      setSession({ phone: p, name: cust.name, role: "customer" });
      toast.success(`Welcome back, ${cust.name}`);
      return;
    }

    // New customer — ask for name
    setExistingName(null);
    setPendingRole("customer");
    setStep("name");
  };

  const finishSignup = async () => {
    const n = name.trim();
    if (n.length < 2) return toast.error("Please enter your name");
    setBusy(true);
    const { error } = await supabase.from("customers").upsert(
      { phone: phone.trim(), name: n, updated_at: new Date().toISOString() },
      { onConflict: "phone" }
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    setSession({ phone: phone.trim(), name: n, role: "customer" });
    toast.success(`Welcome, ${n}!`);
  };

  // Signed-in views
  if (session) {
    return (
      <div className="mx-auto max-w-md px-4 py-4 space-y-3">
        <h1 className="text-xl font-bold">Hi, {session.name}</h1>
        <Card className="p-4 space-y-1 text-sm">
          <div className="text-xs uppercase text-muted-foreground">Your account</div>
          <div className="font-medium">{session.name}</div>
          <div className="text-muted-foreground">{session.phone}</div>
          <div className="text-xs uppercase text-muted-foreground pt-1">Role: {session.role}</div>
          {session.role === "admin" && <Link to="/admin" className="block text-primary font-medium pt-1">→ Admin panel</Link>}
          {session.role === "technician" && <Link to="/technician" className="block text-primary font-medium pt-1">→ Technician dashboard</Link>}
        </Card>

        {session.role === "customer" && (
          <div className="grid grid-cols-2 gap-2">
            <Link to="/bookings" className="rounded-xl border bg-card p-3 text-sm font-medium flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-primary" /> My bookings
            </Link>
            <Link to="/rewards" className="rounded-xl border bg-card p-3 text-sm font-medium flex items-center gap-2">
              <Gift className="h-4 w-4 text-primary" /> Rewards
            </Link>
          </div>
        )}

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><LifeBuoy className="h-4 w-4 text-primary" /> Support</div>
          {settings.support_phone_enabled !== false && settings.support_phone && (
            <a href={`tel:${settings.support_phone}`} className="flex items-center gap-2 text-sm text-primary"><Phone className="h-4 w-4" /> {settings.support_phone}</a>
          )}
          {settings.support_whatsapp_enabled !== false && settings.support_whatsapp && (
            <a href={`https://wa.me/${String(settings.support_whatsapp).replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary"><MessageSquare className="h-4 w-4" /> {settings.support_whatsapp}</a>
          )}
          {settings.support_email_enabled !== false && settings.support_email && (
            <a href={`mailto:${settings.support_email}`} className="flex items-center gap-2 text-sm text-primary"><Mail className="h-4 w-4" /> {settings.support_email}</a>
          )}
          {settings.support_ticket_enabled !== false && (
            <Link to="/support" className="block text-sm text-primary">→ Raise a ticket</Link>
          )}
        </Card>

        <Button variant="outline" className="w-full" onClick={() => { clearSession(); toast.success("Signed out"); setStep("phone"); setPhone(""); setOtp(""); setName(""); }}>
          <LogOut className="mr-1 h-4 w-4" /> Sign out
        </Button>
      </div>
    );
  }

  // Sign-in flow
  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Phone number + OTP — no password.</p>
      </div>

      {step === "phone" && (
        <Card className="p-5 space-y-3">
          <div>
            <Label htmlFor="p">Phone number</Label>
            <Input id="p" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} placeholder="10-digit mobile" autoFocus />
          </div>
          <Button className="w-full" onClick={sendOtp} disabled={busy}>{busy ? "Sending…" : "Get OTP"}</Button>
        </Card>
      )}

      {step === "otp" && (
        <Card className="p-5 space-y-3">
          <button type="button" onClick={() => setStep("phone")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Change number
          </button>
          <div>
            <Label htmlFor="o">Enter OTP sent to {phone}</Label>
            <Input id="o" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} placeholder="OTP" autoFocus />
            <p className="mt-1 text-[11px] text-muted-foreground">Demo OTP: 2345</p>
          </div>
          <Button className="w-full" onClick={verifyOtp} disabled={busy}>{busy ? "Verifying…" : "Sign in"}</Button>
        </Card>
      )}

      {step === "name" && (
        <Card className="p-5 space-y-3">
          <div>
            <Label htmlFor="n">Your name</Label>
            <Input id="n" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Full name" autoFocus />
            <p className="mt-1 text-[11px] text-muted-foreground">First time here — tell us your name to finish signing up.</p>
          </div>
          <Button className="w-full" onClick={finishSignup} disabled={busy}>{busy ? "Saving…" : "Continue"}</Button>
        </Card>
      )}
    </div>
  );
}
