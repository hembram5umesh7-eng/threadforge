/**
 * Quick Supabase connectivity + schema check.
 * Run: node scripts/verify-db.mjs
 */
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or key in environment (.env)");
  process.exit(1);
}

const tables = [
  "products",
  "product_variants",
  "orders",
  "profiles",
  "manufacturers",
];

async function checkTable(name) {
  const res = await fetch(`${url}/rest/v1/${name}?select=*&limit=0`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
    },
  });
  const count = res.headers.get("content-range")?.split("/")?.[1] ?? "?";
  return { name, status: res.status, ok: res.ok, count };
}

console.log(`Project: ${url}`);
const results = await Promise.all(tables.map(checkTable));
for (const r of results) {
  const icon = r.ok ? "OK" : "MISSING";
  console.log(`[${icon}] ${r.name} — HTTP ${r.status}${r.ok ? ` (rows: ${r.count})` : ""}`);
}

const missing = results.filter((r) => !r.ok);
process.exit(missing.length ? 1 : 0);
