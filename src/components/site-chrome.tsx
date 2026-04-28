import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, User, Search, LogOut, Menu, X, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { label: "T-Shirts", to: "/category/tshirt" as const },
  { label: "Hoodies", to: "/category/hoodie" as const },
  { label: "Jeans", to: "/category/jeans" as const },
  { label: "Shirts", to: "/category/shirt" as const },
  { label: "Customize", to: "/customize" as const },
];

export function SiteHeader() {
  const { user, isAdmin, isManufacturer, signOut } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState("");

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate({ to: "/search", search: { q: q.trim() } });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Promo bar */}
      <div className="bg-gradient-promo text-white text-xs font-medium text-center py-1.5 px-4">
        🎉 Free shipping on orders above ₹999 · Customize anything · Made in India
      </div>

      <div className="container mx-auto flex h-16 items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Sparkles className="h-7 w-7 text-primary" strokeWidth={2.5} />
          </div>
          <span className="font-extrabold text-xl tracking-tight">
            Thread<span className="text-primary">Forge</span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="px-3 py-2 text-sm font-semibold uppercase tracking-wide text-foreground/80 hover:text-primary transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={search} className="hidden md:flex flex-1 max-w-md ml-auto">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for products, brands…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 bg-muted border-transparent focus-visible:bg-background"
            />
          </div>
        </form>

        <div className="flex items-center gap-1 ml-auto md:ml-0">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-5 w-5" />
                  <span className="hidden sm:inline text-sm">Account</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/account" })}>Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/orders" })}>My Orders</DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>Admin Dashboard</DropdownMenuItem>
                  </>
                )}
                {isManufacturer && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate({ to: "/partner" })}>Manufacturer Panel</DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/auth" })}>
              <User className="h-5 w-5 sm:mr-2" />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
          )}

          <Button variant="ghost" size="sm" className="relative" onClick={() => navigate({ to: "/cart" })}>
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
                {count}
              </span>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t bg-background">
          <nav className="container mx-auto flex flex-col px-4 py-2">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setMobileOpen(false)}
                className="py-3 text-sm font-semibold uppercase tracking-wide border-b last:border-0"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30 mt-20">
      <div className="container mx-auto px-4 py-12 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-bold">ThreadForge</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Custom fashion, manufactured to order. Design it. Wear it. Own it.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm">Shop</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/category/tshirt" className="hover:text-foreground">T-Shirts</Link></li>
            <li><Link to="/category/hoodie" className="hover:text-foreground">Hoodies</Link></li>
            <li><Link to="/category/jeans" className="hover:text-foreground">Jeans</Link></li>
            <li><Link to="/customize" className="hover:text-foreground">Custom Design Studio</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm">Help</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Track Order</li>
            <li>Shipping Info</li>
            <li>Contact Us</li>
            <li className="text-destructive font-medium">No Refund Policy</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm">Company</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>About</li>
            <li>Manufacturers</li>
            <li>Privacy</li>
            <li>Terms</li>
          </ul>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ThreadForge. All rights reserved.
      </div>
    </footer>
  );
}
