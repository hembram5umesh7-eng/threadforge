import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatINR } from "@/lib/order-utils";
import { Plus, Pencil, Trash2, Image as ImageIcon, Layers } from "lucide-react";
import { toast } from "sonner";
import { MultiImageUpload, SingleImageUpload } from "@/components/image-upload";

export const Route = createFileRoute("/admin/products")({ component: AdminProducts });

const CATEGORIES = ["tshirt", "hoodie", "shirt", "jeans", "other"] as const;
type Category = (typeof CATEGORIES)[number];

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: Category;
  base_price: number;
  fabric: string | null;
  images: string[];
  mockup_front_url: string | null;
  mockup_back_url: string | null;
  active: boolean;
  customizable: boolean;
  allow_text: boolean;
  allow_image: boolean;
  text_price: number;
  image_price: number;
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

function emptyProduct(): Omit<Product, "id"> {
  return {
    name: "",
    slug: "",
    description: "",
    category: "tshirt",
    base_price: 499,
    fabric: "",
    images: [],
    mockup_front_url: null,
    mockup_back_url: null,
    active: true,
    customizable: true,
    allow_text: true,
    allow_image: true,
    text_price: 49,
    image_price: 99,
  };
}

function AdminProducts() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Record<string, Variant[]>>({});
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<{ id?: string; data: Omit<Product, "id"> } | null>(null);
  const [variantsOpen, setVariantsOpen] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth", search: { redirect: "/admin/products" } });
    else if (!isAdmin) navigate({ to: "/" });
  }, [user, isAdmin, loading, navigate]);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,slug,description,category,base_price,fabric,images,mockup_front_url,mockup_back_url,active,customizable,allow_text,allow_image,text_price,image_price")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setProducts((data ?? []) as Product[]);
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

  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.slug.includes(q) || p.category.includes(q));
  }, [products, filter]);

  const startNew = () => setEditing({ data: emptyProduct() });
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
      mockup_front_url: d.mockup_front_url?.trim() || null,
      mockup_back_url: d.mockup_back_url?.trim() || null,
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

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold">Products</h1>
            <p className="text-sm text-muted-foreground">Manage catalog, fabric, images, variants and customization.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/admin">← Back to Admin</Link></Button>
            <Button onClick={startNew} className="font-bold"><Plus className="h-4 w-4" /> New Product</Button>
          </div>
        </div>

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
                  <th className="text-left p-3">Price</th>
                  <th className="text-left p-3">Customization</th>
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
                    <td className="p-3 capitalize">{p.category}</td>
                    <td className="p-3 font-semibold">{formatINR(Number(p.base_price))}</td>
                    <td className="p-3">
                      {p.customizable ? (
                        <div className="flex gap-1 flex-wrap">
                          {p.allow_text && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">TEXT +{formatINR(Number(p.text_price))}</span>}
                          {p.allow_image && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">IMG +{formatINR(Number(p.image_price))}</span>}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">Off</span>}
                    </td>
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
      </main>
      <SiteFooter />

      {editing && (
        <ProductEditor
          value={editing.data}
          isNew={!editing.id}
          onChange={(d) => setEditing({ ...editing, data: d })}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}

      {variantsOpen && (
        <VariantManager
          productId={variantsOpen}
          variants={variants[variantsOpen] ?? []}
          onClose={() => setVariantsOpen(null)}
          onChanged={() => loadVariants(variantsOpen)}
        />
      )}
    </div>
  );
}

function ProductEditor({
  value, isNew, onChange, onClose, onSave,
}: {
  value: Omit<Product, "id">;
  isNew: boolean;
  onChange: (d: Omit<Product, "id">) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = <K extends keyof Omit<Product, "id">>(k: K, v: Omit<Product, "id">[K]) => onChange({ ...value, [k]: v });
  const setImg = (i: number, url: string) => {
    const next = [...value.images]; next[i] = url; set("images", next);
  };
  const addImg = () => set("images", [...value.images, ""]);
  const removeImg = (i: number) => set("images", value.images.filter((_, idx) => idx !== i));

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
              <select value={value.category} onChange={(e) => set("category", e.target.value as Category)} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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
            <div className="flex items-center gap-2 text-sm font-bold"><ImageIcon className="h-4 w-4" /> Images</div>
            <p className="text-xs text-muted-foreground">Paste image URLs. First image is the cover. Use the storage bucket <code>product-images</code>.</p>
            <div className="space-y-2">
              {value.images.map((url, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="w-10 h-12 rounded bg-muted overflow-hidden shrink-0">{url && <img src={url} alt="" className="w-full h-full object-cover" />}</div>
                  <Input value={url} onChange={(e) => setImg(i, e.target.value)} placeholder="https://…/image.jpg" />
                  <Button size="icon" variant="ghost" onClick={() => removeImg(i)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addImg}><Plus className="h-3 w-3" /> Add image URL</Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t">
              <div>
                <Label>Mockup Front (customizer)</Label>
                <Input value={value.mockup_front_url ?? ""} onChange={(e) => set("mockup_front_url", e.target.value)} placeholder="https://…/front.png" />
              </div>
              <div>
                <Label>Mockup Back (customizer)</Label>
                <Input value={value.mockup_back_url ?? ""} onChange={(e) => set("mockup_back_url", e.target.value)} placeholder="https://…/back.png" />
              </div>
            </div>
          </section>

          <section className="border rounded-lg p-4 space-y-3">
            <div className="text-sm font-bold">Customization</div>
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-semibold">Allow customization</p><p className="text-xs text-muted-foreground">Show "Customize" button on product page</p></div>
              <Switch checked={value.customizable} onCheckedChange={(c) => set("customizable", c)} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between border rounded-md p-3">
                <div><p className="text-sm font-semibold">Text</p><p className="text-xs text-muted-foreground">Add text to the design</p></div>
                <Switch checked={value.allow_text} onCheckedChange={(c) => set("allow_text", c)} disabled={!value.customizable} />
              </div>
              <div className="flex items-center justify-between border rounded-md p-3">
                <div><p className="text-sm font-semibold">Image</p><p className="text-xs text-muted-foreground">Upload logos/photos</p></div>
                <Switch checked={value.allow_image} onCheckedChange={(c) => set("allow_image", c)} disabled={!value.customizable} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Text price (₹)</Label>
                <Input type="number" min={0} value={value.text_price} onChange={(e) => set("text_price", Number(e.target.value))} />
              </div>
              <div>
                <Label>Image price (₹)</Label>
                <Input type="number" min={0} value={value.image_price} onChange={(e) => set("image_price", Number(e.target.value))} />
              </div>
            </div>
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

function VariantManager({
  productId, variants, onClose, onChanged,
}: { productId: string; variants: Variant[]; onClose: () => void; onChanged: () => void }) {
  const [size, setSize] = useState("M");
  const [color, setColor] = useState("Black");
  const [hex, setHex] = useState("#111111");
  const [stock, setStock] = useState(0);

  const add = async () => {
    if (!size.trim() || !color.trim()) { toast.error("Size and color required"); return; }
    const { error } = await supabase.from("product_variants").insert({
      product_id: productId, size: size.trim(), color: color.trim(), color_hex: hex, stock,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Variant added");
    onChanged();
  };

  const updateStock = async (id: string, n: number) => {
    const { error } = await supabase.from("product_variants").update({ stock: Math.max(0, n) }).eq("id", id);
    if (error) toast.error(error.message); else onChanged();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("product_variants").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); onChanged(); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Size & Color Variants</DialogTitle></DialogHeader>

        <div className="grid grid-cols-[80px_1fr_80px_80px_auto] gap-2 items-end pb-3 border-b">
          <div><Label className="text-xs">Size</Label><Input value={size} onChange={(e) => setSize(e.target.value)} /></div>
          <div><Label className="text-xs">Color name</Label><Input value={color} onChange={(e) => setColor(e.target.value)} /></div>
          <div><Label className="text-xs">Hex</Label><Input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="h-9 p-1" /></div>
          <div><Label className="text-xs">Stock</Label><Input type="number" min={0} value={stock} onChange={(e) => setStock(Number(e.target.value))} /></div>
          <Button onClick={add} size="sm"><Plus className="h-4 w-4" /></Button>
        </div>

        <div className="space-y-1 max-h-80 overflow-y-auto">
          {variants.map((v) => (
            <div key={v.id} className="grid grid-cols-[80px_1fr_24px_100px_auto] gap-2 items-center text-sm py-1 border-b last:border-0">
              <span className="font-bold">{v.size}</span>
              <span>{v.color}</span>
              <span className="w-5 h-5 rounded border" style={{ background: v.color_hex }} />
              <Input type="number" min={0} value={v.stock} onChange={(e) => updateStock(v.id, Number(e.target.value))} className="h-8" />
              <Button size="icon" variant="ghost" onClick={() => remove(v.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {variants.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No variants yet.</p>}
        </div>

        <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
