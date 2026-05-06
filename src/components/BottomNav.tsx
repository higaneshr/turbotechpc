import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ListOrdered, Gift, User, Zap, LifeBuoy } from "lucide-react";
import { useAuth } from "@/lib/auth";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/bookings", label: "Bookings", icon: ListOrdered },
  { to: "/quick-booking", label: "Quick Booking", icon: Zap, accent: true },
  { to: "/rewards", label: "Rewards", icon: Gift },
  { to: "/support", label: "Support", icon: LifeBuoy },
  { to: "/account", label: "Account", icon: User },
] as const;

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { role } = useAuth();
  if (role === "admin" || role === "technician") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-1.5">
        {items.map((it) => {
          const active = path === it.to || (it.to !== "/" && path.startsWith(it.to));
          const Icon = it.icon;
          if ("accent" in it && it.accent) {
            return (
              <Link
                key={it.to}
                to={it.to}
                className="-mt-5 flex flex-col items-center gap-0.5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-brand)] ring-4 ring-background">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-semibold text-foreground">{it.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "fill-primary/10" : ""}`} />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
