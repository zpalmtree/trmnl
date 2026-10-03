#!/usr/bin/env node
// Re-exports the cards and redeploys the Worker only when they changed. The
// trmnl-family-tree-sync systemd timer runs this daily; `npm run deploy` runs it
// with --force.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { writeExport } from "./export.mjs";

const projectDir = fileURLToPath(new URL("..", import.meta.url));
const stampFile = new URL("../src/data/deployed.sha256", import.meta.url);
const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));

const cards = await writeExport();
const hash = createHash("sha256").update(JSON.stringify(cards)).digest("hex");
const deployed = await readFile(stampFile, "utf8").then((value) => value.trim(), () => null);

if (hash === deployed && !process.argv.includes("--force")) {
  console.log("cards unchanged since the last deploy; nothing to do");
  process.exit(0);
}

// Wrangler must use this project's Cloudflare account (.env), not a global login.
const result = spawnSync(process.execPath, [wrangler, "deploy"], {
  cwd: projectDir,
  env: { ...process.env, ...readDotEnv(new URL("../.env", import.meta.url)) },
  stdio: "inherit",
});
if (result.status !== 0) {
  console.error(`wrangler deploy failed with status ${result.status}`);
  process.exit(1);
}
await writeFile(stampFile, `${hash}\n`);
console.log(`deployed ${cards.length} people`);

function readDotEnv(file) {
  const values = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}
