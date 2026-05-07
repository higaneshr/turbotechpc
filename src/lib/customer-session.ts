import { useEffect, useState } from "react";

export type CustomerSession = { name: string; phone: string };

const KEY = "ttagency_customer_v1";

export function getCustomer(): CustomerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (v && typeof v.name === "string" && typeof v.phone === "string") return v;
  } catch {}
  return null;
}

export function setCustomer(s: CustomerSession) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("customer-session-change"));
}

export function clearCustomer() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("customer-session-change"));
}

export function useCustomer() {
  const [c, setC] = useState<CustomerSession | null>(() => getCustomer());
  useEffect(() => {
    const h = () => setC(getCustomer());
    window.addEventListener("customer-session-change", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("customer-session-change", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return c;
}
