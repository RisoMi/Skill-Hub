import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const item of ["index.html", "assets", "src"]) {
  const from = path.join(root, item);
  if (!existsSync(from)) continue;
  await cp(from, path.join(dist, item), { recursive: true });
}

console.log(`[copy-frontend] 前端已复制到 ${dist}`);
