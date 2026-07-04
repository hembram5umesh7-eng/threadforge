import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createStaffMember, listStaffMembers, removeStaffMember } from "@/lib/admin.functions";
import { useAuthedServerFn } from "@/lib/use-authed-server-fn";
import { parseEmailInput } from "@/lib/server-fn-error";
import { CredentialsDialog, type PortalCredentials } from "@/components/credentials-dialog";
import { Plus, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/staff")({ component: AdminStaff });

interface StaffRow {
  userId: string;
  email: string;
  fullName: string;
  createdAt: string;
}

function AdminStaff() {
  const listFn = useAuthedServerFn(listStaffMembers);
  const createFn = useAuthedServerFn(createStaffMember);
  const removeFn = useAuthedServerFn(removeStaffMember);

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "Staff@1234" });
  const [creds, setCreds] = useState<PortalCredentials | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const { staff: rows } = await listFn();
      setStaff(rows ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const addStaff = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      toast.error("Name and email required");
      return;
    }
    const emailCheck = parseEmailInput(form.email);
    if (!emailCheck.ok) {
      toast.error(emailCheck.message);
      return;
    }
    try {
      const result = await createFn({ data: { ...form, email: emailCheck.value } });
      setCreds({
        title: "Worker account created",
        email: result.email,
        password: result.password,
        loginUrl: result.loginUrl,
        portalLabel: result.portal,
      });
      setOpen(false);
      setForm({ fullName: "", email: "", password: "Staff@1234" });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add staff");
    }
  };

  const remove = async (row: StaffRow) => {
    if (!confirm(`Remove staff access for ${row.fullName}?`)) return;
    try {
      await removeFn({ data: { userId: row.userId } });
      toast.success("Staff access removed");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove staff");
    }
  };

  return (
    <AdminShell
      title="Staff / Workers"
      subtitle="Add team members who can manage orders, products & customers on your behalf."
      superAdminOnly
      actions={
        <Button onClick={() => setOpen(true)} className="font-bold">
          <Plus className="h-4 w-4" /> Add Worker
        </Button>
      }
    >
      <div className="bg-card border rounded-xl p-4 mb-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">What staff can do</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>View & update orders, assign suppliers, add admin notes</li>
          <li>Manage products, categories, and inventory</li>
          <li>View customers and supplier list</li>
          <li>Cannot create/reset logins or passwords (super admin only)</li>
          <li>Cannot add/remove other staff (super admin only)</li>
        </ul>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-muted/40 border-b">
            <tr>
              <th className="text-left p-3">Worker</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Added</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && staff.map((s) => (
              <tr key={s.userId} className="border-b last:border-0">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{s.fullName}</span>
                  </div>
                </td>
                <td className="p-3">{s.email}</td>
                <td className="p-3 text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("en-IN")}</td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(s)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {!loading && staff.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No staff yet. Click <strong>Add Worker</strong>.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <Dialog open onOpenChange={(v) => !v && setOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Staff / Worker</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <Label>Full name</Label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Rahul Sharma" />
              </div>
              <div>
                <Label>Email (login ID)</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="staff@threadforge.in" />
              </div>
              <div>
                <Label>Temporary password</Label>
                <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">Share this with the worker for first login.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={addStaff}>Create & Assign Staff Role</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
    </AdminShell>
  );
}
