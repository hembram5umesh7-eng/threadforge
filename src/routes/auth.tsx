import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { loginWithPassword, resolvePostLoginRedirect, rolesFromUser } from "@/lib/auth-session";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : "/",
    email: typeof s.email === "string" ? s.email : "",
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Invalid email").max(255);
const pwSchema = z.string().min(8, "At least 8 characters").max(72);

const TEST_ACCOUNTS = [
  { label: "Admin Panel", email: "admin@threadforge.in", password: "Admin@1234", redirect: "/admin" },
  { label: "Staff / Worker", email: "staff@threadforge.in", password: "Staff@1234", redirect: "/staff" },
  { label: "Supplier Panel", email: "mfr@threadforge.in", password: "Mfr@1234", redirect: "/partner" },
] as const;

function AuthPage() {
  const { redirect, email: emailParam } = Route.useSearch();
  const { user, ready, roles } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  // Already logged in — send to correct dashboard (not stuck on auth page).
  useEffect(() => {
    if (!ready || !user) return;
    const dest = resolvePostLoginRedirect(redirect, roles);
    window.location.replace(dest);
  }, [ready, user, redirect, roles]);

  const doLogin = async (loginEmail: string, loginPassword: string, target = redirect) => {
    const ev = emailSchema.safeParse(loginEmail);
    if (!ev.success) { toast.error(ev.error.issues[0].message); return; }
    const pv = pwSchema.safeParse(loginPassword);
    if (!pv.success) { toast.error(pv.error.issues[0].message); return; }

    setLoading(true);
    try {
      const data = await loginWithPassword(loginEmail.trim(), loginPassword);
      const userRoles = rolesFromUser(data.user);
      const dest = resolvePostLoginRedirect(target, userRoles);
      toast.success("Signed in! Redirecting…");
      // Full reload so admin/partner panels read session from localStorage.
      window.location.replace(dest);
    } catch (err) {
      const msg = err instanceof Error
        ? (err.name === "AbortError" ? "Login timed out. Check internet and try again." : err.message)
        : "Login failed";
      toast.error(msg);
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await doLogin(email, password);
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const signupEmail = String(fd.get("email") ?? "");
    const signupPassword = String(fd.get("password") ?? "");
    const fullName = String(fd.get("name") ?? "");
    const ev = emailSchema.safeParse(signupEmail); if (!ev.success) return toast.error(ev.error.issues[0].message);
    const pv = pwSchema.safeParse(signupPassword); if (!pv.success) return toast.error(pv.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail, password: signupPassword,
      options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Sign in below.");
    setEmail(signupEmail);
  };

  if (ready && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Opening dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 flex items-start justify-center">
        <div className="w-full max-w-md bg-card border rounded-2xl p-6 shadow-product">
          <h1 className="text-2xl font-extrabold mb-1">Welcome to ThreadForge</h1>
          <p className="text-sm text-muted-foreground mb-6">Sign in or create an account to continue.</p>

          <div className="mb-5 p-3 rounded-lg bg-muted/50 border space-y-2">
            <p className="text-xs font-bold uppercase text-muted-foreground">Quick login (test accounts)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TEST_ACCOUNTS.map((acc) => (
                <Button
                  key={acc.email}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-semibold"
                  disabled={loading}
                  onClick={() => doLogin(acc.email, acc.password, acc.redirect)}
                >
                  {acc.label}
                </Button>
              ))}
            </div>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <Label>Email</Label>
                  <Input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full font-bold" disabled={loading}>
                  {loading ? "Signing in…" : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-3">
                <div><Label>Full Name</Label><Input name="name" required /></div>
                <div><Label>Email</Label><Input name="email" type="email" required /></div>
                <div><Label>Password</Label><Input name="password" type="password" required minLength={8} /></div>
                <Button type="submit" className="w-full font-bold" disabled={loading}>
                  {loading ? "Creating…" : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-4 p-3 rounded-lg bg-secondary/50 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Test credentials</p>
            <p>Admin: admin@threadforge.in / Admin@1234 → opens /admin</p>
            <p>Staff: staff@threadforge.in / Staff@1234 → opens /staff (worker portal)</p>
            <p>Supplier: mfr@threadforge.in / Mfr@1234 → opens /partner</p>
          </div>

          <p className="mt-4 text-xs text-muted-foreground text-center">
            By continuing you agree to our Terms & No-Refund Policy.
          </p>
          <p className="mt-2 text-xs text-center"><Link to="/" className="text-primary">← Back to home</Link></p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
