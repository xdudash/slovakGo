import type { Exercise, ExerciseType, Lesson, LocalizedText, UserLevel, Word } from "../types";
import { toPlainText } from "../utils/lessonLocale";

/** Passes a raw JSON value through as `LocalizedText` (plain string or per-locale map), untouched. */
function asLocalized(v: unknown): LocalizedText | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v as LocalizedText;
  return String(v);
}

function validateWord(
  raw: Record<string, unknown>,
  lessonId: string,
  idx: number,
  lessonLevel: UserLevel,
  lessonTopic: LocalizedText
): Word {
  const translation = asLocalized(raw.translation);
  const uk = raw.uk ? String(raw.uk) : toPlainText(translation);
  if (!raw.sk || !uk) throw new Error(`Слово #${idx + 1}: відсутнє sk та uk/translation`);
  const example = raw.example as Record<string, unknown> | undefined;
  return {
    id:           String(raw.id    ?? `${lessonId}-word-${idx + 1}`),
    sk:           String(raw.sk),
    uk,
    exampleSk:    raw.exampleSk ? String(raw.exampleSk) : example?.sk ? String(example.sk) : undefined,
    exampleUk:    raw.exampleUk ? String(raw.exampleUk) : (example ? toPlainText(asLocalized(example.translation)) || undefined : undefined),
    level:        (raw.level ?? lessonLevel ?? "A1") as UserLevel,
    topic:        raw.topic ? String(raw.topic) : toPlainText(lessonTopic),
    lessonId,
    audioUrl:     raw.audioUrl     ? String(raw.audioUrl)     : undefined,
    transcription: raw.transcription ? String(raw.transcription) : undefined,
    tags:         Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    partOfSpeech: raw.partOfSpeech ? String(raw.partOfSpeech) : undefined,
    translation,
    example:      example ? { sk: String(example.sk ?? ""), translation: asLocalized(example.translation) } : undefined,
  };
}

const LEGACY_EXERCISE_TYPES = [
  "multiple_choice_translation", "multiple_choice_context", "choose_response",
  "reverse_translation", "audio_choice", "match_pairs",
  "true_false", "fill_blank", "sentence_ordering", "typing", "mistake_review",
];
const NEW_EXERCISE_TYPES = [
  "single_choice", "multiple_select", "true_false_list", "dropdown_blank", "cloze_text",
  "word_bank", "drag_to_blank", "drag_to_category", "matching", "image_match",
  "sentence_builder", "sentence_order", "dialogue_order", "dialogue_choose_reply",
  "branching_dialogue", "find_error", "correct_error", "transformation", "listen_choice",
  "listen_true_false", "listen_fill", "dictation", "reading_comprehension",
  "meaning_in_context", "natural_phrase", "tone", "register", "hidden_meaning",
  "collocation", "real_document", "real_message", "real_menu", "real_schedule",
];
const VALID_EXERCISE_TYPES = [...LEGACY_EXERCISE_TYPES, ...NEW_EXERCISE_TYPES];

/** New-format optional fields passed through verbatim — shape varies per exercise type, see src/types. */
const EXERCISE_PASSTHROUGH_KEYS = [
  "instruction", "skill", "prompt", "text", "statement", "statements", "sentence",
  "sentenceParts", "textParts", "wordBank", "items", "draggable", "correct", "categories",
  "pairs", "tokens", "correctSentence", "correctOrder", "lines", "dialogue", "nodes",
  "startNode", "successMessage", "errorToken", "correctToken", "source", "audioRef",
  "imageRef", "context", "target", "situation", "phrase", "document", "message",
  "menuData", "schedule", "questions", "acceptedAnswers", "hint", "ignoreCase",
  "ignoreTerminalPunctuation", "extraWords", "displaySentence",
] as const;

function validateExercise(raw: Record<string, unknown>, lessonId: string, idx: number): Exercise {
  let type = String(raw.type ?? "multiple_choice_translation");

  // Backward compatibility for old JSON exports
  if (type === "multiple_choice" || type === "multiple_choice_reading") {
    type = "multiple_choice_translation";
  } else if (type === "mini_situation") {
    // Treat old mini situations as fill_blank or translation depending on the data
    type = "multiple_choice_translation";
  }

  if (!VALID_EXERCISE_TYPES.includes(type)) throw new Error(`Вправа #${idx + 1}: невідомий тип "${type}"`);

  const extra: Record<string, unknown> = {};
  for (const key of EXERCISE_PASSTHROUGH_KEYS) {
    if (raw[key] !== undefined) extra[key] = raw[key];
  }

  return {
    id:            String(raw.id      ?? `${lessonId}-ex-${idx + 1}`),
    lessonId,
    type:          type as ExerciseType,
    question:      asLocalized(raw.question),
    options:       Array.isArray(raw.options) ? (raw.options as Exercise["options"]) : undefined,
    correctAnswer: raw.correctAnswer === undefined
      ? undefined
      : Array.isArray(raw.correctAnswer)
        ? (raw.correctAnswer as string[])
        : typeof raw.correctAnswer === "boolean"
          ? raw.correctAnswer
          : String(raw.correctAnswer),
    explanation:   asLocalized(raw.explanation),
    wordIds:       Array.isArray(raw.wordIds)   ? (raw.wordIds   as string[]) : undefined,
    audioUrl:      raw.audioUrl    ? String(raw.audioUrl)     : undefined,
    imageUrl:      raw.imageUrl    ? String(raw.imageUrl)     : undefined,
    order:         Number(raw.order ?? idx + 1),
    difficulty:    raw.difficulty ? (raw.difficulty as Exercise["difficulty"]) : undefined,
    fullSentence:  raw.fullSentence ? String(raw.fullSentence) : undefined,
    button:        raw.button ? String(raw.button) : undefined,
    ...(extra as Partial<Exercise>),
  };
}

function validateLesson(raw: unknown): Lesson {
  const r = raw as Record<string, unknown>;
  if (!r.id)    throw new Error(`Урок без id`);
  if (!r.title) throw new Error(`Урок "${r.id}" без title`);
  if (!r.level) throw new Error(`Урок "${r.id}" без level`);
  const id = String(r.id);
  const level = (r.level ?? "A1") as UserLevel;
  const topic = asLocalized(r.topic) ?? "";
  const words     = Array.isArray(r.words)     ? r.words.map((w, i) => validateWord(w as Record<string, unknown>, id, i, level, topic))     : [];
  const exercises = Array.isArray(r.exercises) ? r.exercises.map((e, i) => validateExercise(e as Record<string, unknown>, id, i)) : [];
  return {
    id,
    level,
    title:              asLocalized(r.title) ?? id,
    description:        asLocalized(r.description) ?? "",
    topic,
    order:              Number(r.order          ?? 0),
    xpReward:           Number(r.xpReward       ?? 15),
    estimatedMinutes:   Number(r.estimatedMinutes ?? 8),
    isPublished:        Boolean(r.isPublished   ?? false),
    isLocked:           Boolean(r.isLocked      ?? false),
    createdBy:          r.createdBy ? String(r.createdBy) : undefined,
    intro:              asLocalized(r.intro),
    completionMessage:  asLocalized(r.completionMessage),
    words,
    exercises,
    updatedAt:          String(r.updatedAt ?? new Date().toISOString()),
    startScreen:        r.startScreen    ? (r.startScreen    as Lesson["startScreen"])    : undefined,
    theoryScreens:      Array.isArray(r.theoryScreens) ? (r.theoryScreens as Lesson["theoryScreens"]) : undefined,
    wordsScreen:        r.wordsScreen    ? (r.wordsScreen    as Lesson["wordsScreen"])    : undefined,
    finalSituation:     r.finalSituation ? (r.finalSituation as Lesson["finalSituation"]) : undefined,
    resultScreen:       r.resultScreen   ? (r.resultScreen   as Lesson["resultScreen"])   : undefined,
    sectionId:          r.sectionId ? String(r.sectionId) : undefined,
    localization:       r.localization ? (r.localization as Lesson["localization"]) : undefined,
    assets:             r.assets ? (r.assets as Lesson["assets"]) : undefined,
  };
}

export function parseImportJson(text: string): { lessons: Lesson[]; errors: string[] } {
  const errors: string[] = [];
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { lessons: [], errors: ["Невалідний JSON"] }; }
  const arr: unknown[] = Array.isArray(raw) ? raw : (raw as Record<string, unknown>).lessons as unknown[];
  if (!Array.isArray(arr)) return { lessons: [], errors: ["JSON має містити масив або об'єкт з полем lessons"] };
  const lessons: Lesson[] = [];
  for (const item of arr) {
    try { lessons.push(validateLesson(item)); }
    catch (err) { errors.push((err as Error).message); }
  }
  return { lessons, errors };
}
