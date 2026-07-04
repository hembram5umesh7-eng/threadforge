/**
 * Apply local Supabase migrations + seed to remote Postgres.
 *
 * Required in .env:
 *   SUPABASE_DB_PASSWORD=<your database password from Supabase dashboard>
 *
 * Run: npm run db:setup
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const projectRef =
  process.env.VITE_SUPABASE_PROJECT_ID ||
  process.env.SUPABASE_PROJECT_ID ||
  "oceuhhvbqyqqpmukljgm";
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.error(`
Missing SUPABASE_DB_PASSWORD in .env

Get it from Supabase Dashboard:
  Project Settings → Database → Database password

Then add to .env:
  SUPABASE_DB_PASSWORD=your_password_here

Alternative: paste scripts/full-setup.sql into
  Supabase Dashboard → SQL Editor → Run
`);
  process.exit(1);
}

const connectionString =
  process.env.SUPABASE_DB_URL ||
  `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;

const migrationsDir = join(root, "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const seedFile = join(root, "supabase", "seed.sql");

async function main() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  console.log(`Connecting to ${projectRef}...`);
  await client.connect();
  console.log("Connected.\n");

  for (const file of migrationFiles) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`Applying migration: ${file}`);
    await client.query(sql);
    console.log(`  ✓ ${file}`);
  }

  if (readFileSync(seedFile, "utf8").trim()) {
    console.log("\nApplying seed data...");
    await client.query(readFileSync(seedFile, "utf8"));
    console.log("  ✓ seed.sql");
  }

  const { rows } = await client.query(
    "select count(*)::int as products from public.products"
  );
  console.log(`\nDone. Products in database: ${rows[0].products}`);
  await client.end();
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message);
  if (err.message.includes("Tenant or user not found")) {
    console.error(
      "\nTip: Check SUPABASE_DB_PASSWORD or set SUPABASE_DB_URL with the full connection string from Dashboard → Database → Connection string (URI)."
    );
  }
  process.exit(1);
});
