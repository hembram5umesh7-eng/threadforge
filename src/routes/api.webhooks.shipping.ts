import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { OrderStatus } from "@/lib/order-utils";

type WebhookPayload = {
  awb?: string;
  courier_name?: string;
  current_status?: string;
  shipment_status?: string;
  order_id?: string;
  sr_order_id?: number;
  scans?: { "sr-status-label"?: string }[];
};

function mapShiprocketStatus(payload: WebhookPayload): OrderStatus | null {
  const label =
    payload.current_status ||
    payload.shipment_status ||
    payload.scans?.at(-1)?.["sr-status-label"] ||
    "";
  const upper = label.toUpperCase();
  if (upper.includes("DELIVERED")) return "delivered";
  if (
    upper.includes("SHIPPED") ||
    upper.includes("TRANSIT") ||
    upper.includes("PICKED") ||
    upper.includes("OUT FOR DELIVERY") ||
    upper.includes("MANIFEST")
  ) {
    return "shipped";
  }
  return null;
}

export const Route = createFileRoute("/api/webhooks/shipping")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.SHIPROCKET_WEBHOOK_SECRET;
        if (secret) {
          const key = request.headers.get("x-api-key");
          if (key !== secret) return new Response("Unauthorized", { status: 401 });
        }

        let payload: WebhookPayload;
        try {
          payload = (await request.json()) as WebhookPayload;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const awb = payload.awb?.trim();
        const orderNumber = payload.order_id?.split("_")[0]?.trim();
        const nextStatus = mapShiprocketStatus(payload);

        if (awb) {
          const { data: byAwb } = await supabaseAdmin
            .from("orders")
            .select("id, status")
            .eq("tracking_id", awb)
            .maybeSingle();

          if (byAwb) {
            await supabaseAdmin
              .from("orders")
              .update({
                courier_name: payload.courier_name ?? undefined,
                shiprocket_order_id: payload.sr_order_id ?? undefined,
                ...(nextStatus ? { status: nextStatus } : {}),
              })
              .eq("id", byAwb.id);
            return Response.json({ ok: true, matched: "awb" });
          }
        }

        if (orderNumber) {
          const { data: byOrder } = await supabaseAdmin
            .from("orders")
            .select("id")
            .eq("order_number", orderNumber)
            .maybeSingle();

          if (byOrder) {
            await supabaseAdmin
              .from("orders")
              .update({
                tracking_id: awb ?? undefined,
                courier_name: payload.courier_name ?? undefined,
                shiprocket_order_id: payload.sr_order_id ?? undefined,
                ...(nextStatus ? { status: nextStatus } : {}),
              })
              .eq("id", byOrder.id);
            return Response.json({ ok: true, matched: "order_number" });
          }
        }

        return Response.json({ ok: true, matched: null });
      },
    },
  },
  component: () => null,
});
