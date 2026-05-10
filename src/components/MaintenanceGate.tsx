import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Wrench } from "lucide-react";

const STAFF_ROUTES = ["/admin", "/technician", "/auth"];

export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { role } = useAuth();
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState("We are upgrading our systems. Please check back soon.");

  useEffect(() => {
    const load = () => {
      supabase.from("app_settings").select("key,value").in("key", ["maintenance_mode", "maintenance_message"])
        .then(({ data }) => {
          data?.forEach((r: any) => {
            if (r.key === "maintenance_mode") setOn(r.value === true);
            if (r.key === "maintenance_message" && typeof r.value === "string") setMsg(r.value);
          });
        });
    };
    load();
    const ch = supabase
      .channel("maintenance")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const isStaffRoute = STAFF_ROUTES.some((p) => path.startsWith(p));
  if (on && !isStaffRoute && role !== "admin" && role !== "technician") {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Wrench className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">Under maintenance</h1>
          <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
          <p className="mt-3 text-xs text-muted-foreground">No bookings are being taken at the moment.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
