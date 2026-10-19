/**
 * One-click deployment of the bundled course (lessons/**.json) from the admin panel.
 *
 * The course files ship with the API function (vercel.json includeFiles), so the
 * server — which already holds the database credentials — can write them without
 * anyone needing Turso access locally. Steps are separate requests so each stays
 * well inside the serverless time limit, and every step is idempotent:
 *
 *   GET  /admin/course              plan: what would be inserted / updated / removed
 *   POST /admin/course {backup}     copy every current lesson row into lessons_backup
 *   POST /admin/course {upsert}     write one slice of the course (offset/limit)
 *   POST /admin/course {cleanup}    remove lessons that are not part of the course
 *                                   (refused until a backup exists and every course
 *                                   lesson is present)
 */
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { checkRole, exec, fail, getDb, nowIso, query, queryOne, requireUid, respond } from "./core";
import { normalizeLessonPayload } from "./lessonValidation";

type CourseLesson = ReturnType<typeof normalizeLessonPayload>;

const UPSERT_LIMIT_MAX = 60;
let cached: { dir: string; lessons: CourseLesson[] } | null = null;

export function courseDir(): string {
  return process.env.COURSE_DIR ? resolve(process.env.COURSE_DIR) : resolve(process.cwd(), "lessons");
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

/** Loads and validates the bundled course in a stable order. */
export async function loadCourse(): Promise<CourseLesson[]> {
  const dir = courseDir();
  if (cached?.dir === dir) return cached.lessons;
  const files = (await walk(dir)).sort();
  const lessons: CourseLesson[] = [];
  for (const f of files) {
    const parsed = JSON.parse(await readFile(f, "utf8")) as { lessons?: unknown[] };
    for (const raw of parsed.lessons ?? [parsed]) lessons.push(normalizeLessonPayload(raw));
  }
  const ids = new Set(lessons.map((l) => String(l.id)));
  if (ids.size !== lessons.length) throw new Error("У файлах курсу є дублікати id уроків");
  cached = { dir, lessons };
  return lessons;
}

async function ensureBackupTable(): Promise<void> {
  await exec(
    `CREATE TABLE IF NOT EXISTS lessons_backup (
       backup_id TEXT NOT NULL, id TEXT NOT NULL, data_json TEXT NOT NULL,
       published INTEGER NOT NULL, created_by TEXT, updated_at TEXT NOT NULL,
       backed_up_at TEXT NOT NULL, PRIMARY KEY (backup_id, id))`
  );
}

async function plan() {
  const course = await loadCourse();
  const courseIds = new Set(course.map((l) => String(l.id)));
  const existing = (await query("SELECT id FROM lessons")).map((r) => String(r.id));
  const existingSet = new Set(existing);
  const oldIds = existing.filter((id) => !courseIds.has(id));
  const present = course.filter((l) => existingSet.has(String(l.id))).length;
  await ensureBackupTable();
  const lastBackup = await queryOne(
    "SELECT backup_id, MAX(backed_up_at) AS at, COUNT(*) AS n FROM lessons_backup GROUP BY backup_id ORDER BY at DESC LIMIT 1"
  );
  const levels: Record<string, number> = {};
  for (const l of course) levels[String(l.level)] = (levels[String(l.level)] ?? 0) + 1;
  return {
    course: course.length,
    levels,
    existing: existing.length,
    toInsert: course.length - present,
    toUpdate: present,
    toDelete: oldIds.length,
    oldSample: oldIds.slice(0, 10),
    lastBackup: lastBackup ? { id: String(lastBackup.backup_id), at: String(lastBackup.at), lessons: Number(lastBackup.n) } : null,
  };
}

export async function handleAdminCourse(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>): Promise<void> {
  const uid = await requireUid(req, res); if (!uid) return;
  if (!(await checkRole(uid, "admin"))) return fail(res, "Недостатньо прав", 403);

  try {
    if (req.method === "GET") return respond(res, { ok: true, plan: await plan() });

    const step = String(body.step ?? "");
    if (step === "backup") {
      await ensureBackupTable();
      const backupId = `backup-${nowIso()}-${randomUUID().slice(0, 8)}`;
      await exec(
        `INSERT INTO lessons_backup (backup_id, id, data_json, published, created_by, updated_at, backed_up_at)
         SELECT ?, id, data_json, published, created_by, updated_at, ? FROM lessons`,
        [backupId, nowIso()]
      );
      const n = await queryOne("SELECT COUNT(*) AS n FROM lessons_backup WHERE backup_id = ?", [backupId]);
      return respond(res, { ok: true, backupId, lessons: Number(n?.n ?? 0) });
    }

    if (step === "upsert") {
      const course = await loadCourse();
      const offset = Math.max(0, Math.floor(Number(body.offset ?? 0)) || 0);
      const limit = Math.min(UPSERT_LIMIT_MAX, Math.max(1, Math.floor(Number(body.limit ?? 40)) || 40));
      const slice = course.slice(offset, offset + limit);
      const now = nowIso();
      if (slice.length) {
        await getDb().batch(slice.map((l) => ({
          sql: `INSERT INTO lessons (id, data_json, published, created_by, updated_at) VALUES (?, ?, ?, NULL, ?)
                ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, published = excluded.published, updated_at = excluded.updated_at`,
          args: [String(l.id), JSON.stringify(l), l.isPublished ? 1 : 0, now],
        })), "write");
      }
      return respond(res, { ok: true, written: slice.length, next: offset + slice.length, total: course.length, done: offset + slice.length >= course.length });
    }

    if (step === "cleanup") {
      await ensureBackupTable();
      const course = await loadCourse();
      const courseIds = new Set(course.map((l) => String(l.id)));
      const existing = (await query("SELECT id FROM lessons")).map((r) => String(r.id));
      const missing = course.length - existing.filter((id) => courseIds.has(id)).length;
      if (missing > 0) return fail(res, `Спочатку завантаж увесь курс: бракує ${missing} уроків`, 409);
      const oldIds = existing.filter((id) => !courseIds.has(id));
      if (oldIds.length) {
        const backedUp = await queryOne(
          `SELECT COUNT(DISTINCT id) AS n FROM lessons_backup WHERE id IN (${oldIds.map(() => "?").join(",")})`, oldIds
        );
        if (Number(backedUp?.n ?? 0) < oldIds.length) return fail(res, "Спочатку зроби резервну копію старих уроків", 409);
        for (let i = 0; i < oldIds.length; i += 200) {
          const chunk = oldIds.slice(i, i + 200);
          await exec(`DELETE FROM lessons WHERE id IN (${chunk.map(() => "?").join(",")})`, chunk);
        }
      }
      const n = await queryOne("SELECT COUNT(*) AS n FROM lessons");
      return respond(res, { ok: true, deleted: oldIds.length, lessons: Number(n?.n ?? 0) });
    }

    return fail(res, "Невідомий крок", 422);
  } catch (err) {
    console.error("[course deploy]", err);
    return fail(res, `Помилка розгортання: ${(err as Error).message}`, 500);
  }
}
