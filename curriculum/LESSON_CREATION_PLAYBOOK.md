# SlovakGO — Lesson Creation Playbook for High-Capability Agents

**Status:** MANDATORY / CANONICAL FOR LESSON CREATION
**Scope:** A1–C2
**Primary use:** autonomous creation, review, repair and delivery of lesson JSON

## 0. Mission

Create lessons that are simultaneously:

1. pedagogically strong;
2. faithful to the applicable curriculum plan;
3. linguistically correct and natural in Slovak;
4. complete according to the human lesson contract;
5. valid according to the machine schema;
6. compatible with the real SlovakGo runtime;
7. deterministic and gradeable;
8. visually/renderably complete;
9. internally consistent;
10. ready to import into the application.

**Technical validity is necessary but is NOT sufficient.** A lesson that passes JSON Schema but is shallow, repetitive, pedagogically weak, unnatural, incomplete, or broken in the UI is a failed lesson.

The agent is expected to use its full reasoning ability and sufficient working time. Do not optimize for speed at the expense of quality.

---

## 1. Authority and conflict resolution

Before creating or changing any lesson, read the relevant canonical sources in this order:

1. `AGENTS.md`
2. this file: `curriculum/LESSON_CREATION_PLAYBOOK.md`
3. `curriculum/LESSON_JSON_CONTRACT.md`
4. `curriculum/LESSON_RUNTIME_CONTRACT.md`
5. `curriculum/lesson.schema.json`
6. the applicable level/section `LESSON_PLAN.md`
7. applicable knowledge/inventory/prerequisite/ownership documents
8. `curriculum/GOLD_STANDARD_LESSON.md`
9. `curriculum/COURSE_ARCHITECTURE_V2.md`
10. existing working lessons and real application code, only as implementation/reference evidence

If sources conflict:

- explicit current canonical contract beats an old lesson;
- the applicable current lesson plan beats an old lesson's topic/order/content;
- the real runtime implementation determines what JSON the application can actually render/check;
- do not silently invent a reconciliation. Record the conflict internally, choose the highest-priority current rule, and continue.

Never use an old generated lesson as the template merely because it exists.

---

## 2. First phase: understand the course before writing JSON

Do NOT start by emitting JSON.

First establish:

- exact lesson id and section id;
- exact position in the course;
- exact topic;
- lesson objective;
- what is explicitly included in the lesson plan;
- new words/phrases owned by this lesson;
- prerequisites from earlier lessons;
- what must be deferred to later lessons;
- grammar/function scope;
- appropriate CEFR difficulty;
- expected lesson length and density;
- how the lesson connects to neighbouring lessons.

Build an internal lesson map before writing content:

`objective → input/theory → target vocabulary → controlled practice → production/use → integration → final situation → result`

The lesson must teach something before it tests it.

---

## 3. Do not duplicate vocabulary ownership

The lesson plan is the authoritative source for planned new words/phrases.

For every target lexical item:

- use the planned ownership unless there is a documented reason not to;
- do not silently move another lesson's owned vocabulary into this lesson;
- distinguish target vocabulary from incidental words needed to make examples readable;
- avoid inflating the `words` array with every word appearing in a reading/dialogue;
- reuse previously taught vocabulary where it supports retrieval and fluency.

A word appearing in an exercise is not automatically a new target word.

The lesson should reinforce old material while introducing a controlled amount of new material.

---

## 4. Lesson architecture

A complete lesson normally contains:

1. metadata;
2. start/orientation;
3. theory/input;
4. vocabulary;
5. progressive practice;
6. contextual or real-life application where appropriate;
7. final situation;
8. result/progression.

The sections are not decorative. Each must have a learning purpose.

### Start

Tell the learner what they will be able to do after the lesson. Outcomes must be observable and concrete.

Bad: `Вивчимо тему.`

Good: `Навчишся привітатися, назвати себе та поставити просте запитання.`

### Theory

Teach small units. Each theory unit should have:

- one clear rule/model;
- useful Slovak examples;
- Ukrainian learner-facing explanation;
- enough context to understand when the model is used;
- no unnecessary textbook exposition.

Theory must directly prepare the exercises that follow.

### Vocabulary

Every displayed vocabulary item must be fully renderable. Never create a `wordsScreen.items` entry containing only `wordId`.

### Practice

Progress from easier recognition to meaningful use. Do not make every exercise the same multiple-choice operation.

### Final situation

The final task must feel like one coherent real-world situation, not a random extra question. It must require the learner to apply the lesson objective.

### Result

Summarize what the learner can now do and provide meaningful progression information. Do not claim mastery of material that was not taught/tested.

---

## 5. Required depth and quality

A lesson must be substantial enough to resemble the project's gold-standard lesson, not a minimal schema fixture.

Use the applicable plan and gold standard to determine exact density. Do not use a universal arbitrary exercise count when the canonical documents specify another value.

As a quality heuristic, an A1 lesson should normally include enough theory, vocabulary and practice to support a real learning session rather than a five-minute quiz. Higher levels should increase contextual complexity, not merely exercise count.

Avoid:

- one-sentence theory screens with no useful explanation;
- vocabulary cards without examples;
- repeated questions with only names/options changed;
- exercises that test words before teaching them;
- artificial Slovak written only to satisfy a field;
- filler exercises added only to increase count;
- identical distractor patterns;
- final situations unrelated to the lesson objective.

Prefer:

- retrieval and spaced reinforcement;
- contrasting near-neighbours;
- meaningful distractors;
- short dialogues;
- contextualized choices;
- controlled production;
- form + meaning + use;
- gradual increase in cognitive load;
- natural repetition with changed context.

---

## 6. Slovak language quality gate

All Slovak learner-facing target content must be natural, idiomatic and appropriate for the stated CEFR level.

Check:

- spelling and diacritics;
- morphology;
- agreement;
- word order;
- case/government;
- verb forms;
- aspect where relevant;
- natural collocations;
- register and politeness;
- whether a native speaker would actually say the phrase in the given situation.

Do not translate Ukrainian mechanically into Slovak.

If two Slovak variants are possible, use the one appropriate to the intended context and make accepted alternatives explicit when the exercise permits them.

Never invent pronunciation merely by transliterating visually. Use a consistent Ukrainian pronunciation aid appropriate to the project convention.

---

## 7. Localization rules

Target language: `sk` (Slovak).

Learner-facing UI/support language for this course: Ukrainian (`uk`) unless the applicable contract explicitly says otherwise.

Do not mix languages accidentally.

For every learner-facing explanation:

- explain in Ukrainian;
- show the target language in Slovak;
- translate examples accurately;
- keep terminology consistent across the lesson.

Do not put Ukrainian text into fields that the runtime expects to be Slovak target content.

---

## 8. Vocabulary runtime contract

When `wordsScreen.items` is present, every item MUST contain:

- `wordId`
- `sk`
- `uk`
- `pronunciationUk`
- `exampleSk`
- `exampleUk`

`wordId` alone is invalid.

Every `wordId` must resolve to `lesson.words`.

The displayed `sk` and `uk` must agree with the canonical `lesson.words` entry.

Do not maintain two contradictory vocabulary databases inside one lesson.

If the runtime supports rendering directly from `lesson.words` when `wordsScreen.items` is omitted, use that supported pattern rather than creating incomplete screen items.

---

## 9. Exercise design rules

Only use exercise types registered in the current canonical contract/schema/runtime.

Never invent a new `type` name because another exercise would be easier to express that way.

Every exercise must have:

- unique id;
- valid registered type;
- deterministic scoring;
- explicit correct answer or accepted answers;
- all required type-specific fields;
- resolved `wordIds` where used;
- valid `lessonId` where used;
- valid order;
- an explanation when the contract/type supports learning feedback;
- distractors that are plausible and diagnostically meaningful.

### Difficulty progression

A strong lesson generally progresses through several of these stages:

1. recognition;
2. discrimination;
3. controlled recall;
4. controlled production;
5. contextual choice;
6. integrated use.

Do not jump immediately to difficult production without sufficient scaffolding.

### Exercise diversity

Variety is purposeful, not cosmetic. Choose mechanics because they train different operations.

For A1, prioritize simple recognition, matching, short controlled production, ordering, basic dialogue choices and short contextual tasks.

For higher levels, add nuance, register, transformation, realistic reading/listening, pragmatic choices and real-life documents where justified.

Do not force every mechanic into every lesson.

---

## 10. Deterministic scoring

There must never be ambiguity about whether an answer is correct.

For single-answer tasks:

- exactly one intended answer unless the mechanic explicitly supports multiple;
- use `acceptedAnswers` for legitimate variants.

For multiple-answer tasks:

- mark every correct option explicitly;
- ensure the checker can distinguish the complete correct set.

For free input:

- define accepted variants deliberately;
- normalize only what the runtime actually normalizes;
- do not rely on fuzzy grading that the checker does not implement.

For ordering/building tasks:

- define exact order/sentence representation required by the checker.

Before completion, manually inspect every exercise's answer path.

---

## 11. Internal consistency gate

Verify all of the following:

- root contains `lessons` array;
- lesson id is correct and unique;
- section id is correct;
- level is correct;
- order is correct;
- all required lesson fields exist;
- all word ids are unique;
- all exercise ids are unique;
- all exercise orders are unique and sensible;
- `startScreen.exercisesCount` equals actual exercise count when that field is used;
- every `wordIds` reference resolves;
- every `wordsScreen.items[].wordId` resolves;
- vocabulary screen values match canonical words;
- all assets exist and are referenced correctly when assets are used;
- all audio/image references resolve when the runtime requires them;
- final situation references only valid content;
- result screen fields match the supported runtime format.

---

## 12. Validation workflow — never skip steps

For each lesson, run the complete pipeline:

### Step A — Parse

Parse the JSON with a real JSON parser.

### Step B — Schema

Validate against:

`curriculum/lesson.schema.json`

### Step C — Semantic QA

Run:

`npm run qa:lessons -- <lesson.json>`

### Step D — Runtime compatibility

Inspect the actual renderer/checker code for the used mechanics and verify that the produced field shapes are what the application consumes.

Where the repository provides an import/runtime test path, execute it. Do not merely state that it should work.

### Step E — Pedagogical QA

Review the entire lesson as a learner:

- Is the objective clear?
- Is every target item taught before being tested?
- Does each exercise add learning value?
- Does difficulty rise sensibly?
- Are there enough repetitions in different contexts?
- Are distractors useful?
- Is the final situation a genuine application task?
- Is the lesson substantial enough compared with the gold standard?

### Step F — Language QA

Review every Slovak sentence and every Ukrainian explanation.

### Step G — Cross-lesson QA

For a batch of lessons, inspect neighbouring lessons together for:

- duplicated new vocabulary;
- missing planned vocabulary;
- grammar introduced too early/late;
- repeated exercise patterns;
- unnatural progression;
- topic gaps;
- inconsistent terminology.

### Step H — Final diff review

Review the exact Git diff before committing.

If any gate fails, fix the lesson and rerun the affected checks. Never declare success with known failures.

---

## 13. Autonomous batch workflow

When asked to create multiple lessons, do not ask for confirmation between lessons.

Use this sequence:

1. inspect repository and canonical documents;
2. inspect runtime and QA tooling;
3. map the requested lessons and dependencies;
4. design the whole batch at a curriculum level;
5. create lessons in coherent batches;
6. validate each lesson immediately;
7. perform cross-lesson review;
8. repair all discovered problems;
9. run final batch QA;
10. commit only the finished result;
11. push to the requested branch;
12. read back the committed files from GitHub;
13. report exact files, checks and commit SHA.

Do not stop after generating JSON.

Do not stop after schema validation.

Do not stop after semantic QA.

Do not call a lesson complete until the full pipeline has passed.

---

## 14. How to use large model capacity

A high-capability agent should spend its available reasoning budget on quality control, not merely on producing a large JSON blob.

Before finalizing, actively search for failure modes:

- What could render blank?
- What field name could the runtime reject?
- Which answer could be ambiguous?
- Which exercise might be impossible for an A1 learner?
- Which Slovak sentence sounds translated?
- Which word is being taught twice in different lessons?
- Which target word has not actually been practiced?
- Which exercise is only filler?
- Does the final situation truly test the stated objective?
- Does the lesson look like the project's gold standard rather than a schema fixture?

Perform at least one deliberate adversarial review after the first successful QA pass.

---

## 15. Do not hide uncertainty

If a required fact is absent from the canonical sources, do not silently invent a project rule.

Use the strongest available evidence from:

- current contract;
- current schema;
- current runtime;
- current lesson plan;
- current working examples.

If an unresolved ambiguity would materially change the output, document it in the final report rather than pretending certainty.

However, do not ask the user for confirmation merely because the work is difficult. Make the best contract-supported decision and continue whenever the repository provides enough evidence.

---

## 16. Git discipline

Keep the repository clean.

Do not leave:

- duplicate lesson files;
- obsolete generated versions;
- temporary JSON fixtures;
- backup copies such as `lesson-final-v2.json`;
- failed-generation artifacts;
- debug output.

Commit messages should describe the completed change clearly.

After push, verify the actual files on the remote branch. The remote repository is the final source of truth for what was delivered.

---

## 17. Completion definition

A lesson is **DONE** only when all of the following are true:

- content matches the applicable Lesson Plan;
- vocabulary ownership is respected;
- lesson is pedagogically complete;
- Slovak is natural and correct;
- learner-facing Ukrainian is coherent;
- JSON parses;
- schema passes;
- `npm run qa:lessons` passes;
- runtime compatibility has been checked/tested;
- all internal references resolve;
- scoring is deterministic;
- no renderable field is empty or missing;
- final situation integrates the objective;
- cross-lesson consistency has been checked;
- Git diff is clean and intentional;
- committed version has been verified on GitHub.

**Never equate “valid JSON” with “finished lesson.”**
