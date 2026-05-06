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
import { NotificationsPanel } from "@/components/NotificationsPanel";

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
    const { error } = await supabase.from("bookings").update({ status: status as any }).eq("id", id);
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <NotificationsPanel role="admin" />
      </div>

      <Tabs defaultValue="bookings">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="bookings">Bookings ({bookings.length})</TabsTrigger>
          <TabsTrigger value="techs">Technicians</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="space-y-2">
          {bookings.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">No bookings yet.</Card>}
          {bookings.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  {b.house_photo_url && (
                    <a href={b.house_photo_url} target="_blank" rel="noreferrer">
                      <img src={b.house_photo_url} alt="House" className="h-20 w-20 rounded-lg border object-cover" />
                    </a>
                  )}
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

        <TabsContent value="support" className="space-y-3">
          <SupportSettings settings={settings} setSettings={setSettings} saveSetting={saveSetting} />
        </TabsContent>

        <TabsContent value="rewards" className="space-y-3">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <Label className="font-semibold">Rewards system</Label>
              <p className="text-xs text-muted-foreground">Show rewards page to customers</p>
            </div>
            <Switch checked={settings.rewards_enabled !== false} onCheckedChange={(v) => saveSetting("rewards_enabled", v)} />
          </Card>
          <RewardCatalog />
        </TabsContent>

        <TabsContent value="tickets" className="space-y-3">
          <TicketsList />
          <RedemptionsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SupportSettings({ settings, setSettings, saveSetting }: { settings: any; setSettings: any; saveSetting: (k: string, v: any) => void }) {
  const rows = [
    { key: "support_phone", toggle: "support_phone_enabled", label: "Phone Support", placeholder: "+91 9944998946" },
    { key: "support_whatsapp", toggle: "support_whatsapp_enabled", label: "WhatsApp Support", placeholder: "+91 9944998946" },
    { key: "support_email", toggle: "support_email_enabled", label: "Email Support", placeholder: "support@turbotech.in" },
  ];
  return (
    <>
      <Card className="p-4 flex items-center justify-between">
        <div>
          <Label className="font-semibold">Ticket Support</Label>
          <p className="text-xs text-muted-foreground">Allow customers to raise tickets</p>
        </div>
        <Switch checked={settings.support_ticket_enabled !== false} onCheckedChange={(v) => saveSetting("support_ticket_enabled", v)} />
      </Card>
      {rows.map((r) => (
        <Card key={r.key} className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">{r.label}</Label>
            <Switch checked={settings[r.toggle] !== false} onCheckedChange={(v) => saveSetting(r.toggle, v)} />
          </div>
          <Input
            value={settings[r.key] ?? ""}
            placeholder={r.placeholder}
            onChange={(e) => setSettings((s: any) => ({ ...s, [r.key]: e.target.value }))}
            onBlur={(e) => saveSetting(r.key, e.target.value)}
            maxLength={120}
          />
        </Card>
      ))}
    </>
  );
}

function RewardCatalog() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [coins, setCoins] = useState("");
  const load = () => supabase.from("reward_items").select("*").order("coins_required").then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!name.trim() || !coins) return;
    const { error } = await supabase.from("reward_items").insert({ name: name.trim(), coins_required: Number(coins) });
    if (error) return toast.error(error.message);
    setName(""); setCoins(""); load();
  };
  const update = async (id: string, patch: any) => {
    const { error } = await supabase.from("reward_items").update(patch).eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const del = async (id: string) => {
    if (!confirm("Delete this reward?")) return;
    const { error } = await supabase.from("reward_items").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Reward catalog</h3>
      <div className="flex flex-wrap gap-2">
        <Input className="flex-1 min-w-[180px]" placeholder="Reward name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Input className="w-28" type="number" placeholder="Coins" value={coins} onChange={(e) => setCoins(e.target.value)} />
        <Button onClick={add}>Add</Button>
      </div>
      <div className="divide-y">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2 py-2">
            <Input className="flex-1" defaultValue={it.name} onBlur={(e) => e.target.value !== it.name && update(it.id, { name: e.target.value })} />
            <Input className="w-24" type="number" defaultValue={it.coins_required} onBlur={(e) => Number(e.target.value) !== it.coins_required && update(it.id, { coins_required: Number(e.target.value) })} />
            <Switch checked={it.available} onCheckedChange={(v) => update(it.id, { available: v })} />
            <Button size="sm" variant="ghost" onClick={() => del(it.id)}>✕</Button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground py-2">No rewards yet.</p>}
      </div>
    </Card>
  );
}

function TicketsList() {
  const [tickets, setTickets] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).then(({ data }) => setTickets(data ?? []));
  }, []);
  const setStatus = async (id: string, status: string) => {
    await supabase.from("support_tickets").update({ status }).eq("id", id);
    setTickets((t) => t.map((x) => x.id === id ? { ...x, status } : x));
  };
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-2">Support tickets ({tickets.length})</h3>
      {tickets.length === 0 && <p className="text-xs text-muted-foreground">No tickets.</p>}
      <div className="space-y-2">
        {tickets.map((t) => (
          <div key={t.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-sm">{t.subject}</div>
              <Badge variant={t.status === "open" ? "default" : "secondary"}>{t.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">{t.customer_name} • {t.customer_phone}</div>
            <div className="mt-1 text-sm whitespace-pre-wrap">{t.message}</div>
            <div className="mt-2 flex gap-1">
              {t.status !== "resolved" && <Button size="sm" variant="outline" onClick={() => setStatus(t.id, "resolved")}>Mark resolved</Button>}
              {t.status !== "open" && <Button size="sm" variant="ghost" onClick={() => setStatus(t.id, "open")}>Reopen</Button>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RedemptionsList() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("redemptions").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  }, []);
  const setStatus = async (id: string, status: string) => {
    await supabase.from("redemptions").update({ status }).eq("id", id);
    setItems((t) => t.map((x) => x.id === id ? { ...x, status } : x));
  };
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-2">Reward redemptions ({items.length})</h3>
      {items.length === 0 && <p className="text-xs text-muted-foreground">None yet.</p>}
      <div className="space-y-2">
        {items.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <div>
              <div className="font-medium">{r.reward_name} <span className="text-xs text-muted-foreground">• {r.coins_spent} coins</span></div>
              <div className="text-xs text-muted-foreground">{r.customer_phone}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={r.status === "fulfilled" ? "default" : "secondary"}>{r.status}</Badge>
              {r.status !== "fulfilled" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "fulfilled")}>Mark fulfilled</Button>}
            </div>
          </div>
        ))}
      </div>
    </Card>
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
