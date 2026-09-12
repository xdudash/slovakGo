# SlovakGO Agent Contract

## 1. Canonical sources

For lesson creation and editing, the agent MUST use:

1. `curriculum/LESSON_JSON_CONTRACT.md` — mandatory human/authoring contract, including exercise mechanics and methodology.
2. `curriculum/lesson.schema.json` — mandatory machine-readable structural schema.
3. The applicable level/section `LESSON_PLAN.md` — defines the lesson topic, contents and planned new words/phrases.
4. Existing working lessons — reference examples only; they do not override the canonical contract.

## 2. Lesson generation rule

Never generate a lesson from a generic template alone. First align the lesson with its level plan, then apply the universal JSON contract and exercise methodology.

Every new lesson MUST:

- be valid JSON;
- use a registered exercise type from `LESSON_JSON_CONTRACT.md`;
- contain deterministic scoring/accepted answers;
- connect theory, vocabulary, exercises and final situation;
- pass structural and pedagogical QA before import.

## 3. Exercise mechanics

The registered exercise set is the 35 mechanics documented in `curriculum/LESSON_JSON_CONTRACT.md`, plus the legacy/reference mechanics explicitly listed by the schema (`multiple_choice_translation`, `reverse_translation`, `match_pairs`). Do not invent undocumented `type` values.

Mechanics must be selected according to the lesson objective and CEFR level. They are not a checklist: a lesson does not need every mechanic.

## 4. Validation gate

A lesson is not considered complete until:

1. JSON parsing succeeds.
2. `curriculum/lesson.schema.json` validation succeeds.
3. All internal references resolve.
4. Answers are deterministic.
5. Exercise progression is pedagogically coherent.
6. Slovak text is natural and correct.
7. The final situation actually integrates the lesson objective.

## 5. Canonical priority

When an old file conflicts with the current contract, use the current contract for new content. Do not copy obsolete structure merely because an old lesson happens to contain it.
