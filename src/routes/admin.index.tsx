import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { formatINR, STATUS_LABEL, type OrderStatus } from "@/lib/order-utils";
import { useAuth } from "@/lib/auth-context";
import { Package, ShoppingCart, TrendingUp, Truck } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function AdminDashboard() {
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState<{ id: string; order_number: string; status: OrderStatus; total: number; created_at: string }[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [supplierCount, setSupplierCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: o }, { count: pc }, { count: sc }, { count: cc }] = await Promise.all([
        supabase.from("orders").select("id,order_number,status,total,created_at").order("created_at", { ascending: false }).limit(10),
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("manufacturers").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      setOrders((o ?? []) as typeof orders);
      setProductCount(pc ?? 0);
      setSupplierCount(sc ?? 0);
      setCustomerCount(cc ?? 0);
    })();
  }, []);

  const stats = useMemo(() => {
    const revenue = orders.reduce((s, r) => s + Number(r.total), 0);
    const pending = orders.filter((o) => ["received", "processing"].includes(o.status)).length;
    return { revenue, pending, total: orders.length };
  }, [orders]);

  return (
    <AdminShell title="Dashboard" subtitle="Overview of your ThreadForge store.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Products", value: productCount, icon: Package, to: "/admin/products" },
          { label: "Orders", value: stats.total, icon: ShoppingCart, to: "/admin/orders" },
          { label: "Suppliers", value: supplierCount, icon: Truck, to: "/admin/manufacturers" },
          { label: "Customers", value: customerCount, icon: TrendingUp, to: "/admin/users" },
        ].map((s) => (
          <Link key={s.label} to={s.to} className="bg-card border rounded-xl p-5 hover:border-primary transition-colors">
            <s.icon className="h-5 w-5 text-primary mb-2" />
            <p className="text-xs uppercase font-bold text-muted-foreground">{s.label}</p>
            <p className="text-3xl font-extrabold">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-gradient-hero text-white rounded-xl p-5">
          <p className="text-xs uppercase font-bold opacity-80">Recent revenue (last 10 orders)</p>
          <p className="text-3xl font-extrabold mt-1">{formatINR(stats.revenue)}</p>
          <p className="text-sm opacity-80 mt-1">{stats.pending} orders need processing</p>
        </div>
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-bold mb-3">Quick links</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Link to="/admin/products" className="p-3 rounded-lg bg-secondary hover:bg-secondary/80 font-semibold">+ Add product</Link>
            <Link to="/admin/categories" className="p-3 rounded-lg bg-secondary hover:bg-secondary/80 font-semibold">Manage categories</Link>
            <Link to="/admin/orders" className="p-3 rounded-lg bg-secondary hover:bg-secondary/80 font-semibold">View all orders</Link>
            <Link to="/admin/manufacturers" className="p-3 rounded-lg bg-secondary hover:bg-secondary/80 font-semibold">Add supplier</Link>
            {isAdmin && (
              <Link to="/admin/staff" className="p-3 rounded-lg bg-secondary hover:bg-secondary/80 font-semibold col-span-2">+ Add staff / worker</Link>
            )}
          </div>
        </div>
      </div>

      <section className="mt-8 bg-card border rounded-xl p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold">Recent Orders</h2>
          <Link to="/admin/orders" className="text-sm text-primary font-semibold">View all →</Link>
        </div>
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
              <div>
                <span className="font-semibold">{o.order_number}</span>
                <span className="text-xs text-muted-foreground ml-2">{new Date(o.created_at).toLocaleDateString("en-IN")}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">{STATUS_LABEL[o.status]}</span>
                <span className="font-bold">{formatINR(Number(o.total))}</span>
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="text-muted-foreground text-sm py-4">No orders yet.</p>}
        </div>
      </section>
    </AdminShell>
  );
}
