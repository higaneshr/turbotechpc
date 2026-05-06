import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, MessageCircle, Mail, Ticket, MessageSquare, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — Turbo Tech Agency" },
      { name: "description", content: "Contact Turbo Tech support: phone, WhatsApp, email, or raise a ticket." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const [s, setS] = useState<Record<string, any>>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("key,value").then(({ data }) => {
      const o: Record<string, any> = {};
      data?.forEach((r) => (o[r.key] = r.value));
      setS(o);
    });
  }, []);

  const phone = String(s.support_phone ?? "");
  const whatsapp = String(s.support_whatsapp ?? "");
  const email = String(s.support_email ?? "");

  const items = [
    { on: s.support_phone_enabled !== false && !!phone, label: "Call us", sub: phone, Icon: Phone, href: `tel:${phone}`, color: "from-emerald-500 to-emerald-600" },
    { on: s.support_whatsapp_enabled !== false && !!whatsapp, label: "WhatsApp", sub: whatsapp, Icon: MessageCircle, href: `https://wa.me/${whatsapp.replace(/[^\d]/g, "")}`, color: "from-green-500 to-green-600" },
    { on: s.support_email_enabled !== false && !!email, label: "Email us", sub: email, Icon: Mail, href: `mailto:${email}`, color: "from-blue-500 to-blue-600" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">We're here to help</h1>
        <p className="text-sm text-muted-foreground">Reach us through any of the channels below.</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.filter((i) => i.on).map((i) => (
          <a key={i.label} href={i.href} target="_blank" rel="noreferrer">
            <Card className="flex items-center gap-3 p-4 transition-all hover:border-primary/40 hover:shadow-md">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${i.color} text-white`}>
                <i.Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold">{i.label}</div>
                <div className="truncate text-xs text-muted-foreground">{i.sub}</div>
              </div>
            </Card>
          </a>
        ))}

        {s.support_ticket_enabled !== false && (
          <button onClick={() => setOpen(true)} className="text-left">
            <Card className="flex items-center gap-3 p-4 transition-all hover:border-primary/40 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white">
                <Ticket className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Raise a ticket</div>
                <div className="text-xs text-muted-foreground">We'll respond within 24h</div>
              </div>
            </Card>
          </button>
        )}
      </div>

      {/* Quick chat coming soon */}
      <Card className="relative overflow-hidden p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">💬 Quick Chat</h3>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">Coming Soon</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Real-time chat with our support team is on the way.</p>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-muted/30" />
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Common questions</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Browse our FAQ for instant answers.</p>
        <a href="/faq"><Button variant="outline" className="mt-3 w-full">Open FAQ</Button></a>
      </Card>

      <TicketDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function TicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !subject.trim() || !message.trim()) {
      return toast.error("All fields are required");
    }
    setBusy(true);
    const { error } = await supabase.from("support_tickets").insert({
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      subject: subject.trim(),
      message: message.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Ticket submitted! We'll get back to you soon.");
    onOpenChange(false);
    setName(""); setPhone(""); setSubject(""); setMessage("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Raise a support ticket</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
          <div><Label>Phone</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} /></div>
          <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} /></div>
          <div><Label>Message</Label><Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send ticket"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
