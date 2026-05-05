import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: "/admin" } as never });
  },
  component: AdminPage,
});

const STATUSES = ["pending", "accepted", "on_the_way", "arrived", "completed", "cancelled"];

function AdminPage() {
  const { role } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [techs, setTechs] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [newTechEmail, setNewTechEmail] = useState("");

  const loadAll = async () => {
    const [b, t, s] = await Promise.all([
      supabase.from("bookings").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role, profiles!inner(full_name, phone)").eq("role", "technician"),
      supabase.from("app_settings").select("key, value"),
    ]);
    setBookings(b.data ?? []);
    setTechs((t.data as any) ?? []);
    const o: Record<string, any> = {};
    s.data?.forEach((r: any) => (o[r.key] = r.value));
    setSettings(o);
  };

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel("admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (role && role !== "admin") {
    return <div className="mx-auto max-w-md p-6 text-center text-sm text-muted-foreground">Admin access required.</div>;
  }

  const assign = async (bookingId: string, technician_id: string) => {
    const { error } = await supabase.from("bookings").update({ technician_id, status: "accepted" }).eq("id", bookingId);
    if (error) toast.error(error.message); else toast.success("Assigned");
  };
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else toast.success(status);
  };
  const saveSetting = async (key: string, value: any) => {
    setSettings((s) => ({ ...s, [key]: value }));
    const { error } = await supabase.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) toast.error(error.message);
  };

  const promoteToTech = async () => {
    if (!newTechEmail) return;
    const { data: profs } = await supabase.from("profiles").select("id").limit(1000);
    // We can't query auth.users; instead promote by user id input is complex.
    // Simpler approach: prompt for an existing user id from profiles list — see below table. Removed inline lookup.
    toast.message("Find user ID below and use the inline 'Make technician' button.");
    setNewTechEmail("");
    void profs;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 space-y-4">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      <Tabs defaultValue="bookings">
        <TabsList>
          <TabsTrigger value="bookings">Bookings ({bookings.length})</TabsTrigger>
          <TabsTrigger value="techs">Technicians</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="space-y-2">
          {bookings.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">No bookings yet.</Card>}
          {bookings.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{b.service_name}</div>
                    <Badge variant="secondary">{b.status}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{b.customer_name} • {b.customer_phone}</div>
                  <div className="text-xs text-muted-foreground">{b.address}</div>
                  <div className="mt-1 text-xs">📍 {Number(b.customer_lat).toFixed(4)}, {Number(b.customer_lng).toFixed(4)} • {b.distance_km} km • ~{b.eta_minutes} min</div>
                  {b.problem && <div className="mt-1 text-xs italic">"{b.problem}"</div>}
                </div>
                <div className="flex flex-col gap-2 min-w-[180px]">
                  <Select value={b.technician_id ?? ""} onValueChange={(v) => assign(b.id, v)}>
                    <SelectTrigger><SelectValue placeholder="Assign technician…" /></SelectTrigger>
                    <SelectContent>
                      {techs.map((t: any) => (
                        <SelectItem key={t.user_id} value={t.user_id}>{t.profiles?.full_name ?? t.user_id.slice(0, 8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={b.status} onValueChange={(v) => setStatus(b.id, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="techs" className="space-y-3">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Promote a user to technician</h3>
            <p className="text-xs text-muted-foreground mb-2">Find a user below and click <b>Make technician</b>. The user must have signed up first.</p>
          </Card>
          <UsersList onChange={loadAll} />
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Current technicians ({techs.length})</h3>
            {techs.map((t: any) => (
              <div key={t.user_id} className="flex items-center justify-between border-b py-2 last:border-0">
                <div className="text-sm">{t.profiles?.full_name ?? t.user_id.slice(0, 8)} <span className="text-xs text-muted-foreground">{t.profiles?.phone}</span></div>
                <Button size="sm" variant="ghost" onClick={async () => {
                  await supabase.from("user_roles").delete().eq("user_id", t.user_id).eq("role", "technician");
                  toast.success("Removed");
                  loadAll();
                }}>Remove</Button>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-3">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <Label className="font-semibold">Rewards system</Label>
              <p className="text-xs text-muted-foreground">Show rewards page to customers</p>
            </div>
            <Switch checked={settings.rewards_enabled !== false} onCheckedChange={(v) => saveSetting("rewards_enabled", v)} />
          </Card>
          <Card className="p-4 space-y-2">
            <Label className="font-semibold">Support type</Label>
            <Select value={settings.support_type ?? "phone"} onValueChange={(v) => saveSetting("support_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
                <SelectItem value="ticket">Ticket</SelectItem>
              </SelectContent>
            </Select>
            <Label>Support phone number</Label>
            <Input value={settings.support_phone ?? ""} onChange={(e) => setSettings((s) => ({ ...s, support_phone: e.target.value }))}
              onBlur={(e) => saveSetting("support_phone", e.target.value)} maxLength={30} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsersList({ onChange }: { onChange: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("id, full_name, phone, user_roles(role)").then(({ data }) => setUsers(data ?? []));
  }, []);
  const promote = async (uid: string, role: "technician" | "admin") => {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) toast.error(error.message); else { toast.success("Granted " + role); onChange(); }
  };
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-2">All users ({users.length})</h3>
      <div className="divide-y">
        {users.map((u) => {
          const roles = (u.user_roles ?? []).map((r: any) => r.role);
          return (
            <div key={u.id} className="flex items-center justify-between py-2">
              <div className="text-sm">
                <div className="font-medium">{u.full_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{u.phone} • {roles.join(", ") || "customer"}</div>
              </div>
              <div className="flex gap-1">
                {!roles.includes("technician") && <Button size="sm" variant="outline" onClick={() => promote(u.id, "technician")}>Make tech</Button>}
                {!roles.includes("admin") && <Button size="sm" variant="ghost" onClick={() => promote(u.id, "admin")}>Make admin</Button>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
