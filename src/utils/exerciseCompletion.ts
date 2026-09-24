import type { Exercise, FinalSituationInteractive } from "../types";

function answerList(answer: string | string[]): string[] {
  if (Array.isArray(answer)) return answer.filter((value) => value !== "");
  return answer ? [answer] : [];
}

/**
 * Returns whether the learner has supplied enough input for the exercise to be
 * meaningfully checked. This prevents partial multi-part exercises from being
 * graded as wrong just because at least one answer exists.
 */
export function isExerciseComplete(exercise: Exercise, answer: string | string[]): boolean {
  const answers = answerList(answer);

  switch (exercise.type) {
    case "true_false_list":
      return answers.length === (exercise.statements?.length ?? 0) && answers.length > 0;
    case "dropdown_blank":
      return answers.length === (exercise.sentenceParts ?? []).filter((part) => part.blankId).length && answers.length > 0;
    case "cloze_text":
      return answers.length === (exercise.textParts ?? []).filter((part) => part.blankId).length && answers.length > 0;
    case "word_bank":
    case "drag_to_category":
      return answers.length === ((exercise.items as unknown[] | undefined)?.length ?? 0) && answers.length > 0;
    case "matching":
    case "collocation":
      return answers.length === (exercise.pairs?.length ?? 0) && answers.length > 0;
    case "image_match":
      return answers.length === ((exercise.items as unknown[] | undefined)?.length ?? 0) && answers.length > 0;
    case "sentence_order":
      return answers.length === (exercise.correctOrder?.length ?? exercise.tokens?.length ?? 0) && answers.length > 0;
    case "dialogue_order":
      return answers.length === (exercise.lines?.length ?? 0) && answers.length > 0;
    case "reading_comprehension":
    case "real_menu":
      return answers.length === (exercise.questions?.length ?? 0) && answers.every((value) => value.trim().length > 0);
    default:
      return answers.length > 0;
  }
}

export function requiredFinalCorrect(situation: FinalSituationInteractive): number {
  const total = situation.steps.length;
  const match = situation.passRequirement?.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return total;

  const required = Number(match[1]);
  const declaredTotal = Number(match[2]);
  if (!Number.isFinite(required) || !Number.isFinite(declaredTotal) || declaredTotal <= 0) return total;

  // The actual step count is authoritative if malformed/stale JSON declares a
  // different denominator.
  return Math.min(total, Math.max(0, required));
}

export function finalSituationPassed(situation: FinalSituationInteractive, results: boolean[]): boolean {
  return results.length === situation.steps.length
    && results.filter(Boolean).length >= requiredFinalCorrect(situation);
}
