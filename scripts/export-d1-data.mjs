import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const tables = [
  "accounts",
  "auth_limits",
  "contract_images",
  "memberships",
  "records",
  "sessions",
  "tenant_images",
  "workspaces",
];
const database = process.env.CLOUDFLARE_D1_DATABASE;
const bucket = process.env.CLOUDFLARE_R2_BUCKET;
const outputDir = resolve(".migration");
const assetsDir = resolve(outputDir, "r2");

if (!database || !/^[\w-]+$/.test(database)) {
  throw new Error("Set CLOUDFLARE_D1_DATABASE to the D1 database name.");
}
if (!bucket || !/^[\w-]+$/.test(bucket)) {
  throw new Error("Set CLOUDFLARE_R2_BUCKET to the R2 bucket name.");
}

function runWrangler(args, { capture = false } = {}) {
  const npmCli = process.env.npm_execpath ??
    join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  const result = spawnSync(process.execPath, [
    npmCli, "exec", "--yes", "--package=wrangler@4", "--", "wrangler", ...args,
  ], {
    encoding: capture ? "utf8" : undefined,
    maxBuffer: 64 * 1024 * 1024,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Wrangler exited with status ${result.status}.`);
  return capture ? result.stdout : "";
}

function rowsFromOutput(output) {
  for (const match of output.matchAll(/(?:^|\r?\n)\s*([\[{])/g)) {
    try {
      const payload = JSON.parse(output.slice(match.index + match[0].length - 1));
      const result = Array.isArray(payload)
        ? payload.find((item) => item && Array.isArray(item.results))?.results
        : payload?.results;
      if (Array.isArray(result)) return result;
    } catch {
      continue;
    }
  }
  throw new Error("Wrangler did not return the expected D1 JSON response.");
}

function localAssetPath(key) {
  if (typeof key !== "string" || !key || key.includes("\0")) {
    throw new Error("An attachment has an invalid R2 object key.");
  }
  const path = resolve(assetsDir, ...key.split(/[\\/]/));
  const rel = relative(assetsDir, path);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("An attachment key resolves outside the migration directory.");
  }
  return path;
}

async function main() {
  await mkdir(assetsDir, { recursive: true });
  const snapshot = {};

  for (const table of tables) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const output = runWrangler([
        "d1", "execute", database, "--remote", "--json",
        "--command", `SELECT * FROM "${table}" LIMIT 500 OFFSET ${offset}`,
      ], { capture: true });
      const page = rowsFromOutput(output);
      rows.push(...page);
      if (page.length < 500) break;
    }
    snapshot[table] = rows;
    console.log(`Exported ${rows.length} rows from ${table}.`);
  }

  const attachments = [
    ...snapshot.contract_images,
    ...snapshot.tenant_images,
  ];
  for (const attachment of attachments) {
    const path = localAssetPath(attachment.object_key);
    await mkdir(dirname(path), { recursive: true });
    runWrangler([
      "r2", "object", "get",
      `${bucket}/${attachment.object_key}`,
      "--remote", "--file", path,
    ]);
  }

  await writeFile(resolve(outputDir, "d1-snapshot.json"), `${JSON.stringify(snapshot)}\n`, {
    encoding: "utf8",
    flag: "w",
  });
  console.log(`Snapshot and R2 files saved under ${outputDir}. Keep this directory private.`);
}

await main();
