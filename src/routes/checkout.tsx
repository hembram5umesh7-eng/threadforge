import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/order-utils";
import { toast } from "sonner";
import { z } from "zod";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/server/razorpay.functions";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export const Route = createFileRoute("/checkout")({ component: Checkout });

const addrSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(15).regex(/^\+?[0-9]+$/),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().min(4).max(10).regex(/^[0-9]+$/),
});

function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cart = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");

  useEffect(() => {
    if (!user) navigate({ to: "/auth", search: { redirect: "/checkout" } });
  }, [user, navigate]);

  const shipping = cart.subtotal > 999 || cart.subtotal === 0 ? 0 : 79;
  const total = cart.subtotal + shipping;

  const placeOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    if (cart.items.length === 0) { toast.error("Cart is empty"); return; }

    const fd = new FormData(e.currentTarget);
    const addrParse = addrSchema.safeParse({
      full_name: fd.get("full_name"),
      phone: fd.get("phone"),
      line1: fd.get("line1"),
      line2: fd.get("line2") || undefined,
      city: fd.get("city"),
      state: fd.get("state"),
      pincode: fd.get("pincode"),
    });
    if (!addrParse.success) { toast.error(addrParse.error.issues[0].message); return; }
    const a = addrParse.data;

    setSubmitting(true);
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        status: "received",
        payment_method: paymentMethod === "cod" ? "cod" : "razorpay",
        payment_status: paymentMethod === "cod" ? "pending" : "pending",
        subtotal: cart.subtotal,
        shipping_fee: shipping,
        total,
        ship_full_name: a.full_name,
        ship_phone: a.phone,
        ship_line1: a.line1,
        ship_line2: a.line2 ?? null,
        ship_city: a.city,
        ship_state: a.state,
        ship_pincode: a.pincode,
        ship_country: "India",
      })
      .select("id, order_number")
      .single();

    if (orderErr || !order) {
      setSubmitting(false);
      toast.error(orderErr?.message ?? "Order failed");
      return;
    }

    const itemRows = cart.items.map((it) => ({
      order_id: order.id,
      product_id: it.productId,
      variant_id: it.variantId,
      product_name: it.productName,
      size: it.size,
      color: it.color,
      quantity: it.quantity,
      unit_price: it.basePrice,
      customization_price: it.customizationPrice,
      design_data: (it.designData as never) ?? null,
      preview_front_url: it.previewFront ?? null,
      preview_back_url: it.previewBack ?? null,
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(itemRows);
    if (itemsErr) {
      setSubmitting(false);
      toast.error(itemsErr.message);
      return;
    }

    if (paymentMethod === "online") {
      const ok = await loadRazorpayScript();
      if (!ok) {
        setSubmitting(false);
        toast.error("Failed to load payment gateway");
        return;
      }
      try {
        const rzp = await createRzpOrder({ data: { orderId: order.id } });
        const options = {
          key: rzp.keyId,
          amount: rzp.amount,
          currency: rzp.currency,
          name: "ThreadForge",
          description: `Order ${rzp.orderNumber}`,
          order_id: rzp.razorpayOrderId,
          prefill: { name: a.full_name, contact: a.phone, email: user.email ?? "" },
          theme: { color: "#ff3f6c" },
          handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              await verifyRzpPayment({
                data: {
                  orderId: order.id,
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_payment_id: resp.razorpay_payment_id,
                  razorpay_signature: resp.razorpay_signature,
                },
              });
              cart.clear();
              toast.success(`Payment successful · Order ${order.order_number}`);
              navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Payment verification failed");
              setSubmitting(false);
            }
          },
          modal: {
            ondismiss: () => {
              setSubmitting(false);
              toast.message("Payment cancelled. Your order is saved as unpaid.");
              navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
            },
          },
        };
        if (!window.Razorpay) throw new Error("Razorpay unavailable");
        new window.Razorpay(options).open();
      } catch (err) {
        setSubmitting(false);
        toast.error(err instanceof Error ? err.message : "Could not start payment");
      }
      return;
    }

    cart.clear();
    toast.success(`Order ${order.order_number} placed!`);
    navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
  };

  if (!user || cart.items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader /><div className="flex-1 container mx-auto px-4 py-12">Loading…</div><SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold mb-6">Checkout</h1>
        <form onSubmit={placeOrder} className="grid lg:grid-cols-[1fr_360px] gap-8">
          <div className="space-y-6">
            <section className="bg-card border rounded-xl p-5">
              <h2 className="font-bold mb-4">Shipping Address</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2"><Label>Full Name</Label><Input name="full_name" required /></div>
                <div><Label>Phone</Label><Input name="phone" required pattern="[0-9+]+" /></div>
                <div><Label>Pincode</Label><Input name="pincode" required pattern="[0-9]+" /></div>
                <div className="sm:col-span-2"><Label>Address Line 1</Label><Input name="line1" required /></div>
                <div className="sm:col-span-2"><Label>Address Line 2 (optional)</Label><Input name="line2" /></div>
                <div><Label>City</Label><Input name="city" required /></div>
                <div><Label>State</Label><Input name="state" required /></div>
              </div>
            </section>

            <section className="bg-card border rounded-xl p-5">
              <h2 className="font-bold mb-4">Payment Method</h2>
              <div className="space-y-2">
                <label className={`flex gap-3 p-3 rounded-lg border-2 cursor-pointer ${paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <input type="radio" name="pay" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} />
                  <div>
                    <p className="font-semibold text-sm">Cash on Delivery</p>
                    <p className="text-xs text-muted-foreground">Pay when you receive your order</p>
                  </div>
                </label>
                <label className={`flex gap-3 p-3 rounded-lg border-2 cursor-not-allowed opacity-60 ${paymentMethod === "online" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <input type="radio" name="pay" value="online" disabled />
                  <div>
                    <p className="font-semibold text-sm">Razorpay / Stripe (coming soon)</p>
                    <p className="text-xs text-muted-foreground">Online card / UPI payments</p>
                  </div>
                </label>
              </div>
            </section>
          </div>

          <aside className="bg-card border rounded-xl p-5 h-fit sticky top-24">
            <h2 className="font-bold mb-3">Summary ({cart.items.length} items)</h2>
            <div className="space-y-1 text-sm max-h-48 overflow-y-auto">
              {cart.items.map((it) => (
                <div key={it.id} className="flex justify-between gap-2">
                  <span className="truncate">{it.productName} × {it.quantity}</span>
                  <span>{formatINR((it.basePrice + it.customizationPrice) * it.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t mt-3 pt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(cart.subtotal)}</span></div>
              <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? "FREE" : formatINR(shipping)}</span></div>
              <div className="flex justify-between font-extrabold text-lg pt-2 border-t mt-2"><span>Total</span><span>{formatINR(total)}</span></div>
            </div>
            <Button type="submit" size="lg" className="w-full mt-4 font-bold" disabled={submitting}>
              {submitting ? "Placing order…" : "Place Order"}
            </Button>
            <p className="text-xs text-destructive font-semibold mt-3 text-center">⚠ No refunds on customized products</p>
          </aside>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
