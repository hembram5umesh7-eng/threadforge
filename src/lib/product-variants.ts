export const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export const PRESET_COLORS = [
  { name: "Black", hex: "#111111" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Navy", hex: "#1e3a5f" },
  { name: "Grey", hex: "#6b7280" },
  { name: "Red", hex: "#dc2626" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Green", hex: "#16a34a" },
  { name: "Beige", hex: "#d4c4a8" },
] as const;

export interface VariantRow {
  id?: string;
  product_id?: string;
  size: string;
  color: string;
  color_hex: string;
  stock: number;
}

export function variantKey(color: string, size: string) {
  return `${color.toLowerCase()}|${size.toUpperCase()}`;
}

export function summarizeVariants(variants: Pick<VariantRow, "size" | "color">[]) {
  const colors = new Set(variants.map((v) => v.color));
  const sizes = new Set(variants.map((v) => v.size));
  if (!variants.length) return "No variants";
  return `${colors.size} color${colors.size !== 1 ? "s" : ""} × ${sizes.size} size${sizes.size !== 1 ? "s" : ""} (${variants.length} SKUs)`;
}
