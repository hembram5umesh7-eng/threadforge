import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { APPAREL_SIZES, PRESET_COLORS, variantKey, type VariantRow } from "@/lib/product-variants";
import { Plus, Trash2, Grid3X3 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ColorRow {
  name: string;
  hex: string;
}

export function VariantMatrixEditor({
  productId,
  productName,
  variants,
  onClose,
  onChanged,
}: {
  productId: string;
  productName: string;
  variants: VariantRow[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [sizes, setSizes] = useState<string[]>(["S", "M", "L", "XL"]);
  const [colors, setColors] = useState<ColorRow[]>([{ name: "Black", hex: "#111111" }]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [defaultStock, setDefaultStock] = useState(10);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!variants.length) return;
    const sizeSet = new Set<string>();
    const colorMap = new Map<string, ColorRow>();
    const stocks: Record<string, number> = {};
    variants.forEach((v) => {
      sizeSet.add(v.size);
      colorMap.set(v.color, { name: v.color, hex: v.color_hex });
      stocks[variantKey(v.color, v.size)] = v.stock;
    });
    setSizes(Array.from(sizeSet));
    setColors(Array.from(colorMap.values()));
    setStockMap(stocks);
  }, [variants]);

  const matrixCells = useMemo(() => {
    const cells: { color: ColorRow; size: string; stock: number }[] = [];
    colors.forEach((c) => {
      sizes.forEach((s) => {
        cells.push({ color: c, size: s, stock: stockMap[variantKey(c.name, s)] ?? 0 });
      });
    });
    return cells;
  }, [colors, sizes, stockMap]);

  const toggleSize = (size: string) => {
    setSizes((prev) => (prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size].sort(
      (a, b) => APPAREL_SIZES.indexOf(a as typeof APPAREL_SIZES[number]) - APPAREL_SIZES.indexOf(b as typeof APPAREL_SIZES[number]),
    )));
  };

  const addColor = (preset?: ColorRow) => {
    const base = preset ?? { name: "New Color", hex: "#888888" };
    setColors((prev) => {
      if (prev.some((c) => c.name.toLowerCase() === base.name.toLowerCase())) return prev;
      return [...prev, base];
    });
  };

  const removeColor = (name: string) => {
    setColors((prev) => prev.filter((c) => c.name !== name));
  };

  const setStock = (color: string, size: string, stock: number) => {
    setStockMap((prev) => ({ ...prev, [variantKey(color, size)]: Math.max(0, stock) }));
  };

  const fillAll = () => {
    const next: Record<string, number> = { ...stockMap };
    colors.forEach((c) => sizes.forEach((s) => { next[variantKey(c.name, s)] = defaultStock; }));
    setStockMap(next);
    toast.success(`Set ${defaultStock} stock for all ${colors.length * sizes.length} SKUs`);
  };

  const saveAll = async () => {
    if (!sizes.length) { toast.error("Select at least one size"); return; }
    if (!colors.length) { toast.error("Add at least one color"); return; }
    if (colors.some((c) => !c.name.trim())) { toast.error("Every color needs a name"); return; }

    setSaving(true);
    try {
      const desired = colors.flatMap((c) =>
        sizes.map((s) => ({
          size: s,
          color: c.name.trim(),
          color_hex: c.hex,
          stock: stockMap[variantKey(c.name, s)] ?? 0,
        })),
      );
      const desiredKeys = new Set(desired.map((d) => variantKey(d.color, d.size)));

      for (const v of variants) {
        if (!desiredKeys.has(variantKey(v.color, v.size)) && v.id) {
          const { error } = await supabase.from("product_variants").delete().eq("id", v.id);
          if (error) throw error;
        }
      }

      for (const d of desired) {
        const existing = variants.find((v) => v.color === d.color && v.size === d.size);
        if (existing?.id) {
          const { error } = await supabase.from("product_variants").update({
            stock: d.stock,
            color_hex: d.color_hex,
            color: d.color,
            size: d.size,
          }).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("product_variants").insert({
            product_id: productId,
            size: d.size,
            color: d.color,
            color_hex: d.color_hex,
            stock: d.stock,
          });
          if (error) throw error;
        }
      }

      toast.success(`Saved ${desired.length} variants for ${productName}`);
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save variants");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" /> Variants — {productName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          One product, many colors & sizes — standard fashion SKU matrix. Pick sizes and colors, set stock per cell, then save all at once.
        </p>

        <section className="space-y-2">
          <Label className="text-xs uppercase font-bold text-muted-foreground">Sizes</Label>
          <div className="flex flex-wrap gap-2">
            {APPAREL_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSize(s)}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-sm font-bold transition-colors",
                  sizes.includes(s) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <Label className="text-xs uppercase font-bold text-muted-foreground">Colors</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_COLORS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => addColor(p)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-semibold hover:bg-muted"
              >
                <span className="w-4 h-4 rounded-full border" style={{ background: p.hex }} />
                {p.name}
              </button>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => addColor()}><Plus className="h-3.5 w-3.5" /> Custom</Button>
          </div>
          <div className="space-y-2">
            {colors.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input type="color" value={c.hex} onChange={(e) => {
                  const hex = e.target.value;
                  setColors((prev) => prev.map((x, j) => j === i ? { ...x, hex } : x));
                }} className="w-12 h-9 p-1" />
                <Input value={c.name} onChange={(e) => {
                  const name = e.target.value;
                  setColors((prev) => prev.map((x, j) => j === i ? { ...x, name } : x));
                }} className="max-w-[140px]" placeholder="Color name" />
                <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => removeColor(c.name)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-end gap-3 py-2 border-y">
          <div>
            <Label className="text-xs">Default stock (all cells)</Label>
            <Input type="number" min={0} value={defaultStock} onChange={(e) => setDefaultStock(Number(e.target.value))} className="w-24" />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={fillAll}>Apply to all SKUs</Button>
          <span className="text-xs text-muted-foreground ml-auto">{matrixCells.length} SKU combinations</span>
        </div>

        {sizes.length > 0 && colors.length > 0 && (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-2 font-bold">Color</th>
                  {sizes.map((s) => <th key={s} className="p-2 text-center font-bold w-20">{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {colors.map((c) => (
                  <tr key={c.name} className="border-b last:border-0">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded border shrink-0" style={{ background: c.hex }} />
                        <span className="font-semibold">{c.name}</span>
                      </div>
                    </td>
                    {sizes.map((s) => (
                      <td key={s} className="p-1">
                        <Input
                          type="number"
                          min={0}
                          value={stockMap[variantKey(c.name, s)] ?? 0}
                          onChange={(e) => setStock(c.name, s, Number(e.target.value))}
                          className="h-8 text-center px-1"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={saveAll} disabled={saving} className="font-bold">
            {saving ? "Saving…" : `Save ${matrixCells.length} variants`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
