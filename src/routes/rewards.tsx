import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Star, Lock, Package, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards — Turbo Tech Agency" },
      { name: "description", content: "Earn Turbo Points on every booking and redeem them for great rewards." },
    ],
  }),
  component: RewardsPage,
});

interface RewardItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  coins_required: number;
  available: boolean;
}

function RewardsPage() {
  const { user, profile, loading: authLoading, refresh } = useAuth();
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(true);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/auth", search: { redirect: "/rewards" } }); return; }
    supabase.from("app_settings").select("value").eq("key", "rewards_enabled").maybeSingle()
      .then(({ data }) => setEnabled((data?.value as any) !== false));
    supabase.from("reward_items").select("*").eq("available", true).order("coins_required")
      .then(({ data }) => setItems((data ?? []) as RewardItem[]));
    supabase.from("redemptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setHistory(data ?? []));
  }, [authLoading, user]);

  const coins = profile?.coins ?? 0;

  const redeem = async (item: RewardItem) => {
    if (!user || !profile) return;
    if (coins < item.coins_required) return;
    const { error } = await supabase.from("redemptions").insert({
      user_id: user.id,
      customer_phone: profile.phone ?? "",
      reward_item_id: item.id,
      reward_name: item.name,
      coins_spent: item.coins_required,
    });
    if (error) return toast.error(error.message);
    toast.success(`Requested ${item.name}! We will call you to confirm.`);
    await refresh();
    const { data } = await supabase.from("redemptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setHistory(data ?? []);
  };

  if (authLoading || !user) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  if (!enabled) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <Gift className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-bold">Rewards are disabled</h1>
        <p className="text-sm text-muted-foreground">Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 space-y-5">
      <div
        className="relative overflow-hidden rounded-3xl p-5 text-white shadow-[var(--shadow-elevated)]"
        style={{ background: "linear-gradient(135deg, oklch(0.22 0.05 260) 0%, oklch(0.16 0.05 260) 100%)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Available Balance</div>
            <div className="mt-2 text-5xl font-extrabold leading-none">{coins}</div>
            <div className="mt-1 text-sm text-white/70">Turbo Points</div>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-brand)]">
            <Star className="h-8 w-8 fill-current" />
          </div>
        </div>
      </div>

      <div>
        <div className="px-2 mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">How to earn points</div>
        <Card className="p-4 space-y-2 rounded-2xl">
          <Bullet text="10 pts for every ₹100 spent" />
          <Bullet text="50 pts for referring a friend" />
        </Card>
      </div>

      <div>
        <div className="px-2 mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Rewards catalog</div>
        {items.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground rounded-2xl">No rewards configured yet.</Card>
        ) : (
          <div className="space-y-2">
            {items.map((it) => {
              const can = coins >= it.coins_required;
              return (
                <Card key={it.id} className="rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      {it.image_url ? (
                        <img src={it.image_url} alt={it.name} className="h-full w-full rounded-2xl object-cover" />
                      ) : <Package className="h-7 w-7" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{it.name}</div>
                      {it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}
                      <div className="mt-1 text-sm font-bold text-primary">{it.coins_required} pts</div>
                    </div>
                    <Button size="sm" disabled={!can} onClick={() => redeem(it)}>
                      {can ? "Redeem" : <><Lock className="mr-1 h-3.5 w-3.5" /> {it.coins_required - coins} more</>}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div>
          <div className="px-2 mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Your redemptions</div>
          <div className="space-y-2">
            {history.map((r) => (
              <Card key={r.id} className="rounded-2xl p-3 text-sm flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{r.reward_name}</div>
                  <div className="text-xs text-muted-foreground">{r.coins_spent} pts • {new Date(r.created_at).toLocaleDateString()}</div>
                  {r.status === "rejected" && r.rejection_reason && (
                    <div className="mt-1 text-xs text-destructive">Reason: {r.rejection_reason}</div>
                  )}
                </div>
                <StatusPill status={r.status} />
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="h-2 w-2 rounded-full bg-primary" />
      <span>{text}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "fulfilled") return <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success"><CheckCircle2 className="h-3 w-3" /> Fulfilled</span>;
  if (status === "rejected") return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive"><XCircle className="h-3 w-3" /> Rejected</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning-foreground"><Clock className="h-3 w-3" /> Pending callback</span>;
}
