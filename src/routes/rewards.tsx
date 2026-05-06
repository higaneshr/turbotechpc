import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Sparkles, Coins, Lock, Search, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards — Turbo Tech Agency" },
      { name: "description", content: "Earn coins on every booking and redeem them for great products." },
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
  const [enabled, setEnabled] = useState(true);
  const [phone, setPhone] = useState("");
  const [coins, setCoins] = useState<number | null>(null);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "rewards_enabled").maybeSingle()
      .then(({ data }) => setEnabled(data?.value !== false));
    supabase.from("reward_items").select("*").eq("available", true).order("coins_required")
      .then(({ data }) => setItems((data ?? []) as RewardItem[]));
  }, []);

  const lookup = async () => {
    const p = phone.trim();
    if (p.length < 6) return toast.error("Enter a valid phone number");
    setLoading(true);
    setSearched(true);

    // Find profile by phone, fall back to summing rewards table
    const { data: profile } = await supabase.from("profiles").select("coins").eq("phone", p).maybeSingle();
    if (profile) {
      setCoins(profile.coins ?? 0);
    } else {
      // Sum coins from reward history matching this phone via bookings
      const { data: bookings } = await supabase.from("bookings").select("id").eq("customer_phone", p).eq("status", "completed");
      const ids = (bookings ?? []).map((b) => b.id);
      let total = 0;
      if (ids.length) {
        const { data: rw } = await supabase.from("rewards").select("points").in("booking_id", ids);
        total = (rw ?? []).reduce((s, r) => s + (r.points ?? 0), 0);
      }
      setCoins(total);
    }
    setLoading(false);
  };

  const redeem = async (item: RewardItem) => {
    if (coins === null || coins < item.coins_required) return;
    const { error } = await supabase.from("redemptions").insert({
      customer_phone: phone.trim(),
      reward_item_id: item.id,
      reward_name: item.name,
      coins_spent: item.coins_required,
    });
    if (error) return toast.error(error.message);
    toast.success(`Redeemed ${item.name}! Admin will contact you.`);
  };

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
    <div className="mx-auto max-w-2xl px-4 py-4 space-y-4">
      <Card className="p-5 text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
        <div className="flex items-center gap-2 text-xs font-medium opacity-90"><Sparkles className="h-4 w-4" /> Turbo Coins</div>
        <div className="mt-1 text-3xl font-bold">{coins ?? "—"}</div>
        <div className="mt-1 text-xs opacity-80">1 coin = ₹10 equivalent value</div>
      </Card>

      <Card className="p-4">
        <Label htmlFor="rphone">Check your coins</Label>
        <div className="mt-1 flex gap-2">
          <Input id="rphone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} placeholder="Your phone number" />
          <Button onClick={lookup} disabled={loading}>
            <Search className="mr-1 h-4 w-4" /> {loading ? "Checking…" : "Check"}
          </Button>
        </div>
        {searched && coins !== null && (
          <p className="mt-2 text-xs text-muted-foreground">
            Found <Coins className="inline h-3 w-3" /> <strong>{coins}</strong> coins for {phone}.
          </p>
        )}
      </Card>

      <div>
        <h2 className="px-1 mb-2 text-sm font-semibold">Available rewards</h2>
        {items.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">No rewards configured yet.</Card>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((it) => {
              const can = coins !== null && coins >= it.coins_required;
              return (
                <Card key={it.id} className={`overflow-hidden p-4 transition-all ${can ? "hover:border-primary/40 hover:shadow-md" : "opacity-80"}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {it.image_url ? (
                        <img src={it.image_url} alt={it.name} className="h-full w-full rounded-xl object-cover" />
                      ) : (
                        <Package className="h-7 w-7" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{it.name}</div>
                      {it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}
                      <div className="mt-1 flex items-center gap-1 text-sm font-bold text-primary">
                        <Coins className="h-3.5 w-3.5" /> {it.coins_required} coins
                      </div>
                    </div>
                  </div>
                  <Button className="mt-3 w-full" disabled={!can} onClick={() => redeem(it)}>
                    {can ? "Redeem" : <><Lock className="mr-1 h-3.5 w-3.5" /> Need {coins === null ? it.coins_required : it.coins_required - coins} more</>}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
