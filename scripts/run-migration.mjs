import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationFile = process.argv[2] || "20260704103000_remove_customization.sql";

const projectRef = process.env.VITE_SUPABASE_PROJECT_ID || "oceuhhvbqyqqpmukljgm";
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.error("Missing SUPABASE_DB_PASSWORD in .env");
  process.exit(1);
}

const connectionString =
  process.env.SUPABASE_DB_URL ||
  `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectRef}.supabase.co:5432/postgres`;

const sql = readFileSync(join(__dirname, "..", "supabase", "migrations", migrationFile), "utf8");

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log(`Applying ${migrationFile}...`);
await client.query(sql);
console.log("Done.");
await client.end();
