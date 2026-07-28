import rawTestData from "../data/slovakPlacementTestUaV1.json";
import type { UserLevel } from "../types";

export type PlacementBranch = "low" | "middle" | "high";
export type PlacementAnswerStatus = "correct" | "incorrect" | "unknown";
export type PlacementClosedResult = UserLevel | "A1+" | "B1+" | "C1+" | "C2_candidate";
export type PlacementOverallLevel = UserLevel | "A1+" | "B1+" | "C1+" | "C2";
export type PlacementConfidence = "high" | "medium" | "low";

export interface PlacementOption {
  id: string;
  text: string;
}

export interface PlacementQuestion {
  id: string;
  sectionId: string;
  blockId: string;
  level: UserLevel | "C2";
  skill: string;
  type: string;
  question_ua: string;
  context_ua?: string;
  prompt_sk?: string;
  sequenceItems?: string[];
  options: PlacementOption[];
  correctOptionId: string;
  explanation_ua: string;
  isPublished: boolean;
}

export interface PlacementWritingTask {
  id: string;
  targetLevels: string[];
  title_ua: string;
  instruction_ua: string;
  requirements_ua: string[];
  sourceTexts_sk?: string[];
  minWords: number;
  maxWords: number;
}

export interface PlacementAnswer {
  questionId: string;
  selectedOptionId: string;
  status: PlacementAnswerStatus;
  responseTimeMs: number;
}

export interface PlacementWritingScores {
  task_completion: number;
  coherence: number;
  vocabulary: number;
  grammar: number;
  style_and_naturalness: number;
}

export interface PlacementAttempt {
  attemptId: string;
  userId: string;
  testVersion: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  branchId: PlacementBranch;
  answers: PlacementAnswer[];
  writing: {
    taskId: string;
    text: string;
    wordCount: number;
    scores: PlacementWritingScores;
    total: number;
    level: UserLevel | "C2";
    assessmentMethod: "automatic_preliminary";
  };
  result: {
    closedResult: PlacementClosedResult;
    writingLevel: UserLevel | "C2";
    overallLevel: PlacementOverallLevel;
    recommendedCourseLevel: UserLevel;
    confidence: PlacementConfidence;
    unknownShare: number;
    weakSkills: string[];
  };
}

type BranchConfig = {
  questionIds: string[];
  blocks: Array<{ id: string; level: string; questionIds: string[] }>;
};

type PlacementData = {
  id: string;
  version: string;
  title_ua: string;
  subtitle_ua: string;
  disclaimer_ua: string;
  estimatedMinutes: { min: number; max: number };
  startScreen: { title_ua: string; body_ua: string[]; primaryButton_ua: string };
  globalSettings: { unknownOptionId: string; unknownLabel_ua: string };
  routing: { questionIds: string[]; basicQuestionIds: string[]; advancedQuestionIds: string[] };
  branches: Record<PlacementBranch, BranchConfig>;
  questions: PlacementQuestion[];
  writingTasks: PlacementWritingTask[];
  writingRubric: {
    criteria: Array<{ id: keyof PlacementWritingScores; label_ua: string; descriptors_ua: Record<string, string> }>;
    scoreBands: Array<{ min: number; max: number; level: UserLevel | "C2" }>;
  };
  resultScreen: { title_ua: string; buttons_ua: Record<string, string> };
};

export interface PlacementDraft {
  attemptId: string;
  userId: string;
  startedAt: string;
  phase: "questions" | "writing";
  branchId?: PlacementBranch;
  questionIds: string[];
  answers: PlacementAnswer[];
  currentIndex: number;
  writingText: string;
}

const test = (rawTestData as unknown as { test: PlacementData }).test;
const questionMap = new Map(test.questions.map((question) => [question.id, question]));
const DRAFT_KEY = "slovakgo.placement-test.draft.v1";
const ATTEMPTS_KEY = "slovakgo.placement-test.attempts.v1";
const fullLevels = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as const;

function correctCount(ids: string[], answers: PlacementAnswer[]): number {
  const idSet = new Set(ids);
  return answers.filter((answer) => idSet.has(answer.questionId) && answer.status === "correct").length;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(4, Math.round(score)));
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}

export function routeBranch(answers: PlacementAnswer[]): PlacementBranch {
  const basic = correctCount(test.routing.basicQuestionIds, answers);
  const advanced = correctCount(test.routing.advancedQuestionIds, answers);
  if (basic <= 2) return "low";
  if (basic >= 3 && advanced >= 3) return "high";
  return "middle";
}

export function scoreClosed(branch: PlacementBranch, answers: PlacementAnswer[]): PlacementClosedResult {
  const blocks = Object.fromEntries(
    test.branches[branch].blocks.map((block) => [block.id, correctCount(block.questionIds, answers)])
  );
  if (branch === "low") {
    if (blocks.pre_a1 <= 2 || blocks.a1 <= 1) return "A0";
    if (blocks.pre_a1 >= 3 && blocks.a1 >= 3 && blocks.a2 >= 3) return "A2";
    if (blocks.pre_a1 >= 3 && blocks.a1 >= 3 && blocks.a2 === 2) return "A1+";
    return "A1";
  }
  if (branch === "middle") {
    if (blocks.a2 <= 2 || blocks.b1 <= 1) return "A2";
    if (blocks.a2 >= 3 && blocks.b1 >= 3 && blocks.b2 >= 3) return "B2";
    if (blocks.a2 >= 3 && blocks.b1 >= 3 && blocks.b2 === 2) return "B1+";
    return "B1";
  }
  if (blocks.b2 <= 2 || blocks.c1 <= 1) return "B2";
  if (blocks.b2 >= 3 && blocks.c1 >= 3 && blocks.c2 >= 3) return "C2_candidate";
  if (blocks.b2 >= 3 && blocks.c1 >= 3 && blocks.c2 === 2) return "C1+";
  return "C1";
}

export function selectWritingTask(result: PlacementClosedResult): PlacementWritingTask {
  const taskId =
    result === "A0" || result === "A1" ? "W0" :
    result === "A1+" || result === "A2" ? "W2" :
    result === "B1" ? "W3" :
    result === "B1+" || result === "B2" ? "W4" :
    result === "C1" ? "W5" : "W6";
  return test.writingTasks.find((task) => task.id === taskId) ?? test.writingTasks[0];
}

export function evaluateWriting(text: string, task: PlacementWritingTask): {
  scores: PlacementWritingScores;
  total: number;
  level: UserLevel | "C2";
} {
  const words = text.trim().match(/[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*/gu) ?? [];
  const count = words.length;
  const sentences = text.split(/[.!?]+/u).filter((part) => part.trim().length > 2).length;
  const uniqueRatio = count ? new Set(words.map((word) => word.toLocaleLowerCase("sk"))).size / count : 0;
  const connectors = (text.match(/\b(a|ale|preto|pretože|keď|ak|hoci|napriek|zatiaľ|teda|avšak|pričom|ktorý|ktorá|ktoré)\b/giu) ?? []).length;
  const slovakSignals = (text.match(/[áäčďéíĺľňóôŕšťúýž]/giu) ?? []).length;
  const targetRatio = count / Math.max(1, task.minWords);

  const taskCompletion = clampScore(targetRatio >= 1 ? 4 : targetRatio >= 0.75 ? 3 : targetRatio >= 0.5 ? 2 : targetRatio > 0 ? 1 : 0);
  const coherence = clampScore(sentences >= 5 && connectors >= 4 ? 4 : sentences >= 3 && connectors >= 2 ? 3 : sentences >= 2 ? 2 : count >= 5 ? 1 : 0);
  const vocabulary = clampScore(count >= 180 && uniqueRatio >= 0.62 ? 4 : count >= 90 && uniqueRatio >= 0.55 ? 3 : count >= 35 && uniqueRatio >= 0.45 ? 2 : count >= 8 ? 1 : 0);
  const grammar = clampScore(sentences >= 5 && connectors >= 5 && slovakSignals >= 8 ? 4 : sentences >= 3 && connectors >= 2 && slovakSignals >= 4 ? 3 : sentences >= 2 && slovakSignals >= 2 ? 2 : count >= 5 ? 1 : 0);
  const style = clampScore(slovakSignals >= 10 && sentences >= 5 ? 4 : slovakSignals >= 5 && sentences >= 3 ? 3 : slovakSignals >= 2 ? 2 : count >= 5 ? 1 : 0);
  const scores = {
    task_completion: taskCompletion,
    coherence,
    vocabulary,
    grammar,
    style_and_naturalness: style
  };
  const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
  const level = test.writingRubric.scoreBands.find((band) => total >= band.min && total <= band.max)?.level ?? "A0";
  return { scores, total, level };
}

function closedFullLevel(result: PlacementClosedResult): typeof fullLevels[number] {
  if (result === "C2_candidate") return "C2";
  return result.replace("+", "") as typeof fullLevels[number];
}

export function combineResults(closed: PlacementClosedResult, writing: UserLevel | "C2"): PlacementOverallLevel {
  if (closed === "C2_candidate") return writing === "C2" ? "C2" : "C1+";
  const closedBase = closedFullLevel(closed);
  const closedIndex = fullLevels.indexOf(closedBase);
  const writingIndex = fullLevels.indexOf(writing);
  if (writingIndex <= closedIndex - 2) return fullLevels[Math.max(0, closedIndex - 1)] as UserLevel;
  if (writingIndex > closedIndex && !closed.includes("+")) return `${closedBase}+` as PlacementOverallLevel;
  return closed as PlacementOverallLevel;
}

export function toCourseLevel(result: PlacementOverallLevel): UserLevel {
  const base = result.replace("+", "");
  return (base === "C2" ? "C1" : base) as UserLevel;
}

function weakSkills(questions: PlacementQuestion[], answers: PlacementAnswer[]): string[] {
  const stats = new Map<string, { correct: number; total: number }>();
  for (const answer of answers) {
    const question = questions.find((item) => item.id === answer.questionId);
    if (!question) continue;
    const current = stats.get(question.skill) ?? { correct: 0, total: 0 };
    current.total += 1;
    if (answer.status === "correct") current.correct += 1;
    stats.set(question.skill, current);
  }
  return [...stats.entries()]
    .filter(([, value]) => value.total >= 2 && value.correct / value.total < 0.6)
    .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
    .slice(0, 3)
    .map(([skill]) => skill);
}

export function createAttempt(draft: PlacementDraft, writingText: string): PlacementAttempt {
  const branch = draft.branchId ?? routeBranch(draft.answers);
  const closedResult = scoreClosed(branch, draft.answers);
  const task = selectWritingTask(closedResult);
  const writing = evaluateWriting(writingText, task);
  const overallLevel = combineResults(closedResult, writing.level);
  const unknownShare = draft.answers.filter((answer) => answer.status === "unknown").length / draft.answers.length;
  const durationMs = Date.now() - new Date(draft.startedAt).getTime();
  const tooShort = wordCount(writingText) < task.minWords;
  const suspiciouslyFast = durationMs < 5 * 60_000;
  const gap = Math.abs(fullLevels.indexOf(closedFullLevel(closedResult)) - fullLevels.indexOf(writing.level));
  const confidence: PlacementConfidence =
    unknownShare > 0.4 || tooShort || suspiciouslyFast ? "low" :
    unknownShare >= 0.25 || gap >= 2 || closedResult.includes("+") ? "medium" : "high";

  return {
    attemptId: draft.attemptId,
    userId: draft.userId,
    testVersion: test.version,
    startedAt: draft.startedAt,
    completedAt: new Date().toISOString(),
    durationMs,
    branchId: branch,
    answers: draft.answers,
    writing: {
      taskId: task.id,
      text: writingText,
      wordCount: wordCount(writingText),
      scores: writing.scores,
      total: writing.total,
      level: writing.level,
      assessmentMethod: "automatic_preliminary"
    },
    result: {
      closedResult,
      writingLevel: writing.level,
      overallLevel,
      recommendedCourseLevel: toCourseLevel(overallLevel),
      confidence,
      unknownShare,
      weakSkills: weakSkills(test.questions, draft.answers)
    }
  };
}

function shuffledOptions(question: PlacementQuestion, attemptId: string): PlacementOption[] {
  const hash = [...`${attemptId}:${question.id}`].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
  return [...question.options].sort((a, b) => {
    const score = (id: string) => [...`${hash}:${id}`].reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381);
    return score(a.id) - score(b.id);
  });
}

export const placementTestService = {
  test,
  question(id: string): PlacementQuestion {
    const question = questionMap.get(id);
    if (!question) throw new Error(`Unknown placement question: ${id}`);
    return question;
  },
  options(question: PlacementQuestion, attemptId: string): PlacementOption[] {
    return shuffledOptions(question, attemptId);
  },
  start(userId: string): PlacementDraft {
    return {
      attemptId: crypto.randomUUID(),
      userId,
      startedAt: new Date().toISOString(),
      phase: "questions",
      questionIds: [...test.routing.questionIds],
      answers: [],
      currentIndex: 0,
      writingText: ""
    };
  },
  answer(draft: PlacementDraft, selectedOptionId: string, responseTimeMs: number): PlacementDraft {
    const question = this.question(draft.questionIds[draft.currentIndex]);
    const status: PlacementAnswerStatus =
      selectedOptionId === test.globalSettings.unknownOptionId ? "unknown" :
      selectedOptionId === question.correctOptionId ? "correct" : "incorrect";
    const answers = [...draft.answers, { questionId: question.id, selectedOptionId, status, responseTimeMs }];
    let questionIds = draft.questionIds;
    let branchId = draft.branchId;
    if (answers.length === test.routing.questionIds.length) {
      branchId = routeBranch(answers);
      questionIds = [...test.routing.questionIds, ...test.branches[branchId].questionIds];
    }
    const currentIndex = draft.currentIndex + 1;
    return {
      ...draft,
      answers,
      branchId,
      questionIds,
      currentIndex,
      phase: currentIndex >= questionIds.length ? "writing" : "questions"
    };
  },
  saveDraft(draft: PlacementDraft): void {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  },
  loadDraft(userId: string): PlacementDraft | null {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as PlacementDraft | null;
      return draft?.userId === userId ? draft : null;
    } catch {
      return null;
    }
  },
  clearDraft(): void {
    localStorage.removeItem(DRAFT_KEY);
  },
  saveAttempt(attempt: PlacementAttempt): void {
    let previous: PlacementAttempt[];
    try {
      previous = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? "[]") as PlacementAttempt[];
    } catch {
      previous = [];
    }
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify([...previous.slice(-9), attempt]));
  }
};
