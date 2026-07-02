export type UserRole = "student" | "teacher" | "admin";
export type UserLevel = "A0" | "A1" | "A2" | "B1" | "B2" | "C1";
export type SubscriptionStatus = "free" | "trial" | "plus" | "expired" | "cancelled";

export interface UserSettings {
  language: "uk" | "sk" | "en";
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  phone?: string;
  dailyGoal?: number;
  theme?: "default";
  reminderTime?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  level: UserLevel;
  goal?: string;
  country?: string;
  createdAt: string;
  lastActiveAt?: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: string;
  onboardingDone: boolean;
  settings: UserSettings;
  isBlocked?: boolean;
}

export interface Word {
  id: string;
  sk: string;
  uk: string;
  exampleSk?: string;
  exampleUk?: string;
  level: UserLevel;
  topic: string;
  lessonId: string;
  audioUrl?: string;
  transcription?: string;
  tags?: string[];
}

export type ExerciseType =
  | "multiple_choice_translation"
  | "reverse_translation"
  | "audio_choice"
  | "match_pairs"
  | "true_false"
  | "fill_blank"
  | "sentence_ordering"
  | "typing"
  | "mistake_review";

export interface Exercise {
  id: string;
  lessonId: string;
  type: ExerciseType;
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  wordIds?: string[];
  audioUrl?: string;
  imageUrl?: string;
  order: number;
  difficulty?: "easy" | "medium" | "hard";
}

export interface TheoryExample {
  sk: string;
  uk: string;
}

export interface AlphabetGroup {
  title: string;
  letters: string[];
  note?: string;
}

export interface TheoryScreen {
  id: string;
  screenType: "theory";
  order: number;
  title?: string;
  text?: string;
  examples?: TheoryExample[];
  focusPoints?: string[];
  alphabetRows?: string[][];
  alphabetGroups?: AlphabetGroup[];
  shortRule?: string;
  button?: string;
}

export interface LessonStartScreen {
  screenType: "lesson_start";
  title?: string;
  subtitle?: string;
  shortDescription?: string;
  outcomes?: string[];
  newWords?: string[];
  exercisesCount?: number;
  reward?: string;
  iconEmoji?: string;
  button?: string;
}

export interface FinalSituation {
  screenType: "final_life_situation";
  scenario: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface LessonResultScreen {
  screenType: "lesson_result";
  result?: string;
  newWordsCount?: number;
  exercisesCompleted?: number;
  nowYouKnow?: string[];
}

export interface Lesson {
  id: string;
  level: UserLevel;
  title: string;
  description: string;
  topic: string;
  order: number;
  xpReward: number;
  estimatedMinutes: number;
  isPublished: boolean;
  isLocked?: boolean;
  createdBy?: string;
  intro?: string;
  words: Word[];
  exercises: Exercise[];
  completionMessage?: string;
  updatedAt: string;
  startScreen?: LessonStartScreen;
  theoryScreens?: TheoryScreen[];
  finalSituation?: FinalSituation;
  resultScreen?: LessonResultScreen;
}

export interface AnswerRecord {
  exerciseId: string;
  answer: string | string[];
  correct: boolean;
  answeredAt: string;
}

export interface LessonAttempt {
  id: string;
  userId: string;
  lessonId: string;
  startedAt: string;
  finishedAt?: string;
  score: number;
  mistakesCount: number;
  heartsLost: number;
  xpEarned: number;
  answers: AnswerRecord[];
  completed: boolean;
}

export interface Mistake {
  id: string;
  userId: string;
  lessonId: string;
  exerciseId: string;
  wordId?: string;
  wrongAnswer: string;
  correctAnswer: string;
  createdAt: string;
  resolvedAt?: string;
  repeatCount: number;
}

export interface Achievement {
  id: string;
  title: string;
  earnedAt: string;
}

export interface Progress {
  userId: string;
  currentLevel: UserLevel;
  currentLessonId?: string;
  completedLessons: string[];
  lessonAttempts: LessonAttempt[];
  xpTotal: number;
  xpWeekly: number;
  weekId?: string;
  hearts: number;
  maxHearts: number;
  streakDays: number;
  lastPracticeDate?: string;
  streakFreezeCount: number;
  coins: number;
  mistakes: Mistake[];
  achievements: Achievement[];
  xpDailyHistory?: Record<string, number>;
  updatedAt: string;
}

export interface UserWord {
  userId: string;
  wordId: string;
  status: "new" | "practicing" | "mastered";
  mistakeCount: number;
  correctCount: number;
  favorite: boolean;
  lastSeenAt?: string;
  nextReviewAt?: string;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatar?: string;
  country?: string;
  xpWeekly: number;
  rank: number;
  movement?: "up" | "down" | "same";
  leagueChange?: "promoted" | "demoted";
}

export interface LeaderboardSnapshot {
  weekId: string;
  entries: LeaderboardEntry[];
}

export interface Leaderboard {
  weekId: string;
  league: "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";
  entries: LeaderboardEntry[];
  history?: LeaderboardSnapshot[];
}

export interface SyncMutation {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AppData {
  users: User[];
  lessons: Lesson[];
  progress: Record<string, Progress>;
  userWords: Record<string, UserWord[]>;
  leaderboard: Leaderboard;
  syncQueue: SyncMutation[];
  updatedAt: string;
}
