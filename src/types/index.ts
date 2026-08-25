export type UserRole = "student" | "teacher" | "admin";
export type UserLevel = "A0" | "A1" | "A2" | "B1" | "B2" | "C1";
export type Locale = "uk" | "ru" | "sk" | "en";
/** Either a plain legacy string, or a per-locale map for newer multilingual lesson content. */
export type LocalizedText = string | Partial<Record<Locale, string>>;
/**
 * `past_due` is a grace state: Stripe is still retrying the payment, so access
 * stays open. It becomes `expired`/`cancelled` only once Stripe gives up.
 */
export type SubscriptionStatus = "free" | "trial" | "plus" | "past_due" | "expired" | "cancelled";

export interface UserSettings {
  language: "uk" | "ru" | "sk" | "en";
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
  subExpiresAt?: string;
  /** End of referral bonus access, if any. While in the future, access is full. */
  bonusUntil?: string;
  onboardingDone: boolean;
  settings: UserSettings;
  isBlocked?: boolean;
  hasUsedTrial: boolean;
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
  pronunciationUk?: string;
  /** New multilingual format: grammatical class (noun/verb/...). */
  partOfSpeech?: string;
  /** New multilingual format: replaces the single `uk` translation. */
  translation?: LocalizedText;
  /** New multilingual format: replaces `exampleSk`/`exampleUk`. */
  example?: { sk: string; translation?: LocalizedText };
}

export type ExerciseType =
  // Legacy 11 types
  | "multiple_choice_translation"
  | "multiple_choice_context"
  | "choose_response"
  | "reverse_translation"
  | "audio_choice"
  | "match_pairs"
  | "true_false"
  | "fill_blank"
  | "sentence_ordering"
  | "typing"
  | "mistake_review"
  // New 35-type exercise library
  | "single_choice"
  | "multiple_select"
  | "true_false_list"
  | "dropdown_blank"
  | "cloze_text"
  | "word_bank"
  | "drag_to_blank"
  | "drag_to_category"
  | "matching"
  | "image_match"
  | "sentence_builder"
  | "sentence_order"
  | "dialogue_order"
  | "dialogue_choose_reply"
  | "branching_dialogue"
  | "find_error"
  | "correct_error"
  | "transformation"
  | "listen_choice"
  | "listen_true_false"
  | "listen_fill"
  | "dictation"
  | "reading_comprehension"
  | "meaning_in_context"
  | "natural_phrase"
  | "tone"
  | "register"
  | "hidden_meaning"
  | "collocation"
  | "real_document"
  | "real_message"
  | "real_menu"
  | "real_schedule";

export interface ExerciseOption {
  id: string;
  sk?: string;
  text?: LocalizedText;
  correct?: boolean;
}

export interface ExercisePair {
  left: LocalizedText;
  right: LocalizedText;
}

export interface ExerciseTextPart {
  text?: string;
  blankId?: string;
  /** dropdown_blank: fixed option list for this blank. */
  options?: string[];
  /** dropdown_blank: the correct option. */
  correct?: string;
  /** cloze_text: accepted free-typed answers for this blank. */
  acceptedAnswers?: string[];
}

export interface DialogueOrderLine {
  id: string;
  sk: string;
  speaker?: string;
}

export interface BranchingDialogueChoice {
  id: string;
  sk: string;
  next: string;
  quality: "best" | "wrong";
}

export interface BranchingDialogueNode {
  speaker?: string;
  sk: string;
  choices?: BranchingDialogueChoice[];
}

export interface StructuredDocument {
  title?: LocalizedText;
  fields: { label: LocalizedText; value: LocalizedText }[];
}

export interface StructuredMessage {
  sender?: LocalizedText;
  body: LocalizedText;
}

export interface MenuRow {
  category?: LocalizedText;
  item: LocalizedText;
  price: string;
}

export interface ScheduleRow {
  day: LocalizedText;
  hours: LocalizedText;
}

export interface NestedQuestion {
  question: LocalizedText;
  options?: ExerciseOption[];
  /** real_menu: plain price string or a `{sk}`-shaped localized value. */
  correct?: string | LocalizedText;
}

export interface Exercise {
  id: string;
  lessonId: string;
  type: ExerciseType;
  /** Legacy types use a plain string; real_document/real_schedule use a LocalizedText map. */
  question?: LocalizedText;
  options?: string[] | ExerciseOption[];
  correctAnswer?: string | string[] | boolean;
  explanation?: LocalizedText;
  wordIds?: string[];
  audioUrl?: string;
  imageUrl?: string;
  order: number;
  difficulty?: "easy" | "medium" | "hard";
  fullSentence?: string;
  button?: string;

  // New 35-type exercise library — shape varies per type family, see plan.
  instruction?: LocalizedText;
  skill?: string[];
  prompt?: LocalizedText;
  text?: LocalizedText;
  statement?: LocalizedText;
  statements?: { sk: string; correct: boolean }[];
  sentence?: LocalizedText;
  sentenceParts?: ExerciseTextPart[];
  textParts?: ExerciseTextPart[];
  wordBank?: string[];
  items?: unknown[];
  draggable?: string[];
  /** drag_to_blank: the correct draggable value. */
  correct?: string;
  categories?: { id: string; title: LocalizedText }[];
  pairs?: ExercisePair[];
  tokens?: string[];
  correctSentence?: string;
  correctOrder?: string[];
  lines?: DialogueOrderLine[];
  dialogue?: { speaker?: string; sk: string }[];
  nodes?: Record<string, BranchingDialogueNode>;
  startNode?: string;
  successMessage?: LocalizedText;
  errorToken?: string;
  correctToken?: string;
  source?: LocalizedText;
  audioRef?: string;
  imageRef?: string;
  context?: LocalizedText;
  target?: LocalizedText;
  situation?: LocalizedText;
  phrase?: LocalizedText;
  document?: StructuredDocument;
  message?: StructuredMessage;
  menuData?: MenuRow[];
  schedule?: { title?: LocalizedText; rows: ScheduleRow[] };
  questions?: NestedQuestion[];
  acceptedAnswers?: string[];
  hint?: LocalizedText;
  ignoreCase?: boolean;
  ignoreTerminalPunctuation?: boolean;
  extraWords?: string[];
  displaySentence?: LocalizedText;
}

export interface TheoryExample {
  sk: string;
  uk?: string;
  /** New multilingual format: replaces `uk`. */
  translation?: LocalizedText;
}

export interface AlphabetGroup {
  title: string;
  letters: string[];
  note?: string;
  noteUk?: string;
}

export interface PronunciationRow {
  letter: string;
  readUk: string;
  exampleSk: string;
  exampleUk: string;
}

export interface SignRow {
  nameSk: string;
  sign: string;
  meaningUk: string;
  examples: string[];
}

export interface CommonMistake {
  mistake: string;
  correct: string;
}

export interface DialogueLine {
  speaker: string;
  sk: string;
  uk: string;
}

export interface TheoryScreen {
  id: string;
  screenType: "theory";
  order: number;
  title?: LocalizedText;
  text?: LocalizedText;
  /** New multilingual format: equivalent of `text`. */
  body?: LocalizedText;
  examples?: TheoryExample[];
  focusPoints?: string[];
  alphabetRows?: string[][];
  alphabetGroups?: AlphabetGroup[];
  pronunciationRows?: PronunciationRow[];
  signs?: SignRow[];
  commonMistakes?: CommonMistake[];
  dialogue?: DialogueLine[];
  exampleSk?: string;
  exampleUk?: string;
  shortRule?: LocalizedText;
  button?: string;
}

export interface LessonStartScreen {
  screenType: "lesson_start";
  title?: LocalizedText;
  subtitle?: LocalizedText;
  shortDescription?: LocalizedText;
  outcomes?: string[];
  newWords?: string[];
  exercisesCount?: number;
  reward?: string;
  iconEmoji?: string;
  button?: string;
  /** New multilingual format. */
  imageRef?: string;
  eyebrow?: LocalizedText;
  goal?: LocalizedText;
  estimatedMinutes?: number;
}

export interface LessonWordsScreenItem {
  wordId?: string;
  sk: string;
  uk: string;
  pronunciationUk?: string;
  exampleSk?: string;
  exampleUk?: string;
}

export interface LessonWordsScreen {
  screenType?: "lesson_words";
  title?: LocalizedText;
  description?: LocalizedText;
  /** New multilingual format: equivalent of `description`. */
  subtitle?: LocalizedText;
  /** Legacy format only — new-format words come from `Lesson.words` directly. */
  items?: LessonWordsScreenItem[];
  button?: string;
}

export interface FinalSituation {
  screenType: "final_life_situation";
  scenario: string;
  question: string;
  options: string[];
  correctAnswer: string;
  translation?: string;
  explanation?: string;
  button?: string;
}

export interface FinalSituationStepOption {
  sk?: string;
  text?: LocalizedText;
  correct: boolean;
}

export interface FinalSituationStep {
  id: string;
  prompt: LocalizedText;
  options: FinalSituationStepOption[];
}

/** New multilingual format: a multi-step interactive scenario instead of a single question. */
export interface FinalSituationInteractive {
  id?: string;
  type: "interactive_scenario";
  title?: LocalizedText;
  description?: LocalizedText;
  imageRef?: string;
  steps: FinalSituationStep[];
  /** e.g. "3/4" — fraction of steps that must be answered correctly to pass. */
  passRequirement?: string;
  successMessage?: LocalizedText;
}

export interface LessonResultScreen {
  screenType?: "lesson_result";
  title?: LocalizedText;
  text?: LocalizedText;
  result?: string;
  newWordsCount?: number;
  exercisesCompleted?: number;
  nowYouKnow?: string[];
  mistakesMessage?: string;
  buttons?: string[];
  nextLesson?: string | { id: string; title?: LocalizedText };
  /** New multilingual format. */
  subtitle?: LocalizedText;
  xpReward?: number;
  skills?: { id: string; label: LocalizedText; weight: number }[];
}

export interface LessonImageAsset {
  src: string;
  alt?: LocalizedText;
}

export interface LessonAudioAsset {
  src: string;
  transcript?: string;
}

export interface Lesson {
  id: string;
  level: UserLevel;
  title: LocalizedText;
  description: LocalizedText;
  topic: LocalizedText;
  order: number;
  xpReward: number;
  estimatedMinutes: number;
  isPublished: boolean;
  isLocked?: boolean;
  createdBy?: string;
  intro?: LocalizedText;
  words: Word[];
  exercises: Exercise[];
  completionMessage?: LocalizedText;
  updatedAt: string;
  startScreen?: LessonStartScreen;
  theoryScreens?: TheoryScreen[];
  wordsScreen?: LessonWordsScreen;
  finalSituation?: FinalSituation | FinalSituationInteractive;
  resultScreen?: LessonResultScreen;
  /** New multilingual format. */
  sectionId?: string;
  localization?: {
    uiLanguages?: Locale[];
    targetLanguage?: string;
    fallbackUiLanguage?: Locale;
  };
  assets?: {
    images?: Record<string, LessonImageAsset>;
    audio?: Record<string, LessonAudioAsset>;
  };
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
