/** Read-only export of all lessons before a production migration. */
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

config({ path: ".env.local" });

const databaseUrl = process.env.TURSO_DATABASE_URL;
if (!databaseUrl) throw new Error("TURSO_DATABASE_URL is required; no database was read");

const db = createClient({ url: databaseUrl, authToken: process.env.TURSO_AUTH_TOKEN });
const result = await db.execute(
  "SELECT id, data_json, published, created_by, updated_at FROM lessons ORDER BY rowid"
);
const lessons = result.rows.map((row) => ({
  id: String(row.id),
  data: JSON.parse(String(row.data_json)),
  published: Boolean(row.published),
  createdBy: row.created_by === null ? null : String(row.created_by),
  updatedAt: String(row.updated_at),
}));

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = resolve("backups");
const destination = resolve(dir, `lessons-${stamp}.json`);
await mkdir(dir, { recursive: true });
await writeFile(destination, JSON.stringify({ exportedAt: new Date().toISOString(), count: lessons.length, lessons }, null, 2));
console.log(`Exported ${lessons.length} lessons to ${destination}`);
