# SlovakGO — Lesson Runtime Contract

**Status: MANDATORY**

This document supplements `curriculum/LESSON_JSON_CONTRACT.md` with rules derived from the actual application runtime. JSON that is syntactically valid but violates these rules is **invalid**.

## 1. Vocabulary screen is rendered from the object it receives

When `lesson.wordsScreen.items` is present, the student screen renders each item directly. Therefore every item MUST contain:

```json
{
  "wordId": "a1-s01-l01-w01",
  "sk": "...",
  "uk": "...",
  "pronunciationUk": "...",
  "exampleSk": "...",
  "exampleUk": "..."
}
```

`wordId` alone is **not** sufficient.

The following is invalid even though it is valid JSON:

```json
{
  "items": [
    { "wordId": "a1-s01-l01-w01" }
  ]
}
```

The application will create the item container but has no `sk`/`uk` text to render.

## 2. Canonical word consistency

If `wordsScreen.items[].wordId` is supplied, it MUST resolve to an object in `lesson.words`.

The screen item's `sk` and `uk` MUST agree with that canonical word. The screen is not a second vocabulary database.

Preferred pattern:

```json
"words": [
  {
    "id": "a1-s01-l01-w01",
    "sk": "Ahoj",
    "uk": "Привіт",
    "exampleSk": "Ahoj, Peter!",
    "exampleUk": "Привіт, Петер!"
  }
],
"wordsScreen": {
  "screenType": "lesson_words",
  "title": "Нові слова",
  "items": [
    {
      "wordId": "a1-s01-l01-w01",
      "sk": "Ahoj",
      "uk": "Привіт",
      "pronunciationUk": "агой",
      "exampleSk": "Ahoj, Peter!",
      "exampleUk": "Привіт, Петер!"
    }
  ]
}
```

If the lesson uses the newer format where `wordsScreen.items` is omitted, the application can render the canonical `lesson.words` collection instead. Do not create an incomplete `items` array just to reference word IDs.

## 3. Exercise runtime safety

Every exercise MUST satisfy both the schema and the actual checker/renderer:

- choice mechanics have at least one option marked `correct: true`;
- free-input mechanics have `acceptedAnswers` or another explicit deterministic answer;
- sentence ordering has `correctOrder`;
- sentence builder has `correctSentence`;
- matching/category mechanics contain the structures consumed by their checker;
- listening mechanics have an audio reference;
- `wordIds` resolve to `lesson.words`;
- `lessonId` agrees with the parent lesson when supplied;
- exercise IDs and orders are unique within the lesson.

## 4. Two validation layers are mandatory

### Structural

`curriculum/lesson.schema.json` catches invalid data types, missing required fields and unsupported exercise types.

### Semantic/runtime

`scripts/qa-lessons.ts` catches problems that JSON Schema alone cannot reliably express, including broken references, duplicate IDs/orders, empty render fields and inconsistent vocabulary screen data.

Both layers must pass.

## 5. Root cause of the empty vocabulary screen bug

A lesson can pass a weak schema while still producing an empty UI. The specific failure mode was:

```text
wordsScreen.items[] -> { wordId }
                         ↓
StudentScreens renders item.sk / item.uk
                         ↓
undefined / undefined
                         ↓
empty vocabulary rows
```

The corrected schema now requires `sk` and `uk` whenever `wordsScreen.items[]` exists, and the semantic QA additionally verifies the `wordId` linkage and value consistency.
