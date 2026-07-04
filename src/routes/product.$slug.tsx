import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-context";
import { formatINR } from "@/lib/order-utils";
import { ShoppingBag, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/product/$slug")({ component: ProductPage });

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  fabric: string | null;
  images: string[] | null;
  category: string;
}
interface Variant { id: string; size: string; color: string; color_hex: string; stock: number }

function ProductPage() {
  const { slug } = useParams({ from: "/product/$slug" });
  const navigate = useNavigate();
  const cart = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("products").select("*").eq("slug", slug).maybeSingle();
      if (p) {
        setProduct(p as Product);
        const { data: vs } = await supabase.from("product_variants").select("*").eq("product_id", p.id);
        setVariants((vs as Variant[]) ?? []);
      }
    })();
  }, [slug]);

  const sizes = useMemo(() => Array.from(new Set(variants.map((v) => v.size))), [variants]);
  const colors = useMemo(() => {
    const seen = new Map<string, Variant>();
    variants.forEach((v) => { if (!seen.has(v.color)) seen.set(v.color, v); });
    return Array.from(seen.values());
  }, [variants]);
  const selectedVariant = useMemo(
    () => variants.find((v) => v.size === size && v.color === color) ?? null,
    [variants, size, color]
  );

  if (!product) return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader /><div className="flex-1 container mx-auto px-4 py-12">Loading…</div><SiteFooter />
    </div>
  );

  const addToCart = (buyNow = false) => {
    if (!size || !color) { toast.error("Pick a size and color"); return; }
    cart.add({
      id: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      productImage: product.images?.[0] ?? "",
      size, color,
      colorHex: selectedVariant?.color_hex ?? "#000",
      variantId: selectedVariant?.id ?? null,
      basePrice: product.base_price,
      quantity: 1,
    });
    toast.success("Added to cart");
    if (buyNow) navigate({ to: "/cart" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <div className="aspect-[3/4] bg-muted rounded-2xl overflow-hidden">
              {product.images?.[imgIdx] && (
                <img src={product.images[imgIdx]} alt={product.name} className="w-full h-full object-cover" />
              )}
            </div>
            {(product.images?.length ?? 0) > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
                {product.images!.map((src, i) => (
                  <button key={i} onClick={() => setImgIdx(i)}
                    className={`shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${i === imgIdx ? "border-primary" : "border-transparent"}`}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{product.category}</p>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-1">{product.name}</h1>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold">{formatINR(product.base_price)}</span>
              <span className="text-lg text-muted-foreground line-through">{formatINR(Math.round(product.base_price * 1.6))}</span>
              <span className="text-sm font-bold text-success">38% OFF</span>
            </div>
            <p className="text-xs text-success font-semibold mt-1">inclusive of all taxes</p>

            {product.fabric && (
              <div className="mt-6 p-3 bg-secondary rounded-lg">
                <p className="text-xs uppercase font-bold text-muted-foreground">Fabric</p>
                <p className="text-sm font-semibold">{product.fabric}</p>
              </div>
            )}

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold uppercase">Select Size</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button key={s} onClick={() => setSize(s)}
                    className={`min-w-12 h-12 px-3 rounded-full border-2 text-sm font-bold transition-colors ${
                      size === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-bold uppercase mb-2">Color {color && <span className="text-muted-foreground font-normal">— {color}</span>}</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button key={c.color} onClick={() => setColor(c.color)} title={c.color}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${color === c.color ? "border-primary scale-110" : "border-border"}`}
                    style={{ backgroundColor: c.color_hex }} />
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="flex-1 font-bold" onClick={() => addToCart(false)}>
                <ShoppingBag className="mr-2 h-5 w-5" /> Add to Cart
              </Button>
              <Button size="lg" variant="secondary" className="flex-1 font-bold" onClick={() => addToCart(true)}>
                <Zap className="mr-2 h-5 w-5" /> Buy Now
              </Button>
            </div>

            {product.description && (
              <div className="mt-8 prose prose-sm max-w-none">
                <h3 className="font-bold uppercase text-sm">Product Details</h3>
                <p className="text-sm text-muted-foreground">{product.description}</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
