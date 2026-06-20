import { useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, Bell, BookOpen, Camera, CheckCircle2, ChevronDown, ChevronLeft, Download, Flame, Heart, Layers, Link2, Lock, LogOut, Medal, MessageSquare, Play, Search, Settings, Share2, ShoppingBag, Star, Trophy, Users, Volume2, Zap } from "lucide-react";
import { AppShell } from "../../components/AppShell";
import { Button, Card, EmptyState, Field, Modal, PageHeader, ProgressBar } from "../../components/ui";
import { PageSkeleton } from "../../components/Skeleton";
import { apiClient } from "../../services/apiClient";
import { leaderboardService } from "../../services/leaderboardService";
import { lessonService } from "../../services/lessonService";
import { practiceService, type PracticeExercise, type PracticeType } from "../../services/practiceService";
import { srService } from "../../services/spacedRepetitionService";
import { progressService } from "../../services/progressService";
import { vocabularyService, type VocabularyWord } from "../../services/vocabularyService";
import { selectCurrentUser, selectIsPlus, useAppStore } from "../../store/useAppStore";
import { useT } from "../../i18n";
import type { AnswerRecord, Exercise, LeaderboardEntry, UserLevel } from "../../types";
import { getDailyPhrases, getScenarioForGoal } from "../../data/scenarios";
import { downloadCertificate } from "../../services/certificateService";
import { generateShareCard, shareOrDownloadCard } from "../../services/shareService";
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
  const isPlus = selectIsPlus(store.data, store.currentUserId);
  return { ...store, user, progress, isPlus };
}

function TopStats() {
  const { user, progress } = useStudentData();
  const { t } = useT();
  if (!user || !progress) return null;
  const today = new Date().toISOString().slice(0, 10);
  const todayXp = progress.xpDailyHistory?.[today] ?? 0;
  const streakAtRisk = progress.streakDays > 0 && todayXp === 0;
  return (
    <div className="sticky-stats">
      <div className="level-badge">{progress.currentLevel}</div>
      <div className="stat-chip xp"><Zap size={14} /> {progress.xpTotal} XP</div>
      <div className="stat-chip hearts"><Heart size={14} /> {progress.hearts}/{progress.maxHearts}</div>
      <div className={`stat-chip streak${streakAtRisk ? " at-risk" : ""}`}>
        <Flame size={14} /> {progress.streakDays}
        {progress.streakFreezeCount > 0 && <span className="freeze-badge">❄</span>}
      </div>
      <Link to="/app/levels" className="stat-chip level-link">{t("student.top_stats_level")}</Link>
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

  const handleNotifications = async () => {
    if ("Notification" in window) {
      await Notification.requestPermission();
    }
    setStep(3);
  };

  const cards = [
    <Card className="onboarding-card onboarding-card-anim" key="welcome">
      <div className="onboarding-icon-wrap">
        <MessageSquare size={32} color="var(--accent)" />
      </div>
      <h1>{t("student.onboarding.welcome_title")}</h1>
      <p className="onboarding-text">{t("student.onboarding.welcome_text")}</p>
      <Button className="onboarding-btn-primary" onClick={() => setStep(1)}>{t("student.onboarding.welcome_btn")}</Button>
    </Card>,
    <Card className="onboarding-card onboarding-card-anim" key="goal">
      <div className="onboarding-icon-wrap">
        <Trophy size={32} color="var(--yellow-dark)" />
      </div>
      <h1>{t("student.onboarding.goal_title")}</h1>
      <div className="onboarding-chip-list">
        {goals.map((item) => (
          <button 
            className={`onboarding-chip ${goal === item ? "active" : ""}`} 
            key={item} 
            type="button" 
            onClick={() => { setGoal(item); setTimeout(() => setStep(2), 300); }}
          >
            <CheckCircle2 size={18} className="check-icon" />
            <span>{item}</span>
          </button>
        ))}
      </div>
    </Card>,
    <Card className="onboarding-card onboarding-card-anim" key="mechanics">
      <div className="onboarding-icon-wrap">
        <Bell size={32} color="var(--orange)" />
      </div>
      <h1>Залишаємось на зв'язку 🔔</h1>
      <p className="onboarding-text">Я нагадуватиму тобі про коротке тренування щодня, щоб не втратити прогрес і серця.</p>
      <div className="mechanics-grid" style={{ marginBottom: 16 }}>
        {ta("student.onboarding.mechanics_items").map((item) => <span key={item}>{item}</span>)}
      </div>
      <Button className="onboarding-btn-primary" onClick={handleNotifications}>Дозволити сповіщення</Button>
      <Button variant="ghost" onClick={() => setStep(3)}>Можливо пізніше</Button>
    </Card>,
    <Card className="onboarding-card onboarding-card-anim" key="start">
      <div className="onboarding-icon-wrap">
        <Zap size={32} color="var(--green)" />
      </div>
      <h1>{t("student.onboarding.start_title")}</h1>
      <p className="onboarding-text">Не хвилюйся, рівень можна буде змінити в налаштуваннях.</p>
      <Button className="onboarding-btn-primary" onClick={() => { completeOnboarding(goal, "A0"); navigate("/app/path", { replace: true }); }}>
        {t("student.onboarding.start_a0")}
      </Button>
      <Button variant="secondary" onClick={() => navigate("/placement-test")}>
        {t("student.onboarding.placement")}
      </Button>
    </Card>
  ];

  return (
    <main className="auth-screen onboarding-screen">
      <div className="onboarding-nav">
        {step > 0 && (
          <button type="button" className="back-btn" onClick={() => setStep((s) => s - 1)} aria-label="Назад">
            <ChevronLeft size={18} />
          </button>
        )}
        <div className="step-dots">
          {cards.map((_, i) => <span key={i} className={`step-dot${i === step ? " active" : i < step ? " done" : ""}`} />)}
        </div>
      </div>
      {cards[step]}
    </main>
  );
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
  const navigate = useNavigate();
  if (!user || !progress) return <PageSkeleton />;

  const levelLessons = lessonService.byLevel(data.lessons, progress.currentLevel);
  const levelProgress = lessonService.levelProgress(data.lessons, progress, progress.currentLevel);
  const current = levelLessons.find((l) => lessonService.status(l, data.lessons, progress) === "current")
    || levelLessons.find((l) => lessonService.status(l, data.lessons, progress) === "available")
    || levelLessons[0];
  const scenario = getScenarioForGoal(user.goal);
  const dailyPhrases = getDailyPhrases(user.goal, 3);

  const today = new Date().toISOString().slice(0, 10);
  const todayXp = progress.xpDailyHistory?.[today] ?? 0;
  const dailyGoal = 20;
  const goalPct = Math.min(100, Math.round(todayXp / dailyGoal * 100));
  const goalDone = todayXp >= dailyGoal;
  const streakAtRisk = progress.streakDays > 0 && todayXp === 0;

  return (
    <main className="page-content">
      <PageHeader
        title={t("student.path.title")}
        subtitle={`${progress.currentLevel} · ${t(`student.level_desc.${progress.currentLevel}`)}`}
      />

      {/* Unit section header */}
      <div className="unit-card">
        <span className="progress-pill">{levelProgress}%</span>
        <h2>{progress.currentLevel}: {current?.topic || t("student.path.default_topic")}</h2>
        <p>{levelLessons.filter((l) => lessonService.status(l, data.lessons, progress) === "completed").length}/{levelLessons.length} {t("student.path.progress_pct")}</p>
      </div>

      {/* Daily goal bar */}
      <div className={`daily-goal${goalDone ? " daily-goal--done" : ""}`}>
        <div className="daily-goal-label">
          <Zap size={13} />
          <span>{goalDone ? "Ціль дня досягнута! 🎯" : `${todayXp} / ${dailyGoal} XP сьогодні`}</span>
        </div>
        <div className="daily-goal-track">
          <div className="daily-goal-fill" style={{ width: `${goalPct}%` }} />
        </div>
      </div>

      {/* Streak at-risk warning */}
      {streakAtRisk && (
        <div className="streak-risk-banner">
          <Flame size={16} />
          <div className="streak-risk-text">
            <strong>{progress.streakDays}-денний стрік під загрозою!</strong>
            {progress.streakFreezeCount > 0
              ? <span>Є заморозка ×{progress.streakFreezeCount} — пройди урок до кінця дня</span>
              : <span>Пройди будь-який урок щоб зберегти стрік</span>
            }
          </div>
        </div>
      )}

      {/* Visual lesson node path */}
      <div className="learning-path">
        {levelLessons.map((lesson, index) => {
          const status = lessonService.status(lesson, data.lessons, progress);
          const nodeClass = status === "current" ? "active" : status;
          const prevStatus = index > 0 ? lessonService.status(levelLessons[index - 1], data.lessons, progress) : null;
          const connectorClass = prevStatus === "completed" && status !== "locked" ? "done"
            : prevStatus === "completed" ? "next"
            : "";

          return (
            <div key={lesson.id} style={{ display: "contents" }}>
              {index > 0 && <div className={`connector${connectorClass ? ` ${connectorClass}` : ""}`} />}
              <div className="lesson-node-wrap">
                <button
                  type="button"
                  className={`lesson-node ${nodeClass}`}
                  onClick={() => status !== "locked" && navigate(`/app/lesson/${lesson.id}`)}
                  aria-label={lesson.title}
                >
                  {status === "completed" ? <CheckCircle2 size={22} />
                    : status === "locked" ? <Lock size={20} />
                    : <Play size={20} style={{ fill: "currentColor" }} />}
                </button>
                <div className={`lesson-node-label${status === "locked" ? " locked-label" : ""}`}>
                  <h3>{lesson.title}</h3>
                  <p>{lesson.topic} · {lesson.xpReward} XP · {lesson.estimatedMinutes} хв</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating lesson CTA */}
      {current && (
        <div className="floating-lesson">
          <div className="icon-circle"><BookOpen size={20} /></div>
          <div className="info">
            <h4>{current.title}</h4>
            <p>{current.topic} · {current.xpReward} XP</p>
          </div>
          <button type="button" className="btn-go" onClick={() => navigate(`/app/lesson/${current.id}`)}>
            {t("student.path.continue")}
          </button>
        </div>
      )}

      {/* Daily scenario phrases */}
      <Card className="scenario-card">
        <div className="scenario-header">
          <span className="scenario-badge">{t("student.path.scenario_label")}</span>
          <span className="scenario-title">{scenario.title}</span>
        </div>
        <ul className="scenario-phrases">
          {dailyPhrases.map((p, i) => (
            <li key={i} className="scenario-phrase">
              <span className="phrase-sk">{p.sk}</span>
              <span className="phrase-uk">{p.uk}</span>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}

function MatchPairsExercise({ exercise, setAnswer }: { exercise: Exercise; setAnswer: (value: string[]) => void }) {
  const pairs = (exercise.correctAnswer as string[]).map((p) => {
    const sep = p.indexOf("|");
    return { left: p.slice(0, sep), right: p.slice(sep + 1) };
  });
  const [rightItems] = useState(() => [...pairs.map((p) => p.right)].sort(() => Math.random() - 0.5));
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrongRight, setWrongRight] = useState<string | null>(null);

  useEffect(() => {
    if (matched.length === pairs.length && pairs.length > 0) setAnswer(matched);
  }, [matched, pairs.length, setAnswer]);

  function handleLeft(left: string) {
    if (matched.some((m) => m.startsWith(left + "|"))) return;
    setSelectedLeft((prev) => (prev === left ? null : left));
  }

  function handleRight(right: string) {
    if (!selectedLeft || matched.some((m) => m.endsWith("|" + right))) return;
    const expectedRight = pairs.find((p) => p.left === selectedLeft)?.right;
    if (expectedRight === right) {
      setMatched((prev) => [...prev, `${selectedLeft}|${right}`]);
      setSelectedLeft(null);
    } else {
      setWrongRight(right);
      setTimeout(() => { setWrongRight(null); setSelectedLeft(null); }, 500);
    }
  }

  return (
    <div className="match-grid">
      <div className="match-col">
        {pairs.map(({ left }) => {
          const isMatched = matched.some((m) => m.startsWith(left + "|"));
          return (
            <button key={left} type="button"
              className={`match-item${isMatched ? " matched" : selectedLeft === left ? " active" : ""}`}
              onClick={() => handleLeft(left)} disabled={isMatched}>
              {left}
            </button>
          );
        })}
      </div>
      <div className="match-col">
        {rightItems.map((right) => {
          const isMatched = matched.some((m) => m.endsWith("|" + right));
          return (
            <button key={right} type="button"
              className={`match-item${isMatched ? " matched" : wrongRight === right ? " wrong" : ""}`}
              onClick={() => handleRight(right)} disabled={isMatched}>
              {right}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExerciseView({ exercise, answer, setAnswer, t }: { exercise: Exercise; answer: string | string[]; setAnswer: (value: string | string[]) => void; t: (key: string) => string }) {
  if (exercise.type === "match_pairs") {
    return <MatchPairsExercise key={exercise.id} exercise={exercise} setAnswer={(v) => setAnswer(v)} />;
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

const CONFETTI_COLORS = ["#6f57e8", "#ffd21f", "#2fba7f", "#e93d45", "#ff5a2e", "#3b82f6", "#a855f7"];

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
  const [celebration, setCelebration] = useState<{ xp: number; correct: number; total: number } | null>(null);
  const [sharing, setSharing] = useState(false);
  const hasIntro = !!(lesson?.intro || (lesson?.words?.length ?? 0) > 0);
  const [phase, setPhase] = useState<"intro" | "exercise">(() => hasIntro ? "intro" : "exercise");
  if (!user || !progress || !lesson) return <Navigate to="/app/path" replace />;
  const activeLesson = lesson;
  const exercise = activeLesson.exercises[index];
  if (!exercise && !celebration && phase === "exercise") return <Navigate to="/app/path" replace />;
  const percent = phase === "intro" ? 0 : (exercise ? Math.round((index / activeLesson.exercises.length) * 100) : 100);
  const questionLabel = phase === "intro" ? `${lesson.words.length} слів` : (exercise ? `${index + 1} / ${activeLesson.exercises.length}` : "");

  function check() {
    const correct = progressService.check(exercise, answer);
    const record = { exerciseId: exercise.id, answer, correct, answeredAt: new Date().toISOString() };
    setRecords((items) => [...items.filter((item) => item.exerciseId !== exercise.id), record]);
    setFeedback(correct ? "correct" : "wrong");
    if (!correct) recordWrongAnswer(activeLesson, exercise.id, String(answer));
  }

  function next() {
    const nextIndex = index + 1;
    const finalRecords = [...records.filter((item) => item.exerciseId !== exercise.id), { exerciseId: exercise.id, answer, correct: feedback === "correct", answeredAt: new Date().toISOString() }];
    if (nextIndex >= activeLesson.exercises.length) {
      completeLesson(activeLesson, finalRecords);
      const alreadyDone = progress!.completedLessons.includes(activeLesson.id);
      const base = alreadyDone ? Math.max(3, Math.round(activeLesson.xpReward * 0.25)) : activeLesson.xpReward;
      const xp = user!.subscriptionStatus === "plus" ? Math.round(base * 1.5) : base;
      const correct = finalRecords.filter((r) => r.correct).length;
      setCelebration({ xp, correct, total: finalRecords.length });
      return;
    }
    setIndex(nextIndex);
    setAnswer("");
    setFeedback(null);
  }

  return (
    <main className="lesson-screen">
      <div className="lesson-top">
        <button type="button" onClick={() => navigate("/app/path")} aria-label="Назад"><ChevronLeft /></button>
        <ProgressBar value={percent} />
        <div className="lesson-top-right">
          <span className="question-counter">{questionLabel}</span>
          <span className="lesson-hearts-chip"><Heart size={15} /> {progress.hearts}</span>
        </div>
      </div>

      {phase === "intro" ? (
        <>
          <div className="lesson-intro-card">
            {lesson.intro && <p className="lesson-intro-text">{lesson.intro}</p>}
            {lesson.words.length > 0 && (
              <div className="lesson-words-list">
                {lesson.words.map((word) => (
                  <div key={word.id} className="lesson-word-item">
                    <div className="lesson-word-row">
                      <span className="lesson-word-sk">{word.sk}</span>
                      <span className="lesson-word-uk">{word.uk}</span>
                    </div>
                    {word.exampleSk && (
                      <div className="lesson-word-example">{word.exampleSk} — {word.exampleUk}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="lesson-feedback" />
          <div className="lesson-bottom">
            <Button onClick={() => setPhase("exercise")}>Почати урок →</Button>
          </div>
        </>
      ) : (
        <>
          <Card className="exercise-card">
            <p className="lesson-topic">{lesson.topic}</p>
            <h1>{exercise?.question}</h1>
            <ExerciseView key={exercise?.id} exercise={exercise!} answer={answer} setAnswer={setAnswer} t={t} />
          </Card>
          <div className={`lesson-feedback ${feedback || ""}`}>
            {feedback === "correct" ? t("student.lesson.correct") : null}
            {feedback === "wrong" ? `${t("student.lesson.wrong_prefix")} ${Array.isArray(exercise?.correctAnswer) ? (exercise!.correctAnswer as string[]).join(", ") : exercise?.correctAnswer}. ${exercise?.explanation || ""}` : null}
          </div>
          <div className="lesson-bottom">
            {!feedback
              ? <Button disabled={!answer || (Array.isArray(answer) && !answer.length)} onClick={check}>{t("student.lesson.check")}</Button>
              : <Button autoFocus onClick={next}>{index + 1 >= lesson.exercises.length ? t("student.lesson.finish") : t("student.lesson.next")}</Button>
            }
          </div>
        </>
      )}
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
      {celebration && (
        <div className="lesson-celebrate">
          {Array.from({ length: 22 }, (_, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={{
                left: `${(i / 22) * 100}%`,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                "--delay": `${(i * 0.07).toFixed(2)}s`,
                "--dur": `${1.4 + (i % 5) * 0.18}s`,
              } as React.CSSProperties}
            />
          ))}
          <div className="celebrate-card">
            <div className="celebrate-icon">🎉</div>
            <div className="celebrate-xp">+{celebration.xp} XP</div>
            <p className="celebrate-sub">{celebration.correct} / {celebration.total} правильно</p>
            <button
              type="button"
              className="celebrate-share-btn"
              disabled={sharing}
              onClick={async () => {
                setSharing(true);
                try {
                  const blob = await generateShareCard({ xp: celebration.xp, label: "в цьому уроці", streakDays: progress.streakDays, userName: user.name, correctCount: celebration.correct, totalCount: celebration.total });
                  await shareOrDownloadCard(blob, `Я щойно пройшов урок у Slovak Life! +${celebration.xp} XP`);
                } finally { setSharing(false); }
              }}
            >
              <Share2 size={16} /> {sharing ? "…" : "Поділитись"}
            </button>
            <Button autoFocus onClick={() => navigate("/app/path")}>Продовжити</Button>
          </div>
        </div>
      )}
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
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  if (!user) return <PageSkeleton />;

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
          {Object.keys(filterLabels).map((item) => {
            const savedCount = item === "favorite" ? allWords.filter((w) => w.favorite).length : 0;
            return (
              <button className={`chip ${filter === item ? "active" : ""}`} type="button" key={item} onClick={() => setFilter(item)}>
                {filterLabels[item]}{item === "favorite" && savedCount > 0 ? ` · ${savedCount}` : ""}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="filter-advanced-btn"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          <span>{t(`student.vocabulary.sort_${sort}`)} · {t(`student.vocabulary.group_${groupBy}`)}</span>
          <ChevronDown size={13} className={showAdvanced ? "icon-rotate" : ""} />
        </button>
        {showAdvanced && (
          <>
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
          </>
        )}
      </div>

      {sorted.length === 0 && (
        <EmptyState
          title={filter === "favorite" ? t("student.vocabulary.empty_saved_title") : t("student.vocabulary.empty_title")}
          text={filter === "favorite" ? t("student.vocabulary.empty_saved_text") : t("student.vocabulary.empty_text")}
        />
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

  if (!user || !progress) return <PageSkeleton />;

  const isPlus = user.subscriptionStatus === "plus";
  const xpEarned = isPlus ? 8 : 5;
  const allWords = vocabularyService.build(data.lessons, data.userWords[user.id]);
  const dueCount = srService.dueCount(allWords);
  const dueWords = allWords.filter(
    (w) => w.status !== "mastered" && w.nextReviewAt != null && w.nextReviewAt.slice(0, 10) <= new Date().toISOString().slice(0, 10)
  );

  function toggleType(type: PracticeType) {
    setTypes((prev) => {
      if (prev.has(type) && prev.size === 1) return prev;
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  // Build mistake exercises from recent wrong answers
  const recentMistakeExercises: PracticeExercise[] = (() => {
    const seen = new Set<string>();
    const result: PracticeExercise[] = [];
    const sorted = [...progress.mistakes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const m of sorted) {
      if (seen.has(m.exerciseId)) continue;
      seen.add(m.exerciseId);
      const lesson = data.lessons.find((l) => l.id === m.lessonId);
      const exercise = lesson?.exercises.find((e) => e.id === m.exerciseId);
      if (exercise) result.push({ exercise, wordId: exercise.wordIds?.[0] ?? "" });
      if (result.length >= 15) break;
    }
    return result;
  })();

  function startSession() {
    // SR-ordered word selection: due/overdue first, then mistakes, then new
    const adaptiveWords = srService.selectWords(allWords, sessionCount);
    const ex = practiceService.generate(adaptiveWords, allWords, sessionCount, types);
    setExercises(ex);
    setIndex(0);
    setSessionAnswers([]);
    setAnswer("");
    setFeedback(null);
    setPhase("session");
  }

  function startMistakeSession() {
    setExercises(recentMistakeExercises);
    setIndex(0);
    setSessionAnswers([]);
    setAnswer("");
    setFeedback(null);
    setPhase("session");
  }

  // ── LANDING ────────────────────────────────────────────────────────────────
  if (phase === "landing") {
    const practiceCount = Math.min(sessionCount, allWords.length > 0 ? sessionCount : 0);
    const topicGroups = vocabularyService.group(
      dueWords.length > 0 ? dueWords : allWords.filter((w) => w.status !== "mastered").slice(0, 20),
      "topic"
    );

    return (
      <main className="page-content">
        <PageHeader
          title={t("student.practice.title")}
          subtitle={`${allWords.length} ${t("student.practice.words_count")}`}
        />

        {allWords.length === 0 ? (
          <EmptyState title={t("student.practice.empty_title")} text={t("student.practice.empty_text")} />
        ) : (
          <>
            {/* Due-today banner */}
            {dueCount > 0 && (
              <div className="sr-due-banner">
                <span className="sr-due-icon">⏰</span>
                <strong>{dueCount}</strong>
                <span>{t("student.practice.due_today")}</span>
              </div>
            )}

            {/* Mistake review card */}
            {recentMistakeExercises.length > 0 && (
              <button type="button" className="mistake-mode-card" onClick={startMistakeSession}>
                <div className="mistake-mode-icon"><AlertCircle size={20} /></div>
                <div className="mistake-mode-info">
                  <strong>Повтори помилки</strong>
                  <span>{recentMistakeExercises.length} вправ де ти помилявся</span>
                </div>
              </button>
            )}

            {/* Plus XP bonus card */}
            {isPlus && (
              <div className="plus-xp-banner">
                <Zap size={16} />
                <span>{t("student.practice.plus_bonus")}</span>
              </div>
            )}

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

            <Button onClick={startSession}>
              {t("student.practice.start_btn").replace("{count}", String(practiceCount))}
            </Button>

            {topicGroups.length > 0 && (
              <div className="practice-preview-section">
                {topicGroups.map(({ label, words }) => (
                  <div key={label}>
                    <div className="word-group-header">{label}</div>
                    <div className="word-mini-list">
                      {words.map((w) => (
                        <span key={w.id} className={w.nextReviewAt && w.nextReviewAt.slice(0, 10) <= new Date().toISOString().slice(0, 10) ? "sr-due-word" : ""}>
                          {w.sk} — {w.uk}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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

    const practiceLabel = `${index + 1} / ${exercises.length}`;

    return (
      <main className="lesson-screen">
        <div className="lesson-top">
          <button type="button" onClick={() => setPhase("landing")} aria-label="Назад"><ChevronLeft /></button>
          <ProgressBar value={percent} />
          <div className="lesson-top-right">
            <span className="question-counter">{practiceLabel}</span>
            {timerEnabled && <span className="practice-timer-chip">{countdown}</span>}
          </div>
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
            : <Button autoFocus onClick={next}>{isLast ? t("student.lesson.finish") : t("student.lesson.next")}</Button>
          }
        </div>
      </main>
    );
  }

  // ── RESULTS ────────────────────────────────────────────────────────────────
  const correctCount = sessionAnswers.filter((a) => a.correct).length;
  const total = sessionAnswers.length;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  return (
    <main className="page-content">
      <PageHeader title={t("student.practice.results_title")} />
      <Card className="result-card">
        <Trophy size={48} color="var(--yellow-strong)" />
        <div className="result-xp-row">
          <h2>+{xpEarned} XP</h2>
          {isPlus && <span className="plus-xp-chip">{t("student.practice.plus_bonus")}</span>}
        </div>
        <p>{correctCount} / {total} {t("student.practice.results_correct")} · {accuracy}%</p>
      </Card>
      <Card>
        <h3>{t("student.practice.results_words")}</h3>
        <div className="practice-results-list">
          {sessionAnswers.map(({ wordId, correct }, i) => {
            const word = allWords.find((w) => w.id === wordId);
            const nextReview = data.userWords[user.id]?.find((w) => w.wordId === wordId)?.nextReviewAt;
            const nextDay = nextReview ? new Date(nextReview).toLocaleDateString("uk-UA", { month: "short", day: "numeric" }) : null;
            return (
              <div key={`${wordId}-${i}`} className="practice-result-word">
                <span className={correct ? "correct-mark" : "wrong-mark"}>{correct ? "✓" : "✗"}</span>
                <span>{word?.sk}</span>
                <span className="word-meta">{word?.uk}</span>
                {nextDay && <span className="sr-next-date">{nextDay}</span>}
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
  const [tab, setTab] = useState<"all" | "ua" | "history">("all");
  const [flashIds, setFlashIds] = useState<Map<string, "up" | "down">>(new Map());
  const prevWeekIdRef = useRef<string | null>(null);

  // Flash rows that moved when week transitions
  useEffect(() => {
    if (prevWeekIdRef.current !== null && prevWeekIdRef.current !== leaderboard.weekId) {
      const map = new Map<string, "up" | "down">();
      leaderboard.entries.forEach((e) => {
        if (e.movement === "up" || e.movement === "down") map.set(e.userId, e.movement);
      });
      setFlashIds(map);
      const tid = setTimeout(() => setFlashIds(new Map()), 1200);
      return () => clearTimeout(tid);
    }
    prevWeekIdRef.current = leaderboard.weekId;
  }, [leaderboard.weekId, leaderboard.entries]);

  const userXp = progress?.xpWeekly ?? 0;
  const userLeague = leaderboardService.leagueFor(userXp);
  const xpToNext = leaderboardService.xpToNextLeague(userXp);
  const leagueProgress = leaderboardService.progressInLeague(userXp);

  const filtered = tab === "ua"
    ? leaderboard.entries.filter((e) => e.country === "UA")
    : leaderboard.entries;

  const top3 = filtered.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter((e): e is LeaderboardEntry => !!e);
  const rest = filtered.slice(3);

  function leaderRow(entry: LeaderboardEntry, showLeagueChange = true) {
    const flash = flashIds.get(entry.userId);
    return (
      <div
        key={entry.userId}
        className={`leader-row${entry.userId === user?.id ? " me" : ""}${flash ? ` movement-flash--${flash}` : ""}`}
      >
        <span className="leader-rank">{entry.rank}</span>
        <div className="leader-avatar">{(entry.avatar ?? entry.name).slice(0, 2).toUpperCase()}</div>
        <span className="leader-name">
          {entry.name}
          {entry.country === "UA" && <span className="country-flag"> 🇺🇦</span>}
        </span>
        <span className="leader-xp">{entry.xpWeekly} XP</span>
        {showLeagueChange && entry.leagueChange
          ? <span className={`league-change league-change--${entry.leagueChange}`}>{t(`student.leaderboard.${entry.leagueChange}`)}</span>
          : entry.movement && (
            <span className={`leader-movement movement--${entry.movement}`}>
              {entry.movement === "up" ? "↑" : entry.movement === "down" ? "↓" : "→"}
            </span>
          )
        }
      </div>
    );
  }

  return (
    <main className="page-content">
      <PageHeader title={t("student.leaderboard.title")} subtitle={`${t(`student.league.${userLeague}`)} · ${formatWeekTimer(weekSeconds)} ${t("student.leaderboard.timer_prefix")}`} />

      <Card className="league-card">
        <div className="league-card-top">
          <span className={`league-badge league-badge--${userLeague.toLowerCase()}`}>{t(`student.league.${userLeague}`)}</span>
          <span className="leader-header-xp">{userXp} {t("student.leaderboard.weekly_xp")}</span>
        </div>
        <div className="league-bar-wrap">
          <div className="league-bar" style={{ width: `${leagueProgress}%` }} />
        </div>
        <p className="league-hint">
          {xpToNext !== null ? `${t("student.leaderboard.league_up")}: ${xpToNext} XP` : t("student.leaderboard.league_top")}
        </p>
      </Card>

      {/* Tabs */}
      <div className="leader-tabs">
        {(["all", "ua", "history"] as const).map((key) => (
          <button key={key} className={`chip${tab === key ? " chip--active" : ""}`} onClick={() => setTab(key)}>
            {t(`student.leaderboard.tab_${key}`)}
          </button>
        ))}
      </div>

      {tab === "history" ? (
        <>
          {leaderboard.history && leaderboard.history.length > 0
            ? [...leaderboard.history].reverse().map((snapshot) => (
              <details key={snapshot.weekId} className="history-week">
                <summary className="history-week-summary">
                  {snapshot.weekId} · {snapshot.entries.length} учасників
                </summary>
                <Card>
                  {snapshot.entries.slice(0, 5).map((entry) => (
                    <div className={`leader-row${entry.userId === user?.id ? " me" : ""}`} key={entry.userId}>
                      <span className="leader-rank">{entry.rank}</span>
                      <div className="leader-avatar">{(entry.avatar ?? entry.name).slice(0, 2).toUpperCase()}</div>
                      <span className="leader-name">{entry.name}</span>
                      <span className="leader-xp">{entry.xpWeekly} XP</span>
                      {entry.movement && (
                        <span className={`leader-movement movement--${entry.movement}`}>
                          {entry.movement === "up" ? "↑" : entry.movement === "down" ? "↓" : "→"}
                        </span>
                      )}
                    </div>
                  ))}
                </Card>
              </details>
            ))
            : <EmptyState title={t("student.leaderboard.history_empty_title")} text={t("student.leaderboard.history_empty_text")} />
          }
        </>
      ) : (
        <>
          {/* Podium top 3 */}
          <div className="podium">
            {podiumOrder.map((entry) => (
              <Card key={entry.userId} className={`podium-card rank-${entry.rank}${entry.userId === user?.id ? " me" : ""}`}>
                <div className={`podium-medal medal--${entry.rank === 1 ? "gold" : entry.rank === 2 ? "silver" : "bronze"}`}><Medal size={22} /></div>
                <div className="podium-avatar">{(entry.avatar ?? entry.name).slice(0, 2).toUpperCase()}</div>
                <strong className="podium-name">{entry.name}</strong>
                <span className="podium-xp">{entry.xpWeekly} XP</span>
                {entry.leagueChange && (
                  <span className={`league-change league-change--${entry.leagueChange}`}>{t(`student.leaderboard.${entry.leagueChange}`)}</span>
                )}
              </Card>
            ))}
          </div>

          {/* List 4+ */}
          {rest.length > 0 && <Card>{rest.map((entry) => leaderRow(entry))}</Card>}
        </>
      )}
    </main>
  );
}

function StudyHeatmap({ xpHistory }: { xpHistory: Record<string, number> | undefined }) {
  const today = new Date();
  const cells = Array.from({ length: 56 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (55 - i));
    const key = d.toISOString().slice(0, 10);
    const xp = xpHistory?.[key] ?? 0;
    const level = xp === 0 ? 0 : xp < 10 ? 1 : xp < 25 ? 2 : xp < 50 ? 3 : 4;
    return { key, xp, level };
  });
  return (
    <Card className="heatmap-card">
      <div className="heatmap-header">
        <strong>Активність (8 тижнів)</strong>
        <span className="heatmap-legend">
          {[0, 1, 2, 3, 4].map((l) => <span key={l} className={`heatmap-cell level-${l}`} />)}
        </span>
      </div>
      <div className="heatmap-grid">
        {cells.map(({ key, xp, level }) => (
          <div key={key} className={`heatmap-cell level-${level}`} title={`${key}: ${xp} XP`} />
        ))}
      </div>
    </Card>
  );
}

function buildDailyXp(xpDailyHistory: Record<string, number> | undefined): { label: string; value: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("uk-UA", { weekday: "short" });
    return { label, value: xpDailyHistory?.[key] ?? 0 };
  });
}

function ProfileScreen() {
  const navigate = useNavigate();
  const { user, progress, data, logout, updateUser, restoreHearts } = useStudentData();
  const { t } = useT();
  const [modal, setModal] = useState<"streak" | "hearts" | "avatar" | "logout" | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [sharingProgress, setSharingProgress] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!user || !progress) return <PageSkeleton />;
  const words = vocabularyService.build(data.lessons, data.userWords[user.id]);
  const levelLessons = lessonService.byLevel(data.lessons, user.level);
  const isLevelComplete = levelLessons.length > 0 && levelLessons.every((l) => progress.completedLessons.includes(l.id));
  const masteredCount = words.filter((w) => w.status === "mastered").length;
  const dailyXp = buildDailyXp(progress.xpDailyHistory);
  const maxXp = Math.max(...dailyXp.map((d) => d.value), 1);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext("2d")!;
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, 128, 128);
        setAvatarPreview(canvas.toDataURL("image/jpeg", 0.85));
        setModal("avatar");
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <>
      <div className="profile-hero">
        <div className="profile-hero-info">
          <button className="avatar-wrap" type="button" onClick={() => fileRef.current?.click()} aria-label={t("student.profile.avatar_title")}>
            {user.avatar?.startsWith("data:") || user.avatar?.startsWith("http")
              ? <img className="avatar avatar--photo" src={user.avatar} alt={user.name} />
              : <div className="avatar">{(user.avatar || user.name).slice(0, 2).toUpperCase()}</div>
            }
            <span className="avatar-edit"><Camera size={13} /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
          <div>
            <h2>{user.name}</h2>
            <div className="profile-hero-meta">
              <span className="status-pill">{user.level}</span>
              <span className={`sub-badge sub-badge--${user.subscriptionStatus}`}>{t(`student.subscription.${user.subscriptionStatus}`)}</span>
            </div>
          </div>
        </div>
        <button type="button" className="icon-button" onClick={() => navigate("/app/settings")} aria-label={t("student.settings.title")}>
          <Settings size={20} />
        </button>
      </div>

      <div className="page-content">
        <div className="stats-grid">
          <Card className="stat-card" onClick={() => setModal("streak")}>
            <Flame size={22} color="var(--orange)" />
            <strong>{progress.streakDays}</strong>
            <span>{t("student.profile.stat_streak")}</span>
          </Card>
          <Card className="stat-card" onClick={() => setModal("hearts")}>
            <Heart size={22} color="var(--red)" />
            <strong>{progress.hearts}/{progress.maxHearts}</strong>
            <span>{t("student.profile.stat_hearts")}</span>
          </Card>
          <Card className="stat-card" onClick={() => navigate("/app/path")}>
            <BookOpen size={22} color="var(--purple)" />
            <strong>{progress.completedLessons.length}</strong>
            <span>{t("student.profile.stat_lessons")}</span>
          </Card>
          <Card className="stat-card" onClick={() => navigate("/app/vocabulary")}>
            <Star size={22} color="var(--yellow-strong)" />
            <strong>{masteredCount}</strong>
            <span>{t("student.profile.stat_words")}</span>
          </Card>
        </div>

        <Card className="xp-chart-card">
          <div className="xp-chart-header">
            <div className="xp-chart-title"><Zap size={18} color="var(--purple)" /><strong>{progress.xpTotal}</strong><span>{t("student.profile.stat_xp")}</span></div>
            <span className="xp-week-label">{progress.xpWeekly} {t("student.profile.stat_xp_weekly")}</span>
          </div>
          <div className="xp-chart">
            {dailyXp.map((day, i) => (
              <div key={i} className="xp-bar-col">
                <div className="xp-bar-wrap">
                  <div className="xp-bar" style={{ height: `${Math.round(day.value / maxXp * 100)}%` }} />
                </div>
                <span className="xp-bar-label">{day.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <StudyHeatmap xpHistory={progress.xpDailyHistory} />

        <Card className="sub-card">
          <div className="sub-row">
            <div className="sub-info">
              <p className="sub-goal">{user.goal || t("student.profile.goal_empty")}</p>
              <div className="sub-meta">
                <span className={`sub-badge sub-badge--${user.subscriptionStatus}`}>{t(`student.subscription.${user.subscriptionStatus}`)}</span>
                {user.subscriptionStatus === "trial" && user.trialEndsAt && (
                  <span className="sub-date">до {new Date(user.trialEndsAt).toLocaleDateString("uk-UA")}</span>
                )}
              </div>
            </div>
            {user.subscriptionStatus !== "plus" && (
              <Button variant="secondary" onClick={() => navigate("/app/shop")}>Plus →</Button>
            )}
          </div>
        </Card>

        <Card className="referral-card">
          <div className="referral-card-header">
            <div className="referral-card-icon"><Users size={20} /></div>
            <div>
              <div className="referral-card-title">{t("student.profile.referral_title")}</div>
              <div className="referral-card-text">{t("student.profile.referral_text")}</div>
            </div>
          </div>
          <div className="referral-link-row">
            <span className="referral-link-url">{`${window.location.origin}/register?ref=${user.id}`}</span>
            {referralCopied
              ? <span className="referral-copied">{t("student.profile.referral_copied")}</span>
              : <button type="button" className="referral-copy-btn" onClick={async () => {
                  try { await navigator.clipboard.writeText(`${window.location.origin}/register?ref=${user.id}`); } catch {}
                  setReferralCopied(true);
                  setTimeout(() => setReferralCopied(false), 2000);
                }}>
                  <Link2 size={13} /> {t("student.profile.referral_copy")}
                </button>
            }
          </div>
          <button type="button" className="referral-share-btn" onClick={() => {
            const url = `${window.location.origin}/register?ref=${user.id}`;
            if (navigator.share) {
              navigator.share({ title: "Slovak Life", text: t("student.profile.referral_share_text"), url }).catch(() => undefined);
            } else {
              navigator.clipboard.writeText(url).catch(() => undefined);
              setReferralCopied(true);
              setTimeout(() => setReferralCopied(false), 2000);
            }
          }}>
            <Share2 size={15} /> {t("student.profile.referral_share_link")}
          </button>
        </Card>

        <button
          type="button"
          className="share-progress-btn"
          disabled={sharingProgress}
          onClick={async () => {
            setSharingProgress(true);
            try {
              const blob = await generateShareCard({ xp: progress.xpWeekly, label: "цього тижня", streakDays: progress.streakDays, userName: user.name });
              await shareOrDownloadCard(blob, `Я вивчаю словацьку у Slovak Life! ${progress.xpWeekly} XP цього тижня`);
            } finally { setSharingProgress(false); }
          }}
        >
          <Share2 size={16} /> {sharingProgress ? "…" : t("student.profile.share_progress")}
        </button>

        {isLevelComplete && (
          <Card className="certificate-card">
            <div className="certificate-info">
              <Medal size={28} color="var(--purple)" />
              <div>
                <strong>{t("student.profile.certificate_title")}</strong>
                <p>{t("student.profile.certificate_hint").replace("{level}", user.level)}</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => downloadCertificate(user.name, user.level)}>
              <Download size={16} />
              {t("student.profile.certificate_btn")}
            </Button>
          </Card>
        )}

        <div className="profile-actions-grid">
          <Button variant="secondary" onClick={() => navigate("/placement-test")}><CheckCircle2 size={16} />{t("student.profile.btn_placement")}</Button>
          <Button variant="secondary" onClick={() => navigate("/app/levels")}><Layers size={16} />{t("student.profile.btn_levels")}</Button>
          <Button variant="secondary" onClick={() => navigate("/app/shop")}><ShoppingBag size={16} />{t("student.profile.btn_shop")}</Button>
          <Button variant="danger" onClick={() => setModal("logout")}><LogOut size={16} />{t("student.profile.btn_logout")}</Button>
        </div>
      </div>

      {modal === "streak" && (
        <Modal onClose={() => setModal(null)}>
          <Card className="profile-modal">
            <Flame size={44} color="var(--orange)" />
            <strong className="modal-big-num">{progress.streakDays}</strong>
            <p>{t("student.profile.streak_modal_text")}</p>
            <Button variant="ghost" onClick={() => setModal(null)}>{t("student.profile.avatar_cancel")}</Button>
          </Card>
        </Modal>
      )}

      {modal === "hearts" && (
        <Modal onClose={() => setModal(null)}>
          <Card className="profile-modal">
            <Heart size={44} color="var(--red)" />
            <strong className="modal-big-num">{progress.hearts}/{progress.maxHearts}</strong>
            <p>{t("student.profile.hearts_modal_title")}</p>
            {progress.hearts < progress.maxHearts && (
              <Button onClick={() => { restoreHearts(); setModal(null); }}>{t("student.profile.hearts_restore")}</Button>
            )}
            <Button variant="ghost" onClick={() => setModal(null)}>{t("student.profile.avatar_cancel")}</Button>
          </Card>
        </Modal>
      )}

      {modal === "avatar" && avatarPreview && (
        <Modal onClose={() => { setModal(null); setAvatarPreview(null); }}>
          <Card className="profile-modal">
            <h2>{t("student.profile.avatar_title")}</h2>
            <img className="avatar-preview" src={avatarPreview} alt="preview" />
            <Button onClick={() => { updateUser({ avatar: avatarPreview }); setModal(null); setAvatarPreview(null); }}>
              {t("student.profile.avatar_save")}
            </Button>
            <Button variant="ghost" onClick={() => { setModal(null); setAvatarPreview(null); }}>
              {t("student.profile.avatar_cancel")}
            </Button>
          </Card>
        </Modal>
      )}

      {modal === "logout" && (
        <Modal onClose={() => setModal(null)}>
          <Card className="profile-modal">
            <h2>{t("student.profile.logout_confirm_title")}</h2>
            <p>{t("student.profile.logout_confirm_text")}</p>
            <Button variant="danger" onClick={logout}>{t("student.profile.logout_confirm_btn")}</Button>
            <Button variant="ghost" onClick={() => setModal(null)}>{t("student.profile.logout_cancel")}</Button>
          </Card>
        </Modal>
      )}
    </>
  );
}

function SettingsScreen() {
  const { user, updateUser, logout } = useStudentData();
  const navigate = useNavigate();
  const { t } = useT();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [goal, setGoal] = useState(user?.goal || "");
  const [notifications, setNotifications] = useState(user?.settings.notificationsEnabled ?? true);
  const [sound, setSound] = useState(user?.settings.soundEnabled ?? true);
  const [haptics, setHaptics] = useState(user?.settings.hapticsEnabled ?? true);
  const [reminderTime, setReminderTime] = useState(user?.settings.reminderTime ?? "");
  const [reminderSaved, setReminderSaved] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);
  const [pwExpanded, setPwExpanded] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [modal, setModal] = useState<"deactivate" | "delete" | null>(null);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  if (!user) return <PageSkeleton />;
  const lang = (user.settings.language || "uk") as "uk" | "sk" | "en";

  async function saveProfile() {
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail !== user!.email.toLowerCase()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setEmailError(t("student.settings.email_invalid"));
        return;
      }
      try {
        await apiClient.changeEmail(trimmedEmail);
        setEmailSaved(true);
        setEmailError("");
        setTimeout(() => setEmailSaved(false), 2500);
        updateUser({ email: trimmedEmail, name, goal, settings: { ...user!.settings, notificationsEnabled: notifications, soundEnabled: sound, hapticsEnabled: haptics } });
      } catch (err: unknown) {
        const e = err as { status?: number };
        setEmailError(e.status === 409 ? t("student.settings.email_taken") : t("student.settings.email_invalid"));
        return;
      }
    } else {
      updateUser({ name, goal, settings: { ...user!.settings, notificationsEnabled: notifications, soundEnabled: sound, hapticsEnabled: haptics } });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    }
  }

  function changeLanguage(code: "uk" | "sk" | "en") {
    updateUser({ settings: { ...user!.settings, language: code } });
  }

  async function submitPasswordChange() {
    if (newPw !== confirmPw) { setPwError(t("student.settings.password_mismatch")); return; }
    if (newPw.length < 8) { setPwError(t("student.settings.password_short")); return; }
    setPwError(""); setPwLoading(true);
    try {
      await apiClient.changePassword(currentPw, newPw);
      setPwSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => { setPwSuccess(false); setPwExpanded(false); }, 2500);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      setPwError(e.status === 401 ? t("student.settings.password_wrong") : (e.message || "Помилка"));
    } finally {
      setPwLoading(false);
    }
  }

  async function handleDeactivate() {
    setActionLoading(true); setActionError("");
    try {
      await apiClient.deactivateAccount();
      logout();
    } catch (err: unknown) {
      setActionError((err as { message?: string }).message || "Помилка");
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (deleteEmail.trim().toLowerCase() !== user!.email.toLowerCase()) {
      setActionError(t("student.settings.email_invalid"));
      return;
    }
    setActionLoading(true); setActionError("");
    try {
      await apiClient.deleteAccount(deleteEmail.trim());
      logout();
    } catch (err: unknown) {
      setActionError((err as { message?: string }).message || "Помилка");
      setActionLoading(false);
    }
  }

  return (
    <main className="page-content settings-page">
      <PageHeader
        title={t("student.settings.title")}
        action={
          <button type="button" className="back-btn" onClick={() => navigate("/app/profile")} aria-label="Назад">
            <ChevronLeft size={20} />
          </button>
        }
      />

      <section className="settings-section">
        <h3 className="settings-section-title">{t("student.settings.section_profile")}</h3>
        <Card className="form-stack">
          <Field label={t("student.settings.name")} value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <Field label={t("student.settings.email")} value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(""); setEmailSaved(false); }} />
            {emailError && <p className="field-error">{emailError}</p>}
            {emailSaved && <p className="field-success">{t("student.settings.email_saved")}</p>}
          </div>
          <Field label={t("student.settings.goal")} value={goal} onChange={(e) => setGoal(e.target.value)} />
          <Button onClick={saveProfile}>
            {profileSaved ? t("student.settings.saved") : t("student.settings.save")}
          </Button>
        </Card>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">{t("student.settings.section_language")}</h3>
        <Card>
          <div className="lang-picker">
            {(["uk", "sk", "en"] as const).map((code) => (
              <button
                key={code}
                type="button"
                className={`lang-btn${lang === code ? " lang-btn--active" : ""}`}
                onClick={() => changeLanguage(code)}
              >
                {t(`student.settings.lang_${code}`)}
              </button>
            ))}
          </div>
        </Card>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">{t("student.settings.section_notifications")}</h3>
        <Card className="form-stack">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={notifications}
              onChange={(e) => {
                const enabled = e.target.checked;
                setNotifications(enabled);
                if (enabled) {
                  import("../../services/fcmService").then(({ requestFcmToken }) =>
                    requestFcmToken().then((tok) => { if (tok) apiClient.saveFcmToken(tok).catch(() => undefined); })
                  );
                } else {
                  import("../../services/fcmService").then(({ revokeFcmToken }) => revokeFcmToken());
                }
              }}
            />
            {t("student.settings.notifications")}
          </label>
          {notifications && (
            <div className="reminder-row">
              <span className="reminder-label">{t("student.settings.reminder_label")}</span>
              <div className="reminder-control">
                <input
                  type="time"
                  className="reminder-time-input"
                  value={reminderTime}
                  onChange={async (e) => {
                    const time = e.target.value;
                    setReminderTime(time);
                    updateUser({ settings: { ...user!.settings, reminderTime: time || undefined } });
                    apiClient.saveReminder(time || null).catch(() => undefined);
                    setReminderSaved(true);
                    setTimeout(() => setReminderSaved(false), 2000);
                  }}
                />
                {!reminderTime && <span className="reminder-off">{t("student.settings.reminder_off")}</span>}
                {reminderSaved && <span className="reminder-saved">✓ {t("student.settings.reminder_saved")}</span>}
              </div>
            </div>
          )}
          <label className="toggle-row">
            <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
            {t("student.settings.sound")}
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={haptics} onChange={(e) => setHaptics(e.target.checked)} />
            {t("student.settings.haptics")}
          </label>
        </Card>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">{t("student.settings.section_password")}</h3>
        <Card className="form-stack">
          {pwSuccess && <p className="field-success">{t("student.settings.password_success")}</p>}
          {!pwExpanded && !pwSuccess && (
            <Button variant="secondary" onClick={() => setPwExpanded(true)}>
              {t("student.settings.password_change")}
            </Button>
          )}
          {pwExpanded && !pwSuccess && (
            <>
              <Field label={t("student.settings.password_current")} type="password" value={currentPw} onChange={(e) => { setCurrentPw(e.target.value); setPwError(""); }} />
              <Field label={t("student.settings.password_new")} type="password" value={newPw} onChange={(e) => { setNewPw(e.target.value); setPwError(""); }} />
              <Field label={t("student.settings.password_confirm")} type="password" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setPwError(""); }} />
              {pwError && <p className="field-error">{pwError}</p>}
              <div className="btn-row">
                <Button onClick={submitPasswordChange} disabled={pwLoading}>{t("student.settings.password_change")}</Button>
                <Button variant="ghost" onClick={() => { setPwExpanded(false); setPwError(""); }}>{t("student.settings.cancel")}</Button>
              </div>
            </>
          )}
        </Card>
      </section>

      <section className="settings-section settings-danger">
        <h3 className="settings-section-title settings-section-title--danger">{t("student.settings.danger_zone")}</h3>
        <Card className="form-stack">
          <Button variant="secondary" onClick={() => { setModal("deactivate"); setActionError(""); }}>
            {t("student.settings.deactivate")}
          </Button>
          <Button variant="danger" onClick={() => { setModal("delete"); setDeleteEmail(""); setActionError(""); }}>
            {t("student.settings.delete")}
          </Button>
        </Card>
      </section>

      {modal === "deactivate" && (
        <Modal onClose={() => setModal(null)}>
          <Card className="profile-modal">
            <h2>{t("student.settings.deactivate_title")}</h2>
            <p>{t("student.settings.deactivate_text")}</p>
            {actionError && <p className="field-error">{actionError}</p>}
            <Button variant="danger" onClick={handleDeactivate} disabled={actionLoading}>{t("student.settings.deactivate_confirm")}</Button>
            <Button variant="ghost" onClick={() => setModal(null)}>{t("student.settings.cancel")}</Button>
          </Card>
        </Modal>
      )}

      {modal === "delete" && (
        <Modal onClose={() => setModal(null)}>
          <Card className="profile-modal">
            <h2>{t("student.settings.delete_title")}</h2>
            <p>{t("student.settings.delete_text")}</p>
            <Field label={t("student.settings.email")} placeholder={t("student.settings.delete_placeholder")} value={deleteEmail} onChange={(e) => { setDeleteEmail(e.target.value); setActionError(""); }} />
            {actionError && <p className="field-error">{actionError}</p>}
            <Button variant="danger" onClick={handleDelete} disabled={actionLoading || !deleteEmail.trim()}>{t("student.settings.delete_confirm")}</Button>
            <Button variant="ghost" onClick={() => setModal(null)}>{t("student.settings.cancel")}</Button>
          </Card>
        </Modal>
      )}
    </main>
  );
}

function LevelsScreen() {
  const { data, progress, setLevel, user } = useStudentData();
  const { t } = useT();
  const [pending, setPending] = useState<UserLevel | null>(null);
  
  // If an admin tries to view this, ensure we render safely even if progress is missing 
  // (though ensure_progress on backend should have created it)
  if (!progress || !user) return <PageSkeleton />;

  return (
    <main className="page-content">
      <PageHeader title={t("student.levels.title")} subtitle={t("student.levels.subtitle")} />
      {lessonService.levels.map((level) => {
        const percent = lessonService.levelProgress(data.lessons, progress, level);
        return <Card key={level} className="level-row"><div><h2>{level}</h2><p>{t(`student.level_desc.${level}`)}</p><ProgressBar value={percent} /></div><Button variant={user.level === level ? "primary" : "secondary"} onClick={() => setPending(level)}>{user.level === level ? t("student.levels.current") : t("student.levels.change")}</Button></Card>;
      })}
      {pending ? <div className="bottom-sheet"><Card><h2>{t("student.levels.confirm_title")}</h2><p>{t("student.levels.confirm_text")}</p><Button onClick={() => { setLevel(pending); setPending(null); }}>{t("student.levels.confirm")}</Button><Button variant="ghost" onClick={() => setPending(null)}>{t("student.levels.cancel")}</Button></Card></div> : null}
    </main>
  );
}

function ShopScreen() {
  const { t } = useT();
  const { isPlus } = useStudentData();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const didSubscribe = searchParams.get("subscribed") === "1";

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const { url } = await apiClient.createCheckoutSession();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || "Не вдалося почати оформлення підписки. Спробуйте пізніше.");
      setLoading(false);
    }
  }

  async function handlePortal() {
    setLoading(true);
    setError(null);
    try {
      const { url } = await apiClient.openCustomerPortal();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || "Не вдалося відкрити кабінет. Спробуйте пізніше.");
      setLoading(false);
    }
  }

  return (
    <main className="page-content shop-page">
      <PageHeader title={t("student.shop.title")} subtitle={t("student.shop.subtitle")} />

      {didSubscribe && (
        <Card className="shop-success-card">
          <CheckCircle2 size={32} color="var(--green)" />
          <div className="shop-success-text">
            <h3>{t("student.shop.success_title")}</h3>
            <p>{t("student.shop.success_text")}</p>
          </div>
        </Card>
      )}

      {error && (
        <div className="shop-error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <Card className="shop-card shop-card--main">
        <div className="shop-card-header">
          <Trophy size={48} className="shop-icon-main" />
          <div className="shop-price-tag">€9.99<span>/міс</span></div>
        </div>
        <h2>{t("student.shop.product")}</h2>
        <p>{t("student.shop.desc")}</p>
        
        <div className="shop-comparison">
          <div className="shop-comp-header">
            <span></span>
            <span className="comp-free">Free</span>
            <span className="comp-plus">Plus</span>
          </div>
          <div className="shop-comp-row">
            <span>Серця</span>
            <span>Обмежено</span>
            <span className="comp-check"><CheckCircle2 size={14} /> Безліміт</span>
          </div>
          <div className="shop-comp-row">
            <span>Реклама</span>
            <span>Є</span>
            <span className="comp-check"><CheckCircle2 size={14} /> Відсутня</span>
          </div>
          <div className="shop-comp-row">
            <span>Офлайн режим</span>
            <span>Ні</span>
            <span className="comp-check"><CheckCircle2 size={14} /> Так</span>
          </div>
          <div className="shop-comp-row">
            <span>Статистика</span>
            <span>Базова</span>
            <span className="comp-check"><CheckCircle2 size={14} /> Повна</span>
          </div>
        </div>

        {isPlus
          ? <div className="shop-active-status">
              <div className="status-label">
                <Star size={16} fill="var(--yellow-strong)" color="var(--yellow-strong)" />
                <span>У тебе активований Plus</span>
              </div>
              <Button variant="secondary" disabled={loading} onClick={handlePortal}>
                {loading ? t("student.shop.btn_loading") : t("student.shop.btn_manage")}
              </Button>
            </div>
          : <Button variant="primary" disabled={loading} onClick={handleSubscribe} className="shop-btn-buy">
              {loading ? t("student.shop.btn_loading") : t("student.shop.btn_subscribe")}
            </Button>
        }
      </Card>

      <div className="shop-faq">
        <p className="muted text-center sm">
          Ти можеш скасувати підписку в будь-який момент через кабінет Stripe.
        </p>
      </div>
    </main>
  );
}
