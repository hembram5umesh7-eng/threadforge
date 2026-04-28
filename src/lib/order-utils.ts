export const ORDER_STATUSES = [
  "received",
  "processing",
  "sent_to_manufacturer",
  "in_production",
  "completed",
  "packed",
  "shipped",
  "delivered",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number] | "cancelled";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  received: "Order Received",
  processing: "Processing",
  sent_to_manufacturer: "Sent to Manufacturer",
  in_production: "In Production",
  completed: "Manufacturing Complete",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function statusIndex(s: OrderStatus): number {
  const idx = (ORDER_STATUSES as readonly string[]).indexOf(s);
  return idx;
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}
