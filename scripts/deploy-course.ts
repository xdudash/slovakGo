/**
 * Deploy the generated SlovakGO course (lessons/**.json) to the production lessons table.
 *
 *   npx tsx scripts/deploy-course.ts            # dry run: backup + plan, changes nothing
 *   npx tsx scripts/deploy-course.ts --apply    # backup, delete old lessons, upsert the course
 *
 * Needs TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in .env.local (same as backup:lessons).
 * Every lesson goes through the same normalizeLessonPayload() as the admin bulk import.
 * "Old" lessons = every row whose id is not part of the course; they are written to
 * backups/lessons-<timestamp>.json before anything is deleted.
 */
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { normalizeLessonPayload } from "../api/_lib/lessonValidation";

config({ path: ".env.local" });
const apply = process.argv.includes("--apply");

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

const files = (await walk(resolve("lessons"))).sort();
const course = [];
for (const f of files) {
  const parsed = JSON.parse(await readFile(f, "utf8"));
  for (const raw of parsed.lessons ?? [parsed]) course.push(normalizeLessonPayload(raw));
}
const courseIds = new Set(course.map((l) => String(l.id)));
if (courseIds.size !== course.length) throw new Error("duplicate lesson ids in lessons/");
console.log(`course: ${course.length} lessons from ${files.length} files`);

const databaseUrl = process.env.TURSO_DATABASE_URL;
if (!databaseUrl) throw new Error("TURSO_DATABASE_URL is required (.env.local); nothing was changed");
const db = createClient({ url: databaseUrl, authToken: process.env.TURSO_AUTH_TOKEN });

const existing = await db.execute("SELECT id, data_json, published, created_by, updated_at FROM lessons ORDER BY rowid");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
await mkdir(resolve("backups"), { recursive: true });
const backupPath = resolve("backups", `lessons-${stamp}.json`);
await writeFile(
  backupPath,
  JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: existing.rows.length,
      lessons: existing.rows.map((r) => ({
        id: String(r.id),
        data: JSON.parse(String(r.data_json)),
        published: Boolean(r.published),
        createdBy: r.created_by === null ? null : String(r.created_by),
        updatedAt: String(r.updated_at),
      })),
    },
    null,
    2
  )
);
console.log(`backup: ${existing.rows.length} existing lessons -> ${backupPath}`);

const oldIds = existing.rows.map((r) => String(r.id)).filter((id) => !courseIds.has(id));
const updates = course.filter((l) => existing.rows.some((r) => String(r.id) === String(l.id))).length;
console.log(`plan: delete ${oldIds.length} old lessons, insert ${course.length - updates} new, update ${updates}`);
if (oldIds.length) console.log(`  old ids: ${oldIds.slice(0, 20).join(", ")}${oldIds.length > 20 ? " …" : ""}`);

if (!apply) {
  console.log("dry run — nothing changed. Re-run with --apply to deploy.");
  process.exit(0);
}

const now = new Date().toISOString();
const stmts = [
  ...oldIds.map((id) => ({ sql: "DELETE FROM lessons WHERE id = ?", args: [id] })),
  ...course.map((l) => ({
    sql: `INSERT INTO lessons (id, data_json, published, created_by, updated_at) VALUES (?, ?, ?, NULL, ?)
          ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, published = excluded.published, updated_at = excluded.updated_at`,
    args: [String(l.id), JSON.stringify(l), l.isPublished ? 1 : 0, now],
  })),
];
await db.batch(stmts, "write"); // one transaction: all or nothing
const after = await db.execute("SELECT COUNT(*) AS n FROM lessons");
console.log(`done: lessons table now has ${after.rows[0].n} rows (expected ${course.length})`);
