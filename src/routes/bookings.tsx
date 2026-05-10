import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PackageOpen } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/bookings")({
  component: BookingsPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending callback",
  accepted: "Approved",
  on_the_way: "On the way",
  arrived: "Arrived",
  in_progress: "Repair started",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

function BookingsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/auth", search: { redirect: "/bookings" } }); return; }
    setLoading(true);
    supabase.from("bookings").select("*").eq("customer_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setItems(data ?? []); setLoading(false); });
  }, [authLoading, user]);

  if (authLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <h1 className="mb-3 text-xl font-bold">My bookings</h1>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <PackageOpen className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
          <Link to="/" className="text-sm font-medium text-primary">Book a service →</Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{b.service_name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(b.created_at).toLocaleString()} • ₹{Number(b.final_price ?? b.price ?? 0)}
                  </div>
                </div>
                <Badge variant={b.status === "completed" ? "default" : "secondary"}>
                  {STATUS_LABEL[b.status] ?? b.status}
                </Badge>
              </div>
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={() => navigate({ to: "/track/$bookingId", params: { bookingId: b.id } })}
              >
                Open
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
