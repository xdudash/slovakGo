import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Flame, ShieldCheck, Sparkles, Star, Trophy, XCircle } from "lucide-react";
import { getGuestLanguage, setGuestLanguage } from "../../i18n";
import "../../styles/globals.css";

interface Question {
  id: number;
  slovak: string;
  options: { text: string; correct: boolean }[];
  explanation: string;
  hint: string;
}

export function DemoLesson() {
  const navigate = useNavigate();
  const [lang, setLangState] = useState(getGuestLanguage());
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleLangChange = (newLang: "uk" | "ru") => {
    setGuestLanguage(newLang);
    setLangState(newLang);
  };

  const isRu = lang === "ru";

  const questions: Question[] = [
    {
      id: 1,
      slovak: "Як сказати словацькою «Доброго дня»?",
      options: [
        { text: "Dobrý deň", correct: true },
        { text: "Ďakujem", correct: false },
        { text: "Dovidenia", correct: false }
      ],
      explanation: isRu 
        ? "«Dobrý deň» — самое универсальное приветствие в Словакии."
        : "«Dobrý deň» — найуніверсальніше привітання у Словаччині.",
      hint: "Dobrý..."
    },
    {
      id: 2,
      slovak: "Що означає фраза «Ďakujem veľmi pekne»?",
      options: [
        { text: isRu ? "До свидания" : "До побачення", correct: false },
        { text: isRu ? "Большое спасибо" : "Дуже дякую", correct: true },
        { text: isRu ? "Пожалуйста" : "Будь ласка", correct: false }
      ],
      explanation: isRu
        ? "«Ďakujem» — спасибо, «veľmi pekne» — очень красиво / большое."
        : "«Ďakujem» — дякую, «veľmi pekne» — дуже гарно / красно.",
      hint: "Ďakujem..."
    },
    {
      id: 3,
      slovak: "Як ввічливо попросити в кав'ярні: «Каву, ...»?",
      options: [
        { text: "Prosím", correct: true },
        { text: "Prepáčte", correct: false },
        { text: "Ahoj", correct: false }
      ],
      explanation: isRu
        ? "«Prosím» — универсальное «пожалуйста» при заказе или просьбе."
        : "«Prosím» — універсальне «будь ласка» при замовленні або проханні.",
      hint: "Prosím..."
    }
  ];

  const current = questions[stepIndex];

  const handleSelect = (idx: number) => {
    if (isAnswered) return;
    setSelectedOption(idx);
    setIsAnswered(true);
  };

  const handleNext = () => {
    if (stepIndex < questions.length - 1) {
      setStepIndex((i) => i + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setCompleted(true);
    }
  };

  const handleSaveProgress = () => {
    localStorage.setItem("slovakgo.demo-xp", "50");
    localStorage.setItem("slovakgo.demo-streak", "1");
    navigate("/register?demoDone=true");
  };

  return (
    <div className="demo-lesson-wrap">
      <header className="demo-header">
        <div className="demo-header-inner">
          <div className="demo-logo" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
            <img src="/apple-icon.png" alt="SlovakGO" className="logo-icon-sm" />
            <span>SlovakGO</span>
            <span className="demo-badge">{isRu ? "Демо-урок" : "Демо-урок"}</span>
          </div>

          <div className="demo-lang-toggle">
            <button
              className={`lang-btn ${lang === "uk" ? "active" : ""}`}
              onClick={() => handleLangChange("uk")}
            >
              UA
            </button>
            <button
              className={`lang-btn ${lang === "ru" ? "active" : ""}`}
              onClick={() => handleLangChange("ru")}
            >
              RU
            </button>
          </div>
        </div>

        {!completed && (
          <div className="demo-progress-bar">
            <div
              className="demo-progress-fill"
              style={{ width: `${((stepIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        )}
      </header>

      <main className="demo-container">
        {!completed ? (
          <div className="demo-card">
            <div className="demo-question-badge">
              <Sparkles size={16} />
              <span>{isRu ? `Вопрос ${stepIndex + 1} из ${questions.length}` : `Запитання ${stepIndex + 1} з ${questions.length}`}</span>
            </div>

            <h2 className="demo-question">{current.slovak}</h2>

            <div className="demo-options">
              {current.options.map((opt, idx) => {
                let stateClass = "";
                if (isAnswered) {
                  if (opt.correct) stateClass = "correct";
                  else if (selectedOption === idx) stateClass = "wrong";
                } else if (selectedOption === idx) {
                  stateClass = "selected";
                }

                return (
                  <button
                    key={idx}
                    className={`demo-opt-btn ${stateClass}`}
                    onClick={() => handleSelect(idx)}
                    disabled={isAnswered}
                  >
                    <span className="opt-text">{opt.text}</span>
                    {isAnswered && opt.correct && <CheckCircle2 className="opt-icon text-success" size={20} />}
                    {isAnswered && !opt.correct && selectedOption === idx && <XCircle className="opt-icon text-error" size={20} />}
                  </button>
                );
              })}
            </div>

            {isAnswered && (
              <div className="demo-feedback">
                <p className="feedback-text">{current.explanation}</p>
                <button className="btn btn-primary btn-lg continue-btn" onClick={handleNext}>
                  {stepIndex < questions.length - 1
                    ? (isRu ? "Следующий вопрос" : "Наступне запитання")
                    : (isRu ? "Завершить урок" : "Завершити урок")
                  }
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="demo-completed-card">
            <div className="trophy-badge">
              <Trophy size={48} color="#f59e0b" />
            </div>

            <h1>{isRu ? "Первый результат получен! 🎉" : "Перший результат є! 🎉"}</h1>
            <p className="completed-subtitle">
              {isRu
                ? "Вы проявили отличную интуицию! Словацкий язык очень близок и понятен."
                : "Ти чудово впорався! Словацька мова дуже близька та зрозуміла."
              }
            </p>

            <div className="reward-badges">
              <div className="reward-item">
                <Star size={24} color="#f59e0b" fill="#f59e0b" />
                <div className="reward-info">
                  <strong>+50 XP</strong>
                  <span>{isRu ? "Заработанный опыт" : "Зароблений досвід"}</span>
                </div>
              </div>

              <div className="reward-item">
                <Flame size={24} color="#ef4444" fill="#ef4444" />
                <div className="reward-info">
                  <strong>1 {isRu ? "день" : "день"}</strong>
                  <span>{isRu ? "Серия заходов" : "Серія занять"}</span>
                </div>
              </div>
            </div>

            <div className="save-cta-box">
              <div className="cta-icon">
                <ShieldCheck size={24} color="#10b981" />
              </div>
              <p>
                {isRu
                  ? "Сохраните результат за 10 секунд, чтобы открыть полный доступ к 7 дням бесплатного обучения."
                  : "Збережи результат за 10 секунд, щоб відкрити 7 днів безкоштовного навчання."
                }
              </p>
              <button className="btn btn-primary btn-xl full-width-btn" onClick={handleSaveProgress}>
                {isRu ? "Сохранить прогресс и продолжить" : "Зберегти прогрес та продовжити"}
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
