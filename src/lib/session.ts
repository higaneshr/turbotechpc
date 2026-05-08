import { useEffect, useState } from "react";

export type AppRole = "customer" | "technician" | "admin";
export type Session = { phone: string; name: string; role: AppRole };

const KEY = "ttagency_session_v2";
const EVENT = "ttagency-session-change";

export const ADMIN_PHONE = "123456789";
export const ADMIN_OTP = "2345";
// Universal test OTP until SMS provider is wired in
export const TEST_OTP = "2345";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (v && v.phone && v.role) return v;
  } catch {}
  return null;
}

export function setSession(s: Session) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(EVENT));
}

export function clearSession() {
  localStorage.removeItem(KEY);
  // legacy key cleanup
  try { localStorage.removeItem("ttagency_customer_v1"); } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function useSession() {
  const [s, setS] = useState<Session | null>(() => getSession());
  useEffect(() => {
    const h = () => setS(getSession());
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return s;
}
