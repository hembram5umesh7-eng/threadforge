import { createFileRoute } from "@tanstack/react-router";

import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

import { AdminShell } from "@/components/admin-shell";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Switch } from "@/components/ui/switch";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { setupSupplierLogin } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { useAuthedServerFn } from "@/lib/use-authed-server-fn";
import { parseEmailInput } from "@/lib/server-fn-error";

import { CredentialsDialog, type PortalCredentials } from "@/components/credentials-dialog";

import { Plus, Pencil, KeyRound } from "lucide-react";

import { toast } from "sonner";



export const Route = createFileRoute("/admin/manufacturers")({ component: AdminManufacturers });



interface Manufacturer {

  id: string;

  name: string;

  contact_email: string | null;

  contact_phone: string | null;

  address: string | null;

  active: boolean;

  user_id: string | null;

}



function AdminManufacturers() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Manufacturer[]>([]);

  const [editing, setEditing] = useState<Partial<Manufacturer> & { id?: string; loginPassword?: string } | null>(null);

  const [loginTarget, setLoginTarget] = useState<Manufacturer | null>(null);

  const [loginForm, setLoginForm] = useState({ email: "", password: "Supplier@1234", fullName: "" });

  const [creds, setCreds] = useState<PortalCredentials | null>(null);

  const setupLogin = useAuthedServerFn(setupSupplierLogin);



  const refresh = async () => {

    const { data, error } = await supabase.from("manufacturers").select("*").order("name");

    if (error) toast.error(error.message);

    else setItems((data as Manufacturer[]) ?? []);

  };

  useEffect(() => { refresh(); }, []);



  const save = async () => {

    if (!editing?.name?.trim()) { toast.error("Name required"); return; }

    const payload = {

      name: editing.name.trim(),

      contact_email: editing.contact_email?.trim() || null,

      contact_phone: editing.contact_phone?.trim() || null,

      address: editing.address?.trim() || null,

      active: editing.active ?? true,

    };

    let manufacturerId = editing.id;

    if (editing.id) {

      const { error } = await supabase.from("manufacturers").update(payload).eq("id", editing.id);

      if (error) { toast.error(error.message); return; }

    } else {

      const { data, error } = await supabase.from("manufacturers").insert(payload).select("id").single();

      if (error) { toast.error(error.message); return; }

      manufacturerId = data.id;

    }



    toast.success("Supplier saved");
    const email = editing.contact_email?.trim();
    const password = editing.loginPassword?.trim();
    const supplierName = editing.name.trim();
    setEditing(null);
    await refresh();

    if (isAdmin && manufacturerId && email && password && password.length >= 8) {
      const emailCheck = parseEmailInput(email);
      if (!emailCheck.ok) {
        toast.error(emailCheck.message);
        return;
      }
      try {
        const result = await setupLogin({
          data: {
            manufacturerId,
            email: emailCheck.value,
            password,
            fullName: supplierName,
          },
        });

        setCreds({

          title: "Supplier portal login ready",

          email: result.email,

          password: result.password,

          loginUrl: result.loginUrl,

          portalLabel: result.portal,

        });

        refresh();

      } catch (e) {

        toast.error(e instanceof Error ? e.message : "Supplier saved but login setup failed");

      }

    }

  };



  const doSetupLogin = async () => {
    if (!loginTarget || loginForm.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    const emailCheck = parseEmailInput(loginForm.email);
    if (!emailCheck.ok) {
      toast.error(emailCheck.message);
      return;
    }
    try {
      const result = await setupLogin({
        data: {
          manufacturerId: loginTarget.id,
          email: emailCheck.value,
          password: loginForm.password,
          fullName: loginForm.fullName.trim() || loginTarget.name,
        },
      });

      setCreds({

        title: `Login for ${loginTarget.name}`,

        email: result.email,

        password: result.password,

        loginUrl: result.loginUrl,

        portalLabel: result.portal,

      });

      setLoginTarget(null);

      refresh();

    } catch (e) {

      toast.error(e instanceof Error ? e.message : "Login setup failed");

    }

  };



  return (

    <AdminShell

      title="Suppliers"

      subtitle="Add manufacturers and give them their own partner dashboard login."

      actions={

        <Button onClick={() => setEditing({ name: "", contact_email: "", contact_phone: "", address: "", active: true, loginPassword: "Supplier@1234" })}>

          <Plus className="h-4 w-4" /> Add Supplier

        </Button>

      }

    >

      <div className="bg-card border rounded-xl p-4 mb-4 text-sm text-muted-foreground">

        <p className="font-semibold text-foreground mb-1">How supplier login works</p>

        <ul className="list-disc pl-5 space-y-1">

          <li>Add supplier with email + temporary password — login is created automatically (admin only)</li>

          <li>Share credentials — they login at <strong>/auth</strong> and open <strong>/partner</strong></li>

          <li>They see assigned orders, update status & add tracking</li>

          {!isAdmin && <li className="text-amber-700 dark:text-amber-400">Staff can edit supplier details but cannot create or reset logins/passwords.</li>}

        </ul>

      </div>



      <div className="grid gap-4 md:grid-cols-2">

        {items.map((m) => (

          <div key={m.id} className="bg-card border rounded-xl p-4">

            <div className="flex justify-between items-start gap-2">

              <div>

                <h3 className="font-bold text-lg">{m.name}</h3>

                <p className="text-sm text-muted-foreground">{m.contact_email || "No email"}</p>

                <p className="text-sm text-muted-foreground">{m.contact_phone || "No phone"}</p>

                {m.address && <p className="text-xs text-muted-foreground mt-1">{m.address}</p>}

              </div>

              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.active ? "bg-success/15 text-success" : "bg-muted"}`}>

                {m.active ? "ACTIVE" : "INACTIVE"}

              </span>

            </div>

            <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">

              <Button size="sm" variant="outline" onClick={() => setEditing({ ...m, loginPassword: "Supplier@1234" })}><Pencil className="h-3.5 w-3.5" /> Edit</Button>

              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => {
                  setLoginTarget(m);
                  setLoginForm({ email: m.contact_email ?? "", password: "Supplier@1234", fullName: m.name });
                }}>
                  <KeyRound className="h-3.5 w-3.5" /> {m.user_id ? "Reset login" : "Create login"}
                </Button>
              )}

              {m.user_id && <span className="text-xs text-success font-semibold self-center">✓ Portal active</span>}

            </div>

          </div>

        ))}

        {items.length === 0 && <p className="text-muted-foreground col-span-2 text-center py-12">No suppliers yet.</p>}

      </div>



      {editing && (

        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>

          <DialogContent className="max-w-lg">

            <DialogHeader><DialogTitle>{editing.id ? "Edit Supplier" : "New Supplier"}</DialogTitle></DialogHeader>

            <div className="grid gap-3 py-2">

              <div><Label>Name *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>

              <div><Label>Email (portal login)</Label><Input type="email" value={editing.contact_email ?? ""} onChange={(e) => setEditing({ ...editing, contact_email: e.target.value })} placeholder="supplier@company.in" /></div>

              {isAdmin && !editing.id && (
                <div>
                  <Label>Temporary password</Label>
                  <Input value={editing.loginPassword ?? "Supplier@1234"} onChange={(e) => setEditing({ ...editing, loginPassword: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Auto-creates partner dashboard login when email is set.</p>
                </div>
              )}

              <div><Label>Phone</Label><Input value={editing.contact_phone ?? ""} onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value })} /></div>

              <div><Label>Address</Label><Input value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>

              <div className="flex items-center justify-between border rounded-lg p-3">

                <span className="text-sm font-semibold">Active</span>

                <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />

              </div>

            </div>

            <DialogFooter>

              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>

              <Button onClick={save}>Save supplier</Button>

            </DialogFooter>

          </DialogContent>

        </Dialog>

      )}



      {isAdmin && loginTarget && (

        <Dialog open onOpenChange={(o) => !o && setLoginTarget(null)}>

          <DialogContent>

            <DialogHeader><DialogTitle>Partner login — {loginTarget.name}</DialogTitle></DialogHeader>

            <p className="text-sm text-muted-foreground">Creates or resets their password. They can login and use the supplier dashboard.</p>

            <div className="grid gap-3 py-2">

              <div>
                <Label>Login email</Label>
                <Input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="supplier@company.com" />
                <p className="text-xs text-muted-foreground mt-1">Must include @ and domain (e.g. .com, .in)</p>
              </div>

              <div><Label>New temporary password</Label><Input value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} /></div>

              <div><Label>Display name</Label><Input value={loginForm.fullName} onChange={(e) => setLoginForm({ ...loginForm, fullName: e.target.value })} placeholder={loginTarget.name} /></div>

            </div>

            <DialogFooter>

              <Button variant="outline" onClick={() => setLoginTarget(null)}>Cancel</Button>

              <Button onClick={doSetupLogin}>Create / Reset login</Button>

            </DialogFooter>

          </DialogContent>

        </Dialog>

      )}



      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />

    </AdminShell>

  );

}


