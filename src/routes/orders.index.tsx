import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { formatINR, STATUS_LABEL, type OrderStatus } from "@/lib/order-utils";

export const Route = createFileRoute("/orders/")({ component: OrdersList });

interface OrderRow { id: string; order_number: string; status: OrderStatus; total: number; created_at: string }

function OrdersList() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/auth", search: { redirect: "/orders" } });
  }, [ready, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("orders").select("id,order_number,status,total,created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrders((data as OrderRow[]) ?? []));
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold mb-6">My Orders</h1>
        {orders.length === 0 ? (
          <p className="text-muted-foreground">No orders yet. <Link to="/" className="text-primary font-semibold">Start shopping</Link></p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Link key={o.id} to="/orders/$orderId" params={{ orderId: o.id }}
                className="block p-4 bg-card border rounded-xl hover:shadow-product transition-shadow">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="font-bold">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
                    <span className="inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary">{STATUS_LABEL[o.status]}</span>
                  </div>
                  <p className="font-extrabold">{formatINR(o.total)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
