import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR, ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from "@/lib/order-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/partner")({ component: Partner });

interface OrderRow {
  id: string; order_number: string; status: OrderStatus; total: number; tracking_id: string | null;
  ship_full_name: string; ship_city: string; ship_pincode: string;
}
interface Item {
  id: string; order_id: string; product_name: string; size: string; color: string;
  quantity: number; preview_front_url: string | null; preview_back_url: string | null;
}

function Partner() {
  const { user, isManufacturer, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<Record<string, Item[]>>({});

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth", search: { redirect: "/partner" } });
    else if (!isManufacturer) navigate({ to: "/" });
  }, [user, isManufacturer, loading, navigate]);

  const refresh = async () => {
    const { data: o } = await supabase.from("orders")
      .select("id,order_number,status,total,tracking_id,ship_full_name,ship_city,ship_pincode")
      .order("created_at", { ascending: false });
    const list = (o as OrderRow[]) ?? [];
    setOrders(list);
    if (list.length) {
      const { data: its } = await supabase.from("order_items").select("*").in("order_id", list.map((x) => x.id));
      const grouped: Record<string, Item[]> = {};
      (its as Item[] ?? []).forEach((it) => { (grouped[it.order_id] ??= []).push(it); });
      setItems(grouped);
    }
  };
  useEffect(() => { if (isManufacturer) refresh(); }, [isManufacturer]);

  const setStatus = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); refresh(); }
  };
  const setTracking = async (id: string, tracking_id: string) => {
    const { error } = await supabase.from("orders").update({ tracking_id }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Tracking saved"); refresh(); }
  };

  if (!isManufacturer) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold mb-6">Manufacturer Panel</h1>
        <p className="text-sm text-muted-foreground mb-4">Assigned orders ({orders.length})</p>

        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="bg-card border rounded-xl p-5">
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div>
                  <p className="font-bold text-lg">{o.order_number}</p>
                  <p className="text-sm text-muted-foreground">{o.ship_full_name} · {o.ship_city} - {o.ship_pincode}</p>
                  <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary">{STATUS_LABEL[o.status]}</span>
                </div>
                <p className="font-extrabold">{formatINR(Number(o.total))}</p>
              </div>

              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                {(items[o.id] ?? []).map((it) => (
                  <div key={it.id} className="flex gap-3 p-2 bg-secondary rounded-lg">
                    <div className="w-16 h-20 rounded bg-background overflow-hidden shrink-0">
                      {it.preview_front_url && <img src={it.preview_front_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-sm">{it.product_name}</p>
                      <p>Size {it.size} · {it.color}</p>
                      <p>Qty {it.quantity}</p>
                      {it.preview_back_url && <a href={it.preview_back_url} target="_blank" rel="noreferrer" className="text-primary underline">View back design</a>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 items-end">
                <div>
                  <label className="text-xs font-bold uppercase block mb-1">Update status</label>
                  <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value as OrderStatus)} className="h-9 text-sm px-2 rounded border bg-background">
                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-48">
                  <label className="text-xs font-bold uppercase block mb-1">Tracking ID</label>
                  <div className="flex gap-2">
                    <Input defaultValue={o.tracking_id ?? ""} id={`t-${o.id}`} placeholder="e.g. AWB12345" />
                    <Button size="sm" onClick={() => setTracking(o.id, (document.getElementById(`t-${o.id}`) as HTMLInputElement).value)}>Save</Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="text-muted-foreground">No orders assigned yet.</p>}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
