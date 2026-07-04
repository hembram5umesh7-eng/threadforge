import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/categories")({ component: AdminCategories });

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  active: boolean;
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

function AdminCategories() {
  const [items, setItems] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Omit<Category, "id"> & { id?: string } | null>(null);

  const refresh = async () => {
    const { data, error } = await supabase.from("categories").select("*").order("sort_order");
    if (error) toast.error(error.message);
    else setItems((data as Category[]) ?? []);
  };
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!editing?.name.trim()) { toast.error("Name required"); return; }
    const slug = editing.slug.trim() || slugify(editing.name);
    const payload = {
      name: editing.name.trim(),
      slug,
      description: editing.description?.trim() || null,
      image_url: editing.image_url?.trim() || null,
      sort_order: editing.sort_order,
      active: editing.active,
    };
    if (editing.id) {
      const { error } = await supabase.from("categories").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("categories").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Saved");
    setEditing(null);
    refresh();
  };

  const remove = async (c: Category) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    const { count } = await supabase.from("products").select("*", { count: "exact", head: true }).eq("category", c.slug);
    if ((count ?? 0) > 0) {
      toast.error(`Cannot delete: ${count} products use this category`);
      return;
    }
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); refresh(); }
  };

  return (
    <AdminShell
      title="Categories"
      subtitle="Manage shop categories shown on homepage and navigation."
      actions={
        <Button onClick={() => setEditing({ name: "", slug: "", description: "", image_url: "", sort_order: items.length + 1, active: true })}>
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      }
    >
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-muted/40 border-b">
            <tr>
              <th className="text-left p-3">Category</th>
              <th className="text-left p-3">Slug</th>
              <th className="text-left p-3">Order</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                      {c.image_url && <img src={c.image_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <span className="font-semibold">{c.name}</span>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">/{c.slug}</td>
                <td className="p-3">{c.sort_order}</td>
                <td className="p-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.active ? "bg-success/15 text-success" : "bg-muted"}`}>
                    {c.active ? "LIVE" : "HIDDEN"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No categories yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.id ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Slug</Label><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="auto from name" /></div>
              <div><Label>Description</Label><Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div><Label>Image URL</Label><Input value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></div>
              <div><Label>Sort order</Label><Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></div>
              <div className="flex items-center justify-between border rounded-lg p-3">
                <span className="text-sm font-semibold">Active</span>
                <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AdminShell>
  );
}
