import { Link } from "@tanstack/react-router";
import { formatINR } from "@/lib/order-utils";

export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  images: string[] | null;
  category: string;
  customizable: boolean;
}

export function ProductCard({ p }: { p: ProductCardData }) {
  const img = p.images?.[0] ?? "";
  return (
    <Link
      to="/product/$slug"
      params={{ slug: p.slug }}
      className="group flex flex-col rounded-lg overflow-hidden bg-card hover:shadow-product transition-shadow"
    >
      <div className="aspect-[3/4] relative overflow-hidden bg-muted">
        {img ? (
          <img
            src={img}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-muted to-secondary" />
        )}
        {p.customizable && (
          <span className="absolute top-2 left-2 bg-brand-yellow text-foreground text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            Customizable
          </span>
        )}
        <span className="absolute bottom-2 right-2 bg-success text-success-foreground text-[10px] font-bold px-2 py-0.5 rounded">
          ★ 4.{Math.floor(Math.random() * 5) + 3}
        </span>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm line-clamp-1">{p.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-1 capitalize">{p.category}</p>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="font-bold text-base">{formatINR(p.base_price)}</span>
          <span className="text-xs text-muted-foreground line-through">
            {formatINR(Math.round(p.base_price * 1.6))}
          </span>
          <span className="text-xs font-bold text-success">38% OFF</span>
        </div>
      </div>
    </Link>
  );
}
