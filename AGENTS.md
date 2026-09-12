# SlovakGO Agent Contract

## 1. Canonical sources

For lesson creation and editing, the agent MUST use:

1. `curriculum/LESSON_JSON_CONTRACT.md` — mandatory human/authoring contract, including exercise mechanics and methodology.
2. `curriculum/LESSON_RUNTIME_CONTRACT.md` — mandatory runtime contract derived from the real application renderer/checkers.
3. `curriculum/lesson.schema.json` — mandatory machine-readable structural schema.
4. The applicable level/section `LESSON_PLAN.md` — defines the lesson topic, contents and planned new words/phrases.
5. Existing working lessons — reference examples only; they do not override the canonical contract.
6. The real application types/renderers/checkers in `src/types`, `src/features/student/exercises`, and `src/services/exerciseChecking.ts` — runtime behavior is the implementation contract and must not be contradicted by lesson JSON.

## 2. Lesson generation rule

Never generate a lesson from a generic template alone. First align the lesson with its level plan, then apply the universal JSON contract and exercise methodology.

Every new lesson MUST:

- be valid JSON;
- use a registered exercise type from `LESSON_JSON_CONTRACT.md`;
- contain deterministic scoring/accepted answers;
- connect theory, vocabulary, exercises and final situation;
- pass structural and semantic QA before import;
- be checked against the actual application runtime shape, not only against JSON syntax.

## 3. Exercise mechanics

The registered exercise set is the 35 mechanics documented in `curriculum/LESSON_JSON_CONTRACT.md`, plus the legacy/reference mechanics explicitly listed by the schema (`multiple_choice_translation`, `reverse_translation`, `match_pairs`). Do not invent undocumented `type` values.

Mechanics must be selected according to the lesson objective and CEFR level. They are not a checklist: a lesson does not need every mechanic.

## 4. Validation gate

A lesson is not considered complete until:

1. JSON parsing succeeds.
2. `curriculum/lesson.schema.json` validation succeeds.
3. `npm run qa:lessons -- <lesson.json>` succeeds.
4. All internal references resolve.
5. `wordsScreen.items[]`, when present, contains renderable `sk` and `uk` values; `wordId` references resolve to `lesson.words` and agree with the canonical word.
6. Every exercise has deterministic scoring and all referenced words/assets resolve.
7. Answers are deterministic.
8. Exercise progression is pedagogically coherent.
9. Slovak text is natural and correct.
10. The final situation actually integrates the lesson objective.
11. The lesson is tested through the real import/runtime path before it is declared ready.

The semantic runtime gate is implemented in `scripts/qa-lessons.ts`. It exists specifically to catch valid JSON that would otherwise render empty or grade incorrectly in the application.

## 5. Canonical priority

When an old file conflicts with the current contract, use the current contract for new content. Do not copy obsolete structure merely because an old lesson happens to contain it.
