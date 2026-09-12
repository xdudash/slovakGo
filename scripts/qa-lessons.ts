import fs from "node:fs";
import path from "node:path";

type AnyRecord = Record<string, any>;

const ROOT = process.cwd();
const DEFAULT_DIRS = ["lessons", "A1", "A2", "B1", "B2", "C1", "C2", "content"];
const SCORING_TYPES = new Set([
  "single_choice", "multiple_select", "dialogue_choose_reply", "meaning_in_context",
  "natural_phrase", "tone", "register", "hidden_meaning", "real_document", "real_message",
  "real_schedule", "listen_choice", "multiple_choice_translation", "reverse_translation", "match_pairs",
  "true_false", "true_false_list", "fill_blank", "dropdown_blank", "cloze_text", "word_bank",
  "drag_to_blank", "drag_to_category", "matching", "collocation", "image_match", "sentence_builder",
  "sentence_order", "dialogue_order", "branching_dialogue", "find_error", "correct_error",
  "transformation", "listen_true_false", "listen_fill", "dictation", "reading_comprehension", "real_menu"
]);

function isRecord(value: unknown): value is AnyRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function localizedNonEmpty(value: unknown): boolean {
  if (nonEmpty(value)) return true;
  return isRecord(value) && Object.values(value).some(nonEmpty);
}

function collectJsonFiles(target: string): string[] {
  const absolute = path.resolve(ROOT, target);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return absolute.endsWith(".json") ? [absolute] : [];

  const out: string[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) out.push(...collectJsonFiles(child));
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(child);
  }
  return out;
}

function push(errors: string[], file: string, lessonId: string, message: string): void {
  errors.push(`${path.relative(ROOT, file)} :: ${lessonId} :: ${message}`);
}

function requireField(errors: string[], file: string, lessonId: string, obj: AnyRecord, field: string): void {
  if (!(field in obj)) push(errors, file, lessonId, `missing required field '${field}'`);
}

function validateWordsScreen(errors: string[], file: string, lesson: AnyRecord): void {
  const lessonId = String(lesson.id ?? "<unknown>");
  const words = Array.isArray(lesson.words) ? lesson.words : [];
  const wordMap = new Map<string, AnyRecord>();
  for (const word of words) if (isRecord(word) && nonEmpty(word.id)) wordMap.set(word.id, word);

  const screen = lesson.wordsScreen;
  if (!isRecord(screen)) {
    push(errors, file, lessonId, "wordsScreen must be an object");
    return;
  }
  if (screen.items === undefined) return;
  if (!Array.isArray(screen.items) || screen.items.length === 0) {
    push(errors, file, lessonId, "wordsScreen.items must be a non-empty array when present");
    return;
  }

  screen.items.forEach((item: unknown, index: number) => {
    if (!isRecord(item)) {
      push(errors, file, lessonId, `wordsScreen.items[${index}] must be an object`);
      return;
    }
    if (!nonEmpty(item.sk)) push(errors, file, lessonId, `wordsScreen.items[${index}] is missing non-empty 'sk'`);
    if (!nonEmpty(item.uk)) push(errors, file, lessonId, `wordsScreen.items[${index}] is missing non-empty 'uk'`);

    if (item.wordId !== undefined) {
      const word = wordMap.get(String(item.wordId));
      if (!word) {
        push(errors, file, lessonId, `wordsScreen.items[${index}].wordId '${item.wordId}' does not resolve to lesson.words`);
      } else {
        if (item.sk !== word.sk) push(errors, file, lessonId, `wordsScreen.items[${index}].sk does not match canonical word '${item.wordId}'`);
        if (item.uk !== word.uk && item.uk !== word.translation?.uk) {
          push(errors, file, lessonId, `wordsScreen.items[${index}].uk does not match canonical word '${item.wordId}'`);
        }
      }
    }
  });
}

function hasCorrectOption(options: unknown): boolean {
  return Array.isArray(options) && options.some((o) => isRecord(o) && o.correct === true);
}

function validateExercise(errors: string[], file: string, lesson: AnyRecord, exercise: AnyRecord, index: number, wordIds: Set<string>): void {
  const lessonId = String(lesson.id ?? "<unknown>");
  const type = String(exercise.type ?? "");
  const id = String(exercise.id ?? `#${index}`);
  if (!SCORING_TYPES.has(type)) push(errors, file, lessonId, `exercise ${id} uses unknown/unregistered scoring type '${type}'`);
  if (exercise.lessonId !== undefined && exercise.lessonId !== lesson.id) push(errors, file, lessonId, `exercise ${id}.lessonId does not match lesson.id`);
  if (!Number.isInteger(exercise.order) || exercise.order < 1) push(errors, file, lessonId, `exercise ${id} has invalid order`);
  if (exercise.wordIds !== undefined) {
    if (!Array.isArray(exercise.wordIds)) push(errors, file, lessonId, `exercise ${id}.wordIds must be an array`);
    else for (const wid of exercise.wordIds) if (!wordIds.has(String(wid))) push(errors, file, lessonId, `exercise ${id} references missing word '${wid}'`);
  }

  switch (type) {
    case "single_choice": case "multiple_select": case "dialogue_choose_reply": case "meaning_in_context":
    case "natural_phrase": case "tone": case "register": case "hidden_meaning": case "real_document":
    case "real_message": case "real_schedule": case "listen_choice":
      if (!hasCorrectOption(exercise.options)) push(errors, file, lessonId, `exercise ${id} must contain at least one option with correct:true`);
      break;
    case "multiple_choice_translation": case "reverse_translation": case "match_pairs":
      if (exercise.correctAnswer === undefined) push(errors, file, lessonId, `exercise ${id} is missing correctAnswer`);
      break;
    case "true_false": case "listen_true_false":
      if (exercise.correctAnswer === undefined && !(Array.isArray(exercise.statements) && exercise.statements.length)) {
        push(errors, file, lessonId, `exercise ${id} has no deterministic true/false answer`);
      }
      break;
    case "true_false_list":
      if (!Array.isArray(exercise.statements) || !exercise.statements.length || exercise.statements.some((s: unknown) => !isRecord(s) || typeof s.correct !== "boolean")) {
        push(errors, file, lessonId, `exercise ${id} must contain statements with boolean correct values`);
      }
      break;
    case "fill_blank": case "listen_fill": case "correct_error": case "transformation":
      if (!Array.isArray(exercise.acceptedAnswers) && exercise.correctAnswer === undefined) push(errors, file, lessonId, `exercise ${id} needs acceptedAnswers or correctAnswer`);
      break;
    case "dropdown_blank":
      if (!Array.isArray(exercise.sentenceParts) || !exercise.sentenceParts.some((p: unknown) => isRecord(p) && nonEmpty(p.blankId) && nonEmpty(p.correct))) push(errors, file, lessonId, `exercise ${id} needs sentenceParts with blankId and correct`);
      break;
    case "cloze_text":
      if (!Array.isArray(exercise.textParts) || !exercise.textParts.some((p: unknown) => isRecord(p) && nonEmpty(p.blankId) && Array.isArray(p.acceptedAnswers) && p.acceptedAnswers.length)) push(errors, file, lessonId, `exercise ${id} needs textParts with acceptedAnswers`);
      break;
    case "word_bank":
      if (!Array.isArray(exercise.items) || !exercise.items.length || exercise.items.some((i: unknown) => !isRecord(i) || !nonEmpty(i.correct))) push(errors, file, lessonId, `exercise ${id} needs items with correct answers`);
      break;
    case "drag_to_blank":
      if (!nonEmpty(exercise.correct)) push(errors, file, lessonId, `exercise ${id} is missing correct`);
      break;
    case "drag_to_category":
      if (!Array.isArray(exercise.items) || !exercise.items.length || exercise.items.some((i: unknown) => !isRecord(i) || !nonEmpty(i.category))) push(errors, file, lessonId, `exercise ${id} needs items with category`);
      break;
    case "matching": case "collocation": case "image_match":
      if (!Array.isArray(exercise.pairs ?? exercise.items) || !(exercise.pairs ?? exercise.items).length) push(errors, file, lessonId, `exercise ${id} needs pairs/items for deterministic matching`);
      break;
    case "sentence_builder":
      if (!nonEmpty(exercise.correctSentence)) push(errors, file, lessonId, `exercise ${id} is missing correctSentence`);
      break;
    case "sentence_order": case "dialogue_order":
      if (!Array.isArray(exercise.correctOrder) || !exercise.correctOrder.length) push(errors, file, lessonId, `exercise ${id} is missing correctOrder`);
      break;
    case "branching_dialogue":
      if (!nonEmpty(exercise.startNode) || !isRecord(exercise.nodes)) push(errors, file, lessonId, `exercise ${id} needs startNode and nodes`);
      break;
    case "find_error":
      if (!nonEmpty(exercise.errorToken)) push(errors, file, lessonId, `exercise ${id} is missing errorToken`);
      break;
    case "listen_choice":
      if (!nonEmpty(exercise.audioRef) && !nonEmpty(exercise.audioUrl)) push(errors, file, lessonId, `exercise ${id} is missing audio reference`);
      break;
    case "dictation":
      if (!Array.isArray(exercise.acceptedAnswers) || !exercise.acceptedAnswers.length) push(errors, file, lessonId, `exercise ${id} needs acceptedAnswers`);
      if (!nonEmpty(exercise.audioRef) && !nonEmpty(exercise.audioUrl)) push(errors, file, lessonId, `exercise ${id} is missing audio reference`);
      break;
    case "reading_comprehension": case "real_menu":
      if (!Array.isArray(exercise.questions) || !exercise.questions.length) push(errors, file, lessonId, `exercise ${id} needs questions`);
      break;
  }
}

function validateLesson(errors: string[], file: string, lesson: unknown): void {
  if (!isRecord(lesson)) {
    push(errors, file, "<unknown>", "lesson must be an object");
    return;
  }
  const lessonId = String(lesson.id ?? "<unknown>");
  for (const field of ["id", "sectionId", "level", "title", "topic", "description", "order", "xpReward", "estimatedMinutes", "isPublished", "intro", "completionMessage", "startScreen", "theoryScreens", "wordsScreen", "words", "exercises", "finalSituation", "resultScreen"]) requireField(errors, file, lessonId, lesson, field);

  if (!Array.isArray(lesson.words) || lesson.words.length === 0) push(errors, file, lessonId, "words must be a non-empty array");
  const wordIds = new Set<string>();
  for (const word of lesson.words ?? []) {
    if (!isRecord(word)) continue;
    if (!nonEmpty(word.id)) push(errors, file, lessonId, "every word needs a non-empty id");
    else if (wordIds.has(word.id)) push(errors, file, lessonId, `duplicate word id '${word.id}'`);
    else wordIds.add(word.id);
    if (!nonEmpty(word.sk)) push(errors, file, lessonId, `word '${word.id}' is missing sk`);
    if (!nonEmpty(word.uk) && !localizedNonEmpty(word.translation)) push(errors, file, lessonId, `word '${word.id}' is missing uk/translation`);
  }

  validateWordsScreen(errors, file, lesson);

  if (!Array.isArray(lesson.exercises) || lesson.exercises.length === 0) push(errors, file, lessonId, "exercises must be a non-empty array");
  const exerciseIds = new Set<string>();
  const orders = new Set<number>();
  for (let i = 0; i < (lesson.exercises ?? []).length; i++) {
    const exercise = lesson.exercises[i];
    if (!isRecord(exercise)) {
      push(errors, file, lessonId, `exercises[${i}] must be an object`);
      continue;
    }
    if (nonEmpty(exercise.id)) {
      if (exerciseIds.has(exercise.id)) push(errors, file, lessonId, `duplicate exercise id '${exercise.id}'`);
      exerciseIds.add(exercise.id);
    }
    if (Number.isInteger(exercise.order)) {
      if (orders.has(exercise.order)) push(errors, file, lessonId, `duplicate exercise order '${exercise.order}'`);
      orders.add(exercise.order);
    }
    validateExercise(errors, file, lesson, exercise, i, wordIds);
  }

  if (isRecord(lesson.startScreen) && Number.isInteger(lesson.startScreen.exercisesCount) && lesson.startScreen.exercisesCount !== lesson.exercises.length) {
    push(errors, file, lessonId, `startScreen.exercisesCount (${lesson.startScreen.exercisesCount}) does not equal exercises.length (${lesson.exercises.length})`);
  }
}

function main(): void {
  const targets = process.argv.slice(2);
  const files = [...new Set((targets.length ? targets : DEFAULT_DIRS).flatMap(collectJsonFiles))].sort();
  if (!files.length) {
    console.error("QA FAILED: no lesson JSON files found. Pass explicit lesson JSON paths/directories.");
    process.exit(1);
  }

  const errors: string[] = [];
  let lessonCount = 0;
  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      errors.push(`${path.relative(ROOT, file)} :: JSON parse error: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.lessons) || parsed.lessons.length === 0) {
      errors.push(`${path.relative(ROOT, file)} :: root must contain non-empty lessons[]`);
      continue;
    }
    lessonCount += parsed.lessons.length;
    parsed.lessons.forEach((lesson: unknown) => validateLesson(errors, file, lesson));
  }

  if (errors.length) {
    console.error(`QA FAILED: ${errors.length} issue(s) across ${lessonCount} lesson(s).`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`QA PASSED: ${lessonCount} lesson(s), ${files.length} JSON file(s). Runtime contract checks passed.`);
}

main();
