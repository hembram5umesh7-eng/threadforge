import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { formatINR, ORDER_STATUSES, STATUS_LABEL, statusIndex, type OrderStatus } from "@/lib/order-utils";
import { Check } from "lucide-react";

export const Route = createFileRoute("/orders/$orderId")({ component: OrderDetail });

interface Order {
  id: string; order_number: string; status: OrderStatus; total: number; subtotal: number; shipping_fee: number;
  payment_method: string; payment_status: string; tracking_id: string | null; created_at: string;
  ship_full_name: string; ship_phone: string; ship_line1: string; ship_line2: string | null;
  ship_city: string; ship_state: string; ship_pincode: string;
}
interface Item {
  id: string; product_name: string; size: string; color: string; quantity: number;
  unit_price: number;
}

function OrderDetail() {
  const { orderId } = useParams({ from: "/orders/$orderId" });
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: o } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      setOrder(o as Order | null);
      const { data: its } = await supabase.from("order_items").select("*").eq("order_id", orderId);
      setItems((its as Item[]) ?? []);
    };
    load();

    // Realtime updates
    const ch = supabase
      .channel(`order-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (p) => setOrder((prev) => prev ? { ...prev, ...(p.new as Order) } : prev))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId, user]);

  if (!order) return (
    <div className="min-h-screen flex flex-col"><SiteHeader /><div className="flex-1 container mx-auto px-4 py-12">Loading…</div><SiteFooter /></div>
  );

  const curIdx = statusIndex(order.status);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-between items-start mb-6 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-extrabold">Order {order.order_number}</h1>
            <p className="text-sm text-muted-foreground">Placed on {new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
          </div>
          <p className="text-2xl font-extrabold">{formatINR(order.total)}</p>
        </div>

        {/* Tracker */}
        <section className="bg-card border rounded-xl p-5 mb-6">
          <h2 className="font-bold mb-4">Order Tracking · Live</h2>
          {order.status === "cancelled" ? (
            <p className="text-destructive font-semibold">This order was cancelled.</p>
          ) : (
            <div className="space-y-3">
              {ORDER_STATUSES.map((s, i) => {
                const done = i <= curIdx;
                const active = i === curIdx;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"} ${active ? "ring-4 ring-success/20" : ""}`}>
                      {done ? <Check className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
                    </div>
                    <span className={`text-sm ${done ? "font-semibold" : "text-muted-foreground"}`}>{STATUS_LABEL[s]}</span>
                  </div>
                );
              })}
            </div>
          )}
          {order.tracking_id && (
            <div className="mt-4 p-3 bg-secondary rounded-lg">
              <p className="text-xs uppercase font-bold text-muted-foreground">Tracking ID</p>
              <p className="font-mono font-semibold">{order.tracking_id}</p>
            </div>
          )}
        </section>

        <div className="grid lg:grid-cols-2 gap-6">
          <section className="bg-card border rounded-xl p-5">
            <h2 className="font-bold mb-3">Items</h2>
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{it.product_name}</p>
                    <p className="text-xs text-muted-foreground">Size {it.size} · {it.color} · Qty {it.quantity}</p>
                  </div>
                  <p className="font-bold text-sm">{formatINR(it.unit_price * it.quantity)}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="bg-card border rounded-xl p-5">
            <h2 className="font-bold mb-3">Shipping To</h2>
            <p className="font-semibold text-sm">{order.ship_full_name}</p>
            <p className="text-sm text-muted-foreground">{order.ship_phone}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {order.ship_line1}{order.ship_line2 ? `, ${order.ship_line2}` : ""}<br />
              {order.ship_city}, {order.ship_state} - {order.ship_pincode}
            </p>
            <div className="mt-4 pt-4 border-t text-sm space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(order.subtotal)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span>{order.shipping_fee === 0 ? "FREE" : formatINR(order.shipping_fee)}</span></div>
              <div className="flex justify-between"><span>Payment</span><span className="uppercase">{order.payment_method} · {order.payment_status}</span></div>
              <div className="flex justify-between font-extrabold pt-2 border-t mt-2"><span>Total</span><span>{formatINR(order.total)}</span></div>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
