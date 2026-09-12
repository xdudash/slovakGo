# SlovakGO — Universal Lesson JSON Contract v2

**Status:** MANDATORY / CANONICAL
**Scope:** A1–C2, every lesson JSON imported by SlovakGO
**Source basis:** working `lesson-181-a1_slovakgo.json` and working B1 `V kaviarni` lesson. This document describes the structure, exercise mechanics and pedagogical rules that those examples demonstrate. The JSON Schema is the machine-validation layer; this document is the human/authoring contract.

## 1. Non-negotiable rules

1. Every lesson MUST be valid JSON.
2. The root object MUST contain `lessons`, an array. A lesson file normally contains one lesson, but the importer may accept a batch.
3. Every lesson MUST be self-contained: metadata, introduction/start, theory, lesson vocabulary, exercises, final situation and result.
4. `curriculum/lesson.schema.json` is the machine-readable validation contract. A lesson that fails the schema is invalid and MUST NOT be imported.
5. Do not invent a new exercise `type` in lesson content. Use only a registered mechanic from §8.
6. Type-specific fields MUST follow the examples and definitions below. Do not silently substitute a different field name (`question` vs `prompt`, `correct` vs `correctAnswer`, etc.).
7. Slovak is the target language (`sk`). UI/support languages may be localized (`ru`, `uk`, `en`).
8. Every exercise MUST have one unambiguous scoring rule. If several answers are accepted, use `acceptedAnswers` explicitly.
9. Explanations are part of the learning design, not decoration. For knowledge/grammar items, explain why the answer is correct or what rule/model is being trained.
10. Distractors MUST be plausible and diagnostically useful; never use random nonsense.
11. Exercise difficulty and density must follow the learner level. A1 should privilege recognition, controlled production and short real-life choices; B1+ can require richer comprehension, nuance, register, transformation and realistic documents.
12. Lessons should move from input → guided practice → controlled production → contextual use → real-life integration.
13. The final situation is an application task, not a duplicate of the preceding exercise set.
14. No `speaking` requirement is implied by the JSON unless the application explicitly supports it. The working B1 scenario explicitly uses non-speaking interaction: choices, ordering, typing and comprehension.

## 2. Canonical lesson lifecycle

A complete lesson follows this conceptual sequence:

1. **Start / orientation** — what the learner will achieve.
2. **Theory / input** — short explanations, examples and usable models.
3. **Words / phrases** — target vocabulary with examples and pronunciation where appropriate.
4. **Practice** — varied mechanics that progressively test recognition, form, meaning and use.
5. **Real-life / integration** — realistic documents, messages, menus, schedules or dialogue where appropriate.
6. **Final situation** — one coherent mini-scenario combining the lesson objective.
7. **Result** — what the learner can now do, skills and progression.

The A1 working lesson demonstrates a compact version: four theory screens, four target words, twelve exercises, one final life situation and a result screen. fileciteturn463file0L45-L117 fileciteturn463file0L119-L157

The B1 working lesson demonstrates a richer version: localized metadata, assets, multi-skill theory, seven vocabulary items, 35 distinct exercise mechanics, a complete real-life scenario and weighted skills on the result screen. fileciteturn463file1L530-L576 fileciteturn463file1L577-L650

## 3. Root and lesson metadata

### Root

```json
{
  "lessons": [ { "...": "lesson" } ]
}
```

### Required lesson identity/content fields

A canonical lesson should contain:

- `id` — globally unique lesson id.
- `sectionId` — curriculum section id.
- `level` — `A1`, `A2`, `B1`, `B2`, `C1` or `C2`.
- `title` — string or localized object `{sk, ru, uk, en}`.
- `topic` — string or localized object.
- `description` — learner-facing description.
- `order` — numeric course order.
- `xpReward` — numeric XP reward.
- `estimatedMinutes` — estimated completion time.
- `isPublished` — boolean.
- `intro` — short learner-facing introduction.
- `completionMessage` — completion message.
- `startScreen` — lesson entry screen.
- `theoryScreens` — ordered theory/input screens.
- `wordsScreen` — vocabulary introduction screen.
- `words` — lesson vocabulary/models.
- `exercises` — ordered practice array.
- `finalSituation` — final application task.
- `resultScreen` — completion/progression screen.

The compact A1 example uses string metadata and the richer B1 example uses localized objects; both are valid representations at the content level. fileciteturn463file0L13-L43 fileciteturn463file1L533-L576

### Optional lesson-level extensions

A richer lesson MAY additionally contain:

- `localization` — `uiLanguages`, `targetLanguage`, `fallbackUiLanguage`.
- `assets` — images and audio referenced by exercises/theory.
- other importer-supported metadata, provided it does not contradict the contract/schema.

The B1 example uses `localization` and an `assets` registry with image `src`/`alt` and audio `src`/`transcript`. fileciteturn463file1L568-L650

## 4. Start screen

`startScreen` introduces the lesson and sets expectations. It MAY contain:

- `screenType`: normally `lesson_start` in the compact format.
- `imageRef`.
- `eyebrow`.
- `title`.
- `shortDescription` and/or `goal`.
- `outcomes` — concrete learner outcomes.
- `newWords`.
- `exercisesCount`.
- `reward`.
- `estimatedMinutes`.
- `button`.

Outcomes should describe observable actions, e.g. “розрізняти ja і ty”, “визначати роль людини за контекстом”. fileciteturn463file0L26-L43

## 5. Theory screens

Each theory screen is one small learning unit. Do not turn theory into a long textbook chapter.

Canonical compact form:

```json
{
  "screenType": "theory",
  "order": 1,
  "title": "...",
  "text": "...",
  "examples": [{"sk":"...","uk":"..."}],
  "exampleSk": "...",
  "exampleUk": "...",
  "shortRule": "...",
  "button": "Далі"
}
```

Richer localized form:

```json
{
  "id": "theory-1",
  "title": {"ru":"...","uk":"...","en":"..."},
  "body": {"ru":"...","uk":"...","en":"..."},
  "examples": [
    {"sk":"...","translation":{"ru":"...","uk":"...","en":"..."}}
  ]
}
```

A theory screen should normally contain: one rule/model, a few examples, and a short explanation of how/when it is used. The B1 lesson explicitly teaches natural request models and contrasts their politeness before practice. fileciteturn463file1L672-L755

## 6. Vocabulary

`wordsScreen` introduces the words/models used by the exercises. `words` stores the canonical lesson vocabulary.

Compact word model:

```json
{
  "id": "w1",
  "sk": "...",
  "uk": "...",
  "pronunciationUk": "...",
  "exampleSk": "...",
  "exampleUk": "...",
  "level": "A1",
  "topic": "...",
  "tags": ["..."]
}
```

Richer model:

```json
{
  "id": "w1",
  "sk": "...",
  "partOfSpeech": "noun",
  "translation": {"ru":"...","uk":"...","en":"..."},
  "example": {
    "sk": "...",
    "translation": {"ru":"...","uk":"...","en":"..."}
  }
}
```

Use words for vocabulary that the lesson actively teaches/rehearses, not every incidental word appearing in a text. The B1 example uses phrase/lexeme models such as `objednať si`, `odporučiť`, `účet` and gives part of speech plus translated examples. fileciteturn463file1L757-L896

## 7. Exercise common contract

Every exercise has:

- unique `id` within the lesson;
- registered `type`;
- `skill` array in richer lessons;
- learner-facing `instruction` in localized form in richer lessons;
- the content fields required by its type;
- an explicit correct/accepted answer representation;
- optional explanation/hint/media/references where supported.

The compact A1 format uses `question`, `options`, `correctAnswer`, `explanation`, `wordIds`, `order`, `difficulty`, `button`, and type-specific fields. fileciteturn463file0L221-L240

The richer B1 format uses `skill`, localized `instruction`, structured option objects, and type-specific content. fileciteturn463file1L897-L940

### Skills

Use only meaningful skill labels. Observed canonical skills include:

- `vocabulary`
- `grammar`
- `listening`
- `reading`
- `writing`
- `dialogue`
- `real_life`
- `register`
- `nuance`
- `pragmatics`
- `natural_language`
- `numbers`
- `time`

A single exercise may train multiple skills. The B1 result screen weights vocabulary, grammar, listening, reading and real-life communication equally at 0.2 in its example. fileciteturn462file1L118-L164

## 8. Registered exercise mechanics (35)

These are the 35 mechanics demonstrated by the working B1 lesson. **Do not rename them and do not create ad-hoc alternatives.**

### A. Choice / recognition

#### 1. `single_choice`
**Use:** one best answer from several options. Ideal for meaning, dialogue response, grammar choice and real-life decisions.

**Typical fields:** `instruction`, `prompt` or question context, `options[]`, one option with `correct:true`, optional `explanation`.

The B1 example uses it to choose the best reply to a waiter. fileciteturn463file1L897-L940

#### 2. `multiple_select`
**Use:** several correct answers must be selected.

**Typical fields:** `instruction`, `options[]`, each option has `correct:boolean`.

Use only when the learner genuinely needs to identify a set, not when one answer is sufficient. fileciteturn463file1L941-L979

#### 3. `true_false`
**Use:** one statement evaluated against a text/context.

**Fields:** `text`, `statement`, `correctAnswer:boolean`.

#### 4. `true_false_list`
**Use:** several statements evaluated against one text.

**Fields:** `text`, `statements[]`, each statement has `correct:boolean`.

The B1 example deliberately tests five statements against one short narrative. fileciteturn463file1L980-L1034

### B. Controlled form / production

#### 5. `fill_blank`
**Use:** one missing word/form in a sentence.

**Typical fields:** `sentence` or `question`, `acceptedAnswers[]` (preferred richer form) or compact `options` + `correctAnswer`, optional `hint`.

The B1 version explicitly accepts `kávu` as the required form. fileciteturn463file1L1037-L1059

#### 6. `dropdown_blank`
**Use:** choose a form from a dropdown inside a sentence.

**Fields:** `sentenceParts[]`; a blank part has `blankId`, `options[]`, `correct`.

#### 7. `cloze_text`
**Use:** multiple blanks inside a coherent short text.

**Fields:** `textParts[]`; blank parts have `blankId` and `acceptedAnswers[]`.

#### 8. `word_bank`
**Use:** place vocabulary/forms from a finite bank into sentence blanks.

**Fields:** `wordBank[]`, `items[]` with `sentence` + `correct`, optional `extraWords[]`.

The bank should contain plausible competitors; extra words are useful as distractors. fileciteturn463file1L1135-L1175

#### 9. `drag_to_blank`
**Use:** drag the correct form into one sentence blank.

**Fields:** `sentence`, `draggable[]`, `correct`.

#### 10. `drag_to_category`
**Use:** classify lexical items into semantic/functional categories.

**Fields:** `categories[]`, `items[]`; each item has a category id.

The working example classifies food, drinks and other restaurant vocabulary. fileciteturn463file1L1197-L1253

### C. Matching / ordering / construction

#### 11. `matching`
**Use:** pair a phrase with its meaning/translation or another related item.

**Fields:** `pairs[]` with `left` and `right`.

#### 12. `image_match`
**Use:** associate target words with visual references.

**Fields:** `items[]` with `sk` and `imageRef`.

Only use when the image provides real semantic value.

#### 13. `sentence_builder`
**Use:** construct a natural sentence from tokens.

**Fields:** `tokens[]`, `correctSentence`.

#### 14. `sentence_order`
**Use:** reorder tokens into the correct sentence.

**Fields:** `tokens[]`, `correctOrder[]`.

#### 15. `dialogue_order`
**Use:** restore a realistic sequence of dialogue turns.

**Fields:** `lines[]` with ids and Slovak text, `correctOrder[]` of ids.

The B1 example uses a reservation dialogue with four ordered turns. fileciteturn463file1L1394-L1427

#### 16. `dialogue_choose_reply`
**Use:** select the natural next reply to a dialogue turn.

**Fields:** `dialogue[]`, `options[]` with `correct:boolean`.

The distractors should be grammatically possible where useful but pragmatically inappropriate. fileciteturn463file1L1430-L1468

#### 17. `branching_dialogue`
**Use:** interactive dialogue path with consequences.

**Fields:** `startNode`, `nodes`; each node contains speaker/content and `choices[]`; each choice points to `next` and has a quality such as `best` or `wrong`. Include a success message where appropriate.

Use this when choosing a reply should affect what happens next, not merely as a decorated multiple choice. fileciteturn463file1L1470-L1528

### D. Error correction / transformation

#### 18. `find_error`
**Use:** identify the incorrect token in a sentence.

**Fields:** `sentence`, `errorToken`, `correctToken`.

#### 19. `correct_error`
**Use:** rewrite the whole sentence correctly.

**Fields:** `sentence`, `acceptedAnswers[]`.

The accepted-answer list can include more than one natural correction. fileciteturn467file0L45-L63

#### 20. `transformation`
**Use:** transform an utterance according to a stated grammatical/register requirement.

**Fields:** `source`, `acceptedAnswers[]`.

The B1 example transforms informal `Čo si dáš?` into polite forms and accepts two natural variants. fileciteturn467file0L65-L83

### E. Listening

#### 21. `listen_choice`
**Use:** listen and choose what was said/ordered/meant.

**Fields:** `audioRef`, `options[]` with `correct:boolean`.

#### 22. `listen_true_false`
**Use:** listen and judge one statement.

**Fields:** `audioRef`, `statement`, `correctAnswer`.

#### 23. `listen_fill`
**Use:** listen and type a missing word.

**Fields:** `audioRef`, `displaySentence`, `acceptedAnswers[]`.

#### 24. `dictation`
**Use:** listen and reproduce the full sentence.

**Fields:** `audioRef`, `acceptedAnswers[]`; comparison options may include `ignoreCase` and `ignoreTerminalPunctuation`.

The B1 example explicitly ignores case and terminal punctuation. fileciteturn467file0L132-L169

### F. Reading / meaning / pragmatics

#### 25. `reading_comprehension`
**Use:** read a coherent text and answer one or more comprehension questions.

**Fields:** `text`, `questions[]`; each question has localized prompt, `options[]`, and correct markers.

#### 26. `meaning_in_context`
**Use:** infer the meaning of a highlighted expression in its actual context.

**Fields:** `context`, `target`, `options[]` with one correct answer.

The point is contextual meaning, not dictionary translation. fileciteturn467file0L260-L305

#### 27. `natural_phrase`
**Use:** select the most natural phrase for a situation.

**Fields:** `situation`, `options[]` with one correct answer.

Distractors may be grammatical but unnatural, overly direct, or pragmatically unsuitable. fileciteturn467file1L680-L717

#### 28. `tone`
**Use:** identify the speaker's tone from audio/context.

**Fields:** `audioRef`, `options[]`.

Use for pragmatics/listening when tone changes interpretation. fileciteturn467file1L720-L769

#### 29. `register`
**Use:** identify formal/neutral/informal/slang register or choose an appropriate register.

**Fields:** `phrase`, `options[]`.

The B1 example correctly classifies `Čau, dáš si niečo?` as informal. fileciteturn467file1L772-L822

#### 30. `hidden_meaning`
**Use:** infer the practical request/intent behind an utterance rather than its literal wording.

**Fields:** `context`, `options[]`.

The B1 example asks what the guest is really requesting when asking the staff to look at an incorrect bill. fileciteturn467file1L825-L867

#### 31. `collocation`
**Use:** build natural word combinations.

**Fields:** `pairs[]` with `left` and `right`.

This tests natural lexical combination rather than isolated word meaning. fileciteturn467file1L870-L915

### G. Real-life documents and information

#### 32. `real_document`
**Use:** read a realistic document such as a reservation confirmation, appointment, invoice, notice or form.

**Fields:** `document` with `title` and structured `fields[]`; a question and answer options.

The working B1 example uses a reservation confirmation with name, date, time, party size and note. fileciteturn464file0L23-L107

#### 33. `real_message`
**Use:** interpret a realistic message/email/SMS/service notification.

**Fields:** `message.sender`, `message.body`, question/options with a correct conclusion.

The example tests the practical consequence of a restaurant's lateness policy. fileciteturn464file0L110-L157

#### 34. `real_menu`
**Use:** extract and reason about information in a realistic menu.

**Fields:** optional `imageRef`, `menuData[]` with category/item/price, `questions[]`.

It can test price, category, comparison and selection. fileciteturn464file0L160-L249

#### 35. `real_schedule`
**Use:** interpret a realistic opening-hours/timetable/schedule table.

**Fields:** `schedule.title`, `schedule.rows[]` with day/hours, question and options.

It should test actual time/day reasoning, not mere copying. fileciteturn464file0L251-L327

## 9. How to use the mechanics pedagogically

Mechanics are not a checklist. A lesson MUST NOT contain 35 exercises merely because 35 types exist.

### Recommended progression

**A1:**
- start with `multiple_choice_translation`, `single_choice`, `matching`, `fill_blank`, simple `true_false` and controlled sentence construction;
- introduce dialogue and real-life mechanics when the language is sufficient;
- prioritize short, concrete contexts and immediate feedback.

**A2:**
- increase `cloze_text`, `word_bank`, `sentence_order`, `dialogue_choose_reply`, listening and short reading;
- use more context and fewer purely isolated translations.

**B1:**
- combine controlled grammar with `branching_dialogue`, `reading_comprehension`, listening, `natural_phrase`, `register`, `meaning_in_context`, `collocation` and realistic documents/messages;
- require the learner to choose language that is both correct and appropriate.

**B2:**
- increase nuance, register, transformation, inference, longer listening/reading and realistic written communication;
- distractors should target genuine learner errors.

**C1–C2:**
- favor discourse, implicit meaning, tone, register, stylistic choice, argumentation, dense authentic documents and fine lexical distinctions;
- simple translation recognition should no longer dominate the lesson.

### General sequencing rule

Within one lesson, prefer:

`recognize → discriminate → control form → produce → interpret context → communicate/solve a situation`.

For grammar, do not ask for unconstrained production before the learner has seen the model and practiced the relevant form.

For vocabulary, move from word/phrase recognition to collocation and then contextual use.

For dialogue, move from choosing a reply to ordering turns and, when justified, branching interaction.

For listening, move from gist/choice to detail, then fill/dictation only when the level supports it.

For real-life material, ask the learner to **do something with the information**: decide, compare, schedule, respond, correct or act.

## 10. Correct-answer policy

- `single_choice`: exactly one option with `correct:true`.
- `multiple_select`: at least two correct options when the task is genuinely multi-answer; all options must have explicit correctness.
- `true_false`: boolean `correctAnswer`.
- `true_false_list`: each statement has explicit `correct`.
- typing mechanics: use `acceptedAnswers[]` when multiple orthographically/naturally valid answers exist.
- ordering mechanics: the expected order must be explicit and deterministic.
- branching: every choice must have a valid `next` target; terminal nodes must be reachable.
- final scenarios: define an explicit pass rule such as `3/4` when partial success is intended.

The A1 working lesson demonstrates deterministic answer fields and a final situation with a direct `correctAnswer` plus explanation. fileciteturn463file0L478-L492

## 11. Explanation / feedback policy

Good feedback explains the language decision. It should be short and specific:

- identify the relevant rule/model;
- explain why the correct option fits the context;
- where useful, contrast the main distractor;
- avoid merely saying “correct”.

The A1 example repeatedly explains pronoun choice by communicative role, not only by translation. fileciteturn463file0L303-L475

## 12. Final situation

The final situation integrates the lesson objective into one coherent context.

Compact form:

```json
{
  "screenType": "final_life_situation",
  "title": "...",
  "scenario": "...",
  "question": "...",
  "options": ["..."],
  "correctAnswer": "...",
  "translation": "...",
  "explanation": "...",
  "button": "Проверить"
}
```

Richer form:

```json
{
  "id": "final-situation",
  "type": "interactive_scenario",
  "title": {"ru":"...","uk":"...","en":"..."},
  "imageRef": "...",
  "description": {"ru":"...","uk":"...","en":"..."},
  "steps": [
    {
      "id": "f1",
      "prompt": {"sk":"..."},
      "options": [{"sk":"...","correct":true}]
    }
  ],
  "passRequirement": "3/4"
}
```

Use the richer form for multi-step real-life integration. The B1 example combines reservation, ordering, allergen checking and correcting a bill. fileciteturn464file0L1223-L1307

## 13. Result screen

The result screen MUST tell the learner what was achieved and how to continue.

Compact fields demonstrated by the A1 example:

- `screenType`
- `title`
- `text`
- `nowYouKnow[]`
- `result`
- `newWordsCount`
- `exercisesCompleted`
- `mistakesMessage`
- `buttons[]`
- `nextLesson`

fileciteturn463file0L494-L514

Richer lessons may use:

- localized `title`;
- localized `subtitle`;
- `skills[]` with `id`, localized `label`, `weight`;
- numeric `xpReward`;
- structured `nextLesson` with id/title.

The B1 example uses five weighted skill areas and a structured next lesson. fileciteturn464file0L1309-L1383

## 14. Assets

When media is used, define it once at lesson level and reference it by id.

Image asset:

```json
"images": {
  "cafe_scene": {
    "src": "/assets/.../cafe-scene.webp",
    "alt": {"ru":"...","uk":"...","en":"..."}
  }
}
```

Audio asset:

```json
"audio": {
  "a21": {
    "src": "/assets/.../a21.mp3",
    "transcript": "..."
  }
}
```

Exercises then use `imageRef` or `audioRef`. This keeps content references stable and prevents duplicating media paths. fileciteturn463file1L577-L650

## 15. What a high-quality lesson must achieve

A lesson is not high quality because it is long or because it contains many mechanics. It is high quality when:

- the lesson objective is concrete;
- theory directly supports later tasks;
- new vocabulary is actually reused;
- exercises increase cognitive demand gradually;
- distractors reveal realistic misunderstandings;
- explanations teach rather than merely grade;
- examples sound natural in Slovak;
- real-life tasks resemble situations the learner can encounter;
- the final situation combines the lesson's core skills;
- the amount of content fits the estimated time and level.

## 16. Mandatory QA before import

Before a lesson reaches GitHub/import:

### Structural QA
- JSON parses.
- Root contains `lessons` array.
- Required lesson fields exist.
- IDs are unique where required.
- Exercise `type` is registered in §8.
- Every reference (`wordIds`, `imageRef`, `audioRef`, dialogue `next`, etc.) resolves.
- Every answer is represented deterministically.
- Final-situation pass rules are valid.

### Pedagogical QA
- Every exercise tests a declared lesson objective or supporting prerequisite.
- New words are reused across exercises.
- There is no pointless repetition of the same mechanic.
- Difficulty rises through the lesson.
- Translation is not the only learning mode.
- Real-life items test interpretation/action rather than copying.
- Distractors are plausible.
- Feedback explains the reason.

### Language QA
- Slovak is natural and grammatically correct.
- Ukrainian/Russian/English UI translations are consistent where provided.
- Pronunciation fields are only used when they are actually needed and accurate.
- Formal/informal distinctions are intentional.

## 17. Relationship to the JSON Schema

`LESSON_JSON_CONTRACT.md` defines **what the lesson means and how to author it**.

`lesson.schema.json` defines **what the machine accepts structurally**.

Both are mandatory. Passing JSON Schema does not automatically make a lesson pedagogically good; passing human QA without schema validation does not make it import-safe.

When the contract and an old lesson disagree, the canonical contract wins for new lessons. Existing working lessons are reference examples, not permission to perpetuate undocumented fields or mechanics.
