import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Check, CheckCircle2, ChevronLeft, Coffee, Sparkles } from "lucide-react";
import { Button } from "../../components/ui";
import { demoService } from "../../services/demoService";
import { selectCurrentUser, useAppStore } from "../../store/useAppStore";

const phrases = [
  { sk: "Dobrý deň", uk: "Добрий день" },
  { sk: "Prosím si kávu", uk: "Мені, будь ласка, каву" },
  { sk: "Ďakujem", uk: "Дякую" },
];

const options = [
  "Kde je káva?",
  "Prosím si kávu.",
  "Kávu nemám.",
];

export function DemoLesson() {
  const navigate = useNavigate();
  const { data, currentUserId, logout } = useAppStore();
  const user = selectCurrentUser(data, currentUserId);
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);

  const isCorrect = answer === "Prosím si kávu.";
  const progress = useMemo(() => ((step + 1) / 4) * 100, [step]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.onboardingDone && !demoService.isPending()) {
    return <Navigate to="/app/path" replace />;
  }

  function finish() {
    demoService.complete();
    navigate("/onboarding", { replace: true });
  }

  function nextQuestion() {
    if (!checked) {
      setChecked(true);
      return;
    }
    if (isCorrect) setStep(3);
  }

  return (
    <main className="demo-lesson-page" data-testid="demo-lesson">
      <div className="demo-lesson-shell">
        <header className="demo-lesson-header">
          <button
            type="button"
            className="demo-close-btn"
            aria-label="Повернутися до входу"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <div
            className="demo-progress"
            role="progressbar"
            aria-label="Прогрес демо-уроку"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <span className="demo-step-count">{step + 1}/4</span>
        </header>

        {step === 0 && (
          <section className="demo-stage demo-stage--intro">
            <div className="demo-icon-orbit" aria-hidden="true">
              <Coffee size={40} />
            </div>
            <span className="demo-kicker">Пробний урок · 3 хвилини</span>
            <h1>Замовляємо каву словацькою</h1>
            <p>Після цього короткого уроку ти зможеш привітатися, зробити замовлення та подякувати.</p>
            <div className="demo-outcomes">
              <span><CheckCircle2 size={17} /> 3 корисні фрази</span>
              <span><CheckCircle2 size={17} /> реальна ситуація</span>
            </div>
            <Button onClick={() => setStep(1)}>Почати урок</Button>
          </section>
        )}

        {step === 1 && (
          <section className="demo-stage">
            <span className="demo-kicker">Спочатку запам’ятай</span>
            <h1>Три фрази для кав’ярні</h1>
            <div className="demo-phrase-list">
              {phrases.map((phrase, index) => (
                <article className="demo-phrase" key={phrase.sk}>
                  <span className="demo-phrase-number">{index + 1}</span>
                  <div>
                    <strong>{phrase.sk}</strong>
                    <p>{phrase.uk}</p>
                  </div>
                </article>
              ))}
            </div>
            <Button onClick={() => setStep(2)}>Перевірити себе</Button>
          </section>
        )}

        {step === 2 && (
          <section className="demo-stage">
            <span className="demo-kicker">Обери правильну відповідь</span>
            <h1>Як сказати «Мені, будь ласка, каву»?</h1>
            <div className="demo-options">
              {options.map((option) => {
                const selected = answer === option;
                const stateClass = checked
                  ? option === "Prosím si kávu."
                    ? " is-correct"
                    : selected
                      ? " is-wrong"
                      : ""
                  : selected
                    ? " is-selected"
                    : "";
                return (
                  <button
                    type="button"
                    className={`demo-option${stateClass}`}
                    key={option}
                    disabled={checked}
                    onClick={() => setAnswer(option)}
                  >
                    <span>{option}</span>
                    {checked && option === "Prosím si kávu." && <Check size={18} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            {checked && (
              <div className={`demo-feedback ${isCorrect ? "is-correct" : "is-wrong"}`} role="status">
                {isCorrect
                  ? "Výborne! Саме так замовляють каву."
                  : "Майже! Спробуй ще раз — правильна фраза підсвічена."}
              </div>
            )}
            <Button
              disabled={!answer}
              onClick={() => {
                if (checked && !isCorrect) {
                  setAnswer("");
                  setChecked(false);
                  return;
                }
                nextQuestion();
              }}
            >
              {checked ? (isCorrect ? "Продовжити" : "Спробувати ще раз") : "Перевірити"}
            </Button>
          </section>
        )}

        {step === 3 && (
          <section className="demo-stage demo-stage--result">
            <div className="demo-result-burst" aria-hidden="true">
              <Sparkles size={42} />
            </div>
            <span className="demo-kicker">Перший результат</span>
            <h1>Ти вже можеш замовити каву!</h1>
            <p className="demo-result-dialogue">
              <span>— Dobrý deň. Prosím si kávu.</span>
              <span>— Nech sa páči.</span>
              <span>— Ďakujem!</span>
            </p>
            <div className="demo-result-note">
              Далі налаштуємо твій рівень і ціль, щоб почати повну програму.
            </div>
            <Button onClick={finish}>Налаштувати навчання</Button>
          </section>
        )}
      </div>
    </main>
  );
}
