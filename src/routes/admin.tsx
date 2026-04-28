import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { formatINR, ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from "@/lib/order-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({ component: Admin });

interface OrderRow { id: string; order_number: string; status: OrderStatus; total: number; created_at: string; user_id: string; manufacturer_id: string | null }
interface Mfr { id: string; name: string }

function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [mfrs, setMfrs] = useState<Mfr[]>([]);
  const [stats, setStats] = useState({ totalOrders: 0, revenue: 0, products: 0 });

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth", search: { redirect: "/admin" } });
    else if (!isAdmin) navigate({ to: "/" });
  }, [user, isAdmin, loading, navigate]);

  const refresh = async () => {
    const [{ data: o }, { data: m }, { count: pc }] = await Promise.all([
      supabase.from("orders").select("id,order_number,status,total,created_at,user_id,manufacturer_id").order("created_at", { ascending: false }),
      supabase.from("manufacturers").select("id,name"),
      supabase.from("products").select("*", { count: "exact", head: true }),
    ]);
    const list = (o as OrderRow[]) ?? [];
    setOrders(list);
    setMfrs((m as Mfr[]) ?? []);
    setStats({
      totalOrders: list.length,
      revenue: list.reduce((s, r) => s + Number(r.total), 0),
      products: pc ?? 0,
    });
  };
  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  const assignMfr = async (orderId: string, mfrId: string) => {
    const { error } = await supabase.from("orders").update({ manufacturer_id: mfrId, status: "sent_to_manufacturer" }).eq("id", orderId);
    if (error) toast.error(error.message); else { toast.success("Assigned"); refresh(); }
  };
  const updateStatus = async (orderId: string, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) toast.error(error.message); else { toast.success("Updated"); refresh(); }
  };

  const addManufacturer = async () => {
    const name = prompt("Manufacturer name?"); if (!name) return;
    const email = prompt("Contact email?") ?? "";
    const { error } = await supabase.from("manufacturers").insert({ name, contact_email: email });
    if (error) toast.error(error.message); else { toast.success("Added"); refresh(); }
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold mb-6">Admin Dashboard</h1>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-hero text-white rounded-xl p-5"><p className="text-xs uppercase font-bold opacity-80">Total Orders</p><p className="text-3xl font-extrabold">{stats.totalOrders}</p></div>
          <div className="bg-gradient-sale rounded-xl p-5"><p className="text-xs uppercase font-bold opacity-70">Revenue</p><p className="text-3xl font-extrabold">{formatINR(stats.revenue)}</p></div>
          <div className="bg-card border rounded-xl p-5"><p className="text-xs uppercase font-bold text-muted-foreground">Products</p><p className="text-3xl font-extrabold">{stats.products}</p></div>
        </div>

        <section className="bg-card border rounded-xl p-5 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold">Manufacturers ({mfrs.length})</h2>
            <Button size="sm" onClick={addManufacturer}>+ Add Manufacturer</Button>
          </div>
          <div className="space-y-2">
            {mfrs.map((m) => <div key={m.id} className="text-sm p-2 bg-secondary rounded">{m.name}</div>)}
            {mfrs.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
          </div>
          <p className="text-xs text-muted-foreground mt-3">To grant manufacturer login: ask the user to sign up, then assign their account to a manufacturer record (requires linking <code>user_id</code> in the database).</p>
        </section>

        <section className="bg-card border rounded-xl p-5">
          <h2 className="font-bold mb-3">All Orders</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr><th className="text-left p-2">Order</th><th className="text-left p-2">Status</th><th className="text-left p-2">Total</th><th className="text-left p-2">Manufacturer</th><th className="text-left p-2">Update</th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="p-2 font-semibold">{o.order_number}</td>
                    <td className="p-2"><span className="text-xs px-2 py-0.5 rounded-full bg-secondary">{STATUS_LABEL[o.status]}</span></td>
                    <td className="p-2">{formatINR(Number(o.total))}</td>
                    <td className="p-2">
                      <select defaultValue={o.manufacturer_id ?? ""} onChange={(e) => assignMfr(o.id, e.target.value)} className="h-8 text-xs px-2 rounded border bg-background">
                        <option value="">— assign —</option>
                        {mfrs.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </td>
                    <td className="p-2">
                      <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value as OrderStatus)} className="h-8 text-xs px-2 rounded border bg-background">
                        {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
