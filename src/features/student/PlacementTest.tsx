import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CheckCircle2, Clock3, FileText, RotateCcw, ShieldCheck } from "lucide-react";
import { Button, Card, ProgressBar } from "../../components/ui";
import { selectCurrentUser, useAppStore } from "../../store/useAppStore";
import {
  createAttempt,
  placementTestService,
  scoreClosed,
  selectWritingTask,
  wordCount,
  type PlacementAttempt,
  type PlacementDraft
} from "../../services/placementTestService";

const skillLabels: Record<string, string> = {
  reading: "Розуміння тексту",
  grammar: "Граматика",
  vocabulary: "Словниковий запас",
  pragmatics: "Прихований зміст і тон",
  interaction: "Комунікація",
  register: "Стиль і регістр",
  cohesion: "Логіка і зв’язність",
  language_use: "Точність слововживання"
};

const confidenceLabels = {
  high: "висока",
  medium: "середня",
  low: "низька"
};

export function PlacementTest() {
  const navigate = useNavigate();
  const data = useAppStore((state) => state.data);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const setLevel = useAppStore((state) => state.setLevel);
  const user = selectCurrentUser(data, currentUserId);
  const [draft, setDraft] = useState<PlacementDraft | null>(() =>
    currentUserId ? placementTestService.loadDraft(currentUserId) : null
  );
  const [attempt, setAttempt] = useState<PlacementAttempt | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const questionStartedAt = useRef(0);
  const test = placementTestService.test;

  useEffect(() => {
    if (draft) placementTestService.saveDraft(draft);
  }, [draft]);

  useEffect(() => {
    questionStartedAt.current = performance.now();
  }, [draft?.currentIndex]);

  const question = draft?.phase === "questions"
    ? placementTestService.question(draft.questionIds[draft.currentIndex])
    : null;
  const options = useMemo(
    () => question && draft ? placementTestService.options(question, draft.attemptId) : [],
    [draft, question]
  );

  if (!user) return <Navigate to="/login" replace />;

  function begin() {
    placementTestService.clearDraft();
    setAttempt(null);
    setReviewOpen(false);
    setDraft(placementTestService.start(user!.id));
  }

  function answer(optionId: string, eventTimeStamp: number) {
    if (!draft) return;
    setDraft(placementTestService.answer(draft, optionId, eventTimeStamp - questionStartedAt.current));
  }

  function updateWriting(text: string) {
    if (!draft) return;
    setDraft({ ...draft, writingText: text });
  }

  function finish() {
    if (!draft) return;
    const result = createAttempt(draft, draft.writingText);
    placementTestService.saveAttempt(result);
    placementTestService.clearDraft();
    setAttempt(result);
    setDraft(null);
  }

  function startCourse() {
    if (!attempt) return;
    if (user!.onboardingDone) {
      setLevel(attempt.result.recommendedCourseLevel);
      navigate("/app/path", { replace: true });
    } else {
      completeOnboarding(user!.goal || "Життя у Словаччині", attempt.result.recommendedCourseLevel);
      navigate("/app/paywall", { replace: true });
    }
  }

  if (attempt) {
    const incorrect = attempt.answers.filter((answer) => answer.status !== "correct");
    return (
      <main className="placement-page">
        <Card className="placement-result">
          <div className="placement-result-icon"><CheckCircle2 size={34} /></div>
          <p className="placement-kicker">Твій результат</p>
          <h1>{attempt.result.overallLevel}</h1>
          <p className="placement-result-lead">
            Рекомендований старт курсу: <strong>{attempt.result.recommendedCourseLevel}</strong>
          </p>
          <div className="placement-result-grid">
            <div><span>Закрита частина</span><strong>{attempt.result.closedResult.replace("_candidate", " (потребує підтвердження)")}</strong></div>
            <div><span>Письмо</span><strong>{attempt.result.writingLevel}</strong></div>
            <div><span>Упевненість</span><strong>{confidenceLabels[attempt.result.confidence]}</strong></div>
            <div><span>«Не знаю»</span><strong>{Math.round(attempt.result.unknownShare * 100)}%</strong></div>
          </div>
          {attempt.result.weakSkills.length > 0 && (
            <div className="placement-weaknesses">
              <strong>Варто попрацювати:</strong>
              <span>{attempt.result.weakSkills.map((skill) => skillLabels[skill] ?? skill).join(", ")}</span>
            </div>
          )}
          <p className="placement-note">
            Це орієнтовний письмовий рівень, а не офіційний сертифікат CEFR. Автоматична оцінка письма є попередньою.
          </p>
          <div className="placement-actions">
            <Button onClick={startCourse}>Почати навчання</Button>
            <Button variant="secondary" onClick={() => setReviewOpen((open) => !open)}>
              {reviewOpen ? "Сховати помилки" : "Переглянути мої помилки"}
            </Button>
            <Button variant="ghost" onClick={begin}><RotateCcw size={16} /> Пройти ще раз</Button>
          </div>
        </Card>

        {reviewOpen && (
          <section className="placement-review" aria-label="Перегляд помилок">
            <h2>Розбір відповідей</h2>
            {incorrect.length === 0 ? (
              <Card><p>Усі закриті завдання виконано правильно.</p></Card>
            ) : incorrect.map((answer) => {
              const item = placementTestService.question(answer.questionId);
              const selected = item.options.find((option) => option.id === answer.selectedOptionId);
              const correct = item.options.find((option) => option.id === item.correctOptionId);
              return (
                <Card key={answer.questionId} className="placement-review-item">
                  <span className="placement-review-id">{item.id} · {skillLabels[item.skill] ?? item.skill}</span>
                  <h3>{item.question_ua}</h3>
                  <p><strong>Твоя відповідь:</strong> {answer.status === "unknown" ? "Не знаю" : selected?.text}</p>
                  <p><strong>Правильна відповідь:</strong> {correct?.text}</p>
                  <p className="placement-explanation">{item.explanation_ua}</p>
                </Card>
              );
            })}
          </section>
        )}
      </main>
    );
  }

  if (!draft) {
    return (
      <main className="placement-page placement-intro">
        <Card className="placement-intro-card">
          <div className="placement-intro-icon"><FileText size={34} /></div>
          <h1>{test.startScreen.title_ua}</h1>
          <p className="placement-subtitle">{test.subtitle_ua}</p>
          <div className="placement-meta">
            <span><Clock3 size={17} /> {test.estimatedMinutes.min}–{test.estimatedMinutes.max} хвилин</span>
            <span><ShieldCheck size={17} /> Результат зберігається</span>
          </div>
          <ul>
            {test.startScreen.body_ua.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <p className="placement-note">{test.disclaimer_ua}</p>
          <Button onClick={begin}>{test.startScreen.primaryButton_ua}</Button>
        </Card>
      </main>
    );
  }

  const totalQuestions = draft.questionIds.length > 8 ? 20 : 20;
  const questionProgress = Math.round((draft.answers.length / (totalQuestions + 1)) * 100);

  if (draft.phase === "writing") {
    const closed = scoreClosed(draft.branchId!, draft.answers);
    const task = selectWritingTask(closed);
    const count = wordCount(draft.writingText);
    const canFinish = count >= task.minWords;
    return (
      <main className="placement-page">
        <div className="placement-progress">
          <div><span>Письмове завдання</span><strong>21 / 21</strong></div>
          <ProgressBar value={95} />
        </div>
        <Card className="placement-question-card placement-writing-card">
          <span className="placement-question-type">Остання частина</span>
          <h1>{task.title_ua}</h1>
          <p>{task.instruction_ua}</p>
          {task.sourceTexts_sk?.map((source) => <blockquote key={source}>{source}</blockquote>)}
          <div className="placement-requirements">
            <strong>У тексті потрібно:</strong>
            <ul>{task.requirements_ua.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul>
          </div>
          <label className="placement-writing-field">
            <span>Відповідь словацькою</span>
            <textarea
              value={draft.writingText}
              onChange={(event) => updateWriting(event.target.value)}
              rows={12}
              spellCheck
              autoFocus
              placeholder="Напиши відповідь тут…"
            />
          </label>
          <div className={`placement-word-count${canFinish ? " valid" : ""}`}>
            {count} слів · мінімум {task.minWords}, рекомендовано до {task.maxWords}
          </div>
          <Button disabled={!canFinish} onClick={finish}>Завершити й отримати результат</Button>
          {!canFinish && <p className="placement-help">Додай ще {task.minWords - count} слів, щоб завершити тест.</p>}
        </Card>
      </main>
    );
  }

  return (
    <main className="placement-page">
      <div className="placement-progress">
        <div><span>Діагностичний тест</span><strong>{draft.currentIndex + 1} / 20</strong></div>
        <ProgressBar value={questionProgress} />
      </div>
      <Card className="placement-question-card">
        <span className="placement-question-type">{skillLabels[question!.skill] ?? question!.skill}</span>
        <h1>{question!.question_ua}</h1>
        {question!.context_ua && <p className="placement-context">{question!.context_ua}</p>}
        {question!.prompt_sk && <blockquote>{question!.prompt_sk}</blockquote>}
        {question!.sequenceItems && (
          <ol className="placement-sequence">
            {question!.sequenceItems.map((item) => <li key={item}>{item}</li>)}
          </ol>
        )}
        <div className="placement-options">
          {options.map((option) => (
            <button type="button" key={option.id} onClick={(event) => answer(option.id, event.timeStamp)}>
              <span>{option.id.toUpperCase()}</span>{option.text}
            </button>
          ))}
          <button type="button" className="unknown" onClick={(event) => answer(test.globalSettings.unknownOptionId, event.timeStamp)}>
            <span>?</span>{test.globalSettings.unknownLabel_ua}
          </button>
        </div>
        <p className="placement-help">Повернутися до попереднього питання не можна. Правильні відповіді з’являться після завершення.</p>
      </Card>
    </main>
  );
}
