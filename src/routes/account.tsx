import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Phone, MessageSquare, Mail, LifeBuoy, LogOut, ListOrdered, Gift } from "lucide-react";

export const Route = createFileRoute("/account")({
  component: Account,
});

function Account() {
  const { user, profile, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { redirect: "/account" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    supabase.from("app_settings").select("key,value").then(({ data }) => {
      const o: Record<string, any> = {};
      data?.forEach((r: any) => (o[r.key] = r.value));
      setSettings(o);
    });
  }, []);

  if (loading || !user) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-md px-4 py-4 space-y-3">
      <h1 className="text-xl font-bold">Hi, {profile?.full_name || "there"}</h1>
      <Card className="p-4 space-y-1 text-sm">
        <div className="text-xs uppercase text-muted-foreground">Your account</div>
        <div className="font-medium">{profile?.full_name}</div>
        <div className="text-muted-foreground">{profile?.phone}</div>
        <div className="text-xs uppercase text-muted-foreground pt-1">Role: {role ?? "—"}</div>
        {role === "admin" && <Link to="/admin" className="block text-primary font-medium pt-1">→ Admin panel</Link>}
        {role === "technician" && <Link to="/technician" className="block text-primary font-medium pt-1">→ Technician dashboard</Link>}
      </Card>

      {role === "customer" && (
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

      <Button variant="outline" className="w-full" onClick={async () => { await signOut(); toast.success("Signed out"); navigate({ to: "/" }); }}>
        <LogOut className="mr-1 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
