import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { formatINR, STATUS_LABEL, type OrderStatus } from "@/lib/order-utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, X } from "lucide-react";

export interface SupplierProfile {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
}

export interface InvoiceOrder {
  id: string;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  shipping_fee: number;
  total: number;
  payment_method: string;
  payment_status: string;
  tracking_id: string | null;
  created_at: string;
  ship_full_name: string;
  ship_phone: string;
  ship_line1: string;
  ship_line2: string | null;
  ship_city: string;
  ship_state: string;
  ship_pincode: string;
  ship_country: string;
}

export interface InvoiceItem {
  id: string;
  product_name: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  customization_price: number;
}

export type PrintDocType = "invoice" | "packing" | "label";

function Barcode({ value, className }: { value: string; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        width: 1.6,
        height: 48,
        displayValue: true,
        fontSize: 12,
        margin: 4,
      });
    } catch {
      /* invalid barcode value */
    }
  }, [value]);
  if (!value) return null;
  return <svg ref={ref} className={className} />;
}

function PrintBody({
  type,
  order,
  items,
  supplier,
}: {
  type: PrintDocType;
  order: InvoiceOrder;
  items: InvoiceItem[];
  supplier: SupplierProfile;
}) {
  const docTitle =
    type === "invoice" ? "Tax Invoice / Proforma" : type === "packing" ? "Packing Slip" : "Shipping Label";
  const lineTotal = (it: InvoiceItem) =>
    (Number(it.unit_price) + Number(it.customization_price)) * it.quantity;

  return (
    <div className="supplier-print-sheet bg-white text-black p-6 text-sm leading-relaxed">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .supplier-print-portal, .supplier-print-portal * { visibility: visible !important; }
          .supplier-print-portal { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex justify-between items-start border-b pb-4 mb-4 gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500">{docTitle}</p>
          <h1 className="text-xl font-bold mt-1">{supplier.name}</h1>
          {supplier.address && <p className="text-gray-600 mt-1">{supplier.address}</p>}
          <p className="text-gray-600">{supplier.contact_email ?? "—"} · {supplier.contact_phone ?? "—"}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg">{order.order_number}</p>
          <p className="text-gray-600">{new Date(order.created_at).toLocaleString("en-IN")}</p>
          <p className="text-xs mt-1 px-2 py-0.5 inline-block bg-gray-100 rounded">{STATUS_LABEL[order.status]}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="border rounded p-3">
          <p className="text-xs font-bold uppercase text-gray-500 mb-1">Ship To</p>
          <p className="font-semibold">{order.ship_full_name}</p>
          <p>{order.ship_phone}</p>
          <p>{order.ship_line1}{order.ship_line2 ? `, ${order.ship_line2}` : ""}</p>
          <p>{order.ship_city}, {order.ship_state} — {order.ship_pincode}</p>
          <p>{order.ship_country}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-xs font-bold uppercase text-gray-500 mb-1">Order Info</p>
          <p>Payment: {order.payment_method.toUpperCase()} · {order.payment_status}</p>
          {order.tracking_id && <p>Tracking: <strong>{order.tracking_id}</strong></p>}
          {type !== "label" && (
            <>
              <p className="mt-2">Subtotal: {formatINR(Number(order.subtotal))}</p>
              <p>Shipping: {formatINR(Number(order.shipping_fee))}</p>
              <p className="font-bold text-base mt-1">Total: {formatINR(Number(order.total))}</p>
            </>
          )}
        </div>
      </div>

      {type !== "label" && (
        <table className="w-full border-collapse mb-4 text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-2">Item</th>
              <th className="text-left p-2">Variant</th>
              <th className="text-right p-2">Qty</th>
              {type === "invoice" && <th className="text-right p-2">Amount</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b">
                <td className="p-2 font-medium">{it.product_name}</td>
                <td className="p-2 text-gray-600">Size {it.size} · {it.color}</td>
                <td className="p-2 text-right">{it.quantity}</td>
                {type === "invoice" && (
                  <td className="p-2 text-right">{formatINR(lineTotal(it))}</td>
                )}
              </tr>
            ))}
          </tbody>
          {type === "invoice" && (
            <tfoot>
              <tr>
                <td colSpan={3} className="p-2 text-right font-semibold">Grand Total</td>
                <td className="p-2 text-right font-bold">{formatINR(Number(order.total))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 border-t pt-4">
        <div>
          <p className="text-xs font-bold uppercase text-gray-500 mb-2">Order Barcode (warehouse scan)</p>
          <Barcode value={order.order_number} />
        </div>
        {order.tracking_id && (
          <div>
            <p className="text-xs font-bold uppercase text-gray-500 mb-2">Tracking Barcode</p>
            <Barcode value={order.tracking_id} />
          </div>
        )}
      </div>

      {type === "invoice" && (
        <p className="text-xs text-gray-500 mt-6 border-t pt-3">
          Proforma invoice from {supplier.name} via ThreadForge. For GST billing, export to your registered system.
        </p>
      )}
      {type === "packing" && (
        <p className="text-xs text-gray-500 mt-6">Pack all items. Affix shipping label before dispatch.</p>
      )}
    </div>
  );
}

export function SupplierPrintDialog({
  open,
  type,
  order,
  items,
  supplier,
  onClose,
}: {
  open: boolean;
  type: PrintDocType | null;
  order: InvoiceOrder | null;
  items: InvoiceItem[];
  supplier: SupplierProfile | null;
  onClose: () => void;
}) {
  if (!open || !type || !order || !supplier) return null;

  const titles: Record<PrintDocType, string> = {
    invoice: "Print Invoice",
    packing: "Print Packing Slip",
    label: "Print Shipping Label",
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto supplier-print-portal">
        <DialogHeader className="no-print">
          <DialogTitle>{titles[type]} — {order.order_number}</DialogTitle>
        </DialogHeader>
        <PrintBody type={type} order={order} items={items} supplier={supplier} />
        <DialogFooter className="no-print gap-2">
          <Button variant="outline" onClick={onClose}><X className="h-4 w-4" /> Close</Button>
          <Button onClick={() => window.print()} className="font-bold"><Printer className="h-4 w-4" /> Print</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
