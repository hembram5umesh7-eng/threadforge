/**
 * Creates test admin + manufacturer accounts in Supabase Auth.
 * Run: npm run seed:users
 */
import pg from "pg";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const projectRef = process.env.VITE_SUPABASE_PROJECT_ID || "oceuhhvbqyqqpmukljgm";
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!url || !serviceKey || !dbPassword) {
  console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_DB_PASSWORD in .env");
  process.exit(1);
}

const authHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

const TEST_USERS = [
  {
    email: "admin@threadforge.in",
    password: "Admin@1234",
    fullName: "ThreadForge Admin",
    role: "admin",
  },
  {
    email: "mfr@threadforge.in",
    password: "Mfr@1234",
    fullName: "StitchWorks Partner",
    role: "manufacturer",
  },
];

async function authFetch(path, options = {}) {
  const res = await fetch(`${url}${path}`, {
    ...options,
    headers: { ...authHeaders, ...(options.headers ?? {}) },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed [${res.status}]: ${text}`);
  }
  return body;
}

async function listUsers() {
  const data = await authFetch("/auth/v1/admin/users?per_page=200");
  return data.users ?? [];
}

async function ensureUser({ email, password, fullName, role }) {
  const users = await listUsers();
  const existing = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    await authFetch(`/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: { roles: ["user", role] },
      }),
    });
    console.log(`Updated user: ${email}`);
    return existing.id;
  }

  const created = await authFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { roles: ["user", role] },
    }),
  });
  console.log(`Created user: ${email}`);
  return created.id;
}

async function verifyLogin(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`  Login verify FAILED for ${email}: ${body}`);
    return false;
  }
  console.log(`  Login verify OK: ${email}`);
  return true;
}

const db = new pg.Client({
  connectionString:
    process.env.SUPABASE_DB_URL ||
    `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

console.log("Setting up test accounts...\n");
await db.connect();

for (const account of TEST_USERS) {
  console.log(`→ ${account.email}`);
  const userId = await ensureUser(account);

  await db.query(
    `insert into public.user_roles (user_id, role) values ($1, $2)
     on conflict (user_id, role) do nothing`,
    [userId, account.role],
  );
  console.log(`  Role assigned: ${account.role}`);

  if (account.role === "manufacturer") {
    await db.query(
      `update public.manufacturers set user_id = $1 where name = 'StitchWorks India'`,
      [userId],
    );
    console.log("  Linked to manufacturer: StitchWorks India");
  }
  console.log("");
}

await db.end();

console.log("Verifying logins...\n");
let ok = true;
for (const account of TEST_USERS) {
  const passed = await verifyLogin(account.email, account.password);
  if (!passed) ok = false;
}

console.log("\n--- Login credentials ---");
for (const account of TEST_USERS) {
  console.log(`${account.role.toUpperCase()}: ${account.email} / ${account.password}`);
}
console.log("Admin panel:   http://localhost:8080/admin");
console.log("Partner panel: http://localhost:8080/partner");

process.exit(ok ? 0 : 1);
