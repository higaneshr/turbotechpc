import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ListOrdered, Gift, User } from "lucide-react";
import { useAuth } from "@/lib/auth";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/bookings", label: "Bookings", icon: ListOrdered },
  { to: "/rewards", label: "Rewards", icon: Gift },
  { to: "/account", label: "Account", icon: User },
];

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { role } = useAuth();
  if (role === "admin" || role === "technician") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {items.map((it) => {
          const active = path === it.to || (it.to !== "/" && path.startsWith(it.to));
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
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
