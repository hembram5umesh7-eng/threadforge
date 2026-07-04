import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { ProductCard, type ProductCardData } from "@/components/product-card";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({ q: (s.q as string) ?? "" }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const [products, setProducts] = useState<ProductCardData[]>([]);

  useEffect(() => {
    if (!q) return;
    supabase
      .from("products")
      .select("id,name,slug,base_price,images,category")
      .eq("active", true)
      .ilike("name", `%${q}%`)
      .then(({ data }) => setProducts((data as ProductCardData[]) ?? []));
  }, [q]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">Search results</h1>
        <p className="text-sm text-muted-foreground mb-6">"{q}" — {products.length} results</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
