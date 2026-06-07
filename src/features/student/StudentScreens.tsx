import { useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, BookOpen, CheckCircle2, ChevronLeft, Flame, Heart, Lock, Medal, Search, Settings, Star, Trophy, Volume2, Zap } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { Button, Card, EmptyState, Field, Modal, PageHeader, ProgressBar } from "../../components/ui";
import { apiClient } from "../../services/apiClient";
import { leaderboardService } from "../../services/leaderboardService";
import { lessonService } from "../../services/lessonService";
import { practiceService, type PracticeExercise, type PracticeType } from "../../services/practiceService";
import { progressService } from "../../services/progressService";
import { vocabularyService, type VocabularyWord } from "../../services/vocabularyService";
import { selectCurrentUser, useAppStore } from "../../store/useAppStore";
import { useT } from "../../i18n";
import type { AnswerRecord, Exercise, UserLevel } from "../../types";
import { formatWeekTimer, secondsUntilWeekEnd } from "../../utils/date";

function useWeekTimer(): number {
  const [seconds, setSeconds] = useState(() => secondsUntilWeekEnd());

  useEffect(() => {
    let offsetMs = 0;

    apiClient.serverTime()
      .then(({ updatedAt }) => {
        offsetMs = new Date(updatedAt).getTime() - Date.now();
        setSeconds(secondsUntilWeekEnd(new Date(Date.now() + offsetMs)));
      })
      .catch(() => undefined);

    const id = setInterval(() => {
      setSeconds(secondsUntilWeekEnd(new Date(Date.now() + offsetMs)));
    }, 1000);

    return () => clearInterval(id);
  }, []);

  return seconds;
}

function useStudentData() {
  const store = useAppStore();
  const user = selectCurrentUser(store.data, store.currentUserId);
  const progress = user ? store.data.progress[user.id] : undefined;
  return { ...store, user, progress };
}

function TopStats() {
  const { user, progress } = useStudentData();
  const { t } = useT();
  if (!user || !progress) return null;
  return (
    <div className="sticky-stats">
      <span>{progress.currentLevel}</span>
      <span><Zap size={16} /> {progress.xpTotal} XP</span>
      <span><Heart size={16} /> {progress.hearts}/{progress.maxHearts}</span>
      <span><Flame size={16} /> {progress.streakDays}</span>
      <Link to="/app/levels">{t("student.top_stats_level")}</Link>
    </div>
  );
}

export function StudentLayout() {
  const location = useLocation();
  return (
    <AppShell role="student">
      {location.pathname !== "/app/profile" ? <TopStats /> : null}
      <Routes>
        <Route path="/" element={<Navigate to="path" replace />} />
        <Route path="path" element={<PathScreen />} />
        <Route path="lesson/:lessonId" element={<LessonScreen />} />
        <Route path="vocabulary" element={<VocabularyScreen />} />
        <Route path="practice" element={<PracticeScreen />} />
        <Route path="leaderboard" element={<LeaderboardScreen />} />
        <Route path="shop" element={<ShopScreen />} />
        <Route path="profile" element={<ProfileScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="levels" element={<LevelsScreen />} />
      </Routes>
    </AppShell>
  );
}

export function Onboarding() {
  const navigate = useNavigate();
  const { user, completeOnboarding } = useStudentData();
  const { t, ta } = useT();
  const goals = ta("student.goals");
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(user?.goal || goals[0]);
  if (!user) return <Navigate to="/login" replace />;

  const cards = [
    <Card className="onboarding-card" key="welcome">
      <h1>{t("student.onboarding.welcome_title")}</h1>
      <p>{t("student.onboarding.welcome_text")}</p>
      <Button onClick={() => setStep(1)}>{t("student.onboarding.welcome_btn")}</Button>
    </Card>,
    <Card className="onboarding-card" key="goal">
      <h1>{t("student.onboarding.goal_title")}</h1>
      <div className="chip-grid">
        {goals.map((item) => <button className={`chip ${goal === item ? "active" : ""}`} key={item} type="button" onClick={() => setGoal(item)}>{item}</button>)}
      </div>
      <Button onClick={() => setStep(2)}>{t("student.onboarding.next")}</Button>
    </Card>,
    <Card className="onboarding-card" key="mechanics">
      <h1>{t("student.onboarding.mechanics_title")}</h1>
      <div className="mechanics-grid">
        {ta("student.onboarding.mechanics_items").map((item) => <span key={item}>{item}</span>)}
      </div>
      <Button onClick={() => setStep(3)}>{t("student.onboarding.mechanics_ok")}</Button>
    </Card>,
    <Card className="onboarding-card" key="start">
      <h1>{t("student.onboarding.start_title")}</h1>
      <Button onClick={() => { completeOnboarding(goal, "A0"); navigate("/app/path", { replace: true }); }}>{t("student.onboarding.start_a0")}</Button>
      <Button variant="secondary" onClick={() => navigate("/placement-test")}>{t("student.onboarding.placement")}</Button>
    </Card>
  ];

  return <main className="auth-screen onboarding-screen">{cards[step]}</main>;
}

export function PlacementTest() {
  const navigate = useNavigate();
  const { submitPlacement, completeOnboarding, user } = useStudentData();
  const { t, ta } = useT();
  const goals = ta("student.goals");
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [result, setResult] = useState<UserLevel | null>(null);
  const questions: Array<[string, string, boolean]> = [
    ["Dobrý deň", "добрий день", true],
    ["chlieb", "договір", false],
    ["Môžem platiť kartou?", "Можна оплатити карткою?", true],
    ["Kde je stanica?", "Де школа?", false],
    ["Je cena vrátane energií?", "Ціна включає комунальні?", true],
    ["Mám termín u lekára.", "У мене прийом у лікаря.", true],
    ["Žiadam o informáciu.", "Я прошу інформацію.", true],
    ["S pozdravom", "Без договору", false],
    ["Nesúhlasím s tým.", "Я не погоджуюся з цим.", true],
    ["Prikladám dokument.", "Я додаю документ.", true]
  ];
  if (!user) return <Navigate to="/login" replace />;
  const correct = Object.values(answers).filter(Boolean).length;

  return (
    <main className="page-content">
      <PageHeader title={t("student.placement.title")} subtitle={t("student.placement.subtitle")} />
      {!result ? (
        <Card>
          {questions.map(([sk, uk, ok], index) => (
            <div className="question-row" key={sk}>
              <p>{sk} = {uk}</p>
              <div>
                <button type="button" className={answers[index] === ok ? "chip active" : "chip"} onClick={() => setAnswers({ ...answers, [index]: ok })}>{t("student.placement.yes")}</button>
                <button type="button" className={answers[index] === !ok ? "chip active" : "chip"} onClick={() => setAnswers({ ...answers, [index]: !ok })}>{t("student.placement.no")}</button>
              </div>
            </div>
          ))}
          <Button onClick={() => setResult(submitPlacement(correct, questions.length))}>{t("student.placement.show_result")}</Button>
        </Card>
      ) : (
        <Card className="result-card">
          <h2>{t("student.placement.result_title")} {result}</h2>
          <Button onClick={() => { completeOnboarding(user.goal || goals[0], result); navigate("/app/path", { replace: true }); }}>{t("student.placement.start_level")}</Button>
          <Button variant="secondary" onClick={() => navigate("/app/levels")}>{t("student.placement.choose_level")}</Button>
        </Card>
      )}
    </main>
  );
}

function PathScreen() {
  const { data, user, progress } = useStudentData();
  const { t } = useT();
  if (!user || !progress) return null;
  const levelLessons = lessonService.byLevel(data.lessons, progress.currentLevel);
  const levelProgress = lessonService.levelProgress(data.lessons, progress, progress.currentLevel);
  const current = levelLessons.find((lesson) => lessonService.status(lesson, data.lessons, progress) === "current") || levelLessons.find((lesson) => lessonService.status(lesson, data.lessons, progress) === "available") || levelLessons[0];

  return (
    <main className="page-content">
      <PageHeader title={t("student.path.title")} subtitle={`${progress.currentLevel} · ${t(`student.level_desc.${progress.currentLevel}`)}`} />
      <Card className="level-card">
        <div>
          <h2>{progress.currentLevel}: {current?.topic || t("student.path.default_topic")}</h2>
          <p>{levelProgress}{t("student.path.progress_pct")}</p>
        </div>
        <ProgressBar value={levelProgress} />
        {current ? <Link className="btn btn-primary" to={`/app/lesson/${current.id}`}>{t("student.path.continue")}</Link> : null}
      </Card>
      <div className="lesson-list">
        {levelLessons.map((lesson) => {
          const status = lessonService.status(lesson, data.lessons, progress);
          return (
            <Card key={lesson.id} className={`lesson-card ${status}`}>
              <div className="lesson-icon">{status === "completed" ? <CheckCircle2 /> : status === "locked" ? <Lock /> : <BookOpen />}</div>
              <div className="lesson-copy">
                <h3>{lesson.title}</h3>
                <p>{lesson.topic} · {lesson.level} · {lesson.xpReward} XP · {lesson.estimatedMinutes} хв</p>
              </div>
              {status === "locked" ? <span className="status-pill">{t("student.path.locked")}</span> : <Link className="btn btn-secondary" to={`/app/lesson/${lesson.id}`}>{status === "completed" ? t("student.path.repeat") : t("student.path.lesson_start")}</Link>}
            </Card>
          );
        })}
      </div>
    </main>
  );
}

function ExerciseView({ exercise, answer, setAnswer, t }: { exercise: Exercise; answer: string | string[]; setAnswer: (value: string | string[]) => void; t: (key: string) => string }) {
  if (exercise.type === "match_pairs") {
    const selected = Array.isArray(answer) ? answer : [];
    return (
      <div className="chip-grid">
        {(exercise.correctAnswer as string[]).map((pair) => (
          <button key={pair} type="button" className={`chip ${selected.includes(pair) ? "active" : ""}`} onClick={() => setAnswer(selected.includes(pair) ? selected.filter((item) => item !== pair) : [...selected, pair])}>{pair.replace("|", " - ")}</button>
        ))}
      </div>
    );
  }
  if (exercise.type === "fill_blank" || exercise.type === "typing") {
    return <Field label={t("student.lesson.answer_label")} value={String(answer || "")} onChange={(event) => setAnswer(event.target.value)} />;
  }
  if (exercise.type === "sentence_ordering") {
    const selected = Array.isArray(answer) ? answer : [];
    return (
      <>
        <div className="answer-build">{selected.join(" ") || t("student.lesson.select_words")}</div>
        <div className="chip-grid">
          {(exercise.options || []).map((option) => <button className="chip" key={option} type="button" onClick={() => setAnswer([...selected, option])}>{option}</button>)}
        </div>
      </>
    );
  }
  return (
    <div className="option-list">
      {(exercise.options || []).map((option) => <button className={`option ${answer === option ? "active" : ""}`} type="button" key={option} onClick={() => setAnswer(option)}>{option}</button>)}
      {exercise.type === "audio_choice" && <p className="hint-text">{t("student.lesson.audio_hint")}</p>}
    </div>
  );
}

function LessonScreen() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const { data, user, progress, completeLesson, recordWrongAnswer, restoreHearts } = useStudentData();
  const { t } = useT();
  const lesson = data.lessons.find((item) => item.id === lessonId);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<string | string[]>("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  if (!user || !progress || !lesson) return <Navigate to="/app/path" replace />;
  const activeLesson = lesson;
  const exercise = activeLesson.exercises[index];
  if (!exercise) return <Navigate to="/app/path" replace />;
  const percent = Math.round((index / activeLesson.exercises.length) * 100);

  function check() {
    const correct = progressService.check(exercise, answer);
    const record = { exerciseId: exercise.id, answer, correct, answeredAt: new Date().toISOString() };
    setRecords((items) => [...items.filter((item) => item.exerciseId !== exercise.id), record]);
    setFeedback(correct ? "correct" : "wrong");
    if (!correct) recordWrongAnswer(activeLesson, exercise.id, String(answer));
  }

  function next() {
    const nextIndex = index + 1;
    if (nextIndex >= activeLesson.exercises.length) {
      completeLesson(activeLesson, records);
      navigate("/app/path");
      return;
    }
    setIndex(nextIndex);
    setAnswer("");
    setFeedback(null);
  }

  return (
    <main className="lesson-screen">
      <div className="lesson-top">
        <button type="button" onClick={() => navigate("/app/path")}><ChevronLeft /></button>
        <ProgressBar value={percent} />
        <span><Heart size={18} /> {progress.hearts}</span>
      </div>
      <Card className="exercise-card">
        <p className="lesson-topic">{lesson.topic}</p>
        <h1>{exercise.question}</h1>
        <ExerciseView exercise={exercise} answer={answer} setAnswer={setAnswer} t={t} />
      </Card>
      <div className={`lesson-feedback ${feedback || ""}`}>
        {feedback === "correct" ? t("student.lesson.correct") : null}
        {feedback === "wrong" ? `${t("student.lesson.wrong_prefix")} ${Array.isArray(exercise.correctAnswer) ? exercise.correctAnswer.join(", ") : exercise.correctAnswer}. ${exercise.explanation || ""}` : null}
      </div>
      <div className="lesson-bottom">
        {!feedback ? <Button disabled={!answer || (Array.isArray(answer) && !answer.length)} onClick={check}>{t("student.lesson.check")}</Button> : <Button onClick={next}>{index + 1 >= lesson.exercises.length ? t("student.lesson.finish") : t("student.lesson.next")}</Button>}
      </div>
      {progress.hearts <= 0 ? (
        <Modal>
          <Card className="modal-card">
            <Heart size={40} color="var(--red)" />
            <h1>{t("student.lesson.no_hearts_title")}</h1>
            <p>{t("student.lesson.no_hearts_text")}</p>
            <Button onClick={() => navigate("/app/path")}>{t("student.lesson.back_to_path")}</Button>
            <Button variant="secondary" onClick={restoreHearts}>{t("student.lesson.try_again")}</Button>
            <Button variant="ghost" onClick={() => navigate("/app/shop")}>{t("student.lesson.go_plus")}</Button>
          </Card>
        </Modal>
      ) : null}
    </main>
  );
}

function VocabularyScreen() {
  const { data, user, toggleFavorite } = useStudentData();
  const { t } = useT();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"alpha" | "level" | "topic" | "date">("alpha");
  const [groupBy, setGroupBy] = useState<"none" | "topic" | "level">("none");
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { setVisibleCount(30); }, [filter, query, sort]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || groupBy !== "none") return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount((n) => n + 20); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [groupBy, filter, query, sort]);

  if (!user) return null;

  function playWord(word: VocabularyWord) {
    if (!user?.settings.soundEnabled || !word.audioUrl) return;
    audioRef.current?.pause();
    const audio = new Audio(word.audioUrl);
    audioRef.current = audio;
    setPlayingId(word.id);
    audio.play();
    audio.onended = () => setPlayingId(null);
  }

  const allWords = vocabularyService.build(data.lessons, data.userWords[user.id]);
  const filtered = vocabularyService.filter(allWords, filter, query);
  const sorted = vocabularyService.sort(filtered, sort);

  const filterLabels: Record<string, string> = {
    all: t("student.vocabulary.filter_all"),
    new: t("student.vocabulary.filter_new"),
    practicing: t("student.vocabulary.filter_practicing"),
    mastered: t("student.vocabulary.filter_mastered"),
    favorite: t("student.vocabulary.filter_favorite"),
    review: t("student.vocabulary.filter_review"),
  };
  const sortKeys = ["alpha", "level", "topic", "date"] as const;
  const groupKeys = ["none", "topic", "level"] as const;

  function renderCard(word: VocabularyWord) {
    return (
      <Card key={word.id} className="word-card word-card--interactive" onClick={() => setSelectedWord(word)}>
        <div className="word-card-main">
          <div className="word-card-content">
            <h3>{word.sk}</h3>
            <p className="word-uk">{word.uk}</p>
            {word.exampleSk && <small>{word.exampleSk}</small>}
          </div>
          <div className="word-card-actions">
            {word.audioUrl && (
              <button type="button" className={`icon-button ${playingId === word.id ? "active" : ""}`}
                onClick={(e) => { e.stopPropagation(); playWord(word); }}>
                <Volume2 size={18} />
              </button>
            )}
            <button type="button" className={`icon-button ${word.favorite ? "active" : ""}`}
              onClick={(e) => { e.stopPropagation(); toggleFavorite(word.id); }}>
              <Star size={19} />
            </button>
          </div>
        </div>
        <div className="word-card-footer">
          <span className="status-pill">{t(`student.word_status.${word.status}`)}</span>
          <span className="word-meta">{word.topic} · {word.level}</span>
          {word.mistakeCount > 0 && (
            <span className="word-mistakes"><AlertCircle size={12} /> {word.mistakeCount}</span>
          )}
        </div>
      </Card>
    );
  }

  return (
    <main className="page-content">
      <PageHeader title={t("student.vocabulary.title")} subtitle={t("student.vocabulary.subtitle")} />
      <div className="search-box">
        <Search size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("student.vocabulary.search")} />
      </div>
      <div className="vocab-controls">
        <div className="filter-row">
          {Object.keys(filterLabels).map((item) => (
            <button className={`chip ${filter === item ? "active" : ""}`} type="button" key={item} onClick={() => setFilter(item)}>
              {filterLabels[item]}
            </button>
          ))}
        </div>
        <div className="filter-row">
          {sortKeys.map((s) => (
            <button className={`chip chip--sm ${sort === s ? "active" : ""}`} type="button" key={s} onClick={() => setSort(s)}>
              {t(`student.vocabulary.sort_${s}`)}
            </button>
          ))}
        </div>
        <div className="filter-row">
          {groupKeys.map((g) => (
            <button className={`chip chip--sm ${groupBy === g ? "active" : ""}`} type="button" key={g} onClick={() => setGroupBy(g)}>
              {t(`student.vocabulary.group_${g}`)}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 && (
        <EmptyState title={t("student.vocabulary.empty_title")} text={t("student.vocabulary.empty_text")} />
      )}

      <div className="word-grid">
        {groupBy === "none"
          ? sorted.slice(0, visibleCount).map(renderCard)
          : vocabularyService.group(sorted, groupBy).flatMap(({ label, words }) => [
            <div key={`g-${label}`} className="word-group-header" role="heading" aria-level={2}>{label}</div>,
            ...words.map(renderCard),
          ])
        }
        {groupBy === "none" && visibleCount < sorted.length && <div ref={sentinelRef} />}
      </div>

      {selectedWord && (
        <Modal>
          <Card className="modal-card word-detail">
            <div className="word-detail-header">
              <div>
                <h2>{selectedWord.sk}</h2>
                {selectedWord.transcription && (
                  <span className="word-transcription">[{selectedWord.transcription}]</span>
                )}
                <p className="word-uk">{selectedWord.uk}</p>
              </div>
              {selectedWord.audioUrl && (
                <button type="button" className={`icon-button ${playingId === selectedWord.id ? "active" : ""}`}
                  onClick={() => playWord(selectedWord)}>
                  <Volume2 size={22} />
                </button>
              )}
            </div>
            {(selectedWord.exampleSk || selectedWord.exampleUk) && (
              <div className="word-detail-example">
                {selectedWord.exampleSk && <p>{selectedWord.exampleSk}</p>}
                {selectedWord.exampleUk && <p className="muted">{selectedWord.exampleUk}</p>}
              </div>
            )}
            <div className="word-detail-meta">
              <span className="status-pill">{t(`student.word_status.${selectedWord.status}`)}</span>
              <span className="status-pill">{selectedWord.level}</span>
              <span className="status-pill">{selectedWord.topic}</span>
            </div>
            {(selectedWord.mistakeCount > 0 || selectedWord.correctCount > 0) && (
              <div className="word-detail-stats">
                <span>✓ {selectedWord.correctCount}</span>
                <span>✗ {selectedWord.mistakeCount}</span>
              </div>
            )}
            <Button onClick={() => { setSelectedWord(null); navigate("/app/practice"); }}>
              {t("student.vocabulary.detail_train")}
            </Button>
            <Button variant="ghost" onClick={() => setSelectedWord(null)}>
              {t("student.vocabulary.detail_close")}
            </Button>
          </Card>
        </Modal>
      )}
    </main>
  );
}

function PracticeScreen() {
  const { data, user, progress, finishPracticeSession } = useStudentData();
  const { t } = useT();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<"landing" | "session" | "results">("landing");
  const [sessionCount, setSessionCount] = useState<5 | 10 | 15>(10);
  const [types, setTypes] = useState<Set<PracticeType>>(() => new Set<PracticeType>(["translation"]));
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [exercises, setExercises] = useState<PracticeExercise[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<string | string[]>("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [countdown, setCountdown] = useState(20);
  const [sessionAnswers, setSessionAnswers] = useState<{ wordId: string; correct: boolean }[]>([]);
  const feedbackRef = useRef<"correct" | "wrong" | null>(null);
  const timerIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { feedbackRef.current = feedback; }, [feedback]);

  useEffect(() => {
    if (!timerEnabled || phase !== "session") return;
    setCountdown(20);
    timerIdRef.current = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          if (timerIdRef.current) { clearInterval(timerIdRef.current); timerIdRef.current = null; }
          if (feedbackRef.current === null) {
            setSessionAnswers((sa) => [...sa, { wordId: exercises[index]?.wordId ?? "", correct: false }]);
            setFeedback("wrong");
          }
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => { if (timerIdRef.current) { clearInterval(timerIdRef.current); timerIdRef.current = null; } };
  }, [index, timerEnabled, phase, exercises]);

  if (!user || !progress) return null;

  const allWords = vocabularyService.build(data.lessons, data.userWords[user.id]);
  const weakWords = allWords.filter((w) => w.status === "practicing" || w.mistakeCount > 0);
  const topicGroups = vocabularyService.group(weakWords, "topic");

  function toggleType(type: PracticeType) {
    setTypes((prev) => {
      if (prev.has(type) && prev.size === 1) return prev;
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  function startSession() {
    const ex = practiceService.generate(weakWords, allWords, sessionCount, types);
    setExercises(ex);
    setIndex(0);
    setSessionAnswers([]);
    setAnswer("");
    setFeedback(null);
    setPhase("session");
  }

  // ── LANDING ────────────────────────────────────────────────────────────────
  if (phase === "landing") {
    const practiceCount = Math.min(sessionCount, weakWords.length * types.size);
    return (
      <main className="page-content">
        <PageHeader title={t("student.practice.title")} subtitle={`${weakWords.length} ${t("student.practice.words_count")}`} />
        {weakWords.length === 0 ? (
          <EmptyState title={t("student.practice.empty_title")} text={t("student.practice.empty_text")} />
        ) : (
          <>
            <Card>
              <h3>{t("student.practice.settings_title")}</h3>
              <div className="practice-settings">
                <div className="practice-settings-row">
                  <label>{t("student.practice.count_label")}</label>
                  <div className="filter-row">
                    {([5, 10, 15] as const).map((n) => (
                      <button key={n} type="button" className={`chip chip--sm ${sessionCount === n ? "active" : ""}`} onClick={() => setSessionCount(n)}>{n}</button>
                    ))}
                  </div>
                </div>
                <div className="practice-settings-row">
                  <label>{t("student.practice.types_label")}</label>
                  <div className="filter-row">
                    {(["translation", "reverse", "typing"] as const).map((type) => (
                      <button key={type} type="button" className={`chip chip--sm ${types.has(type) ? "active" : ""}`} onClick={() => toggleType(type)}>
                        {t(`student.practice.type_${type}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="toggle-row">
                  <span>{t("student.practice.timer_label")}</span>
                  <input type="checkbox" checked={timerEnabled} onChange={(e) => setTimerEnabled(e.target.checked)} />
                </label>
              </div>
            </Card>

            {topicGroups.map(({ label, words }) => (
              <div key={label}>
                <div className="word-group-header">{label}</div>
                <div className="word-mini-list">
                  {words.map((w) => <span key={w.id}>{w.sk} — {w.uk}</span>)}
                </div>
              </div>
            ))}

            <Button onClick={startSession}>
              {t("student.practice.start_btn").replace("{count}", String(practiceCount))}
            </Button>
          </>
        )}
      </main>
    );
  }

  // ── SESSION ────────────────────────────────────────────────────────────────
  if (phase === "session") {
    const practiceEx = exercises[index];
    if (!practiceEx) return null;
    const { exercise } = practiceEx;
    const isLast = index === exercises.length - 1;
    const percent = Math.round((index / exercises.length) * 100);
    const wordTopic = allWords.find((w) => w.id === practiceEx.wordId)?.topic ?? "";

    function check() {
      if (timerIdRef.current) { clearInterval(timerIdRef.current); timerIdRef.current = null; }
      const correct = progressService.check(exercise, answer);
      setSessionAnswers((prev) => [...prev, { wordId: practiceEx.wordId, correct }]);
      setFeedback(correct ? "correct" : "wrong");
    }

    function next() {
      if (isLast) {
        finishPracticeSession(sessionAnswers);
        setPhase("results");
      } else {
        setIndex((i) => i + 1);
        setAnswer("");
        setFeedback(null);
      }
    }

    return (
      <main className="lesson-screen">
        <div className="lesson-top">
          <button type="button" onClick={() => setPhase("landing")}><ChevronLeft /></button>
          <ProgressBar value={percent} />
          {timerEnabled && <span className="practice-timer">{countdown}</span>}
        </div>
        <Card className="exercise-card">
          <p className="lesson-topic">{wordTopic}</p>
          <h1>{exercise.question}</h1>
          <ExerciseView exercise={exercise} answer={answer} setAnswer={setAnswer} t={t} />
        </Card>
        <div className={`lesson-feedback ${feedback ?? ""}`}>
          {feedback === "correct" && t("student.lesson.correct")}
          {feedback === "wrong" && `${t("student.lesson.wrong_prefix")} ${Array.isArray(exercise.correctAnswer) ? exercise.correctAnswer.join(", ") : exercise.correctAnswer}.`}
        </div>
        <div className="lesson-bottom">
          {!feedback
            ? <Button disabled={!answer || (Array.isArray(answer) && !answer.length)} onClick={check}>{t("student.lesson.check")}</Button>
            : <Button onClick={next}>{isLast ? t("student.lesson.finish") : t("student.lesson.next")}</Button>
          }
        </div>
      </main>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────────────
  const correctCount = sessionAnswers.filter((a) => a.correct).length;
  const total = sessionAnswers.length;

  return (
    <main className="page-content">
      <PageHeader title={t("student.practice.results_title")} />
      <Card className="result-card">
        <Trophy size={48} color="var(--yellow-strong)" />
        <h2>+5 XP</h2>
        <p>{correctCount} / {total} {t("student.practice.results_correct")}</p>
      </Card>
      <Card>
        <h3>{t("student.practice.results_words")}</h3>
        <div className="practice-results-list">
          {sessionAnswers.map(({ wordId, correct }, i) => {
            const word = allWords.find((w) => w.id === wordId);
            return (
              <div key={`${wordId}-${i}`} className="practice-result-word">
                <span className={correct ? "correct-mark" : "wrong-mark"}>{correct ? "✓" : "✗"}</span>
                <span>{word?.sk}</span>
                <span className="word-meta">{word?.uk}</span>
              </div>
            );
          })}
        </div>
      </Card>
      <Button onClick={() => setPhase("landing")}>{t("student.practice.results_repeat")}</Button>
      <Button variant="ghost" onClick={() => navigate("/app/path")}>{t("student.practice.results_home")}</Button>
    </main>
  );
}

function LeaderboardScreen() {
  const { data, user, progress } = useStudentData();
  const { t } = useT();
  const weekSeconds = useWeekTimer();
  const leaderboard = leaderboardService.recalculate(data.leaderboard, data.users, data.progress);
  const current = user ? leaderboard.entries.find((entry) => entry.userId === user.id) : undefined;
  return (
    <main className="page-content">
      <PageHeader title={t("student.leaderboard.title")} subtitle={`${t(`student.league.${leaderboard.league}`)} · ${t("student.leaderboard.timer_prefix")} ${formatWeekTimer(weekSeconds)}`} />
      <Card className="leader-header">
        <span>{t("student.leaderboard.your_rank")} {current?.rank || "-"}</span>
        <span>{progress?.xpWeekly || 0} {t("student.leaderboard.weekly_xp")}</span>
      </Card>
      <div className="podium">
        {leaderboard.entries.slice(0, 3).map((entry) => <Card key={entry.userId} className={`podium-card rank-${entry.rank}`}><Medal /><strong>{entry.rank}. {entry.name}</strong><span>{entry.xpWeekly} XP</span></Card>)}
      </div>
      <Card>
        {leaderboard.entries.map((entry) => <div className={`leader-row ${entry.userId === user?.id ? "me" : ""}`} key={entry.userId}><span>{entry.rank}</span><strong>{entry.name}</strong><span>{entry.xpWeekly} XP</span></div>)}
      </Card>
    </main>
  );
}

function ProfileScreen() {
  const navigate = useNavigate();
  const { user, progress, data, logout } = useStudentData();
  const { t } = useT();
  if (!user || !progress) return null;
  const words = vocabularyService.build(data.lessons, data.userWords[user.id]);
  return (
    <>
      <div className="profile-hero">
        <div className="profile-hero-info">
          <div className="avatar">{user.avatar || user.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <h2>{user.name}</h2>
            <div className="profile-hero-meta">
              <span className="status-pill">{user.level}</span>
              <span className="status-pill">{t(`student.subscription.${user.subscriptionStatus}`)}</span>
            </div>
          </div>
        </div>
        <button type="button" className="icon-button" onClick={() => navigate("/app/settings")} aria-label={t("student.settings.title")}>
          <Settings size={20} />
        </button>
      </div>
      <div className="page-content">
        <div className="stats-grid">
          <Card><Flame /><strong>{progress.streakDays}</strong><span>{t("student.profile.stat_streak")}</span></Card>
          <Card><Heart /><strong>{progress.hearts}</strong><span>{t("student.profile.stat_hearts")}</span></Card>
          <Card><Zap /><strong>{progress.xpTotal}</strong><span>{t("student.profile.stat_xp")}</span></Card>
          <Card><BookOpen /><strong>{progress.completedLessons.length}</strong><span>{t("student.profile.stat_lessons")}</span></Card>
          <Card><Star /><strong>{words.filter((word) => word.status === "mastered").length}</strong><span>{t("student.profile.stat_words")}</span></Card>
        </div>
        <Card>
          <p>{t("student.profile.goal_label")} {user.goal || t("student.profile.goal_empty")}</p>
        </Card>
        <div className="form-stack">
          <Button variant="secondary" onClick={() => navigate("/placement-test")}>{t("student.profile.btn_placement")}</Button>
          <Button variant="secondary" onClick={() => navigate("/app/levels")}>{t("student.profile.btn_levels")}</Button>
          <Button variant="secondary" onClick={() => navigate("/app/shop")}>{t("student.profile.btn_shop")}</Button>
          <Button variant="danger" onClick={logout}>{t("student.profile.btn_logout")}</Button>
        </div>
      </div>
    </>
  );
}

function SettingsScreen() {
  const { user, updateUser } = useStudentData();
  const { t } = useT();
  const [name, setName] = useState(user?.name || "");
  const [goal, setGoal] = useState(user?.goal || "");
  const [phone, setPhone] = useState(user?.settings.phone || "");
  if (!user) return null;
  return (
    <main className="page-content">
      <PageHeader title={t("student.settings.title")} subtitle={t("student.settings.subtitle")} />
      <Card className="form-stack">
        <Field label={t("student.settings.name")} value={name} onChange={(event) => setName(event.target.value)} />
        <Field label={t("student.settings.goal")} value={goal} onChange={(event) => setGoal(event.target.value)} />
        <Field label={t("student.settings.phone")} value={phone} onChange={(event) => setPhone(event.target.value)} />
        <label className="toggle-row"><input type="checkbox" defaultChecked={user.settings.notificationsEnabled} /> {t("student.settings.notifications")}</label>
        <label className="toggle-row"><input type="checkbox" defaultChecked={user.settings.soundEnabled} /> {t("student.settings.sound")}</label>
        <label className="toggle-row"><input type="checkbox" defaultChecked={user.settings.hapticsEnabled} /> {t("student.settings.haptics")}</label>
        <Button onClick={() => updateUser({ name, goal, settings: { ...user.settings, phone } })}>{t("student.settings.save")}</Button>
        <Button variant="secondary" disabled>{t("student.settings.install")}</Button>
        <Button variant="danger" disabled>{t("student.settings.delete_account")}</Button>
      </Card>
    </main>
  );
}

function LevelsScreen() {
  const { data, progress, setLevel } = useStudentData();
  const { t } = useT();
  const [pending, setPending] = useState<UserLevel | null>(null);
  if (!progress) return null;
  return (
    <main className="page-content">
      <PageHeader title={t("student.levels.title")} subtitle={t("student.levels.subtitle")} />
      {lessonService.levels.map((level) => {
        const percent = lessonService.levelProgress(data.lessons, progress, level);
        return <Card key={level} className="level-row"><div><h2>{level}</h2><p>{t(`student.level_desc.${level}`)}</p><ProgressBar value={percent} /></div><Button variant={progress.currentLevel === level ? "primary" : "secondary"} onClick={() => setPending(level)}>{progress.currentLevel === level ? t("student.levels.current") : t("student.levels.change")}</Button></Card>;
      })}
      {pending ? <div className="bottom-sheet"><Card><h2>{t("student.levels.confirm_title")}</h2><p>{t("student.levels.confirm_text")}</p><Button onClick={() => { setLevel(pending); setPending(null); }}>{t("student.levels.confirm")}</Button><Button variant="ghost" onClick={() => setPending(null)}>{t("student.levels.cancel")}</Button></Card></div> : null}
    </main>
  );
}

function ShopScreen() {
  const { t } = useT();
  return (
    <main className="page-content">
      <PageHeader title={t("student.shop.title")} subtitle={t("student.shop.subtitle")} />
      <Card className="shop-card">
        <Trophy size={38} />
        <h2>{t("student.shop.product")}</h2>
        <p>{t("student.shop.desc")}</p>
        <Button disabled>{t("student.shop.payment_disabled")}</Button>
        <p className="hint-text">{t("student.shop.payment_hint")}</p>
      </Card>
    </main>
  );
}
