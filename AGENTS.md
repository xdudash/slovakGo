# SlovakGO — Agent Operating Contract

**Status: MANDATORY / CANONICAL**

This file governs any agent that creates, edits, validates, reviews, imports or commits SlovakGo lesson content.

## 1. Primary rule

Do not optimize for speed. Optimize for a finished, high-quality lesson.

A lesson is not successful merely because JSON Schema accepts it. It must also be pedagogically strong, linguistically natural, renderable by the real application, deterministically gradeable and consistent with the curriculum.

For the complete creation methodology, follow:

`curriculum/LESSON_CREATION_PLAYBOOK.md`

That playbook is mandatory and is the operational extension of this contract.

## 2. Canonical source order

Before lesson work, read the applicable current sources:

1. `AGENTS.md`
2. `curriculum/LESSON_CREATION_PLAYBOOK.md`
3. `curriculum/LESSON_JSON_CONTRACT.md`
4. `curriculum/LESSON_RUNTIME_CONTRACT.md`
5. `curriculum/lesson.schema.json`
6. the applicable level/section `LESSON_PLAN.md`
7. applicable inventory, prerequisite and vocabulary-ownership documents
8. `curriculum/GOLD_STANDARD_LESSON.md`
9. `curriculum/COURSE_ARCHITECTURE_V2.md`
10. existing working lessons and actual runtime code as reference/implementation evidence

Current canonical documents override old generated lessons.

## 3. Mandatory lesson workflow

Never begin by blindly filling a generic JSON template.

First understand the lesson's place in the curriculum, objective, prerequisites, target vocabulary, grammar/function scope and neighbouring lessons. Then design the learning progression before writing JSON.

The normal pipeline is:

`curriculum understanding → lesson design → content generation → structural validation → semantic QA → runtime compatibility test → pedagogical QA → language QA → cross-lesson QA → diff review → commit → push → remote verification`

Do not stop after JSON generation or schema validation.

## 4. Content quality

Every lesson must contain meaningful learning content, not a minimal schema fixture.

The lesson must connect:

`objective → theory → vocabulary → guided practice → controlled production → contextual use → final situation → result`

Use exercise variety purposefully. Do not pad the lesson with repetitive or artificial exercises.

The target language is Slovak (`sk`). Learner-facing support text is Ukrainian (`uk`) unless a more specific current contract says otherwise.

All Slovak must be natural, grammatically correct and appropriate to the intended CEFR level and context.

## 5. Vocabulary runtime safety

When `wordsScreen.items` is used, every item MUST contain:

- `wordId`
- `sk`
- `uk`
- `pronunciationUk`
- `exampleSk`
- `exampleUk`

`wordId` alone is invalid.

Every `wordId` must resolve to `lesson.words`, and displayed `sk`/`uk` values must agree with the canonical word.

This rule exists because valid JSON can otherwise render empty vocabulary cards in the application.

## 6. Exercise safety

Use only exercise types registered in the current contract/schema/runtime.

Every exercise must have deterministic scoring, valid type-specific fields, unique id/order, valid references and a meaningful learning purpose.

Never invent undocumented field names or mechanics.

Use `acceptedAnswers` explicitly where multiple free-input variants are legitimate and supported.

## 7. Mandatory validation

For every lesson:

1. parse JSON;
2. validate against `curriculum/lesson.schema.json`;
3. run `npm run qa:lessons -- <lesson.json>`;
4. verify runtime field consumption for every used mechanic;
5. execute the available real import/runtime test path when provided;
6. perform pedagogical and linguistic review;
7. perform cross-lesson review when working in a batch.

Fix failures and rerun validation. Never report a known failure as acceptable.

## 8. Autonomous execution

When the user requests a batch of lessons, execute the complete workflow without asking for confirmation between steps or lessons.

Use the full available reasoning/time budget to review and improve the result. Perform an adversarial pass specifically looking for rendering failures, ambiguous answers, shallow content, unnatural Slovak, vocabulary duplication, broken references and mismatch with the gold standard.

## 9. Git hygiene

Do not leave duplicate, obsolete, temporary or failed-generation lesson files.

Commit only finished content. After pushing, read back the remote files and verify that the delivered version is the intended version.

## 10. Definition of DONE

A lesson is DONE only when curriculum alignment, pedagogy, Slovak quality, localization, schema, semantic QA, runtime compatibility, deterministic scoring, internal references, final-situation integration, cross-lesson consistency and Git delivery have all passed.

**Valid JSON is necessary. It is not sufficient.**
