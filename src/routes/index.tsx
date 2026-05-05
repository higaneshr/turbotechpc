import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Cpu, Monitor, Download, Disc, Shield, Laptop, Wrench, ArrowRight, Clock, MapPin, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Home,
});

const ICONS: Record<string, any> = {
  wrench: Wrench, monitor: Monitor, download: Download,
  disc: Disc, shield: Shield, laptop: Laptop, cpu: Cpu,
};

interface Service {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  icon: string | null;
  coming_soon: boolean;
  available: boolean;
}

function Home() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    supabase
      .from("services")
      .select("*")
      .eq("available", true)
      .order("sort_order")
      .then(({ data }) => setServices((data ?? []) as Service[]));
  }, []);

  const startBooking = (s: Service) => {
    if (s.coming_soon) return;
    if (!user) {
      navigate({ to: "/auth", search: { redirect: `/book/${s.id}` } as never });
      return;
    }
    navigate({ to: "/book/$serviceId", params: { serviceId: s.id } });
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Hero */}
      <section
        className="relative mx-3 mt-3 overflow-hidden rounded-2xl px-5 py-7 text-primary-foreground shadow-[var(--shadow-brand)]"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="relative z-10 max-w-md">
          <Badge className="mb-3 bg-white/20 text-white backdrop-blur hover:bg-white/30">
            ⚡ Doorstep service in 30 min
          </Badge>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            Computer trouble?<br />A pro is on the way.
          </h1>
          <p className="mt-2 text-sm text-white/85">
            Book trusted technicians for any PC issue. Track them live, pay on completion.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" /> 4.9 rated</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Same-day</span>
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Live tracking</span>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      </section>

      {/* Role shortcuts */}
      {(role === "technician" || role === "admin") && (
        <div className="mx-3 mt-3 flex gap-2">
          {role === "technician" && (
            <Link to="/technician" className="flex-1 rounded-lg border bg-card p-3 text-sm font-medium">
              → Technician dashboard
            </Link>
          )}
          {role === "admin" && (
            <Link to="/admin" className="flex-1 rounded-lg border bg-card p-3 text-sm font-medium">
              → Admin panel
            </Link>
          )}
        </div>
      )}

      {/* Services */}
      <section className="px-3 py-5">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-bold">Our services</h2>
          <span className="text-xs text-muted-foreground">{services.length} available</span>
        </div>
        <div className="space-y-2.5">
          {services.map((s) => {
            const Icon = ICONS[s.icon ?? "wrench"] ?? Wrench;
            return (
              <Card
                key={s.id}
                onClick={() => startBooking(s)}
                className={`group flex cursor-pointer items-center gap-4 p-4 transition-all hover:border-primary/40 hover:shadow-[var(--shadow-card)] ${
                  s.coming_soon ? "opacity-60" : ""
                }`}
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-primary"
                  style={{ background: "color-mix(in oklab, var(--brand) 12%, transparent)" }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{s.name}</h3>
                    {s.coming_soon && <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{s.description}</p>
                  {!s.coming_soon && (
                    <div className="mt-1 text-sm font-bold text-foreground">₹{Number(s.base_price)}+</div>
                  )}
                </div>
                {!s.coming_soon && (
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
