import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SupplierPrintDialog,
  type InvoiceItem,
  type InvoiceOrder,
  type PrintDocType,
  type SupplierProfile,
} from "@/components/supplier-print-documents";
import { formatINR, ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from "@/lib/order-utils";
import { createShiprocketShipment } from "@/lib/shiprocket.functions";
import { useAuthedServerFn } from "@/lib/use-authed-server-fn";
import { toast } from "sonner";
import {
  Package, Clock, CheckCircle2, Truck, Building2, Mail, Phone, MapPin,
  FileText, Printer, Barcode, ClipboardList, Rocket, ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/partner")({ component: SupplierPanel });

type OrderRow = InvoiceOrder & {
  supplier_notes: string | null;
  courier_name: string | null;
  shiprocket_label_url: string | null;
};

function SupplierPanel() {
  const { user, isManufacturer, ready } = useAuth();
  const navigate = useNavigate();
  const createShipment = useAuthedServerFn(createShiprocketShipment);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<Record<string, InvoiceItem[]>>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [printType, setPrintType] = useState<PrintDocType | null>(null);
  const [printOrder, setPrintOrder] = useState<InvoiceOrder | null>(null);

  const loadProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("manufacturers")
      .select("id,name,contact_email,contact_phone,address")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) toast.error(error.message);
    else setSupplier(data as SupplierProfile | null);
  };

  const refresh = async () => {
    const { data: o, error } = await supabase.from("orders")
      .select(`
        id,order_number,status,subtotal,shipping_fee,total,payment_method,payment_status,
        tracking_id,ship_full_name,ship_phone,ship_line1,ship_line2,ship_city,ship_state,
        ship_pincode,ship_country,supplier_notes,courier_name,shiprocket_label_url,created_at
      `)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    const list = (o as OrderRow[]) ?? [];
    setOrders(list);
    if (list.length) {
      const { data: its } = await supabase
        .from("order_items")
        .select("id,order_id,product_name,size,color,quantity,unit_price,customization_price")
        .in("order_id", list.map((x) => x.id));
      const grouped: Record<string, InvoiceItem[]> = {};
      ((its ?? []) as (InvoiceItem & { order_id: string })[]).forEach((row) => {
        const { order_id, ...item } = row;
        (grouped[order_id] ??= []).push(item);
      });
      setItems(grouped);
    } else {
      setItems({});
    }
  };

  useEffect(() => {
    if (isManufacturer && user) {
      void loadProfile();
      void refresh();
    }
  }, [isManufacturer, user]);

  useEffect(() => {
    if (!ready) return;
    if (!user) navigate({ to: "/auth", search: { redirect: "/partner" } });
    else if (!isManufacturer) navigate({ to: "/" });
  }, [ready, user, isManufacturer, navigate]);

  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((o) => ["sent_to_manufacturer", "in_production", "processing"].includes(o.status)).length,
    shipped: orders.filter((o) => ["shipped", "delivered", "packed"].includes(o.status)).length,
    revenue: orders.reduce((s, o) => s + Number(o.total), 0),
  }), [orders]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const openPrint = (order: OrderRow, type: PrintDocType) => {
    setPrintOrder(order);
    setPrintType(type);
  };

  const setStatus = async (id: string, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Status updated"); refresh(); }
  };

  const setTracking = async (id: string, tracking_id: string) => {
    if (!tracking_id.trim()) { toast.error("Enter tracking / AWB number"); return; }
    const { error } = await supabase.from("orders").update({ tracking_id: tracking_id.trim(), status: "shipped" }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Marked shipped with tracking"); refresh(); }
  };

  const saveNotes = async (id: string, notes: string) => {
    const { error } = await supabase.from("orders").update({ supplier_notes: notes || null }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Notes saved");
  };

  const markProduction = async (id: string) => {
    await setStatus(id, "in_production");
  };

  const markPacked = async (id: string) => {
    await setStatus(id, "packed");
  };

  const shipViaShiprocket = async (orderId: string) => {
    setShippingId(orderId);
    try {
      const result = await createShipment({ data: { orderId } });
      toast.success(
        result.alreadyCreated
          ? `AWB already exists: ${result.awb}`
          : `Shiprocket AWB: ${result.awb}${result.courier ? ` (${result.courier})` : ""}`,
      );
      if (result.labelUrl) window.open(result.labelUrl, "_blank");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Shiprocket shipment failed");
    } finally {
      setShippingId(null);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <p className="text-sm text-muted-foreground">Please sign in to continue</p>
        <Link to="/auth" search={{ redirect: "/partner" }} className="text-sm text-primary font-semibold underline">Go to login</Link>
      </div>
    );
  }
  if (!isManufacturer) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 px-4 text-center">
        <p className="text-lg font-bold">Access denied</p>
        <p className="text-sm text-muted-foreground">Supplier login required. Ask admin to create your portal access.</p>
        <Link to="/" className="text-sm text-primary font-semibold underline">Back to store</Link>
      </div>
    );
  }

  const supplierName = supplier?.name ?? user.user_metadata?.full_name ?? "Supplier";

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Supplier identity banner */}
        <div className="bg-gradient-hero text-white rounded-2xl p-6 mb-6">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <p className="text-xs uppercase font-bold opacity-80 flex items-center gap-1">
                <Building2 className="h-4 w-4" /> Supplier Partner
              </p>
              <h1 className="text-2xl md:text-3xl font-extrabold mt-1">{supplierName}</h1>
              <p className="text-sm opacity-90 mt-1">Logged in as {user.email}</p>
            </div>
            {supplier && (
              <div className="text-sm space-y-1 opacity-95">
                {supplier.contact_email && (
                  <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {supplier.contact_email}</p>
                )}
                {supplier.contact_phone && (
                  <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {supplier.contact_phone}</p>
                )}
                {supplier.address && (
                  <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {supplier.address}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border rounded-xl p-4">
            <Package className="h-5 w-5 text-primary mb-1" />
            <p className="text-xs uppercase font-bold text-muted-foreground">Assigned Orders</p>
            <p className="text-2xl font-extrabold">{stats.total}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <Clock className="h-5 w-5 text-amber-500 mb-1" />
            <p className="text-xs uppercase font-bold text-muted-foreground">In Production</p>
            <p className="text-2xl font-extrabold">{stats.pending}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <CheckCircle2 className="h-5 w-5 text-success mb-1" />
            <p className="text-xs uppercase font-bold text-muted-foreground">Shipped / Done</p>
            <p className="text-2xl font-extrabold">{stats.shipped}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <FileText className="h-5 w-5 text-primary mb-1" />
            <p className="text-xs uppercase font-bold text-muted-foreground">Order Value</p>
            <p className="text-xl font-extrabold">{formatINR(stats.revenue)}</p>
          </div>
        </div>

        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList>
            <TabsTrigger value="orders"><ClipboardList className="h-4 w-4 mr-1" /> Orders & Fulfillment</TabsTrigger>
            <TabsTrigger value="docs"><Printer className="h-4 w-4 mr-1" /> Invoices & Labels</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 px-3 rounded-md border bg-background text-sm">
                <option value="all">All orders</option>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">Only orders assigned to <strong>{supplierName}</strong> appear here.</p>
            </div>

            <div className="space-y-4">
              {filtered.map((o) => (
                <div key={o.id} className="bg-card border rounded-xl overflow-hidden">
                  <button type="button" className="w-full p-5 text-left flex justify-between items-start gap-3" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                    <div>
                      <p className="font-bold text-lg">{o.order_number}</p>
                      <p className="text-sm text-muted-foreground">{o.ship_full_name} · {o.ship_city} - {o.ship_pincode}</p>
                      <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary">{STATUS_LABEL[o.status]}</span>
                    </div>
                    <p className="font-extrabold">{formatINR(Number(o.total))}</p>
                  </button>

                  {expanded === o.id && (
                    <div className="px-5 pb-5 border-t pt-4 space-y-4">
                      <div className="bg-secondary rounded-lg p-3 text-sm">
                        <p className="font-bold text-xs uppercase mb-1">Ship to</p>
                        <p>{o.ship_full_name} · {o.ship_phone}</p>
                        <p>{o.ship_line1}{o.ship_line2 ? `, ${o.ship_line2}` : ""}</p>
                        <p>{o.ship_city}, {o.ship_state} - {o.ship_pincode}</p>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-2">
                        {(items[o.id] ?? []).map((it) => (
                          <div key={it.id} className="p-3 border rounded-lg text-sm">
                            <p className="font-semibold">{it.product_name}</p>
                            <p className="text-muted-foreground">Size {it.size} · {it.color} · Qty {it.quantity}</p>
                            <p className="text-xs mt-1">{formatINR((Number(it.unit_price) + Number(it.customization_price)) * it.quantity)}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => markProduction(o.id)}>Start production</Button>
                        <Button size="sm" variant="secondary" onClick={() => markPacked(o.id)}>Mark packed</Button>
                        <Button
                          size="sm"
                          className="font-bold"
                          disabled={shippingId === o.id}
                          onClick={() => shipViaShiprocket(o.id)}
                        >
                          <Rocket className="h-3.5 w-3.5" />
                          {shippingId === o.id ? "Creating…" : o.tracking_id ? "Shiprocket AWB" : "Ship via Shiprocket"}
                        </Button>
                        {o.shiprocket_label_url && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={o.shiprocket_label_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" /> Label PDF
                            </a>
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openPrint(o, "packing")}><Printer className="h-3.5 w-3.5" /> Packing slip</Button>
                        <Button size="sm" variant="outline" onClick={() => openPrint(o, "invoice")}><FileText className="h-3.5 w-3.5" /> Invoice</Button>
                        <Button size="sm" variant="outline" onClick={() => openPrint(o, "label")}><Barcode className="h-3.5 w-3.5" /> Shipping label</Button>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold uppercase">Update status</label>
                          <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value as OrderStatus)} className="mt-1 w-full h-9 text-sm px-2 rounded border bg-background">
                            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase flex items-center gap-1"><Truck className="h-3 w-3" /> Tracking / AWB</label>
                          {o.tracking_id ? (
                            <p className="mt-1 text-sm font-semibold">
                              {o.tracking_id}
                              {o.courier_name && <span className="text-muted-foreground font-normal"> · {o.courier_name}</span>}
                            </p>
                          ) : (
                            <div className="flex gap-2 mt-1">
                              <Input defaultValue="" id={`t-${o.id}`} placeholder="Manual AWB (optional)" />
                              <Button size="sm" variant="outline" onClick={() => setTracking(o.id, (document.getElementById(`t-${o.id}`) as HTMLInputElement).value)}>Save</Button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-bold uppercase">Production notes</label>
                        <Textarea defaultValue={o.supplier_notes ?? ""} id={`sn-${o.id}`} rows={2} className="mt-1" placeholder="Fabric batch, QC notes…" />
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => saveNotes(o.id, (document.getElementById(`sn-${o.id}`) as HTMLTextAreaElement).value)}>
                          Save notes
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-muted-foreground text-center py-12">
                  No orders assigned to <strong>{supplierName}</strong> yet. Admin will assign orders from Admin → Orders.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="docs">
            <div className="bg-card border rounded-xl p-5 space-y-4">
              <h2 className="font-bold text-lg">Invoices, Packing Slips & Barcode Labels</h2>
              <p className="text-sm text-muted-foreground">
                Standard supplier workflow: print <strong>packing slip</strong> for warehouse → print <strong>shipping label</strong> with barcode → attach to parcel → enter AWB tracking.
                Use <strong>invoice</strong> for proforma billing records.
              </p>
              <ul className="text-sm space-y-2 list-disc pl-5 text-muted-foreground">
                <li><strong>Packing slip</strong> — item list + ship-to address (no prices required on box)</li>
                <li><strong>Shipping label</strong> — large ship-to + CODE128 barcodes for order & tracking scan</li>
                <li><strong>Proforma invoice</strong> — line items with amounts for your accounts</li>
              </ul>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No orders yet to print documents for.</p>
              ) : (
                <div className="space-y-2">
                  {orders.slice(0, 20).map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b last:border-0">
                      <div>
                        <p className="font-semibold">{o.order_number}</p>
                        <p className="text-xs text-muted-foreground">{o.ship_full_name} · {STATUS_LABEL[o.status]}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" onClick={() => openPrint(o, "invoice")}>Invoice</Button>
                        <Button size="sm" variant="outline" onClick={() => openPrint(o, "packing")}>Packing</Button>
                        <Button size="sm" variant="outline" onClick={() => openPrint(o, "label")}>Label</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <SiteFooter />

      <SupplierPrintDialog
        open={!!printType && !!printOrder}
        type={printType}
        order={printOrder}
        items={printOrder ? (items[printOrder.id] ?? []) : []}
        supplier={supplier ?? { id: "", name: supplierName, contact_email: user.email ?? null, contact_phone: null, address: null }}
        onClose={() => { setPrintType(null); setPrintOrder(null); }}
      />
    </div>
  );
}
