import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, MapPin, Search, Bookmark, Bike, ArrowRight, Gift, Star, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import heroGift from "@/assets/hero-gift.png";

export const Route = createFileRoute("/")({
  component: Home,
});

const SERVICE_IMG = "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1200&q=80";

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
  const session = useSession();
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    supabase
      .from("services")
      .select("*")
      .eq("available", true)
      .order("sort_order")
      .then(({ data }) => setServices((data ?? []) as Service[]));
  }, []);

  const top = useMemo(() => services.find((s) => !s.coming_soon), [services]);

  const startBooking = (s: Service) => {
    if (s.coming_soon) return;
    navigate({ to: "/book/$serviceId", params: { serviceId: s.id } });
  };

  const initial = (session?.name ?? "U").trim().charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-md px-4 pb-6 pt-2">
      {/* Top bar: location + search + avatar */}
      <div className="flex items-center justify-between">
        <button className="flex items-start gap-1.5 text-left">
          <MapPin className="mt-0.5 h-5 w-5 fill-foreground text-foreground" />
          <div className="leading-tight">
            <div className="flex items-center gap-1 text-base font-bold">
              Office <ChevronDown className="h-4 w-4" />
            </div>
            <div className="text-[11px] text-muted-foreground">RP Road, Nanjangud</div>
          </div>
        </button>
        <div className="flex items-center gap-3">
          <button aria-label="Search" className="rounded-full p-1.5 hover:bg-accent">
            <Search className="h-5 w-5" />
          </button>
          <Link to="/account" aria-label="Account" className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground ring-2 ring-background">
            {initial}
          </Link>
        </div>
      </div>

      {/* Promo hero card */}
      <section
        className="relative mt-4 overflow-hidden rounded-2xl px-5 pb-5 pt-4"
        style={{ background: "var(--promo-bg)", color: "var(--promo-fg)" }}
      >
        {/* Brand lockup */}
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-sm" style={{ background: "var(--promo-accent)" }}>
            <span className="text-[10px] font-black">T</span>
          </div>
          <div className="leading-none">
            <div className="text-[12px] font-extrabold tracking-tight">TurboTech</div>
            <div className="text-[8px] font-semibold tracking-[0.18em] opacity-80">PC QUICK SERVICES</div>
          </div>
        </div>

        <div className="relative z-10 mt-3 max-w-[58%]">
          <div className="text-[13px] font-medium tracking-wide opacity-90">GET A</div>
          <h1
            className="text-[34px] font-black leading-[0.95] tracking-tight"
            style={{ color: "var(--promo-accent)" }}
          >
            FREE GIFT
          </h1>
          <div className="mt-1 text-[13px] font-semibold tracking-wide opacity-95">ON FIRST BOOKING</div>

          {/* Promo code chip */}
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-dashed border-white/40 bg-white/5 px-2 py-1 text-[11px] font-semibold tracking-wider">
            <span className="opacity-80">USE CODE</span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-extrabold"
              style={{ background: "var(--promo-accent)", color: "var(--promo-accent-fg)" }}
            >
              FGT10
            </span>
          </div>

          <button
            onClick={() => top && startBooking(top)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[12px] font-extrabold tracking-wider"
            style={{ background: "var(--promo-accent)", color: "var(--promo-accent-fg)" }}
          >
            BOOK NOW <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Illustration */}
        <img
          src={heroGift}
          alt=""
          aria-hidden
          width={170}
          height={170}
          className="pointer-events-none absolute -right-2 bottom-0 h-[170px] w-[170px] select-none object-contain"
        />
      </section>

      {/* Section header */}
      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-[17px] font-extrabold tracking-tight">Services offered near you</h2>
        <button className="flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1.5 text-[11px] font-bold text-background">
          <ArrowUpDown className="h-3 w-3" /> Popular
        </button>
      </div>

      {/* Service cards */}
      <div
        className="mt-3 space-y-4"
        style={{ filter: "drop-shadow(var(--shadow-soft-orange))" }}
      >
        {services.map((s) => (
          <article
            key={s.id}
            onClick={() => startBooking(s)}
            className={`overflow-hidden rounded-3xl border bg-card transition-transform active:scale-[0.99] ${
              s.coming_soon ? "opacity-60" : "cursor-pointer"
            }`}
          >
            <div className="relative">
              <img
                src={SERVICE_IMG}
                alt={s.name}
                loading="lazy"
                className="h-44 w-full object-cover"
              />
              <button
                aria-label="Save"
                onClick={(e) => e.stopPropagation()}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-foreground shadow"
              >
                <Bookmark className="h-4 w-4" />
              </button>
              <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-[oklch(0.55_0.18_245)] px-2.5 py-1 text-[11px] font-semibold text-white">
                <Gift className="h-3 w-3" /> Free gift
              </div>
              <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-foreground/90 px-2 py-1 text-[11px] font-semibold text-background">
                <Bike className="h-3 w-3" /> 25 mins
              </div>
            </div>
            <div className="px-4 pb-4 pt-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="truncate text-[16px] font-extrabold">{s.name}</h3>
                <span className="flex items-center gap-1 rounded-md bg-[oklch(0.55_0.16_150)] px-1.5 py-0.5 text-[11px] font-bold text-white">
                  4.3 <Star className="h-3 w-3 fill-yellow-300 text-yellow-300" />
                </span>
              </div>
              <div className="mt-2 h-px w-full bg-border" />
              <div className="mt-2 text-right text-[12px] text-muted-foreground">
                Price Range <span className="font-semibold text-foreground">₹{Number(s.base_price)}–₹{Number(s.base_price) + 300}</span>
              </div>
            </div>
          </article>
        ))}
        {services.length === 0 && (
          <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
            No services available right now.
          </div>
        )}
      </div>

      {/* Role shortcuts */}
      {(session?.role === "technician" || session?.role === "admin") && (
        <div className="mt-5 flex gap-2">
          {session?.role === "technician" && (
            <Link to="/technician" className="flex-1 rounded-xl border bg-card p-3 text-center text-sm font-medium">
              → Technician dashboard
            </Link>
          )}
          {session?.role === "admin" && (
            <Link to="/admin" className="flex-1 rounded-xl border bg-card p-3 text-center text-sm font-medium">
              → Admin panel
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
