import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.SUPABASE_URL;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = "admin@threadforge.in";
const pw = "Admin@1234";

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: publishable, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: pw }),
});
const auth = await login.json();
if (!login.ok) {
  console.error("Login failed", auth);
  process.exit(1);
}

// Simulate auth-middleware client creation (this used to throw WebSocket error)
const client = createClient(url, publishable, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${auth.access_token}` } },
  realtime: { transport: ws },
});

console.log("createClient OK (no WebSocket error)");

const { data: claims, error: claimsErr } = await client.auth.getClaims(auth.access_token);
console.log("getClaims:", claimsErr?.message ?? `user ${claims?.claims?.sub}`);

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});
const { data: staff, error } = await admin.from("user_roles").select("user_id").eq("role", "staff");
console.log("list staff roles:", error?.message ?? `${staff?.length ?? 0} row(s)`);
