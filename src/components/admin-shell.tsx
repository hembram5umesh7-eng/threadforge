import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { syncSupabaseSession } from "@/lib/auth-session";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import {
  LayoutDashboard, Package, FolderTree, ShoppingCart, Users, Truck, ArrowLeft, UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, exact: true as const, superOnly: false },
  { label: "Products", to: "/admin/products", icon: Package, exact: false as const, superOnly: false },
  { label: "Categories", to: "/admin/categories", icon: FolderTree, exact: false as const, superOnly: false },
  { label: "Orders", to: "/admin/orders", icon: ShoppingCart, exact: false as const, superOnly: false },
  { label: "Suppliers", to: "/admin/manufacturers", icon: Truck, exact: false as const, superOnly: false },
  { label: "Customers", to: "/admin/users", icon: Users, exact: false as const, superOnly: false },
  { label: "Staff / Workers", to: "/admin/staff", icon: UserCog, exact: false as const, superOnly: true },
] as const;

function PanelLoading({ message, children }: { message?: string; children?: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 px-4">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {children}
    </div>
  );
}

export function AdminShell({
  title,
  subtitle,
  children,
  actions,
  redirect = "/admin",
  superAdminOnly = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  redirect?: string;
  superAdminOnly?: boolean;
}) {
  const navigate = useNavigate();
  const { user, canAccessAdmin, isAdmin, ready } = useAuth();

  const navItems = NAV.filter((n) => !n.superOnly || isAdmin);

  useEffect(() => {
    if (!ready) return;
    if (!user) navigate({ to: "/auth", search: { redirect } });
    else if (!canAccessAdmin) navigate({ to: "/" });
    else if (superAdminOnly && !isAdmin) navigate({ to: "/admin" });
  }, [ready, user, canAccessAdmin, isAdmin, superAdminOnly, navigate, redirect]);

  useEffect(() => {
    if (ready && user && canAccessAdmin) void syncSupabaseSession();
  }, [ready, user, canAccessAdmin]);

  if (!ready) return <PanelLoading message="Loading admin panel…" />;

  if (!user) {
    return (
      <PanelLoading message="Please sign in to continue…">
        <Link to="/auth" search={{ redirect }} className="text-sm text-primary font-semibold underline">
          Go to login
        </Link>
      </PanelLoading>
    );
  }

  if (!canAccessAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 px-4 text-center">
        <p className="text-lg font-bold">Access denied</p>
        <p className="text-sm text-muted-foreground">Admin or staff login required.</p>
        <Link to="/" className="text-sm text-primary font-semibold underline">Back to store</Link>
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
              <p className="text-xs font-bold uppercase text-muted-foreground px-3 mb-2">Admin Panel</p>
              {!isAdmin && (
                <p className="text-[10px] text-muted-foreground px-3 mb-2">Staff mode — managing on behalf of admin</p>
              )}
              {navItems.map((n) => (
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
            <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
              <div>
                <h1 className="text-2xl font-extrabold">{title}</h1>
                {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
              </div>
              {actions}
            </div>
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
              {navItems.map((n) => (
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
            {children}
          </main>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
