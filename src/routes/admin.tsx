import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/lib/session";
import { toast } from "sonner";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { RejectDialog } from "@/components/RejectDialog";
import { Trash2, Plus, Wrench } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const STATUSES = ["pending", "accepted", "on_the_way", "arrived", "in_progress", "completed", "cancelled", "rejected"];
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending callback", accepted: "Approved", on_the_way: "On the way",
  arrived: "Arrived", in_progress: "Repair started", completed: "Completed",
  cancelled: "Cancelled", rejected: "Rejected",
};

function AdminPage() {
  const session = useSession();
  const role = session?.role;
  const [bookings, setBookings] = useState<any[]>([]);
  const [techs, setTechs] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});

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
    const ch = supabase.channel("admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (role && role !== "admin") {
    return <div className="mx-auto max-w-md p-6 text-center text-sm text-muted-foreground">Admin access required.</div>;
  }

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("bookings").update({ status: status as any }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Status: " + STATUS_LABEL[status]);
  };
  const assign = async (bookingId: string, technician_id: string) => {
    const { error } = await supabase.from("bookings").update({ technician_id, status: "accepted" }).eq("id", bookingId);
    if (error) toast.error(error.message); else toast.success("Assigned & approved");
  };
  const saveSetting = async (key: string, value: any) => {
    setSettings((s) => ({ ...s, [key]: value }));
    const { error } = await supabase.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) toast.error(error.message);
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
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="techs">Technicians</TabsTrigger>
          <TabsTrigger value="site">Site</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="space-y-2">
          {bookings.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">No bookings yet.</Card>}
          {bookings.map((b) => <BookingRow key={b.id} b={b} techs={techs} onAssign={assign} onStatus={setStatus} onReload={loadAll} />)}
        </TabsContent>

        <TabsContent value="services"><ServicesAdmin /></TabsContent>

        <TabsContent value="techs" className="space-y-3">
          <AddTechnician onCreated={loadAll} />
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Current technicians ({techs.length})</h3>
            {techs.map((t: any) => (
              <div key={t.user_id} className="flex items-center justify-between border-b py-2 last:border-0">
                <div className="text-sm">
                  <div className="font-medium">{t.profiles?.full_name ?? t.user_id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">{t.profiles?.phone}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!confirm("Remove this technician's access?")) return;
                  const { error } = await supabase.functions.invoke("admin-staff", { body: { action: "remove_technician", user_id: t.user_id } });
                  if (error) toast.error(error.message); else { toast.success("Removed"); loadAll(); }
                }}>Remove</Button>
              </div>
            ))}
            {techs.length === 0 && <p className="text-xs text-muted-foreground">No technicians yet.</p>}
          </Card>
          <UsersList onChange={loadAll} />
        </TabsContent>

        <TabsContent value="site" className="space-y-3">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold flex items-center gap-1"><Wrench className="h-4 w-4" /> Maintenance mode</Label>
                <p className="text-xs text-muted-foreground">When ON, customers see a maintenance page and cannot book.</p>
              </div>
              <Switch checked={settings.maintenance_mode === true} onCheckedChange={(v) => saveSetting("maintenance_mode", v)} />
            </div>
            <div>
              <Label>Maintenance message</Label>
              <Textarea
                rows={3}
                value={settings.maintenance_message ?? ""}
                onChange={(e) => setSettings((s: any) => ({ ...s, maintenance_message: e.target.value }))}
                onBlur={(e) => saveSetting("maintenance_message", e.target.value)}
                maxLength={300}
              />
            </div>
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

function BookingRow({ b, techs, onAssign, onStatus, onReload }: any) {
  const [openReject, setOpenReject] = useState(false);
  return (
    <Card className="p-4">
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
              <Badge variant={b.status === "rejected" ? "destructive" : "secondary"}>{STATUS_LABEL[b.status] ?? b.status}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">{b.customer_name} • {b.customer_phone}</div>
            <div className="text-xs text-muted-foreground">{b.address}</div>
            <div className="mt-1 text-xs">📍 {Number(b.customer_lat).toFixed(4)}, {Number(b.customer_lng).toFixed(4)} • {b.distance_km} km • ~{b.eta_minutes} min</div>
            {b.problem && <div className="mt-1 text-xs italic">"{b.problem}"</div>}
            {b.rejection_reason && <div className="mt-1 text-xs text-destructive">Rejected: {b.rejection_reason}</div>}
          </div>
        </div>
        <div className="flex flex-col gap-2 min-w-[200px]">
          <Select value={b.technician_id ?? ""} onValueChange={(v) => onAssign(b.id, v)}>
            <SelectTrigger><SelectValue placeholder="Assign technician…" /></SelectTrigger>
            <SelectContent>
              {techs.map((t: any) => (
                <SelectItem key={t.user_id} value={t.user_id}>{t.profiles?.full_name ?? t.user_id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={b.status} onValueChange={(v) => onStatus(b.id, v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
          </Select>
          {b.status === "arrived" && (
            <Button size="sm" onClick={() => onStatus(b.id, "in_progress")}>🔧 Mark "Repair started"</Button>
          )}
          {b.status !== "rejected" && b.status !== "completed" && b.status !== "cancelled" && (
            <Button size="sm" variant="destructive" onClick={() => setOpenReject(true)}>Reject…</Button>
          )}
        </div>
      </div>
      <RejectDialog open={openReject} onOpenChange={setOpenReject} title="Reject booking"
        onConfirm={async (reason) => {
          const { error } = await supabase.from("bookings").update({ status: "rejected" as any, rejection_reason: reason }).eq("id", b.id);
          if (error) toast.error(error.message); else { toast.success("Booking rejected"); onReload(); }
        }} />
    </Card>
  );
}

function ServicesAdmin() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState(""); const [price, setPrice] = useState(""); const [desc, setDesc] = useState(""); const [icon, setIcon] = useState("wrench");
  const load = () => supabase.from("services").select("*").order("sort_order").then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!name.trim() || !price) return toast.error("Name and price required");
    const { error } = await supabase.from("services").insert({
      name: name.trim(), description: desc.trim() || null, base_price: Number(price), icon,
      sort_order: items.length, available: true, coming_soon: false,
    });
    if (error) return toast.error(error.message);
    setName(""); setPrice(""); setDesc(""); load();
  };
  const upd = async (id: string, patch: any) => {
    const { error } = await supabase.from("services").update(patch).eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const del = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Services</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input placeholder="Service name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Input placeholder="Base price ₹" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} />
        <Input placeholder="Icon (wrench, monitor, download, disc, shield, laptop, cpu)" value={icon} onChange={(e) => setIcon(e.target.value)} />
      </div>
      <Button onClick={add}><Plus className="mr-1 h-4 w-4" /> Add service</Button>
      <div className="divide-y">
        {items.map((s) => (
          <div key={s.id} className="grid gap-2 py-2 sm:grid-cols-[1fr_100px_120px_auto_auto_auto]">
            <Input defaultValue={s.name} onBlur={(e) => e.target.value !== s.name && upd(s.id, { name: e.target.value })} />
            <Input type="number" defaultValue={s.base_price} onBlur={(e) => Number(e.target.value) !== s.base_price && upd(s.id, { base_price: Number(e.target.value) })} />
            <Input defaultValue={s.icon ?? ""} onBlur={(e) => e.target.value !== s.icon && upd(s.id, { icon: e.target.value })} />
            <label className="flex items-center gap-1 text-xs"><Switch checked={s.available} onCheckedChange={(v) => upd(s.id, { available: v })} /> avail</label>
            <label className="flex items-center gap-1 text-xs"><Switch checked={s.coming_soon} onCheckedChange={(v) => upd(s.id, { coming_soon: v })} /> soon</label>
            <Button size="sm" variant="ghost" onClick={() => del(s.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AddTechnician({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [full_name, setName] = useState(""); const [phone, setPhone] = useState(""); const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!email || !password || !full_name) return toast.error("Email, password and name required");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-staff", {
      body: { action: "create_technician", email, password, full_name, phone },
    });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error(error?.message || (data as any)?.error);
    toast.success("Technician created");
    setEmail(""); setPassword(""); setName(""); setPhone(""); onCreated();
  };
  return (
    <Card className="p-4 space-y-2">
      <h3 className="font-semibold">Add technician</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input placeholder="Full name" value={full_name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
        <Input placeholder="Email (login)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Initial password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button onClick={create} disabled={busy}>{busy ? "Creating…" : "Create technician"}</Button>
      <p className="text-[11px] text-muted-foreground">Share the email + password with the technician — they'll use it to sign in at /auth.</p>
    </Card>
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
        <Switch checked={settings.support_ticket_enabled !== false} onCheckedChange={(v) => saveSetting(v === true ? "support_ticket_enabled" : "support_ticket_enabled", v)} />
      </Card>
      {rows.map((r) => (
        <Card key={r.key} className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">{r.label}</Label>
            <Switch checked={settings[r.toggle] !== false} onCheckedChange={(v) => saveSetting(r.toggle, v)} />
          </div>
          <Input value={settings[r.key] ?? ""} placeholder={r.placeholder}
            onChange={(e) => setSettings((s: any) => ({ ...s, [r.key]: e.target.value }))}
            onBlur={(e) => saveSetting(r.key, e.target.value)} maxLength={120} />
        </Card>
      ))}
    </>
  );
}

function RewardCatalog() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState(""); const [coins, setCoins] = useState("");
  const load = () => supabase.from("reward_items").select("*").order("coins_required").then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!name.trim() || !coins) return;
    const { error } = await supabase.from("reward_items").insert({ name: name.trim(), coins_required: Number(coins) });
    if (error) return toast.error(error.message);
    setName(""); setCoins(""); load();
  };
  const update = async (id: string, patch: any) => { const { error } = await supabase.from("reward_items").update(patch).eq("id", id); if (error) toast.error(error.message); else load(); };
  const del = async (id: string) => { if (!confirm("Delete this reward?")) return; const { error } = await supabase.from("reward_items").delete().eq("id", id); if (error) toast.error(error.message); else load(); };
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
  useEffect(() => { supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).then(({ data }) => setTickets(data ?? [])); }, []);
  const setStatus = async (id: string, status: string) => { await supabase.from("support_tickets").update({ status }).eq("id", id); setTickets((t) => t.map((x) => x.id === id ? { ...x, status } : x)); };
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
  const [openReject, setOpenReject] = useState<string | null>(null);
  const load = () => supabase.from("redemptions").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  useEffect(() => { load(); }, []);
  const setStatus = async (id: string, status: string) => { await supabase.from("redemptions").update({ status }).eq("id", id); load(); };
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
              {r.rejection_reason && <div className="text-xs text-destructive">Rejected: {r.rejection_reason}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={r.status === "fulfilled" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
              {r.status === "pending" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "fulfilled")}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => setOpenReject(r.id)}>Reject</Button>
                </>
              )}
            </div>
            <RejectDialog open={openReject === r.id} onOpenChange={(v) => setOpenReject(v ? r.id : null)} title="Reject redemption"
              onConfirm={async (reason) => {
                const { error } = await supabase.from("redemptions").update({ status: "rejected", rejection_reason: reason }).eq("id", r.id);
                if (error) toast.error(error.message); else { toast.success("Rejected"); load(); }
              }} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function UsersList({ onChange }: { onChange: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => { supabase.from("profiles").select("id, full_name, phone, user_roles(role)").then(({ data }) => setUsers(data ?? [])); }, []);
  const promote = async (uid: string, role: "technician" | "admin") => {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) toast.error(error.message); else { toast.success("Granted " + role); onChange(); }
  };
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-2">All registered users ({users.length})</h3>
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
