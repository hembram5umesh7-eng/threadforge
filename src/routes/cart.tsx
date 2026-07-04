import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-context";
import { formatINR } from "@/lib/order-utils";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/cart")({ component: CartPage });

function CartPage() {
  const { items, remove, updateQty, subtotal } = useCart();
  const navigate = useNavigate();
  const shipping = subtotal > 999 || subtotal === 0 ? 0 : 79;
  const total = subtotal + shipping;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold mb-6">Your Cart ({items.length})</h1>
        {items.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">Your cart is empty</p>
            <Button asChild><Link to="/">Start Shopping</Link></Button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_360px] gap-8">
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="flex gap-4 p-4 bg-card border rounded-xl">
                  <div className="w-20 h-24 rounded-lg bg-muted overflow-hidden shrink-0">
                    {it.productImage && (
                      <img src={it.productImage} alt={it.productName} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{it.productName}</h3>
                    <p className="text-xs text-muted-foreground">Size {it.size} · {it.color}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button onClick={() => updateQty(it.id, it.quantity - 1)} className="w-7 h-7 rounded-full border flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                      <span className="font-semibold text-sm w-6 text-center">{it.quantity}</span>
                      <button onClick={() => updateQty(it.id, it.quantity + 1)} className="w-7 h-7 rounded-full border flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatINR(it.basePrice * it.quantity)}</p>
                    <button onClick={() => remove(it.id)} className="mt-2 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card border rounded-xl p-5 h-fit sticky top-24">
              <h2 className="font-bold text-lg mb-3">Order Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? <span className="text-success font-semibold">FREE</span> : formatINR(shipping)}</span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between font-extrabold text-lg">
                  <span>Total</span><span>{formatINR(total)}</span>
                </div>
              </div>
              <Button size="lg" className="w-full mt-4 font-bold" onClick={() => navigate({ to: "/checkout" })}>
                Proceed to Checkout
              </Button>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
