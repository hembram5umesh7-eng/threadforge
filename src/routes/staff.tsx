import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { syncSupabaseSession } from "@/lib/auth-session";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import {
  LayoutDashboard, Package, FolderTree, ShoppingCart, Users, Truck, ArrowLeft, UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", to: "/staff", icon: LayoutDashboard, exact: true as const },
  { label: "Orders", to: "/admin/orders", icon: ShoppingCart, exact: false as const },
  { label: "Products", to: "/admin/products", icon: Package, exact: false as const },
  { label: "Categories", to: "/admin/categories", icon: FolderTree, exact: false as const },
  { label: "Suppliers", to: "/admin/manufacturers", icon: Truck, exact: false as const },
  { label: "Customers", to: "/admin/users", icon: Users, exact: false as const },
] as const;

export const Route = createFileRoute("/staff")({ component: StaffLayout });

function StaffLayout() {
  const navigate = useNavigate();
  const { user, isStaff, isAdmin, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) navigate({ to: "/auth", search: { redirect: "/staff" } });
    else if (isAdmin) navigate({ to: "/admin" });
    else if (!isStaff) navigate({ to: "/" });
  }, [ready, user, isStaff, isAdmin, navigate]);

  useEffect(() => {
    if (ready && user && isStaff) void syncSupabaseSession();
  }, [ready, user, isStaff]);

  if (!ready || !user || !isStaff || isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <div className="flex-1 container mx-auto px-4 py-6">
        <div className="flex gap-8">
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24 space-y-1">
              <p className="text-xs font-bold uppercase text-muted-foreground px-3 mb-1">Worker Portal</p>
              <p className="text-[10px] text-muted-foreground px-3 mb-2">Manage store on behalf of admin</p>
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  activeProps={{ className: "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary" }}
                  activeOptions={{ exact: n.exact }}
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              ))}
              <Link to="/" className="flex items-center gap-2 px-3 py-2 mt-4 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Back to store
              </Link>
            </div>
          </aside>
          <main className="flex-1 min-w-0">
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn("shrink-0 px-3 py-1.5 rounded-full border text-xs font-semibold")}
                  activeProps={{ className: "bg-primary text-primary-foreground border-primary" }}
                  activeOptions={{ exact: n.exact }}
                >
                  {n.label}
                </Link>
              ))}
            </div>
            <Outlet />
          </main>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
