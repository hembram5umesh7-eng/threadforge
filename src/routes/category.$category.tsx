import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { fetchCategoryBySlug } from "@/lib/categories";

export const Route = createFileRoute("/category/$category")({ component: CategoryPage });

function CategoryPage() {
  const { category } = useParams({ from: "/category/$category" });
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchCategoryBySlug(category),
      supabase
        .from("products")
        .select("id,name,slug,base_price,images,category")
        .eq("active", true)
        .eq("category", category),
    ]).then(([cat, { data }]) => {
      setTitle(cat?.name ?? category);
      setDescription(cat?.description ?? null);
      setProducts((data as ProductCardData[]) ?? []);
      setLoading(false);
    });
  }, [category]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-extrabold mb-1">{title}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {description ?? `${products.length} products`}
        </p>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No products in this category yet.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
