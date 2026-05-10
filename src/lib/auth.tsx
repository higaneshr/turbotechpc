import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "technician" | "customer";

export type AuthProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  coins: number;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadExtras = async (uid: string) => {
    const [{ data: prof }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, coins").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((prof as AuthProfile) ?? null);
    const list = (roles ?? []).map((r: any) => r.role) as AppRole[];
    const best: AppRole | null =
      list.includes("admin") ? "admin" :
      list.includes("technician") ? "technician" :
      list.includes("customer") ? "customer" : null;
    setRole(best);
  };

  useEffect(() => {
    // Set up listener BEFORE getSession (per Supabase guidance)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        // Defer to avoid deadlock inside callback
        setTimeout(() => loadExtras(s.user.id), 0);
      } else {
        setProfile(null);
        setRole(null);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) loadExtras(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };
  const refresh = async () => { if (session?.user) await loadExtras(session.user.id); };

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, profile, role, loading, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

/** Normalise a phone-number-ish input to E.164. Defaults country code to +91 (India). */
export function toE164(input: string, defaultCC = "+91"): string {
  const s = input.trim().replace(/[^\d+]/g, "");
  if (s.startsWith("+")) return s;
  if (s.length === 10) return defaultCC + s;
  if (s.length === 12 && s.startsWith("91")) return "+" + s;
  return defaultCC + s.replace(/^0+/, "");
}
