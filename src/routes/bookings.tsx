import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, PackageOpen } from "lucide-react";

export const Route = createFileRoute("/bookings")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: "/bookings" } as never });
  },
  component: BookingsPage,
});

function BookingsPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("bookings").select("*").order("created_at", { ascending: false }).then(({ data }) => setItems(data ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <h1 className="mb-3 text-xl font-bold">My bookings</h1>
      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <PackageOpen className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
          <Link to="/" className="text-sm font-medium text-primary">Book a service →</Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((b) => (
            <Link key={b.id} to="/track/$bookingId" params={{ bookingId: b.id }}>
              <Card className="flex items-center gap-3 p-4 hover:border-primary/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold truncate">{b.service_name}</div>
                    <Badge variant="secondary">{b.status}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground truncate">
                    {new Date(b.created_at).toLocaleString()} • ₹{Number(b.price ?? 0)}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
