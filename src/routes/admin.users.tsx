import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin-shell";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/users")({ component: AdminUsers });

interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}
interface Role { user_id: string; role: string }

function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      setProfiles((p as Profile[]) ?? []);
      const { data: r } = await supabase.from("user_roles").select("user_id,role");
      const map: Record<string, string[]> = {};
      (r as Role[] ?? []).forEach((row) => {
        (map[row.user_id] ??= []).push(row.role);
      });
      setRoles(map);
    })();
  }, []);

  const filtered = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (p.full_name ?? "").toLowerCase().includes(q) || p.id.includes(q);
  });

  return (
    <AdminShell title="Customers" subtitle="Registered users and their roles.">
      <Input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm mb-4" />
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-muted/40 border-b">
            <tr>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Joined</th>
              <th className="text-left p-3">Roles</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-3">
                  <p className="font-semibold">{p.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.id.slice(0, 8)}…</p>
                </td>
                <td className="p-3">{p.phone || "—"}</td>
                <td className="p-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString("en-IN")}</td>
                <td className="p-3">
                  <div className="flex gap-1 flex-wrap">
                    {(roles[p.id] ?? ["user"]).map((r) => (
                      <span key={r} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary uppercase">{r}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No customers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
