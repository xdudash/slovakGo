import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseImportJson } from "../services/lessonImport";
import { checkNewExercise } from "../services/exerciseChecking";
import { resolveAsset, resolveText } from "../utils/lessonLocale";
import type { Exercise, ExerciseOption, Lesson } from "../types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, "fixtures/b1-v-kaviarni-35-exercises.json"), "utf-8");

/** Reconstructs the "correct" answer for an exercise using the same encoding
 * conventions the exercise family components use, so we can drive the real
 * checker functions end-to-end against the reference fixture. */
function deriveCorrectAnswer(ex: Exercise): string | string[] {
  const correctIds = (options: ExerciseOption[] | undefined) => (options ?? []).filter((o) => o.correct).map((o) => o.id);

  switch (ex.type) {
    case "multiple_select":
      return correctIds(ex.options as ExerciseOption[]);
    case "true_false":
      if (ex.statement !== undefined) return String(ex.correctAnswer);
      return "";
    case "true_false_list":
      return (ex.statements ?? []).map((s, i) => `${i}:${s.correct}`);
    case "fill_blank":
    case "listen_fill":
      return ex.acceptedAnswers?.[0] ?? "";
    case "drag_to_blank":
      return ex.correct ?? "";
    case "dropdown_blank":
      return (ex.sentenceParts ?? []).filter((p) => p.blankId).map((p) => `${p.blankId}=${p.correct}`);
    case "cloze_text":
      return (ex.textParts ?? []).filter((p) => p.blankId).map((p) => `${p.blankId}=${p.acceptedAnswers?.[0]}`);
    case "word_bank":
      return (ex.items as { correct: string }[]).map((item, i) => `${i}=${item.correct}`);
    case "matching":
    case "collocation":
      return (ex.pairs ?? []).map((_, i) => `${i}|${i}`);
    case "image_match":
      return (ex.items as unknown[]).map((_, i) => `${i}|${i}`);
    case "drag_to_category":
      return (ex.items as { category: string }[]).map((item, i) => `${i}:${item.category}`);
    case "sentence_builder":
      return ex.tokens ?? [];
    case "sentence_order":
      return ex.correctOrder ?? [];
    case "dialogue_order":
      return ex.correctOrder ?? [];
    case "branching_dialogue": {
      const path: string[] = [];
      let nodeId = ex.startNode!;
      for (let i = 0; i < 10; i++) {
        const node = ex.nodes![nodeId];
        const best = node.choices?.find((c) => c.quality === "best");
        if (!best) break;
        path.push(best.id);
        if (!ex.nodes![best.next]) break;
        nodeId = best.next;
      }
      return path;
    }
    case "find_error":
      return ex.errorToken ?? "";
    case "correct_error":
    case "transformation":
      return ex.acceptedAnswers?.[0] ?? "";
    case "listen_true_false":
      return String(ex.correctAnswer);
    case "dictation":
      return ex.acceptedAnswers?.[0] ?? "";
    case "reading_comprehension":
    case "real_menu":
      return (ex.questions ?? []).map((q) =>
        q.options ? correctIds(q.options)[0] : typeof q.correct === "string" ? q.correct : (q.correct as { sk?: string })?.sk ?? ""
      );
    default:
      // Plain option-list family: single_choice, dialogue_choose_reply, meaning_in_context,
      // natural_phrase, tone, register, hidden_meaning, real_document, real_schedule, listen_choice.
      return correctIds(ex.options as ExerciseOption[])[0] ?? "";
  }
}

describe("new 35-type lesson format", () => {
  const { lessons, errors } = parseImportJson(fixture);

  it("imports with no validation errors", () => {
    expect(errors).toEqual([]);
    expect(lessons).toHaveLength(1);
  });

  const lesson: Lesson = lessons[0];

  it("preserves multilingual lesson-level fields", () => {
    expect(resolveText(lesson.title, "en")).toBe("At a café and restaurant");
    expect(resolveText(lesson.title, "uk")).toBe("У кафе та ресторані");
    expect(resolveText(lesson.title, "ru")).toBe("В кафе и ресторане");
  });

  it("carries all 35 exercises through import", () => {
    expect(lesson.exercises).toHaveLength(35);
  });

  it("resolves every declared image asset", () => {
    const refs = new Set<string>();
    for (const ex of lesson.exercises) {
      if (ex.imageRef) refs.add(ex.imageRef);
      for (const item of (ex.items as { imageRef?: string }[] | undefined) ?? []) {
        if (item.imageRef) refs.add(item.imageRef);
      }
    }
    if (lesson.startScreen?.imageRef) refs.add(lesson.startScreen.imageRef);
    expect(refs.size).toBeGreaterThan(0);
    for (const ref of refs) {
      const resolved = resolveAsset(lesson, ref, "images", "uk");
      expect(resolved?.src).toMatch(/^\/assets\/lessons\//);
    }
  });

  it.each(lesson.exercises)("scores exercise $id ($type) as correct given its own reference answer", (ex) => {
    const derived = deriveCorrectAnswer(ex);
    expect(checkNewExercise(ex, derived)).toBe(true);
  });

  it("scores an obviously wrong answer as incorrect for a sample of types", () => {
    const singleChoice = lesson.exercises.find((e) => e.id === "ex01")!;
    expect(checkNewExercise(singleChoice, "nonexistent-option-id")).toBe(false);

    const matching = lesson.exercises.find((e) => e.id === "ex11")!;
    expect(checkNewExercise(matching, ["0|1"])).toBe(false);
  });
});
