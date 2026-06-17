#!/usr/bin/env node
// Write a built-in template pack into a campaign repo on disk.
// Usage: node scripts/seed-templates.mjs <repoDir> "<System Name>"
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const here = path.dirname(fileURLToPath(import.meta.url));
const packs = JSON.parse(fs.readFileSync(path.join(here, "..", "lib", "template-packs.json"), "utf8"));

const [repoDir, system] = process.argv.slice(2);
if (!repoDir || !system) {
  console.error('Usage: node scripts/seed-templates.mjs <repoDir> "<System Name>"');
  process.exit(1);
}
const pack = packs[system];
if (!pack) {
  console.error(`No pack for "${system}". Known: ${Object.keys(packs).join(", ")}`);
  process.exit(1);
}

const dir = path.join(repoDir, "wiki", "templates", system);
fs.mkdirSync(dir, { recursive: true });
for (const def of pack) {
  const serialized = `---\n${YAML.stringify(def.frontmatter).trim()}\n---\n\n${def.body.trimStart()}`;
  fs.writeFileSync(path.join(dir, `${def.slug}.md`), serialized);
}
console.log(`Seeded ${pack.length} "${system}" templates into ${dir}`);
