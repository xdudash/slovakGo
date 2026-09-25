import type { Lesson } from "../../src/types";
import { parseImportJson } from "../../src/services/lessonImport";

export function normalizeLessonPayload(raw: unknown): Lesson {
  const { lessons, errors } = parseImportJson(JSON.stringify({ lessons: [raw] }));
  if (errors.length || lessons.length !== 1) {
    throw new Error(errors.join("; ") || "Некоректний урок");
  }
  return lessons[0];
}
