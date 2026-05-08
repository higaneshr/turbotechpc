import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { MaintenanceGate } from "@/components/MaintenanceGate";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>
        <Link to="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Go home
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "Turbo Tech Agency — Computer Repair, On Demand" },
      { name: "description", content: "Book PC repair, OS install, virus removal & more. Track your technician live, like a Zomato for computer services." },
      { name: "theme-color", content: "#3b6cf2" },
      { property: "og:title", content: "Turbo Tech Agency — Computer Repair, On Demand" },
      { name: "twitter:title", content: "Turbo Tech Agency — Computer Repair, On Demand" },
      { property: "og:description", content: "Book PC repair, OS install, virus removal & more. Track your technician live, like a Zomato for computer services." },
      { name: "twitter:description", content: "Book PC repair, OS install, virus removal & more. Track your technician live, like a Zomato for computer services." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aae24e68-513d-45cb-bc23-ca8e8961556c/id-preview-2d678a35--77c72ffd-2c75-4bdc-ad06-c4df5119fbd2.lovable.app-1777994216270.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aae24e68-513d-45cb-bc23-ca8e8961556c/id-preview-2d678a35--77c72ffd-2c75-4bdc-ad06-c4df5119fbd2.lovable.app-1777994216270.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background pb-16 md:pb-0">
        <AppHeader />
        <MaintenanceGate>
          <Outlet />
        </MaintenanceGate>
        <BottomNav />
        <Toaster position="top-center" richColors />
      </div>
    </AuthProvider>
  );
}
