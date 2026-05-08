import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: (s.redirect as string) || "/account" }),
  beforeLoad: () => { throw redirect({ to: "/account" }); },
  component: () => null,
});
