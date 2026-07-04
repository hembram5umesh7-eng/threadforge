import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://apiv2.shiprocket.in";
const ITEM_WEIGHT_KG = 0.5;
const PKG_LENGTH = 30;
const PKG_BREADTH = 25;
const PKG_HEIGHT = 5;

let cachedToken: { value: string; expiresAt: number } | null = null;

function shiprocketConfig() {
  const email = process.env.SHIPROCKET_API_EMAIL;
  const password = process.env.SHIPROCKET_API_PASSWORD;
  if (!email || !password) throw new Error("Shiprocket not configured. Add SHIPROCKET_API_EMAIL and SHIPROCKET_API_PASSWORD to .env");
  return {
    email,
    password,
    pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
  };
}

async function shiprocketFetch<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = init;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...rest, headers });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }
  if (!res.ok) {
    const msg =
      (body as { message?: string }).message ||
      (body as { error?: string }).error ||
      text ||
      `Shiprocket API error ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

async function getShiprocketToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const { email, password } = shiprocketConfig();
  const data = await shiprocketFetch<{ token?: string }>("/v1/external/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!data.token) throw new Error("Shiprocket login failed — no token returned");

  cachedToken = { value: data.token, expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000 };
  return data.token;
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || "Customer", last: parts.slice(1).join(" ") || "." };
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits.padStart(10, "0").slice(-10);
}

function paymentMode(method: string, paymentStatus: string): "COD" | "Prepaid" {
  if (paymentStatus === "paid" || method === "razorpay") return "Prepaid";
  return "COD";
}

async function assertShipmentAccess(userId: string, order: { manufacturer_id: string | null }) {
  const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  const roleList = (roles ?? []).map((r) => r.role);
  if (roleList.includes("admin") || roleList.includes("staff")) return;

  if (roleList.includes("manufacturer")) {
    const { data: mfr } = await supabaseAdmin
      .from("manufacturers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (mfr?.id && order.manufacturer_id === mfr.id) return;
  }
  throw new Error("Forbidden: you cannot ship this order");
}

type OrderItem = {
  product_name: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  customization_price: number;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  shipping_fee: number;
  total: number;
  payment_method: string;
  payment_status: string;
  ship_full_name: string;
  ship_phone: string;
  ship_line1: string;
  ship_line2: string | null;
  ship_city: string;
  ship_state: string;
  ship_pincode: string;
  ship_country: string;
  manufacturer_id: string | null;
  tracking_id: string | null;
  shiprocket_order_id: number | null;
  shiprocket_shipment_id: number | null;
  courier_name: string | null;
  shiprocket_label_url: string | null;
  created_at: string;
};

const shipmentInput = z.object({ orderId: z.string().uuid() });

export const createShiprocketShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => shipmentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .select(`
        id, order_number, status, subtotal, shipping_fee, total, payment_method, payment_status,
        ship_full_name, ship_phone, ship_line1, ship_line2, ship_city, ship_state, ship_pincode, ship_country,
        manufacturer_id, tracking_id, shiprocket_order_id, shiprocket_shipment_id, courier_name, shiprocket_label_url, created_at
      `)
      .eq("id", data.orderId)
      .single();

    if (oErr || !order) throw new Error("Order not found");
    await assertShipmentAccess(context.userId, order as OrderRow);

    const ord = order as OrderRow;

    if (ord.tracking_id && ord.shiprocket_label_url) {
      return {
        awb: ord.tracking_id,
        courier: ord.courier_name,
        labelUrl: ord.shiprocket_label_url,
        shiprocketOrderId: ord.shiprocket_order_id,
        shiprocketShipmentId: ord.shiprocket_shipment_id,
        alreadyCreated: true,
      };
    }

    const { data: items, error: iErr } = await supabaseAdmin
      .from("order_items")
      .select("product_name, size, color, quantity, unit_price, customization_price")
      .eq("order_id", data.orderId);
    if (iErr) throw new Error(iErr.message);
    const lineItems = (items ?? []) as OrderItem[];
    if (!lineItems.length) throw new Error("Order has no items");

    const token = await getShiprocketToken();
    const { pickupLocation } = shiprocketConfig();
    const billing = splitName(ord.ship_full_name);
    const phone = normalizePhone(ord.ship_phone);
    const address = [ord.ship_line1, ord.ship_line2].filter(Boolean).join(", ");
    const totalWeight = Math.max(
      0.5,
      lineItems.reduce((sum, it) => sum + ITEM_WEIGHT_KG * it.quantity, 0),
    );
    const payMode = paymentMode(ord.payment_method, ord.payment_status);

    let shiprocketOrderId = ord.shiprocket_order_id;
    let shiprocketShipmentId = ord.shiprocket_shipment_id;

    if (!shiprocketShipmentId) {
      const createRes = await shiprocketFetch<{
        order_id?: number;
        shipment_id?: number;
        status?: string;
      }>("/v1/external/orders/create/adhoc", {
        method: "POST",
        token,
        body: JSON.stringify({
          order_id: ord.order_number,
          order_date: ord.created_at.slice(0, 16).replace("T", " "),
          pickup_location: pickupLocation,
          billing_customer_name: billing.first,
          billing_last_name: billing.last,
          billing_address: address,
          billing_city: ord.ship_city,
          billing_pincode: ord.ship_pincode,
          billing_state: ord.ship_state,
          billing_country: ord.ship_country || "India",
          billing_phone: phone,
          shipping_is_billing: true,
          order_items: lineItems.map((it, idx) => ({
            name: `${it.product_name} (${it.size}/${it.color})`,
            sku: `${ord.order_number}-${idx + 1}`,
            units: it.quantity,
            selling_price: Number(it.unit_price) + Number(it.customization_price),
            weight: ITEM_WEIGHT_KG,
          })),
          payment_method: payMode,
          sub_total: Number(ord.subtotal),
          shipping_charges: Number(ord.shipping_fee),
          total_discount: 0,
          length: PKG_LENGTH,
          breadth: PKG_BREADTH,
          height: PKG_HEIGHT,
          weight: totalWeight,
        }),
      });

      shiprocketOrderId = createRes.order_id ?? shiprocketOrderId;
      shiprocketShipmentId = createRes.shipment_id ?? null;
      if (!shiprocketShipmentId) throw new Error("Shiprocket order created but no shipment ID returned");
    }

    const awbRes = await shiprocketFetch<{
      awb_assign_status?: number;
      response?: { data?: { awb_code?: string; courier_name?: string } };
    }>("/v1/external/courier/assign/awb", {
      method: "POST",
      token,
      body: JSON.stringify({ shipment_id: shiprocketShipmentId }),
    });

    const awb = awbRes.response?.data?.awb_code;
    const courier = awbRes.response?.data?.courier_name ?? null;
    if (!awb) throw new Error("AWB assignment failed — check Shiprocket wallet & pickup address");

    const labelRes = await shiprocketFetch<{ label_url?: string; label_created?: number }>(
      "/v1/external/courier/generate/label",
      {
        method: "POST",
        token,
        body: JSON.stringify({ shipment_id: [shiprocketShipmentId] }),
      },
    );

    const labelUrl = labelRes.label_url ?? null;

    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({
        tracking_id: awb,
        courier_name: courier,
        shiprocket_order_id: shiprocketOrderId,
        shiprocket_shipment_id: shiprocketShipmentId,
        shiprocket_label_url: labelUrl,
        status: "shipped",
      })
      .eq("id", data.orderId);
    if (updErr) throw new Error(`Order update failed: ${updErr.message}`);

    return {
      awb,
      courier,
      labelUrl,
      shiprocketOrderId,
      shiprocketShipmentId,
      alreadyCreated: false,
    };
  });

export const trackShiprocketShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => shipmentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, tracking_id, manufacturer_id, user_id")
      .eq("id", data.orderId)
      .single();
    if (error || !order) throw new Error("Order not found");

    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);
    const roleList = (roles ?? []).map((r) => r.role);
    const isStaff = roleList.includes("admin") || roleList.includes("staff");
    const isOwner = order.user_id === context.userId;
    if (!isStaff && !isOwner) {
      await assertShipmentAccess(context.userId, order);
    }

    if (!order.tracking_id) throw new Error("No AWB / tracking ID on this order yet");

    const token = await getShiprocketToken();
    const track = await shiprocketFetch<{
      tracking_data?: { track_status?: number; shipment_status?: string; shipment_track?: unknown[] };
    }>(`/v1/external/courier/track/awb/${encodeURIComponent(order.tracking_id)}`, { token });

    return {
      awb: order.tracking_id,
      tracking: track.tracking_data ?? null,
    };
  });
