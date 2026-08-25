import type { Exercise, ExerciseOption, ExerciseType, LocalizedText } from "../types";
import { toPlainText } from "../utils/lessonLocale";

/** Same normalization convention used by the legacy `sameAnswer` checker. */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[.!?]/g, "");
}

function normalizedEquals(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

function textOf(v: string | LocalizedText | undefined): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return v.sk ?? toPlainText(v);
}

/** Joins sentence-builder tokens without inserting a space before punctuation-only tokens. */
function joinTokens(tokens: string[]): string {
  let out = "";
  for (const tok of tokens) {
    if (/^[,.!?;:]+$/.test(tok) || out === "") {
      out += tok;
    } else {
      out += " " + tok;
    }
  }
  return out;
}

function optionLabel(o: ExerciseOption): string {
  return o.sk ?? textOf(o.text);
}

function correctOptionIds(options: ExerciseOption[] | undefined): string[] {
  return (options ?? []).filter((o) => o.correct).map((o) => o.id);
}

// ---- checkers -------------------------------------------------------

function checkOptionList(exercise: Exercise, answer: string | string[]): boolean {
  const options = (exercise.options ?? []) as ExerciseOption[];
  const correctIds = new Set(correctOptionIds(options));
  if (exercise.type === "multiple_select") {
    const chosen = Array.isArray(answer) ? answer : [answer];
    if (chosen.length !== correctIds.size) return false;
    return chosen.every((id) => correctIds.has(id));
  }
  const chosen = Array.isArray(answer) ? answer[0] : answer;
  return correctIds.has(chosen);
}

function checkTrueFalse(exercise: Exercise, answer: string | string[]): boolean {
  if (exercise.statements) {
    const chosen = Array.isArray(answer) ? answer : [answer];
    const map = new Map(chosen.map((entry) => entry.split(":") as [string, string]));
    return exercise.statements.every((s, idx) => map.get(String(idx)) === String(s.correct));
  }
  const chosen = Array.isArray(answer) ? answer[0] : answer;
  return String(chosen) === String(exercise.correctAnswer);
}

function checkBlanks(exercise: Exercise, answer: string | string[]): boolean {
  switch (exercise.type) {
    case "fill_blank":
    case "listen_fill": {
      const chosen = Array.isArray(answer) ? answer[0] : answer;
      return (exercise.acceptedAnswers ?? []).some((a) => normalizedEquals(a, chosen ?? ""));
    }
    case "drag_to_blank": {
      const chosen = Array.isArray(answer) ? answer[0] : answer;
      return normalizedEquals(chosen ?? "", exercise.correct ?? "");
    }
    case "dropdown_blank": {
      const chosen = Array.isArray(answer) ? answer : [answer];
      const map = new Map(chosen.map((entry) => entry.split("=") as [string, string]));
      const blanks = (exercise.sentenceParts ?? []).filter((p) => p.blankId);
      return blanks.every((b) => map.get(b.blankId!) === b.correct);
    }
    case "cloze_text": {
      const chosen = Array.isArray(answer) ? answer : [answer];
      const map = new Map(chosen.map((entry) => entry.split("=") as [string, string]));
      const blanks = (exercise.textParts ?? []).filter((p) => p.blankId);
      return blanks.every((b) => (b.acceptedAnswers ?? []).some((a) => normalizedEquals(a, map.get(b.blankId!) ?? "")));
    }
    case "word_bank": {
      const chosen = Array.isArray(answer) ? answer : [answer];
      const map = new Map(chosen.map((entry) => entry.split("=") as [string, string]));
      const items = exercise.items as { sentence: string; correct: string }[] | undefined;
      return (items ?? []).every((item, idx) => normalizedEquals(map.get(String(idx)) ?? "", item.correct));
    }
    default:
      return false;
  }
}

function checkMatching(exercise: Exercise, answer: string | string[]): boolean {
  const list = exercise.type === "image_match" ? exercise.items : exercise.pairs;
  const total = (list as unknown[] | undefined)?.length ?? 0;
  const chosen = Array.isArray(answer) ? answer : [answer];
  if (chosen.length !== total) return false;
  return chosen.every((entry) => {
    const [leftIdx, rightIdx] = entry.split("|");
    return leftIdx === rightIdx;
  });
}

function checkCategorySort(exercise: Exercise, answer: string | string[]): boolean {
  const items = exercise.items as { sk: string; category: string }[] | undefined;
  const chosen = Array.isArray(answer) ? answer : [answer];
  const map = new Map(chosen.map((entry) => entry.split(":") as [string, string]));
  return (items ?? []).every((item, idx) => map.get(String(idx)) === item.category);
}

function checkSentenceBuilder(exercise: Exercise, answer: string | string[]): boolean {
  const chosen = Array.isArray(answer) ? answer : [answer];
  if (exercise.type === "sentence_order") {
    return chosen.join("|") === (exercise.correctOrder ?? []).join("|");
  }
  return normalizedEquals(joinTokens(chosen), exercise.correctSentence ?? "");
}

function checkDialogueOrder(exercise: Exercise, answer: string | string[]): boolean {
  const chosen = Array.isArray(answer) ? answer : [answer];
  return chosen.join(",") === (exercise.correctOrder ?? []).join(",");
}

function checkBranchingDialogue(exercise: Exercise, answer: string | string[]): boolean {
  const chosen = Array.isArray(answer) ? answer : [answer];
  if (chosen.length === 0 || !exercise.nodes || !exercise.startNode) return false;
  let nodeId = exercise.startNode;
  for (const choiceId of chosen) {
    const node = exercise.nodes[nodeId];
    const choice = node?.choices?.find((c) => c.id === choiceId);
    if (!choice || choice.quality !== "best") return false;
    nodeId = choice.next;
  }
  return true;
}

function checkTextEdit(exercise: Exercise, answer: string | string[]): boolean {
  const chosen = Array.isArray(answer) ? answer[0] : answer;
  if (exercise.type === "find_error") {
    return normalizedEquals(chosen ?? "", exercise.errorToken ?? "");
  }
  return (exercise.acceptedAnswers ?? []).some((a) => normalizedEquals(a, chosen ?? ""));
}

function checkDictation(exercise: Exercise, answer: string | string[]): boolean {
  const chosen = Array.isArray(answer) ? answer[0] : answer ?? "";
  return (exercise.acceptedAnswers ?? []).some((expected) => {
    let a = chosen.trim();
    let b = expected.trim();
    if (exercise.ignoreCase) {
      a = a.toLowerCase();
      b = b.toLowerCase();
    }
    if (exercise.ignoreTerminalPunctuation) {
      a = a.replace(/[.!?]+$/, "");
      b = b.replace(/[.!?]+$/, "");
    }
    return a === b;
  });
}

function checkNestedQuestions(exercise: Exercise, answer: string | string[]): boolean {
  const chosen = Array.isArray(answer) ? answer : [answer];
  const questions = exercise.questions ?? [];
  return questions.every((q, idx) => {
    const given = chosen[idx] ?? "";
    if (q.options) {
      const correctIds = new Set(correctOptionIds(q.options));
      return correctIds.has(given);
    }
    return normalizedEquals(given, textOf(q.correct));
  });
}

export const exerciseCheckers: Partial<Record<ExerciseType, (exercise: Exercise, answer: string | string[]) => boolean>> = {
  single_choice: checkOptionList,
  multiple_select: checkOptionList,
  dialogue_choose_reply: checkOptionList,
  meaning_in_context: checkOptionList,
  natural_phrase: checkOptionList,
  tone: checkOptionList,
  register: checkOptionList,
  hidden_meaning: checkOptionList,
  real_document: checkOptionList,
  real_schedule: checkOptionList,
  real_message: checkOptionList,
  listen_choice: checkOptionList,
  true_false_list: checkTrueFalse,
  fill_blank: checkBlanks,
  dropdown_blank: checkBlanks,
  cloze_text: checkBlanks,
  word_bank: checkBlanks,
  drag_to_blank: checkBlanks,
  listen_fill: checkBlanks,
  matching: checkMatching,
  collocation: checkMatching,
  image_match: checkMatching,
  drag_to_category: checkCategorySort,
  sentence_builder: checkSentenceBuilder,
  sentence_order: checkSentenceBuilder,
  dialogue_order: checkDialogueOrder,
  branching_dialogue: checkBranchingDialogue,
  find_error: checkTextEdit,
  correct_error: checkTextEdit,
  transformation: checkTextEdit,
  listen_true_false: checkTrueFalse,
  dictation: checkDictation,
  reading_comprehension: checkNestedQuestions,
  real_menu: checkNestedQuestions,
};

/** New-format `true_false` (statement-shaped) also routes through the true/false checker. */
export function isNewStyleTrueFalse(exercise: Exercise): boolean {
  return exercise.type === "true_false" && exercise.statement !== undefined;
}

export function checkNewExercise(exercise: Exercise, answer: string | string[]): boolean | undefined {
  if (isNewStyleTrueFalse(exercise)) return checkTrueFalse(exercise, answer);
  const checker = exerciseCheckers[exercise.type];
  return checker ? checker(exercise, answer) : undefined;
}

/** Human-readable "correct answer" for mistake review / wrong-answer summaries. */
export function formatCorrectAnswer(exercise: Exercise): string {
  if (isNewStyleTrueFalse(exercise)) {
    return exercise.correctAnswer === true || exercise.correctAnswer === "true" ? "Pravda" : "Nepravda";
  }
  switch (exercise.type) {
    case "single_choice":
    case "multiple_select":
    case "dialogue_choose_reply":
    case "meaning_in_context":
    case "natural_phrase":
    case "tone":
    case "register":
    case "hidden_meaning":
    case "real_document":
    case "real_schedule":
    case "real_message":
    case "listen_choice": {
      const options = (exercise.options ?? []) as ExerciseOption[];
      return options.filter((o) => o.correct).map(optionLabel).join(", ");
    }
    case "true_false_list":
      return (exercise.statements ?? []).map((s) => `${s.sk}: ${s.correct ? "Pravda" : "Nepravda"}`).join("; ");
    case "fill_blank":
    case "listen_fill":
    case "dictation":
    case "correct_error":
    case "transformation":
      return (exercise.acceptedAnswers ?? []).join(", ");
    case "drag_to_blank":
      return exercise.correct ?? "";
    case "dropdown_blank":
      return (exercise.sentenceParts ?? []).filter((p) => p.correct).map((p) => p.correct).join(", ");
    case "cloze_text":
      return (exercise.textParts ?? []).filter((p) => p.acceptedAnswers?.length).map((p) => p.acceptedAnswers![0]).join(", ");
    case "word_bank":
      return (exercise.items as { correct: string }[] | undefined)?.map((i) => i.correct).join(", ") ?? "";
    case "matching":
    case "collocation":
      return (exercise.pairs ?? []).map((p) => `${textOf(p.left)} → ${textOf(p.right)}`).join("; ");
    case "image_match":
      return (exercise.items as { sk: string }[] | undefined)?.map((i) => i.sk).join(", ") ?? "";
    case "drag_to_category":
      return (exercise.items as { sk: string; category: string }[] | undefined)
        ?.map((i) => `${i.sk} → ${i.category}`)
        .join("; ") ?? "";
    case "sentence_builder":
      return exercise.correctSentence ?? "";
    case "sentence_order":
      return joinTokens(exercise.correctOrder ?? []);
    case "dialogue_order": {
      const bySk = new Map((exercise.lines ?? []).map((l) => [l.id, l.sk]));
      return (exercise.correctOrder ?? []).map((id) => bySk.get(id) ?? id).join(" → ");
    }
    case "branching_dialogue":
      return textOf(exercise.successMessage);
    case "find_error":
      return exercise.correctToken ?? "";
    case "reading_comprehension":
    case "real_menu":
      return (exercise.questions ?? [])
        .map((q) => (q.options ? q.options.filter((o) => o.correct).map(optionLabel).join("/") : textOf(q.correct)))
        .join("; ");
    default:
      return Array.isArray(exercise.correctAnswer)
        ? exercise.correctAnswer.join(", ")
        : String(exercise.correctAnswer ?? "");
  }
}
