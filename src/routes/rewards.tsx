import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Gift, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/rewards")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: "/rewards" } as never });
  },
  component: Rewards,
});

function Rewards() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const points = items.reduce((s, r) => s + (r.points ?? 0), 0);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "rewards_enabled").single()
      .then(({ data }) => setEnabled(data?.value !== false));
    if (user) {
      supabase.from("rewards").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
        .then(({ data }) => setItems(data ?? []));
    }
  }, [user]);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <Gift className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-bold">Rewards are disabled</h1>
        <p className="text-sm text-muted-foreground">Check back soon — admin can enable rewards anytime.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-4 space-y-3">
      <Card className="p-5 text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
        <div className="flex items-center gap-2 text-xs"><Sparkles className="h-4 w-4" /> Your points</div>
        <div className="mt-1 text-4xl font-bold">{points}</div>
        <div className="mt-1 text-xs opacity-80">Earn points on every completed booking.</div>
      </Card>
      <h2 className="px-1 text-sm font-semibold">History</h2>
      {items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No reward activity yet.</Card>
      ) : items.map((r) => (
        <Card key={r.id} className="flex items-center justify-between p-3">
          <div>
            <div className="text-sm font-medium">{r.reason ?? "Reward"}</div>
            <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
          </div>
          <div className="font-bold text-primary">+{r.points}</div>
        </Card>
      ))}
    </div>
  );
}
