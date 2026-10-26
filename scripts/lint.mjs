// Usage: node scripts/lint.mjs — checks the repo rules from AGENTS.md. Exits 1 on any problem.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skip = new Set([".git", "node_modules", "scripts"]);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else files.push(full);
  }
})(root);

const problems = [];
for (const f of files) {
  const rel = relative(root, f).replace(/\\/g, "/");
  if (rel.endsWith(".js")) {
    const src = readFileSync(f, "utf8");
    for (const bad of [/\.innerHTML/, /insertAdjacentHTML/, /\beval\s*\(/, /document\.write/, /new Function\s*\(/]) {
      if (bad.test(src)) problems.push(`${rel}: forbidden API ${bad}`);
    }
  }
  if (rel.endsWith(".html")) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:href|src)="([^"]+\.(?:css|js))(\?[^"]*)?"/g)) {
      if (!m[2] || !m[2].startsWith("?v=")) problems.push(`${rel}: ${m[1]} lacks ?v= cache busting`);
    }
    if (!/<link rel="canonical"/.test(src)) problems.push(`${rel}: no canonical`);
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`lint ok (${files.length} files)`);
