import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, CreditCard, Gift, LifeBuoy, Clock } from "lucide-react";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Turbo Tech Agency" },
      { name: "description", content: "Answers to common questions about bookings, payments, rewards, and support." },
      { property: "og:title", content: "FAQ — Turbo Tech Agency" },
      { property: "og:description", content: "Answers to common questions about bookings, payments, rewards, and support." },
    ],
  }),
  component: FAQPage,
});

const FAQS = [
  { cat: "Service timings", icon: Clock, q: "How quickly will the technician arrive?", a: "Usually within 30–90 minutes depending on your location and technician availability." },
  { cat: "Service timings", icon: Clock, q: "Why does ETA change sometimes?", a: "ETA depends on traffic, technician availability, and distance." },
  { cat: "Booking", icon: CalendarCheck, q: "Which areas are supported?", a: "Currently available in Nanjangud and nearby locations." },
  { cat: "Booking", icon: CalendarCheck, q: "Can I cancel my booking?", a: "Yes, bookings can be cancelled before technician dispatch." },
  { cat: "Booking", icon: CalendarCheck, q: "What if my issue is not listed?", a: "Select 'Other Issue' and describe your problem during booking." },
  { cat: "Booking", icon: CalendarCheck, q: "Is laptop repair available?", a: "Laptop repair is currently marked as 'Coming Soon'." },
  { cat: "Booking", icon: CalendarCheck, q: "Are technicians verified?", a: "Yes, all technicians are manually verified before assignment." },
  { cat: "Payments", icon: CreditCard, q: "Is online payment required?", a: "No. Cash on Delivery and direct payment options are available." },
  { cat: "Rewards", icon: Gift, q: "How do rewards work?", a: "Customers earn reward coins for completed bookings and promotional activities. 1 coin = ₹10 equivalent value." },
  { cat: "Support", icon: LifeBuoy, q: "How can I contact support?", a: "You can contact us through enabled support methods like phone, WhatsApp, email, or tickets." },
];

const CATS = ["Booking", "Payments", "Rewards", "Support", "Service timings"];

function FAQPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <div className="mb-4">
        <Badge variant="secondary" className="mb-2">Help center</Badge>
        <h1 className="text-2xl font-bold">Frequently asked questions</h1>
        <p className="text-sm text-muted-foreground">Quick answers to the things customers ask the most.</p>
      </div>

      {CATS.map((cat) => {
        const items = FAQS.filter((f) => f.cat === cat);
        if (!items.length) return null;
        const Icon = items[0].icon;
        return (
          <Card key={cat} className="mb-4 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold">{cat}</h2>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {items.map((f, i) => (
                <AccordionItem key={i} value={`${cat}-${i}`}>
                  <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        );
      })}
    </div>
  );
}
