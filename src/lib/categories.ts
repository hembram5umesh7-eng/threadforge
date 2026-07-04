import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
}

const CATEGORY_COLORS = [
  "bg-brand-yellow",
  "bg-brand-mint",
  "bg-brand-violet",
  "bg-brand-coral",
  "bg-brand-pink",
] as const;

export function categoryColor(index: number) {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export function useCategories() {
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("categories")
      .select("id,name,slug,description,image_url,sort_order")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => {
        setCategories((data as StoreCategory[]) ?? []);
        setLoading(false);
      });
  }, []);

  return { categories, loading };
}

export async function fetchCategoryBySlug(slug: string) {
  const { data } = await supabase
    .from("categories")
    .select("id,name,slug,description,image_url,sort_order")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  return data as StoreCategory | null;
}
