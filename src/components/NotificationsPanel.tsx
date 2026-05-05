import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";

export function NotificationsPanel({ role }: { role: "admin" | "technician" }) {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems(data ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`notifs-${role}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [role]);

  const unread = items.filter((i) => !i.read).length;

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    load();
  };

  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} className="gap-1">
        <Bell className="h-4 w-4" />
        Notifications
        {unread > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unread}
          </span>
        )}
      </Button>
      {open && (
        <Card className="absolute right-0 top-10 z-50 w-80 max-h-96 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Recent</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
          {items.length === 0 && <div className="p-3 text-center text-xs text-muted-foreground">Nothing new.</div>}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`block w-full rounded-md p-2 text-left text-xs hover:bg-accent ${n.read ? "opacity-60" : "bg-accent/40"}`}
            >
              <div className="font-medium">{n.message}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
