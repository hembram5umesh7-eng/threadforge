import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const cache = join(process.cwd(), "node_modules", ".vite");
if (existsSync(cache)) {
  rmSync(cache, { recursive: true, force: true });
  console.log("Removed", cache);
} else {
  console.log("No Vite cache to remove.");
}
