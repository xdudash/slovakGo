import fs from "node:fs";
import path from "node:path";

type R = Record<string, any>;
const ROOT = process.cwd();
const DEFAULT_DIRS = ["lessons", "A1", "A2", "B1", "B2", "C1", "C2", "content"];
const CHOICE = new Set([
  "single_choice", "multiple_select", "dialogue_choose_reply", "meaning_in_context", "natural_phrase",
  "tone", "register", "hidden_meaning", "real_document", "real_message", "real_schedule"
]);

const isObj = (v: unknown): v is R => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => typeof v === "string" && v.trim().length > 0;
const localized = (v: unknown) => text(v) || (isObj(v) && Object.values(v).some(text));
const err = (e: string[], f: string, l: string, m: string) => e.push(`${path.relative(ROOT, f)} :: ${l} :: ${m}`);

function filesAt(target: string): string[] {
  const p = path.resolve(ROOT, target);
  if (!fs.existsSync(p)) return [];
  if (fs.statSync(p).isFile()) return p.endsWith(".json") ? [p] : [];
  const out: string[] = [];
  for (const x of fs.readdirSync(p, { withFileTypes: true })) {
    if (x.name === "node_modules" || x.name.startsWith(".")) continue;
    out.push(...(x.isDirectory() ? filesAt(path.join(target, x.name)) : x.name.endsWith(".json") ? [path.join(p, x.name)] : []));
  }
  return out;
}

function checkWords(e: string[], f: string, l: R) {
  const words = Array.isArray(l.words) ? l.words : [];
  const map = new Map<string, R>();
  for (const w of words) if (isObj(w) && text(w.id)) map.set(w.id, w);
  const s = l.wordsScreen;
  if (!isObj(s)) return err(e, f, l.id, "wordsScreen must be an object");
  if (s.items === undefined) return;
  if (!Array.isArray(s.items) || !s.items.length) return err(e, f, l.id, "wordsScreen.items must be a non-empty array when present");
  s.items.forEach((item: unknown, i: number) => {
    if (!isObj(item)) return err(e, f, l.id, `wordsScreen.items[${i}] must be an object`);
    if (!text(item.sk)) err(e, f, l.id, `wordsScreen.items[${i}] missing sk`);
    if (!text(item.uk)) err(e, f, l.id, `wordsScreen.items[${i}] missing uk`);
    if (item.wordId !== undefined) {
      const w = map.get(String(item.wordId));
      if (!w) err(e, f, l.id, `wordsScreen.items[${i}].wordId '${item.wordId}' does not resolve`);
      else {
        if (item.sk !== w.sk) err(e, f, l.id, `wordsScreen.items[${i}].sk differs from word '${item.wordId}'`);
        if (item.uk !== w.uk && item.uk !== w.translation?.uk) err(e, f, l.id, `wordsScreen.items[${i}].uk differs from word '${item.wordId}'`);
      }
    }
  });
}

function correctOption(options: unknown) {
  return Array.isArray(options) && options.some((o) => isObj(o) && o.correct === true);
}

function checkExercise(e: string[], f: string, l: R, x: R, words: Set<string>) {
  const id = String(x.id ?? "<missing-id>"), type = String(x.type ?? "");
  if (x.lessonId !== undefined && x.lessonId !== l.id) err(e, f, l.id, `${id}.lessonId does not match lesson.id`);
  if (!Number.isInteger(x.order) || x.order < 1) err(e, f, l.id, `${id} has invalid order`);
  if (x.wordIds !== undefined && (!Array.isArray(x.wordIds) || x.wordIds.some((w: unknown) => !words.has(String(w))))) err(e, f, l.id, `${id} has unresolved wordIds`);

  if (CHOICE.has(type)) {
    if (!correctOption(x.options)) err(e, f, l.id, `${id} needs an options[] entry with correct:true`);
    if (type === "listen_choice" && !text(x.audioRef) && !text(x.audioUrl)) err(e, f, l.id, `${id} needs audioRef/audioUrl`);
    return;
  }
  switch (type) {
    case "multiple_choice_translation": case "reverse_translation": case "match_pairs":
      if (x.correctAnswer === undefined) err(e, f, l.id, `${id} missing correctAnswer`); break;
    case "true_false": case "listen_true_false":
      if (x.correctAnswer === undefined && !Array.isArray(x.statements)) err(e, f, l.id, `${id} missing deterministic answer`); break;
    case "true_false_list":
      if (!Array.isArray(x.statements) || !x.statements.length || x.statements.some((s: unknown) => !isObj(s) || typeof s.correct !== "boolean")) err(e, f, l.id, `${id} needs statements with boolean correct`); break;
    case "fill_blank": case "listen_fill": case "correct_error": case "transformation":
      if (!Array.isArray(x.acceptedAnswers) && x.correctAnswer === undefined) err(e, f, l.id, `${id} needs acceptedAnswers or correctAnswer`); break;
    case "dropdown_blank":
      if (!Array.isArray(x.sentenceParts) || !x.sentenceParts.some((p: unknown) => isObj(p) && text(p.blankId) && text(p.correct))) err(e, f, l.id, `${id} needs sentenceParts blankId/correct`); break;
    case "cloze_text":
      if (!Array.isArray(x.textParts) || !x.textParts.some((p: unknown) => isObj(p) && text(p.blankId) && Array.isArray(p.acceptedAnswers) && p.acceptedAnswers.length)) err(e, f, l.id, `${id} needs textParts acceptedAnswers`); break;
    case "word_bank":
      if (!Array.isArray(x.items) || !x.items.length || x.items.some((i: unknown) => !isObj(i) || !text(i.correct))) err(e, f, l.id, `${id} needs items with correct`); break;
    case "drag_to_blank":
      if (!text(x.correct)) err(e, f, l.id, `${id} missing correct`); break;
    case "drag_to_category":
      if (!Array.isArray(x.items) || !x.items.length || x.items.some((i: unknown) => !isObj(i) || !text(i.category))) err(e, f, l.id, `${id} needs items with category`); break;
    case "matching": case "collocation": case "image_match":
      if (!Array.isArray(x.pairs ?? x.items) || !(x.pairs ?? x.items).length) err(e, f, l.id, `${id} needs pairs/items`); break;
    case "sentence_builder":
      if (!text(x.correctSentence)) err(e, f, l.id, `${id} missing correctSentence`); break;
    case "sentence_order": case "dialogue_order":
      if (!Array.isArray(x.correctOrder) || !x.correctOrder.length) err(e, f, l.id, `${id} missing correctOrder`); break;
    case "branching_dialogue":
      if (!text(x.startNode) || !isObj(x.nodes)) err(e, f, l.id, `${id} needs startNode/nodes`); break;
    case "find_error":
      if (!text(x.errorToken)) err(e, f, l.id, `${id} missing errorToken`); break;
    case "listen_choice":
      if (!text(x.audioRef) && !text(x.audioUrl)) err(e, f, l.id, `${id} needs audioRef/audioUrl`); break;
    case "dictation":
      if (!Array.isArray(x.acceptedAnswers) || !x.acceptedAnswers.length) err(e, f, l.id, `${id} needs acceptedAnswers`);
      if (!text(x.audioRef) && !text(x.audioUrl)) err(e, f, l.id, `${id} needs audioRef/audioUrl`); break;
    case "reading_comprehension": case "real_menu":
      if (!Array.isArray(x.questions) || !x.questions.length) err(e, f, l.id, `${id} needs questions`); break;
    default:
      err(e, f, l.id, `${id} uses unknown/unregistered exercise type '${type}'`);
  }
}

function checkLesson(e: string[], f: string, l: unknown) {
  if (!isObj(l)) return err(e, f, "<unknown>", "lesson must be an object");
  const id = String(l.id ?? "<unknown>");
  for (const k of ["id","sectionId","level","title","topic","description","order","xpReward","estimatedMinutes","isPublished","intro","completionMessage","startScreen","theoryScreens","wordsScreen","words","exercises","finalSituation","resultScreen"])
    if (!(k in l)) err(e, f, id, `missing required field '${k}'`);

  if (!Array.isArray(l.words) || !l.words.length) err(e, f, id, "words must be non-empty");
  const words = new Set<string>();
  for (const w of l.words ?? []) {
    if (!isObj(w)) continue;
    if (!text(w.id)) err(e, f, id, "word missing id"); else if (words.has(w.id)) err(e, f, id, `duplicate word id '${w.id}'`); else words.add(w.id);
    if (!text(w.sk)) err(e, f, id, `word '${w.id}' missing sk`);
    if (!text(w.uk) && !localized(w.translation)) err(e, f, id, `word '${w.id}' missing uk/translation`);
  }
  checkWords(e, f, l);

  if (!Array.isArray(l.exercises) || !l.exercises.length) err(e, f, id, "exercises must be non-empty");
  const ids = new Set<string>(), orders = new Set<number>();
  for (const x of l.exercises ?? []) {
    if (!isObj(x)) { err(e, f, id, "exercise must be an object"); continue; }
    if (!text(x.id)) err(e, f, id, "exercise missing id"); else if (ids.has(x.id)) err(e, f, id, `duplicate exercise id '${x.id}'`); else ids.add(x.id);
    if (Number.isInteger(x.order)) { if (orders.has(x.order)) err(e, f, id, `duplicate exercise order '${x.order}'`); orders.add(x.order); }
    checkExercise(e, f, l, x, words);
  }
  if (isObj(l.startScreen) && Number.isInteger(l.startScreen.exercisesCount) && l.startScreen.exercisesCount !== l.exercises.length)
    err(e, f, id, `startScreen.exercisesCount ${l.startScreen.exercisesCount} != exercises.length ${l.exercises.length}`);
}

const targets = process.argv.slice(2);
const files = [...new Set((targets.length ? targets : DEFAULT_DIRS).flatMap(filesAt))].sort();
if (!files.length) { console.error("QA FAILED: no lesson JSON files found; pass explicit lesson file/directory paths."); process.exit(1); }
const errors: string[] = []; let lessons = 0;
for (const f of files) {
  try {
    const data = JSON.parse(fs.readFileSync(f, "utf8"));
    if (!isObj(data) || !Array.isArray(data.lessons) || !data.lessons.length) { err(errors, f, "<root>", "root must contain non-empty lessons[]"); continue; }
    lessons += data.lessons.length; data.lessons.forEach((l: unknown) => checkLesson(errors, f, l));
  } catch (x) { err(errors, f, "<root>", `JSON parse error: ${x instanceof Error ? x.message : String(x)}`); }
}
if (errors.length) { console.error(`QA FAILED: ${errors.length} issue(s) across ${lessons} lesson(s).`); errors.forEach((x) => console.error(`- ${x}`)); process.exit(1); }
console.log(`QA PASSED: ${lessons} lesson(s), ${files.length} file(s). Runtime contract checks passed.`);
