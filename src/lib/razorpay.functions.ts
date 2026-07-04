import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const createOrderInput = z.object({ orderId: z.string().uuid() });

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createOrderInput.parse(input))
  .handler(async ({ data, context }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("Razorpay keys not configured");

    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, order_number, total, user_id, payment_status")
      .eq("id", data.orderId)
      .single();
    if (error || !order) throw new Error("Order not found");
    if (order.user_id !== userId) throw new Error("Forbidden");
    if (order.payment_status === "paid") throw new Error("Order already paid");

    const amountPaise = Math.round(Number(order.total) * 100);
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: order.order_number,
        notes: { order_id: order.id, user_id: userId },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Razorpay order create failed [${res.status}]: ${t}`);
    }
    const rzp = (await res.json()) as { id: string; amount: number; currency: string };
    return {
      keyId,
      razorpayOrderId: rzp.id,
      amount: rzp.amount,
      currency: rzp.currency,
      orderNumber: order.order_number,
    };
  });

const verifyInput = z.object({
  orderId: z.string().uuid(),
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().min(1).max(256),
});

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => verifyInput.parse(input))
  .handler(async ({ data, context }) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error("Razorpay secret not configured");
    const { userId } = context;

    // Verify signature
    const expected = createHmac("sha256", keySecret)
      .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
      .digest("hex");
    const sigBuf = Buffer.from(data.razorpay_signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      throw new Error("Invalid payment signature");
    }

    // Look up order via admin (RLS bypass) — but verify ownership ourselves
    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, total")
      .eq("id", data.orderId)
      .single();
    if (oErr || !order) throw new Error("Order not found");
    if (order.user_id !== userId) throw new Error("Forbidden");

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: "paid", payment_method: "razorpay" })
      .eq("id", data.orderId);
    if (updErr) throw new Error(`Order update failed: ${updErr.message}`);

    await supabaseAdmin.from("payments").insert({
      order_id: data.orderId,
      provider: "razorpay",
      provider_payment_id: data.razorpay_payment_id,
      amount: order.total,
      status: "paid",
    });

    return { success: true };
  });
