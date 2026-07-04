import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatINR, STATUS_LABEL, type OrderStatus } from "@/lib/order-utils";
import { Package, ShoppingCart, FolderTree, Truck, Users } from "lucide-react";

export const Route = createFileRoute("/staff/")({ component: StaffDashboard });

function StaffDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<{ id: string; order_number: string; status: OrderStatus; total: number; created_at: string }[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: o }, { count: pc }] = await Promise.all([
        supabase.from("orders").select("id,order_number,status,total,created_at").order("created_at", { ascending: false }).limit(8),
        supabase.from("products").select("*", { count: "exact", head: true }),
      ]);
      const list = (o ?? []) as typeof orders;
      setOrders(list);
      setProductCount(pc ?? 0);
      setPendingOrders(list.filter((x) => ["received", "processing"].includes(x.status)).length);
    })();
  }, []);

  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Worker";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold">Hello, {name} 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">Worker portal — manage orders, products & customers for ThreadForge.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Pending orders", value: pendingOrders, icon: ShoppingCart, to: "/admin/orders" },
          { label: "Products", value: productCount, icon: Package, to: "/admin/products" },
          { label: "Recent orders", value: orders.length, icon: Truck, to: "/admin/orders" },
        ].map((s) => (
          <Link key={s.label} to={s.to} className="bg-card border rounded-xl p-5 hover:border-primary transition-colors">
            <s.icon className="h-5 w-5 text-primary mb-2" />
            <p className="text-xs uppercase font-bold text-muted-foreground">{s.label}</p>
            <p className="text-3xl font-extrabold">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-bold mb-3">Quick actions</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Link to="/admin/orders" className="p-3 rounded-lg bg-secondary hover:bg-secondary/80 font-semibold flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Process orders
            </Link>
            <Link to="/admin/products" className="p-3 rounded-lg bg-secondary hover:bg-secondary/80 font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" /> Manage products
            </Link>
            <Link to="/admin/categories" className="p-3 rounded-lg bg-secondary hover:bg-secondary/80 font-semibold flex items-center gap-2">
              <FolderTree className="h-4 w-4" /> Categories
            </Link>
            <Link to="/admin/users" className="p-3 rounded-lg bg-secondary hover:bg-secondary/80 font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> Customers
            </Link>
          </div>
        </div>

        <section className="bg-card border rounded-xl p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold">Recent orders</h2>
            <Link to="/admin/orders" className="text-sm text-primary font-semibold">View all →</Link>
          </div>
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                <span className="font-semibold">{o.order_number}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">{STATUS_LABEL[o.status]}</span>
                  <span className="font-bold">{formatINR(Number(o.total))}</span>
                </div>
              </div>
            ))}
            {orders.length === 0 && <p className="text-muted-foreground text-sm py-4">No orders yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
