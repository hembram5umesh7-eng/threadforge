import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatINR } from "@/lib/order-utils";
import { Plus, Pencil, Trash2, Image as ImageIcon, Layers } from "lucide-react";
import { toast } from "sonner";
import { MultiImageUpload } from "@/components/image-upload";
import { VariantMatrixEditor } from "@/components/variant-matrix-editor";
import { summarizeVariants } from "@/lib/product-variants";

export const Route = createFileRoute("/admin/products")({ component: AdminProducts });

interface CategoryOption {
  slug: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  base_price: number;
  fabric: string | null;
  images: string[];
  active: boolean;
}

interface Variant {
  id: string;
  product_id: string;
  size: string;
  color: string;
  color_hex: string;
  stock: number;
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);

function emptyProduct(defaultCategory = "tshirt"): Omit<Product, "id"> {
  return {
    name: "",
    slug: "",
    description: "",
    category: defaultCategory,
    base_price: 499,
    fabric: "",
    images: [],
    active: true,
  };
}

function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [variants, setVariants] = useState<Record<string, Variant[]>>({});
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<{ id?: string; data: Omit<Product, "id"> } | null>(null);
  const [variantsOpen, setVariantsOpen] = useState<string | null>(null);

  const loadCategories = async () => {
    const { data, error } = await supabase.from("categories").select("slug,name").order("sort_order");
    if (error) { toast.error(error.message); return; }
    setCategories((data as CategoryOption[]) ?? []);
  };

  const refresh = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,slug,description,category,base_price,fabric,images,active")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    const list = (data ?? []) as Product[];
    setProducts(list);
    if (list.length) {
      const { data: vs } = await supabase
        .from("product_variants")
        .select("id,product_id,size,color,color_hex,stock")
        .in("product_id", list.map((p) => p.id));
      const grouped: Record<string, Variant[]> = {};
      ((vs ?? []) as Variant[]).forEach((v) => {
        (grouped[v.product_id] ??= []).push(v);
      });
      setVariants(grouped);
    }
  };

  const loadVariants = async (productId: string) => {
    const { data, error } = await supabase
      .from("product_variants")
      .select("id,product_id,size,color,color_hex,stock")
      .eq("product_id", productId)
      .order("created_at", { ascending: true });
    if (error) { toast.error(error.message); return; }
    setVariants((v) => ({ ...v, [productId]: (data ?? []) as Variant[] }));
  };

  useEffect(() => {
    loadCategories();
    refresh();
  }, []);

  const categoryLabel = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.slug.includes(q) || p.category.includes(q));
  }, [products, filter]);

  const startNew = () => setEditing({ data: emptyProduct(categories[0]?.slug ?? "other") });
  const startEdit = (p: Product) => setEditing({ id: p.id, data: { ...p, description: p.description ?? "", fabric: p.fabric ?? "" } });

  const save = async () => {
    if (!editing) return;
    const d = editing.data;
    if (!d.name.trim()) { toast.error("Name required"); return; }
    if (Number(d.base_price) <= 0) { toast.error("Base price must be > 0"); return; }
    const slug = d.slug.trim() || slugify(d.name);
    const payload = {
      ...d,
      slug,
      description: d.description?.trim() || null,
      fabric: d.fabric?.trim() || null,
      images: (d.images ?? []).filter((s) => s.trim().length > 0),
    };
    if (editing.id) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Product updated");
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Product created");
    }
    setEditing(null);
    refresh();
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? Variants will also be removed.`)) return;
    await supabase.from("product_variants").delete().eq("product_id", p.id);
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    refresh();
  };

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success(p.active ? "Hidden" : "Live"); refresh(); }
  };

  return (
    <AdminShell
      title="Products"
      subtitle="Manage catalog, images, and variants."
      actions={
        <Button onClick={startNew} className="font-bold"><Plus className="h-4 w-4" /> New Product</Button>
      }
    >
        <div className="mb-4">
          <Input placeholder="Search by name, slug, or category…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-md" />
        </div>

        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/40 border-b">
                <tr>
                  <th className="text-left p-3">Product</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-left p-3">Variants</th>
                  <th className="text-left p-3">Price</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-12 rounded bg-muted overflow-hidden shrink-0">
                          {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground truncate">/{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{categoryLabel(p.category)}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => { setVariantsOpen(p.id); loadVariants(p.id); }}
                        className="text-xs text-left text-primary hover:underline font-semibold"
                      >
                        {summarizeVariants(variants[p.id] ?? [])}
                      </button>
                    </td>
                    <td className="p-3 font-semibold">{formatINR(Number(p.base_price))}</td>
                    <td className="p-3">
                      <button onClick={() => toggleActive(p)} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                        {p.active ? "● LIVE" : "○ HIDDEN"}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => { setVariantsOpen(p.id); loadVariants(p.id); }} title="Variants">
                          <Layers className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(p)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(p)} title="Delete" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No products. Click <strong>+ New Product</strong> to add one.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      {editing && (
        <ProductEditor
          categories={categories}
          value={editing.data}
          isNew={!editing.id}
          onChange={(d) => setEditing({ ...editing, data: d })}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}

      {variantsOpen && (
        <VariantMatrixEditor
          productId={variantsOpen}
          productName={products.find((p) => p.id === variantsOpen)?.name ?? "Product"}
          variants={variants[variantsOpen] ?? []}
          onClose={() => setVariantsOpen(null)}
          onChanged={() => { loadVariants(variantsOpen); refresh(); }}
        />
      )}
    </AdminShell>
  );
}

function ProductEditor({
  categories,
  value, isNew, onChange, onClose, onSave,
}: {
  categories: CategoryOption[];
  value: Omit<Product, "id">;
  isNew: boolean;
  onChange: (d: Omit<Product, "id">) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = <K extends keyof Omit<Product, "id">>(k: K, v: Omit<Product, "id">[K]) => onChange({ ...value, [k]: v });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "New Product" : `Edit: ${value.name}`}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="Oversized Cotton Tee" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={value.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto from name" />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={value.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={3} />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>Category</Label>
              <select value={value.category} onChange={(e) => set("category", e.target.value)} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
                {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Base Price (₹) *</Label>
              <Input type="number" min={1} value={value.base_price} onChange={(e) => set("base_price", Number(e.target.value))} />
            </div>
            <div>
              <Label>Fabric</Label>
              <Input value={value.fabric ?? ""} onChange={(e) => set("fabric", e.target.value)} placeholder="180 GSM Cotton" />
            </div>
          </div>

          <section className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold"><ImageIcon className="h-4 w-4" /> Product Images</div>
            <p className="text-xs text-muted-foreground">First image is the cover shown on cards.</p>
            <MultiImageUpload values={value.images} onChange={(urls) => set("images", urls)} folder="products" />
          </section>

          <div className="flex items-center justify-between border rounded-lg p-4">
            <div><p className="text-sm font-semibold">Active (visible to customers)</p></div>
            <Switch checked={value.active} onCheckedChange={(c) => set("active", c)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} className="font-bold">{isNew ? "Create" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
