import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: "/account" } as never });
  },
  component: Account,
});

function Account() {
  const { user, role, signOut } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) { setName(data.full_name ?? ""); setPhone(data.phone ?? ""); }
    });
  }, [user]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: name, phone }).eq("id", user!.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-4 space-y-3">
      <h1 className="text-xl font-bold">Account</h1>
      <Card className="p-4 space-y-3">
        <div className="text-xs text-muted-foreground">{user?.email}</div>
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} /></div>
        <Button onClick={save} disabled={saving} className="w-full">{saving ? "Saving…" : "Save"}</Button>
      </Card>
      <Card className="p-4 space-y-2 text-sm">
        <div className="text-xs uppercase text-muted-foreground">Role: {role}</div>
        {role === "admin" && <Link to="/admin" className="block text-primary font-medium">→ Admin panel</Link>}
        {role === "technician" && <Link to="/technician" className="block text-primary font-medium">→ Technician dashboard</Link>}
      </Card>
      <Button variant="outline" className="w-full" onClick={signOut}>Sign out</Button>
    </div>
  );
}
