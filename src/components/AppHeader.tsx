import { Link } from "@tanstack/react-router";
import { Cpu, LogOut, ShieldCheck, Wrench } from "lucide-react";
import { useSession, clearSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AppHeader() {
  const session = useSession();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground shadow-[var(--shadow-brand)]"
            style={{ background: "var(--gradient-brand)" }}
          >
            <Cpu className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight">Turbo Tech</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Agency</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {session?.role === "admin" && (
            <Link to="/admin">
              <Button size="sm" variant="outline" className="h-8 gap-1">
                <ShieldCheck className="h-4 w-4" /> Admin
              </Button>
            </Link>
          )}
          {session?.role === "technician" && (
            <Link to="/technician">
              <Button size="sm" variant="outline" className="h-8 gap-1">
                <Wrench className="h-4 w-4" /> Jobs
              </Button>
            </Link>
          )}
          {session ? (
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { clearSession(); toast.success("Signed out"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <Link to="/account">
              <Button size="sm" className="h-8">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
