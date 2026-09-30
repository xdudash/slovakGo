// Runtime-compatibility harness for SlovakGO lessons.
//
// Loads the REAL checker/completion code from src/ (copied to a temp dir with
// Node-resolvable import specifiers), then for every exercise constructs the
// answer exactly the way the corresponding React renderer would emit it and
// asserts that: (1) the renderer-derived correct answer is complete and graded
// correct, (2) a plausible wrong answer is graded wrong, (3) render-critical
// fields are present. Also checks interactive final situations.
//
// Usage: node curriculum/course/runtime-check.ts <lesson.json|dir> ...
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sgo-rt-"));
const copies: [string, string][] = [
  ["src/services/exerciseChecking.ts", "exerciseChecking.ts"],
  ["src/utils/lessonLocale.ts", "lessonLocale.ts"],
  ["src/utils/exerciseCompletion.ts", "exerciseCompletion.ts"],
];
for (const [from, to] of copies) {
  let src = fs.readFileSync(path.join(ROOT, from), "utf8");
  src = src.replace(/from "\.\.\/utils\/lessonLocale"/g, 'from "./lessonLocale.ts"').replace(/import type[^;]+;/g, "");
  fs.writeFileSync(path.join(tmp, to), src);
}
const checking = await import(pathToFileURL(path.join(tmp, "exerciseChecking.ts")).href);
const completion = await import(pathToFileURL(path.join(tmp, "exerciseCompletion.ts")).href);
const { checkNewExercise, formatCorrectAnswer } = checking;
const { isExerciseComplete, finalSituationPassed } = completion;

type R = Record<string, any>;
const errors: string[] = [];
const fail = (l: string, e: string, m: string) => errors.push(`${l} :: ${e} :: ${m}`);
const txt = (v: unknown) => (typeof v === "string" ? v : v && typeof v === "object" ? String((v as R).uk ?? (v as R).sk ?? Object.values(v as R)[0] ?? "") : "");

function joinTokens(tokens: string[]) {
  let out = "";
  for (const t of tokens) out += /^[,.!?;:]+$/.test(t) || out === "" ? t : " " + t;
  return out;
}

function correctAnswer(x: R): { good: string | string[]; bad?: string | string[] } {
  const opts = (x.options ?? []) as R[];
  const correctIds = opts.filter((o) => o.correct).map((o) => o.id);
  const wrongId = opts.find((o) => !o.correct)?.id;
  switch (x.type) {
    case "single_choice": case "dialogue_choose_reply": case "meaning_in_context": case "natural_phrase":
    case "tone": case "register": case "hidden_meaning": case "real_document": case "real_message": case "real_schedule":
      return { good: correctIds[0], bad: wrongId };
    case "multiple_select":
      return { good: correctIds, bad: correctIds.slice(0, 1) };
    case "true_false":
      return { good: String(x.correctAnswer), bad: String(!x.correctAnswer) };
    case "true_false_list":
      return { good: x.statements.map((s: R, i: number) => `${i}:${s.correct}`), bad: x.statements.map((s: R, i: number) => `${i}:${i === 0 ? !s.correct : s.correct}`) };
    case "fill_blank":
      return { good: x.acceptedAnswers[0], bad: "xxx" };
    case "drag_to_blank":
      return { good: x.correct, bad: x.draggable.find((d: string) => d !== x.correct) };
    case "dropdown_blank": {
      const blanks = x.sentenceParts.filter((p: R) => p.blankId);
      return { good: blanks.map((b: R) => `${b.blankId}=${b.correct}`), bad: blanks.map((b: R, i: number) => `${b.blankId}=${i === 0 ? b.options.find((o: string) => o !== b.correct) : b.correct}`) };
    }
    case "cloze_text": {
      const blanks = x.textParts.filter((p: R) => p.blankId);
      return { good: blanks.map((b: R) => `${b.blankId}=${b.acceptedAnswers[0]}`), bad: blanks.map((b: R) => `${b.blankId}=zzz`) };
    }
    case "word_bank":
      return { good: x.items.map((it: R, i: number) => `${i}=${it.correct}`), bad: x.items.map((it: R, i: number) => `${i}=${i === 0 ? "zzz" : it.correct}`) };
    case "matching": case "collocation":
      return { good: x.pairs.map((_: R, i: number) => `${i}|${i}`), bad: x.pairs.map((_: R, i: number) => `${i}|${(i + 1) % x.pairs.length}`) };
    case "drag_to_category":
      return { good: x.items.map((it: R, i: number) => `${i}:${it.category}`), bad: x.items.map((it: R, i: number) => `${i}:${i === 0 ? "nope" : it.category}`) };
    case "sentence_builder": {
      // reconstruct a pick order from the displayed tokens that yields correctSentence
      const pool = [...x.tokens];
      const target = x.correctSentence.match(/[^\s,.!?;:]+|[,.!?;:]+/g) as string[];
      const picked: string[] = [];
      for (const t of target) {
        const i = pool.indexOf(t);
        if (i < 0) return { good: ["<token missing>"] };
        picked.push(pool.splice(i, 1)[0]);
      }
      if (pool.length) return { good: ["<unused tokens>"] };
      return { good: picked, bad: [...x.tokens] };
    }
    case "sentence_order":
      return { good: x.correctOrder, bad: [...x.tokens] };
    case "dialogue_order":
      return { good: x.correctOrder, bad: x.lines.map((l: R) => l.id) };
    case "branching_dialogue": {
      const path: string[] = [];
      let node = x.startNode;
      const seen = new Set<string>();
      while (x.nodes[node] && !seen.has(node)) {
        seen.add(node);
        const best = (x.nodes[node].choices ?? []).find((c: R) => c.quality === "best");
        if (!best) break;
        path.push(best.id);
        node = best.next;
      }
      const firstWrong = (x.nodes[x.startNode].choices ?? []).find((c: R) => c.quality === "wrong");
      return { good: path, bad: firstWrong ? [firstWrong.id] : undefined };
    }
    case "find_error": {
      const words = txt(x.sentence).split(/(\s+)/).map((w: string) => w.trim()).filter(Boolean);
      const norm = (v: string) => v.trim().toLowerCase().replace(/[.!?]/g, "");
      const clickable = words.find((w: string) => norm(w) === norm(x.errorToken));
      const other = words.find((w: string) => norm(w) !== norm(x.errorToken));
      return { good: clickable ?? "<not clickable>", bad: other };
    }
    case "correct_error": case "transformation":
      return { good: x.acceptedAnswers[0], bad: txt(x.sentence ?? x.source) };
    case "reading_comprehension": case "real_menu":
      return {
        good: x.questions.map((q: R) => q.options.find((o: R) => o.correct).id),
        bad: x.questions.map((q: R, i: number) => (i === 0 ? q.options.find((o: R) => !o.correct).id : q.options.find((o: R) => o.correct).id)),
      };
  }
  return { good: "<unsupported>" };
}

function renderChecks(l: string, x: R) {
  const id = x.id;
  if (!txt(x.instruction)) fail(l, id, "empty instruction header");
  const blankTypes = ["fill_blank", "drag_to_blank"];
  if (blankTypes.includes(x.type) && !txt(x.sentence).includes("______")) fail(l, id, "sentence lacks ______ marker");
  if (x.type === "word_bank") for (const it of x.items) if (it.sentence.split("______").length !== 2) fail(l, id, "word_bank sentence needs exactly one blank");
  if (["single_choice", "multiple_select", "dialogue_choose_reply", "meaning_in_context", "natural_phrase", "tone", "register", "hidden_meaning", "real_document", "real_message", "real_schedule"].includes(x.type)) {
    const labels = x.options.map((o: R) => o.sk ?? txt(o.text));
    if (labels.some((s: string) => !s)) fail(l, id, "option without label");
    if (new Set(labels).size !== labels.length) fail(l, id, "duplicate option labels");
    if (new Set(x.options.map((o: R) => o.id)).size !== x.options.length) fail(l, id, "duplicate option ids");
  }
  if (x.type === "sentence_builder" || x.type === "sentence_order") {
    const same = x.type === "sentence_builder" ? joinTokens(x.tokens) === x.correctSentence : x.tokens.join("|") === x.correctOrder.join("|");
    if (same) fail(l, id, "tokens are displayed already in the correct order");
  }
  if (x.type === "dialogue_order" && x.lines.map((q: R) => q.id).join(",") === x.correctOrder.join(",")) fail(l, id, "lines displayed in solved order");
  if (!formatCorrectAnswer(x)) fail(l, id, "formatCorrectAnswer is empty (wrong-answer feedback would be blank)");
}

function checkLesson(l: R) {
  for (const x of l.exercises) {
    renderChecks(l.id, x);
    const { good, bad } = correctAnswer(x);
    if (!isExerciseComplete(x, good)) fail(l.id, x.id, `correct answer not accepted as complete: ${JSON.stringify(good)}`);
    const res = checkNewExercise(x, good);
    if (res !== true) fail(l.id, x.id, `correct answer graded ${res}: ${JSON.stringify(good)}`);
    if (bad !== undefined && checkNewExercise(x, bad) === true) fail(l.id, x.id, `wrong answer graded correct: ${JSON.stringify(bad)}`);
  }
  const sit = l.finalSituation;
  if (sit?.type === "interactive_scenario") {
    for (const s of sit.steps) {
      const labels = s.options.map((o: R) => o.sk ?? txt(o.text));
      if (new Set(labels).size !== labels.length) fail(l.id, `final:${s.id}`, "duplicate labels (runtime matches by label)");
      if (s.options.filter((o: R) => o.correct).length !== 1) fail(l.id, `final:${s.id}`, "needs exactly one correct");
    }
    if (!finalSituationPassed(sit, sit.steps.map(() => true))) fail(l.id, "final", "all-correct run does not pass");
  }
  const w = l.wordsScreen?.items ?? [];
  for (const it of w) for (const k of ["wordId", "sk", "uk", "pronunciationUk", "exampleSk", "exampleUk"]) if (!it[k]) fail(l.id, "wordsScreen", `item missing ${k}`);
}

function files(p: string): string[] {
  const s = fs.statSync(p);
  if (s.isFile()) return p.endsWith(".json") ? [p] : [];
  return fs.readdirSync(p).flatMap((n) => files(path.join(p, n)));
}
const targets = process.argv.slice(2);
let count = 0, exCount = 0;
for (const f of targets.flatMap((t) => files(path.resolve(t)))) {
  const data = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const l of data.lessons) { checkLesson(l); count++; exCount += l.exercises.length; }
}
fs.rmSync(tmp, { recursive: true, force: true });
if (errors.length) { console.error(`RUNTIME CHECK FAILED: ${errors.length} issue(s)`); errors.slice(0, 200).forEach((e) => console.error("- " + e)); process.exit(1); }
console.log(`RUNTIME CHECK PASSED: ${count} lesson(s), ${exCount} exercise(s) graded through the real checkers.`);
