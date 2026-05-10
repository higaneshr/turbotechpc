import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { toE164, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: (s.redirect as string) || "/" }),
  component: AuthPage,
});

type Step = "phone" | "otp" | "name";

function AuthPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // After sign-in, ensure name + bounce out
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      if (!prof?.full_name || prof.full_name.trim() === "") {
        setStep("name");
      } else {
        navigate({ to: search.redirect as any, replace: true });
      }
    })();
  }, [user]);

  const e164 = () => toE164(phoneInput);

  const sendOtp = async () => {
    const phone = e164();
    if (phone.length < 8) return toast.error("Enter a valid phone number");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStep("otp");
    toast.success(`OTP sent to ${phone}`);
  };

  const verifyOtp = async () => {
    const phone = e164();
    const code = otp.trim();
    if (!code) return toast.error("Enter the OTP");
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in");
    // user effect above will route to /name or out
  };

  const finishName = async () => {
    if (!user) return;
    const n = name.trim();
    if (n.length < 2) return toast.error("Please enter your name");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: n }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success(`Welcome, ${n}!`);
    navigate({ to: search.redirect as any, replace: true });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Phone number + one-time code.</p>
      </div>

      {step === "phone" && !user && (
        <Card className="p-5 space-y-3">
          <div>
            <Label htmlFor="p">Phone number</Label>
            <Input
              id="p" type="tel" autoFocus inputMode="tel" maxLength={16}
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="+91 98765 43210"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Include country code (e.g. +91 for India). 10-digit numbers are auto-prefixed with +91.
            </p>
          </div>
          <Button className="w-full" onClick={sendOtp} disabled={busy}>{busy ? "Sending…" : "Get OTP"}</Button>
          <div className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="mr-1 inline h-3 w-3" />
            First account ever to sign up becomes the admin.
          </div>
        </Card>
      )}

      {step === "otp" && !user && (
        <Card className="p-5 space-y-3">
          <button type="button" onClick={() => setStep("phone")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Change number
          </button>
          <div>
            <Label htmlFor="o">Enter OTP sent to {e164()}</Label>
            <Input
              id="o" inputMode="numeric" maxLength={6} autoFocus
              value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="text-center text-xl tracking-[0.4em]"
            />
          </div>
          <Button className="w-full" onClick={verifyOtp} disabled={busy}>{busy ? "Verifying…" : "Sign in"}</Button>
          <button type="button" onClick={sendOtp} disabled={busy} className="w-full text-xs text-primary">
            Resend OTP
          </button>
        </Card>
      )}

      {step === "name" && (
        <Card className="p-5 space-y-3">
          <div>
            <Label htmlFor="n">Your name</Label>
            <Input id="n" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Full name" autoFocus />
            <p className="mt-1 text-[11px] text-muted-foreground">First time here — tell us your name to finish signing up.</p>
          </div>
          <Button className="w-full" onClick={finishName} disabled={busy}>{busy ? "Saving…" : "Continue"}</Button>
        </Card>
      )}
    </div>
  );
}
