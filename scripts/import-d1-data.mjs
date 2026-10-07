import { access, readFile } from "node:fs/promises";
import { relative, resolve, isAbsolute } from "node:path";
import postgres from "postgres";
import { del, put } from "@vercel/blob";

try {
  process.loadEnvFile(".env.local");
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
}

const tables = {
  accounts: ["id", "phone", "name", "password_hash", "recovery_hash", "created_at"],
  auth_limits: ["key", "attempts", "expires_at"],
  workspaces: ["id", "name", "owner_id", "created_at"],
  records: ["id", "owner", "kind", "data", "slot", "version", "parent_id", "tenant_id", "created_at"],
  memberships: ["id", "workspace_id", "user_id", "phone", "name", "role", "status", "building_ids", "tenant_id", "token_hash", "expires_at", "version", "created_at"],
  sessions: ["token_hash", "user_id", "expires_at"],
  contract_images: ["id", "owner", "contract_id", "object_key", "name", "mime", "size", "created_at"],
  tenant_images: ["id", "owner", "tenant_id", "object_key", "name", "mime", "size", "created_at"],
};
const recordOrder = ["buildings", "tenants", "rooms", "contracts", "invoices", "expenses"];
const root = resolve(".migration");
const snapshotPath = resolve(root, "d1-snapshot.json");
const assetsRoot = resolve(root, "r2");

function assetPath(key) {
  if (typeof key !== "string" || !key || key.includes("\0")) {
    throw new Error("An attachment has an invalid R2 object key.");
  }
  const path = resolve(assetsRoot, ...key.split(/[\\/]/));
  const rel = relative(assetsRoot, path);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("An attachment key resolves outside the migration directory.");
  }
  return path;
}

function validateSnapshot(snapshot) {
  for (const [table, columns] of Object.entries(tables)) {
    if (!Array.isArray(snapshot[table])) {
      throw new Error(`Snapshot must contain an array named "${table}".`);
    }
    for (const row of snapshot[table]) {
      if (!row || typeof row !== "object" || columns.some((column) => !(column in row))) {
        throw new Error(`Snapshot contains a malformed row in "${table}".`);
      }
    }
  }
}

async function deleteBlobs(pathnames) {
  for (let offset = 0; offset < pathnames.length; offset += 1000) {
    await del(pathnames.slice(offset, offset + 1000));
  }
}

async function ensureEmpty(sql) {
  for (const table of Object.keys(tables)) {
    const [row] = await sql.unsafe(`SELECT count(*)::int AS count FROM "${table}"`);
    if (row.count !== 0) throw new Error(`Target table "${table}" is not empty; import aborted.`);
  }
}

async function uploadAttachments(snapshot) {
  const uploaded = [];
  const rows = [...snapshot.contract_images, ...snapshot.tenant_images];
  try {
    for (const row of rows) {
      const filePath = assetPath(row.object_key);
      await access(filePath);
      const bytes = await readFile(filePath);
      if (bytes.length !== row.size) {
        throw new Error(`R2 file size mismatch for attachment ${row.id}.`);
      }
      await put(row.object_key, bytes, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: row.mime,
      });
      uploaded.push(row.object_key);
    }
  } catch (error) {
    if (uploaded.length) {
      try {
        await deleteBlobs(uploaded);
      } catch (cleanupError) {
        console.error("Could not remove partially copied private Blob objects.", cleanupError);
      }
    }
    throw error;
  }
  return uploaded;
}

async function insertRows(transaction, table, columns, rows) {
  for (let offset = 0; offset < rows.length; offset += 250) {
    const chunk = rows.slice(offset, offset + 250);
    const values = [];
    const groups = chunk.map((row) => {
      const placeholders = columns.map((column) => {
        values.push(row[column] ?? null);
        return `$${values.length}`;
      });
      return `(${placeholders.join(",")})`;
    });
    await transaction.unsafe(
      `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(",")}) VALUES ${groups.join(",")}`,
      values,
    );
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  validateSnapshot(snapshot);

  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  let uploaded = [];
  try {
    await ensureEmpty(sql);
    uploaded = await uploadAttachments(snapshot);
    const orderedRecords = [...snapshot.records].sort((left, right) => {
      const leftKind = recordOrder.indexOf(left.kind);
      const rightKind = recordOrder.indexOf(right.kind);
      return (leftKind < 0 ? recordOrder.length : leftKind) -
        (rightKind < 0 ? recordOrder.length : rightKind);
    });

    await sql.begin(async (transaction) => {
      for (const table of ["accounts", "workspaces"]) {
        await insertRows(transaction, table, tables[table], snapshot[table]);
      }
      await insertRows(transaction, "records", tables.records, orderedRecords);
      for (const table of ["memberships", "sessions", "auth_limits", "contract_images", "tenant_images"]) {
        await insertRows(transaction, table, tables[table], snapshot[table]);
      }
    });
  } catch (error) {
    if (uploaded.length) {
      try {
        await deleteBlobs(uploaded);
      } catch (cleanupError) {
        console.error("Could not remove private Blob objects after the database import failed.", cleanupError);
      }
    }
    throw error;
  } finally {
    await sql.end();
  }

  for (const [table, rows] of Object.entries(snapshot)) {
    console.log(`Imported ${rows.length} rows into ${table}.`);
  }
  console.log(`Copied ${uploaded.length} private attachments. Verify the new deployment before removing the Cloudflare source.`);
}

await main();
