/**
 * Test admin RLS with authenticated JWT.
 * Run: node --env-file=.env scripts/test-admin-rls.mjs
 */
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const email = "admin@threadforge.in";
const pw = "Admin@1234";

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: pw }),
});
const auth = await login.json();
if (!login.ok) {
  console.error("Login failed", auth);
  process.exit(1);
}
const token = auth.access_token;
console.log("Admin login OK, uid:", auth.user.id);

const headers = { apikey: key, Authorization: `Bearer ${token}` };

for (const [name, path] of [
  ["products select", "/rest/v1/products?select=id&limit=1"],
  ["categories select", "/rest/v1/categories?select=id&limit=1"],
  ["orders select", "/rest/v1/orders?select=id&limit=1"],
  ["manufacturers select", "/rest/v1/manufacturers?select=id&limit=1"],
]) {
  const res = await fetch(`${url}${path}`, { headers });
  console.log(`${name}: ${res.status} ${res.ok ? "OK" : (await res.text()).slice(0, 120)}`);
}

const slug = `test-cat-${Date.now()}`;
const ins = await fetch(`${url}/rest/v1/categories`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
  body: JSON.stringify({ name: "Test Cat", slug, sort_order: 999, active: false }),
});
const insBody = await ins.text();
console.log(`categories insert: ${ins.status} ${ins.ok ? "OK" : insBody.slice(0, 200)}`);

if (ins.ok) {
  const row = JSON.parse(insBody)[0];
  await fetch(`${url}/rest/v1/categories?id=eq.${row.id}`, { method: "DELETE", headers });
  console.log("cleanup: deleted test category");
}

process.exit(ins.ok ? 0 : 1);
