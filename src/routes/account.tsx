import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useCustomer, setCustomer, clearCustomer } from "@/lib/customer-session";
import { toast } from "sonner";
import { Phone, MessageSquare, Mail, LifeBuoy, LogOut, ListOrdered, Gift } from "lucide-react";

export const Route = createFileRoute("/account")({
  component: Account,
});

function Account() {
  const { role, user, signOut } = useAuth();
  const customer = useCustomer();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({});

  useEffect(() => {
    supabase.from("app_settings").select("key,value").then(({ data }) => {
      const o: Record<string, any> = {};
      data?.forEach((r: any) => (o[r.key] = r.value));
      setSettings(o);
    });
  }, []);

  const signIn = async () => {
    const n = name.trim(); const p = phone.trim();
    if (n.length < 2) return toast.error("Please enter your name");
    if (p.length < 6) return toast.error("Please enter a valid phone number");
    setBusy(true);
    const { error } = await supabase.from("customers").upsert(
      { phone: p, name: n, updated_at: new Date().toISOString() }, { onConflict: "phone" }
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    setCustomer({ name: n, phone: p });
    toast.success(`Welcome, ${n}!`);
  };

  // Staff (admin/technician) view
  if (user) {
    return (
      <div className="mx-auto max-w-md px-4 py-4 space-y-3">
        <h1 className="text-xl font-bold">Staff account</h1>
        <Card className="p-4 space-y-2 text-sm">
          <div className="text-xs text-muted-foreground">{user.email}</div>
          <div className="text-xs uppercase text-muted-foreground">Role: {role}</div>
          {role === "admin" && <Link to="/admin" className="block text-primary font-medium">→ Admin panel</Link>}
          {role === "technician" && <Link to="/technician" className="block text-primary font-medium">→ Technician dashboard</Link>}
        </Card>
        <Button variant="outline" className="w-full" onClick={signOut}><LogOut className="mr-1 h-4 w-4" /> Sign out</Button>
      </div>
    );
  }

  // Customer signed in
  if (customer) {
    return (
      <div className="mx-auto max-w-md px-4 py-4 space-y-3">
        <h1 className="text-xl font-bold">Hi, {customer.name}</h1>
        <Card className="p-4 space-y-1 text-sm">
          <div className="text-xs uppercase text-muted-foreground">Your account</div>
          <div className="font-medium">{customer.name}</div>
          <div className="text-muted-foreground">{customer.phone}</div>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Link to="/bookings" className="rounded-xl border bg-card p-3 text-sm font-medium flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-primary" /> My bookings
          </Link>
          <Link to="/rewards" className="rounded-xl border bg-card p-3 text-sm font-medium flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" /> Rewards
          </Link>
        </div>

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

        <Button variant="outline" className="w-full" onClick={() => { clearCustomer(); toast.success("Signed out"); }}>
          <LogOut className="mr-1 h-4 w-4" /> Sign out
        </Button>

        <div className="pt-4 text-center">
          <Link to="/auth" search={{ redirect: "/account" } as never} className="text-xs text-muted-foreground underline">Staff sign in</Link>
        </div>
      </div>
    );
  }

  // Sign-in form
  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Just your name and phone — no OTP, no password.</p>
      </div>
      <Card className="p-5 space-y-3">
        <div>
          <Label htmlFor="n">Your name</Label>
          <Input id="n" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Full name" />
        </div>
        <div>
          <Label htmlFor="p">Phone number</Label>
          <Input id="p" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} placeholder="10-digit mobile" />
        </div>
        <Button className="w-full" onClick={signIn} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      </Card>
      <div className="text-center">
        <Link to="/auth" search={{ redirect: "/account" } as never} className="text-xs text-muted-foreground underline">Staff sign in</Link>
      </div>
    </div>
  );
}
